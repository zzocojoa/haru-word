import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, readdirSync, symlinkSync, linkSync, renameSync} from 'node:fs';
import {resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
import {build} from 'esbuild';
import {PROTOCOL, PLAN, MODELS, digest, slotKey} from './ai-quality-v147-budget.mjs';
import {createBudgetStore, readBudgetStore, transactBudgetStore} from './ai-quality-v147-budget-store.mjs';
import {FREEZE_PROTOCOL, COMPONENTS, captureFreezeFiles, sealFreeze, verifyFreeze, writeFreezeExclusive, buildDerivedWire, verifyFrozenWire, verifyFrozenBudget, dispatchFrozenSynthetic} from './ai-quality-v147-freeze.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(HERE, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8')), SOURCE = resolve(manifest.baseline.sourceRoot);
const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(SOURCE, 'work', 'freeze-test-' + randomUUID())); mkdirSync(out, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), h = digest('synthetic freeze fixture; not a price,authorization or quality result');
const endpoint = 'https://api.openai.com/v1/responses', credential = 'SYNTHETIC_FREEZE_NEVER_REAL';
const featureFlags = Object.fromEntries(['grammar_enabled', 'grammar_practice_v2_enabled', 'grammar_practice_v3_enabled', 'grammar_practice_v4_enabled', 'large_backup_restore_enabled', 'ai_feedback_enabled', 'feedback_judgment_enabled'].map(k => [k, 'true']));
const environment = () => ({nodeVersion: process.version, platform: process.platform, arch: process.arch, timezone: 'Asia/Seoul', compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'], featureFlags: structuredClone(featureFlags), providerEndpoint: endpoint, outboundMode: 'synthetic-intercept'});
const rawBody = (model = MODELS[0], content = {sentence: 'Keep warm.'}) => JSON.stringify({model, instructions: 'synthetic instructions', input: [{role: 'user', content: JSON.stringify(content)}], text: {format: {type: 'json_schema', name: 'synthetic', strict: true, schema: {type: 'object', properties: {}, additionalProperties: false}}}, reasoning: {effort: 'low'}, max_output_tokens: 4096, store: false, stream: false, service_tier: 'default'});
const rawFeedback = () => JSON.stringify({original: 'Keep warm.', meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: 'Keep warm.', explanation: '합성 검증'});
function fixture(raw = rawBody()) {
  const body = JSON.parse(raw), runId = randomUUID();
  const descriptor = {phase: 'candidate', caseId: 'case-one', targetModelId: body.model, modelId: body.model, role: 'generation', repetition: 1, inputTokenMax: 1000, outputTokenMax: 4096, inputBoundHash: h, bodyCommitment: digest(body)};
  const spec = {schemaVersion: 1, protocol: PROTOCOL, planId: PLAN, runId, mode: 'synthetic', sourceSeal: h, quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1', models: Object.fromEntries(MODELS.map(m => [m, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'batch-one', requests: [descriptor]}]};
  const {sourceSeal: _sourceSeal, ...outline} = spec; void _sourceSeal;
  const key = slotKey(descriptor), current = {schemaVersion: 1, protocol: FREEZE_PROTOCOL, planId: PLAN, runId, mode: 'synthetic', components: {...Object.fromEntries(COMPONENTS.map(k => [k, h])), limits: digest(outline), quote: digest(spec.quote)}, environment: environment(), schedule: [{key, modelId: body.model, role: 'generation', kind: 'static', maximumBytes: 65536, outputTokenMax: 4096, bodySha256: sha(raw), bodyDigest: digest(body), parentKey: null, recipeHash: null}], order: [key]};
  const seal = sealFreeze(current); spec.sourceSeal = seal.hash;
  return {raw, key, spec, current, seal};
}
function store(f = fixture()) {
  const directory = resolve(out, f.spec.runId), context = {directory, allowedRoot: out, spec: f.spec};
  const approval = {schemaVersion: 1, protocol: PROTOCOL, runId: f.spec.runId, specHash: digest(f.spec), kind: 'synthetic-test', amountMicros: '100000', evidenceHash: h};
  createBudgetStore({...context, approval}); transactBudgetStore({...context, operation: {kind: 'reserve', batchId: 'batch-one'}}); return {...f, context};
}
const byteHashes = dir => Object.fromEntries(readdirSync(dir).sort().map(name => [name, sha(readFileSync(resolve(dir, name)))]));
const observations = {actualProviderCalls: 0, actualKeyReads: 0, syntheticCredentialReads: 0, syntheticDispatches: 0, mutationControls: [], actualAppBodies: []};
const dispatch = (f, extra = {}) => dispatchFrozenSynthetic({seal: f.seal, observe: () => structuredClone(f.current), context: f.context, key: f.key, raw: f.raw,
  loadSyntheticCredential: () => { observations.syntheticCredentialReads++; return credential; }, transport: async ({raw, credential: key}) => { assert.equal(key, credential); assert.equal(raw, f.raw); observations.syntheticDispatches++; return {status: 'completed', modelId: f.spec.batches[0].requests[0].modelId, usage: {inputTokens: 100, outputTokens: 100}, outputHash: h}; }, ...extra});

test('closed file tree inventory detects byte changes,JSON formatting,new inputs and removals without reading protected locations', () => {
  const root = resolve(out, '파일-경계-' + randomUUID()); mkdirSync(resolve(root, 'lib'), {recursive: true}); writeFileSync(resolve(root, 'lib/source.ts'), 'export const x=1;\n'); writeFileSync(resolve(root, 'plan.json'), '{"x":1}');
  const capture = () => captureFreezeFiles({root, trees: ['lib'], files: ['plan.json']}); const first = capture(); assert.equal(first.inventory.length, 2);
  writeFileSync(resolve(root, 'plan.json'), '{ "x": 1 }'); const formatted = capture(); assert.notEqual(formatted.hash, first.hash);
  writeFileSync(resolve(root, 'lib/new.ts'), 'export const y=1;'); const added = capture(); assert.notEqual(added.hash, formatted.hash);
  const source = resolve(root, 'lib/new.ts'), archived = resolve(root, 'preserved-new.ts'); assert.ok(source.startsWith(root + sep) && archived.startsWith(root + sep)); renameSync(source, archived); assert.notEqual(capture().hash, added.hash); assert.ok(readFileSync(archived).length > 0);
  assert.throws(() => captureFreezeFiles({root, files: ['missing.json']}));
  for (const path of ['../outside', '/outside', 'lib/../plan.json', 'lib\\source.ts', 'plan.json:stream', '.env', '.env.local', '.env-secret', '.sites-runtime/x', '.wrangler/x', 'work/x', 'outputs/x', 'CON', 'lib/source.ts.']) assert.throws(() => captureFreezeFiles({root, files: [path]}), undefined, path);
  assert.throws(() => captureFreezeFiles({root, trees: ['lib'], files: ['lib/source.ts']}), /FREEZE_DUPLICATE_FILE/);
  for (const name of ['.env.local', '.wrangler', '.sites-runtime', '.git']) assert.throws(() => captureFreezeFiles({root: resolve(out, name, 'nested'), files: ['file.ts']}), /FREEZE_PROTECTED_ROOT/);
});

test('actual junction and hardlink inputs are rejected within owned synthetic roots', () => {
  const root = resolve(out, 'links-' + randomUUID()), target = resolve(out, 'target-' + randomUUID()); mkdirSync(root); mkdirSync(target); writeFileSync(resolve(target, 'file.ts'), 'synthetic');
  symlinkSync(target, resolve(root, 'junction'), 'junction'); assert.throws(() => captureFreezeFiles({root, trees: ['junction']}), /FREEZE_LINK/);
  writeFileSync(resolve(root, 'one.ts'), 'synthetic'); linkSync(resolve(root, 'one.ts'), resolve(root, 'two.ts')); assert.throws(() => captureFreezeFiles({root, files: ['one.ts']}), /FREEZE_REGULAR_FILE/);
});

test('seal is hash-bound,detached and exclusive output cannot overwrite a previous run or escape through a junction', () => {
  const f = fixture(), saved = structuredClone(f.seal); f.current.components.corpus = sha('changed'); assert.deepEqual(f.seal, saved); assert.throws(() => verifyFreeze(f.seal, f.current), /FREEZE_CONDITIONS_CHANGED/);
  const file = resolve(out, f.spec.runId + '-freeze.json'); writeFreezeExclusive(file, f.seal); const original = readFileSync(file); assert.throws(() => writeFreezeExclusive(file, f.seal)); assert.deepEqual(readFileSync(file), original);
  assert.throws(() => writeFreezeExclusive(resolve(out, 'arbitrary.json'), f.seal), /FREEZE_OUTPUT_SCOPE/);
  const junction = resolve(out, 'write-junction-' + randomUUID()); symlinkSync(out, junction, 'junction'); assert.throws(() => writeFreezeExclusive(resolve(junction, f.spec.runId + '-freeze.json'), f.seal), /FREEZE_OUTPUT_SCOPE/);
  const bad = structuredClone(f.seal); bad.payload.components.rubric = sha('changed'); assert.throws(() => verifyFreeze(bad, bad.payload), /FREEZE_SEAL_CHANGED/);
});

test('every frozen component mutation fails before synthetic credential read,dispatch or any existing ledger write', async () => {
  const f = store(), before = byteHashes(f.context.directory); let keys = 0, calls = 0;
  for (const component of COMPONENTS) {
    const current = structuredClone(f.current); current.components[component] = sha(component + '-changed');
    await assert.rejects(dispatch(f, {observe: () => current, loadSyntheticCredential: () => { keys++; return credential; }, transport: async () => { calls++; }}), /FREEZE_CONDITIONS_CHANGED/);
    observations.mutationControls.push({component, credentialReads: keys, dispatches: calls});
  }
  assert.equal(keys, 0); assert.equal(calls, 0); assert.deepEqual(byteHashes(f.context.directory), before);
});

test('fresh physical file observation detects an actual changed source before credentials and leaves the old ledger byte-exact', async () => {
  const root = resolve(out, 'physical-source-' + randomUUID()); mkdirSync(root); const file = resolve(root, 'source.ts'); writeFileSync(file, 'export const x=1;');
  const capture = () => captureFreezeFiles({root, files: ['source.ts']}).hash;
  const f = fixture(); f.current.components.sourceCandidate = capture(); f.seal = sealFreeze(f.current); f.spec.sourceSeal = f.seal.hash; const ctx = store(f), before = byteHashes(ctx.context.directory); let keys = 0;
  writeFileSync(file, 'export const x=2;');
  await assert.rejects(dispatch(ctx, {observe: () => ({...structuredClone(f.current), components: {...f.current.components, sourceCandidate: capture()}}), loadSyntheticCredential: () => {keys++; return credential;}}), /FREEZE_CONDITIONS_CHANGED/);
  assert.equal(keys, 0); assert.deepEqual(byteHashes(ctx.context.directory), before);
});

test('run,model,Node,flags,timezone,endpoint,wire cap and scheduling changes all hold before key access', async () => {
  const changes = [o => {o.runId = randomUUID();}, o => {o.schedule[0].modelId = MODELS[1];}, o => {o.environment.nodeVersion = 'v24.1.0';}, o => {o.environment.featureFlags.grammar_enabled = 'false';}, o => {o.environment.compatibilityFlags.push('no_nodejs_compat_v2');}, o => {o.environment.timezone = 'UTC';}, o => {o.environment.providerEndpoint = 'https://example.invalid';}, o => {o.schedule[0].maximumBytes--;}, o => {o.order = [];}, o => {o.components.extra = h;}];
  const f = store(); let keys = 0;
  for (const change of changes) { const current = structuredClone(f.current); change(current); await assert.rejects(dispatch(f, {observe: () => current, loadSyntheticCredential: () => {keys++; return credential;}})); }
  assert.equal(keys, 0); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'reserved');
});

test('wire exact bytes preserve UTF8 and reject key order,whitespace,payload/model/options/schema modifications', async () => {
  const f = store(); let keys = 0;
  const wires = [f.raw + '\n', JSON.stringify(JSON.parse(f.raw), null, 2), JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(f.raw)).reverse())), ...['instructions', 'input', 'text', 'reasoning', 'max_output_tokens', 'model', 'stream', 'store', 'service_tier'].map(k => {const b = JSON.parse(f.raw); b[k] = k === 'instructions' ? 'changed' : null; return JSON.stringify(b);}), '{', f.raw.repeat(1000)];
  for (const raw of wires) await assert.rejects(dispatch(f, {raw, loadSyntheticCredential: () => {keys++; return credential;}}));
  assert.equal(keys, 0); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'reserved');
});

