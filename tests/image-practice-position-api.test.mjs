import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
await build({ entryPoints: ['app/api/image-practice/position/route.ts'], outfile: 'work/image-position-api/route.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'boundaries', setup(b) {
    b.onResolve({ filter: /^@\/(app\/chatgpt-auth|db\/store)$/ }, a => ({ path: a.path, namespace: 'boundary' }));
    b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({ loader: 'js', contents: a.path.endsWith('chatgpt-auth')
      ? 'export const getChatGPTUser=async()=>globalThis.imagePositionApi.user' : 'export const database=()=>globalThis.imagePositionApi.db' }));
  } }],
});
const sql = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync('drizzle/' + file, 'utf8'));
let fail = false, reads = 0, writes = 0;
const db = { prepare(statement) { return { bind(...args) { return { async first() {
  if (fail) throw new Error('private injected failure');
  if (/^SELECT/.test(statement)) reads++; else writes++;
  return sql.prepare(statement).get(...args) ?? null;
} }; } }; } };
globalThis.imagePositionApi = { db, user: { userId: 'synthetic-a' } };
const route = await import('../work/image-position-api/route.mjs');
const ids = JSON.parse(readFileSync('data/word-image-ui.json')).entries.map(row => row[0]);
const req = (body, headers = {}, method = 'PUT') => new Request('http://localhost/api/image-practice/position', { method,
  headers: { 'content-type': 'application/json', origin: 'http://localhost', ...headers }, ...(method === 'PUT' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
const get = headers => route.GET(req(null, headers, 'GET'));
const dump = () => ['learner_states', 'study_sessions', 'word_progress', 'grammar_progress', 'ai_daily_usage', 'restore_jobs', 'restore_parts']
  .map(table => sql.prepare(`SELECT * FROM ${table}`).all());
beforeEach(() => {
  fail = false; reads = 0; writes = 0; imagePositionApi.user = { userId: 'synthetic-a' };
  sql.exec('DELETE FROM image_practice_positions; DELETE FROM learner_states; DELETE FROM word_progress;');
  sql.prepare('INSERT INTO learner_states VALUES (?,?,?,?)').run('synthetic-existing', 42, '{"goal":3}', 'initial');
  sql.prepare('INSERT INTO word_progress VALUES (?,?,?)').run('synthetic-existing', ids[0], '{"meaning":"synthetic"}');
});
after(() => { sql.close(); delete globalThis.imagePositionApi; });

test('empty-account GET is read-only and no-store, even without a learner row', async () => {
  const before = dump(), response = await get();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { entryId: null, revision: 0, updatedAt: null });
  assert.equal(reads, 1); assert.equal(writes, 0); assert.deepEqual(dump(), before);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM image_practice_positions').get().n, 0);
});
test('auth and changed owner fail before DB; origin, content type, body bounds and IDs fail before mutation', async () => {
  const before = dump(), data = { entryId: ids[0], revision: 0 };
  imagePositionApi.user = null;
  assert.equal((await get()).status, 401); assert.equal((await route.PUT(req(data))).status, 401);
  imagePositionApi.user = { userId: 'synthetic-a' };
  assert.equal((await get({ 'x-image-practice-owner': 'synthetic-b' })).status, 401);
  assert.equal((await route.PUT(req(data, { 'x-image-practice-owner': 'synthetic-b' }))).status, 401);
  assert.equal(reads, 0); assert.equal(writes, 0);
  for (const [body, headers, status] of [
    [data, { origin: 'https://other.example' }, 403], [data, { 'sec-fetch-site': 'cross-site' }, 403], [data, { 'content-type': 'text/plain' }, 415],
    ['bad', {}, 400], [[], {}, 400], [null, {}, 400], [{ ...data, userId: 'synthetic-b' }, {}, 400],
    [{ ...data, entryId: 'f'.repeat(16) }, {}, 400], [{ ...data, entryId: 2 }, {}, 400], [{ ...data, revision: -1 }, {}, 400],
    [{ ...data, revision: 1.5 }, {}, 400], [{ ...data, revision: Number.MAX_SAFE_INTEGER }, {}, 400],
    [' '.repeat(1025), {}, 413], [data, { 'content-length': '1025' }, 413], ['한'.repeat(342), { 'content-length': '1' }, 413],
  ]) assert.equal((await route.PUT(req(body, headers))).status, status);
  assert.equal(writes, 0); assert.deepEqual(dump(), before);
});
test('stream body cancels at limit before EOF and never touches DB', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1025)); }, cancel() { cancelled = true; } });
  const request = new Request('http://localhost/api/image-practice/position', { method: 'PUT', headers: { 'content-type': 'application/json' }, body, duplex: 'half' });
  assert.equal((await route.PUT(request)).status, 413); assert.equal(cancelled, true); assert.equal(writes, 0);
});
test('atomic first-write race and update race admit exactly one writer with independent revision', async () => {
  const before = dump();
  const responses = await Promise.all([0, 1].map(i => route.PUT(req({ entryId: ids[i], revision: 0 }))));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const first = await (await get()).json(); assert.equal(first.revision, 1);
  assert.ok(first.updatedAt); assert.equal(first.entryId, ids[0]);
  const updates = await Promise.all([2, 3].map(i => route.PUT(req({ entryId: ids[i], revision: 1 }))));
  assert.deepEqual(updates.map(r => r.status).sort(), [200, 409]);
  assert.equal((await (await get()).json()).revision, 2); assert.deepEqual(dump(), before);
});
test('separate users cannot read or alter each other; lost-response replay and stale writes change nothing', async () => {
  await route.PUT(req({ entryId: ids[1], revision: 0 }));
  const original = await (await get()).json();
  imagePositionApi.user = { userId: 'synthetic-b' };
  assert.equal((await (await get()).json()).entryId, null);
  assert.equal((await route.PUT(req({ entryId: ids[2], revision: 1 }))).status, 409);
  assert.equal((await route.PUT(req({ entryId: ids[2], revision: 0 }))).status, 200);
  imagePositionApi.user = { userId: 'synthetic-a' };
  assert.equal((await route.PUT(req({ entryId: ids[1], revision: 0 }))).status, 409);
  assert.deepEqual(await (await get()).json(), original);
});
test('DB errors return safe 503 without exposing content and retry after read succeeds', async () => {
  const before = dump(); fail = true;
  for (const response of [await get(), await route.PUT(req({ entryId: ids[0], revision: 0 }))]) {
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private|synthetic/);
  }
  assert.deepEqual(dump(), before); fail = false;
  assert.equal((await (await get()).json()).revision, 0);
  assert.equal((await route.PUT(req({ entryId: ids[0], revision: 0 }))).status, 200);
});
