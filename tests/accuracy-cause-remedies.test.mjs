import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { assertCauseLiveArguments, causeReviewBundle, collectCauseComparison, validateCauseComparison, validateCauseParents } from '../scripts/evaluate-accuracy-causes.mjs';
import { reviewBundle } from '../scripts/evaluate-english-accuracy.mjs';
import { originalComparisonFixture } from '../scripts/evaluate-original-feedback.mjs';
const directory = mkdtempSync(resolve('work', 'cause-remedies-tests-'));
async function bundle(entry, name) {
  const file = resolve(directory, name + '.mjs');
  await build({ entryPoints: [entry], outfile: file, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'mock-env', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const env=globalThis.__causeRemediesEnv;', loader: 'js' }));
  } }] });
  return import(pathToFileURL(file).href);
}
globalThis.__causeRemediesEnv = {};
const helper = await bundle('lib/accuracy-cause-evaluation.ts', 'helper'), legacy = await bundle('lib/free-feedback-evaluation.ts', 'legacy');
const candidate = await bundle('lib/accuracy-cause-candidate.ts', 'candidate'), api = await bundle('app/api/english-accuracy-evaluation/route.ts', 'route');
const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'), fixture = JSON.parse(fixtureText);
const frozenText = readFileSync('data/evaluations/english-accuracy-2026-10-01-chunked-free.json', 'utf8'), frozen = JSON.parse(frozenText);
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), textHash = s => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const cases = helper.accuracyCases, schedule = helper.causeSchedule(), profiles = {};
for (const r of schedule) profiles[`${r.caseId}:${r.variant}`] ??= { domain: cases.find(c => c.id === r.caseId).domain, ...await helper.causeAccuracyHashes(cases.find(c => c.id === r.caseId), r.variant) };
const previous = [1, 2, 3, 4].flatMap(round => cases.flatMap(c => ['google', 'groq'].map(provider => ({ round, caseId: c.id, provider, status: 'failure' })))).map((r, i) => ({ ...r, number: i + 1 }));
const expected = { ...originalComparisonFixture(fixtureText, frozen.fixtureHash), previousHash: hash(previous), planHash: hash(helper.rootCausePlan),
  sourceCommit: 'a'.repeat(40), profiles, models: helper.accuracyModels, schedule };
const fresh = () => ({ comparison: 'root-cause-v1', maximumCalls: 60, freeTierConfirmation: 'human-user', ...structuredClone(expected), providerStops: {}, attempts: [] });
const context = ledger => ({ previous, ledger, expected, cases, config: { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64) },
  safeCodes: [...Object.keys(helper.FEEDBACK_ISSUES), 'evaluation_disabled', 'evaluation_unauthorized', 'evaluation_invalid_request', 'evaluation_invalid_case', 'evaluation_key_missing'],
  validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS, parseFeedback: helper.parseOriginalAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail });
