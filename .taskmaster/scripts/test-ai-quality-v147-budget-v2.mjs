import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import * as v1 from './ai-quality-v147-budget.mjs';
import {PROTOCOL_V2, validateSpecV2, validateApprovalV2, newLedgerV2, accountV2, transitionV2, v2RequestId, diagnoseFailureV2} from './ai-quality-v147-budget-v2.mjs';
const {MODELS, PLAN, digest, slotKey, costUpperMicros} = v1;
const h = digest('synthetic v2 arithmetic,not real prices or approval'), clone = structuredClone;
const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../work', 'budget-v2-' + randomUUID())); mkdirSync(out, {recursive: true});
const evidence = {actualProviderCalls: 0, actualKeyReads: 0, paidApprovalUsd: 0, task22Complete: false};
function fixture({cases = 1, phases = ['candidate'], models = [MODELS[0]], calibration = 0} = {}) {
  const batches = [], wirePolicies = {};
  for (const phase of phases) for (const model of models) for (let i = 0; i < cases; i++) {
    const caseId = 'case-' + i, gen = {phase, caseId, targetModelId: model, modelId: model, role: 'generation', repetition: 1, inputTokenMax: 2000, outputTokenMax: 4096, inputBoundHash: h, bodyCommitment: digest([phase, model, i, 'body'])};
    const judge = {...gen, modelId: MODELS[(MODELS.indexOf(model) + 1) % MODELS.length], role: 'judge', outputTokenMax: 1000, bodyCommitment: digest([phase, model, i, 'template'])};
    batches.push({id: 'pair-' + phase + '-' + MODELS.indexOf(model) + '-' + i, requests: [gen, judge]});
    wirePolicies[slotKey(gen)] = {kind: 'static', bodySha256: h, templateHash: null, parentKey: null, maximumBytes: 65536};
    wirePolicies[slotKey(judge)] = {kind: 'derived', bodySha256: null, templateHash: judge.bodyCommitment, parentKey: slotKey(gen), maximumBytes: 65536};
  }
  for (let i = 0; i < calibration; i++) {
    const model = MODELS[i % 3], d = {phase: 'calibration', caseId: 'calibration-' + i, targetModelId: model, modelId: model, role: 'calibration', repetition: 1, inputTokenMax: 2000, outputTokenMax: 1000, inputBoundHash: h, bodyCommitment: h};
    batches.push({id: 'calibration-' + i, requests: [d]}); wirePolicies[slotKey(d)] = {kind: 'static', bodySha256: h, templateHash: null, parentKey: null, maximumBytes: 65536};
  }
  return {schemaVersion: 1, protocol: PROTOCOL_V2, planId: PLAN, runId: randomUUID(), mode: 'synthetic', sourceSeal: h,
    quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '11', regionalDenominator: '10', inputFactorNumerator: '3', inputFactorDenominator: '2', models: Object.fromEntries(MODELS.map(m => [m, {inputMicrosPerMillion: '2000000', outputMicrosPerMillion: '10000000'}]))}, batches, wirePolicies};
}
const maximum = s => s.batches.flatMap(b => b.requests).reduce((a, d) => a + BigInt(costUpperMicros(s, d)), 0n).toString();
const approval = (s, amount = maximum(s)) => ({schemaVersion: 1, protocol: PROTOCOL_V2, runId: s.runId, specHash: digest(s), kind: amount === '0' ? 'unapproved' : 'synthetic-test', amountMicros: amount, evidenceHash: amount === '0' ? null : h});
const reserve = (s, l, batchId = s.batches[0].id) => transitionV2(s, l, {kind: 'reserve', batchId});
function binding(s, l, key) {
  const d = s.batches.flatMap(b => b.requests).find(x => slotKey(x) === key), p = s.wirePolicies[key], parent = l.slots[p.parentKey], result = l.results[p.parentKey];
  return {sourceSeal: s.sourceSeal, requestId: l.slots[key].requestId, bodySha256: p.kind === 'static' ? p.bodySha256 : digest('actual future judge bytes'), bodyDigest: p.kind === 'static' ? d.bodyCommitment : digest('actual future judge body'), bytes: 1024,
    parentKey: p.parentKey, parentRequestId: parent?.requestId ?? null, parentOutputHash: result?.outputHash ?? null, parentReceiptHash: parent?.evidenceHash ?? null, templateHash: p.templateHash};
}
const bind = (s, l, key) => transitionV2(s, l, {kind: 'bind', key, binding: binding(s, l, key)});
const consume = (s, l, key) => transitionV2(s, l, {kind: 'consume', key});
function settle(s, l, key, state = 'completed', usage = {inputTokens: 100, outputTokens: 100}) {
  const row = l.slots[key], d = s.batches.flatMap(b => b.requests).find(d => slotKey(d) === key), b = l.bindings[key];
  return transitionV2(s, l, {kind: 'settle', key, state, usage, result: {sourceSeal: s.sourceSeal, requestId: row.requestId, modelId: d.modelId, bodySha256: b.bodySha256, bodyDigest: b.bodyDigest, outputHash: h, state, usage}});
}
function parentCompleted(s = fixture()) {
  let ledger = reserve(s, newLedgerV2(s, approval(s))); const key = slotKey(s.batches[0].requests[0]); ledger = settle(s, consume(s, bind(s, ledger, key), key), key); return {s, ledger, key, judge: slotKey(s.batches[0].requests[1])};
}