test('budget source seal,quote,token maxima and approval fingerprint cannot be silently updated', async () => {
  const f = store(), original = byteHashes(f.context.directory);
  for (const change of [s => {s.sourceSeal = h;}, s => {s.quote.models[MODELS[0]].inputMicrosPerMillion = '2';}, s => {s.batches[0].requests[0].inputTokenMax++;}, s => {s.runId = randomUUID();}]) {
    const spec = structuredClone(f.spec); change(spec); await assert.rejects(dispatch(f, {context: {...f.context, spec}}));
  }
  assert.deepEqual(byteHashes(f.context.directory), original); verifyFrozenBudget(f.seal, f.spec);
});

test('matching synthetic run consumes once and sends the exact raw bytes; rerun never reads credentials again', async () => {
  const f = store(), k = observations.syntheticCredentialReads, n = observations.syntheticDispatches;
  assert.equal((await dispatch(f)).status, 'completed'); assert.equal(observations.syntheticCredentialReads, k + 1); assert.equal(observations.syntheticDispatches, n + 1);
  await assert.rejects(dispatch(f), /NO_AUTOMATIC_RESEND/); assert.equal(observations.syntheticCredentialReads, k + 1); assert.equal(observations.syntheticDispatches, n + 1);
});

test('drift after durable consume but before credentials or transport preserves consumed maximum and never resends', async () => {
  const f = store(); let observes = 0, keys = 0, calls = 0;
  const result = await dispatch(f, {observe: () => { const c = structuredClone(f.current); if (++observes >= 2) c.components.rubric = sha('late edit'); return c; }, loadSyntheticCredential: () => {keys++; return credential;}, transport: async () => {calls++;}});
  assert.equal(result.status, 'held'); assert.equal(keys, 0); assert.equal(calls, 0); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'consumed');
  await assert.rejects(dispatch(f), /NO_AUTOMATIC_RESEND/);
});

