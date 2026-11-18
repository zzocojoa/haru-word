import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROTOCOL_V2, MODELS, digest, slotKey, newLedgerV2, transitionV2} from './ai-quality-v147-budget-v2.mjs';
import {PLAN} from './ai-quality-v147-budget.mjs';
import {FREEZE_PROTOCOL, COMPONENTS, sealFreeze} from './ai-quality-v147-freeze.mjs';
import {verifyV2Freeze, prepareV2Wire} from './ai-quality-v147-wire-v2.mjs';
const h = digest('synthetic wire-v2 fixture'), sha = x => createHash('sha256').update(x).digest('hex');
const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../work', 'wire-v2-' + randomUUID())); mkdirSync(out, {recursive: true});
const body = (model, payload) => JSON.stringify({model, instructions: 'synthetic policy', input: [{role: 'user', content: JSON.stringify(payload)}], text: {format: {type: 'json_schema', name: 'test', strict: true, schema: {type: 'object', properties: {}, additionalProperties: false}}}, reasoning: {effort: 'low'}, max_output_tokens: 4096, store: false, stream: false, service_tier: 'default'});
function fixture() {
  const genRaw = body(MODELS[0], {sentence: 'Keep warm.'}), templateRaw = body(MODELS[1], {domain: 'word', input: {sentence: 'Keep warm.', target: 'warm adjective'}, reference: {criterion: 'preserve original'}, feedback: null});
  const gen = {phase: 'candidate', caseId: 'case-one', targetModelId: MODELS[0], modelId: MODELS[0], role: 'generation', repetition: 1, inputTokenMax: 70000, outputTokenMax: 4096, inputBoundHash: h, bodyCommitment: digest(JSON.parse(genRaw))}, judge = {...gen, modelId: MODELS[1], role: 'judge', bodyCommitment: sha(templateRaw)};
  const g = slotKey(gen), j = slotKey(judge), runId = randomUUID();
  const spec = {schemaVersion: 1, protocol: PROTOCOL_V2, planId: PLAN, runId, mode: 'synthetic', sourceSeal: h, quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1', models: Object.fromEntries(MODELS.map(m => [m, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'pair-one', requests: [gen, judge]}], wirePolicies: {[g]: {kind: 'static', bodySha256: sha(genRaw), templateHash: null, parentKey: null, maximumBytes: 65536}, [j]: {kind: 'derived', bodySha256: null, templateHash: sha(templateRaw), parentKey: g, maximumBytes: 65536}}};
  const {sourceSeal: _sourceSeal, ...outline} = spec; void _sourceSeal;
  const current = {schemaVersion: 1, protocol: FREEZE_PROTOCOL, planId: PLAN, runId, mode: 'synthetic', components: {...Object.fromEntries(COMPONENTS.map(k => [k, h])), limits: digest(outline), quote: digest(spec.quote)}, environment: {nodeVersion: process.version, platform: process.platform, arch: process.arch, timezone: 'Asia/Seoul', compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'], featureFlags: Object.fromEntries(['grammar_enabled', 'grammar_practice_v2_enabled', 'grammar_practice_v3_enabled', 'grammar_practice_v4_enabled', 'large_backup_restore_enabled', 'ai_feedback_enabled', 'feedback_judgment_enabled'].map(k => [k, 'true'])), providerEndpoint: 'https://api.openai.com/v1/responses', outboundMode: 'synthetic-intercept'}, schedule: [{key: g, modelId: gen.modelId, role: gen.role, kind: 'static', maximumBytes: 65536, outputTokenMax: 4096, bodySha256: sha(genRaw), bodyDigest: gen.bodyCommitment, parentKey: null, recipeHash: null}, {key: j, modelId: judge.modelId, role: judge.role, kind: 'derived', maximumBytes: 65536, outputTokenMax: 4096, bodySha256: null, bodyDigest: null, parentKey: g, recipeHash: sha(templateRaw)}], order: [g, j]};
  const seal = sealFreeze(current); spec.sourceSeal = seal.hash;
  const approval = {schemaVersion: 1, protocol: PROTOCOL_V2, runId, specHash: digest(spec), kind: 'synthetic-test', amountMicros: '1000000', evidenceHash: h};
  let ledger = transitionV2(spec, newLedgerV2(spec, approval), {kind: 'reserve', batchId: 'pair-one'});
  return {spec, current, seal, ledger, g, j, genRaw, templateRaw};
}
function capturedParent(f) {
  const prepared = prepareV2Wire({...f, key: f.g, raw: f.genRaw, templateRaw: null});
  let ledger = transitionV2(f.spec, f.ledger, prepared.bindOperation); ledger = transitionV2(f.spec, ledger, {kind: 'consume', key: f.g});
  const parentRaw = JSON.stringify({original: 'Keep warm.', meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: 'Keep warm.', explanation: '합성 검증'}), usage = {inputTokens: 100, outputTokens: 100};
  const result = {sourceSeal: f.spec.sourceSeal, requestId: ledger.slots[f.g].requestId, modelId: MODELS[0], bodySha256: prepared.binding.bodySha256, bodyDigest: prepared.binding.bodyDigest, outputHash: sha(parentRaw), state: 'completed', usage};
  ledger = transitionV2(f.spec, ledger, {kind: 'settle', key: f.g, state: 'completed', usage, result}); return {...f, ledger, parentRaw};
}

test('v2 plan outline and every frozen static/derived policy map exactly to the T16 snapshot', () => {
  const f = fixture(); assert.equal(verifyV2Freeze(f).sourceSeal, f.seal.hash);
  for (const mutate of [s => {s.wirePolicies[f.j].maximumBytes--;}, s => {s.quote.models[MODELS[0]].inputMicrosPerMillion = '2';}, s => {s.sourceSeal = h;}]) {const spec = structuredClone(f.spec); mutate(spec); assert.throws(() => verifyV2Freeze({...f, spec}), /V2_FREEZE_SPEC/);}
});

test('static actual bytes prepare a pure binding operation without mutating the reserved ledger or authorizing dispatch', () => {
  const f = fixture(), before = digest(f.ledger), prepared = prepareV2Wire({...f, key: f.g, raw: f.genRaw, templateRaw: null});
  assert.equal(prepared.bindOperation.kind, 'bind'); assert.equal(prepared.raw, f.genRaw); assert.equal(digest(f.ledger), before); assert.equal(prepared.realDispatchAuthorized, false); assert.equal(prepared.inputTokenBoundVerified, false);
  const ledger = transitionV2(f.spec, f.ledger, prepared.bindOperation); assert.equal(prepareV2Wire({...f, ledger, key: f.g, raw: f.genRaw, templateRaw: null}).bindOperation, null);
  assert.throws(() => prepareV2Wire({...f, ledger: transitionV2(f.spec, ledger, {kind: 'consume', key: f.g}), key: f.g, raw: f.genRaw}), /V2_WIRE_NOT_UNSENT/);
});

test('reserved judge rejects an uncaptured parent;captured bytes generate exact body and immutable v2 binding from frozen template', () => {
  const f = fixture(); assert.throws(() => prepareV2Wire({...f, key: f.j, templateRaw: f.templateRaw, parentRaw: '{}'}), /V2_WIRE_PARENT_NOT_CAPTURED/);
  const c = capturedParent(f), prepared = prepareV2Wire({...c, key: c.j, templateRaw: c.templateRaw, parentRaw: c.parentRaw});
  assert.equal(prepared.binding.parentReceiptHash, c.ledger.slots[c.g].evidenceHash); assert.equal(prepared.binding.parentOutputHash, sha(c.parentRaw)); assert.equal(prepared.binding.templateHash, sha(c.templateRaw));
  assert.deepEqual(JSON.parse(JSON.parse(prepared.raw).input[0].content).feedback, JSON.parse(c.parentRaw)); assert.equal(prepared.receiptAuthenticated, false);
  const bound = transitionV2(c.spec, c.ledger, prepared.bindOperation); assert.equal(bound.bindings[c.j].bodyDigest, prepared.binding.bodyDigest);
});

test('whitespace/input/reference/response substitutions and stale observation fail before any caller could commit or fetch credentials', () => {
  const f = capturedParent(fixture()), before = digest(f.ledger), args = {...f, key: f.j, templateRaw: f.templateRaw, parentRaw: f.parentRaw};
  for (const change of [{templateRaw: f.templateRaw + ' '}, {templateRaw: f.templateRaw.replace('preserve original', 'changed reference')}, {parentRaw: f.parentRaw + ' '}, {raw: '{}'}]) assert.throws(() => prepareV2Wire({...args, ...change}));
  const current = structuredClone(f.current); current.components.corpus = digest('changed corpus'); assert.throws(() => prepareV2Wire({...args, current}), /FREEZE_CONDITIONS_CHANGED/); assert.equal(digest(f.ledger), before);
});

test('closed,withdrawn approval and wrong run prohibit wire preparation,without silently manufacturing a fresh approval', () => {
  const f = fixture(), closed = transitionV2(f.spec, f.ledger, {kind: 'close'}); assert.throws(() => prepareV2Wire({...f, ledger: closed, key: f.g, raw: f.genRaw}), /V2_WIRE_NOT_UNSENT/);
  const approval = {...f.ledger.approval, kind: 'unapproved', amountMicros: '0', evidenceHash: null}, reduced = transitionV2(f.spec, f.ledger, {kind: 'approval', approval});
  assert.throws(() => prepareV2Wire({...f, ledger: reduced, key: f.g, raw: f.genRaw}), /V2_WIRE_NOT_UNSENT/);
  assert.throws(() => prepareV2Wire({...f, spec: {...f.spec, runId: randomUUID()}, key: f.g, raw: f.genRaw}), /V2_FREEZE_SPEC/);
});

test.after(() => {writeFileSync(resolve(out, 'wire-v2-observations.json'), JSON.stringify({checks: 5, actualProviderCalls: 0, actualKeyReads: 0, paidApprovalUsd: 0, task22Complete: false, durableStoreIntegrated: false, liveEvaluationSupported: false, scope: 'Pure T16→v2 reservation/body-binding integration only. No full CLI/Worker collection or process recovery run.'}, null, 2) + '\n');});