test('distinct v2 identity rejects v1 specs,approvals,ledgers and internal projected request IDs', () => {
  const s = fixture(), l = newLedgerV2(s, approval(s)); const {wirePolicies: _p, ...rest} = s; void _p; const old = {...rest, protocol: v1.PROTOCOL};
  const oldApproval = {...approval(s), protocol: v1.PROTOCOL, specHash: digest(old)}, oldLedger = v1.newLedger(old, oldApproval);
  assert.throws(() => validateSpecV2(old), /V2_SPEC_IDENTITY/); assert.throws(() => newLedgerV2(s, oldApproval), /V2_APPROVAL_IDENTITY/); assert.throws(() => accountV2(s, oldLedger), /V2_LEDGER_IDENTITY/);
  const r = reserve(s, l), key = slotKey(s.batches[0].requests[0]); assert.notEqual(r.slots[key].requestId, v2RequestId(old, key));
  r.slots[key].requestId = v2RequestId(old, key); assert.throws(() => accountV2(s, r), /V2_SLOT_IDENTITY/);
});

test('full756-slot pilot schema and exact integer whole-pair reservations retain360/360/36 role ceilings', () => {
  const s = fixture({cases: 60, phases: ['baseline', 'candidate'], models: MODELS, calibration: 36}), counts = validateSpecV2(s);
  assert.deepEqual(counts, {generation: 360, judge: 360, calibration: 36}); const l = reserve(s, newLedgerV2(s, approval(s)));
  const pair = s.batches[0].requests, expected = pair.reduce((a, d) => a + BigInt(costUpperMicros(s, d)), 0n).toString();
  assert.equal(accountV2(s, l).upperMicros, expected); assert.equal(Object.keys(l.slots).length, 2); assert.equal(Object.keys(l.bindings).length, 0);
  evidence.maximumSlotPlan = {slots: 756, counts, protocol: PROTOCOL_V2, oneWholePairReservedMicros: expected, collectionExecuted: false};
});

test('duplicate or excessive roles,self-judge,wrong family/phase and split-pair batches fail validation', () => {
  const mutations = [s => {s.batches[0].requests.push(s.batches[0].requests[0]);}, s => {s.batches[0].requests[1].modelId = MODELS[0];}, s => {s.batches[0].requests[1].caseId = 'wrong-case';}, s => {s.wirePolicies[slotKey(s.batches[0].requests[1])].parentKey = 'unknown';}, s => {s.batches.push({id: 'split-judge', requests: [s.batches[0].requests.pop()]});}];
  for (const mutate of mutations) {const s = fixture(); mutate(s); assert.throws(() => validateSpecV2(s));}
  assert.throws(() => validateSpecV2(fixture({cases: 61, phases: ['baseline', 'candidate'], models: MODELS})), /ROLE_LIMIT/);
  assert.throws(() => validateSpecV2(fixture({cases: 60, phases: ['baseline', 'candidate'], models: MODELS, calibration: 37})), /ROLE_LIMIT/);
});

test('zero approval and insufficient whole-pair funds cannot partially reserve or bind', () => {
  const s = fixture(), zero = newLedgerV2(s, approval(s, '0')), before = digest(zero); assert.throws(() => reserve(s, zero)); assert.equal(digest(zero), before);
  const first = costUpperMicros(s, s.batches[0].requests[0]), small = newLedgerV2(s, approval(s, first)); assert.throws(() => reserve(s, small), /INSUFFICIENT_WHOLE_BATCH/); assert.equal(Object.keys(small.slots).length, 0);
});

