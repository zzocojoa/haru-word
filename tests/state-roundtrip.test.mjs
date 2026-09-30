import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { EMPTY, newSession, senseProgress, allSenses } from '../lib/learning.ts';
import { serializeBackup } from '../lib/backup-format.ts';

const dir = 'work/state-roundtrip-tests'; mkdirSync(dir, { recursive: true });
await build({ entryPoints: ['lib/backup-analysis.ts', 'lib/response-validation.ts', 'lib/learning-commands.ts', 'lib/word-editor-draft.ts', 'lib/restore-validation.ts', 'db/learning-state.ts', 'db/restore-jobs.ts'], outdir: dir, entryNames: '[name]', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
await build({ entryPoints: ['app/api/state/route.ts'], outfile: dir + '/route.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', plugins: [{ name: 'test-boundaries', setup(b) {
  b.onResolve({ filter: /^@\/(app\/chatgpt-auth|db\/store)$/ }, a => ({ path: a.path, namespace: 'test' }));
  b.onLoad({ filter: /.*/, namespace: 'test' }, a => ({ loader: 'js', contents: a.path.endsWith('chatgpt-auth') ? 'export const getChatGPTUser=async()=>({userId:"owner"})' : 'export const database=()=>globalThis.roundtripDb' }));
} }] });
const route = await import('../work/state-roundtrip-tests/route.mjs');
const { analyzeBackup } = await import('../work/state-roundtrip-tests/backup-analysis.mjs');
const { parseSnapshot } = await import('../work/state-roundtrip-tests/response-validation.mjs');
const { createWordEditorDraft, wordSenseDraft, editWordEditorDraft } = await import('../work/state-roundtrip-tests/word-editor-draft.mjs');
const { editedWordDraftsProgress } = await import('../work/state-roundtrip-tests/learning-commands.mjs');
const { parsePart } = await import('../work/state-roundtrip-tests/restore-validation.mjs');
const { restoreState } = await import('../work/state-roundtrip-tests/learning-state.mjs');
const jobs = await import('../work/state-roundtrip-tests/restore-jobs.mjs');
const words = JSON.parse(readFileSync('data/words.json')), content = JSON.parse(readFileSync('data/content.json'));
const sqlite = new DatabaseSync(':memory:');
for (const file of ['0000_worthless_doctor_faustus', '0001_ai_daily_usage', '0002_old_golden_guardian', '0003_bright_zarda']) sqlite.exec(readFileSync(`drizzle/${file}.sql`, 'utf8'));
let beforeBatch = null;
const db = { prepare(sql) { const statement = (args = []) => ({ sql, args, bind(...values) { return statement(values); }, async first() { return sqlite.prepare(sql).get(...args) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }); return statement(); }, async batch(statements) {
  if (beforeBatch) { const run = beforeBatch; beforeBatch = null; run(); }
  sqlite.exec('BEGIN');
  try { const results = statements.map(s => /^SELECT/.test(s.sql) ? { results: sqlite.prepare(s.sql).all(...s.args) } : { meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } }); sqlite.exec('COMMIT'); return results; }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
} };
globalThis.roundtripDb = db;
const headers = { 'Content-Type': 'application/json', 'X-Study-Sense-Keys': '1', 'X-Study-Grammar': '2', 'X-Study-Feedback-Structure': '1', 'X-Study-Review-Resume': '1', 'X-Study-Monthly-Carryover': '1' };
const put = data => route.PUT(new Request('https://study.example/api/state', { method: 'PUT', headers, body: JSON.stringify(data) }));
const get = async () => parseSnapshot(await (await route.GET(new Request('https://study.example/api/state', { headers }))).json());
const snapshot = () => ['learner_states', 'word_progress', 'study_sessions', 'grammar_progress'].map(table => sqlite.prepare(`SELECT * FROM ${table} ORDER BY user_id`).all());
const personal = i => { const id = `personal_00000000-0000-4000-8000-${String(i).padStart(12, '0')}`; return [id, { meaning: '검사', personal: { id, word: `sample${i}`, headword: `sample${i}`, pos: 'n.', level: 'A1', page: 0, personal: true } }]; };
function seedRows(table, rows, user = 'owner') { const insert = sqlite.prepare(`INSERT INTO ${table} VALUES (?,?,?)`); sqlite.exec('BEGIN'); for (const [key, value] of rows) insert.run(user, key, JSON.stringify(value)); sqlite.exec('COMMIT'); }
beforeEach(() => { beforeBatch = null; for (const table of ['restore_parts', 'restore_jobs', 'learner_states', 'word_progress', 'study_sessions', 'grammar_progress']) sqlite.exec(`DELETE FROM ${table}`); for (const user of ['owner', 'other']) sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user, JSON.stringify(EMPTY.settings), 'now'); });
after(() => { sqlite.close(); delete globalThis.roundtripDb; });
async function stage(state, revision = 0) {
  const analysis = await analyzeBackup(serializeBackup(state));
  let job = await jobs.createRestoreJob(db, 'owner', revision, analysis.manifest);
  for (let i = 0; i < analysis.parts.length; i++) await jobs.uploadRestorePart(db, 'owner', job.id, i, analysis.parts[i]);
  while (job.status !== 'ready') job = await jobs.validateRestoreJob(db, 'owner', job.id);
  return job;
}

test('literal reserved/inherited names survive editor → save → read → whole/part restore without prototype mutation', async () => {
  const id = words[0].id;
  for (const meaning of ['constructor', 'prototype', '__proto__', 'toString', 'hasOwnProperty']) {
    const before = await get();
    let draft = createWordEditorDraft('', wordSenseDraft());
    draft = editWordEditorDraft(draft, 'meaning', meaning);
    draft = editWordEditorDraft(draft, 'notes', '원래 메모');
    const progress = editedWordDraftsProgress(before.state.progress[id] ?? {}, draft, { familiarity: 'new', familiarityTouched: false, useful: false, encounters: [] });
    assert.equal((await put({ revision: before.revision, progress: { [id]: progress }, sessions: {} })).status, 200);
    const saved = await get(), stored = saved.state.progress[id];
    assert.ok(Object.hasOwn(stored.senses, meaning));
    assert.equal(senseProgress(stored, meaning).notes, '원래 메모');
    assert.ok(allSenses(stored).some(s => s.meaning === meaning));
    const backup = await analyzeBackup(serializeBackup(saved.state));
    assert.deepEqual(backup.parsed.state, saved.state);
    for (let i = 0; i < backup.parts.length; i++) assert.deepEqual(parsePart(backup.parts[i], backup.manifest.parts[i]), JSON.parse(backup.parts[i]));
    assert.equal(await restoreState(db, 'owner', saved.revision, backup.parsed.state), true);
    const beforeStaged = await get(), job = await stage(beforeStaged.state, beforeStaged.revision);
    await jobs.commitRestoreJob(db, 'owner', job.id);
    assert.deepEqual((await get()).state, saved.state);
    assert.equal({}.polluted, undefined); assert.equal(Object.getPrototypeOf(stored.senses), Object.prototype);
  }
  assert.deepEqual(senseProgress({ senses: {} }, 'constructor'), { meaning: 'constructor' });
});

test('reserved structural keys and nested prototype payloads are rejected consistently without writes', async () => {
  const before = snapshot(), id = words[0].id;
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    for (const target of ['root', 'progress', 'sense']) {
      const row = target === 'progress' ? { [key]: {} } : target === 'sense' ? { senses: { safe: { [key]: { polluted: true } } } } : {};
      const delta = { revision: 0, progress: { [id]: row }, sessions: {}, ...(target === 'root' ? { [key]: {} } : {}) };
      assert.equal((await put(delta)).status, 400);
      await assert.rejects(analyzeBackup(serializeBackup({ ...EMPTY, progress: { [id]: row }, ...(target === 'root' ? { [key]: {} } : {}) })));
      assert.throws(() => parsePart(JSON.stringify({ [id]: target === 'root' ? { [key]: {} } : row }), { kind: 'progress', count: 1 }));
    }
  }
  assert.deepEqual(snapshot(), before); assert.equal({}.polluted, undefined);
});

