import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { history, emptyState } from './fixtures/backup-history.cjs';
import { feedback as legacyFeedback } from './fixtures/sentence-structure.cjs';

const out = 'work/ai-contract-tests';
mkdirSync(out, { recursive: true });
const boundary = { name: 'synthetic-boundaries', setup(b) {
  b.onResolve({ filter: /^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/store)$/ }, a => ({ path: a.path, namespace: 'boundary' }));
  b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({ loader: 'js', contents: a.path === 'cloudflare:workers'
    ? 'export const env=globalThis.aiContractRuntime.env' : a.path.endsWith('chatgpt-auth')
      ? 'export const getChatGPTUser=async()=>globalThis.aiContractRuntime.user'
      : 'export const database=()=>globalThis.aiContractRuntime.db' }));
} };
await build({ entryPoints: ['lib/ai-contract.ts', 'lib/sentence-feedback.ts', 'lib/validation.ts', 'lib/backup-analysis.ts', 'lib/response-validation.ts', 'db/restore-jobs.ts', 'lib/learning/feedback-identity.ts'], outdir: out, entryNames: '[name]', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
for (const [name, file] of [['state', 'app/api/state/route.ts'], ['restore', 'app/api/state/restore/route.ts']])
  await build({ entryPoints: [file], outfile: `${out}/${name}.mjs`, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', plugins: [boundary] });
const { AI_CONTRACT_HEADERS } = await import(`../${out}/ai-contract.mjs`);
const { sentenceFeedbackSchema } = await import(`../${out}/sentence-feedback.mjs`);
const { settingsSchema } = await import(`../${out}/validation.mjs`);
const { analyzeBackup } = await import(`../${out}/backup-analysis.mjs`);
const { parseSnapshot } = await import(`../${out}/response-validation.mjs`);
const { feedbackProvider } = await import(`../${out}/feedback-identity.mjs`);
const jobs = await import(`../${out}/restore-jobs.mjs`);
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of ['0000_worthless_doctor_faustus', '0001_ai_daily_usage', '0002_old_golden_guardian', '0003_bright_zarda', '0006_feedback_request_receipts']) sqlite.exec(readFileSync(`drizzle/${file}.sql`, 'utf8'));
let failAt = -1, commitStatements = 0;
const db = {
  prepare(sql) { return { bind(...args) { return { sql, args,
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  }; } }; },
  async batch(statements) {
    const committing = statements.some(s => s.sql.includes("SET status='committing'"));
    if (committing) commitStatements = statements.length;
    sqlite.exec('BEGIN');
    try {
      const result = statements.map((s, i) => {
        if (committing && i === failAt) throw Error('synthetic transaction failure');
        const stmt = sqlite.prepare(s.sql);
        return /^SELECT/.test(s.sql) ? { results: stmt.all(...s.args) } : { meta: { changes: Number(stmt.run(...s.args).changes) } };
      });
      sqlite.exec('COMMIT'); return result;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
globalThis.aiContractRuntime = { user: { userId: 'owner' }, db, env: { large_backup_restore_enabled: 'true', OPENAI_ALLOWED_MODELS: 'gpt-6.1-sol,gpt-6.1-terra,gpt-6-astra' } };
const stateApi = await import(`../${out}/state.mjs`);
const restoreApi = await import(`../${out}/restore.mjs`);
const capabilities = { ...AI_CONTRACT_HEADERS, 'X-Study-Grammar': '4', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1', 'X-Study-Monthly-Carryover': '1' };
const modern = { ...legacyFeedback, provider: 'openai', requestedModel: 'gpt-6.1-terra', model: 'gpt-6.1-terra', promptVersion: 'reference-v1', validationVersion: 'structured-v1' };
const modernJudgment = { ...modern, promptVersion: 'reference-v2', validationVersion: 'judgment-v2' };
delete modernJudgment.structure;
const future = { ...modern, model: 'future-retired-model-2030', requestedModel: 'future-retired-model-2030' };
const archive = state => JSON.stringify({ format: 'haru-words-v1', exportedAt: '2026-11-03T00:00:00.000Z', state });
const request = (path, method, body, headers = capabilities) => new Request('https://study.example' + path, { method, headers: { origin: 'https://study.example', 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
function mixed() {
  const state = history(1, 5);
  state.settings.aiModelId = 'gpt-6.1-terra';
  const records = Object.values(Object.values(state.sessions)[0].records);
  for (const [i, f] of [legacyFeedback, { ...legacyFeedback, model: 'openai/gpt-oss-120b' }, modern, modernJudgment, future].entries()) {
    records[i].sentence = f.original; records[i].aiFeedback = structuredClone(f);
    records[i].enAnswer = 'first answer retained'; records[i].retryEn = 'help';
  }
  const answer = { first: 'first', latest: 'latest', attempts: 2, helped: true };
  state.grammar = {
    noun: { stage: 5, answers: { q1: answer, q2: answer, q3: answer }, sentence: modern.original, feedback: structuredClone(modern), updatedAt: modern.createdAt },
    verb: { stage: 5, answers: { q1: answer, q2: answer, q3: answer }, sentence: modernJudgment.original, feedback: structuredClone(modernJudgment), updatedAt: modernJudgment.createdAt },
  };
  return state;
}
function seed(state, user = 'owner') {
  sqlite.prepare('UPDATE learner_states SET settings=? WHERE user_id=?').run(JSON.stringify(state.settings), user);
  for (const [id, row] of Object.entries(state.progress)) sqlite.prepare('INSERT INTO word_progress VALUES (?,?,?)').run(user, id, JSON.stringify(row));
  for (const [id, row] of Object.entries(state.sessions)) sqlite.prepare('INSERT INTO study_sessions VALUES (?,?,?)').run(user, id, JSON.stringify(row));
  for (const [id, row] of Object.entries(state.grammar ?? {})) sqlite.prepare('INSERT INTO grammar_progress VALUES (?,?,?)').run(user, id, JSON.stringify(row));
}
const dump = () => JSON.stringify(['learner_states', 'word_progress', 'study_sessions', 'grammar_progress', 'ai_daily_usage','feedback_requests'].map(t => sqlite.prepare(`SELECT * FROM ${t} ORDER BY user_id`).all()));
function reset() {
  failAt = -1;
  for (const t of ['restore_jobs', 'learner_states', 'word_progress', 'study_sessions', 'grammar_progress', 'ai_daily_usage']) sqlite.exec(`DELETE FROM ${t}`);
  for (const user of ['owner', 'other']) sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user, JSON.stringify(emptyState().settings), 'initial');
  aiContractRuntime.user = { userId: 'owner' };
}
beforeEach(reset);
after(() => { sqlite.close(); delete globalThis.aiContractRuntime; });
async function ready(state) {
  const data = await analyzeBackup(archive(state));
  let job = await jobs.createRestoreJob(db, 'owner', 0, data.manifest);
  for (let i = 0; i < data.parts.length; i++) await jobs.uploadRestorePart(db, 'owner', job.id, i, data.parts[i]);
  while (job.status !== 'ready') job = await jobs.validateRestoreJob(db, 'owner', job.id);
  return job;
}
async function snapshot() { return parseSnapshot(await (await stateApi.GET(request('/api/state', 'GET'))).json()); }

test('bounded history schema preserves legacy, OpenAI, retired and unknown models without regrading', async () => {
  const state = mixed();
  assert.deepEqual((await analyzeBackup(archive(state))).parsed.state, state);
  for (const f of [legacyFeedback, modern, modernJudgment, future, { ...legacyFeedback, model: 'unrecognized-historical-provider' }]) assert.deepEqual(sentenceFeedbackSchema.parse(f), f);
  assert.equal(sentenceFeedbackSchema.safeParse({ ...modern, requestedModel: undefined }).success, false);
  assert.equal(sentenceFeedbackSchema.safeParse({ ...modern, model: 'x'.repeat(129) }).success, false);
  assert.equal(settingsSchema.safeParse({ ...state.settings, aiModelId: '<script>' }).success, false);
  assert.equal(settingsSchema.parse(emptyState().settings).aiModelId, undefined);
  assert.equal(feedbackProvider(legacyFeedback), 'Google Gemini');
  assert.equal(feedbackProvider({ model: 'openai/gpt-oss-120b' }), 'Groq');
  assert.equal(feedbackProvider(future), 'OpenAI');
  assert.equal(feedbackProvider({ model: 'unknown' }), '알 수 없는 제공사');
});

test('legacy GET rejects new settings and feedback before hidden grammar projection, account isolated', async () => {
  for (const kind of ['settings', 'word', 'grammar']) {
    reset(); const state = mixed();
    if (kind !== 'settings') delete state.settings.aiModelId;
    if (kind !== 'word') for (const s of Object.values(state.sessions)) for (const r of Object.values(s.records)) delete r.aiFeedback;
    if (kind !== 'grammar') delete state.grammar;
    seed(state); const before = dump();
    assert.equal((await stateApi.GET()).status, 426, kind);
    assert.deepEqual((await snapshot()).state, { ...state, grammar: state.grammar ?? {} });
    assert.equal(dump(), before);
    aiContractRuntime.user = { userId: 'other' };
    assert.equal((await stateApi.GET()).status, 200);
  }
});

test('legacy settings replacement cannot erase model choice; modern save retains it with revision protection', async () => {
  const state = mixed(); seed(state); const before = dump();
  const oldSettings = { ...state.settings, dailyGoal: 3 }; delete oldSettings.aiModelId;
  const data = { revision: 0, settings: oldSettings, progress: {}, sessions: {} };
  assert.equal((await stateApi.PUT(request('/api/state', 'PUT', data, {}))).status, 426);
  assert.equal(dump(), before);
  assert.equal((await stateApi.PUT(request('/api/state', 'PUT', { ...data, settings: { ...state.settings, dailyGoal: 3 } }))).status, 200);
  const saved = await snapshot(); assert.equal(saved.state.settings.aiModelId, state.settings.aiModelId);
  assert.deepEqual(saved.state.sessions, state.sessions); assert.deepEqual(saved.state.grammar, state.grammar);
  assert.equal((await stateApi.PUT(request('/api/state', 'PUT', data))).status, 409);
  assert.equal((await snapshot()).revision, 1);
});

test('full restore rejects old clients on either side, then round-trips mixed records without rewriting', async () => {
  const state = mixed(), before = dump();
  assert.equal((await restoreApi.POST(request('/api/state/restore', 'POST', archive(state), { 'X-Study-Revision': '0' }))).status, 426);
  assert.equal(dump(), before);
  assert.equal((await restoreApi.POST(request('/api/state/restore', 'POST', archive(state), { ...capabilities, 'X-Study-Revision': '0' }))).status, 200);
  assert.deepEqual((await snapshot()).state, state);
  const saved = dump();
  assert.equal((await restoreApi.POST(request('/api/state/restore', 'POST', archive(emptyState()), { 'X-Study-Revision': '1' }))).status, 426);
  assert.equal(dump(), saved);
  assert.equal((await restoreApi.POST(request('/api/state/restore', 'POST', archive(state), { ...capabilities, 'X-Study-Revision': '0' }))).status, 409);
  assert.equal(dump(), saved);
});

test('chunked restore preserves mixed metadata and a lost-response receipt commits exactly once', async () => {
  const state = mixed(), job = await ready(state);
  await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, false), e => e.status === 426);
  const result = await jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, true);
  assert.equal(result.revision, 1); assert.deepEqual((await snapshot()).state, state);
  const saved = dump(); assert.deepEqual(await jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, true), result);
  assert.equal(dump(), saved); assert.equal(sqlite.prepare('SELECT count(*) n FROM restore_parts').get().n, 0);
});

test('contract 3 preserves explicit context through save, GET, full and chunk restore; contract 2 cannot erase or project it away',async()=>{
 const oldCapabilities={...capabilities,'X-Study-AI-Contract':'2'};
 for(const kind of ['word','grammar']){
  reset();const state=mixed(),f={...modernJudgment,promptVersion:'reference-v3',validationVersion:'judgment-v3',contextFingerprint:'a'.repeat(64),contextNote:'질문에 대한 짧은 답변이에요.'};
  if(kind==='word')Object.values(Object.values(state.sessions)[0].records)[0].aiFeedback=f;
  else state.grammar.noun.feedback=f;
  seed(state);const before=dump();
  assert.equal((await stateApi.GET(request('/api/state','GET',undefined,oldCapabilities))).status,426);
  assert.equal((await stateApi.PUT(request('/api/state','PUT',{revision:0,progress:{},sessions:{}},oldCapabilities))).status,426);
  assert.equal((await restoreApi.POST(request('/api/state/restore','POST',archive(emptyState()),{...oldCapabilities,'X-Study-Revision':'0'}))).status,426);
  assert.equal(dump(),before);assert.deepEqual((await snapshot()).state,state);
  assert.equal((await stateApi.PUT(request('/api/state','PUT',{revision:0,progress:{},sessions:state.sessions,grammar:state.grammar}))).status,200);
  assert.deepEqual((await snapshot()).state,state);
  reset();assert.equal((await restoreApi.POST(request('/api/state/restore','POST',archive(state),{...oldCapabilities,'X-Study-Revision':'0'}))).status,426);
  assert.equal((await restoreApi.POST(request('/api/state/restore','POST',archive(state),{...capabilities,'X-Study-Revision':'0'}))).status,200);
  assert.deepEqual((await snapshot()).state,state);
  reset();const job=await ready(state),staged=dump();
  await assert.rejects(jobs.commitRestoreJob(db,'owner',job.id,4,true,true,2),e=>e.status===426);assert.equal(dump(),staged);
  const result=await jobs.commitRestoreJob(db,'owner',job.id,4,true,true,3);assert.equal(result.revision,1);assert.deepEqual((await snapshot()).state,state);
 }
});

test('contract 3 preserves archival v3 but protects v4 through v10 semantics; capability4 reads them without data-format migration',async()=>{
 for(const version of [4,5,6,7,8,9,10])for(const domain of ['word','grammar']){reset();
 const state=mixed(),oldCapabilities={...capabilities,'X-Study-AI-Contract':'3'};
 const feedback={...modernJudgment,promptVersion:'reference-v'+version,validationVersion:'judgment-v'+version};
 if(domain==='word')Object.values(Object.values(state.sessions)[0].records)[0].aiFeedback=feedback;
 else state.grammar.noun.feedback=feedback;
 seed(state);const before=dump();assert.equal((await stateApi.GET(request('/api/state','GET',undefined,oldCapabilities))).status,426);
 assert.equal((await stateApi.PUT(request('/api/state','PUT',{revision:0,progress:{},sessions:{}},oldCapabilities))).status,426);
 assert.equal((await stateApi.PUT(request('/api/state','PUT',{revision:0,progress:{},sessions:{}},{...oldCapabilities,'X-Study-AI-Contract':'2'}))).status,426);
 assert.equal((await restoreApi.POST(request('/api/state/restore','POST',archive(emptyState()),{...oldCapabilities,'X-Study-Revision':'0'}))).status,426);assert.equal(dump(),before);
 assert.deepEqual((await snapshot()).state,state);
 reset();const job=await ready(state);await assert.rejects(jobs.commitRestoreJob(db,'owner',job.id,4,true,true,3),e=>e.status===426);
 assert.equal((await jobs.commitRestoreJob(db,'owner',job.id,4,true,true,4)).revision,1);assert.deepEqual((await snapshot()).state,state);
 }
});

for(const version of [6,10])for(const domain of ['word','grammar'])for(const operation of ['save','full restore','split restore'])test(`stored judgment-v${version} ${domain} cannot be removed by contract3 ${operation}`,async()=>{
 const state=mixed(),replacement={...emptyState(),grammar:{}},feedback={...modernJudgment,promptVersion:version===10?'reference-v13':'reference-v5',validationVersion:'judgment-v'+version};
 if(domain==='word')Object.values(Object.values(state.sessions)[0].records)[0].aiFeedback=feedback;
 else state.grammar.noun.feedback=feedback;
 seed(state);const before=dump(),oldCapabilities={...capabilities,'X-Study-AI-Contract':'3'};
 const replace=async(headers)=>operation==='save'
  ?stateApi.PUT(request('/api/state','PUT',{revision:0,progress:{},sessions:{},grammar:{}},headers))
  :restoreApi.POST(request('/api/state/restore','POST',archive(replacement),{...headers,'X-Study-Revision':'0'}));
 if(operation==='split restore'){
  const job=await ready(replacement);await assert.rejects(jobs.commitRestoreJob(db,'owner',job.id,4,true,true,3),e=>e.status===426);
  assert.equal(dump(),before);assert.equal((await jobs.commitRestoreJob(db,'owner',job.id,4,true,true,4)).revision,1);
 }else{
  assert.equal((await replace(oldCapabilities)).status,426);assert.equal(dump(),before);
  assert.equal((await replace(capabilities)).status,200);
 }
 const current=await snapshot();assert.equal(current.revision,1);
 assert.deepEqual(current.state.sessions,operation==='save'?state.sessions:{});assert.deepEqual(current.state.grammar,operation==='save'?state.grammar:{});
});

function seedFeedbackReceipts(state){
  const now=Date.now();
  for(const [domain,target] of [['word',Object.keys(state.sessions)[0]],['grammar',Object.keys(state.grammar)[0]]])
    sqlite.prepare("INSERT INTO feedback_requests VALUES(?,?,?,?,?,'completed',?,?,?,?,?)").run('owner',crypto.randomUUID(),'synthetic-hash',domain,target,now,now+7*86400000,now+86400000,200,JSON.stringify({feedback:modern}));
}
test('full and chunk restores invalidate AI response bodies while retaining owner-scoped no-rerun tombstones',async()=>{
  for(const mode of ['full','chunk']){
    reset();const state=mixed();seed(state);seedFeedbackReceipts(state);
    if(mode==='full')assert.equal((await restoreApi.POST(request('/api/state/restore','POST',archive(state),{...capabilities,'X-Study-Revision':'0'}))).status,200);
    else{const job=await ready(state);await jobs.commitRestoreJob(db,'owner',job.id,4,true,true,true);}
    const rows=sqlite.prepare('SELECT status,response FROM feedback_requests WHERE user_id=?').all('owner');assert.equal(rows.length,2);
    for(const row of rows){assert.equal(row.status,'invalidated');assert.equal(row.response,null);}
    assert.deepEqual((await snapshot()).state,state);
  }
});

test('every mixed restore transaction failure is atomic and concurrent revision conflicts preserve input', async () => {
  let job = await ready(mixed()); await jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, true);
  const count = commitStatements;
  for (let i = 0; i < count; i++) {
    reset(); const existing=mixed();seed(existing);seedFeedbackReceipts(existing); job = await ready(mixed()); const before = dump(); failAt = i;
    await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, true), /synthetic transaction failure/);
    assert.equal(dump(), before, `statement ${i}`); assert.equal((await jobs.getRestoreJob(db, 'owner', job.id)).status, 'ready');
  }
  reset(); job = await ready(mixed()); sqlite.prepare('UPDATE learner_states SET revision=1 WHERE user_id=?').run('owner'); const before = dump();
  await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, true), e => e.status === 409);
  assert.equal(dump(), before);
});

