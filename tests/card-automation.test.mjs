import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleCardAutomationRelay } from '../lib/server/card-automation.generated.mjs';

const origin = 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site';
const path = '/api/card-automation';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0004_card_automation_nonces.sql', import.meta.url), 'utf8'));
const db = {
  prepare(sql) { return { async first() { return sqlite.prepare(sql).get() ?? null; }, bind(...args) { return { sql, args }; } }; },
  async batch(statements) { sqlite.exec('BEGIN'); try {
    const result = statements.map(s => ({ meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } }));
    sqlite.exec('COMMIT'); return result;
  } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
};
after(() => sqlite.close());
const config = { card_studio_enabled: 'true', card_studio_owner_id: 'synthetic-owner',
  DB: db,
  card_studio_bridge_secret: 'synthetic-bridge-with-at-least-thirty-two-characters',
  google_ai_enabled: 'true', google_api: 'synthetic-google', groq_api: 'synthetic-groq' };
function signed(body, now = Date.now()) {
  const text = JSON.stringify(body), time = String(now), nonce = randomUUID();
  const key = createHmac('sha256', config.card_studio_bridge_secret)
    .update(`en-card:ai-relay:v1:${config.card_studio_owner_id}`).digest();
  const signature = createHmac('sha256', key).update(`POST\n${path}\n${time}\n${nonce}\n${text}`).digest('hex');
  return new Request(origin + path, { method: 'POST', body: text, headers: {
    'Content-Type': 'application/json', 'X-Card-Time': time,
    'X-Card-Nonce': nonce, 'X-Card-Signature': signature } });
}
test('the exported server bundle checks existing Site keys without an AI call', async () => {
  const response = await handleCardAutomationRelay(signed({ action: 'status' }), config,
    async () => { throw new Error('Status must not call AI'); });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ready: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('a browser or another studio owner cannot use the server AI route', async () => {
  const browserRequests = [{ Origin: origin }, { Cookie: 'synthetic=1' }].map(extra => {
    const request = signed({ action: 'status' });
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
    return new Request(request, { headers });
  });
  for (const request of [new Request(origin + path, { method: 'POST', body: '{}' }), ...browserRequests]) {
    assert.equal((await handleCardAutomationRelay(request, config)).status, 403);
  }
  assert.equal((await handleCardAutomationRelay(signed({ action: 'status' }),
    { ...config, card_studio_owner_id: 'someone-else' })).status, 403);
});
test('signature binds the body and accepts only the sixty-second time window', async () => {
  const now = 1791029207259;
  const noProvider = async () => { throw new Error('Status must not call AI'); };
  for (const delta of [-60000, 60000])
    assert.equal((await handleCardAutomationRelay(signed({ action: 'status' }, now + delta), config, noProvider, () => now)).status, 200);
  for (const delta of [-60001, 60001])
    assert.equal((await handleCardAutomationRelay(signed({ action: 'status' }, now + delta), config, noProvider, () => now)).status, 403);
  const original = signed({ action: 'status' }, now);
  assert.equal((await handleCardAutomationRelay(new Request(original, { body: '{"action":"call"}' }), config, noProvider, () => now)).status, 403);
});
function callBody(provider = 'google', stage = 'draft', content = null) {
  return { action: 'call', free: 'google_groq_free', input: { provider, stage,
    settings: { topic: '일상', base_expression: '', level: '초급', template: 'expression', start_date: '2026-10-03', end_date: null, time: '23:00' },
    content, review: null, recent: [] } };
}
test('missing schema and failed nonce reservation never call a provider or partially clean receipts', async () => {
  let calls = 0;
  const provider = async () => { calls++; throw new Error('Unexpected provider call'); };
  for (const DB of [undefined, { prepare() { return { async first() { throw new Error('Private SQL detail'); } }; } }]) {
    assert.deepEqual(await (await handleCardAutomationRelay(signed({ action: 'status' }), { ...config, DB }, provider)).json(), { ready: false });
    const result = await handleCardAutomationRelay(signed(callBody()), { ...config, DB }, provider);
    assert.equal(result.status, 503);
    assert.equal((await result.text()).includes('Private SQL detail'), false);
  }
  const expired = randomUUID();
  sqlite.prepare('INSERT INTO card_automation_nonces VALUES(?,?)').run(expired, 0);
  const failingDb = { ...db, prepare(sql) { return db.prepare(sql.startsWith('INSERT') ? sql.replace('card_automation_nonces', 'missing_nonce_table') : sql); } };
  assert.equal((await handleCardAutomationRelay(signed(callBody()), { ...config, DB: failingDb }, provider)).status, 503);
  assert.ok(sqlite.prepare('SELECT nonce FROM card_automation_nonces WHERE nonce=?').get(expired));
  assert.equal(calls, 0);
});
test('both provider contracts validate outputs and failed requests remain replay-protected without retry', async () => {
  const card = { template: 'expression', expression: 'Take your time', meaning_ko: '천천히 해', example_en: 'Take your time.', example_ko: '천천히 해.', note_ko: '', base_expression: '', base_meaning_ko: '' };
  const review = { natural: true, meaning: true, grammar: true, translation: true, level: true, comparison: true, issues: [] };
  for (const [provider, stage, output] of [['google', 'draft', card], ['groq', 'review', review]]) {
    let calls = 0;
    const transport = async (url, init) => {
      calls++; assert.equal(init.redirect, 'manual');
      assert.equal(new URL(url).hostname, provider === 'google' ? 'generativelanguage.googleapis.com' : 'api.groq.com');
      assert.equal(new Headers(init.headers).get(provider === 'google' ? 'x-goog-api-key' : 'Authorization'), provider === 'google' ? 'synthetic-google' : 'Bearer synthetic-groq');
      return Response.json(provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] } : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] });
    };
    const result = await handleCardAutomationRelay(signed(callBody(provider, stage, stage === 'review' ? card : null)), config, transport);
    assert.equal(result.status, 200); assert.deepEqual(await result.json(), { result: output }); assert.equal(calls, 1);
  }
  for (const status of [302, 429, 503]) {
    let calls = 0;
    const request = signed(callBody());
    const transport = async () => { calls++; return new Response('private provider detail', { status, headers: { Location: 'https://another-host.test' } }); };
    assert.equal((await handleCardAutomationRelay(request.clone(), config, transport)).status, 502);
    assert.equal((await handleCardAutomationRelay(request.clone(), config, transport)).status, 409);
    assert.equal(calls, 1);
  }
  const malformed = await handleCardAutomationRelay(signed(callBody()), config, async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] }));
  assert.equal(malformed.status, 502); assert.deepEqual(await malformed.json(), { error: 'invalid', http_status: null });
});
test('relay distinguishes oversized and invalid requests from invalid provider responses before any call', async () => {
  let calls = 0;
  const transport = async () => { calls++; throw new Error('Unexpected provider call'); };
  const original = signed({ action: 'status' });
  const headers = new Headers(original.headers); headers.set('Content-Length', '65537');
  const oversized = await handleCardAutomationRelay(new Request(original, { headers }), config, transport);
  assert.equal(oversized.status, 413); assert.deepEqual(await oversized.json(), { error: 'invalid' });
  let cancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(40000)); }, cancel() { cancelled = true; } });
  const streamed = await handleCardAutomationRelay(new Request(signed({ action: 'status' }), { body: stream, duplex: 'half' }), config, transport);
  assert.equal(streamed.status, 413); assert.equal(cancelled, true);
  const invalid = await handleCardAutomationRelay(signed({ action: 'unknown' }), config, transport);
  assert.equal(invalid.status, 400); assert.deepEqual(await invalid.json(), { error: 'invalid' });
  assert.equal(calls, 0);
});
test('the bundled provider uses its Site key and strips provider error details', async () => {
  let calls = 0;
  const request = signed({ action: 'call', free: 'google_groq_free', input: {
    provider: 'google', stage: 'draft', settings: { topic: '일상', base_expression: '', level: '초급', template: 'expression', start_date: '2026-10-03', end_date: null, time: '23:00' }, content: null, review: null, recent: [],
  } });
  const provider = async (url, options) => {
    calls++;
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(new Headers(options.headers).get('x-goog-api-key'), 'synthetic-google');
    return new Response('private provider body', { status: 429 });
  };
  const responses = await Promise.all([handleCardAutomationRelay(request.clone(), config, provider),
    handleCardAutomationRelay(request.clone(), config, provider)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [409, 502]);
  const response = responses.find(r => r.status === 502);
  assert.equal(calls, 1);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'quota', http_status: 429 });
});
test('the generated relay has intact provenance and stays outside public assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../lib/server/card-automation.generated.json', import.meta.url), 'utf8'));
  assert.equal(manifest.format, 'en-card-ai-relay-v1');
  assert.deepEqual(Object.keys(manifest.files).sort(), ['card-automation.generated.d.mts', 'card-automation.generated.mjs']);
  for (const [name, hash] of Object.entries(manifest.files))
    assert.equal(createHash('sha256').update(await readFile(new URL('../lib/server/' + name, import.meta.url))).digest('hex'), hash);
  const route = await readFile(new URL('../app/api/card-automation/route.ts', import.meta.url), 'utf8');
  assert.match(route, /handleCardAutomationRelay\(request, env\)/);
});
