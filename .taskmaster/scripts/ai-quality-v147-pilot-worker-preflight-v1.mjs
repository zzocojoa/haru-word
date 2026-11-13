// Authenticated routes, current builds and disposable local state. The only
// provider response is a synthetic incomplete envelope, so no quality grade exists.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startSyntheticWorker } from './ai-quality-v147-worker.mjs';

const root = process.cwd();
const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
const out = resolve(evidence, 'phase112');
const sha = raw => createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const fileSha = file => sha(readFileSync(file));
const slotsFile = resolve(evidence, 'phase111/current-generation-bodies.json');
const priorProof = resolve(evidence, 'phase111/progress-final.json');
assert.equal(fileSha(slotsFile), '523c4d5eec65ed472ac99ad48cfe91967082d6ac29abd70c2aa55e2e16145307');
assert.equal(fileSha(priorProof), '0838e54fba54697836abc396728322a884c738d2b3f8b8bfe4615a672493e16b');
const previous = read(priorProof);
assert.equal(previous.pilotGenerationActual, 0);
const previousRecord = read(resolve(root, '.taskmaster/docs/ai-quality-v147-correction-explanation-rebind-v1.json'));
for (const [path, hash] of Object.entries(previousRecord.productFiles)) assert.equal(fileSha(resolve(root, path)), hash);
assert.deepEqual(process.argv.slice(2), process.argv.includes('--smoke') ? ['--smoke'] : ['--all-360']);
const smoke = process.argv[2] === '--smoke';

const slots = read(slotsFile).records;
const builds = {
  baseline: resolve(root, 'work/provider-network-publish-20261105'),
  candidate: resolve(root, 'work/ai-quality-v147-target-display-20261109'),
};
const bodyHash = slot => sha(slot.requestRaw);
assert.equal(slots.length, 360);
assert.equal(new Set(slots.map(s => [s.caseId, s.phase, s.model].join('/'))).size, 360);
assert.ok(slots.every(s => Object.hasOwn(builds, s.phase) && bodyHash(s) === s.requestSha256 && !s.providerDispatched));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format();
const buildFiles = dir => {
  const server = resolve(dir, 'dist/server');
  return Object.fromEntries(readdirSync(server, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
    .map(e => resolve(e.parentPath, e.name)).sort().map(f => [f, fileSha(f)]));
};

async function api(worker, owner, path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json', Origin: worker.base, 'X-Study-Owner': owner,
    'X-Study-AI-Contract': '4', 'X-Study-Grammar': '5', 'X-Study-Feedback-Structure': '1' };
  if (owner) {
    headers['oai-authenticated-user-id'] = owner;
    headers['oai-authenticated-user-email'] = 'pilot-preflight@example.test';
  }
  const response = await fetch(worker.base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000) });
  return { status: response.status, value: await response.json() };
}

async function seed(worker, owner, slot, catalog) {
  const first = await api(worker, owner, '/api/state');
  assert.equal(first.status, 200, 'STATE');
  const { actualInput, domain, lessonId } = slot;
  const { sentence, contextKind, contextNote } = actualInput;
  const timestamp = new Date().toISOString();
  const settings = { ...first.value.state.settings, aiModelId: slot.model, activeSessionId: null };
  const state = { settings, revision: first.value.revision, progress: {}, sessions: {}, grammar: {} };
  const request = { sentence, expectedModelId: slot.model, requestId: randomUUID(), requestStartedAt: Date.now(),
    ...(contextNote ? { contextNote } : {}), ...(contextKind ? { contextKind } : {}) };
  let personal = false;
  if (domain === 'word') {
    const { word, pos, meaning, expression } = actualInput;
    const row = catalog.find(r => r.word === word && r.pos === pos);
    const entryId = row?.id ?? 'personal_' + randomUUID();
    personal = !row;
    const sessionId = randomUUID();
    if (personal) state.progress[entryId] = { meaning, expression,
      personal: { id: entryId, word, headword: word, pos, level: settings.level, page: 0, personal: true } };
    const material = { meaning, expression, example: '', translation: '', source: 'synthetic pilot fixture' };
    const record = { entryId, meaning, en: 'independent', ko: 'independent', sentenceStatus: 'unmeasured', sentence, notes: '', material };
    settings.activeSessionId = sessionId;
    state.sessions[sessionId] = { id: sessionId, kind: 'practice', date, period: date, ids: [entryId], warmupIds: [],
      records: { [entryId]: record }, stage: 'sentence', index: 0, retry: [], retryMode: false, elapsed: 0,
      finished: false, paused: false, createdAt: timestamp };
    Object.assign(request, { sessionId, entryId });
  } else {
    assert.equal(domain, 'grammar');
    const answer = { first: 'Synthetic first answer.', latest: 'Synthetic latest answer.', helped: false, attempts: 1 };
    state.grammar[lessonId] = { stage: 5, sentence, answers: { q1: answer, q2: answer, q3: answer }, contentVersion: 4,
      questionIds: [1, 2, 3].map(n => `${lessonId}:4:base:q${n}`), observation: answer, updatedAt: timestamp };
    Object.assign(request, { lessonId });
  }
  const saved = await api(worker, owner, '/api/state', 'PUT', state);
  assert.equal(saved.status, 200, 'SEED');
  return { request, personal };
}

