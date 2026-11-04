import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { history, emptyState } from './fixtures/backup-history.cjs';
import { feedback as legacy } from './fixtures/sentence-structure.cjs';

const out = 'work/openai-route-tests'; mkdirSync(out, { recursive: true });
const built = await build({ entryPoints: { word: 'app/api/sentence-feedback/route.ts', grammar: 'app/api/grammar-feedback/route.ts', evaluation: 'app/api/english-accuracy-evaluation/route.ts' }, outdir: out, outExtension: { '.js': '.mjs' }, bundle: true, splitting: true, format: 'esm', platform: 'node', metafile: true, logLevel: 'silent', plugins: [{ name: 'synthetic-boundaries', setup(b) {
  b.onResolve({ filter: /^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/store)$/ }, a => ({ path: a.path, namespace: 'boundary' }));
  b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({ loader: 'js', contents: a.path === 'cloudflare:workers'
    ? 'export const env=globalThis.openAiRouteRuntime.env' : a.path.endsWith('chatgpt-auth')
      ? 'export const getChatGPTUser=async()=>globalThis.openAiRouteRuntime.user' : 'export const database=()=>globalThis.openAiRouteRuntime.db' }));
} }] });
await build({ entryPoints: ['lib/gemini-feedback.ts', 'lib/groq-feedback.ts', 'lib/feedback-fallback.ts', 'lib/grammar/feedback.ts', 'lib/grammar/content.ts'], outdir: `${out}/legacy`, entryNames: '[name]', outExtension: { '.js': '.mjs' }, bundle: true, splitting: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const sqlite = new DatabaseSync(':memory:');
for (const file of ['0000_worthless_doctor_faustus', '0001_ai_daily_usage', '0003_bright_zarda']) sqlite.exec(readFileSync(`drizzle/${file}.sql`, 'utf8'));
let afterRead;
const db = {
  prepare(sql) { return { bind(...args) { return { sql, args,
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  }; } }; },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try { const rows = statements.map(s => ({ results: sqlite.prepare(s.sql).all(...s.args) })); sqlite.exec('COMMIT'); afterRead?.(); return rows; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
globalThis.openAiRouteRuntime = { env: {}, user: { userId: 'owner' }, db, calls: [], logs: [], respond: undefined };
const word = await import(`../${out}/word.mjs`), grammar = await import(`../${out}/grammar.mjs`), evaluation = await import(`../${out}/evaluation.mjs`);
const gemini = await import(`../${out}/legacy/gemini-feedback.mjs`), groq = await import(`../${out}/legacy/groq-feedback.mjs`), fallback = await import(`../${out}/legacy/feedback-fallback.mjs`), grammarHelper = await import(`../${out}/legacy/feedback.mjs`);
const { LESSON_MAP } = await import(`../${out}/legacy/content.mjs`);
const model = 'gpt-6.1-sol', headers = { origin: 'https://study.example', 'Content-Type': 'application/json', 'X-Study-AI-Contract': '2', 'X-Study-Feedback-Structure': '1', 'X-Study-Grammar': '4' };
const { original: _original, model: _model, createdAt: _date, ...wire } = legacy; void _original; void _model; void _date;
let session;
const envelope = (body, content = wire) => ({ status: 'completed', model: body.model,
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(content) }] }] });
const req = (kind, patch = {}, changes = {}) => new Request(`https://study.example/api/${kind === 'word' ? 'sentence' : 'grammar'}-feedback`, { method: 'POST', headers: { ...headers, ...changes }, body: JSON.stringify(kind === 'word' ? { sessionId: session.id, entryId: session.ids[0], sentence: legacy.original, expectedModelId: model, ...patch } : { lessonId: 'noun', sentence: legacy.original, expectedModelId: model, ...patch }) });
const route = kind => kind === 'word' ? word : grammar;
const attempts = () => sqlite.prepare('SELECT COALESCE(SUM(request_count),0) n FROM ai_daily_usage').get().n;
const historyDump = () => JSON.stringify(['learner_states', 'word_progress', 'study_sessions', 'grammar_progress'].map(t => sqlite.prepare(`SELECT * FROM ${t} ORDER BY user_id`).all()));
function setModel(value) { const settings = emptyState().settings; if (value !== undefined) settings.aiModelId = value; sqlite.prepare('UPDATE learner_states SET settings=? WHERE user_id=?').run(JSON.stringify(settings), 'owner'); }
function grammarVersion(version) {
  const answer = { first: 'first', latest: 'latest', helped: true, attempts: 2 };
  const progress = { stage: 5, answers: { q1: answer, q2: answer, q3: answer }, sentence: legacy.original, updatedAt: legacy.createdAt,
    ...(version === 1 ? {} : { contentVersion: version, questionIds: [1, 2, 3].map(i => `noun:${version}:base:q${i}`), observation: answer }) };
  sqlite.prepare('INSERT OR REPLACE INTO grammar_progress VALUES (?,?,?)').run('owner', 'noun', JSON.stringify(progress));
}
beforeEach(t => {
  for (const table of ['learner_states', 'study_sessions', 'word_progress', 'grammar_progress', 'ai_daily_usage']) sqlite.exec(`DELETE FROM ${table}`);
  for (const user of ['owner', 'other']) sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user, JSON.stringify(emptyState().settings), 'initial');
  session = Object.values(history(1, 1).sessions)[0]; session.stage = 'sentence'; session.finished = false;
  session.records[session.ids[0]].meaning = '서버에 저장한 목표 뜻';
  sqlite.prepare('INSERT INTO study_sessions VALUES (?,?,?)').run('owner', session.id, JSON.stringify(session)); grammarVersion(1);
  afterRead = undefined;
  Object.assign(openAiRouteRuntime, { user: { userId: 'owner' }, calls: [], logs: [], respond: undefined });
  Object.assign(openAiRouteRuntime.env, { OPENAI_API_KEY: 'SYNTHETIC_NOT_REAL', OPENAI_ALLOWED_MODELS: 'gpt-6.1-sol,gpt-6.1-terra,gpt-6-astra', ai_feedback_enabled: 'true', grammar_enabled: 'true', google_api: 'SYNTHETIC_OLD', groq_api: 'SYNTHETIC_OLD', google_ai_enabled: 'true', groq_ai_enabled: 'true', feedback_original_sentence_enabled: 'true', feedback_chunked_enabled: 'true', english_accuracy_token: 'a'.repeat(64), english_accuracy_expires: new Date(Date.now() + 3600000).toISOString() });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body); openAiRouteRuntime.calls.push({ url, body });
    return openAiRouteRuntime.respond ? openAiRouteRuntime.respond(body) : Response.json(envelope(body));
  });
  for (const method of ['info', 'warn', 'error']) t.mock.method(console, method, line => openAiRouteRuntime.logs.push(line));
});
after(() => { sqlite.close(); delete globalThis.openAiRouteRuntime; });

