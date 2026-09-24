import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { EMPTY, pickDaily, learningMetrics } from '../lib/learning.ts';
mkdirSync('work/grammar-tests', { recursive: true });
await build({ entryPoints: ['lib/grammar/model.ts', 'lib/grammar/content.ts', 'lib/grammar/feedback.ts', 'lib/backup-analysis.ts', 'lib/restore-validation.ts', 'db/restore-jobs.ts', 'db/learning-state.ts', 'lib/state-delta.ts', 'app/grammar/grammar-presentation.ts'], outdir: 'work/grammar-tests', entryNames: '[name]', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const model = await import('../work/grammar-tests/model.mjs');
const { GRAMMAR_LESSONS, answerCorrect, exampleFocusStart, firstAnswerLabel, needsGrammarReview } = await import('../work/grammar-tests/content.mjs');
const { analyzeBackup } = await import('../work/grammar-tests/backup-analysis.mjs');
const { manifestSchema, parsePart } = await import('../work/grammar-tests/restore-validation.mjs');
const jobs = await import('../work/grammar-tests/restore-jobs.mjs');
const { saveState, restoreState, loadStateDocuments } = await import('../work/grammar-tests/learning-state.mjs');
const { stateDelta } = await import('../work/grammar-tests/state-delta.mjs');
const { generateGrammarFeedback } = await import('../work/grammar-tests/feedback.mjs');
const { grammarStep, grammarCatalog, grammarFeedbackTone } = await import('../work/grammar-tests/grammar-presentation.mjs');
const date = '2026-09-24T00:00:00.000Z', words = JSON.parse(readFileSync('data/words.json', 'utf8'));
const initial = () => model.newGrammarProgress(date);
const completed = () => ({ ...initial(), stage: 6, answers: Object.fromEntries(['q1', 'q2', 'q3'].map(k => [k, model.recordAnswer(undefined, 'answer')])), sentence: 'I like music.', check: 'appropriate', completedAt: date });
const raw = state => JSON.stringify({ format: 'haru-words-v1', exportedAt: date, state });

test('seven stored lesson positions map to the existing five visible phases', () => {
  const labels = ['살펴보기', '이해하기', '연습 1', '연습 2', '연습 3', '써 보기', '정리하기'];
  const phases = [0, 1, 2, 2, 2, 3, 4];
  for (let stage = 0; stage <= 6; stage++) {
    const p = { ...initial(), stage };
    const view = grammarStep(p);
    assert.equal(view.label, labels[stage]);
    assert.equal(view.phase, phases[stage]);
    assert.equal(view.percent, stage / 6 * 100);
    assert.equal(view.reviewing, false);
    assert.equal(view.answers, p.answers);
  }
});
test('active review uses its own answers, hints and order without falling back to the first practice', () => {
  const p = { ...completed(), hints: ['q1'], order: [1], review: { index: 0, answers: {} } };
  for (let index = 0; index < 3; index++) {
    p.review.index = index;
    const before = structuredClone(p), view = grammarStep(p);
    assert.equal(view.reviewing, true);
    assert.equal(view.answers, p.review.answers);
    assert.deepEqual(view.hints, []); assert.deepEqual(view.selection, []);
    assert.equal(view.label, `다시 확인 ${index + 1}/3`);
    assert.equal(view.phase, index); assert.equal(view.percent, index / 3 * 100);
    assert.deepEqual(p, before);
  }
  p.review = { index: 3, answers: {}, completedAt: date };
  const summary = grammarStep(p);
  assert.equal(summary.reviewing, false); assert.equal(summary.label, '정리하기');
  assert.equal(summary.answers, p.answers); assert.deepEqual(summary.hints, ['q1']);
});
test('catalog counts, badges and filtered rows agree without changing lesson progress', () => {
  const done = id => ({ ...completed(), answers: Object.fromEntries(GRAMMAR_LESSONS.find(l => l.id === id).questions.map((q, i) => [`q${i + 1}`, model.recordAnswer(undefined, q.answer)])) });
  const progress = { noun: initial(), adjective: done('adjective'), modal: { ...done('modal'), review: { index: 0, answers: {} } } };
  progress.adjective.answers.q1.helped = true;
  const before = structuredClone(progress);
  for (const filter of ['all', 'continue', 'review']) {
    const view = grammarCatalog(progress, filter), rows = view.groups.flatMap(g => g.entries);
    assert.deepEqual(view.counts, { all: 15, continue: 2, review: 2, complete: 1 });
    assert.equal(rows.length, view.counts[filter]); assert.equal(view.visibleCount, rows.length);
    if (filter === 'review') {
      assert.deepEqual(rows.map(row => row.lesson.id), ['adjective', 'modal']);
      assert.deepEqual(view.groups.map(group => group.number), ['02', '05']);
      assert.equal(rows[0].complete, true); assert.equal(rows[1].continuing, true);
    }
  }
  assert.deepEqual(progress, before);
  assert.deepEqual(grammarCatalog({}, 'continue').groups, []);
  assert.deepEqual(grammarCatalog({}, 'review').groups, []);
});
test('AI feedback is green only when both judgments confirm, and uncertainty remains neutral', () => {
  for (const meaningUsage of ['appropriate', 'needs_work', 'uncertain']) {
    for (const grammar of ['natural', 'needs_work', 'uncertain']) {
      const result = grammarFeedbackTone({ meaningUsage, grammar });
      if (meaningUsage === 'needs_work' || grammar === 'needs_work') assert.equal(result, 'review');
      else if (meaningUsage === 'uncertain' || grammar === 'uncertain') assert.equal(result, 'neutral');
      else assert.equal(result, 'success');
    }
  }
});

await build({ entryPoints: ['app/api/grammar-feedback/route.ts', 'app/api/state/route.ts'], outdir: 'work/grammar-tests/routes', entryNames: '[dir]/[name]', bundle: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, logLevel: 'silent', plugins: [{ name: 'test-boundaries', setup(b) {
  b.onResolve({ filter: /^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/store)$/ }, a => ({ path: a.path, namespace: 'test' }));
  b.onLoad({ filter: /.*/, namespace: 'test' }, a => ({ loader: 'js', contents: a.path === 'cloudflare:workers' ? 'export const env=globalThis.grammarRuntime.env' : a.path.endsWith('chatgpt-auth') ? 'export const getChatGPTUser=async()=>globalThis.grammarRuntime.user' : 'export const database=()=>globalThis.grammarRuntime.db' }));
} }] });
globalThis.grammarRuntime = { db: null, env: { google_api: 'test-only', google_ai_enabled: 'true', grammar_enabled: 'true' }, user: { userId: 'owner' } };
const feedbackRoute = await import('../work/grammar-tests/routes/grammar-feedback/route.mjs');
const stateRoute = await import('../work/grammar-tests/routes/state/route.mjs');
const fetchOriginal = globalThis.fetch;
after(() => { globalThis.fetch = fetchOriginal; delete globalThis.grammarRuntime; });
const request = (body, origin = 'https://study.example') => new Request('https://study.example/api/grammar-feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
test('all 15 catalog labels have six contextual authored exercises and a unique answer', () => {
  assert.deepEqual(new Set(GRAMMAR_LESSONS.map(l => l.pos)), new Set(words.map(w => w.pos)));
  assert.deepEqual(new Set(GRAMMAR_LESSONS.map(l => l.id)), new Set(model.LESSON_IDS));
  assert.equal(GRAMMAR_LESSONS.length, 15);
  for (const l of GRAMMAR_LESSONS) {
    assert.equal(l.examples.length, 2); assert.equal(l.questions.length, 3); assert.equal(l.review.length, 3);
    for (const [en, ko, focus] of l.examples) { assert.ok(exampleFocusStart(en, focus) >= 0); assert.ok(ko.trim()); }
    for (const bank of [l.questions, l.review]) {
      assert.equal(bank.filter(q => q.kind === 'order').length, 1);
      for (const q of bank) {
        assert.ok(q.translation && q.explanation); assert.equal(new Set(q.options).size, q.options.length);
        if (q.kind === 'choice') { assert.ok(q.context); assert.equal(q.options.filter(o => answerCorrect(q, o)).length, 1); }
        else assert.equal([...q.options].sort().join(' ').split(' ').sort().join(' '), q.answer.split(' ').sort().join(' '));
      }
    }
    assert.notDeepEqual(l.questions, l.review); assert.ok(l.reference.startsWith('https://'));
  }
});
test('example emphasis uses word boundaries and prepared alternative word orders are accepted', () => {
  assert.equal(exampleFocusStart('I have a bag.', 'a'), 7);
  assert.equal(exampleFocusStart('I ate an apple.', 'an'), 6);
  assert.equal(exampleFocusStart('I have a bag.', 'an'), -1);
  const q = GRAMMAR_LESSONS.find(l => l.id === 'adverb').questions[2];
  for (const answer of [q.answer, ...q.alternatives]) assert.equal(answerCorrect(q, answer), true);
  assert.equal(answerCorrect(q, 'I often at home. cook'), false);
  for (const l of GRAMMAR_LESSONS) for (const q of [...l.questions, ...l.review]) for (const answer of q.alternatives ?? []) {
    assert.equal(q.kind, 'order');
    assert.equal(answer.split(' ').sort().join(' '), q.options.join(' ').split(' ').sort().join(' '));
  }
});
test('help on an already answered question records help without replacing first answer or counting an attempt', () => {
  const original = { ...initial(), answers: { q1: model.recordAnswer(undefined, 'teacher') } }, before = structuredClone(original);
  const hinted = model.revealGrammarAnswer(original, 'q1', false);
  assert.deepEqual(original, before);
  assert.deepEqual(hinted.answers.q1, { first: 'teacher', latest: 'teacher', helped: true, attempts: 1 });
  assert.deepEqual(hinted.hints, ['q1']);
  assert.deepEqual(model.revealGrammarAnswer(hinted, 'q1', false), hinted);
  const noAnswer = model.revealGrammarAnswer(initial(), 'q2', false);
  assert.deepEqual(noAnswer.answers, {}); assert.deepEqual(noAnswer.hints, ['q2']);
  const review = { ...completed(), review: { index: 0, answers: { q1: model.recordAnswer(undefined, '명사') } } };
  const reviewed = model.revealGrammarAnswer(review, 'q1', true);
  assert.equal(reviewed.review.answers.q1.helped, true); assert.deepEqual(reviewed.answers, review.answers);
  const retried = model.recordAnswer(model.recordAnswer(undefined, 'reads'), 'teacher');
  assert.equal(retried.helped, true);
  assert.equal(firstAnswerLabel(GRAMMAR_LESSONS[0].questions[0], retried), '처음엔 오답 · 도움 사용');
});
test('review badge includes hints, latest wrong answers and an unfinished review; successful independent review clears it', () => {
  const lesson = GRAMMAR_LESSONS[0];
  const answers = bank => Object.fromEntries(bank.map((q, i) => [`q${i + 1}`, model.recordAnswer(undefined, q.answer)]));
  const p = { ...completed(), answers: answers(lesson.questions) };
  assert.equal(needsGrammarReview(lesson, p), false);
  assert.equal(needsGrammarReview(lesson, { ...p, hints: ['q1'] }), true); // legacy hint/answer discrepancy
  assert.equal(needsGrammarReview(lesson, { ...p, answers: { ...p.answers, q1: { ...p.answers.q1, latest: 'reads' } } }), true);
  assert.equal(needsGrammarReview(lesson, { ...p, review: { index: 0, answers: {} } }), true);
  const checked = { ...p, hints: ['q1'], review: { index: 3, answers: answers(lesson.review), completedAt: date } };
  assert.equal(needsGrammarReview(lesson, checked), false);
  assert.equal(needsGrammarReview(lesson, { ...checked, check: 'uncertain' }), true);
});
test('first response/help remains intact after successful retries, without mutating input', () => {
  const first = model.recordAnswer(undefined, 'reads', true), copy = structuredClone(first);
  const next = model.recordAnswer(first, 'teacher');
  assert.deepEqual(first, copy); assert.equal(next.first, 'reads'); assert.equal(next.latest, 'teacher'); assert.equal(next.helped, true); assert.equal(next.attempts, 2);
  assert.equal(needsGrammarReview(GRAMMAR_LESSONS[0], { ...initial(), answers: { q1: next } }), true);
});
test('no skipped stages or false completions; sentence changes invalidate previous checks', () => {
  assert.equal(model.grammarProgressSchema.safeParse(initial()).success, true);
  assert.equal(model.grammarProgressSchema.safeParse(completed()).success, true);
  for (const change of [p => p.stage = 5, p => p.stage = 6, p => p.review = { index: 0, answers: {} }, p => p.completedAt = date, p => p.sentence = 'x'.repeat(2001), p => p.hints = ['q1', 'q1']]) {
    const p = initial(); change(p); assert.equal(model.grammarProgressSchema.safeParse(p).success, false);
  }
  const p = completed(), changed = model.updateGrammarSentence(p, 'I like tea.');
  assert.equal(changed.check, undefined); assert.equal(changed.completedAt, undefined); assert.equal(changed.stage, 5); assert.equal(p.sentence, 'I like music.');
  assert.equal(model.grammarStateSchema.safeParse({ invalid: initial() }).success, false);
  assert.equal(model.grammarProgressSchema.safeParse({ ...completed(), completedAt: undefined }).success, false);
  assert.equal(model.grammarProgressSchema.safeParse({ ...completed(), review: { index: 3, answers: completed().answers } }).success, false);
  assert.equal(model.grammarProgressSchema.safeParse({ ...completed(), feedback: { original: 'Another sentence.', correctedSentence: '', meaningUsage: 'uncertain', grammar: 'uncertain', explanation: '이전 문장의 의견', model: 'gemini-3.1-flash-lite', createdAt: date } }).success, false);
});
test('grammar deltas preserve all vocabulary scores, quotas and next-day allocations', () => {
  const before = structuredClone(EMPTY), after = { ...before, grammar: { noun: completed() } };
  const delta = stateDelta(before, after);
  assert.deepEqual(delta.grammar, after.grammar); assert.deepEqual(delta.progress, {}); assert.deepEqual(delta.sessions, {}); assert.equal(delta.settings, undefined);
  assert.deepEqual(learningMetrics(after), learningMetrics(before));
  for (let goal = 1; goal <= 10; goal++) { before.settings.dailyGoal = goal; assert.deepEqual(pickDaily(words, after, '2026-09-25'), pickDaily(words, before, '2026-09-25')); }
});
test('new and old backups round-trip; explicit empty grammar is distinguishable from missing', async () => {
  for (const grammar of [undefined, {}, { noun: completed() }]) {
    const state = { ...structuredClone(EMPTY), ...(grammar === undefined ? {} : { grammar }) }, analysis = await analyzeBackup(raw(state));
    assert.deepEqual(analysis.parsed.state, state); assert.equal(analysis.manifest.parts.filter(p => p.kind === 'grammar').length, grammar === undefined ? 0 : 1);
    for (let i = 0; i < analysis.parts.length; i++) assert.deepEqual(parsePart(analysis.parts[i], analysis.manifest.parts[i]), grammar);
    assert.ok(manifestSchema.safeParse(analysis.manifest).success);
    if (grammar !== undefined) { const duplicate = structuredClone(analysis.manifest); duplicate.parts.push(duplicate.parts[0]); assert.equal(manifestSchema.safeParse(duplicate).success, false); }
  }
  await assert.rejects(analyzeBackup(raw({ ...EMPTY, grammar: { noun: { ...initial(), sentence: 'x'.repeat(2001) } } })));
});

const sqlite = new DatabaseSync(':memory:');
for (const file of ['0000_worthless_doctor_faustus', '0001_ai_daily_usage', '0002_old_golden_guardian', '0003_bright_zarda']) sqlite.exec(readFileSync(`drizzle/${file}.sql`, 'utf8'));
let failAt = -1;
const db = { prepare(sql) { return { bind(...args) { return { sql, args, async first() { return sqlite.prepare(sql).get(...args) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }; } }; }, async batch(statements) { sqlite.exec('BEGIN'); try { const results = statements.map((s, i) => { if (i === failAt) throw Error('injected'); const stmt = sqlite.prepare(s.sql); return /^SELECT/.test(s.sql) ? { results: stmt.all(...s.args) } : { meta: { changes: Number(stmt.run(...s.args).changes) } }; }); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
grammarRuntime.db = db;
beforeEach(() => { failAt = -1; for (const t of ['restore_parts', 'restore_jobs', 'grammar_progress', 'word_progress', 'study_sessions', 'learner_states', 'ai_daily_usage']) sqlite.exec(`DELETE FROM ${t}`); for (const user of ['owner', 'other']) sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user, JSON.stringify(EMPTY.settings), date); });
after(() => sqlite.close());
const readGrammar = () => sqlite.prepare('SELECT * FROM grammar_progress ORDER BY user_id,lesson_id').all();
test('account-scoped saves are atomic; old requests retain grammar and stale revisions cannot overwrite it', async () => {
  assert.equal(await saveState(db, 'owner', { revision: 0, grammar: { noun: initial() }, progress: {}, sessions: {} }), true);
  assert.equal(await saveState(db, 'owner', { revision: 1, progress: {}, sessions: {} }), true);
  assert.equal(await saveState(db, 'owner', { revision: 0, grammar: { noun: completed() }, progress: {}, sessions: {} }), false);
  assert.equal((await loadStateDocuments(db, 'owner')).grammar, undefined);
  assert.equal((await loadStateDocuments(db, 'owner', true)).grammar.length, 1);
  assert.equal((await loadStateDocuments(db, 'other', true)).grammar.length, 0);
  const before = readGrammar(); failAt = 1;
  await assert.rejects(saveState(db, 'owner', { revision: 2, grammar: { noun: completed() }, progress: {}, sessions: {} }), /injected/);
  assert.deepEqual(readGrammar(), before);
});
async function prepareRestore(state, revision = 0) {
  const a = await analyzeBackup(raw(state)); let job = await jobs.createRestoreJob(db, 'owner', revision, a.manifest);
  for (let i = 0; i < a.parts.length; i++) await jobs.uploadRestorePart(db, 'owner', job.id, i, a.parts[i]);
  while (job.status !== 'ready') job = await jobs.validateRestoreJob(db, 'owner', job.id);
  return job;
}
test('both restore paths preserve grammar for old backups, replace present grammar, and retain other accounts', async () => {
  for (const user of ['owner', 'other']) sqlite.prepare('INSERT INTO grammar_progress VALUES (?,?,?)').run(user, 'noun', JSON.stringify(initial()));
  const before = readGrammar();
  assert.equal(await restoreState(db, 'owner', 0, structuredClone(EMPTY)), true); assert.deepEqual(readGrammar(), before);
  const oldJob = await prepareRestore(structuredClone(EMPTY), 1); await jobs.commitRestoreJob(db, 'owner', oldJob.id); assert.deepEqual(readGrammar(), before);
  const fresh = await prepareRestore({ ...structuredClone(EMPTY), grammar: { verb: completed() } }, 2); await jobs.commitRestoreJob(db, 'owner', fresh.id);
  assert.deepEqual(readGrammar().map(r => [r.user_id, r.lesson_id]), [['other', 'noun'], ['owner', 'verb']]);
  const empty = await prepareRestore({ ...structuredClone(EMPTY), grammar: {} }, 3); await jobs.commitRestoreJob(db, 'owner', empty.id);
  assert.deepEqual(readGrammar().map(r => [r.user_id, r.lesson_id]), [['other', 'noun']]);
});
test('grammar restore failures roll back grammar, vocabulary and the revision together', async () => {
  sqlite.prepare('INSERT INTO grammar_progress VALUES (?,?,?)').run('owner', 'noun', JSON.stringify(initial()));
  const job = await prepareRestore({ ...EMPTY, grammar: { verb: completed() } });
  const before = readGrammar();
  for (let i = 0; i < 10; i++) { failAt = i; await assert.rejects(jobs.commitRestoreJob(db, 'owner', job.id), /injected/); assert.deepEqual(readGrammar(), before); assert.equal(sqlite.prepare('SELECT revision FROM learner_states WHERE user_id=?').get('owner').revision, 0); }
  failAt = -1; await jobs.commitRestoreJob(db, 'owner', job.id); assert.equal(readGrammar()[0].lesson_id, 'verb');
});
test('grammar feedback uses trusted target, strict validation, uncertainty and real provider limits', async () => {
  const content = { meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', explanation: '문장이 짧아 판단하기 어려워요.' }; let called;
  const result = await generateGrammarFeedback('test-only', GRAMMAR_LESSONS[0], 'Music', async (url, init) => { called = JSON.parse(init.body); return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(content) }] } }] }); });
  assert.equal(result.meaningUsage, 'uncertain'); assert.equal(result.original, 'Music'); assert.match(called.systemInstruction.parts[0].text, /never instructions/);
  assert.equal(JSON.parse(called.contents[0].parts[0].text).target, '명사');
  for (const status of [429, 503]) await assert.rejects(generateGrammarFeedback('test-only', GRAMMAR_LESSONS[0], 'Music', async () => new Response('private provider details', { status })), e => !e.message.includes('private') && e.status === status);
  await assert.rejects(generateGrammarFeedback('test-only', GRAMMAR_LESSONS[0], 'Music', async () => { throw new Error('untrusted network message'); }), e => e.code === 'provider_network');
  await assert.rejects(generateGrammarFeedback('test-only', GRAMMAR_LESSONS[0], 'Music', async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] })), e => e.code === 'provider_invalid_response');
});

