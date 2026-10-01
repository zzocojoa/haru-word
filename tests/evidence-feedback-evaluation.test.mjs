import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { assertEvidenceLiveArguments, validateEvidenceAuthorization, validateEvidenceParents, validateEvidenceComparison, collectEvidenceComparison, evidenceReviewBundle } from '../scripts/evaluate-evidence-feedback.mjs';
import { originalComparisonFixture } from '../scripts/evaluate-original-feedback.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), textHash = v => createHash('sha256').update(v.replace(/\r\n/g, '\n')).digest('hex');
mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/evidence-evaluation-tests-'));
async function bundle(entry, name) {
  const file = resolve(directory, name + '.mjs');
  await build({ entryPoints: [entry], outfile: file, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'mock-env', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const env=globalThis.__evidenceEvaluationEnv;', loader: 'js' }));
  } }] });
  return import(pathToFileURL(file).href);
}
globalThis.__evidenceEvaluationEnv = {};
const helper = await bundle('lib/evidence-feedback-evaluation.ts', 'helper'), legacy = await bundle('lib/free-feedback-evaluation.ts', 'legacy');
const wireHelper = await bundle('lib/evidence-feedback.ts', 'wire'), api = await bundle('app/api/english-accuracy-evaluation/route.ts', 'route');
const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'), frozen = JSON.parse(readFileSync(helper.evidencePlan.references[0].path, 'utf8'));
const cases = helper.accuracyCases, schedule = helper.evidenceSchedule(), profiles = {};
for (const sample of cases) profiles[sample.id] = { domain: sample.domain, ...await helper.evidenceAccuracyHashes(sample) };
// Synthetic parents exercise collection without reading any private real ledger.
const previous = Array.from({ length: 540 }, (_, i) => ({ number: i + 1, status: 'failure' }));
const expected = { ...originalComparisonFixture(fixtureText, frozen.fixtureHash), previousHash: hash(previous), planHash: hash(helper.evidencePlan), referenceHashes: helper.evidencePlan.references,
  sourceCommit: 'a'.repeat(40), profiles, models: helper.accuracyModels, schedule };
const helpers = { cases, parseFeedback: helper.parseEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail, safeCodes: Object.keys(helper.FEEDBACK_ISSUES),
  validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
const fresh = () => ({ comparison: 'evidence-v1', maximumCalls: 120, freeTierConfirmation: 'human-user', ...structuredClone(expected), providerStops: {}, attempts: [] });
const context = ledger => ({ previous, ledger, expected, helpers, config: { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64) } });
const detail = { kind: 'schema', issues: [{ field: 'target.observedUse', reason: 'type' }], truncated: false };
const failure = provider => ({ code: provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response', validationStage: 'fields', diagnostic: 'wire_fields', validationDetail: detail });
const withheld = sentence => wireHelper.parseEvidenceFeedback(JSON.stringify({ context: 'insufficient', meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '',
  target: { reason: 'ambiguous', originalSpan: '', observedUse: '' }, changes: [], structure: { status: 'unavailable', translation: '', parts: [], note: 'insufficient' } }), sentence, helper.accuracyModels.google);
const wire = () => ({ context: 'sufficient', meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: 'Her present was a book.', target: { reason: 'matched', originalSpan: 'present', observedUse: '선물' }, changes: [],
  structure: { status: 'available', translation: '그녀의 선물은 책이었어요.', note: 'none', parts: [{ text: 'Her present', function: 'subject', meaning: '그녀의 선물', governor: '' },
    { text: 'was', function: 'verb', meaning: '이었다', governor: '' }, { text: 'a book.', function: 'complement', meaning: '한 권의 책', governor: '' }] } });
const envelope = (v, provider) => provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(v) }] } }] }
  : { model: helper.accuracyModels.groq, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(v) } }] };
