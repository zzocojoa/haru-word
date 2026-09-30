import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { EMPTY } from '../lib/learning.ts';

const dir = 'work/request-body-tests'; mkdirSync(dir, { recursive: true });
await build({ entryPoints: ['lib/server/request-body.ts'], outfile: dir + '/reader.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { readBoundedJsonText: read, FEEDBACK_BODY_LIMITS, logBodyRejection } = await import('../work/request-body-tests/reader.mjs');
const encoder = new TextEncoder(), encode = text => encoder.encode(text);
const headers = { 'content-type': 'application/json', 'X-Study-Sense-Keys': '1', 'X-Study-Grammar': '2', 'X-Study-Feedback-Structure': '1', 'X-Study-Revision': '0' };
function streamRequest(chunks, options = {}) {
  const stats = { reads: 0, cancelled: 0 };
  const body = new ReadableStream({
    pull(controller) { stats.reads++; if (chunks.length) controller.enqueue(chunks.shift()); else controller.close(); },
    cancel() { stats.cancelled++; return options.cancel?.(); },
  }, { highWaterMark: 0 });
  const request = new Request('https://study.example/api/test', { method: options.method ?? 'POST', headers: { ...headers, ...options.headers }, body, duplex: 'half', signal: options.signal });
  return { request, body, stats };
}
const bounded = (request, limits) => read(request, limits);

test('6 MB stream stops after its second 1 MB chunk, without decoding/reading the tail', async () => {
  const input = streamRequest(Array.from({ length: 6 }, () => new Uint8Array(1_000_000).fill(32)));
  const metrics = { bytes: 0 };
  await assert.rejects(read(input.request, { bytes: 1_800_000 }, metrics), e => e.status === 413 && e.code === 'body_too_large');
  assert.deepEqual(input.stats, { reads: 2, cancelled: 1 });
  assert.equal(metrics.bytes, 2_000_000); assert.equal(input.body.locked, false);
});

test('declared overflow rejects before reading, including rejected or unending cancel cleanup', async () => {
  for (const cancel of [() => Promise.reject(Error('SECRET cancel failure')), () => new Promise(() => {})]) {
    const input = streamRequest([encode('SECRET')], { headers: { 'content-length': '1000' }, cancel });
    await assert.rejects(bounded(input.request, { bytes: 10 }), e => e.status === 413 && e.bytes === 0);
    assert.deepEqual(input.stats, { reads: 0, cancelled: 1 }); assert.equal(input.body.locked, false);
  }
});

test('missing, understated and malformed lengths never bypass the actual byte count', async () => {
  for (const length of [undefined, '0', '2', '-5', 'unknown', '1e8']) {
    const input = streamRequest([encode('가'), encode('나'), encode('unread')], { headers: length === undefined ? {} : { 'content-length': length } });
    await assert.rejects(read(input.request, { bytes: 5 }), e => e.status === 413);
    assert.deepEqual(input.stats, { reads: 2, cancelled: 1 });
  }
});

test('exact UTF-8 boundary accepts every split through Korean and emoji, then +1 rejects', async () => {
  const text = '{"뜻":"한글😀"}', bytes = encode(text);
  for (let i = 1; i < bytes.length; i++) {
    const input = streamRequest([bytes.slice(0, i), bytes.slice(i)]);
    assert.equal(await read(input.request, { bytes: bytes.length }), text);
    assert.equal(input.stats.cancelled, 0); assert.equal(input.body.locked, false);
  }
  const input = streamRequest([bytes, encode(' '), encode('unread')]);
  await assert.rejects(read(input.request, { bytes: bytes.length }), e => e.status === 413);
  assert.equal(input.stats.reads, 2);
});

test('AI preserves 12,000 UTF-16 characters, rejecting character overflow before the tail', async () => {
  for (const text of ['a'.repeat(12000), '가'.repeat(12000), '😀'.repeat(6000)]) {
    assert.equal(await read(streamRequest([encode(text)]).request, FEEDBACK_BODY_LIMITS), text);
    const input = streamRequest([encode(text), encode('x'), encode('unread')]);
    await assert.rejects(read(input.request, FEEDBACK_BODY_LIMITS), e => e.status === 413);
    assert.deepEqual(input.stats, { reads: 2, cancelled: 1 });
  }
});

test('invalid UTF-8, incomplete encoding and failed streams reject without exposing source errors', async () => {
  for (const chunks of [[new Uint8Array([0xff]), encode('tail')], [new Uint8Array([0xe2, 0x82])]]) {
    const input = streamRequest(chunks);
    await assert.rejects(read(input.request, { bytes: 100 }), e => e.code === 'body_unreadable' && e.status === 400);
    assert.equal(input.body.locked, false);
  }
  const body = new ReadableStream({ pull(controller) { controller.error(Error('SECRET transport')); } });
  await assert.rejects(read(new Request('https://study.example', { method: 'POST', body, duplex: 'half' }), { bytes: 100 }), e => e.code === 'body_unreadable' && !e.message.includes('SECRET'));
  assert.equal(body.locked, false);
  await assert.rejects(read(new Request('https://study.example'), { bytes: 100 }), e => e.status === 400);
});

test('abort before/during a stalled read cancels once and releases the lock', async () => {
  const early = new AbortController(); early.abort();
  const input = streamRequest([encode('unread')], { signal: early.signal });
  await assert.rejects(read(input.request, { bytes: 100 }), e => e.code === 'body_aborted');
  assert.deepEqual(input.stats, { reads: 0, cancelled: 1 });
  const abort = new AbortController(); let cancelCount = 0;
  const body = new ReadableStream({ pull() { abort.abort(); }, cancel() { cancelCount++; return new Promise(() => {}); } }, { highWaterMark: 0 });
  const request = new Request('https://study.example', { method: 'POST', body, duplex: 'half', signal: abort.signal });
  await assert.rejects(read(request, { bytes: 100 }), e => e.status === 400 && e.code === 'body_aborted');
  assert.equal(body.locked, false); assert.equal(cancelCount, 1);
});

test('diagnostics include only fixed metadata, not the rejected text or transport error', async t => {
  const logs = []; t.mock.method(console, 'warn', text => logs.push(JSON.parse(text)));
  const input = streamRequest([encode('SECRET learner sentence and key')]);
  try { await read(input.request, { bytes: 2 }); } catch (error) { logBodyRejection(error, 'save'); }
  logBodyRejection(Error('SECRET'), 'save');
  assert.equal(logs.length, 1); assert.deepEqual(Object.keys(logs[0]).sort(), ['event', 'operation', 'code', 'status', 'bytes', 'limit'].sort());
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|learner|sentence/);
  try { await read(streamRequest([encode('a'.repeat(12001))]).request, FEEDBACK_BODY_LIMITS); }
  catch (error) { logBodyRejection(error, 'grammar_feedback'); }
  assert.equal(logs[1].characters, 12001); assert.equal(logs[1].characterLimit, 12000);
  assert.equal(logs[1].bytes, 12001); assert.equal(logs[1].limit, 36000);
});

// Real routes and SQLite; only auth, Cloudflare environment and DB binding are
// replaced. A fetch trap makes any accidental external AI call fail the test.
const sqlite = new DatabaseSync(':memory:');
for (const file of ['0000_worthless_doctor_faustus', '0001_ai_daily_usage', '0002_old_golden_guardian', '0003_bright_zarda']) sqlite.exec(readFileSync(`drizzle/${file}.sql`, 'utf8'));
const db = { prepare(sql) { const statement = (args = []) => ({ sql, args, bind(...values) { return statement(values); }, async first() { return sqlite.prepare(sql).get(...args) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }); return statement(); }, async batch(statements) {
  sqlite.exec('BEGIN');
  try { const results = statements.map(s => /^SELECT/.test(s.sql) ? { results: sqlite.prepare(s.sql).all(...s.args) } : { meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } }); sqlite.exec('COMMIT'); return results; }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
} };
globalThis.bodyRuntime = { db, user: { userId: 'owner' }, env: { large_backup_restore_enabled: 'true', grammar_enabled: 'true', google_ai_enabled: 'true' } };
const routes = [];
for (const [name, path, method, limit] of [
  ['save', 'state', 'PUT', 1_800_000], ['restore', 'state/restore', 'POST', 8_000_000],
  ['manifest', 'state/restore/jobs', 'POST', 100_000], ['part', 'state/restore/jobs/[id]/chunks/[index]', 'PUT', 1_800_000],
  ['sentence', 'sentence-feedback', 'POST', 36_000], ['grammar', 'grammar-feedback', 'POST', 36_000],
]) {
  await build({ entryPoints: [`app/api/${path}/route.ts`], outfile: `${dir}/${name}.mjs`, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', plugins: [{ name: 'test-boundaries', setup(b) {
    b.onResolve({ filter: /^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/store)$/ }, a => ({ path: a.path, namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, a => ({ loader: 'js', contents: a.path === 'cloudflare:workers' ? 'export const env=globalThis.bodyRuntime.env' : a.path.endsWith('chatgpt-auth') ? 'export const getChatGPTUser=async()=>globalThis.bodyRuntime.user' : 'export const database=()=>globalThis.bodyRuntime.db' }));
  } }] });
  const route = await import(`../${dir}/${name}.mjs`);
  routes.push({ name, method, limit, call: request => route[method](request, { params: Promise.resolve({ id: crypto.randomUUID(), index: '0' }) }) });
}
const tables = ['learner_states', 'word_progress', 'study_sessions', 'grammar_progress', 'ai_daily_usage', 'restore_jobs', 'restore_parts'];
const snapshot = () => tables.map(table => sqlite.prepare(`SELECT * FROM ${table}`).all());
beforeEach(() => {
  bodyRuntime.user = { userId: 'owner' };
  for (const table of [...tables].reverse()) sqlite.exec(`DELETE FROM ${table}`);
  sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run('owner', JSON.stringify(EMPTY.settings), 'now');
});
after(() => { sqlite.close(); delete globalThis.bodyRuntime; });