test('old clients cannot silently drop a literal prototype sense on reads, saves or staged replacement', async () => {
  const id = words[0].id, progress = { [id]: { meaning: '__proto__', senses: { ['__proto__']: { meaning: '__proto__', notes: 'preserve' } } } };
  let job = await stage({ ...EMPTY, progress });
  const empty = snapshot();
  await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id, 2, true, false), error => error.status === 426); assert.deepEqual(snapshot(), empty);
  await jobs.commitRestoreJob(db, 'owner', job.id);
  const before = snapshot();
  assert.equal((await route.GET(new Request('https://study.example/api/state'))).status, 426);
  const legacyHeaders = { ...headers }; delete legacyHeaders['X-Study-Sense-Keys'];
  assert.equal((await route.PUT(new Request('https://study.example/api/state', { method: 'PUT', headers: legacyHeaders, body: JSON.stringify({ revision: 1, progress: { [id]: { meaning: '__proto__', senses: {} } }, sessions: {} }) }))).status, 426);
  job = await stage(EMPTY, 1);
  await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id, 2, true, false), error => error.status === 426);
  assert.deepEqual(snapshot(), before);
  assert.equal((await get()).state.progress[id].senses.__proto__.notes, 'preserve');
});

test('account word count accepts 5000 and replacements, rejects 5001 before mutation, isolates other accounts', async () => {
  seedRows('word_progress', Array.from({ length: 4999 }, (_, i) => personal(i)));
  seedRows('word_progress', [personal(6000)], 'other');
  const [id, p] = personal(4999);
  assert.equal((await put({ revision: 0, progress: { [id]: p }, sessions: {} })).status, 200);
  assert.equal((await put({ revision: 1, progress: { [id]: { ...p, notes: 'updated' } }, sessions: {} })).status, 200);
  const before = snapshot(), [extra, value] = personal(5000);
  const rejected = await put({ revision: 2, progress: { [extra]: value }, sessions: {} });
  assert.equal(rejected.status, 413); assert.equal((await rejected.json()).code, 'state_progress_limit');
  assert.deepEqual(snapshot(), before);
  assert.equal(Object.keys((await analyzeBackup(serializeBackup((await get()).state))).parsed.state.progress).length, 5000);
});