const request = (body, token = 'f'.repeat(64)) => new Request('https://wordgrain-oxford-study.hoihou-o.chatgpt.site/api/english-accuracy-evaluation', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', 'X-English-Accuracy-Token': token }, body: JSON.stringify(body) });

test('new full schedule, frozen references and unchanged publication gates cover all60 cases and all17 historical failures', async () => {
  const plan = helper.evidencePlan;
  assert.equal(plan.previousCalls, 540); assert.equal(plan.maximumCalls, 120); assert.equal(schedule.length, 120);
  assert.equal(cases.filter(c => c.domain === 'word').length, 40); assert.equal(cases.filter(c => c.domain === 'grammar').length, 20);
  assert.equal(plan.gates.minimumOverallPasses, 54); assert.equal(plan.gates.criticalFailures, 0); assert.equal(plan.gates.criticalUnavailable, 0); assert.equal(plan.gates.newRegressions, 0); assert.deepEqual(plan.gates.historicalMinimumPasses, { google: 44, groq: 34 });
  assert.equal(textHash(fixtureText), plan.fixtureContentHash);
  for (const r of plan.references) assert.equal(textHash(readFileSync(r.path, 'utf8')), r.hash);
  const registrations = JSON.parse(readFileSync(plan.references[2].path, 'utf8')).cases;
  assert.equal(registrations.flatMap(r => r.failures).length, 17);
  for (const r of registrations) for (const f of r.failures) assert.equal(schedule.filter(s => s.caseId === r.caseId && s.provider === f.provider).length, 1);
  for (const sample of cases) {
    assert.deepEqual(helper.evidenceAccuracyRequest(sample), legacy.freeAccuracyRequest(sample));
    assert.deepEqual(await legacy.freeAccuracyHashes(sample), { promptHash: frozen.promptHashes[sample.domain], requestHash: frozen.requestHashes[sample.id] });
    assert.notEqual(profiles[sample.id].requestHash, frozen.requestHashes[sample.id]);
    assert.doesNotMatch(JSON.stringify(helper.evidenceAccuracyRequest(sample).input), /"(?:expected|critical|correction|examples|id|caseId)"\s*:/);
  }
  assert.doesNotMatch(wireHelper.evidenceFeedbackContract.instruction, /B\d{3}|word-\d+|grammar-\d+/);
});

test('both domains use the existing provider transports exactly once with the evidence contract and bounded quotas', async () => {
  for (const sample of [cases.find(c => c.id === 'word-08'), cases.find(c => c.id === 'grammar-45')]) for (const provider of ['google', 'groq']) {
    const calls = [], payload = sample.domain === 'word' ? wire() : { context: 'insufficient', meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '',
      target: { reason: 'ambiguous', originalSpan: '', observedUse: '' }, changes: [], structure: { status: 'unavailable', translation: '', parts: [], note: 'insufficient' } };
    // Mock output verifies transport contracts only, not English performance.
    const result = await helper.evaluateEvidenceAccuracyCase({ google_api: 'mock', groq_api: 'mock' }, provider, sample, async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) }); return Response.json(envelope(payload, provider), { headers: { 'x-ratelimit-remaining-tokens': '120', 'x-ratelimit-reset-tokens': '1.2s' } });
    });
    assert.equal(calls.length, 1); assert.equal(result.feedback.original, sample.sentence); assert.equal(result.feedback.model, helper.accuracyModels[provider]);
    assert.deepEqual(result.quota, { remainingTokens: 120, resetTokensSeconds: 2 });
    const body = calls[0].body, input = provider === 'google' ? JSON.parse(body.contents[0].parts[0].text) : JSON.parse(body.messages.find(m => m.role === 'user').content);
    assert.deepEqual(input, legacy.freeAccuracyRequest(sample).input);
    assert.deepEqual(provider === 'google' ? body.generationConfig.responseJsonSchema : body.response_format.json_schema.schema, wireHelper.evidenceFeedbackContract.schema);
    assert.deepEqual({ promptHash: result.promptHash, requestHash: result.requestHash }, await helper.evidenceAccuracyHashes(sample));
  }
});

