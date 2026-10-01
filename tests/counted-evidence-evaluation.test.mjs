import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { assertCountedLiveArguments, validateCountedConfiguration, validateCountedAuthorization, validateCountedParents,
  restoreCountedLedger, validateCountedLedger, countedReviewBundle, collectCountedEvidence } from '../scripts/evaluate-counted-evidence.mjs';
import { originalComparisonFixture } from '../scripts/evaluate-original-feedback.mjs';

const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const contentHash = v => createHash('sha256').update(v.replace(/\r\n/g, '\n')).digest('hex');
mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/counted-evaluation-tests-'));
globalThis.__countedEvaluationEnv = {};
async function bundle(entry, name) {
  const file = resolve(directory, name + '.mjs');
  await build({ entryPoints: [entry], outfile: file, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'mock-env', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const env=globalThis.__countedEvaluationEnv;', loader: 'js' }));
  } }] });
  return import(pathToFileURL(file).href);
}
const helper = await bundle('lib/counted-evidence-evaluation.ts', 'helper'), legacy = await bundle('lib/free-feedback-evaluation.ts', 'legacy');
const wireHelper = await bundle('lib/counted-evidence-feedback.ts', 'wire'), api = await bundle('app/api/english-accuracy-evaluation/route.ts', 'route');
const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'), plan = helper.countedEvidencePlan;
const frozen = JSON.parse(readFileSync(plan.references[0].path, 'utf8')), cases = helper.accuracyCases, schedule = helper.countedEvidenceSchedule(), profiles = {};
for (const sample of cases) profiles[sample.id] = { domain: sample.domain, ...await helper.countedEvidenceHashes(sample) };
// Synthetic history: tests never read or write real authorization or ledgers.
const parents = plan.parentCounts.map((n, cohort) => Array.from({ length: n }, (_, i) => ({ cohort, number: i + 1, status: 'failure' })));
const expected = { ...originalComparisonFixture(fixtureText, frozen.fixtureHash), previousHash: hash(parents.flat()), planHash: hash(plan), referenceHashes: plan.references,
  sourceCommit: 'a'.repeat(40), profiles, models: helper.accuracyModels, schedule };
const helpers = { cases, parseFeedback: helper.parseCountedEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail,
  safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
const fresh = () => restoreCountedLedger({}, undefined, structuredClone(expected), helpers);
const config = { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit: expected.sourceCommit };
const context = ledger => ({ ledger, expected, helpers, config });
const detail = { kind: 'schema', issues: [{ field: 'analysis.target.observedUse', reason: 'type' }], truncated: false };
const failure = row => ({ ...row, comparison: 'counted-evidence-v1', code: row.provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response',
  validationStage: 'fields', diagnostic: 'wire_fields', validationDetail: detail });
const withheld = (sentence, provider) => wireHelper.parseCountedEvidenceFeedback(JSON.stringify({ analysis: { grammar: 'uncertain' } }), sentence, helper.accuracyModels[provider]);
const wire = () => ({ analysis: { grammar: 'natural', target: { reason: 'matched', originalSpan: 'present', observedUse: '선물' },
  structure: { status: 'available', translation: '그녀의 선물은 책이었어요.', parts: [
    { unitCount: 2, function: 'subject', meaning: '그녀의 선물' }, { unitCount: 1, function: 'verb', meaning: '이었다' }, { unitCount: 2, function: 'complement', meaning: '한 권의 책' }] } } });
const envelope = (v, provider) => provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(v) }] } }] }
  : { model: helper.accuracyModels.groq, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(v) } }] };
const request = (body, token = config.evaluationToken, origin = config.origin) => new Request(config.origin + '/api/english-accuracy-evaluation', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin, 'X-English-Accuracy-Token': token }, body: JSON.stringify(body) });
const initialTime = Date.parse('2026-10-01T00:00:00.000Z');
const virtual = () => { let time = initialTime; const waits = []; return { waits, now: () => time, pause: async ms => { waits.push(ms); time += ms; } }; };
const invalidFetch = async (_url, init) => Response.json(failure(JSON.parse(init.body)), { status: 502 });
const successFetch = async (_url, init) => { const row = JSON.parse(init.body), sample = cases.find(c => c.id === row.caseId);
  return Response.json({ ...row, ...profiles[row.caseId], feedback: withheld(sample.sentence, row.provider) }); };
