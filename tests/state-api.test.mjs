import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { EMPTY, newSession, today } from '../lib/learning.ts';

mkdirSync('work/state-api-tests', { recursive: true });
await build({
  entryPoints: ['app/api/state/route.ts'], outfile: 'work/state-api-tests/route.mjs',
  bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'boundaries', setup(b) {
    b.onResolve({ filter: /^@\/(app\/chatgpt-auth|db\/store)$/ }, a => ({ path: a.path, namespace: 'boundary' }));
    b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({ loader: 'js', contents: a.path.endsWith('chatgpt-auth')
      ? 'export const getChatGPTUser=async()=>globalThis.stateApiRuntime.user'
      : 'export const database=()=>globalThis.stateApiRuntime.db' }));
  } }],
});
const sqlite = new DatabaseSync(':memory:');
for (const file of ['drizzle/0000_worthless_doctor_faustus.sql', 'drizzle/0001_ai_daily_usage.sql']) sqlite.exec(readFileSync(file, 'utf8'));
let failureAt = -1, batches = 0;
const db = {
  prepare(sql) { return { bind(...args) { return {
    sql, args,
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
  }; } }; },
  async batch(statements) {
    batches++;
    sqlite.exec('BEGIN');
    try {
      const results = statements.map((s, i) => {
        if (i === failureAt) throw Error('private injected failure');
        const stmt = sqlite.prepare(s.sql);
        return /^SELECT/.test(s.sql) ? { results: stmt.all(...s.args) }
          : { meta: { changes: Number(stmt.run(...s.args).changes) } };
      });
      sqlite.exec('COMMIT');
      return results;
    } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
globalThis.stateApiRuntime = { user: { userId: 'owner' }, db };
const route = await import('../work/state-api-tests/route.mjs');
const words = JSON.parse(readFileSync('data/words.json', 'utf8'));
const contents = JSON.parse(readFileSync('data/content.json', 'utf8'));
const session = (date = today()) => newSession(structuredClone(EMPTY), words, id => contents[id], 'daily', date);
const req = (data, headers = {}) => new Request('https://study.example/api/state', {
  method: 'PUT', headers: { origin: 'https://study.example', 'content-type': 'application/json', ...headers },
  body: typeof data === 'string' ? data : JSON.stringify(data),
});
const delta = s => ({ revision: 0, settings: { ...EMPTY.settings, activeSessionId: s.id }, progress: { [s.ids[0]]: { meaning: '학습 뜻' } }, sessions: { [s.id]: s } });
const dump = () => ['learner_states', 'word_progress', 'study_sessions', 'ai_daily_usage']
  .map(table => sqlite.prepare(`SELECT * FROM ${table} ORDER BY user_id`).all());
beforeEach(() => {
  failureAt = -1; batches = 0; stateApiRuntime.user = { userId: 'owner' };
  for (const table of ['learner_states', 'word_progress', 'study_sessions', 'ai_daily_usage']) sqlite.exec(`DELETE FROM ${table}`);
  for (const user of ['owner', 'other']) sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user, JSON.stringify(EMPTY.settings), 'initial');
});
after(() => { sqlite.close(); delete globalThis.stateApiRuntime; });

test('load initializes a new profile and returns only its owned records with no-store', async () => {
  const s = session();
  assert.equal((await route.PUT(req(delta(s)))).status, 200);
  stateApiRuntime.user = { userId: 'new-account' };
  const response = await route.GET();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { revision: 0, state: EMPTY });
  stateApiRuntime.user = { userId: 'owner' };
  assert.deepEqual((await (await route.GET()).json()).state.sessions[s.id], JSON.parse(JSON.stringify(s)));
});

test('auth, origin, media type, JSON and UTF-8 size fail before any database mutation', async () => {
  const before = dump(), payload = { revision: 0, progress: {}, sessions: {} };
  stateApiRuntime.user = null;
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.PUT(req(payload, { origin: 'https://other.example' }))).status, 401);
  stateApiRuntime.user = { userId: 'owner' };
  for (const [body, headers, status] of [
    [payload, { origin: 'https://other.example' }, 403],
    [payload, { 'sec-fetch-site': 'cross-site' }, 403],
    [payload, { 'content-type': 'text/plain' }, 415],
    ['invalid', {}, 400], [{ ...payload, unexpected: true }, {}, 400],
    [JSON.stringify({ text: '한'.repeat(600000) }), {}, 413],
  ]) assert.equal((await route.PUT(req(body, headers))).status, status);
  assert.deepEqual(dump(), before); assert.equal(batches, 0);
});

test('save commits every delta in one batch, preserves other accounts and increments once', async () => {
  const otherBefore = dump().map(rows => rows.filter(r => r.user_id === 'other'));
  const data = delta(session());
  const response = await route.PUT(req(data));
  assert.deepEqual(await response.json(), { revision: 1 }); assert.equal(batches, 1);
  const snapshot = await (await route.GET()).json();
  assert.deepEqual(snapshot.state, JSON.parse(JSON.stringify({ settings: data.settings, progress: data.progress, sessions: data.sessions })));
  assert.deepEqual(dump().map(rows => rows.filter(r => r.user_id === 'other')), otherBefore);
  assert.equal((await route.PUT(req({ revision: 1, progress: {}, sessions: {} }))).status, 200);
  const emptyDelta = await (await route.GET()).json();
  assert.equal(emptyDelta.revision, 2); assert.deepEqual(emptyDelta.state, snapshot.state);
});

test('stale revision and a replay after a lost response change no data', async () => {
  const data = delta(session());
  assert.equal((await route.PUT(req(data))).status, 200);
  const before = dump();
  const response = await route.PUT(req({ ...data, progress: { [Object.keys(data.progress)[0]]: { notes: 'must not apply' } } }));
  assert.equal(response.status, 409); assert.equal((await response.json()).conflict, true);
  assert.deepEqual(dump(), before);
});

test('a failure after progress or session writes rolls back the whole batch and retry succeeds', async () => {
  const data = delta(session()), before = dump();
  for (failureAt of [1, 2]) {
    const response = await route.PUT(req(data));
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private injected/);
    assert.deepEqual(dump(), before);
  }
  failureAt = -1;
  assert.equal((await route.PUT(req(data))).status, 200);
  assert.equal((await (await route.GET()).json()).revision, 1);
});

test('new historical daily sessions are rejected, existing owned sessions can be continued', async () => {
  const data = delta(session('2020-01-01')), clock = { 'x-study-server-clock': '1' }, before = dump();
  assert.equal((await route.PUT(req(data, clock))).status, 409); assert.deepEqual(dump(), before);
  // A session belonging to another account must not bypass the day guard.
  sqlite.prepare('INSERT INTO study_sessions VALUES (?,?,?)').run('other', Object.keys(data.sessions)[0], JSON.stringify(Object.values(data.sessions)[0]));
  assert.equal((await route.PUT(req(data, clock))).status, 409);
  assert.equal((await route.PUT(req(data))).status, 200); // Older clients retain their existing contract.
  assert.equal((await route.PUT(req({ ...data, revision: 1 }, clock))).status, 200);
});

test('review-resume compatibility marker remains required before writing expanded reviews', async () => {
  const s = { ...session(), kind: 'weekly', reviewEnd: 1 }, data = delta(s), before = dump();
  const response = await route.PUT(req(data));
  assert.equal(response.status, 426); assert.deepEqual(dump(), before);
  assert.equal((await route.PUT(req(data, { 'x-study-review-resume': '1' }))).status, 200);
});