test('closed profile API rejects unsupported requests before fetch and retains only safe new-field failure diagnostics', async () => {
  const env = globalThis.__evidenceEvaluationEnv, originalFetch = globalThis.fetch; let calls = 0;
  Object.assign(env, { english_accuracy_token: 'f'.repeat(64), english_accuracy_expires: new Date(Date.now() + 600000).toISOString(), google_api: 'mock', groq_api: 'mock' });
  globalThis.fetch = async () => { calls++; return Response.json(envelope(wire(), 'google')); };
  const body = { caseId: 'word-08', provider: 'google', comparison: 'evidence-v1' };
  try {
    assert.equal((await api.POST(request(body))).status, 404); assert.equal(calls, 0);
    env.english_accuracy_profile = 'root-cause-v1'; assert.equal((await api.POST(request(body))).status, 400);
    env.english_accuracy_profile = 'evidence-v1';
    assert.equal((await api.POST(request(body, 'e'.repeat(64)))).status, 401);
    for (const invalid of [{ ...body, variant: 'control' }, { ...body, sentence: 'PRIVATE' }, { ...body, caseId: 'missing' }, { ...body, comparison: 'chunked-free-v1' }, { caseId: 'word-08', provider: 'google', round: 1 }]) assert.equal((await api.POST(request(invalid))).status, 400);
    assert.equal(calls, 0); const result = await api.POST(request(body)); assert.equal(result.status, 200); assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; const invalid = wire(); invalid.target.observedUse = { SECRET: 'PRIVATE' }; return Response.json(envelope(invalid, 'google')); };
    const failed = await api.POST(request(body)), safe = await failed.json(); assert.equal(failed.status, 502); assert.deepEqual(safe.validationDetail, detail); assert.doesNotMatch(JSON.stringify(safe), /SECRET|PRIVATE/);
    env.english_accuracy_expires = new Date(Date.now() - 1000).toISOString(); assert.equal((await api.POST(request(body))).status, 404); assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; for (const k of Object.keys(env)) delete env[k]; }
});

test('new wire diagnostics never expose unknown keys, values or array paths and empty corrections are rejected', () => {
  for (const [mutate, field] of [[v => v.changes = [{ before: 'a', after: 'b', rule: 'PRIVATE' }], 'changes[].rule'],
    [v => v.structure.parts[0].meaning = { SECRET: 'PRIVATE' }, 'structure.parts[].meaning'], [v => v.target.reason = 'PRIVATE', 'target.reason']]) {
    const v = wire(); mutate(v); assert.throws(() => wireHelper.parseEvidenceFeedback(JSON.stringify(v), v.correctedSentence, helper.accuracyModels.google), e => {
      assert.equal(e.validationDetail.issues[0].field, field); assert.doesNotMatch(JSON.stringify(e), /SECRET|PRIVATE/); return true;
    });
  }
  const v = wire(); v.grammar = 'needs_work'; v.correctedSentence = ''; v.changes = [{ before: 'Her present was a book.', after: '', rule: 'word-order' }];
  assert.throws(() => wireHelper.parseEvidenceFeedback(JSON.stringify(v), 'Her present was a book.', helper.accuracyModels.google), e => e.stage === 'judgment');
  for (const unknown of [{ kind: 'schema', issues: [{ field: 'target.PRIVATE', reason: 'type' }], truncated: false }, { ...detail, PRIVATE: 'SECRET' }]) assert.equal(helper.parseFeedbackValidationDetail(unknown), undefined);
});

test('120 slots are saved before POST, safe failures are bounded, parent history stays frozen and completion makes no HTTP', async () => {
  const ledger = fresh(), parentHash = hash(previous); let calls = 0, saves = 0;
  await collectEvidenceComparison(context(ledger), { pause: async () => {}, save: () => saves++, fetcher: async (_url, init) => {
    const body = JSON.parse(init.body), a = ledger.attempts.at(-1); assert.equal(a.status, 'started'); assert.equal(a.number, 541 + calls++); assert.ok(saves >= calls);
    const error = failure(body.provider); if (calls === 1) error.validationDetail = { ...detail, PRIVATE: 'SECRET' };
    return Response.json(error, { status: 502 });
  } });
  assert.equal(calls, 120); assert.equal(ledger.attempts.at(-1).number, 660); assert.equal(ledger.completed, true); assert.equal(hash(previous), parentHash);
  assert.equal(ledger.attempts[0].validationDetail, undefined); assert.deepEqual(ledger.attempts[1].validationDetail, detail); assert.doesNotMatch(JSON.stringify(ledger), /SECRET|PRIVATE/);
  validateEvidenceComparison(previous, ledger, expected, helpers);
  const bundle = evidenceReviewBundle(ledger.attempts); assert.equal(bundle.blinded.length, 120); assert.doesNotMatch(JSON.stringify(bundle.blinded), /"(?:provider|model|number|promptHash|requestHash|comparison|scheduleIndex)"\s*:/);
  assert.deepEqual(evidenceReviewBundle(ledger.attempts, bundle), bundle);
  await collectEvidenceComparison(context(ledger), { save: () => assert.fail('no save'), fetcher: () => assert.fail('no HTTP') });
  for (const mutate of [v => v.attempts[1].code = 'PRIVATE', v => v.attempts[1].validationDetail.message = 'PRIVATE', v => v.maximumCalls = 121, v => v.attempts[1].requestHash = '0'.repeat(64), v => v.attempts[1].startedAt = 'PRIVATE']) {
    const changed = structuredClone(ledger); mutate(changed); await assert.rejects(collectEvidenceComparison(context(changed), { save: () => assert.fail('no save'), fetcher: () => assert.fail('no HTTP') }));
  }
  for (const mutate of [v => v.mapping[0].number++, v => v.blinded[0].provider = 'google', v => v.blindHash = '0'.repeat(64)]) { const changed = structuredClone(bundle); mutate(changed); assert.throws(() => evidenceReviewBundle(ledger.attempts, changed)); }
});