const authorization = () => ({ schemaVersion: 1, comparison: 'counted-evidence-v1', approvedCalls: 120, previousCalls: 675, cumulativeMaximum: 795,
  sourceCommit: expected.sourceCommit, planHash: expected.planHash, humanAuthorization: 'additional-120-free-counted-calls',
  confirmedFreeProviders: ['google', 'groq'], approvedAt: new Date(Date.now() - 1000).toISOString() });

test('same60 cases, frozen675 history, old17 defects and unchanged publication thresholds are registered', async () => {
  assert.equal(plan.previousCalls, 675); assert.equal(plan.maximumCalls, 120); assert.equal(plan.maximumTotalCalls, 795);
  assert.deepEqual(plan.parentCounts, [240, 120, 120, 60, 115, 20]); assert.equal(schedule.length, 120);
  assert.equal(cases.filter(c => c.domain === 'word').length, 40); assert.equal(cases.filter(c => c.domain === 'grammar').length, 20);
  assert.equal(plan.gates.minimumOverallPasses, 54); assert.equal(plan.gates.criticalFailures, 0); assert.equal(plan.gates.criticalUnavailable, 0);
  assert.equal(plan.gates.newRegressions, 0); assert.deepEqual(plan.gates.historicalMinimumPasses, { google: 44, groq: 34 });
  assert.equal(plan.gates.historicalFailuresToResolve, 17); assert.equal(contentHash(fixtureText), plan.fixtureContentHash);
  for (const r of plan.references) assert.equal(contentHash(readFileSync(r.path, 'utf8')), r.hash);
  const registrations = JSON.parse(readFileSync(plan.references[2].path, 'utf8')).cases;
  assert.equal(registrations.flatMap(r => r.failures).length, 17);
  for (const r of registrations) for (const f of r.failures) assert.equal(schedule.filter(s => s.caseId === r.caseId && s.provider === f.provider).length, 1);
  for (const sample of cases) {
    const candidate = helper.countedEvidenceRequest(sample);
    assert.deepEqual(candidate.input, legacy.freeAccuracyRequest(sample).input);
    assert.notEqual(candidate.instruction, legacy.freeAccuracyRequest(sample).instruction);
    assert.notEqual(profiles[sample.id].requestHash, frozen.requestHashes[sample.id]);
    assert.doesNotMatch(JSON.stringify(candidate), /"(?:expected|critical|correction|examples|caseId|id)"\s*:/);
  }
  assert.doesNotMatch(wireHelper.countedEvidenceFeedbackContract.instruction, /B\d{3}|word-\d+|grammar-\d+/);
});

test('both domains and providers use unchanged input, conditional wire schema and direct transport once', async () => {
  for (const sample of [cases.find(c => c.id === 'word-08'), cases.find(c => c.id === 'grammar-45')]) for (const provider of ['google', 'groq']) {
    const calls = [], payload = sample.domain === 'word' ? wire() : { analysis: { grammar: 'uncertain' } };
    const result = await helper.evaluateCountedEvidenceCase({ google_api: 'mock', groq_api: 'mock' }, provider, sample, async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) }); return Response.json(envelope(payload, provider), { headers: { 'x-ratelimit-remaining-tokens': '120', 'x-ratelimit-reset-tokens': '1.2s' } });
    });
    assert.equal(calls.length, 1); assert.equal(result.feedback.original, sample.sentence); assert.equal(result.feedback.model, helper.accuracyModels[provider]);
    assert.deepEqual(result.quota, { remainingTokens: 120, resetTokensSeconds: 2 });
    const body = calls[0].body, input = provider === 'google' ? JSON.parse(body.contents[0].parts[0].text) : JSON.parse(body.messages.find(m => m.role === 'user').content);
    assert.deepEqual(input, legacy.freeAccuracyRequest(sample).input);
    assert.deepEqual(provider === 'google' ? body.generationConfig.responseJsonSchema : body.response_format.json_schema.schema, wireHelper.countedEvidenceFeedbackContract.schema);
    assert.deepEqual({ promptHash: result.promptHash, requestHash: result.requestHash }, await helper.countedEvidenceHashes(sample));
    let failedCalls = 0;
    await assert.rejects(helper.evaluateCountedEvidenceCase({ google_api: 'mock', groq_api: 'mock' }, provider, sample, async () => {
      failedCalls++; return new Response('synthetic transport failure', { status: 429 });
    })); assert.equal(failedCalls, 1);
  }
});

