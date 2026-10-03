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
function signed(body) {
  const text = JSON.stringify(body), time = String(Date.now()), nonce = randomUUID();
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
  for (const request of [new Request(origin + path, { method: 'POST', body: '{}' }),
    new Request(signed({ action: 'status' }), { headers: { Origin: origin, 'Content-Type': 'application/json' } })]) {
    assert.equal((await handleCardAutomationRelay(request, config)).status, 403);
  }
  assert.equal((await handleCardAutomationRelay(signed({ action: 'status' }),
    { ...config, card_studio_owner_id: 'someone-else' })).status, 403);
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