test('all six routes reject streamed overflow early, preserving records, revision, jobs and AI usage', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', () => { calls++; throw Error('AI must not run'); });
  t.mock.method(console, 'warn', () => {});
  for (const route of routes) {
    const prefix = route.limit === 36_000 ? encode('가'.repeat(12_000)) : new Uint8Array(route.limit).fill(32);
    const before = snapshot(), input = streamRequest([prefix, encode(' '), encode('UNREAD')], { method: route.method });
    const response = await route.call(input.request);
    assert.equal(response.status, 413, route.name); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(input.stats, { reads: 2, cancelled: 1 }, route.name); assert.equal(input.body.locked, false);
    assert.deepEqual(snapshot(), before, route.name);
  }
  assert.equal(calls, 0);
});

test('authentication, origin and type rejection precede reading on all routes', async () => {
  for (const route of routes) for (const [status, extra, user] of [[401, {}, null], [403, { origin: 'https://other.example' }, { userId: 'owner' }], [415, { 'content-type': 'text/plain' }, { userId: 'owner' }]]) {
    bodyRuntime.user = user;
    const input = streamRequest([encode('UNREAD')], { method: route.method, headers: extra });
    assert.equal((await route.call(input.request)).status, status, route.name); assert.equal(input.stats.reads, 0);
    await input.body.cancel();
  }
});