const detail = { kind: 'schema', issues: [{ field: 'meaningUsage', reason: 'enum' }], truncated: false };
const failure = provider => ({ code: provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response', validationStage: 'fields', diagnostic: 'wire_fields', validationDetail: detail });
const wire = sentence => ({ meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: sentence, explanation: '원문의 뜻과 문법을 확인했어요.',
  structure: { status: 'available', translation: '그녀의 선물은 책이었어요.', parts: [{ wordCount: 2, role: 'S', explanation: '선물을 나타내는 주어 명사구' },
    { wordCount: 1, role: 'V', explanation: '연결동사' }, { wordCount: 2, role: 'C', explanation: '주어를 설명하는 명사 보어' }], note: '' } });
const request = body => new Request('https://wordgrain-oxford-study.hoihou-o.chatgpt.site/api/english-accuracy-evaluation', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', 'X-English-Accuracy-Token': 'f'.repeat(64) }, body: JSON.stringify(body) });

test('registered15 inputs cover all17 frozen language failures once and sixty slots are counterbalanced', () => {
  const plan = helper.rootCausePlan;
  assert.equal(plan.cases.length, 15); assert.equal(schedule.length, 60); assert.equal(new Set(plan.cases.map(c => c.caseId)).size, 15);
  assert.equal(textHash(frozenText), plan.sourceArtifactContentHash); assert.equal(textHash(fixtureText), plan.fixtureContentHash);
  const registered = plan.cases.flatMap(c => c.failures.map(f => `${c.caseId}:${f.provider}:${f.label}`)).sort();
  const failed = frozen.rows.filter(r => r.status === 'response' && r.overall === 'fail').map(r => `${r.caseId}:${r.provider}:${r.label}`).sort();
  assert.deepEqual(registered, failed);
  for (let i = 0; i < schedule.length; i += 2) {
    const [a, b] = schedule.slice(i, i + 2); assert.equal(a.caseId, b.caseId); assert.equal(a.provider, b.provider);
    assert.deepEqual(new Set([a.variant, b.variant]), new Set(['control', a.family]));
  }
  assert.equal(schedule.filter((r, i) => i % 2 === 0 && r.variant === 'control').length, 15);
});
test('each candidate adds exactly one general instruction and leaves control, inputs, schema and historical hashes unchanged', async () => {
  for (const entry of helper.rootCausePlan.cases) {
    const sample = cases.find(c => c.id === entry.caseId), base = legacy.freeAccuracyRequest(sample), control = helper.causeAccuracyRequest(sample, 'control');
    assert.deepEqual(control, base); assert.deepEqual(helper.causeAccuracyRequest(sample, entry.family), { ...base, instruction: base.instruction + candidate.causeInstructions[entry.family] });
    assert.equal((await helper.causeAccuracyHashes(sample, 'control')).promptHash, (await legacy.freeAccuracyHashes(sample)).promptHash);
    for (const c of fixture.cases) for (const answer of [c.sentence, ...c.expected.correction.examples]) if (answer) assert.ok(!candidate.causeInstructions[entry.family].includes(answer));
    assert.doesNotMatch(candidate.causeInstructions[entry.family], /B\d{3}|word-\d+|grammar-\d+/);
  }
  for (const sample of cases) assert.deepEqual(await legacy.freeAccuracyHashes(sample), { promptHash: frozen.promptHashes[sample.domain], requestHash: frozen.requestHashes[sample.id] });
  assert.throws(() => helper.causeAccuracyRequest(cases.find(c => c.id === 'word-01'), 'control'));
});
test('provider control bodies are byte equivalent; variants only change the instruction through existing transports', async () => {
  const sample = cases.find(c => c.id === 'word-08'), payload = wire(sample.sentence);
  for (const provider of ['google', 'groq']) {
    const bodies = [], fetcher = async (url, init) => { bodies.push(JSON.parse(init.body)); return Response.json(provider === 'google'
      ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(payload) }] } }] }
      : { model: helper.accuracyModels.groq, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] }); };
    await legacy.evaluateFreeAccuracyCase({ google_api: 'mock', groq_api: 'mock' }, provider, sample, fetcher);
    await helper.evaluateCauseAccuracyCase({ google_api: 'mock', groq_api: 'mock' }, provider, sample, 'control', fetcher);
    await helper.evaluateCauseAccuracyCase({ google_api: 'mock', groq_api: 'mock' }, provider, sample, 'roles', fetcher);
    assert.deepEqual(bodies[0], bodies[1]);
    const change = structuredClone(bodies[2]);
    if (provider === 'google') change.systemInstruction = bodies[0].systemInstruction; else change.messages = bodies[0].messages;
    assert.deepEqual(change, bodies[0]); assert.equal(bodies.length, 3);
  }
});
test('fixed-case API requires its explicit profile, rejects learner data/wrong variants before fetch, and preserves detailed failures', async () => {
  const env = globalThis.__causeRemediesEnv, previousFetch = globalThis.fetch; let calls = 0;
  Object.assign(env, { english_accuracy_token: 'f'.repeat(64), english_accuracy_expires: new Date(Date.now() + 600000).toISOString(), google_api: 'mock', groq_api: 'mock' });
  globalThis.fetch = async () => { calls++; return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(wire('Her present was a book.')) }] } }] }); };
  try {
    const body = { caseId: 'word-08', provider: 'google', comparison: 'root-cause-v1', variant: 'roles' };
    assert.equal((await api.POST(request(body))).status, 404); assert.equal(calls, 0);
    env.english_accuracy_profile = 'root-cause-v1';
    for (const changed of [{ ...body, caseId: 'word-01' }, { ...body, variant: 'rules' }, { ...body, variant: 'unknown' }, { ...body, sentence: 'PRIVATE' }, { caseId: 'word-08', provider: 'google', comparison: 'chunked-free-v1' }]) assert.equal((await api.POST(request(changed))).status, 400);
    const unauthorized = request(body); unauthorized.headers.set('X-English-Accuracy-Token', 'e'.repeat(64)); assert.equal((await api.POST(unauthorized)).status, 401); assert.equal(calls, 0);
    const response = await api.POST(request(body)), result = await response.json(); assert.equal(response.status, 200); assert.equal(result.variant, 'roles'); assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; const invalid = wire('Her present was a book.'); invalid.meaningUsage = 'PRIVATE'; return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(invalid) }] } }] }); };
    const error = await api.POST(request(body)), safe = await error.json(); assert.equal(error.status, 502); assert.deepEqual(safe.validationDetail, detail); assert.doesNotMatch(JSON.stringify(safe), /PRIVATE/);
    delete env.english_accuracy_token; assert.equal((await api.POST(request(body))).status, 404); assert.equal(calls, 2);
  } finally { globalThis.fetch = previousFetch; for (const key of Object.keys(env)) delete env[key]; }
});
test('collector records every one of60 slots before fetch, retains only safe detail and completed recovery does no HTTP', async () => {
  const ledger = fresh(), frozenParents = structuredClone(previous); let calls = 0;
  await collectCauseComparison(context(ledger), { pause: async () => {}, save: () => {}, fetcher: async (_url, init) => {
    const body = JSON.parse(init.body), row = ledger.attempts.at(-1); assert.equal(row.status, 'started'); assert.equal(row.number, 481 + calls++);
    assert.equal(row.variant, body.variant); const content = failure(body.provider); if (calls === 1) content.validationDetail = { ...detail, body: 'PRIVATE' };
    return Response.json(content, { status: 502 });
  } });
  assert.equal(calls, 60); assert.equal(ledger.completed, true); assert.equal(ledger.attempts[0].validationDetail, undefined); assert.deepEqual(ledger.attempts[1].validationDetail, detail);
  assert.deepEqual(previous, frozenParents); assert.doesNotMatch(JSON.stringify(ledger), /PRIVATE/); validateCauseComparison(previous, ledger, expected, helper.parseFeedbackValidationDetail);
  const blind = reviewBundle(ledger.attempts, 5); assert.equal(blind.blinded.length, 60); assert.doesNotMatch(JSON.stringify(blind.blinded), /"(?:variant|provider|family|scheduleIndex|promptHash|requestHash|number)"\s*:/);
  await collectCauseComparison(context(ledger), { save: () => assert.fail('no save'), fetcher: () => assert.fail('no HTTP') });
  for (const mutation of [x => x.attempts[1].variant = 'target', x => x.attempts[1].requestHash = '0'.repeat(64), x => x.attempts[1].validationDetail.message = 'PRIVATE', x => x.maximumCalls = 120]) {
    const changed = structuredClone(ledger); mutation(changed); assert.throws(() => validateCauseComparison(previous, changed, expected, helper.parseFeedbackValidationDetail));
  }
});
test('interruption consumes its slot; resume never retries it and provider/endpoint stops persist', async () => {
  const ledger = fresh(), stop = new AbortController(); let calls = 0;
  await assert.rejects(collectCauseComparison(context(ledger), { signal: stop.signal, save: () => {}, pause: async () => {}, fetcher: async () => { calls++; stop.abort(Error('synthetic stop')); throw Error('network'); } }), /synthetic stop/);
  assert.equal(ledger.attempts.length, 1); assert.equal(ledger.attempts[0].status, 'failure');
  await collectCauseComparison(context(ledger), { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => { calls++; return Response.json(failure(JSON.parse(init.body).provider), { status: 502 }); } });
  assert.equal(calls, 60); assert.equal(ledger.attempts[0].number, 481);
  for (const [status, content, expectedCalls] of [[429, null, 31], [503, { code: 'provider_unavailable', providerStatus: 402 }, 31], [404, { code: 'evaluation_disabled' }, 1]]) {
    const stopped = fresh(); let count = 0;
    await collectCauseComparison(context(stopped), { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => { count++; return count === 1
      ? content ? Response.json(content, { status }) : new Response('PRIVATE', { status }) : Response.json(failure(JSON.parse(init.body).provider), { status: 502 }); } });
    assert.equal(count, expectedCalls); assert.equal(stopped.completed, true); validateCauseComparison(previous, stopped, expected, helper.parseFeedbackValidationDetail);
    await collectCauseComparison(context(stopped), { save: () => {}, fetcher: () => assert.fail('stop survives resume') });
  }
});
test('parent hashes prevent changing or extending the frozen480 and success metadata/quotas are bounded', async () => {
  const arrays = [previous.slice(0, 240), previous.slice(240, 360), previous.slice(360)], plan = { previousCalls: 480, maximumCalls: 60, parentLedgerHashes: arrays.map(hash), combinedParentHash: hash(previous) };
  validateCauseParents(arrays, plan); const changed = structuredClone(arrays); changed[1][0].caseId = 'PRIVATE'; assert.throws(() => validateCauseParents(changed, plan));
  assert.throws(() => validateCauseParents([...arrays, []], plan)); assert.throws(() => validateCauseParents(arrays, { ...plan, maximumCalls: 61 }));
  const ledger = fresh(), delays = []; let count = 0;
  await collectCauseComparison(context(ledger), { save: () => {}, pause: async ms => delays.push(ms), fetcher: async (_url, init) => {
    const body = JSON.parse(init.body), sample = cases.find(c => c.id === body.caseId), p = profiles[`${body.caseId}:${body.variant}`]; count++;
    return Response.json({ ...body, ...p, feedback: { meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', explanation: '모의 전송 검사이며 영어 판정 결과가 아닙니다.',
      structure: { status: 'unavailable', translation: '', parts: [], note: '모의 출력' }, original: sample.sentence, model: helper.accuracyModels[body.provider], createdAt: new Date().toISOString() },
      quota: count === 1 ? { remainingTokens: 10, resetTokensSeconds: 1, raw: 'PRIVATE' } : {} });
  } });
  assert.equal(ledger.attempts.filter(a => a.status === 'response').length, 60); assert.deepEqual(ledger.attempts[0].quota, { remainingTokens: 10, resetTokensSeconds: 1 });
  assert.equal(delays[0], 1000); assert.ok(delays.every(ms => ms <= 30000)); assert.doesNotMatch(JSON.stringify(ledger), /PRIVATE/);
  const altered = structuredClone(ledger); altered.schedule.reverse(); assert.throws(() => validateCauseComparison(previous, altered, expected, helper.parseFeedbackValidationDetail));
  validateCauseComparison(previous, ledger, expected, helper.parseFeedbackValidationDetail, helper.parseOriginalAccuracyFeedback, cases);
  for (const mutation of [f => f.original = 'Changed input.', f => f.model = 'unknown', f => f.meaningUsage = 'unknown', f => f.provider = 'google']) {
    for (const completed of [true, false]) {
      const corrupted = structuredClone(ledger); corrupted.completed = completed; mutation(corrupted.attempts[0].feedback);
      assert.throws(() => validateCauseComparison(previous, corrupted, expected, helper.parseFeedbackValidationDetail, helper.parseOriginalAccuracyFeedback, cases));
      await assert.rejects(collectCauseComparison(context(corrupted), { save: () => assert.fail('no save'), fetcher: () => assert.fail('no network') }));
    }
  }
  const review = causeReviewBundle(ledger.attempts); assert.deepEqual(causeReviewBundle(ledger.attempts, review), review);
  for (const mutation of [r => r.blinded[0].provider = 'google', r => r.blinded[0].feedback.explanation = 'Changed', r => r.mapping[0].number++, r => r.blindHash = '0'.repeat(64)]) {
    const corrupt = structuredClone(review); mutation(corrupt); assert.throws(() => causeReviewBundle(ledger.attempts, corrupt));
  }
});
test('actual CLI completed/terminal recovery makes no provider request and detects omitted validation or invalid opt-in', async () => {
  assertCauseLiveArguments(['--live', '--confirmed-free-tier', '--approved-calls', '60'], '');
  for (const args of [[], ['--live', '--confirmed-free-tier', '--approved-calls', '61'], ['60', '--live', '--confirmed-free-tier', 'unused']]) {
    assert.throws(() => assertCauseLiveArguments(args, ''));
    assert.throws(() => execFileSync(process.execPath, ['scripts/evaluate-accuracy-causes.mjs', ...args], { env: { ...process.env, CI: '' }, stdio: 'pipe' }), e => e.status === 1);
  }
  for (const args of [[], ['--live', '--confirmed-free-tier', '--approved-calls', '61'], ['--live', '--confirmed-free-tier', '--approved-calls', '60']]) {
    assert.throws(() => execFileSync(process.execPath, ['scripts/evaluate-accuracy-causes.mjs', ...args], { env: { ...process.env, CI: 'true' }, stdio: 'pipe' }), e => e.status === 1);
  }
  const sandbox = mkdtempSync(resolve('work', 'cause-cli-recovery-'));
  const put = (name, value) => { const path = resolve(sandbox, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  put('package.json', '{"type":"module"}'); put('.gitignore', '.sites-runtime/\n');
  for (const file of ['scripts/evaluate-accuracy-causes.mjs', 'scripts/evaluate-original-feedback.mjs', 'scripts/evaluate-english-accuracy.mjs', 'lib/feedback-validation-detail.ts']) put(file, readFileSync(file, 'utf8'));
  put('tests/fixtures/english-accuracy.json', fixtureText);
  const artifact = JSON.stringify({ fixtureHash: frozen.fixtureHash }), fakePlan = { ...helper.rootCausePlan, parentLedgerHashes: [previous.slice(0, 240), previous.slice(240, 360), previous.slice(360)].map(hash),
    combinedParentHash: hash(previous), sourceArtifactContentHash: textHash(artifact) };
  put(fakePlan.sourceArtifact, artifact);
  put('lib/accuracy-cause-evaluation.ts', `export {parseFeedbackValidationDetail} from './feedback-validation-detail';
export const rootCausePlan=${JSON.stringify(fakePlan)}, accuracyCases=${JSON.stringify(cases)}, accuracyModels=${JSON.stringify(helper.accuracyModels)};
const profiles=${JSON.stringify(profiles)};export function causeSchedule(){return ${JSON.stringify(schedule)};}
export async function causeAccuracyHashes(sample,variant){return profiles[sample.id+':'+variant];}
export const FEEDBACK_ISSUES={provider_invalid_response:[],groq_invalid_response:[]}, FEEDBACK_VALIDATION_STAGES=['fields'], FEEDBACK_DIAGNOSTICS=['wire_fields'];
export function parseOriginalAccuracyFeedback(){throw Error('No provider responses in this test');}`);
  const git = args => execFileSync('git', args, { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); git(['add', '.']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic cause CLI']);
  const root = '.sites-runtime/english-accuracy/';
  for (const [name, attempts] of [['ledger.json', previous.slice(0, 240)], ['original-first/ledger.json', previous.slice(240, 360)], ['chunked-free-v1/ledger.json', previous.slice(360)]]) put(root + name, { attempts });
  const counter = resolve(sandbox, root + 'network.json'), preload = resolve(sandbox, root + 'mock-network.mjs');
  put(root + 'mock-network.mjs', `import{writeFileSync}from'node:fs';let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({code:'evaluation_invalid_case'},{status:400});};
process.on('exit',()=>writeFileSync(${JSON.stringify(counter)},JSON.stringify({mockedPreflightRequests:requests,actualProviderCalls:0})));`);
  const ledger = { ...fresh(), planHash: hash(fakePlan), sourceCommit: git(['rev-parse', 'HEAD']), attempts: schedule.map((r, i) => ({ number: 481 + i, round: 5,
    comparison: 'root-cause-v1', scheduleIndex: i, ...r, domain: profiles[`${r.caseId}:${r.variant}`].domain, ...originalComparisonFixture(fixtureText, frozen.fixtureHash),
    expectedModel: helper.accuracyModels[r.provider], ...profiles[`${r.caseId}:${r.variant}`], status: 'failure', ...failure(r.provider) })) };
  const config = { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit: ledger.sourceCommit };
  const run = () => execFileSync(process.execPath, ['--import', pathToFileURL(preload).href, resolve(sandbox, 'scripts/evaluate-accuracy-causes.mjs'), '--live', '--confirmed-free-tier', '--approved-calls', '60'],
    { cwd: sandbox, env: { ...process.env, CI: '' }, input: JSON.stringify(config) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  for (const completed of [true, false]) {
    ledger.completed = completed; put(root + 'root-cause-v1/ledger.json', ledger); const output = run(); assert.ok(JSON.parse(output.trim().split(/\r?\n/).at(-1)).complete);
    assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { mockedPreflightRequests: completed ? 0 : 1, actualProviderCalls: 0 });
    assert.deepEqual(JSON.parse(readFileSync(resolve(sandbox, root + 'root-cause-v1/ledger.json'), 'utf8')).attempts, ledger.attempts);
  }
  const reviewPath = resolve(sandbox, root + 'root-cause-v1/review-bundle.json'), recovered = JSON.parse(readFileSync(reviewPath, 'utf8'));
  for (const mutation of [r => r.blinded[0].provider = 'google', r => r.blinded[0].variant = 'control', r => r.mapping[0].number++, r => r.blindHash = '0'.repeat(64)]) {
    for (const completed of [true, false]) {
      const corrupt = structuredClone(recovered); mutation(corrupt); put(root + 'root-cause-v1/review-bundle.json', corrupt);
      ledger.completed = completed; put(root + 'root-cause-v1/ledger.json', ledger); assert.throws(run, e => e.status === 1);
      assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { mockedPreflightRequests: 0, actualProviderCalls: 0 });
    }
  }
  put(root + 'root-cause-v1/review-bundle.json', recovered);
  const script = readFileSync('scripts/evaluate-accuracy-causes.mjs', 'utf8'), exact = 'validateCauseComparison(previous, ledger, expected, helper.parseFeedbackValidationDetail, helper.parseOriginalAccuracyFeedback, helper.accuracyCases);';
  assert.equal(script.split(exact).length - 1, 1); put('scripts/evaluate-accuracy-causes.mjs', script.replace(exact, exact.replace('helper.parseFeedbackValidationDetail', 'undefined')));
  git(['add', 'scripts/evaluate-accuracy-causes.mjs']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Missing validator mutation']);
  ledger.sourceCommit = config.sourceCommit = git(['rev-parse', 'HEAD']);
  for (const completed of [true, false]) { ledger.completed = completed; put(root + 'root-cause-v1/ledger.json', ledger); assert.throws(run, e => e.status === 1);
    assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { mockedPreflightRequests: 0, actualProviderCalls: 0 }); }
});