function safeCode(error) {
  const message = String(error?.message ?? '');
  return /^(?:STATE|SEED|RECEIPT|RETRY|OWNER|MODEL|PROVIDER|BODY|NO_FEEDBACK)$/.test(message.split('\n')[0])
    ? message.split('\n')[0] : 'LOCAL_CHECK';
}

const rows = [], lifecycle = [];
for (const [label, checkout] of Object.entries(builds)) {
  const catalog = read(resolve(checkout, 'data/words.json'));
  const forBuild = slots.filter(s => s.phase === label);
  const firstBy = predicate => forBuild.find(predicate);
  const selected = smoke ? [firstBy(s => s.domain === 'word'), firstBy(s => s.actualInput.word === 'skillfully'),
    firstBy(s => s.domain === 'grammar'), firstBy(s => s.actualInput.contextKind === 'reply')] : forBuild;
  assert.equal(selected.length, smoke ? 4 : 180);
  const hashes = buildFiles(checkout);
  let current = null, captured = null;
  const worker = await startSyntheticWorker({ label, buildSourceRoot: checkout, workspaceRoot: root,
    allowedSentences: [...new Set(selected.map(s => s.actualInput.sentence))],
    respond(body, raw) {
      assert.ok(current && !captured, 'PROVIDER');
      captured = { sha256: sha(raw), matched: raw === current.requestRaw, model: body.model };
      return { model: body.model, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] };
    } });
  try {
    for (const [i, slot] of selected.entries()) {
      const owner = 'aq112-' + randomUUID();
      const row = { id: slot.caseId, profile: label, model: slot.model, domain: slot.domain, lessonId: slot.lessonId,
        contextKind: slot.actualInput.contextKind ?? 'sentence', expectedSha256: slot.requestSha256 };
      const path = slot.domain === 'word' ? '/api/sentence-feedback' : '/api/grammar-feedback';
      captured = null;
      try {
        const { request, personal } = await seed(worker, owner, slot, catalog);
        row.personalWord = personal;
        if (i === 0) {
          const anonymous = await api(worker, '', path, 'POST', request);
          assert.equal(anonymous.status, 401, 'OWNER');
          const wrongModel = await api(worker, owner, path, 'POST', { ...request, expectedModelId: slot.model === 'gpt-6.1-sol' ? 'gpt-6.1-terra' : 'gpt-6.1-sol' });
          assert.equal(wrongModel.status, 409, 'MODEL');
          assert.equal(wrongModel.value.code, 'model_changed', 'MODEL');
          assert.equal(captured, null, 'PROVIDER');
          row.preTransportControls = 2;
        }
        current = slot;
        const reply = await api(worker, owner, path, 'POST', request);
        row.status = reply.status;
        row.code = reply.value.code ?? null;
        row.observedSha256 = captured?.sha256 ?? null;
        assert.ok(captured?.matched && captured.model === slot.model, 'BODY');
        assert.equal(reply.status, 502, 'NO_FEEDBACK');
        assert.equal(reply.value.code, 'provider_truncated', 'NO_FEEDBACK');
        assert.ok(!reply.value.feedback && reply.value.receipt?.persisted && reply.value.receipt?.state === 'failed', 'RECEIPT');
        current = null;
        const receiptPath = '/api/feedback-requests/' + request.requestId;
        const recovered = await api(worker, owner, receiptPath);
        assert.equal(recovered.value.receipt?.state, 'failed', 'RECEIPT');
        assert.equal(recovered.value.code, reply.value.code, 'RECEIPT');
        const duplicate = await api(worker, owner, path, 'POST', request);
        assert.equal(duplicate.status, reply.status, 'RETRY');
        assert.equal(duplicate.value.code, reply.value.code, 'RETRY');
        assert.equal(worker.providerRecords.length, rows.filter(r => r.profile === label && r.observedSha256).length + 1, 'RETRY');
        const foreign = await api(worker, 'aq112-foreign', receiptPath);
        assert.ok([404, 409].includes(foreign.status) && !foreign.value.feedback, 'OWNER');
        row.verified = true;
      } catch (error) {
        row.verified = false;
        row.failure = safeCode(error);
        row.observedSha256 ??= captured?.sha256 ?? null;
      } finally { current = null; }
      rows.push(row);
    }
  } finally { await worker.stop(); }
  assert.deepEqual(buildFiles(checkout), hashes);
  lifecycle.push({ label, buildFiles: hashes, captured: worker.providerRecords.length,
    stopped: true, providerEgress: worker.proof.realProviderEgress });
}
const checked = rows.filter(r => r.verified);
const result = { protocol: 'ai-quality-v147-pilot-worker-preflight-v1', mode: smoke ? 'smoke' : 'all-360',
  slots: rows.length, verified: checked.length, failed: rows.length - checked.length,
  publicCatalogueSlots: checked.filter(r => r.domain === 'word' && !r.personalWord).length,
  personalWordSlots: checked.filter(r => r.personalWord).length, grammarSlots: checked.filter(r => r.domain === 'grammar').length,
  newProviderCalls: 0, actualCountApiCalls: 0, actualKeyReads: 0, mainDispatchAuthorized: false,
  pilotGenerationActual: 0, sourceBodiesSha256: fileSha(slotsFile), previousProofSha256: fileSha(priorProof), rows, lifecycle };
const summary = { ...result };
delete summary.rows;
delete summary.lifecycle;
const file = resolve(out, smoke ? 'smoke.json' : 'worker-preflight.json');
writeFileSync(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
if (result.failed) process.exitCode = 1;
