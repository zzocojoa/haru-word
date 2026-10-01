import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { collectFreeComparison, validateFreeComparison } from '../scripts/evaluate-free-feedback.mjs';
import { originalComparisonFixture } from '../scripts/evaluate-original-feedback.mjs';
import { replayAccuracyCauses, runCauseReplay } from '../scripts/replay-accuracy-causes.mjs';

globalThis.accuracyDiagnosticsEnv = {};
await build({ entryPoints: { wire: 'lib/chunked-feedback.ts', detail: 'lib/feedback-validation-detail.ts',
  helper: 'lib/free-feedback-evaluation.ts', contract: 'lib/provider-feedback-contract.ts',
  route: 'app/api/english-accuracy-evaluation/route.ts', issue: 'lib/feedback-issue.ts' },
  outdir: 'work/accuracy-diagnostics-tests', bundle: true, splitting: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
  plugins: [{ name: 'synthetic-env', setup(b) { b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export const env=globalThis.accuracyDiagnosticsEnv', loader: 'js' })); } }],
});
const wire = await import('../work/accuracy-diagnostics-tests/wire.mjs'), detail = await import('../work/accuracy-diagnostics-tests/detail.mjs');
const helper = await import('../work/accuracy-diagnostics-tests/helper.mjs'), contract = await import('../work/accuracy-diagnostics-tests/contract.mjs');
const route = await import('../work/accuracy-diagnostics-tests/route.mjs'), issue = await import('../work/accuracy-diagnostics-tests/issue.mjs');
const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'), fixture = JSON.parse(fixtureText);
const published = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-01-chunked-free.json', 'utf8'));
const content = () => ({ meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: 'I read books.', explanation: '검증용입니다.',
  structure: { status: 'available', translation: '나는 책을 읽어요.', parts: [{ wordCount: 3, role: 'X', explanation: '검증용입니다.' }], note: '' } });
const reject = value => { let error; try { wire.parseChunkedFeedback(JSON.stringify(value), 'I read books.', helper.accuracyModels.google); } catch (e) { error = e; }
  assert.ok(error); return error; };
const bodyFor = (value, provider) => provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }
  : { model: helper.accuracyModels.groq, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] };

test('wire failures report the exact fixed field and category without retaining any value', () => {
  const variants = [
    [v => { delete v.structure.parts[0].role; }, 'structure.parts[].role', 'missing'],
    [v => { v.structure.parts[0].wordCount = 'SECRET_VALUE'; }, 'structure.parts[].wordCount', 'type'],
    [v => { v.structure.parts[0].wordCount = 1.5; }, 'structure.parts[].wordCount', 'integer'],
    [v => { v.structure.parts[0].wordCount = 0; }, 'structure.parts[].wordCount', 'too_small'],
    [v => { v.structure.parts[0].role = 'SECRET_VALUE'; }, 'structure.parts[].role', 'enum'],
    [v => { v.structure.parts[0].SECRET_KEY = 'SECRET_VALUE'; }, 'structure.parts', 'unexpected_keys'],
    [v => { v.explanation = 'SECRET_VALUE'.repeat(200); }, 'explanation', 'too_large'],
    [v => { delete v.structure; }, 'structure', 'missing'],
  ];
  for (const [change, field, reason] of variants) {
    const v = content(); change(v); const error = reject(v), safe = detail.parseFeedbackValidationDetail(error.validationDetail);
    assert.equal(error.stage, 'fields'); assert.equal(error.diagnostic, 'wire_fields');
    // Unrecognized keys on a part have a path ending in the array index.
    const expectedField = reason === 'unexpected_keys' ? 'other' : field;
    assert.deepEqual(safe, { kind: 'schema', issues: [{ field: expectedField, reason }], truncated: false });
    assert.doesNotMatch(JSON.stringify(error), /SECRET_KEY|SECRET_VALUE/);
  }
});
test('token underflow and overflow retain exact bounded counts and part index', () => {
  const under = content(); under.structure.parts[0].wordCount = 2;
  assert.deepEqual(reject(under).validationDetail, { kind: 'tokens', reason: 'leftover_tokens', tokenCount: 3, consumedTokens: 2 });
  const over = content(); over.structure.parts = [{ wordCount: 1, role: 'S', explanation: '주어' }, { wordCount: 3, role: 'V', explanation: '동사' }];
  assert.deepEqual(reject(over).validationDetail, { kind: 'tokens', reason: 'part_exceeds_tokens', tokenCount: 3, consumedTokens: 1, requestedTokens: 3, partIndex: 1 });
  assert.ok(detail.parseFeedbackValidationDetail(reject(over).validationDetail));
  assert.equal(detail.parseFeedbackValidationDetail({ ...reject(over).validationDetail, requestedTokens: 1 }), undefined);
});
test('malicious or inconsistent metadata is rejected and long issue lists are bounded', () => {
  const safe = reject({ ...content(), meaningUsage: 'wrong' }).validationDetail;
  for (const v of [{ ...safe, message: 'SECRET' }, { kind: 'schema', issues: [{ field: 'SECRET', reason: 'type' }], truncated: false },
    { kind: 'tokens', reason: 'part_exceeds_tokens', tokenCount: 3, consumedTokens: 0 },
    { kind: 'tokens', reason: 'leftover_tokens', tokenCount: 3, consumedTokens: 3 }, { ...safe, issues: Array(9).fill(safe.issues[0]) }]) {
    assert.equal(detail.parseFeedbackValidationDetail(v), undefined);
  }
  assert.equal(detail.parseFeedbackValidationDetail(safe, { stage: 'structure', diagnostic: 'chunk_count' }), undefined);
  const invalid = content(); invalid.structure.parts = Array.from({ length: 20 }, () => ({ wordCount: 'SECRET', role: 'SECRET', explanation: '' }));
  const capped = reject(invalid).validationDetail; assert.equal(capped.issues.length, 8); assert.equal(capped.truncated, true);
  assert.doesNotMatch(JSON.stringify(capped), /SECRET/);
});
test('current prompt, wire schema and all60 request hashes remain frozen', async () => {
  for (const sample of helper.accuracyCases) {
    const hashes = await helper.freeAccuracyHashes(sample);
    assert.equal(hashes.requestHash, published.requestHashes[sample.id]);
    assert.equal(hashes.promptHash, published.promptHashes[sample.domain]);
  }
});
test('both provider transports retain safe detail internally and learner error body stays unchanged', async () => {
  for (const provider of ['google', 'groq']) {
    const value = content(); value.structure.parts[0].wordCount = 'SECRET';
    await assert.rejects(helper.evaluateFreeAccuracyCase({ google_api: 'test-only', groq_api: 'test-only' }, provider, helper.accuracyCases[0],
      async () => Response.json(bodyFor(value, provider))), error => {
      assert.equal(error.validationDetail.issues[0].field, 'structure.parts[].wordCount');
      assert.equal(error.validationDetail.issues[0].reason, 'type');
      const learner = issue.feedbackErrorBody(error.code, error.issue);
      assert.equal(learner.validationDetail, undefined); assert.equal(learner.diagnostic, undefined);
      assert.doesNotMatch(JSON.stringify(error), /SECRET/); return true;
    });
  }
});
test('only authenticated fixed-case comparison exposes safe detail, legacy and closed routes do not', async () => {
  const token = 'e'.repeat(64), original = globalThis.fetch; let calls = 0;
  const request = body => new Request('https://study.test/api/english-accuracy-evaluation', { method: 'POST', headers: {
    Origin: 'https://study.test', 'Content-Type': 'application/json', 'X-English-Accuracy-Token': token }, body: JSON.stringify(body) });
  try {
    Object.assign(accuracyDiagnosticsEnv, { english_accuracy_token: token, english_accuracy_expires: new Date(Date.now() + 60000).toISOString(),
      english_accuracy_profile: 'chunked-free-v1', google_api: 'test-only', groq_api: 'test-only' });
    globalThis.fetch = async url => { calls++; const v = content(); v.structure.parts[0].role = 'SECRET'; return Response.json(bodyFor(v, url.includes('googleapis') ? 'google' : 'groq')); };
    for (const provider of ['google', 'groq']) {
      const response = await route.POST(request({ caseId: fixture.cases[0].id, provider, comparison: 'chunked-free-v1' }));
      assert.equal(response.status, 502); const result = await response.json();
      assert.deepEqual(result.validationDetail, { kind: 'schema', issues: [{ field: 'structure.parts[].role', reason: 'enum' }], truncated: false });
      assert.doesNotMatch(JSON.stringify(result), /SECRET/);
    }
    delete accuracyDiagnosticsEnv.english_accuracy_profile;
    const legacy = await (await route.POST(request({ caseId: fixture.cases[0].id, provider: 'google', round: 1 }))).json();
    assert.equal(legacy.validationDetail, undefined);
    delete accuracyDiagnosticsEnv.english_accuracy_token;
    const closed = await route.POST(request({ caseId: fixture.cases[0].id, provider: 'google', comparison: 'chunked-free-v1' }));
    assert.equal(closed.status, 404); assert.equal(calls, 3);
  } finally { globalThis.fetch = original; for (const key of Object.keys(accuracyDiagnosticsEnv)) delete accuracyDiagnosticsEnv[key]; }
});
test('collector persists only bounded, matching details and completed recovery does no HTTP', async () => {
  const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), cases = helper.accuracyCases, profiles = {};
  for (const sample of cases) profiles[sample.id] = { domain: sample.domain, ...await helper.freeAccuracyHashes(sample) };
  const expected = { ...originalComparisonFixture(fixtureText, published.fixtureHash), sourceCommit: 'a'.repeat(40), profiles, models: helper.accuracyModels };
  const previous = [1, 2, 3].flatMap(round => cases.flatMap(sample => ['google', 'groq'].map(provider => ({ round, caseId: sample.id, provider,
    fixtureHash: expected.fixtureHash, expectedModel: expected.models[provider], status: 'failure' })))).map((v, i) => ({ ...v, number: i + 1 }));
  const ledger = { comparison: 'chunked-free-v1', approvedCalls: 120, freeTierConfirmation: 'human-user', previousHash: digest(previous), ...expected, providerStops: {}, attempts: [] };
  const context = { previous, ledger, cases, expected, config: { origin: 'https://study.test', evaluationToken: 'test-only' },
    safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS,
    parseFeedback: helper.parseOriginalAccuracyFeedback, parseValidationDetail: detail.parseFeedbackValidationDetail };
  let calls = 0; const safe = reject({ ...content(), meaningUsage: 'wrong' }).validationDetail;
  await collectFreeComparison(context, { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => {
    calls++; const { provider } = JSON.parse(init.body); return Response.json({ code: provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response',
      validationStage: 'fields', diagnostic: 'wire_fields', validationDetail: calls === 1 ? { ...safe, message: 'SECRET' } : safe }, { status: 502 });
  } });
  assert.equal(calls, 120); assert.equal(ledger.attempts[0].validationDetail, undefined); assert.deepEqual(ledger.attempts[1].validationDetail, safe);
  assert.doesNotMatch(JSON.stringify(ledger), /SECRET/); validateFreeComparison(previous, ledger, expected, detail.parseFeedbackValidationDetail);
  await collectFreeComparison(context, { save: () => { throw Error('no save'); }, fetcher: async () => { throw Error('no HTTP'); } });
  ledger.attempts[1].validationDetail.message = 'SECRET';
  await assert.rejects(collectFreeComparison(context, { save: () => {}, fetcher: async () => { throw Error('no HTTP'); } }), /Invalid safe validation detail/);
});
test('offline replay proves semantic coverage gap while preserving all frozen judgments and scores', async () => {
  const copy = structuredClone(published), replay = replayAccuracyCauses(published, fixture, contract.parseProviderFeedback);
  assert.equal(replay.validResponses, 95); assert.equal(replay.parserAccepted, 95);
  assert.equal(replay.knownSemanticFailures, 17); assert.equal(replay.knownSemanticFailuresAccepted, 17);
  assert.deepEqual(replay.failedDimensions, { meaning: 6, grammar: 4, correction: 1, structure: 10 });
  assert.equal(replay.unavailableOutputs, 25); assert.ok(replay.unavailable.every(r => r.exactCause === 'not_recorded'));
  assert.deepEqual(replay.frozenScores, { google: 44, groq: 34 }); assert.deepEqual(published, copy);
  const original = globalThis.fetch; globalThis.fetch = () => { throw Error('no live HTTP'); };
  try { const current = await runCauseReplay(); assert.equal(current.actualProviderCalls, 0); assert.equal(current.knownSemanticFailuresAccepted, 17); }
  finally { globalThis.fetch = original; }
  assert.throws(() => execFileSync(process.execPath, ['scripts/replay-accuracy-causes.mjs', '--live'], { stdio: 'pipe' }), e => e.status === 1);
});
test('actual CLI resumes and recovers detailed terminal ledgers without generating any new provider request', async () => {
  const directory = mkdtempSync(resolve('work', 'free-cli-recovery-'));
  const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), cases = helper.accuracyCases, profiles = {};
  for (const sample of cases) profiles[sample.id] = { domain: sample.domain, ...await helper.freeAccuracyHashes(sample) };
  const fixtureHashes = originalComparisonFixture(fixtureText, published.fixtureHash), models = helper.accuracyModels;
  const previous = [1, 2, 3].flatMap(round => cases.flatMap(sample => ['google', 'groq'].map(provider => ({ round, caseId: sample.id, provider,
    fixtureHash: fixtureHashes.fixtureHash, expectedModel: models[provider], status: 'failure' })))).map((v, i) => ({ ...v, number: i + 1 }));
  const put = (name, value) => { const path = resolve(directory, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  put('.gitignore', '.sites-runtime/\n'); put('package.json', '{"type":"module"}');
  for (const file of ['scripts/evaluate-free-feedback.mjs', 'scripts/evaluate-original-feedback.mjs', 'scripts/evaluate-english-accuracy.mjs', 'lib/feedback-validation-detail.ts']) put(file, readFileSync(file, 'utf8'));
  put('tests/fixtures/english-accuracy.json', fixtureText);
  put('data/evaluations/english-accuracy-2026-10-01-original-first.json', { fixtureHash: published.fixtureHash,
    previousLedgerHash: digest(previous.slice(0, 240)), ledgerHash: digest(previous.slice(240)) });
  put('lib/free-feedback-evaluation.ts', `export const accuracyCases=${JSON.stringify(cases)};
export const accuracyModels=${JSON.stringify(models)}; const profiles=${JSON.stringify(profiles)};
export async function freeAccuracyHashes(sample){return profiles[sample.id];}
export const FEEDBACK_ISSUES={provider_invalid_response:[],groq_invalid_response:[]};
export const FEEDBACK_VALIDATION_STAGES=['fields'];export const FEEDBACK_DIAGNOSTICS=['wire_fields'];
export function parseOriginalAccuracyFeedback(){throw Error('No provider responses in this test');}`);
  // A clean local repository exercises the real source guard on the resume path.
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); git(['add', '.']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic CLI recovery']);
  const sourceCommit = git(['rev-parse', 'HEAD']);
  put('.sites-runtime/english-accuracy/ledger.json', { attempts: previous.slice(0, 240) });
  put('.sites-runtime/english-accuracy/original-first/ledger.json', { attempts: previous.slice(240) });
  const counter = resolve(directory, '.sites-runtime/network.json'), preload = resolve(directory, '.sites-runtime/offline-preload.mjs');
  put('.sites-runtime/offline-preload.mjs', `import{writeFileSync}from'node:fs';let requests=0;
globalThis.fetch=async()=>{requests++;return Response.json({code:'evaluation_invalid_case'},{status:400});};
process.on('exit',()=>writeFileSync(${JSON.stringify(counter)},JSON.stringify({mockedPreflightRequests:requests,actualProviderCalls:0})));`);
  const safe = reject({ ...content(), meaningUsage: 'wrong' }).validationDetail;
  const attempts = cases.flatMap(sample => ['google', 'groq'].map(provider => ({ number: 0, round: 4, comparison: 'chunked-free-v1', caseId: sample.id, provider,
    domain: sample.domain, ...fixtureHashes, expectedModel: models[provider], ...profiles[sample.id], status: 'failure',
    code: provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response', validationStage: 'fields', diagnostic: 'wire_fields', validationDetail: safe }))).map((v, i) => ({ ...v, number: 361 + i }));
  const ledger = { comparison: 'chunked-free-v1', approvedCalls: 120, freeTierConfirmation: 'human-user', previousHash: digest(previous),
    ...fixtureHashes, sourceCommit, profiles, models, providerStops: {}, attempts, completed: true };
  const config = { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit };
  const run = () => execFileSync(process.execPath, ['--import', pathToFileURL(preload).href, resolve(directory, 'scripts/evaluate-free-feedback.mjs'), '--live', '--confirmed-free-tier', '--approved-calls', '120'],
    { cwd: directory, env: { ...process.env, CI: '' }, input: JSON.stringify(config) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  for (const completed of [true, false]) {
    ledger.completed = completed; put('.sites-runtime/english-accuracy/chunked-free-v1/ledger.json', ledger);
    const output = run(); assert.ok(JSON.parse(output.trim().split(/\r?\n/).at(-1)).complete);
    assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { mockedPreflightRequests: completed ? 0 : 1, actualProviderCalls: 0 });
    const saved = JSON.parse(readFileSync(resolve(directory, '.sites-runtime/english-accuracy/chunked-free-v1/ledger.json'), 'utf8'));
    assert.equal(saved.completed, true); assert.equal(saved.attempts.length, 120); assert.deepEqual(saved.attempts, attempts);
  }
  // Restore only the reviewed main() omission and prove both actual CLI paths
  // fail before even the mocked preflight, with the source guard still valid.
  const cli = readFileSync('scripts/evaluate-free-feedback.mjs', 'utf8'), mainStart = cli.indexOf('async function main(){');
  const body = cli.slice(mainStart); assert.equal(body.split(',parseValidationDetail);').length - 1, 2);
  put('scripts/evaluate-free-feedback.mjs', cli.slice(0, mainStart) + body.replaceAll(',parseValidationDetail);', ');'));
  git(['add', 'scripts/evaluate-free-feedback.mjs']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Restore missing validator mutation']);
  ledger.sourceCommit = config.sourceCommit = git(['rev-parse', 'HEAD']);
  for (const completed of [true, false]) {
    ledger.completed = completed; put('.sites-runtime/english-accuracy/chunked-free-v1/ledger.json', ledger);
    assert.throws(run, e => e.status === 1);
    assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { mockedPreflightRequests: 0, actualProviderCalls: 0 });
  }
});
test('parallel replay uses independent bundles and atomic output while keeping identical parser evidence', async () => {
  const [a, b] = await Promise.all([runCauseReplay(), runCauseReplay()]);
  assert.equal(a.actualProviderCalls, 0); assert.equal(b.actualProviderCalls, 0);
  assert.equal(a.parserBundleHash, b.parserBundleHash); assert.deepEqual(a.parserSourceHashes, b.parserSourceHashes);
  const saved = JSON.parse(readFileSync('.sites-runtime/english-accuracy/cause-replay.json', 'utf8'));
  assert.equal(saved.knownSemanticFailuresAccepted, 17); assert.equal(saved.rows.length, 95);
  const publicReplay = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-01-cause-replay.json', 'utf8'));
  assert.deepEqual(saved, publicReplay);
});