test('drift caused during the synthetic credential callback is checked again before transport', async () => {
  const f = store(); let calls = 0;
  const result = await dispatch(f, {afterCredential: () => {f.current.components.modelOptions = sha('late options edit');}, transport: async () => {calls++;}});
  assert.equal(result.status, 'held'); assert.equal(calls, 0); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'consumed');
});

test('evaluation mode and non-synthetic credential callbacks cannot enable a real dispatch', async () => {
  const f = store(); let keys = 0, calls = 0;
  const current = structuredClone(f.current); current.mode = 'evaluation'; current.environment.outboundMode = 'approved-openai-only';
  await assert.rejects(dispatch(f, {seal: sealFreeze(current), loadSyntheticCredential: () => {keys++; return credential;}}), /FREEZE_LIVE_NOT_SUPPORTED/); assert.equal(keys, 0);
  assert.equal((await dispatch(f, {loadSyntheticCredential: () => 'SYNTHETIC_WRONG', transport: async () => {calls++;}})).status, 'held'); assert.equal(calls, 0);
});

function derivedFixture() {
  const f = fixture(), templateRaw = rawBody(MODELS[1], {domain: 'word', input: {sentence: 'Keep warm.', target: 'warm adjective'}, reference: {criterion: 'preserve original'}, feedback: null});
  const key = 'candidate/' + MODELS[0] + '/case-one/judge/1';
  f.current.schedule.push({key, modelId: MODELS[1], role: 'judge', kind: 'derived', maximumBytes: 65536, outputTokenMax: 4096, bodySha256: null, bodyDigest: null, parentKey: f.key, recipeHash: sha(templateRaw)}); f.current.order.push(key); f.seal = sealFreeze(f.current);
  const parentRaw = rawFeedback(), parentReceipt = {key: f.key, requestId: randomUUID(), responseHash: sha(parentRaw), receiptHash: h, sourceSeal: f.seal.hash};
  return {...f, key, templateRaw, parentRaw, parentReceipt};
}