test('interruption consumes a slot and provider, billing and endpoint stops survive recovery without retry', async () => {
  const ledger = fresh(), stop = new AbortController(); let calls = 0;
  await assert.rejects(collectEvidenceComparison(context(ledger), { signal: stop.signal, save: () => {}, pause: async () => {}, fetcher: async () => { calls++; stop.abort(Error('synthetic stop')); throw Error('network'); } }), /synthetic stop/);
  assert.equal(ledger.attempts[0].code, 'evaluation_transport');
  await collectEvidenceComparison(context(ledger), { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => { calls++; return Response.json(failure(JSON.parse(init.body).provider), { status: 502 }); } });
  assert.equal(calls, 120); assert.equal(ledger.attempts[0].number, 541);
  for (const [status, content, count] of [[429, null, 61], [503, { code: 'provider_unavailable', providerStatus: 402 }, 61], [404, { code: 'evaluation_disabled' }, 1]]) {
    const stopped = fresh(); let calls = 0;
    await collectEvidenceComparison(context(stopped), { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => { calls++; return calls === 1 ? content ? Response.json(content, { status }) : new Response('PRIVATE', { status }) : Response.json(failure(JSON.parse(init.body).provider), { status: 502 }); } });
    assert.equal(calls, count); assert.equal(stopped.completed, true); validateEvidenceComparison(previous, stopped, expected, helpers);
    await collectEvidenceComparison(context(stopped), { save: () => assert.fail('no save'), fetcher: () => assert.fail('stop persists') });
  }
  const started = fresh(), r = schedule[0]; started.attempts = [{ number: 541, round: 6, comparison: 'evidence-v1', scheduleIndex: 0, ...r, domain: profiles[r.caseId].domain,
    fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, expectedModel: expected.models[r.provider], promptHash: profiles[r.caseId].promptHash, requestHash: profiles[r.caseId].requestHash, status: 'started', startedAt: new Date().toISOString() }];
  let resumed = 0; await collectEvidenceComparison(context(started), { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => { resumed++; assert.notDeepEqual(JSON.parse(init.body), { ...r, comparison: 'evidence-v1' }); return Response.json(failure(JSON.parse(init.body).provider), { status: 502 }); } });
  assert.equal(resumed, 119); assert.equal(started.attempts[0].status, 'started');
});

test('successful feedback, quota and compiled judgment invariants are revalidated before resume', async () => {
  const ledger = fresh(), delays = []; let calls = 0;
  await collectEvidenceComparison(context(ledger), { save: () => {}, pause: async ms => delays.push(ms), fetcher: async (_url, init) => {
    const body = JSON.parse(init.body), sample = cases.find(c => c.id === body.caseId), p = profiles[body.caseId], feedback = withheld(sample.sentence); feedback.model = helper.accuracyModels[body.provider]; calls++;
    return Response.json({ ...body, ...p, feedback, quota: calls === 1 ? { remainingTokens: 10, resetTokensSeconds: 1, PRIVATE: 'SECRET' } : {} });
  } });
  assert.equal(ledger.attempts.filter(a => a.status === 'response').length, 120); assert.deepEqual(ledger.attempts[0].quota, { remainingTokens: 10, resetTokensSeconds: 1 }); assert.equal(delays[0], 1000); assert.ok(delays.every(ms => ms <= 30000));
  assert.doesNotMatch(JSON.stringify(ledger), /SECRET|PRIVATE/);
  for (const mutate of [v => v.attempts[0].feedback.meaningUsage = 'appropriate', v => v.attempts[0].feedback.structure = undefined, v => v.attempts[0].feedback.original = 'Changed input.',
    v => v.attempts[0].feedback.model = 'unknown', v => v.attempts[0].httpStatus = undefined, v => v.attempts[0].quota.PRIVATE = 'SECRET']) {
    const changed = structuredClone(ledger); mutate(changed); for (const completed of [true, false]) { changed.completed = completed; await assert.rejects(collectEvidenceComparison(context(changed), { save: () => assert.fail('no save'), fetcher: () => assert.fail('no HTTP') })); }
  }
  const natural = wireHelper.parseEvidenceFeedback(JSON.stringify(wire()), 'Her present was a book.', helper.accuracyModels.google); natural.correctedSentence = ' Her present was a book. ';
  assert.equal(helper.parseEvidenceAccuracyFeedback(natural), undefined);
});

