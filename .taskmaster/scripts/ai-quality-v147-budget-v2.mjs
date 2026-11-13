// Distinct protocol for pre-reserved derived judge bodies. Pure transitions only.
// The v1 engine is a private arithmetic/state-machine view. No v1 spec,approval,
// ledger or request ID is accepted as a v2 durable identity or dispatch authority.
import * as v1 from './ai-quality-v147-budget.mjs';
import {diagnoseFailure} from './ai-quality-v147-failures.mjs';
export {digest, slotKey, MODELS, costUpperMicros} from './ai-quality-v147-budget.mjs';
export const PROTOCOL_V2 = 'ai-quality-v147-pilot-v2';
const {digest, slotKey} = v1;
const check = (ok, code) => { if (!ok) throw new Error(code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fields = (x, names) => object(x) && Object.keys(x).sort().join('|') === [...names].sort().join('|');
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const descriptors = spec => new Map(spec.batches.flatMap(b => b.requests.map(d => [slotKey(d), d])));
function requestIdFromHash(specHash, key) {
  const h = digest({specHash, slot: key});
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function v2RequestId(spec, key) { return requestIdFromHash(digest(spec), key); }
function baseSpec(spec) { const {wirePolicies: _policies, ...rest} = spec; void _policies; return {...rest, protocol: v1.PROTOCOL}; }
function baseApproval(spec, approval) { return {...approval, protocol: v1.PROTOCOL, specHash: digest(baseSpec(spec))}; }

export function validateSpecV2(spec) {
  check(fields(spec, ['schemaVersion', 'protocol', 'planId', 'runId', 'mode', 'sourceSeal', 'quote', 'batches', 'wirePolicies']) && spec.protocol === PROTOCOL_V2, 'V2_SPEC_IDENTITY');
  const counts = v1.validateSpec(baseSpec(spec)), by = descriptors(spec), batchOf = new Map(spec.batches.flatMap(b => b.requests.map(d => [slotKey(d), b.id]))); check(fields(spec.wirePolicies, [...by.keys()]), 'V2_WIRE_POLICIES');
  for (const [key, d] of by) {
    const p = spec.wirePolicies[key];
    check(fields(p, ['kind', 'bodySha256', 'templateHash', 'parentKey', 'maximumBytes']) && ['static', 'derived'].includes(p.kind)
      && Number.isSafeInteger(p.maximumBytes) && p.maximumBytes > 0 && p.maximumBytes <= 262144, 'V2_WIRE_POLICY');
    if (p.kind === 'static') check(hash(p.bodySha256) && p.templateHash === null && p.parentKey === null, 'V2_STATIC_POLICY');
    else {
      const parent = by.get(p.parentKey);
      check(d.role === 'judge' && p.bodySha256 === null && hash(p.templateHash) && d.bodyCommitment === p.templateHash
        && parent?.role === 'generation' && parent.phase === d.phase && parent.caseId === d.caseId && parent.targetModelId === d.targetModelId
        && parent.repetition === d.repetition && parent.modelId !== d.modelId, 'V2_DERIVED_PARENT');
      // Both maximum costs must be approved and reserved together,before a parent
      // can be sent. A future body never creates an additional budget allowance.
      check(batchOf.get(key) === batchOf.get(p.parentKey), 'V2_WHOLE_PAIR_BATCH');
    }
  }
  return counts;
}
export function validateApprovalV2(spec, approval) {
  validateSpecV2(spec);
  check(fields(approval, ['schemaVersion', 'protocol', 'runId', 'specHash', 'kind', 'amountMicros', 'evidenceHash']) && approval.protocol === PROTOCOL_V2
    && approval.runId === spec.runId && approval.specHash === digest(spec), 'V2_APPROVAL_IDENTITY');
  v1.validateApproval(baseSpec(spec), baseApproval(spec, approval));
}
export function newLedgerV2(spec, approval) {
  validateApprovalV2(spec, approval);
  return {schemaVersion: 1, protocol: PROTOCOL_V2, runId: spec.runId, specHash: digest(spec), approval: structuredClone(approval), closed: false, hold: null, slots: {}, bindings: {}, results: {}};
}
function baseLedger(spec, ledger) {
  check(fields(ledger, ['schemaVersion', 'protocol', 'runId', 'specHash', 'approval', 'closed', 'hold', 'slots', 'bindings', 'results']) && ledger.schemaVersion === 1
    && ledger.protocol === PROTOCOL_V2 && ledger.runId === spec.runId && ledger.specHash === digest(spec) && object(ledger.slots) && object(ledger.bindings) && object(ledger.results), 'V2_LEDGER_IDENTITY');
  validateApprovalV2(spec, ledger.approval); const by = descriptors(spec), base = baseSpec(spec), shadow = v1.newLedger(base, baseApproval(spec, ledger.approval)), specHash = digest(spec), baseHash = digest(base); shadow.closed = ledger.closed; shadow.hold = ledger.hold;
  for (const [key, row] of Object.entries(ledger.slots)) {
    const d = by.get(key); check(d && fields(row, ['descriptorHash', 'requestId', 'state', 'usage', 'evidenceHash']) && row.descriptorHash === digest(d) && row.requestId === requestIdFromHash(specHash, key), 'V2_SLOT_IDENTITY');
    shadow.slots[key] = {...structuredClone(row), requestId: requestIdFromHash(baseHash, key)};
  }
  return {base, shadow};
}
function resultEvidence(spec, ledger, key, result, by = descriptors(spec)) {
  const row = ledger.slots[key];
  check(row && ['completed', 'failed', 'unknown'].includes(row.state) && fields(result, ['sourceSeal', 'requestId', 'modelId', 'bodySha256', 'bodyDigest', 'outputHash', 'state', 'usage'])
    && result.sourceSeal === spec.sourceSeal && result.requestId === row.requestId && result.modelId === by.get(key)?.modelId
    && result.bodySha256 === ledger.bindings[key]?.bodySha256 && result.bodyDigest === ledger.bindings[key]?.bodyDigest && hash(result.outputHash)
    && result.state === row.state && digest(result.usage) === digest(row.usage) && row.evidenceHash === digest(result), 'V2_RESULT_EVIDENCE');
}
function bindingEvidence(spec, ledger, key, b, by = descriptors(spec)) {
  const d = by.get(key), row = ledger.slots[key], policy = spec.wirePolicies[key];
  check(d && row && fields(b, ['sourceSeal', 'requestId', 'bodySha256', 'bodyDigest', 'bytes', 'parentKey', 'parentRequestId', 'parentOutputHash', 'parentReceiptHash', 'templateHash'])
    && b.sourceSeal === spec.sourceSeal && b.requestId === row.requestId && hash(b.bodySha256) && hash(b.bodyDigest) && Number.isSafeInteger(b.bytes) && b.bytes > 0 && b.bytes <= policy.maximumBytes, 'V2_BINDING_FIELDS');
  if (policy.kind === 'static') check(b.bodySha256 === policy.bodySha256 && b.bodyDigest === d.bodyCommitment && b.parentKey === null && b.parentRequestId === null && b.parentOutputHash === null && b.parentReceiptHash === null && b.templateHash === null, 'V2_STATIC_BINDING');
  else {
    const parent = ledger.slots[policy.parentKey], result = ledger.results[policy.parentKey];
    check(b.parentKey === policy.parentKey && b.templateHash === policy.templateHash && parent?.state === 'completed' && result
      && b.parentRequestId === parent.requestId && b.parentOutputHash === result.outputHash && b.parentReceiptHash === parent.evidenceHash, 'V2_PARENT_NOT_CAPTURED');
    resultEvidence(spec, ledger, policy.parentKey, result, by);
  }
}
export function accountV2(spec, ledger) {
  validateSpecV2(spec); const {base, shadow} = baseLedger(spec, ledger), balance = v1.account(base, shadow), by = descriptors(spec);
  for (const [key, b] of Object.entries(ledger.bindings)) bindingEvidence(spec, ledger, key, b, by);
  for (const [key, row] of Object.entries(ledger.slots)) if (['consumed', 'completed', 'failed', 'unknown'].includes(row.state)) check(ledger.bindings[key], 'V2_UNBOUND_CONSUMPTION');
  for (const [key, r] of Object.entries(ledger.results)) resultEvidence(spec, ledger, key, r, by);
  for (const [key, row] of Object.entries(ledger.slots)) if (['completed', 'failed', 'unknown'].includes(row.state) && row.evidenceHash !== null) check(ledger.results[key], 'V2_MISSING_CAPTURE');
  return {...balance, protocol: PROTOCOL_V2, specHash: digest(spec), realDispatchAuthorized: false};
}
function fromBase(spec, ledger, shadow) {
  const specHash = digest(spec), next = {...structuredClone(ledger), approval: {...shadow.approval, protocol: PROTOCOL_V2, specHash}, closed: shadow.closed, hold: shadow.hold, slots: {}};
  for (const [key, row] of Object.entries(shadow.slots)) next.slots[key] = {...row, requestId: requestIdFromHash(specHash, key)};
  return next;
}
export function transitionV2(spec, ledger, operation) {
  const before = accountV2(spec, ledger), next = structuredClone(ledger); check(object(operation), 'V2_OPERATION');
  if (operation.kind === 'bind') {
    check(fields(operation, ['kind', 'key', 'binding']) && !ledger.closed && !ledger.hold && !before.overBudget && BigInt(before.limitMicros) > 0n
      && ledger.slots[operation.key]?.state === 'reserved' && !ledger.bindings[operation.key], 'V2_BIND_HELD');
    bindingEvidence(spec, ledger, operation.key, operation.binding); next.bindings[operation.key] = structuredClone(operation.binding);
  } else {
    const {base, shadow} = baseLedger(spec, ledger); let op = structuredClone(operation);
    if (op.kind === 'consume') check(ledger.bindings[op.key], 'V2_BIND_BEFORE_CONSUME');
    if (op.kind === 'approval') {validateApprovalV2(spec, op.approval); op.approval = baseApproval(spec, op.approval);}
    if (op.kind === 'settle') {
      check(fields(op, ['kind', 'key', 'state', 'usage', 'result']) && ['completed', 'failed', 'unknown'].includes(op.state), 'V2_SETTLE_FIELDS');
      const candidate = {...structuredClone(ledger), slots: {...ledger.slots, [op.key]: {...ledger.slots[op.key], state: op.state, usage: op.usage, evidenceHash: digest(op.result)}}};
      resultEvidence(spec, candidate, op.key, op.result);
      op = {kind: 'settle', key: op.key, state: op.state, usage: op.usage, evidenceHash: digest(op.result)};
    }
    const computed = fromBase(spec, ledger, v1.transition(base, shadow, op));
    if (operation.kind === 'settle') computed.results[operation.key] = structuredClone(operation.result);
    accountV2(spec, computed); return computed;
  }
  accountV2(spec, next); return next;
}

// The private v1 view never escapes as a usable spec/approval/store identity.
export function diagnoseFailureV2({spec, ledger, key, ...metadata}) {
  accountV2(spec, ledger); const {base, shadow} = baseLedger(spec, ledger);
  const result = diagnoseFailure({spec: base, ledger: shadow, key, ...metadata});
  return {...result, protocol: PROTOCOL_V2, specHash: digest(spec), requestId: ledger.slots[key].requestId};
}