test('disabled, expiry, token, profile, origin, body and case guards reject before either provider', async () => {
  const env = globalThis.__countedEvaluationEnv, originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(envelope(wire(), 'google')); };
  const body = { caseId: 'word-08', provider: 'google', comparison: 'counted-evidence-v1' };
  try {
    assert.equal((await api.POST(request(body))).status, 404);
    Object.assign(env, { english_accuracy_token: config.evaluationToken, english_accuracy_expires: new Date(Date.now() + 600000).toISOString(), google_api: 'mock', groq_api: 'mock' });
    assert.equal((await api.POST(request(body))).status, 404);
    env.english_accuracy_profile = 'evidence-v1'; assert.equal((await api.POST(request(body))).status, 400);
    env.english_accuracy_profile = 'counted-evidence-v1'; assert.equal((await api.POST(request(body, 'e'.repeat(64)))).status, 401);
    assert.equal((await api.POST(request(body, config.evaluationToken, 'https://other.invalid'))).status, 403);
    for (const invalid of [{ ...body, variant: 'control' }, { ...body, sentence: 'PRIVATE' }, { ...body, caseId: 'missing' }, { ...body, provider: 'other' },
      { ...body, comparison: 'evidence-v1' }, { caseId: 'word-08', provider: 'google', round: 1 }, { ...body, extra: 'x'.repeat(2000) }]) assert.equal((await api.POST(request(invalid))).status, 400);
    delete env.google_api; assert.equal((await api.POST(request(body))).status, 503); env.google_api = 'mock';
    assert.equal(calls, 0); assert.equal((await api.POST(request(body))).status, 200); assert.equal(calls, 1);
    for (const provider of ['google', 'groq']) {
      globalThis.fetch = async () => { calls++; const invalid = wire(); invalid.analysis.target.observedUse = { SECRET: 'PRIVATE' }; return Response.json(envelope(invalid, provider)); };
      const failed = await api.POST(request({ ...body, provider })), safe = await failed.json();
      assert.equal(failed.status, 502); assert.deepEqual(safe.validationDetail, detail); assert.doesNotMatch(JSON.stringify(safe), /SECRET|PRIVATE/);
    }
    const before = calls; env.english_accuracy_expires = new Date(Date.now() - 1000).toISOString(); assert.equal((await api.POST(request(body))).status, 404);
    env.english_accuracy_expires = new Date(Date.now() + 86400001).toISOString(); assert.equal((await api.POST(request(body))).status, 404); assert.equal(calls, before);
  } finally { globalThis.fetch = originalFetch; for (const k of Object.keys(env)) delete env[k]; }
});