test('all routes map malformed/truncated UTF-8 to 400 without mutations', async t => {
  t.mock.method(console, 'warn', () => {});
  for (const route of routes) {
    const before = snapshot(), input = streamRequest([new Uint8Array([0xff]), encode('UNREAD')], { method: route.method });
    assert.equal((await route.call(input.request)).status, 400, route.name);
    assert.deepEqual(snapshot(), before); assert.equal(input.stats.cancelled, 1);
  }
});

test('exact byte-limit valid save and whole restore retain their existing success contracts', async t => {
  t.mock.method(console, 'info', () => {});
  for (const [route, value] of [[routes[0], { revision: 0, progress: {}, sessions: {}, settings: { ...EMPTY.settings, dailyGoal: 4 } }],
    [routes[1], { format: 'haru-words-v1', exportedAt: '2026-09-30T00:00:00.000Z', state: EMPTY }]]) {
    const raw = JSON.stringify(value), body = raw + ' '.repeat(route.limit - encode(raw).byteLength);
    const response = await route.call(new Request('https://study.example/api/test', { method: route.method, headers: { ...headers, 'X-Study-Revision': route.name === 'save' ? '0' : '1' }, body }));
    assert.equal(response.status, 200, route.name);
    assert.deepEqual(await response.json(), { revision: route.name === 'save' ? 1 : 2 });
  }
});