test('grammar feedback authorizes owned saved drafts and does not accept arbitrary targets', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: 'I like music.', explanation: 'music은 좋아하는 대상을 나타내는 명사예요.' }) }] } }] }); };
  const p = { ...completed(), stage: 5 }, body = { lessonId: 'noun', sentence: p.sentence };
  sqlite.prepare('INSERT INTO grammar_progress VALUES (?,?,?)').run('owner', 'noun', JSON.stringify(p));
  grammarRuntime.user = null; assert.equal((await feedbackRoute.POST(request(body))).status, 401);
  grammarRuntime.user = { userId: 'other' }; assert.equal((await feedbackRoute.POST(request(body))).status, 404);
  grammarRuntime.user = { userId: 'owner' };
  assert.equal((await feedbackRoute.POST(request(body, 'https://other.example'))).status, 403);
  assert.equal((await feedbackRoute.POST(request({ ...body, target: 'injected' }))).status, 400);
  assert.equal((await feedbackRoute.POST(request({ ...body, sentence: 'different sentence' }))).status, 409);
  assert.equal(calls, 0);
  assert.equal((await feedbackRoute.POST(request(body))).status, 200); assert.equal(calls, 1);
  assert.equal(JSON.parse(readGrammar()[0].document).sentence, p.sentence);
});