test('counted schema diagnostics expose only exact allowlisted field paths and bounded reasons', () => {
  for (const [mutate, field] of [[v => v.analysis.target.reason = 'PRIVATE', 'analysis.target.reason'], [v => v.analysis.structure.parts[0].unitCount = 'PRIVATE', 'analysis.structure.parts[].unitCount'],
    [v => v.analysis.structure.parts[0].meaning = { SECRET: 'PRIVATE' }, 'analysis.structure.parts[].meaning'], [v => v.analysis.structure.status = 'PRIVATE', 'analysis.structure.status']]) {
    const v = wire(); mutate(v); assert.throws(() => wireHelper.parseCountedEvidenceFeedback(JSON.stringify(v), 'Her present was a book.', helper.accuracyModels.google), e => {
      assert.equal(e.validationDetail.issues[0].field, field); assert.doesNotMatch(JSON.stringify(e), /SECRET|PRIVATE/); return true;
    });
  }
  for (const value of [{ ...detail, SECRET: 'PRIVATE' }, { kind: 'schema', issues: [{ field: 'analysis.target.PRIVATE', reason: 'type' }], truncated: false },
    { kind: 'schema', issues: [{ field: 'analysis.structure.parts[999999].meaning', reason: 'type' }], truncated: false }]) assert.equal(helper.parseFeedbackValidationDetail(value), undefined);
  assert.ok(helper.parseFeedbackValidationDetail({ kind: 'schema', issues: [{ field: 'target.observedUse', reason: 'type' }], truncated: false }));
});

test('120 mock slots are durably prespent676–795 and completion/blinding never leaks provider identity', async () => {
  const ledger = fresh(), history = hash(parents); let calls = 0, saves = 0; const clock = virtual();
  await collectCountedEvidence(context(ledger), { ...clock, save: () => saves++, fetcher: async (_url, init) => {
    const row = JSON.parse(init.body), a = ledger.attempts.at(-1); assert.equal(a.status, 'started'); assert.equal(a.number, 676 + calls++); assert.ok(saves >= calls);
    const result = failure(row); if (calls === 1) result.validationDetail = { ...detail, PRIVATE: 'SECRET' };
    return Response.json(result, { status: 502 });
  } });
  assert.equal(calls, 120); assert.equal(ledger.attempts.at(-1).number, 795); assert.equal(ledger.completed, true); assert.equal(hash(parents), history);
  assert.equal(ledger.attempts[0].validationDetail, undefined); assert.deepEqual(ledger.attempts[1].validationDetail, detail); assert.doesNotMatch(JSON.stringify(ledger), /SECRET|PRIVATE/);
  validateCountedLedger(ledger, expected, helpers); assert.equal(clock.waits.length, 119); assert.ok(clock.waits.every(ms => ms === 30000));
  const review = countedReviewBundle(ledger.attempts); assert.equal(review.blinded.length, 120);
  assert.doesNotMatch(JSON.stringify(review.blinded), /"(?:provider|model|number|promptHash|requestHash|comparison|scheduleIndex)"\s*:/);
  assert.deepEqual(countedReviewBundle(ledger.attempts, review), review);
  await collectCountedEvidence(context(ledger), { save: () => assert.fail('no save'), fetcher: () => assert.fail('no HTTP') });
  for (const mutate of [v => v.attempts[1].code = 'PRIVATE', v => v.attempts[1].validationDetail.message = 'PRIVATE', v => v.attempts[1].requestHash = '0'.repeat(64),
    v => v.attempts[1].number++, v => v.attempts[1].status = 'started', v => v.sourceCommit = 'b'.repeat(40), v => v.providerStops.google = 'provider_limit']) {
    const changed = structuredClone(ledger); mutate(changed); await assert.rejects(collectCountedEvidence(context(changed), { fetcher: () => assert.fail('no HTTP') }));
  }
  for (const mutate of [v => v.mapping[0].number++, v => v.blinded[0].provider = 'google', v => v.blindHash = '0'.repeat(64)]) {
    const changed = structuredClone(review); mutate(changed); assert.throws(() => countedReviewBundle(ledger.attempts, changed));
  }
});