test('word request freezes account model and server-owned target while legacy flags cannot change the prompt', async () => {
  const before = historyDump(), response = await word.POST(req('word'));
  assert.equal(response.status, 200); const { feedback } = await response.json();
  assert.equal(feedback.provider, 'openai'); assert.equal(feedback.requestedModel, model); assert.equal(attempts(), 1);
  assert.equal(openAiRouteRuntime.calls.length, 1); const body = openAiRouteRuntime.calls[0].body, input = JSON.parse(body.input[0].content);
  assert.equal(input.meaning, '서버에 저장한 목표 뜻'); assert.equal(input.sentence, legacy.original);
  assert.ok(body.instructions.includes('Evaluate only the supplied English sentence'));
  assert.equal(body.instructions.includes('wordCounts'), false); assert.equal(historyDump(), before);
  const safe = openAiRouteRuntime.logs.join('\n'); for (const value of [legacy.original, input.meaning, 'SYNTHETIC']) assert.equal(safe.includes(value), false);
});

test('all supported grammar versions use saved targets, exact model and preserve first answers and progress', async () => {
  for (const version of [1, 2, 3, 4]) {
    grammarVersion(version); const before = historyDump();
    const response = await grammar.POST(req('grammar')); assert.equal(response.status, 200, `v${version}`);
    const { feedback } = await response.json(); assert.equal(feedback.provider, 'openai');
    const input = JSON.parse(openAiRouteRuntime.calls.at(-1).body.input[0].content);
    assert.ok(input.target); assert.ok(input.role); assert.ok(input.pattern); assert.equal(input.sentence, legacy.original);
    assert.equal(historyDump(), before);
  }
  assert.equal(openAiRouteRuntime.calls.length, 4); assert.equal(attempts(), 4);
});