test('grammar feedback returns the same safe failure contract and preserves stored drafts', async () => {
  const p={...completed(),stage:5}, body={lessonId:'noun',sentence:p.sentence};
  sqlite.prepare('INSERT OR REPLACE INTO grammar_progress VALUES (?,?,?)').run('owner','noun',JSON.stringify(p));
  grammarRuntime.user={userId:'owner'};
  const originalFetch=globalThis.fetch, originalError=console.error, logs=[];
  console.error=value=>logs.push(value);
  try {
    globalThis.fetch=async()=>Response.json({error:{message:'PRIVATE_KEY_SENTENCE',details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:'RequestsPerDay'}]}]}},{status:429});
    const result=await feedbackRoute.POST(request(body)), data=await result.json();
    assert.equal(result.status,429); assert.equal(data.code,'provider_daily_limit'); assert.equal(data.providerStatus,429);
    assert.doesNotMatch(JSON.stringify(data)+logs.join(''),/PRIVATE|RequestsPerDay/);
    globalThis.fetch=async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]});
    assert.equal((await (await feedbackRoute.POST(request(body))).json()).code,'provider_truncated');
    assert.deepEqual(JSON.parse(readGrammar()[0].document),p);
  } finally { globalThis.fetch=originalFetch; console.error=originalError; }
});
test('state API negotiates grammar snapshots; strict old clients retain their shape', async () => {
  grammarRuntime.user = { userId: 'owner' };
  sqlite.prepare('INSERT INTO grammar_progress VALUES (?,?,?)').run('owner', 'noun', JSON.stringify(initial()));
  const legacy = await (await stateRoute.GET()).json(); assert.equal(legacy.state.grammar, undefined);
  const modern = await (await stateRoute.GET(new Request('https://study.example/api/state', { headers: { 'X-Study-Grammar': '1' } }))).json(); assert.deepEqual(modern.state.grammar, { noun: initial() });
  const oldPut = new Request('https://study.example/api/state', { method: 'PUT', headers: { 'content-type': 'application/json', origin: 'https://study.example' }, body: JSON.stringify({ revision: 0, sessions: {}, progress: {} }) });
  assert.equal((await stateRoute.PUT(oldPut)).status, 200); assert.equal(readGrammar().length, 1);
});