test('legacy chunk commit detects unknown or OpenAI staged feedback without a model setting', async () => {
  for (const kind of ['word', 'grammar']) {
    reset(); const state = mixed(); delete state.settings.aiModelId;
    if (kind === 'word') delete state.grammar;
    else for (const s of Object.values(state.sessions)) for (const r of Object.values(s.records)) delete r.aiFeedback;
    const job = await ready(state), before = dump();
    await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, false), e => e.status === 426);
    assert.equal(dump(), before);
  }
});

test('single-provider histories and missing/retired settings survive save, export, full and chunk restore', async () => {
  for (const source of [legacyFeedback, { ...legacyFeedback, model: 'openai/gpt-oss-120b' }, modern, future]) {
    for (const structure of [true, false]) {
      for (const modelSetting of [undefined, 'retired-selection-2030']) {
        reset(); const state = history(1, 1), f = structuredClone(source);
        if (!structure) delete f.structure;
        if (modelSetting !== undefined) state.settings.aiModelId = modelSetting;
        const record = Object.values(Object.values(state.sessions)[0].records)[0];
        record.sentence = f.original; record.aiFeedback = f; state.grammar = {};
        seed(state);
        assert.equal((await stateApi.PUT(request('/api/state', 'PUT', { revision: 0, ...state }))).status, 200);
        assert.deepEqual((await snapshot()).state, state);
        const exported = archive((await snapshot()).state);
        assert.deepEqual((await analyzeBackup(exported)).parsed.state, state);
        reset();
        assert.equal((await restoreApi.POST(request('/api/state/restore', 'POST', exported, { ...capabilities, 'X-Study-Revision': '0' }))).status, 200);
        assert.deepEqual((await snapshot()).state, state);
        reset(); const job = await ready(state); await jobs.commitRestoreJob(db, 'owner', job.id, 4, true, true, true);
        assert.deepEqual((await snapshot()).state, state);
      }
    }
  }
});