test('expected-model mismatch and inactive selection fail before any usage write or provider call', async () => {
  for (const kind of ['word', 'grammar']) {
    setModel('gpt-6-astra'); assert.equal((await route(kind).POST(req(kind))).status, 409);
    setModel('retired-model'); assert.equal((await route(kind).POST(req(kind, { expectedModelId: 'retired-model' }))).status, 503);
  }
  assert.equal(openAiRouteRuntime.calls.length, 0); assert.equal(attempts(), 0);
});

test('a concurrent model change after the atomic read never changes an already-started request', async () => {
  afterRead = () => { afterRead = undefined; setModel('gpt-6-astra'); };
  assert.equal((await word.POST(req('word'))).status, 200);
  assert.equal(openAiRouteRuntime.calls[0].body.model, model);
  assert.equal((await word.POST(req('word'))).status, 409);
  assert.equal(openAiRouteRuntime.calls.length, 1); assert.equal(attempts(), 1);
});

test('old capability, unowned records, authentication and origin stop requests without egress', async () => {
  const before = historyDump();
  for (const kind of ['word', 'grammar']) {
    assert.equal((await route(kind).POST(req(kind, {}, { 'X-Study-AI-Contract': '' }))).status, 426);
    assert.equal((await route(kind).POST(req(kind, {}, { origin: 'https://evil.example' }))).status, 403);
    openAiRouteRuntime.user = { userId: 'other' };
    assert.equal((await route(kind).POST(req(kind))).status, 404);
    openAiRouteRuntime.user = null; assert.equal((await route(kind).POST(req(kind))).status, 401);
    openAiRouteRuntime.user = { userId: 'owner' };
  }
  assert.equal(openAiRouteRuntime.calls.length, 0); assert.equal(attempts(), 0); assert.equal(historyDump(), before);
});

test('new master switch, key, and model availability are independent of restored Google/Groq keys', async () => {
  for (const kind of ['word', 'grammar']) {
    openAiRouteRuntime.env.ai_feedback_enabled = 'false'; assert.equal((await route(kind).POST(req(kind))).status, 503);
    openAiRouteRuntime.env.ai_feedback_enabled = 'true'; openAiRouteRuntime.env.OPENAI_API_KEY = '';
    const response = await route(kind).POST(req(kind)); assert.equal((await response.json()).code, 'not_configured');
    openAiRouteRuntime.env.OPENAI_API_KEY = 'SYNTHETIC_NOT_REAL';
    openAiRouteRuntime.env.OPENAI_ALLOWED_MODELS = ''; assert.equal((await route(kind).POST(req(kind))).status, 503);
    openAiRouteRuntime.env.OPENAI_ALLOWED_MODELS = model;
  }
  assert.equal(openAiRouteRuntime.calls.length, 0); assert.equal(attempts(), 0);
});