test('successes are revalidated, quota60-second pacing survives restart and started slots are never retried', async () => {
  const ledger = fresh(), clock = virtual(); let calls = 0;
  await collectCountedEvidence(context(ledger), { ...clock, fetcher: async (...args) => {
    const response = await successFetch(...args), value = await response.json(); value.quota = ++calls === 1 ? { remainingTokens: 10, resetTokensSeconds: 1, PRIVATE: 'SECRET' } : {};
    return Response.json(value);
  } });
  assert.equal(ledger.attempts.filter(a => a.status === 'response').length, 120); assert.equal(ledger.attempts[0].waitAfterMs, 60000);
  assert.deepEqual(clock.waits.slice(0, 2), [30000, 30000]); assert.doesNotMatch(JSON.stringify(ledger), /SECRET|PRIVATE|remainingTokens|resetTokensSeconds/);
  const review = countedReviewBundle(ledger.attempts); assert.doesNotMatch(JSON.stringify(review.blinded), /createdAt|gemini|llama/);
  for (const mutate of [v => v.attempts[0].feedback.meaningUsage = 'appropriate', v => v.attempts[0].feedback.structure = undefined, v => v.attempts[0].feedback.original = 'Changed input.',
    v => v.attempts[0].feedback.model = 'other', v => v.attempts[0].httpStatus = undefined, v => v.attempts[0].waitAfterMs = 30000]) {
    const changed = structuredClone(ledger); mutate(changed); assert.throws(() => validateCountedLedger(changed, expected, helpers));
  }
  for (const mode of ['started', 'response']) {
    const resumed = fresh(), first = structuredClone(ledger.attempts[0]);
    if (mode === 'started') for (const k of ['feedback', 'finishedAt', 'httpStatus', 'waitAfterMs']) delete first[k];
    first.status = mode; resumed.attempts = [first]; const clock = virtual();
    await collectCountedEvidence(context(resumed), { ...clock, fetcher: async (...args) => { assert.notEqual(JSON.parse(args[1].body).provider, resumed.attempts.length === 2 ? 'google' : 'impossible'); return invalidFetch(...args); } });
    assert.equal(resumed.attempts.length, 120); assert.equal(resumed.attempts[0].status, mode);
    assert.deepEqual(clock.waits.slice(0, mode === 'response' ? 2 : 1), mode === 'response' ? [30000, 30000] : [30000]);
  }
});

test('rate/billing/key stops are provider scoped and protocol/transport/closed stops terminate globally', async () => {
  for (const [status, content, count] of [[429, {}, 61], [503, { code: 'provider_unavailable', providerStatus: 402 }, 61], [503, { code: 'evaluation_key_missing' }, 61],
    [401, { code: 'evaluation_unauthorized' }, 1], [404, { code: 'evaluation_disabled' }, 1], [200, {}, 1], [200, { code: 'provider_unavailable' }, 1],
    [200, { ...schedule[0], comparison: 'counted-evidence-v1', code: 'provider_unavailable' }, 1], [502, failure({ caseId: 'other', provider: 'google' }), 1]]) {
    const ledger = fresh(); let calls = 0;
    await collectCountedEvidence(context(ledger), { ...virtual(), fetcher: async (...args) => ++calls === 1 ? Response.json(content, { status }) : invalidFetch(...args) });
    assert.equal(calls, count); assert.equal(ledger.completed, true); validateCountedLedger(ledger, expected, helpers);
    if (status === 200) {
      assert.equal(ledger.endpointStop, 'evaluation_invalid_response');
      const changed = structuredClone(ledger); changed.attempts[0].code = 'provider_unavailable'; delete changed.endpointStop;
      assert.throws(() => validateCountedLedger(changed, expected, helpers));
    }
    await collectCountedEvidence(context(ledger), { fetcher: () => assert.fail('no recovery HTTP') });
  }
  const interrupted = fresh(), stop = new AbortController();
  await collectCountedEvidence(context(interrupted), { ...virtual(), signal: stop.signal, fetcher: async () => { stop.abort(Error('synthetic interruption')); throw Error('network'); } });
  assert.equal(interrupted.attempts.length, 1); assert.equal(interrupted.endpointStop, 'evaluation_transport');
  await collectCountedEvidence(context(interrupted), { fetcher: () => assert.fail('no transport retry') }); assert.equal(interrupted.completed, true);
  const writeFailure = fresh(); await assert.rejects(collectCountedEvidence(context(writeFailure), { save: () => { throw Error('disk'); }, fetcher: () => assert.fail('POST must follow durable save') }), /disk/);
  assert.equal(writeFailure.attempts[0].status, 'started');
});