test('separate authorization and parent hash checks refuse expansion, changed source, missing validators and CI live invocation', () => {
  const authorization = { schemaVersion: 1, comparison: 'evidence-v1', approvedCalls: 120, previousCalls: 540, cumulativeMaximum: 660, sourceCommit: expected.sourceCommit, planHash: expected.planHash,
    humanAuthorization: 'additional-120-free-calls', confirmedFreeProviders: ['google', 'groq'], approvedAt: new Date(Date.now() - 1000).toISOString() };
  validateEvidenceAuthorization(authorization, expected.sourceCommit, expected.planHash);
  for (const mutate of [v => v.approvedCalls = 121, v => v.previousCalls = 480, v => v.cumulativeMaximum = 661, v => v.sourceCommit = 'b'.repeat(40), v => v.planHash = '0'.repeat(64), v => v.humanAuthorization = 'preparation', v => v.confirmedFreeProviders = ['google'], v => v.approvedAt = 'PRIVATE']) { const v = structuredClone(authorization); mutate(v); assert.throws(() => validateEvidenceAuthorization(v, expected.sourceCommit, expected.planHash)); }
  const arrays = [previous.slice(0, 240), previous.slice(240, 360), previous.slice(360, 480), previous.slice(480)], plan = { previousCalls: 540, maximumCalls: 120, parentLedgerHashes: arrays.map(hash), combinedParentHash: hash(previous) };
  validateEvidenceParents(arrays, plan); const changed = structuredClone(arrays); changed[3][0].status = 'changed'; assert.throws(() => validateEvidenceParents(changed, plan)); assert.throws(() => validateEvidenceParents(arrays, { ...plan, maximumCalls: 121 }));
  assert.throws(() => validateEvidenceComparison(previous, fresh(), expected, { ...helpers, parseValidationDetail: undefined }));
  assertEvidenceLiveArguments(['--live', '--confirmed-free-tier', '--approved-calls', '120'], '');
  for (const args of [[], ['--live', '--confirmed-free-tier', '--approved-calls', '121'], ['--live', '--confirmed-free-tier', '--approved-calls', '120']]) assert.throws(() => execFileSync(process.execPath, ['scripts/evaluate-evidence-feedback.mjs', ...args], { env: { ...process.env, CI: 'true' }, stdio: 'pipe' }), e => e.status === 1);
});