test('all approval and immutable policy changes require a new matching v2 approval fingerprint', () => {
  const s = fixture(), a = approval(s);
  for (const mutate of [x => {x.sourceSeal = digest('other-source');}, x => {x.quote.models[MODELS[0]].inputMicrosPerMillion = '1';}, x => {x.wirePolicies[slotKey(x.batches[0].requests[1])].maximumBytes++;}, x => {x.runId = randomUUID();}]) {
    const changed = clone(s); mutate(changed); assert.throws(() => validateApprovalV2(changed, a), /V2_APPROVAL_IDENTITY/);
  }
  assert.throws(() => validateApprovalV2(s, {...a, kind: 'user-approval'}));
});

test('static binding is immutable,byte-bounded,source/request/body-linked and required before consumption', () => {
  const s = fixture(); let l = reserve(s, newLedgerV2(s, approval(s))); const key = slotKey(s.batches[0].requests[0]);
  assert.throws(() => consume(s, l, key), /V2_BIND_BEFORE_CONSUME/);
  const b = binding(s, l, key);
  for (const [k, value] of [['sourceSeal', digest('other')], ['requestId', randomUUID()], ['bodySha256', digest('other')], ['bodyDigest', digest('other')], ['bytes', 65537], ['parentKey', key]]) assert.throws(() => transitionV2(s, l, {kind: 'bind', key, binding: {...b, [k]: value}}));
  l = bind(s, l, key); assert.throws(() => bind(s, l, key), /V2_BIND_HELD/); l = consume(s, l, key); assert.throws(() => consume(s, l, key), /SLOT_NOT_UNSENT/);
});

test('derived body cannot bind until its exact same-family parent is completed with captured output proof', () => {
  const s = fixture(); let l = reserve(s, newLedgerV2(s, approval(s))); const g = slotKey(s.batches[0].requests[0]), j = slotKey(s.batches[0].requests[1]);
  assert.throws(() => bind(s, l, j), /V2_PARENT_NOT_CAPTURED/); l = consume(s, bind(s, l, g), g); assert.throws(() => bind(s, l, j), /V2_PARENT_NOT_CAPTURED/);
  const failed = settle(s, l, g, 'failed'); assert.throws(() => bind(s, failed, j), /V2_PARENT_NOT_CAPTURED/);
  const completed = settle(s, l, g); assert.ok(bind(s, completed, j).bindings[j]);
});

test('judge binding keeps approved template but links newly observed exact body,parent UUID,output and receipt hashes', () => {
  const {s, ledger: l, judge: key} = parentCompleted(), b = binding(s, l, key);
  for (const field of ['parentKey', 'parentRequestId', 'parentOutputHash', 'parentReceiptHash', 'templateHash']) assert.throws(() => transitionV2(s, l, {kind: 'bind', key, binding: {...b, [field]: digest('different')}}));
  let next = bind(s, l, key); assert.notEqual(next.bindings[key].bodyDigest, s.batches[0].requests[1].bodyCommitment); next = settle(s, consume(s, next, key), key);
  assert.equal(next.slots[key].state, 'completed'); assert.equal(next.bindings[key].templateHash, s.batches[0].requests[1].bodyCommitment);
  assert.equal(next.slots[key].evidenceHash, digest(next.results[key])); evidence.parentJudgeBinding = {parentReceiptHash: b.parentReceiptHash, actualBodyDigest: b.bodyDigest, templateHash: b.templateHash, distinct: b.bodyDigest !== b.templateHash};
});

test('cross-request/source/model/body/usage capture mutations and absent results cannot rewrite settled originals', () => {
  const {s, ledger: l, key} = parentCompleted();
  for (const field of ['requestId', 'sourceSeal', 'modelId', 'bodySha256', 'bodyDigest', 'outputHash', 'usage']) { const copy = clone(l); copy.results[key][field] = field === 'usage' ? {inputTokens: 1, outputTokens: 1} : digest('changed'); assert.throws(() => accountV2(s, copy)); }
  const missing = clone(l); delete missing.results[key]; assert.throws(() => accountV2(s, missing), /V2_MISSING_CAPTURE/);
  const rebound = clone(l); rebound.bindings[key].bodySha256 = digest('changed'); assert.throws(() => accountV2(s, rebound));
});