test('configuration, approval, six parent hashes, missing consumed ledger and CI guards cannot expand budget', () => {
  validateCountedConfiguration(config); validateCountedAuthorization(authorization(), expected.sourceCommit, expected.planHash);
  for (const changed of [{ ...config, origin: config.origin + '/?x=1' }, { ...config, evaluationToken: 'f' }, { ...config, sourceCommit: 'HEAD' }, { ...config, PRIVATE: 'SECRET' }]) assert.throws(() => validateCountedConfiguration(changed));
  for (const mutate of [v => v.approvedCalls = 121, v => v.previousCalls = 655, v => v.cumulativeMaximum = 796, v => v.sourceCommit = 'b'.repeat(40),
    v => v.planHash = '0'.repeat(64), v => v.humanAuthorization = 'preparation', v => v.confirmedFreeProviders = ['google'], v => v.approvedAt = 'PRIVATE']) {
    const a = authorization(); mutate(a); assert.throws(() => validateCountedAuthorization(a, expected.sourceCommit, expected.planHash));
  }
  const syntheticPlan = { ...plan, parentLedgerHashes: parents.map(hash), combinedParentHash: hash(parents.flat()) };
  validateCountedParents(parents, syntheticPlan); const changed = structuredClone(parents); changed[5][0].status = 'changed'; assert.throws(() => validateCountedParents(changed, syntheticPlan));
  assert.throws(() => restoreCountedLedger({ runInitialized: true }, undefined, expected, helpers));
  assert.throws(() => validateCountedLedger(fresh(), expected, { ...helpers, parseValidationDetail: undefined }));
  assertCountedLiveArguments(['--live', '--confirmed-free-tier', '--approved-calls', '120'], '');
  for (const args of [[], ['--live', '--confirmed-free-tier', '--approved-calls', '121'], ['--live', '--confirmed-free-tier', '--approved-calls', '120']]) {
    assert.throws(() => execFileSync(process.execPath, ['scripts/evaluate-counted-evidence.mjs', ...args], { env: { ...process.env, CI: 'true' }, stdio: 'pipe' }), e => e.status === 1);
  }
});

