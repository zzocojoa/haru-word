import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {PROTOCOL, PLAN, MODELS, digest, slotKey, newLedger, transition} from './ai-quality-v147-budget.mjs';
import {FAILURE_STAGES, stageForAppFailure, diagnoseFailure, failureJson} from './ai-quality-v147-failures.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(HERE, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8'));
const SOURCE = resolve(manifest.baseline.sourceRoot), contract = JSON.parse(readFileSync(resolve(SOURCE, manifest.currentDecisionContractFile), 'utf8'));
const root = resolve(process.env.QA_OUTPUT_DIR ?? resolve(SOURCE, 'work', `failure-test-${randomUUID()}`));
mkdirSync(root, {recursive: true});
const bundleFile = resolve(root, 'actual-app-adapter.mjs');
const compiled = await build({stdin: {contents: "export {generateOpenAiFeedback} from './lib/openai-feedback';export {openAiHttpError,OPENAI_RESPONSE_BYTES} from './lib/openai-response';export {sentenceFeedbackSchema} from './lib/sentence-feedback';export {FeedbackError} from './lib/provider-feedback-error';export {FEEDBACK_VALIDATION_STAGES,JUDGMENT_REJECTION_REASONS} from './lib/provider-feedback-contract';export {AI_PROMPT_VERSION} from './lib/ai-models';", resolveDir: SOURCE, loader: 'ts'}, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent'});
writeFileSync(bundleFile, compiled.outputFiles[0].text, {flag: 'wx'});
const app = await import(pathToFileURL(bundleFile).href), h = digest('public synthetic-only failure test');
const canary = 'SYNTHETIC_PRIVATE_SENTENCE sk-proj-SYNTHETIC-NOT-A-KEY Bearer SYNTHETIC-TOKEN';
const input = {sentence: 'Give help.', word: 'help', pos: 'n.', meaning: '도움', contextKind: 'command'};
const wire = () => ({meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: input.sentence,
  targetReason: '도움을 뜻합니다.', grammarReason: '요청하는 명령문입니다.', correctionReason: '', contextNeeded: 'none'});
const envelope = (text = JSON.stringify(wire())) => ({status: 'completed', model: MODELS[0], output: [{type: 'message', role: 'assistant', status: 'completed', content: [{type: 'output_text', text}]}], usage: {input_tokens: 10, output_tokens: 10}});
const config = {apiKey: 'SYNTHETIC_KEY_NEVER_REAL', modelId: MODELS[0], allowedModels: MODELS.join(',')};
const actualFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('REAL_NETWORK_FORBIDDEN'); };
test.after(() => { globalThis.fetch = actualFetch; });
const evidence = [];
function fixture(role = 'generation', consumed = true, mode = 'synthetic') {
  const d = {phase: role === 'calibration' ? 'calibration' : 'candidate', caseId: 'synthetic-case', modelId: role === 'judge' ? MODELS[1] : MODELS[0], targetModelId: MODELS[0], role, repetition: 1,
    inputTokenMax: 1000, outputTokenMax: role === 'generation' ? 4096 : 1000, inputBoundHash: h, bodyCommitment: h};
  const spec = {schemaVersion: 1, protocol: PROTOCOL, planId: PLAN, runId: randomUUID(), mode, sourceSeal: h,
    quote: {kind: mode === 'synthetic' ? 'synthetic-test' : 'verified-price', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1', models: Object.fromEntries(MODELS.map(id => [id, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'fixture', requests: [d]}]};
  // This in-memory structural fixture is not a real user authorization or quote.
  const key = slotKey(d), approval = {schemaVersion: 1, protocol: PROTOCOL, runId: spec.runId, specHash: digest(spec), kind: mode === 'synthetic' ? 'synthetic-test' : 'user-approval', amountMicros: '1000000', evidenceHash: h};
  let ledger = transition(spec, newLedger(spec, approval), {kind: 'reserve', batchId: 'fixture'});
  if (consumed) ledger = transition(spec, ledger, {kind: 'consume', key}); return {spec, ledger, key};
}
function diagnostic(f, stage, error, other = {}) {
  const before = digest(f.ledger), value = diagnoseFailure({...f, stage, error, ...other}), json = failureJson({...f, stage, error, ...other});
  assert.equal(digest(f.ledger), before); assert.equal(json, JSON.stringify(value)); assert.doesNotMatch(json, /SYNTHETIC_PRIVATE|sk-proj-|Bearer|SYNTHETIC-TOKEN/);
  assert.ok(Buffer.byteLength(json) < 2000); return value;
}
async function appFailure(fetcher, f = fixture(), settings = config) {
  let calls = 0, error;
  try { await app.generateOpenAiFeedback(settings, input, 'Trusted synthetic instruction.', async (...args) => { calls++; return fetcher(...args); }); }
  catch (e) { error = e; }
  assert.ok(error); const stage = stageForAppFailure(error), d = diagnostic(f, stage, error); evidence.push({stage, code: d.code, calls, diagnostic: d}); return {calls, error, diagnostic: d};
}

test('owned stages distinguish all execution boundaries and role-linked judge/calibration slots', () => {
  assert.equal(new Set(FAILURE_STAGES).size, 13);
  assert.equal(app.AI_PROMPT_VERSION, contract.promptVersion);
  assert.equal(Object.isFrozen(FAILURE_STAGES), true); assert.throws(() => FAILURE_STAGES.push(canary), TypeError);
  for (const stage of FAILURE_STAGES) {
    const f = fixture(stage.startsWith('judge_') ? 'judge' : 'generation');
    const d = diagnostic(f, stage, new Error(canary)); assert.equal(d.stage, stage); assert.equal(d.slotRetry, 'never-resend'); assert.equal(d.ledgerAction, 'unchanged');
  }
  assert.equal(diagnostic(fixture('calibration'), 'judge_body', new Error(canary)).role, 'calibration');
});
test('a local postprocessing TypeError is local, never transport inferred from its name or private message', () => {
  const f = fixture(), error = new TypeError('fetch network failed: ' + canary); error.code = 'provider_network';
  assert.equal(stageForAppFailure(error), 'unknown');
  const d = diagnostic(f, 'repackage', error); assert.equal(d.code, 'LOCAL_REPACKAGE_FAILURE'); assert.equal(d.category, 'local_failure'); assert.equal(d.nextAction, 'stop-run');
});
test('current adapter separates fetch rejection from an actual response reader rejection', async () => {
  const transport = await appFailure(async () => { throw new TypeError(canary); });
  assert.equal(transport.calls, 1); assert.equal(transport.diagnostic.stage, 'generation_transport'); assert.equal(transport.diagnostic.code, 'TRANSPORT_FAILURE');
  const body = await appFailure(async () => new Response(new ReadableStream({start(c) { c.error(new TypeError(canary)); }}), {headers: {'content-type': 'application/json'}}));
  assert.equal(body.calls, 1); assert.equal(body.diagnostic.stage, 'generation_body'); assert.equal(body.diagnostic.code, 'BODY_READ_FAILURE');
});
test('current adapter JSON syntax/schema failures are format failures without raw text or Zod values', async () => {
  for (const text of [canary, JSON.stringify({...wire(), extra: canary}), JSON.stringify({...wire(), grammar: canary})]) {
    const r = await appFailure(async () => Response.json(envelope(text))); assert.equal(r.diagnostic.stage, 'generation_format'); assert.equal(r.diagnostic.code, 'FORMAT_INVALID');
    assert.ok(['json_syntax', 'fields'].includes(r.diagnostic.validationStage)); assert.equal(r.diagnostic.nextAction, 'continue-other-slots');
  }
});
test('current app safety rejection is distinct from provider format failure and does not declare English incorrect', async () => {
  const value = {...wire(), correctedSentence: ''}, r = await appFailure(async () => Response.json(envelope(JSON.stringify(value))));
  assert.equal(r.diagnostic.stage, 'app_safety'); assert.equal(r.diagnostic.code, 'APP_SAFETY_REJECTED'); assert.equal(r.diagnostic.judgmentReason, 'natural_empty_correction');
  assert.equal(r.diagnostic.category, 'app_rejection'); assert.equal(Object.hasOwn(r.diagnostic, 'correct'), false);
});
test('an actual post-contract TypeError wrapped by current app stays unresolved rather than becoming a network failure', async t => {
  t.mock.method(app.sentenceFeedbackSchema, 'parse', () => { throw new TypeError(canary); });
  const r = await appFailure(async () => Response.json(envelope()));
  assert.equal(r.error.code, 'provider_invalid_response'); assert.equal(r.error.validationStage, 'envelope');
  assert.equal(r.diagnostic.stage, 'app_pipeline_unknown'); assert.equal(r.diagnostic.code, 'APP_PIPELINE_OR_ENVELOPE_UNKNOWN'); assert.equal(r.diagnostic.category, 'unknown'); assert.equal(r.diagnostic.nextAction, 'stop-run');
});
test('non-JSON HTTP402/429 stop the run, retain maximum, and never reinterpret error text as billing proof', async () => {
  for (const status of [402, 429]) {
    const r = await appFailure(async () => new Response(canary, {status, headers: {'content-type': 'text/html', 'retry-after': '1'}}));
    assert.equal(r.calls, 1); assert.equal(r.diagnostic.httpStatus, status); assert.equal(r.diagnostic.nextAction, 'stop-run'); assert.equal(r.diagnostic.costEvidence, 'maximum-retained');
    assert.equal(r.diagnostic.code, status === 402 ? 'HTTP_402_PAYMENT_REQUIRED' : 'HTTP_429_UNCLASSIFIED'); assert.equal(r.diagnostic.networkCalls, null);
  }
});
test('only allowlisted structured application codes distinguish billing/account limits within HTTP429', () => {
  const expected = [['insufficient_quota', 'HTTP_429_BILLING'], ['organization_usage_limit_exceeded', 'HTTP_429_ACCOUNT_LIMIT'], ['rate_limit_exceeded', 'HTTP_429_UNCLASSIFIED'], [canary, 'HTTP_429_UNCLASSIFIED']];
  for (const [code, result] of expected) {
    const error = app.openAiHttpError(429, {error: {code, message: canary, secret: canary}}, '1');
    const d = diagnostic(fixture(), stageForAppFailure(error), error); assert.equal(d.code, result); assert.equal(d.nextAction, 'stop-run');
  }
});
test('oversized current response is bounded and classified without reading its oversized contents into diagnostics', async () => {
  const r = await appFailure(async () => new Response(canary, {headers: {'content-type': 'application/json', 'content-length': String(app.OPENAI_RESPONSE_BYTES + 1)}}));
  assert.equal(r.diagnostic.stage, 'generation_format'); assert.equal(r.diagnostic.validationStage, 'content_limit'); assert.equal(r.diagnostic.code, 'FORMAT_INVALID');
});
test('known local storage codes, review and repackaging remain local even when their messages mention network/billing', () => {
  for (const [code, expected] of [['EPERM', 'STORAGE_DENIED'], ['EACCES', 'STORAGE_DENIED'], ['ENOSPC', 'STORAGE_FULL'], [canary, 'STORAGE_FAILURE']]) {
    const e = new Error(canary); e.code = code; const d = diagnostic(fixture(), 'receipt_storage', e); assert.equal(d.code, expected); assert.equal(d.category, 'local_failure'); assert.equal(d.nextAction, 'stop-run');
  }
  assert.equal(diagnostic(fixture(), 'review', new TypeError(canary)).code, 'REVIEW_EVIDENCE_FAILURE');
});
test('diagnostic cost/usage evidence preserves consumed uncertainty and leaves settled known usage unchanged', () => {
  const unsent = fixture('generation', false), reserved = diagnostic(unsent, 'preflight', new Error(canary)); assert.equal(reserved.networkCalls, 0); assert.equal(reserved.mayHaveBeenSent, false);
  const f = fixture(), consumed = diagnostic(f, 'unknown', new Error(canary)); assert.equal(consumed.networkCalls, null); assert.equal(consumed.costEvidence, 'maximum-retained');
  f.ledger = transition(f.spec, f.ledger, {kind: 'settle', key: f.key, state: 'completed', usage: {inputTokens: 10, outputTokens: 20}, evidenceHash: h});
  const settled = diagnostic(f, 'repackage', new TypeError(canary)); assert.deepEqual(settled.reportedUsage, {inputTokens: 10, outputTokens: 20}); assert.equal(settled.costEvidence, 'bounded-settled');
  const future = fixture('generation', true, 'evaluation'); assert.equal(diagnostic(future, 'unknown', new Error(canary)).runMode, 'evaluation');
});
test('whitelist projection rejects a raw-spread privacy control across every private field and malicious metadata key', () => {
  const e = Object.assign(new Error(canary), {body: canary, input: canary, answer: canary, token: canary, issues: [{path: [canary], input: canary}], headers: {Authorization: canary}, [canary]: canary});
  assert.ok(JSON.stringify({...e}).includes(canary)); const d = diagnostic(fixture(), 'unknown', e); assert.equal(d.code, 'FAILURE_UNKNOWN');
  assert.equal(Object.hasOwn(d, 'message'), false); assert.equal(Object.hasOwn(d, 'body'), false); assert.equal(Object.hasOwn(d, 'issues'), false);
});
test('throwing getters and proxies do not execute or leak private errors', () => {
  let reads = 0; const e = {}; for (const key of ['code', 'issue', 'validationStage', 'judgmentReason']) Object.defineProperty(e, key, {get() { reads++; throw new Error(canary); }});
  assert.equal(stageForAppFailure(e), 'unknown'); diagnostic(fixture(), 'unknown', e); assert.equal(reads, 0);
  const proxy = new Proxy({}, {getOwnPropertyDescriptor() { throw new Error(canary); }}); assert.equal(stageForAppFailure(proxy), 'unknown'); diagnostic(fixture(), 'unknown', proxy);
});
test('invalid context, wrong role, private evidence/stage values and impossible response-before-consume fail generically', () => {
  const f = fixture(), invoke = patch => () => diagnoseFailure({...f, stage: 'unknown', error: new Error(canary), ...patch});
  for (const patch of [{stage: canary}, {evidenceHash: canary}, {key: canary}, {key: {toString() { throw new Error(canary); }}}, {stage: 'judge_transport'}, {spec: {...f.spec, mode: 'learner'}}])
    assert.throws(invoke(patch), e => !e.message.includes(canary) && e.message.startsWith('DIAGNOSTIC_'));
  assert.throws(() => diagnoseFailure({...fixture('generation', false), stage: 'generation_transport', httpStatus: 429}), /DIAGNOSTIC_EVIDENCE_CONFLICT/);
});
test('unmeasured historical-looking names/messages remain unknown and source-bound application enums stay current', () => {
  assert.equal(diagnostic(fixture(), 'unknown', Object.assign(new TypeError(canary), {name: 'NetworkError'})).code, 'FAILURE_UNKNOWN');
  for (const stage of app.FEEDBACK_VALIDATION_STAGES) {
    const error = new app.FeedbackError('provider_invalid_response', 502, {}, stage), d = diagnostic(fixture(), stageForAppFailure(error), error); assert.equal(d.validationStage, stage);
  }
  for (const reason of app.JUDGMENT_REJECTION_REASONS) {
    const error = new app.FeedbackError('provider_invalid_response', 502, {}, 'judgment', undefined, undefined, reason);
    assert.equal(diagnostic(fixture(), 'app_safety', error).judgmentReason, reason);
  }
});
test.after(() => { writeFileSync(resolve(root, 'failure-stage-observations.json'), JSON.stringify({actualProviderCalls: 0, sourceRoot: SOURCE, actualPromptVersion: app.AI_PROMPT_VERSION, syntheticAppAdapterFailures: evidence}, null, 2) + '\n'); });