test('future judge body is derived from frozen exact recipe and a single parent capture,then byte-bound without pretending receipt authentication', () => {
  const f = derivedFixture(), built = buildDerivedWire(f);
  const proof = verifyFrozenWire({...f, raw: built.raw, derivedBinding: built.binding});
  assert.equal(proof.realDispatchAuthorized, false); assert.equal(proof.receiptAuthenticated, false);
  assert.deepEqual(JSON.parse(JSON.parse(built.raw).input[0].content).feedback, JSON.parse(f.parentRaw));
  for (const field of ['responseHash', 'receiptHash', 'requestId', 'sourceSeal', 'key']) {const parentReceipt = structuredClone(f.parentReceipt); parentReceipt[field] = field === 'requestId' ? randomUUID() : sha(field); assert.throws(() => verifyFrozenWire({...f, raw: built.raw, derivedBinding: built.binding, parentReceipt}));}
  for (const raw of [built.raw + ' ', built.raw.replace('합성 검증', 'changed')]) assert.throws(() => verifyFrozenWire({...f, raw, derivedBinding: built.binding}), /FREEZE_DERIVED_BODY_CHANGED/);
});

test('changed recipe/reference,parent text,missing binding,wrong original,self judge and future-parent order are rejected', () => {
  const f = derivedFixture(), built = buildDerivedWire(f);
  assert.throws(() => buildDerivedWire({...f, templateRaw: f.templateRaw + ' '}), /FREEZE_RECIPE/);
  assert.throws(() => buildDerivedWire({...f, parentRaw: f.parentRaw + ' '}), /FREEZE_PARENT_BYTES/);
  assert.throws(() => verifyFrozenWire({...f, raw: built.raw}), /FREEZE_DERIVED_SEAL/);
  const parentRaw = JSON.stringify({...JSON.parse(f.parentRaw), original: 'Other original.'});
  assert.throws(() => buildDerivedWire({...f, parentRaw, parentReceipt: {...f.parentReceipt, responseHash: sha(parentRaw)}}), /FREEZE_PARENT_VISIBLE/);
  for (const change of [o => {o.schedule[1].modelId = MODELS[0];}, o => {o.order.reverse();}, o => {o.schedule[1].parentKey = 'unknown';}]) {const current = structuredClone(f.current); change(current); assert.throws(() => sealFreeze(current), /FREEZE_PARENT/);}
});