test('model settings save only enabled new selections, preserve other accounts, and require current revision', async () => {
  const settings = { ...emptyState().settings, aiModelId: 'gpt-6.1-terra' };
  const payload = { revision: 0, settings, progress: {}, sessions: {} };
  assert.equal((await stateApi.PUT(request('/api/state', 'PUT', payload))).status, 200);
  assert.equal((await snapshot()).state.settings.aiModelId, settings.aiModelId);
  assert.equal(JSON.parse(sqlite.prepare('SELECT settings FROM learner_states WHERE user_id=?').get('other').settings).aiModelId, undefined);
  const before = dump();
  for (const id of ['arbitrary-model', 'gpt-6-astra-disabled-suffix']) assert.equal((await stateApi.PUT(request('/api/state', 'PUT', { ...payload, revision: 1, settings: { ...settings, aiModelId: id } }))).status, 400);
  const enabled = aiContractRuntime.env.OPENAI_ALLOWED_MODELS;
  aiContractRuntime.env.OPENAI_ALLOWED_MODELS = 'gpt-6.1-terra';
  assert.equal((await stateApi.PUT(request('/api/state', 'PUT', { ...payload, revision: 1, settings: { ...settings, aiModelId: 'gpt-6-astra' } }))).status, 400);
  aiContractRuntime.env.OPENAI_ALLOWED_MODELS = enabled;
  assert.equal(dump(), before);
  assert.equal((await stateApi.PUT(request('/api/state', 'PUT', { ...payload, settings: { ...settings, aiModelId: 'gpt-6-astra' } }))).status, 409);
  assert.equal(dump(), before);
});
