// Local transport/rendering regression. Synthetic responses never certify English quality.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {startSyntheticWorker} from './ai-quality-v147-worker.mjs';
import {compileAiPanel, validateAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {productRubricPolicyV1} from './ai-quality-v147-product-rubric-v1.mjs';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const ROOT = read(resolve(SOURCE, '.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot;
assert.ok(process.env.QA_OUTPUT_DIR, 'QA_OUTPUT_DIR must name a new owned evidence directory');
const OUT = resolve(process.env.QA_OUTPUT_DIR);
mkdirSync(OUT, {recursive: false});
const require = createRequire(resolve(SOURCE, 'package.json'));
const sha = v => createHash('sha256').update(v).digest('hex');
const fileSha = f => sha(readFileSync(f));
const save = (f, v) => writeFileSync(resolve(OUT, f), JSON.stringify(v, null, 2) + '\n', {flag: 'wx'});
const visible = f => Object.fromEntries(['original', 'meaningUsage', 'grammar', 'correctedSentence', 'explanation'].map(k => [k, f[k]]));
const models = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra'];
const questions = {
  message: '짧은 답변·제목인가요, 아니면 누가 무엇을 하는지 나타내는 문장을 쓰려던 건가요? 의도한 문맥을 알려 주세요.',
  time: '이미 일어난 일을 말하나요, 앞으로 일어날 일을 말하나요? 의도한 시점을 알려 주세요.',
  quantity: '하나를 말하나요, 여러 개를 말하나요? 의도한 수량을 알려 주세요.',
  target_meaning: '오늘 목표로 어떤 뜻·용법을 의도했나요? 뜻이나 사용 문맥을 알려 주세요.',
  relationship: '앞뒤 내용에서 각각 무슨 일이 일어나고, 어떤 관계로 이어지는지 알려 주세요.',
  selected: '선택한 표현 형식에서 구체적으로 어떤 내용을 전하려는지 알려 주세요.',
};
const cases = [
  {id: 'none', sentence: 'I can help.', kind: 'none'},
  ...['message', 'time', 'quantity', 'target_meaning', 'relationship'].map(kind => ({id: kind, sentence: 'I can help.', kind})),
  {id: 'fragment-message', sentence: 'music', kind: 'message', override: true},
  {id: 'fragment-relationship', sentence: 'Although the soup', kind: 'relationship', override: true},
  ...['reply', 'title', 'command'].map(contextKind => ({id: 'selected-' + contextKind, sentence: 'I can help.', kind: 'message', contextKind})),
];
const expectedQuestion = c => c.kind === 'none' ? '' : questions[c.contextKind ? 'selected' : c.kind];
const buildRoot = resolve(ROOT, 'work/ai-quality-v147-product-build-20261106-phase18-final');
const sourceFiles = read(resolve(ROOT, 'outputs/ai-quality-v147-implementation-20261106/phase18e/source-before.json'));
const buildFiles = read(resolve(ROOT, 'outputs/ai-quality-v147-implementation-20261106/phase18e/candidate-build-files.json'));
function verifyProduct() {
  for (const [f, h] of Object.entries(sourceFiles)) {
    assert.equal(fileSha(resolve(SOURCE, f)), h, f);
    assert.equal(fileSha(resolve(buildRoot, f)), h, f);
  }
  assert.equal(buildFiles.count, 407);
  for (const [f, h] of Object.entries(buildFiles.files)) assert.equal(fileSha(resolve(buildRoot, f)), h, f);
}
function tree(dir) {
  const result = {};
  function walk(p) {
    for (const e of readdirSync(p, {withFileTypes: true})) {
      assert.equal(e.isSymbolicLink(), false);
      const f = resolve(p, e.name);
      if (e.isDirectory()) walk(f);
      else result[f.slice(dir.length + 1).replaceAll('\\', '/')] = fileSha(f);
    }
  }
  walk(dir); return result;
}
verifyProduct();
const bundleFile = resolve(OUT, 'actual-components.mjs');
const built = await require('esbuild').build({absWorkingDir: SOURCE, stdin: {
  contents: "export {parseJudgmentFeedback} from './lib/judgment-feedback-contract';export {FeedbackDetail} from './app/feedback-detail';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';",
  resolveDir: SOURCE, loader: 'tsx',
}, outfile: bundleFile, bundle: true, platform: 'node', format: 'esm', external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'], jsx: 'automatic', logLevel: 'silent', metafile: true});
const runtime = await import(pathToFileURL(bundleFile));
const componentSources = Object.fromEntries(Object.keys(built.metafile.inputs).filter(f => f !== '<stdin>').map(f => [f, fileSha(resolve(SOURCE, f))]));
save('component-bindings.json', {bundleSha256: fileSha(bundleFile), sources: componentSources});
let worker, active = null;
const rows = [], browserResults = [];
const stamp = new Date().toISOString();
const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const word = read(resolve(SOURCE, 'data/words.json')).find(w => w.word === 'help' && w.pos === 'n.');
const material = read(resolve(SOURCE, 'data/content.json'))[word.id];
function payload(c) {
  const natural = c.kind === 'none' || c.override;
  return {meaningUsage: natural ? 'appropriate' : 'uncertain', grammar: natural ? 'natural' : 'uncertain', correctedSentence: natural ? c.sentence : '',
    targetReason: 'SYNTHETIC_MODEL_REASON_NOT_VISIBLE', grammarReason: 'SYNTHETIC_MODEL_REASON_NOT_VISIBLE', correctionReason: '', contextNeeded: natural ? 'none' : c.kind};
}
async function api(owner, path, method = 'GET', body) {
  const response = await fetch(worker.base + path, {method, headers: {'Content-Type': 'application/json', Origin: worker.base,
    'oai-authenticated-user-id': owner, 'oai-authenticated-user-email': 'question-regression@example.test', 'X-Study-Owner': owner,
    'X-Study-AI-Contract': '4', 'X-Study-Grammar': '5', 'X-Study-Feedback-Structure': '1'},
  ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(45000)});
  const value = await response.json();
  assert.equal(response.status, 200, 'synthetic API ' + path + ': ' + JSON.stringify(value));
  return value;
}
try {
  worker = await startSyntheticWorker({label: 'candidate', buildSourceRoot: buildRoot, workspaceRoot: ROOT,
    allowedSentences: cases.map(c => c.sentence), respond: body => {
      assert.ok(active, 'unexpected synthetic provider request');
      active.input = JSON.parse(body.input[0].content);
      assert.equal(active.input.sentence, active.c.sentence);
      assert.equal(active.input.contextKind ?? 'sentence', active.c.contextKind ?? 'sentence');
      return {id: 'resp_synthetic_question_' + randomUUID().replaceAll('-', ''), object: 'response', model: body.model, status: 'completed',
        output: [{type: 'message', role: 'assistant', status: 'completed', content: [{type: 'output_text', text: JSON.stringify(payload(active.c))}]}],
        usage: {input_tokens: 100, output_tokens: 80, output_tokens_details: {reasoning_tokens: 0}}};
    }});
  for (const domain of ['word', 'grammar']) for (const model of models) for (const c of cases) {
    const owner = 'synthetic-question-' + randomUUID(), id = randomUUID(), requestId = randomUUID();
    const initial = await api(owner, '/api/state');
    const session = {id, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], records: {[word.id]: {
      entryId: word.id, meaning: material.meaning, familiarity: 'uncertain', en: 'independent', ko: 'independent', enAnswer: 'Synthetic first answer.', koAnswer: '합성 첫 답',
      sentenceStatus: 'unmeasured', sentence: c.sentence, notes: '', learnedOn: date, lastPracticedOn: date, material,
    }}, stage: 'sentence', index: 0, retry: [], retryMode: false, elapsed: 10, finished: false, paused: false, createdAt: stamp};
    const answer = {first: '합성 첫 답', latest: '합성 마지막 답', helped: false, attempts: 1};
    const grammar = {stage: 5, sentence: c.sentence, answers: {q1: answer, q2: answer, q3: answer}, contentVersion: 4,
      questionIds: [1, 2, 3].map(n => 'auxiliary:4:base:q' + n), observation: answer, completedAt: stamp,
      schedule: {lastDate: date, passed: 2, nextSet: 'b', used: {a: 1, b: 1}},
      review: {contentVersion: 4, questionIds: [1, 2, 3].map(n => 'auxiliary:4:a:q' + n), setId: 'a', mode: 'extra', startedOn: date, index: 3, answers: {q1: answer, q2: answer, q3: answer}, completedAt: stamp}, updatedAt: stamp};
    await api(owner, '/api/state', 'PUT', {revision: initial.revision, settings: {...initial.state.settings, level: word.level, dailyGoal: 1, aiModelId: model, activeSessionId: domain === 'word' ? id : null},
      progress: {}, sessions: domain === 'word' ? {[id]: session} : {}, grammar: domain === 'grammar' ? {auxiliary: grammar} : {}});
    const seeded = await api(owner, '/api/state'), before = worker.providerRecords.length;
    const path = '/api/' + (domain === 'word' ? 'sentence' : 'grammar') + '-feedback';
    const request = {...(domain === 'word' ? {sessionId: id, entryId: word.id} : {lessonId: 'auxiliary'}), sentence: c.sentence, expectedModelId: model,
      requestId, requestStartedAt: Date.now(), ...(c.contextKind ? {contextKind: c.contextKind} : {})};
    active = {c};
    const result = await api(owner, path, 'POST', request), input = active.input;
    active = null;
    const expected = runtime.parseJudgmentFeedback(JSON.stringify(payload(c)), c.sentence, model, input);
    assert.deepEqual(visible(result.feedback), visible(expected));
    const question = expectedQuestion(c);
    assert.equal(result.feedback.explanation.includes('추가 문맥: '), !!question);
    if (question) assert.ok(result.feedback.explanation.endsWith('추가 문맥: ' + question), c.id);
    assert.equal(result.feedback.explanation.includes('SYNTHETIC_MODEL_REASON_NOT_VISIBLE'), false);
    const recovered = await api(owner, '/api/feedback-requests/' + requestId);
    assert.deepEqual(recovered.feedback, result.feedback);
    assert.deepEqual((await api(owner, path, 'POST', request)).feedback, result.feedback);
    assert.equal(worker.providerRecords.length, before + 1, 'same UUID must not resend');
    const pending = await api(owner, '/api/state'), mutation = {revision: pending.revision, progress: {}};
    if (domain === 'word') {
      const session = structuredClone(pending.state.sessions[id]); session.records[word.id].aiFeedback = result.feedback; mutation.sessions = {[id]: session};
    } else {
      const progress = structuredClone(pending.state.grammar); progress.auxiliary.feedback = result.feedback; mutation.sessions = {}; mutation.grammar = progress;
    }
    await api(owner, '/api/state', 'PUT', mutation);
    const state = await api(owner, '/api/state');
    const saved = domain === 'word' ? state.state.sessions[id].records[word.id] : state.state.grammar.auxiliary;
    const savedFeedback = domain === 'word' ? saved.aiFeedback : saved.feedback;
    assert.deepEqual(savedFeedback, result.feedback);
    const original = domain === 'word' ? seeded.state.sessions[id].records[word.id] : seeded.state.grammar.auxiliary;
    const {aiFeedback: _wordFeedback, feedback: _grammarFeedback, ...rest} = saved;
    void _wordFeedback; void _grammarFeedback;
    assert.deepEqual(rest, original, 'saving feedback must preserve other learner fields');
    rows.push({id: domain + '/' + model + '/' + c.id, domain, model, caseId: c.id, question, input, feedback: savedFeedback,
      providerRequestSha256: worker.providerRecords.at(-1).bodySha256, receiptRequeried: true, stateRequeried: true, sameUuidProviderAdded: 0,
      modelSuppliedContext: !c.override && c.kind !== 'none', applicationOverride: !!c.override});
  }
  assert.equal(rows.length, 66);
  assert.equal(worker.providerRecords.length, 66);
  const contract = read(resolve(SOURCE, '.taskmaster/docs/ai-quality-v147-decision-contract-v4.json'));
  contract.productOperationalRubric = productRubricPolicyV1();
  const witnesses = read(resolve(SOURCE, '.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json')).witnesses;
  const observations = rows.map(row => ({id: row.id, generatorId: row.model, phase: 'candidate', caseId: row.caseId, familyId: 'synthetic-question-' + row.caseId,
    domain: row.domain, stratum: row.question ? 'insufficientContext' : 'normal', parentReceiptHash: row.providerRequestSha256,
    input: {sentence: row.input.sentence, target: 'Synthetic transport check only', ...(row.input.contextKind ? {contextKind: row.input.contextKind} : {})},
    feedback: row.feedback, reference: {level: 'unresolved', criterion: 'Transport/rendering witness, not English truth.', sources: []}}));
  const plan = compileAiPanel({runId: randomUUID(), observations, witnesses, contract, salt: Buffer.alloc(32, 41)});
  assert.equal(validateAiPanel(plan), true);
  const reviewSlots = plan.slots.filter(s => s.kind === 'review');
  assert.equal(reviewSlots.length, 264);
  function compareSlot(slot, row) {
    const data = JSON.parse(JSON.parse(slot.raw).input[0].content).EVALUATION_DATA;
    assert.deepEqual(data.feedback, visible(row.feedback));
    assert.equal(data.input.sentence, row.input.sentence);
  }
  for (const slot of reviewSlots) compareSlot(slot, rows.find(r => r.id === slot.privateBinding.sourceId));
  // A validly compiled but truncated parent is the negative transport comparator.
  // This verifies this regression's sensitivity, not a new production runtime guard.
  const victim = observations.find(o => o.caseId === 'time');
  const truncated = structuredClone(victim); truncated.feedback.explanation = truncated.feedback.explanation.split('\n추가 문맥: ')[0];
  const mutant = compileAiPanel({runId: randomUUID(), observations: [truncated], witnesses, contract, salt: Buffer.alloc(32, 41)});
  assert.throws(() => compareSlot(mutant.slots.find(s => s.kind === 'review'), rows.find(r => r.id === victim.id)), {code: 'ERR_ASSERTION'});
  save('panel-wires.json', {plan, truncatedComparatorCaught: true, actualPanelModelCalls: 0});
  save('worker-rows.json', rows);
  save('provider-records.json', worker.providerRecords);
  const longFeedback = {...rows.find(r => r.question).feedback};
  longFeedback.explanation += '\n' + '합성 긴 기록 표시 검사. '.repeat(30);
  const renderRows = [...rows, {id: 'component-only/long-disclosure', domain: 'word', feedback: longFeedback, question: rows.find(r => r.question).question}];
  const html = '<!doctype html><meta charset="utf-8"><title>Synthetic feedback regression</title>' + renderRows.map((r, i) => '<article data-row="' + i + '">' + runtime.renderToStaticMarkup(runtime.createElement(runtime.FeedbackDetail, {feedback: r.feedback, grammarTarget: r.domain === 'grammar'})) + '</article>').join('');
  writeFileSync(resolve(OUT, 'rendered-components.html'), html, {flag: 'wx'});
  const playwright = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
  for (const engine of ['chromium', 'webkit']) {
    const browser = await playwright[engine].launch({headless: true});
    try {
      const page = await browser.newPage(); let externalRequests = 0;
      await page.route('**/*', route => { externalRequests++; return route.abort(); });
      await page.setContent(html);
      await page.locator('article').first().waitFor();
      assert.equal(await page.locator('article').count(), 67);
      const long = page.locator('[data-row="66"]');
      assert.equal(await long.locator('details[open]').count(), 0);
      assert.equal(await long.getByText(longFeedback.explanation, {exact: true}).isVisible(), false);
      for (const summary of await page.locator('details > summary').all()) await summary.click();
      for (const [i, row] of renderRows.entries()) {
        const article = page.locator('[data-row="' + i + '"]');
        const explanation = article.getByText(row.feedback.explanation, {exact: true});
        assert.equal(await explanation.textContent(), row.feedback.explanation);
        assert.equal(await explanation.isVisible(), true);
        if (row.question) assert.ok((await article.innerText()).includes(row.question));
      }
      assert.equal(externalRequests, 0);
      const mutantHtml = html.replaceAll(questions.time, '');
      await page.setContent(mutantHtml);
      const victimIndex = renderRows.findIndex(r => r.caseId === 'time');
      assert.equal((await page.locator('[data-row="' + victimIndex + '"]').innerText()).includes(questions.time), false);
      browserResults.push({engine, renderedWorkerRows: 66, longDisclosureComponentOnly: 1, expandedTextExact: true, removedQuestionComparatorCaught: true, externalRequests});
    } finally { await browser.close(); }
  }
  await worker.stop();
  const persist = resolve(ROOT, worker.proof.persist);
  const lifecycle = {...worker.proof, stopped: true, persistAbsoluteRoot: persist, persistFiles: tree(persist)};
  verifyProduct();
  const result = {passed: true, nodeVersion: process.version, task: '34.3', syntheticOnly: true, workerCells: 66,
    questionCases: cases.length, domains: 2, modelAliases: 3, reviewWires: 264, reviewOrders: 2,
    questionsAlreadyEmbeddedInExplanation: true, separateQuestionWidgetExists: false,
    rawContextEnumForwardedSeparately: false, questionOmissionObserved: false,
    parserReceiptStateAndJudgeProjectionExact: true, truncatedParentComparatorCaught: true,
    browsers: browserResults, productSourceFilesUnchanged: Object.keys(sourceFiles).length, candidateBuildFilesUnchanged: 407,
    actualProviderCalls: 0, actualCountCalls: 0, actualKeyReads: 0, actualEnglishQualityMeasured: false,
    fullLearnerApplicationFlowVerified: false, productionQaPerformed: false, releaseEligible: false, lifecycle};
  save('results.json', result); console.log(JSON.stringify({passed: true, nodeVersion: process.version, workerCells: 66, reviewWires: 264, browserRowsEach: 67, actualProviderCalls: 0, actualCountCalls: 0, actualKeyReads: 0}));
} catch (error) {
  save('failure.json', {passed: false, error: String(error), stack: error.stack, workerRowsCompleted: rows.length, browserResults,
    actualProviderCalls: 0, actualCountCalls: 0, actualKeyReads: 0});
  throw error;
} finally { await worker?.stop(); }