test('account sessions accept 10000 and updates, reject 10001, and leave legacy excess readable/exportable', async () => {
  const sample = newSession(structuredClone(EMPTY), words, id => content[id], 'daily', '2026-09-30');
  const sessions = Array.from({ length: 9999 }, () => { const id = crypto.randomUUID(); return [id, { ...sample, id }]; });
  seedRows('study_sessions', sessions);
  const id = crypto.randomUUID(), s = { ...sample, id };
  assert.equal((await put({ revision: 0, progress: {}, sessions: { [id]: s } })).status, 200);
  assert.equal((await put({ revision: 1, progress: {}, sessions: { [id]: { ...s, paused: true } } })).status, 200);
  const before = snapshot(), extra = crypto.randomUUID();
  const rejected = await put({ revision: 2, progress: {}, sessions: { [extra]: { ...s, id: extra } } });
  assert.equal(rejected.status, 413); assert.equal((await rejected.json()).code, 'state_sessions_limit'); assert.deepEqual(snapshot(), before);
  // Historical unsupported accounts are not truncated or silently migrated.
  seedRows('study_sessions', [[extra, { ...s, id: extra }]]);
  const legacy = await get(); assert.equal(Object.keys(legacy.state.sessions).length, 10001);
  assert.equal(Object.keys(JSON.parse(serializeBackup(legacy.state)).state.sessions).length, 10001);
  const protectedData = snapshot(); assert.equal((await put({ revision: 2, progress: {}, sessions: {} })).status, 413); assert.deepEqual(snapshot(), protectedData);
});

test('capacity preflight does not weaken atomic revision protection against a concurrent writer', async () => {
  beforeBatch = () => sqlite.prepare('UPDATE learner_states SET revision=revision+1 WHERE user_id=?').run('owner');
  const response = await put({ revision: 0, progress: { [words[0].id]: { meaning: 'must not apply' } }, sessions: {} });
  assert.equal(response.status, 409); assert.equal((await get()).revision, 1);
  assert.equal(Object.keys((await get()).state.progress).length, 0);
});

test('exact 20 MB UTF-8 capacity includes settings, keys, commas, envelope and retained grammar in both restores', async () => {
  const state = { ...structuredClone(EMPTY), grammar: {}, progress: Object.fromEntries(words.slice(0, 3500).map(w => [w.id, { notes: '가'.repeat(700), expression: 'x'.repeat(2000), translation: 'x'.repeat(2000) }])) };
  let excess = Buffer.byteLength(serializeBackup(state)) - 20_000_000; assert.ok(excess > 0);
  for (const p of Object.values(state.progress)) {
    const remove = Math.min(excess, p.expression.length); p.expression = p.expression.slice(remove); excess -= remove;
    if (!excess) break;
  }
  assert.equal(excess, 0); assert.equal(Buffer.byteLength(serializeBackup(state)), 20_000_000);
  seedRows('word_progress', Object.entries(state.progress));
  const id = words[0].id, original = state.progress[id];
  assert.equal((await put({ revision: 0, progress: { [id]: original }, sessions: {} })).status, 200);
  const before = snapshot();
  const tooLarge = await put({ revision: 1, progress: { [id]: { ...original, expression: original.expression + '한' } }, sessions: {} });
  assert.equal(tooLarge.status, 413); assert.equal((await tooLarge.json()).code, 'state_backup_limit'); assert.deepEqual(snapshot(), before);
  assert.equal((await put({ revision: 1, settings: { ...state.settings, dailyGoal: 10 }, progress: {}, sessions: {} })).status, 413);
  assert.deepEqual((await analyzeBackup(serializeBackup((await get()).state))).parsed.state, state);
  const grammar = { stage: 0, answers: {}, sentence: 'Draft.', updatedAt: '2026-09-30T00:00:00.000Z' };
  seedRows('grammar_progress', [['noun', grammar]]);
  const oldBackup = { ...state }; delete oldBackup.grammar;
  const protectedData = snapshot();
  await assert.rejects(restoreState(db, 'owner', 1, oldBackup), error => error.code === 'state_backup_limit'); assert.deepEqual(snapshot(), protectedData);
  const job = await stage(oldBackup, 1);
  await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id), error => error.status === 413 && error.code === 'state_backup_limit'); assert.deepEqual(snapshot(), protectedData);
  // Explicitly replacing grammar with an empty object fits again; no data is
  // silently dropped when grammar is absent from a legacy file.
  assert.equal(await restoreState(db, 'owner', 1, state), true);
  assert.equal(Buffer.byteLength(serializeBackup((await get()).state)), 20_000_000);
});