test('consumed without receipt and failed/missing usage retain full reservation; only bounded completed usage releases excess', () => {
  const s = fixture(); let l = reserve(s, newLedgerV2(s, approval(s))); const key = slotKey(s.batches[0].requests[0]), max = accountV2(s, l).upperMicros;
  l = consume(s, bind(s, l, key), key); assert.equal(accountV2(s, l).upperMicros, max);
  for (const [state, usage] of [['failed', {inputTokens: 1, outputTokens: 1}], ['completed', null], ['unknown', null]]) assert.equal(accountV2(s, settle(s, l, key, state, usage)).upperMicros, max);
  assert.ok(BigInt(accountV2(s, settle(s, l, key)).upperMicros) < BigInt(max));
});

test('usage over declared maxima holds subsequent bindings and consumption without erasing spent evidence', () => {
  const s = fixture(); let l = reserve(s, newLedgerV2(s, approval(s))); const key = slotKey(s.batches[0].requests[0]), j = slotKey(s.batches[0].requests[1]);
  l = settle(s, consume(s, bind(s, l, key), key), key, 'completed', {inputTokens: 2001, outputTokens: 2}); assert.equal(l.hold, 'USAGE_BOUND'); assert.equal(l.slots[key].usage.inputTokens, 2001); assert.throws(() => bind(s, l, j), /V2_BIND_HELD/);
});

test('close marks only unsent slots unused,keeps consumed maximum and prohibits reopen,reserve or bind', () => {
  const s = fixture(); let l = reserve(s, newLedgerV2(s, approval(s))); const key = slotKey(s.batches[0].requests[0]), j = slotKey(s.batches[0].requests[1]); l = consume(s, bind(s, l, key), key);
  l = transitionV2(s, l, {kind: 'close'}); assert.equal(l.slots[key].state, 'consumed'); assert.equal(l.slots[j].state, 'unused'); assert.equal(accountV2(s, l).upperMicros, costUpperMicros(s, s.batches[0].requests[0]));
  for (const op of [{kind: 'reopen'}, {kind: 'reserve', batchId: s.batches[0].id}, {kind: 'bind', key: j, binding: binding(s, l, j)}]) assert.throws(() => transitionV2(s, l, op));
  assert.equal(settle(s, l, key).closed, true); // receipt settlement is not a resend.
});

test('approval withdrawal retains already-used costs and blocks future request binding', () => {
  const {s, ledger: l, judge} = parentCompleted(); const reduced = transitionV2(s, l, {kind: 'approval', approval: approval(s, '0')});
  assert.equal(reduced.hold, 'AUTHORIZATION_REDUCED'); assert.ok(BigInt(accountV2(s, reduced).upperMicros) > 0n); assert.throws(() => bind(s, reduced, judge), /V2_BIND_HELD/);
});

test('v2 reuses safe T20 diagnostics with external v2 identities,stop policy and no raw message or ledger mutation', () => {
  const s = fixture(); let l = reserve(s, newLedgerV2(s, approval(s))); const key = slotKey(s.batches[0].requests[0]); l = consume(s, bind(s, l, key), key); const before = digest(l);
  for (const httpStatus of [402, 429]) {
    const d = diagnoseFailureV2({spec: s, ledger: l, key, stage: 'generation_transport', httpStatus, error: new Error('SYNTHETIC_PRIVATE sk-proj-SYNTHETIC')});
    assert.equal(d.protocol, PROTOCOL_V2); assert.equal(d.specHash, digest(s)); assert.equal(d.requestId, l.slots[key].requestId); assert.equal(d.nextAction, 'stop-run'); assert.equal(d.networkCalls, null); assert.equal(d.slotRetry, 'never-resend'); assert.doesNotMatch(JSON.stringify(d), /SYNTHETIC_PRIVATE|sk-proj-/);
  }
  assert.equal(digest(l), before);
});

test('pure transitions preserve frozen inputs and produce deterministic v2 slots while changed input hashes fail closed', () => {
  const s = fixture(), a = approval(s), l = newLedgerV2(s, a); const before = digest({s, a, l});
  const one = reserve(s, l), two = reserve(s, l); assert.deepEqual(one, two); assert.equal(digest({s, a, l}), before);
  const changed = clone(s); changed.batches[0].requests[0].inputBoundHash = digest('other-bound'); assert.throws(() => accountV2(changed, one), /V2_LEDGER_IDENTITY/);
});

test.after(() => {writeFileSync(resolve(out, 'budget-v2-observations.json'), JSON.stringify({...evidence, durableStoreIntegrated: false, liveEvaluationSupported: false, actualFinalEvaluationFrozen: false}, null, 2) + '\n');});
