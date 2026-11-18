// Pure bridge between the frozen actual wire and v2 reserved slot. No keys,IO
// or store mutation. A durable executor must commit binding/consume in order.
import {digest, slotKey, validateSpecV2, accountV2} from './ai-quality-v147-budget-v2.mjs';
import {verifyFreeze, verifyFrozenWire, buildDerivedWire} from './ai-quality-v147-freeze.mjs';
const check = (ok, code) => { if (!ok) throw new Error(code); };

export function verifyV2Freeze({seal, current, spec}) {
  verifyFreeze(seal, current); validateSpecV2(spec); const {sourceSeal, ...outline} = spec;
  check(sourceSeal === seal.hash && spec.runId === current.runId && spec.mode === current.mode
    && digest(outline) === current.components.limits && digest(spec.quote) === current.components.quote, 'V2_FREEZE_SPEC');
  const requests = spec.batches.flatMap(b => b.requests); check(requests.length === current.schedule.length, 'V2_FREEZE_SLOT_COUNT');
  for (const d of requests) {
    const key = slotKey(d), p = spec.wirePolicies[key], s = current.schedule.find(s => s.key === key);
    check(s && s.modelId === d.modelId && s.role === d.role && s.kind === p.kind && s.maximumBytes === p.maximumBytes && s.outputTokenMax === d.outputTokenMax
      && s.parentKey === p.parentKey && (p.kind === 'static' ? s.bodyDigest === d.bodyCommitment && s.bodySha256 === p.bodySha256 && s.recipeHash === null
        : s.bodyDigest === null && s.bodySha256 === null && s.recipeHash === p.templateHash), 'V2_FREEZE_POLICY');
  }
  return {sourceSeal, realDispatchAuthorized: false};
}

export function prepareV2Wire({seal, current, spec, ledger, key, raw = null, templateRaw = null, parentRaw = null}) {
  verifyV2Freeze({seal, current, spec}); const balance = accountV2(spec, ledger), row = ledger.slots[key], p = spec.wirePolicies[key];
  check(!ledger.closed && !ledger.hold && !balance.overBudget && BigInt(balance.limitMicros) > 0n && row?.state === 'reserved', 'V2_WIRE_NOT_UNSENT');
  let parentReceipt = null, derivedBinding = null;
  if (p.kind === 'derived') {
    const parent = ledger.slots[p.parentKey], result = ledger.results[p.parentKey];
    check(parent?.state === 'completed' && result && parent.evidenceHash === digest(result), 'V2_WIRE_PARENT_NOT_CAPTURED');
    parentReceipt = {key: p.parentKey, requestId: parent.requestId, responseHash: result.outputHash, receiptHash: parent.evidenceHash, sourceSeal: spec.sourceSeal};
    const built = buildDerivedWire({seal, current, key, templateRaw, parentRaw, parentReceipt});
    check(raw === null || raw === built.raw, 'V2_WIRE_DERIVED_SUBSTITUTION'); raw = built.raw; derivedBinding = built.binding;
  } else check(templateRaw === null && parentRaw === null, 'V2_WIRE_STATIC_INPUTS');
  const proof = verifyFrozenWire({seal, current, key, raw, templateRaw, parentRaw, parentReceipt, derivedBinding});
  const binding = {sourceSeal: spec.sourceSeal, requestId: row.requestId, bodySha256: proof.bodySha256, bodyDigest: proof.bodyDigest, bytes: proof.bytes,
    parentKey: p.parentKey, parentRequestId: parentReceipt?.requestId ?? null, parentOutputHash: parentReceipt?.responseHash ?? null, parentReceiptHash: parentReceipt?.receiptHash ?? null, templateHash: p.templateHash};
  if (ledger.bindings[key]) check(digest(ledger.bindings[key]) === digest(binding), 'V2_WIRE_REBIND');
  return {raw, binding, bindOperation: ledger.bindings[key] ? null : {kind: 'bind', key, binding}, sourceSeal: spec.sourceSeal,
    realDispatchAuthorized: false, receiptAuthenticated: false, inputTokenBoundVerified: false};
}