test('fixed generation body gate accepts actual candidate adapter word/grammar bodies for all3models with synthetic interception only', async t => {
  t.mock.method(console, 'info', () => {}); const bundle = resolve(out, 'actual-app-body.mjs');
  const result = await build({absWorkingDir: SOURCE, stdin: {contents: "export {generateOpenAiFeedback} from './lib/openai-feedback';export {systemInstruction} from './lib/feedback-prompts';export {generateGrammarFeedback} from './lib/grammar/feedback';export {LESSON_MAP} from './lib/grammar/content';export {lessonForVersion} from './lib/grammar/content-v4';export {wordFeedbackInput} from './lib/feedback-context';export {AI_PROMPT_VERSION} from './lib/ai-models';", resolveDir: SOURCE, loader: 'ts'}, outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', metafile: true});
  writeFileSync(resolve(out, 'actual-app-input-hashes.json'), JSON.stringify(Object.fromEntries(Object.keys(result.metafile.inputs).filter(path => path !== '<stdin>').map(path => [path, sha(readFileSync(resolve(SOURCE, path)))])), null, 2));
  const {pathToFileURL} = await import('node:url'), runtime = await import(pathToFileURL(bundle)); assert.equal(runtime.AI_PROMPT_VERSION, 'reference-v6');
  for (const model of MODELS) for (const domain of ['word', 'grammar']) {
    let calls = 0, raw;
    const fetcher = async (url, init) => {calls++; assert.equal(url, endpoint); assert.equal(init.redirect, 'manual'); raw = init.body; const input = JSON.parse(JSON.parse(raw).input[0].content); return Response.json({status: 'completed', model, output: [{type: 'message', role: 'assistant', status: 'completed', content: [{type: 'output_text', text: JSON.stringify({meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: input.sentence, targetReason: '합성 목표', grammarReason: '합성 문법', correctionReason: '', contextNeeded: 'none'})}]}]});};
    const config = {apiKey: credential, modelId: model, allowedModels: model, judgmentEnabled: true, contextKind: 'command', contextNote: ''};
    if (domain === 'word') await runtime.generateOpenAiFeedback(config, runtime.wordFeedbackInput({word: 'warm', pos: 'adj.'}, '따뜻한', 'Keep warm.', '', 'warm', 'command'), runtime.systemInstruction, fetcher);
    else await runtime.generateGrammarFeedback(config, runtime.lessonForVersion(runtime.LESSON_MAP.get('adjective'), 4), 'Keep warm.', fetcher);
    assert.equal(calls, 1); const f = fixture(raw); verifyFrozenWire({...f, raw}); observations.actualAppBodies.push({model, domain, calls, bodySha256: sha(raw), bytes: Buffer.byteLength(raw), promptVersion: runtime.AI_PROMPT_VERSION});
  }
  assert.equal(observations.actualAppBodies.length, 6);
});

test('recorded baseline/candidate full-Worker synthetic bodies are byte-verified then replayed through the new gate without starting or calling a provider', () => {
  const proofRoot = resolve(manifest.baseline.existingDashboardRoot, 'outputs/ai-quality-v147-implementation-20261106/phase6/built-worker-final');
  const file = resolve(proofRoot, 'provider-requests.json'), prep = JSON.parse(readFileSync(resolve(SOURCE, manifest.workerPreparationFile), 'utf8'));
  assert.equal(sha(readFileSync(file)), prep.proofSha256['provider-requests.json']);
  const profiles = JSON.parse(readFileSync(file, 'utf8')); let total = 0;
  for (const profile of profiles) {assert.ok(['baseline', 'candidate'].includes(profile.profile)); assert.equal(profile.requests.length, 7);
    for (const request of profile.requests) {assert.equal(request.synthetic, true); assert.equal(request.url, endpoint); assert.equal(sha(request.body), request.bodySha256); const f = fixture(request.body); verifyFrozenWire({...f, raw: request.body}); total++;}
  }
  assert.equal(total, 14); observations.recordedWorkerBodyReplays = total;
});

test.after(() => {writeFileSync(resolve(out, 'freeze-observations.json'), JSON.stringify({...observations, actualModelQualityMeasured: false, actualFinalEvaluationFrozen: false}, null, 2) + '\n');});