function syntheticCli() {
  const sandbox = mkdtempSync(resolve('work/counted-cli-')), root = '.sites-runtime/english-accuracy/', cohort = root + 'counted-evidence-v1/';
  const paths = { auth: cohort + 'authorization.json', ledger: cohort + 'ledger.json', lock: root + 'running.lock', counter: root + 'network.json', mode: root + 'mode.json' };
  const put = (name, value) => { const path = resolve(sandbox, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  const get = name => JSON.parse(readFileSync(resolve(sandbox, name), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = () => { git(['add', '.']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic counted CLI']); return git(['rev-parse', 'HEAD']); };
  put('package.json', '{"type":"module"}'); put('.gitignore', '.sites-runtime/\n'); put('tests/fixtures/english-accuracy.json', fixtureText);
  for (const file of ['scripts/evaluate-counted-evidence.mjs', 'scripts/diagnose-evidence-feedback.mjs', 'scripts/evaluate-original-feedback.mjs', 'scripts/evaluate-english-accuracy.mjs',
    'lib/feedback-validation-detail.ts', 'data/evaluations/evidence-diagnostic-plan.json']) put(file, readFileSync(file, 'utf8'));
  const syntheticPlan = { ...plan, parentLedgerHashes: parents.map(hash), combinedParentHash: hash(parents.flat()) };
  for (const r of plan.references) put(r.path, readFileSync(r.path, 'utf8'));
  put('lib/counted-evidence-evaluation.ts', `export {parseFeedbackValidationDetail} from './feedback-validation-detail';
export const countedEvidencePlan=${JSON.stringify(syntheticPlan)}, accuracyCases=${JSON.stringify(cases)}, accuracyModels=${JSON.stringify(helper.accuracyModels)};
const profiles=${JSON.stringify(profiles)};export async function countedEvidenceHashes(c){return profiles[c.id];}export function countedEvidenceSchedule(){return ${JSON.stringify(schedule)};}
export const FEEDBACK_ISSUES=${JSON.stringify(helper.FEEDBACK_ISSUES)}, FEEDBACK_VALIDATION_STAGES=${JSON.stringify(helpers.validationStages)}, FEEDBACK_DIAGNOSTICS=${JSON.stringify(helpers.diagnostics)};
export function parseCountedEvidenceAccuracyFeedback(){throw Error('No valid response in synthetic CLI fixture');}`);
  git(['init']); const sourceCommit = commit(), cfg = { ...config, sourceCommit };
  const parentPaths = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json', 'evidence-v1/ledger.json', 'evidence-diagnostics-v1/ledger.json'].map(p => root + p);
  parentPaths.forEach((p, i) => put(p, { attempts: parents[i] })); const parentTexts = parentPaths.map(p => readFileSync(resolve(sandbox, p), 'utf8'));
  const auth = { ...authorization(), sourceCommit, planHash: hash(syntheticPlan), runInitialized: false };
  put(paths.auth, auth); const preload = root + 'mock-network.mjs';
  put(preload, [
    "import assert from 'node:assert/strict';import{readFileSync,writeFileSync,existsSync,mkdirSync}from'node:fs';",
    'const paths=' + JSON.stringify(paths) + ';const read=p=>JSON.parse(readFileSync(p,"utf8"));const mode=read(paths.mode),requests=[];let prespends=0;',
    'let time=Date.now();Date.now=()=>time;const timer=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{if(ms>10000){time+=ms;return timer(fn,0,...args)}return timer(fn,ms,...args)};',
    'globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);if(mode==="forbid")throw Error("Unexpected recovery HTTP");',
    'assert.equal(read(paths.auth).runInitialized,true);assert.equal(existsSync(paths.lock),true);assert.equal(existsSync(paths.ledger+".tmp"),false);',
    'const ledger=read(paths.ledger);if(body.caseId==="preflight-invalid-case"){assert.equal(ledger.attempts.length,0);if(mode==="slot-fails")mkdirSync(paths.ledger+".tmp");return Response.json({code:"evaluation_invalid_case"},{status:400});}',
    'const a=ledger.attempts.at(-1);assert.equal(a.status,"started");assert.equal(a.caseId,body.caseId);assert.equal(a.provider,body.provider);assert.equal(a.number,675+ledger.attempts.length);prespends++;',
    'if(mode==="closed")return Response.json({code:"evaluation_disabled"},{status:404});',
    'return Response.json({...body,code:body.provider==="google"?"provider_invalid_response":"groq_invalid_response",providerStatus:200,validationStage:"fields",diagnostic:"wire_fields",validationDetail:' + JSON.stringify(detail) + ',feedback:{original:"PRIVATE"},message:"SECRET"},{status:502});};',
    'process.on("exit",()=>writeFileSync(paths.counter,JSON.stringify({requests,prespends,actualProviderCalls:0})));',
  ].join('\n'));
  const run = (mode = 'normal') => { put(paths.mode, JSON.stringify(mode)); return execFileSync(process.execPath,
    ['--import', pathToFileURL(resolve(sandbox, preload)).href, resolve(sandbox, 'scripts/evaluate-counted-evidence.mjs'), '--live', '--confirmed-free-tier', '--approved-calls', '120'],
    { cwd: sandbox, env: { ...process.env, CI: '' }, input: JSON.stringify(cfg) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); };
  const assertParents = () => parentPaths.forEach((p, i) => assert.equal(readFileSync(resolve(sandbox, p), 'utf8'), parentTexts[i]));
  const assertUnlocked = () => assert.equal(existsSync(resolve(sandbox, paths.lock)), false);
  const reject = () => { assert.throws(() => run('forbid'), e => e.status === 1 && !/f{64}|PRIVATE|SECRET/.test(e.stderr)); assert.equal(get(paths.counter).requests.length, 0); assertUnlocked(); assertParents(); };
  return { sandbox, paths, put, get, run, reject, assertParents, assertUnlocked, auth, parentPaths, syntheticPlan, cfg };
}

test('actual CLI mock wiring prespends120 slots, locks exclusively and recovers completed runs with HTTP0', () => {
  const cli = syntheticCli(), summary = JSON.parse(cli.run().trim().split(/\r?\n/).at(-1)), saved = cli.get(cli.paths.ledger), network = cli.get(cli.paths.counter);
  assert.equal(summary.complete, true); assert.equal(summary.attempts, 120); assert.equal(summary.totalAttempts, 795); assert.equal(network.requests.length, 121);
  assert.equal(network.prespends, 120); assert.equal(saved.attempts.at(-1).number, 795); assert.equal(cli.get(cli.paths.auth).runInitialized, true);
  assert.doesNotMatch(JSON.stringify(saved), /PRIVATE|SECRET/); cli.assertParents(); cli.assertUnlocked();
  cli.run('forbid'); assert.equal(cli.get(cli.paths.counter).requests.length, 0); cli.assertParents(); cli.assertUnlocked();
  const reviewPath = '.sites-runtime/english-accuracy/counted-evidence-v1/review-bundle.json', review = cli.get(reviewPath);
  review.blinded[0].provider = 'google'; cli.put(reviewPath, review); cli.reject();
});

test('actual CLI refuses missing consumed ledger, parent/reference/source drift and preserves external locks', () => {
  const cli = syntheticCli(); cli.put(cli.paths.auth, { ...cli.auth, runInitialized: true }); cli.reject();
  cli.put(cli.paths.auth, cli.auth); const parent = cli.get(cli.parentPaths[5]); parent.attempts[0].status = 'changed'; cli.put(cli.parentPaths[5], parent);
  assert.throws(() => cli.run('forbid'), e => e.status === 1); assert.equal(cli.get(cli.paths.counter).requests.length, 0); cli.assertUnlocked();
  cli.put(cli.parentPaths[5], { attempts: parents[5] }); cli.put('tests/fixtures/english-accuracy.json', fixtureText + ' '); cli.reject();
  cli.put('tests/fixtures/english-accuracy.json', fixtureText); const reference = plan.references[0]; cli.put(reference.path, readFileSync(reference.path, 'utf8') + ' '); cli.reject();
  cli.put(reference.path, readFileSync(reference.path, 'utf8')); cli.put('uncommitted.txt', 'source drift'); cli.reject();
  cli.put(cli.paths.lock, { owner: 'other-run' }); assert.throws(() => cli.run('forbid'), e => e.status === 1);
  assert.deepEqual(cli.get(cli.paths.lock), { owner: 'other-run' }); assert.equal(cli.get(cli.paths.counter).requests.length, 0);
});

test('actual CLI terminal failure never resumes, and a slot disk failure makes no model POST', () => {
  const closed = syntheticCli(); closed.run('closed'); assert.equal(closed.get(closed.paths.ledger).attempts.length, 1);
  assert.equal(closed.get(closed.paths.ledger).endpointStop, 'evaluation_disabled'); closed.run('forbid'); assert.equal(closed.get(closed.paths.counter).requests.length, 0); closed.assertParents(); closed.assertUnlocked();
  const disk = syntheticCli(); assert.throws(() => disk.run('slot-fails'), e => e.status === 1);
  assert.equal(disk.get(disk.paths.counter).requests.length, 1); assert.equal(disk.get(disk.paths.counter).prespends, 0); disk.assertParents(); disk.assertUnlocked();
  assert.equal(disk.get(disk.paths.auth).runInitialized, true); assert.equal(disk.get(disk.paths.ledger).attempts.length, 0);
  assert.equal(statSync(resolve(disk.sandbox, disk.paths.ledger + '.tmp')).isDirectory(), true);
});