test('actual CLI recovery validates authorization and blind files with zero HTTP, and missing consumed ledger cannot restart', () => {
  const sandbox = mkdtempSync(resolve('work/evidence-cli-recovery-'));
  const put = (name, value) => { const path = resolve(sandbox, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  put('package.json', '{"type":"module"}'); put('.gitignore', '.sites-runtime/\n'); put('tests/fixtures/english-accuracy.json', fixtureText);
  for (const file of ['scripts/evaluate-evidence-feedback.mjs', 'scripts/evaluate-original-feedback.mjs', 'scripts/evaluate-english-accuracy.mjs', 'lib/feedback-validation-detail.ts']) put(file, readFileSync(file, 'utf8'));
  const parents = [previous.slice(0, 240), previous.slice(240, 360), previous.slice(360, 480), previous.slice(480)], plan = { ...helper.evidencePlan, parentLedgerHashes: parents.map(hash), combinedParentHash: hash(previous) };
  for (const r of plan.references) put(r.path, readFileSync(r.path, 'utf8'));
  put('lib/evidence-feedback-evaluation.ts', `export {parseFeedbackValidationDetail} from './feedback-validation-detail';
export const evidencePlan=${JSON.stringify(plan)}, accuracyCases=${JSON.stringify(cases)}, accuracyModels=${JSON.stringify(helper.accuracyModels)};
const profiles=${JSON.stringify(profiles)}; export function evidenceSchedule(){return ${JSON.stringify(schedule)};} export async function evidenceAccuracyHashes(c){return profiles[c.id];}
export const FEEDBACK_ISSUES={provider_invalid_response:[],groq_invalid_response:[]}, FEEDBACK_VALIDATION_STAGES=['fields'], FEEDBACK_DIAGNOSTICS=['wire_fields'];
export function parseEvidenceAccuracyFeedback(){throw Error('No provider responses in this recovery fixture');}`);
  const git = args => execFileSync('git', args, { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); git(['add', '.']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic evidence CLI']);
  const root = '.sites-runtime/english-accuracy/', paths = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json'];
  paths.forEach((p, i) => put(root + p, { attempts: parents[i] }));
  const counter = resolve(sandbox, root + 'network.json'), preload = resolve(sandbox, root + 'mock-network.mjs');
  put(root + 'mock-network.mjs', `import{writeFileSync}from'node:fs';let requests=0;globalThis.fetch=async()=>{requests++;throw Error('No recovery HTTP allowed');};process.on('exit',()=>writeFileSync(${JSON.stringify(counter)},JSON.stringify({requests,actualProviderCalls:0})));`);
  const sourceCommit = git(['rev-parse', 'HEAD']), ledger = { ...fresh(), planHash: hash(plan), sourceCommit, attempts: schedule.map((r, i) => ({ number: 541 + i, round: 6, comparison: 'evidence-v1', scheduleIndex: i, ...r,
    domain: profiles[r.caseId].domain, fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, expectedModel: expected.models[r.provider], promptHash: profiles[r.caseId].promptHash, requestHash: profiles[r.caseId].requestHash,
    status: 'failure', httpStatus: 502, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ...failure(r.provider) })) };
  const authorization = { schemaVersion: 1, comparison: 'evidence-v1', approvedCalls: 120, previousCalls: 540, cumulativeMaximum: 660, sourceCommit, planHash: hash(plan),
    humanAuthorization: 'additional-120-free-calls', confirmedFreeProviders: ['google', 'groq'], approvedAt: new Date(Date.now() - 1000).toISOString(), runInitialized: true };
  const config = { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit };
  const run = () => execFileSync(process.execPath, ['--import', pathToFileURL(preload).href, resolve(sandbox, 'scripts/evaluate-evidence-feedback.mjs'), '--live', '--confirmed-free-tier', '--approved-calls', '120'],
    { cwd: sandbox, env: { ...process.env, CI: '' }, input: JSON.stringify(config) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const authPath = root + 'evidence-v1/authorization.json', ledgerPath = root + 'evidence-v1/ledger.json';
  put(ledgerPath, ledger); assert.throws(run, e => e.status === 1); assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { requests: 0, actualProviderCalls: 0 });
  put(authPath, authorization);
  for (const completed of [true, false]) { ledger.completed = completed; put(ledgerPath, ledger); assert.equal(JSON.parse(run().trim().split(/\r?\n/).at(-1)).attempts, 120); assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { requests: 0, actualProviderCalls: 0 }); }
  const reviewPath = root + 'evidence-v1/review-bundle.json', review = JSON.parse(readFileSync(resolve(sandbox, reviewPath), 'utf8'));
  for (const mutate of [v => v.blinded[0].provider = 'google', v => v.mapping[0].number++, v => v.blindHash = '0'.repeat(64)]) {
    const changed = structuredClone(review); mutate(changed); put(reviewPath, changed); assert.throws(run, e => e.status === 1); assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { requests: 0, actualProviderCalls: 0 });
  }
  put(reviewPath, review);
  renameSync(resolve(sandbox, ledgerPath), resolve(sandbox, ledgerPath + '.saved'));
  try { assert.throws(run, e => e.status === 1); assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { requests: 0, actualProviderCalls: 0 }); } finally { renameSync(resolve(sandbox, ledgerPath + '.saved'), resolve(sandbox, ledgerPath)); }
  const badAuthorization = { ...authorization, approvedCalls: 121 }; put(authPath, badAuthorization); assert.throws(run, e => e.status === 1); assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { requests: 0, actualProviderCalls: 0 });
});
