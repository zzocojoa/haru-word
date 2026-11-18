// Evaluation tooling only. No credentials, network, old ledgers, or product limits.
import {createHash} from 'node:crypto';

export const PROTOCOL = 'ai-quality-v147-pilot-v1';
export const PLAN = 'ai-quality-v147-2026-11-06';
export const MODELS = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra'];
export const ROLE_LIMITS = {generation: 360, judge: 360, calibration: 36};
const check = (condition, code) => { if (!condition) throw new Error(code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, names) => object(x) && Object.keys(x).sort().join('|') === [...names].sort().join('|');
const hashValue = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const token = n => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000;
const money = x => typeof x === 'string' && /^(0|[1-9][0-9]{0,49})$/.test(x);
const id = x => typeof x === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(x);
const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const canonical = x => Array.isArray(x) ? x.map(canonical) : object(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
export const digest = x => createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const ceil = (n, d) => (n + d - 1n) / d;

export function slotKey(d) {
  return [d.phase, d.targetModelId, d.caseId, d.role, d.repetition].join('/');
}

export function validateSpec(spec) {
  check(keys(spec, ['schemaVersion', 'protocol', 'planId', 'runId', 'mode', 'sourceSeal', 'quote', 'batches']), 'SPEC_FIELDS');
  check(spec.schemaVersion === 1 && spec.protocol === PROTOCOL && spec.planId === PLAN && uuid(spec.runId), 'PROTOCOL_BINDING');
  check(['synthetic', 'evaluation'].includes(spec.mode) && hashValue(spec.sourceSeal), 'SOURCE_BINDING');
  const q = spec.quote;
  check(keys(q, ['kind', 'evidenceHash', 'regionalNumerator', 'regionalDenominator', 'inputFactorNumerator', 'inputFactorDenominator', 'models']), 'QUOTE_FIELDS');
  check(q.kind === (spec.mode === 'synthetic' ? 'synthetic-test' : 'verified-price') && hashValue(q.evidenceHash), 'QUOTE_BINDING');
  for (const field of ['regionalNumerator', 'regionalDenominator', 'inputFactorNumerator', 'inputFactorDenominator'])
    check(money(q[field]) && BigInt(q[field]) > 0n, 'PRICE_FACTOR');
  check(BigInt(q.regionalNumerator) >= BigInt(q.regionalDenominator) && BigInt(q.inputFactorNumerator) >= BigInt(q.inputFactorDenominator), 'UNSAFE_PRICE_FACTOR');
  check(keys(q.models, MODELS), 'MODEL_PRICES');
  for (const rate of Object.values(q.models)) check(keys(rate, ['inputMicrosPerMillion', 'outputMicrosPerMillion'])
    && money(rate.inputMicrosPerMillion) && money(rate.outputMicrosPerMillion)
    && BigInt(rate.inputMicrosPerMillion) > 0n && BigInt(rate.outputMicrosPerMillion) > 0n, 'PRICE_RATE');
  check(Array.isArray(spec.batches) && spec.batches.length > 0 && spec.batches.length <= 756, 'BATCHES');
  const seen = new Set(), batches = new Set(), counts = {generation: 0, judge: 0, calibration: 0};
  for (const batch of spec.batches) {
    check(keys(batch, ['id', 'requests']) && id(batch.id) && !batches.has(batch.id), 'BATCH_ID'); batches.add(batch.id);
    check(Array.isArray(batch.requests) && batch.requests.length > 0 && batch.requests.length <= 756, 'BATCH_REQUESTS');
    for (const d of batch.requests) {
      check(keys(d, ['phase', 'caseId', 'targetModelId', 'modelId', 'role', 'repetition', 'inputTokenMax', 'outputTokenMax', 'inputBoundHash', 'bodyCommitment']), 'REQUEST_FIELDS');
      check(MODELS.includes(d.modelId) && MODELS.includes(d.targetModelId) && id(d.caseId)
        && Object.hasOwn(ROLE_LIMITS, d.role) && Number.isSafeInteger(d.repetition) && d.repetition >= 1 && d.repetition <= 1000, 'REQUEST_IDENTITY');
      check(d.role === 'calibration' ? d.phase === 'calibration' && d.targetModelId === d.modelId
        : ['baseline', 'candidate'].includes(d.phase) && (d.role === 'generation' ? d.modelId === d.targetModelId : d.modelId !== d.targetModelId), 'ROLE_BINDING');
      check(token(d.inputTokenMax) && d.inputTokenMax > 0 && token(d.outputTokenMax) && d.outputTokenMax > 0
        && d.outputTokenMax <= 4096 && (d.role !== 'generation' || d.outputTokenMax === 4096), 'TOKEN_BOUND');
      check(hashValue(d.inputBoundHash) && hashValue(d.bodyCommitment), 'REQUEST_PROVENANCE');
      const key = slotKey(d); check(!seen.has(key), 'DUPLICATE_SLOT'); seen.add(key); counts[d.role]++;
      check(counts[d.role] <= ROLE_LIMITS[d.role], 'ROLE_LIMIT');
    }
  }
  check(seen.size <= 756, 'TOTAL_LIMIT');
  return counts;
}

export function validateApproval(spec, approval) {
  check(keys(approval, ['schemaVersion', 'protocol', 'runId', 'specHash', 'kind', 'amountMicros', 'evidenceHash']), 'APPROVAL_FIELDS');
  check(approval.schemaVersion === 1 && approval.protocol === PROTOCOL && approval.runId === spec.runId
    && approval.specHash === digest(spec) && money(approval.amountMicros), 'APPROVAL_BINDING');
  check(approval.kind === 'unapproved' ? approval.amountMicros === '0' && approval.evidenceHash === null
    : approval.kind === (spec.mode === 'synthetic' ? 'synthetic-test' : 'user-approval') && hashValue(approval.evidenceHash), 'APPROVAL_PROVENANCE');
}

// Integer micro-USD. Rates also use micro-USD per million tokens; ceil once per request.
export function costUpperMicros(spec, d, usage = {inputTokens: d.inputTokenMax, outputTokens: d.outputTokenMax}) {
  check(token(usage.inputTokens) && token(usage.outputTokens), 'USAGE_TOKENS');
  const q = spec.quote, rate = q.models[d.modelId];
  const numerator = (BigInt(usage.inputTokens) * BigInt(rate.inputMicrosPerMillion) * BigInt(q.inputFactorNumerator)
    + BigInt(usage.outputTokens) * BigInt(rate.outputMicrosPerMillion) * BigInt(q.inputFactorDenominator)) * BigInt(q.regionalNumerator);
  return ceil(numerator, 1_000_000n * BigInt(q.inputFactorDenominator) * BigInt(q.regionalDenominator)).toString();
}

export function newLedger(spec, approval) {
  validateSpec(spec); validateApproval(spec, approval);
  return {schemaVersion: 1, protocol: PROTOCOL, runId: spec.runId, specHash: digest(spec), approval: structuredClone(approval),
    closed: false, hold: null, slots: {}};
}

function descriptors(spec) { return new Map(spec.batches.flatMap(b => b.requests.map(d => [slotKey(d), d]))); }
function requestId(specHash, key) {
  const h = digest({specHash, slot: key});
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}

export function account(spec, ledger) {
  validateSpec(spec); validateApproval(spec, ledger.approval);
  check(keys(ledger, ['schemaVersion', 'protocol', 'runId', 'specHash', 'approval', 'closed', 'hold', 'slots'])
    && ledger.schemaVersion === 1 && ledger.protocol === PROTOCOL && ledger.runId === spec.runId && ledger.specHash === digest(spec)
    && typeof ledger.closed === 'boolean' && [null, 'USAGE_BOUND', 'AUTHORIZATION_REDUCED'].includes(ledger.hold) && object(ledger.slots), 'LEDGER_BINDING');
  const by = descriptors(spec), specHash = digest(spec), counts = {generation: 0, judge: 0, calibration: 0};
  let upper = 0n, known = 0, consumed = 0;
  for (const [key, row] of Object.entries(ledger.slots)) {
    const d = by.get(key);
    check(d && keys(row, ['descriptorHash', 'requestId', 'state', 'usage', 'evidenceHash'])
      && row.descriptorHash === digest(d) && row.requestId === requestId(specHash, key), 'SLOT_BINDING');
    check(['reserved', 'consumed', 'completed', 'failed', 'unknown', 'unused'].includes(row.state), 'SLOT_STATE');
    check(row.evidenceHash === null || hashValue(row.evidenceHash), 'RESULT_EVIDENCE');
    check(row.usage === null || keys(row.usage, ['inputTokens', 'outputTokens']) && token(row.usage.inputTokens) && token(row.usage.outputTokens), 'USAGE_SCHEMA');
    check(!['reserved', 'consumed', 'unused'].includes(row.state) || row.usage === null && row.evidenceHash === null, 'PRE_RESULT_STATE');
    counts[d.role]++; if (!['reserved', 'unused'].includes(row.state)) consumed++;
    if (row.state === 'unused') continue;
    const bounded = row.usage && row.usage.inputTokens <= d.inputTokenMax && row.usage.outputTokens <= d.outputTokenMax;
    if (row.state === 'completed' && bounded) { upper += BigInt(costUpperMicros(spec, d, row.usage)); known++; }
    else upper += BigInt(costUpperMicros(spec, d));
    check(!row.usage || bounded || ledger.hold === 'USAGE_BOUND', 'UNHELD_USAGE_OVERFLOW');
  }
  for (const role of Object.keys(counts)) check(counts[role] <= ROLE_LIMITS[role], 'ROLE_LIMIT');
  const limit = BigInt(ledger.approval.amountMicros);
  return {limitMicros: limit.toString(), upperMicros: upper.toString(), remainingMicros: (limit > upper ? limit - upper : 0n).toString(),
    overBudget: upper > limit, slots: Object.keys(ledger.slots).length, consumedSlots: consumed, knownUsageSlots: known, counts,
    invoiceVerified: false, realDispatchAuthorized: false};
}

// Pure transition, committed by the store before a caller could perform any I/O.
export function transition(spec, ledger, operation) {
  const before = account(spec, ledger), next = structuredClone(ledger), by = descriptors(spec);
  check(object(operation) && typeof operation.kind === 'string', 'OPERATION');
  if (operation.kind === 'approval') {
    check(keys(operation, ['kind', 'approval']) && !ledger.closed, 'APPROVAL_OPERATION');
    validateApproval(spec, operation.approval); next.approval = structuredClone(operation.approval);
    if (BigInt(operation.approval.amountMicros) < BigInt(before.upperMicros) && !next.hold) next.hold = 'AUTHORIZATION_REDUCED';
  } else if (operation.kind === 'close') {
    check(keys(operation, ['kind']) && !ledger.closed, 'CLOSE_OPERATION'); next.closed = true;
    for (const row of Object.values(next.slots)) if (row.state === 'reserved') row.state = 'unused';
  } else if (operation.kind === 'reserve') {
    check(keys(operation, ['kind', 'batchId']) && !ledger.closed && !ledger.hold && !before.overBudget, 'RESERVATION_HELD');
    const batch = spec.batches.find(b => b.id === operation.batchId); check(batch, 'BATCH_NOT_FROZEN');
    for (const d of batch.requests) {
      const key = slotKey(d); check(!Object.hasOwn(next.slots, key), 'SLOT_ALREADY_RESERVED');
      next.slots[key] = {descriptorHash: digest(d), requestId: requestId(next.specHash, key), state: 'reserved', usage: null, evidenceHash: null};
    }
    check(!account(spec, next).overBudget, 'INSUFFICIENT_WHOLE_BATCH');
  } else if (operation.kind === 'consume') {
    check(keys(operation, ['kind', 'key']) && !ledger.closed && !ledger.hold && !before.overBudget && BigInt(before.limitMicros) > 0n, 'CONSUMPTION_HELD');
    const row = next.slots[operation.key]; check(row?.state === 'reserved', 'SLOT_NOT_UNSENT'); row.state = 'consumed';
  } else if (operation.kind === 'settle') {
    check(keys(operation, ['kind', 'key', 'state', 'usage', 'evidenceHash']) && ['completed', 'failed', 'unknown'].includes(operation.state), 'SETTLEMENT_OPERATION');
    const row = next.slots[operation.key], d = by.get(operation.key);
    check(row?.state === 'consumed', 'SLOT_NOT_CONSUMED');
    check(operation.evidenceHash === null || hashValue(operation.evidenceHash), 'RESULT_EVIDENCE');
    check(operation.usage === null || keys(operation.usage, ['inputTokens', 'outputTokens']) && token(operation.usage.inputTokens) && token(operation.usage.outputTokens), 'USAGE_SCHEMA');
    check(operation.state !== 'completed' || hashValue(operation.evidenceHash), 'COMPLETION_EVIDENCE');
    Object.assign(row, {state: operation.state, usage: structuredClone(operation.usage), evidenceHash: operation.evidenceHash});
    if (row.usage && (row.usage.inputTokens > d.inputTokenMax || row.usage.outputTokens > d.outputTokenMax)) next.hold = 'USAGE_BOUND';
  } else throw new Error('UNKNOWN_OPERATION');
  account(spec, next); return next;
}