test('provider failures and genuine uncertainty never trigger fallback or additional requests', async () => {
  for (const kind of ['word', 'grammar']) {
    openAiRouteRuntime.respond = () => Response.json({ error: { code: 'rate_limit_exceeded', message: 'PRIVATE' } }, { status: 429 });
    const response = await route(kind).POST(req(kind)); assert.equal(response.status, 429); assert.equal((await response.json()).code, 'provider_limit');
    openAiRouteRuntime.respond = body => Response.json(envelope(body, { meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', explanation: '판단할 정보가 부족해요.', structure: { status: 'unavailable', translation: '', parts: [], note: '원문을 확인해 주세요.' } }));
    assert.equal((await route(kind).POST(req(kind))).status, 200);
  }
  assert.equal(openAiRouteRuntime.calls.length, 4); assert.equal(attempts(), 4);
});

test('model catalog is account-specific, read-only and does not generate or persist a default', async () => {
  const before = historyDump();
  let response = await word.GET(new Request('https://study.example/api/sentence-feedback', { headers }));
  assert.equal(response.status, 200); let data = await response.json();
  assert.equal(data.model, model); assert.equal(data.models.length, 3); assert.equal(data.available, true);
  assert.equal(historyDump(), before); assert.equal(openAiRouteRuntime.calls.length, 0);
  setModel('gpt-6-astra'); response = await word.GET(new Request('https://study.example/api/sentence-feedback', { headers })); data = await response.json(); assert.equal(data.model, 'gpt-6-astra');
  openAiRouteRuntime.user = { userId: 'other' }; data = await (await word.GET(new Request('https://study.example/api/sentence-feedback', { headers }))).json(); assert.equal(data.model, model);
  assert.equal((await word.GET()).status, 426);
});

test('legacy generators and grammar string signature reject restored credentials with zero fetches', async () => {
  const config = { google_api: 'old', groq_api: 'old', groq_ai_enabled: 'true', feedback_original_sentence_enabled: 'true', feedback_chunked_enabled: 'true' };
  for (const invoke of [
    () => gemini.generateTutorFeedback('old', { sentence: legacy.original }, 'instruction'),
    () => gemini.generateSentenceFeedback('old', { sentence: legacy.original, word: 'trip', pos: 'n.', meaning: '여행' }),
    () => groq.generateGroqFeedback('old', { sentence: legacy.original }, 'instruction'),
    () => fallback.generateFeedbackWithFallback(config, { sentence: legacy.original }, 'instruction'),
    () => fallback.generateSentenceFeedbackWithFallback(config, { sentence: legacy.original }),
    () => grammarHelper.generateGrammarFeedback('old', LESSON_MAP.get('noun'), legacy.original),
    () => grammarHelper.generateGrammarFeedback(config, LESSON_MAP.get('noun'), legacy.original),
  ]) await assert.rejects(invoke(), e => e.code === 'disabled');
  assert.equal(openAiRouteRuntime.calls.length, 0);
});

test('legacy evaluation API cannot revive with any token, expiry, key or profile', async () => {
  for (const profile of [undefined, 'original-sentence', 'free-tier-comparison']) {
    openAiRouteRuntime.env.english_accuracy_profile = profile;
    const response = await evaluation.POST(new Request('https://study.example/api/english-accuracy-evaluation', { method: 'POST', headers: { ...headers, 'x-english-accuracy-token': 'a'.repeat(64) }, body: JSON.stringify({ provider: 'google', caseId: 'synthetic', round: 1 }) }));
    assert.equal(response.status, 410); assert.deepEqual(await response.json(), { code: 'legacy_evaluation_disabled' });
  }
  assert.equal(openAiRouteRuntime.calls.length, 0); assert.equal(attempts(), 0);
});

test('legacy CLI live entry points terminate before reading credentials or sending network requests', () => {
  writeFileSync(`${out}/no-egress.mjs`, `let calls=0;globalThis.fetch=()=>{calls++;throw Error('Forbidden network')};process.on('exit',()=>process.stdout.write('OFFLINE_FETCH_COUNT='+calls));`);
  for (const script of ['evaluate-english-accuracy', 'evaluate-original-feedback', 'evaluate-free-feedback']) {
    const result = spawnSync(process.execPath, ['--import', `./${out}/no-egress.mjs`, `scripts/${script}.mjs`, '--live', '--round', '1', '--approved-additional-calls', '120', '--confirmed-free-tier', '--approved-calls', '120'], { input: '{}\n', encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1, script); assert.equal(result.signal, null); assert.match(result.stdout, /OFFLINE_FETCH_COUNT=0/); assert.equal(result.stdout.includes('Ready for'), false);
  }
});

test('production import graph contains no legacy provider transports or external legacy API domains', () => {
  const inputs = Object.keys(built.metafile.inputs);
  assert.equal(inputs.some(path => /(?:gemini-feedback|groq-feedback|feedback-fallback|english-accuracy|free-feedback-evaluation|original-feedback-evaluation)\.ts$/.test(path)), false);
  for (const path of Object.keys(built.metafile.outputs)) assert.equal(/generativelanguage\.googleapis\.com|api\.groq\.com/.test(readFileSync(path, 'utf8')), false);
});
