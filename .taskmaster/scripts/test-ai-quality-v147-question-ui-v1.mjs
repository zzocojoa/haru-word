// Actual built learner UI -> Worker -> synthetic Responses -> client save/reload.
// This checks transport and state, never real model accuracy or production auth.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {startSyntheticWorker} from './ai-quality-v147-worker.mjs';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), read = f => JSON.parse(readFileSync(f, 'utf8'));
const ROOT = read(resolve(SOURCE, '.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot;
const BUILD = resolve(ROOT, 'work/ai-quality-v147-product-build-20261106-phase18-final');
assert.ok(process.env.QA_OUTPUT_DIR, 'new QA_OUTPUT_DIR required');
const OUT = resolve(process.env.QA_OUTPUT_DIR); mkdirSync(OUT, {recursive: false});
const save = (f, v) => writeFileSync(resolve(OUT, f), JSON.stringify(v, null, 2) + '\n', {flag: 'wx'});
const sha = v => createHash('sha256').update(v).digest('hex'), fileSha = f => sha(readFileSync(f));
const require = createRequire(resolve(SOURCE, 'package.json')), playwright = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
const SENTENCE = 'You might brought a torch.', CORRECTION = 'You might bring a torch.';
const QUESTION = '이미 일어난 일을 말하나요, 앞으로 일어날 일을 말하나요? 의도한 시점을 알려 주세요.';
const NOTE = '앞으로 일어날 일의 가능성을 말하는 답변이에요.';
const MODELS = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra'];
const sourceFiles = read(resolve(ROOT, 'outputs/ai-quality-v147-implementation-20261106/phase18e/source-before.json'));
const buildFiles = read(resolve(ROOT, 'outputs/ai-quality-v147-implementation-20261106/phase18e/candidate-build-files.json'));
function verifyProduct() {
  for (const [f, h] of Object.entries(sourceFiles)) for (const base of [SOURCE, BUILD]) assert.equal(fileSha(resolve(base, f)), h, f);
  for (const [f, h] of Object.entries(buildFiles.files)) assert.equal(fileSha(resolve(BUILD, f)), h, f);
}
function tree(root) {
  const files = {};
  function walk(dir) {
    for (const e of readdirSync(dir, {withFileTypes: true})) {
      assert.equal(e.isSymbolicLink(), false); const f = resolve(dir, e.name);
      if (e.isDirectory()) walk(f); else files[f.slice(root.length + 1).replaceAll('\\', '/')] = fileSha(f);
    }
  }
  walk(root); return files;
}
verifyProduct();
const word = read(resolve(SOURCE, 'data/words.json')).find(w => w.word === 'help' && w.pos === 'n.');
const material = read(resolve(SOURCE, 'data/content.json'))[word.id];
const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const stamp = new Date().toISOString(), rows = [], envelopes = [];
let worker, browser, context, page, step = 'start';
async function api(owner, path, method = 'GET', body) {
  const response = await fetch(worker.base + path, {method, headers: {'Content-Type': 'application/json', Origin: worker.base,
    'oai-authenticated-user-id': owner, 'oai-authenticated-user-email': 'ui-question@example.test', 'X-Study-Owner': owner,
    'X-Study-AI-Contract': '4', 'X-Study-Grammar': '5', 'X-Study-Feedback-Structure': '1'},
  ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(45000)});
  const value = await response.json(); assert.equal(response.status, 200, path + ': ' + JSON.stringify(value)); return value;
}
async function seed(owner, model, domain) {
  const initial = await api(owner, '/api/state'), id = randomUUID();
  const answer = {first: '합성 첫 답', latest: '합성 마지막 답', helped: false, attempts: 1};
  const session = {id, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], records: {[word.id]: {
    entryId: word.id, meaning: material.meaning, familiarity: 'uncertain', en: 'independent', ko: 'independent', enAnswer: 'Synthetic first answer.', koAnswer: '합성 첫 답',
    sentenceStatus: 'unmeasured', sentence: SENTENCE, notes: '', learnedOn: date, lastPracticedOn: date, material,
  }}, stage: 'sentence', index: 0, retry: [], retryMode: false, elapsed: 10, finished: false, paused: false, createdAt: stamp};
  const grammar = {stage: 5, sentence: SENTENCE, answers: {q1: answer, q2: answer, q3: answer}, contentVersion: 4,
    questionIds: [1, 2, 3].map(n => 'auxiliary:4:base:q' + n), observation: answer, completedAt: stamp,
    schedule: {lastDate: date, passed: 2, nextSet: 'b', used: {a: 1, b: 1}},
    review: {contentVersion: 4, questionIds: [1, 2, 3].map(n => 'auxiliary:4:a:q' + n), setId: 'a', mode: 'extra', startedOn: date, index: 3, answers: {q1: answer, q2: answer, q3: answer}, completedAt: stamp}, updatedAt: stamp};
  await api(owner, '/api/state', 'PUT', {revision: initial.revision, settings: {...initial.state.settings, level: word.level, dailyGoal: 1, aiModelId: model, activeSessionId: domain === 'word' ? id : null},
    progress: {}, sessions: domain === 'word' ? {[id]: session} : {}, grammar: domain === 'grammar' ? {auxiliary: grammar} : {}});
  return {id, state: (await api(owner, '/api/state')).state};
}
async function openWriting(domain) {
  await page.goto(worker.base); await page.getByText('저장됨', {exact: true}).first().waitFor();
  if (domain === 'word') {
    if (!await page.getByLabel('내 영어 문장', {exact: true}).isVisible()) await page.getByRole('button', {name: '중단한 학습 이어서', exact: false}).click();
    await page.getByLabel('내 영어 문장', {exact: true}).waitFor();
  } else {
    await page.getByRole('tab', {name: '단어장', exact: true}).click();
    await page.getByRole('tab', {name: '품사와 문장 연습', exact: true}).click();
    const tile = page.locator('.grammar-tile').filter({hasText: '기본 조동사'});
    if (!await tile.isVisible()) await page.locator('details.grammar-group').filter({hasText: '동사를 돕는 표현'}).locator('summary').click();
    await tile.click(); await page.getByRole('textbox', {name: '내 문장', exact: true}).waitFor();
  }
}
const feedbackIn = (state, domain, id) => domain === 'word' ? state.sessions[id].records[word.id].aiFeedback : state.grammar.auxiliary.feedback;
async function stored(owner, domain, id, expectedFeedback) {
  for (const end = Date.now() + 15000; ;) {
    const snapshot = await api(owner, '/api/state');
    if (isDeepStrictEqual(feedbackIn(snapshot.state, domain, id), expectedFeedback)) return snapshot;
    assert.ok(Date.now() < end, 'client feedback save timed out');
    await page.waitForTimeout(50);
  }
}
async function expandFeedback() {
  const result = page.locator('.ai-feedback-result').first(); await result.waitFor();
  for (const summary of await result.locator('details.record-text:not([open]) > summary').all()) await summary.click();
  return result;
}
function protectedFields(before, after, domain, id) {
  const a = domain === 'word' ? before.sessions[id].records[word.id] : before.grammar.auxiliary;
  const b = domain === 'word' ? after.sessions[id].records[word.id] : after.grammar.auxiliary;
  const keys = domain === 'word' ? ['entryId', 'familiarity', 'en', 'ko', 'enAnswer', 'koAnswer', 'sentence', 'sentenceStatus', 'notes', 'learnedOn', 'lastPracticedOn', 'material']
    : ['stage', 'answers', 'observation', 'completedAt', 'schedule', 'review', 'sentence', 'contentVersion', 'questionIds'];
  for (const k of keys) assert.deepEqual(b[k], a[k], k); return keys;
}
try {
  worker = await startSyntheticWorker({label: 'candidate', buildSourceRoot: BUILD, workspaceRoot: ROOT, allowedSentences: [SENTENCE], respond: body => {
    const input = JSON.parse(body.input[0].content), resolved = input.contextNote === NOTE;
    assert.ok(!input.contextNote || resolved, 'unexpected synthetic context');
    const payload = {meaningUsage: 'needs_work', grammar: resolved ? 'needs_work' : 'uncertain', correctedSentence: resolved ? CORRECTION : '',
      targetReason: '합성 목표 검토', grammarReason: '합성 문법 검토', correctionReason: resolved ? '합성 최소 교정' : '', contextNeeded: resolved ? 'none' : 'time'};
    const envelope = {id: 'resp_synthetic_ui_' + randomUUID().replaceAll('-', ''), object: 'response', model: body.model, status: 'completed',
      output: [{type: 'message', role: 'assistant', status: 'completed', content: [{type: 'output_text', text: JSON.stringify(payload)}]}], usage: {input_tokens: 100, output_tokens: 80}};
    envelopes.push({requestRaw: JSON.stringify(body), responseRaw: JSON.stringify(envelope)}); return envelope;
  }});
  for (const engine of ['chromium', 'webkit']) {
    browser = await playwright[engine].launch({headless: true});
    for (const model of MODELS) for (const domain of ['word', 'grammar']) {
      step = engine + '/' + model + '/' + domain;
      const owner = 'synthetic-ui-question-' + randomUUID(), seeded = await seed(owner, model, domain), before = worker.providerRecords.length;
      context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', extraHTTPHeaders: {
        'oai-authenticated-user-id': owner, 'oai-authenticated-user-email': 'ui-question@example.test',
      }});
      const errors = [], blocked = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== worker.base) { blocked.push(new URL(route.request().url()).origin); return route.abort(); }
        return route.continue();
      });
      page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
      await openWriting(domain); assert.equal(worker.providerRecords.length, before, 'opening must not generate');
      const endpoint = worker.base + '/api/' + (domain === 'word' ? 'sentence' : 'grammar') + '-feedback';
      const button = () => domain === 'word' ? page.locator('section[aria-label="AI 참고 의견"]').getByRole('button', {name: /^AI 참고 의견 (?:다시 )?요청$/}) : page.locator('.grammar-ai-action').getByRole('button', {name: 'AI 참고 의견 요청', exact: true});
      async function clickRequest() {
        const pending = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST');
        await button().click(); const response = await pending; assert.equal(response.status(), 200);
        const request = response.request().postDataJSON(), value = await response.json();
        assert.match(request.expectedContextFingerprint, /^[a-f0-9]{64}$/);
        assert.equal(request.expectedModelId, model); return {request, value};
      }
      const first = await clickRequest(); assert.equal(worker.providerRecords.length, before + 1);
      const firstState = await stored(owner, domain, seeded.id, first.value.feedback);
      assert.ok((await (await expandFeedback()).innerText()).includes(QUESTION));
      assert.equal(first.value.feedback.correctedSentence, '');
      await page.screenshot({path: resolve(OUT, engine + '-' + model + '-' + domain + '-question.png'), fullPage: true});
      await page.getByText('AI에 전달할 문맥 추가 · 선택', {exact: true}).click();
      await page.getByRole('textbox', {name: '문장 상황', exact: true}).fill(NOTE);
      await page.getByRole('combobox', {name: '문장의 형식', exact: true}).selectOption('reply');
      assert.equal(worker.providerRecords.length, before + 1, 'editing context must not generate');
      const second = await clickRequest(); assert.equal(worker.providerRecords.length, before + 2);
      assert.notEqual(second.request.requestId, first.request.requestId);
      assert.notEqual(second.request.expectedContextFingerprint, first.request.expectedContextFingerprint);
      assert.equal(second.request.contextNote, NOTE); assert.equal(second.request.contextKind, 'reply');
      const providerInput = JSON.parse(JSON.parse(worker.providerRecords.at(-1).body).input[0].content);
      assert.equal(providerInput.contextNote, NOTE); assert.equal(providerInput.contextKind, 'reply');
      const secondState = await stored(owner, domain, seeded.id, second.value.feedback);
      const feedback = feedbackIn(secondState.state, domain, seeded.id); assert.deepEqual(feedback, second.value.feedback);
      assert.equal(feedback.correctedSentence, CORRECTION);
      assert.equal((await (await expandFeedback()).innerText()).includes(QUESTION), false);
      assert.deepEqual((await api(owner, '/api/feedback-requests/' + first.request.requestId)).feedback, first.value.feedback);
      assert.deepEqual((await api(owner, '/api/feedback-requests/' + second.request.requestId)).feedback, feedback);
      const protectedKeys = protectedFields(seeded.state, firstState.state, domain, seeded.id);
      protectedFields(seeded.state, secondState.state, domain, seeded.id);
      await openWriting(domain);
      const result = await expandFeedback(); assert.ok((await result.innerText()).includes(feedback.explanation));
      assert.equal((await result.innerText()).includes(QUESTION), false);
      const details = page.locator('details.notes-details').filter({has: page.locator('textarea[maxlength="500"]')});
      if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
      assert.equal(await page.getByRole('textbox', {name: '문장 상황', exact: true}).inputValue(), NOTE);
      assert.equal(await page.getByRole('combobox', {name: '문장의 형식', exact: true}).inputValue(), 'reply');
      assert.equal(worker.providerRecords.length, before + 2, 'reload must not generate');
      const reloaded = await api(owner, '/api/state'); assert.deepEqual(feedbackIn(reloaded.state, domain, seeded.id), feedback);
      protectedFields(seeded.state, reloaded.state, domain, seeded.id); assert.deepEqual(errors, []);
      await page.screenshot({path: resolve(OUT, engine + '-' + model + '-' + domain + '-reloaded.png'), fullPage: true});
      rows.push({engine, model, domain, firstRequestId: first.request.requestId, secondRequestId: second.request.requestId,
        firstFingerprint: first.request.expectedContextFingerprint, secondFingerprint: second.request.expectedContextFingerprint,
        questionVisible: true, contextKindAndNoteForwarded: true, contextEditGenerated: 0, reloadGenerated: 0, clientSavedAndReloaded: true,
        oldAndNewReceiptsPreserved: true, protectedKeys, pageErrors: errors, blockedOrigins: [...new Set(blocked)], syntheticProviderResponses: 2});
      await context.close(); context = null; page = null;
    }
    await browser.close(); browser = null;
  }
  assert.equal(rows.length, 12); assert.equal(worker.providerRecords.length, 24); assert.equal(envelopes.length, 24);
  save('ui-rows.json', rows); save('provider-records.json', worker.providerRecords); save('provider-envelopes.json', envelopes);
  await worker.stop(); const persist = resolve(ROOT, worker.proof.persist); verifyProduct();
  save('results.json', {passed: true, nodeVersion: process.version, task: '34.3', uiJourneys: 12, engines: ['chromium', 'webkit'], domains: 2, modelAliases: 3,
    syntheticProviderResponses: 24, actualProviderCalls: 0, actualCountCalls: 0, actualKeyReads: 0, actualEnglishQualityMeasured: false,
    testedFullLearnerRequestContextRecheckReload: true, allLearnerUiCoverageVerified: false, productionAuthVerified: false, physicalIphoneVoiceOver: false,
    productSourceFilesUnchanged: Object.keys(sourceFiles).length, buildFilesUnchanged: buildFiles.count, goalComplete: false,
    lifecycle: {...worker.proof, stopped: true, persistAbsoluteRoot: persist, persistFiles: tree(persist)}});
  console.log(JSON.stringify({passed: true, nodeVersion: process.version, uiJourneys: 12, syntheticProviderResponses: 24, actualProviderCalls: 0}));
} catch (error) {
  if (page) try { await page.screenshot({path: resolve(OUT, 'failure.png'), fullPage: true}); writeFileSync(resolve(OUT, 'failure-page.txt'), await page.locator('body').innerText()); } catch { /* retain original error */ }
  save('failure.json', {passed: false, step, error: String(error), stack: error.stack, completedJourneys: rows, actualProviderCalls: 0, workerProfile: worker?.proof});
  save('provider-envelopes-failure.json', envelopes);
  throw error;
} finally { await context?.close(); await browser?.close(); await worker?.stop(); }
