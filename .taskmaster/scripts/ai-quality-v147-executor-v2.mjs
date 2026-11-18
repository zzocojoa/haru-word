// Synthetic orchestration only. Transport is an explicitly injected test double;
// this module never discovers credentials,URLs,old approvals or provider clients.
import {digest, slotKey, accountV2, validateSpecV2, diagnoseFailureV2} from './ai-quality-v147-budget-v2.mjs';
import {verifyV2Freeze, prepareV2Wire} from './ai-quality-v147-wire-v2.mjs';
import {openV2Journal, readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {captureResultV2, readCaptureV2, settleCaptureV2} from './ai-quality-v147-capture-v2.mjs';
import {stageForAppFailure} from './ai-quality-v147-failures.mjs';

const check = (ok, code) => {if (!ok) throw new Error(code);};
const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...names].sort().join('|');

export function openSyntheticExecutorV2({context: input, seal: inputSeal, observeCurrent, readWire, transport, testFault}) {
  const context = structuredClone(input), seal = structuredClone(inputSeal), spec = context.spec;
  validateSpecV2(spec); check(spec.mode === 'synthetic', 'V2E_SYNTHETIC_ONLY');
  check(typeof observeCurrent === 'function' && typeof readWire === 'function' && typeof transport === 'function', 'V2E_TEST_DOUBLES_REQUIRED');
  const descriptors = new Map(spec.batches.flatMap(b => b.requests.map(d => [slotKey(d), d])));
  function current() {
    check(digest(input) === digest(context), 'V2E_CONTEXT_CHANGED');
    const snapshot = structuredClone(observeCurrent()); verifyV2Freeze({seal, current: snapshot, spec});
    check(snapshot.environment.nodeVersion === process.version && snapshot.environment.platform === process.platform && snapshot.environment.arch === process.arch, 'V2E_ACTUAL_RUNTIME');
    return snapshot;
  }
  current();
  const before = readV2Journal(context), initial = accountV2(spec, before.ledger);
  check(before.ledger.closed || !before.ledger.hold && !initial.overBudget && BigInt(initial.limitMicros) > 0n, 'V2E_UNAPPROVED');
  const session = openV2Journal(context); let busy = false, released = false;
  const state = () => {check(!released, 'V2E_SESSION_RELEASED'); return session.current().ledger;};
  const emit = stage => testFault?.(stage);
  function diagnostic(key, stage, error) {return diagnoseFailureV2({spec, ledger: state(), key, stage, error});}
  function held(key, stage, error) {const ledger = state(); return {key, status: 'held', requestId: ledger.slots[key]?.requestId ?? null, diagnostic: ledger.slots[key] ? diagnostic(key, stage, error) : null};}
  function wire(key, ledger) {
    const p = spec.wirePolicies[key], args = structuredClone(readWire(key));
    check(fields(args, p.kind === 'static' ? ['raw'] : ['templateRaw']), 'V2E_WIRE_INPUTS');
    const parentRaw = p.kind === 'derived' ? readCaptureV2({context, ledger, key: p.parentKey}).payloadRaw : null;
    return {...prepareV2Wire({seal, current: current(), spec, ledger, key, ...args, parentRaw}), inputHash:digest(args)};
  }
  async function dispatch(key) {
    const d = descriptors.get(key); check(d, 'V2E_UNKNOWN_SLOT');
    let ledger = state(), row = ledger.slots[key]; check(row, 'V2E_UNRESERVED');
    if (['completed', 'failed', 'unknown'].includes(row.state)) {
      try {readCaptureV2({context, ledger, key}); return {key, status: 'already-settled', state: row.state, requestId: row.requestId};}
      catch (error) {return held(key, 'receipt_storage', error);}
    }
    if (row.state === 'consumed') {
      try {const recovered = settleCaptureV2({context, session, key}); return {key, status: 'recovered-capture', state: recovered.status, requestId: row.requestId};}
      catch (error) {return held(key, 'receipt_storage', error);}
    }
    check(!ledger.closed && !ledger.hold && row.state === 'reserved', 'V2E_NO_DISPATCH');
    let prepared;
    try {
      prepared = wire(key, ledger);
      if (prepared.bindOperation) session.append(prepared.bindOperation);
      emit('executor:after-binding');
      const checked = wire(key, state()); check(checked.raw === prepared.raw && digest(checked.binding) === digest(prepared.binding), 'V2E_WIRE_CHANGED');
      session.append({kind: 'consume', key}); emit('executor:after-consume-before-transport');
      // Re-observe the environment and exact input after consume and immediately
      // before the single callback. A refusal here still retains maximum cost.
      current(); check(digest(readWire(key)) === prepared.inputHash, 'V2E_WIRE_CHANGED');
    } catch (error) {return held(key, 'preflight', error);}
    let response;
    try {response = await transport({key, requestId: row.requestId, raw: prepared.raw, modelId: d.modelId, role: d.role});}
    catch (error) {return held(key, stageForAppFailure(error, d.role === 'generation' ? 'generation' : 'judge'), error);}
    emit('executor:after-transport-before-capture');
    if (!fields(response, ['state','modelId','payloadRaw','usage']) || response.modelId !== d.modelId) return held(key, d.role === 'generation' ? 'generation_format' : 'judge_format');
    if (response.state === 'completed' && d.role === 'generation') {
      try {check(JSON.parse(response.payloadRaw).original === JSON.parse(JSON.parse(prepared.raw).input[0].content).sentence, 'V2E_VISIBLE_INPUT');}
      catch (error) {return held(key, 'generation_format', error);}
    }
    try {
      captureResultV2({context, ledger: state(), key, state: response.state, usage: response.usage, payloadRaw: response.payloadRaw});
      emit('executor:after-capture-before-settle');
      settleCaptureV2({context, session, key});
    } catch (error) {
      const format = ['V2C_JSON','V2C_VISIBLE_FIELDS','V2C_PAYLOAD_SIZE','V2C_FAILED_VISIBLE_PAYLOAD'].includes(error?.message)
        || d.role !== 'generation' && error?.code === 'ERR_ASSERTION';
      return held(key, format ? (d.role === 'generation' ? 'generation_format' : 'judge_format') : 'receipt_storage', error);
    }
    ledger = state(); row = ledger.slots[key];
    return {key, status: ledger.hold ? 'held' : row.state, requestId: row.requestId, diagnostic: ledger.hold ? diagnostic(key, 'unknown') : null};
  }
  async function exclusive(fn) {
    check(!busy && !released, 'V2E_SESSION_BUSY'); busy = true;
    try {return await fn();} finally {busy = false;}
  }
  return Object.freeze({
    dispatch: key => exclusive(() => dispatch(key)),
    collect: () => exclusive(async () => {
      const snapshot = current(), order = spec.batches.flatMap(b => b.requests.map(slotKey));
      check(digest(snapshot.order) === digest(order), 'V2E_BATCH_ORDER'); const results = [];
      if (!state().closed) {
        outer: for (const batch of spec.batches) {
          current(); const existing = batch.requests.filter(d => state().slots[slotKey(d)]);
          check(existing.length === 0 || existing.length === batch.requests.length, 'V2E_PARTIAL_BATCH');
          if (!existing.length) session.append({kind: 'reserve', batchId: batch.id});
          for (const d of batch.requests) {
            const key = slotKey(d), parent = spec.wirePolicies[key].parentKey;
            if (parent && state().slots[parent]?.state !== 'completed') {results.push({key,status:'parent-unavailable'}); continue;}
            const result = await dispatch(key); results.push(result); if (result.status === 'held') break outer;
          }
        }
        session.append({kind: 'close'});
      }
      const ledger = state(), counts = Object.values(ledger.slots).reduce((v,row) => {v[row.state]=(v[row.state]??0)+1;return v;},{});
      for (const [key,row] of Object.entries(ledger.slots)) if (['completed','failed','unknown'].includes(row.state)) readCaptureV2({context,ledger,key});
      return {status: counts.completed === descriptors.size ? 'synthetic-collection-complete' : 'held', results, counts, plannedSlots:descriptors.size,
        closed:ledger.closed, balance:accountV2(spec,ledger), actualProviderCalls:0, actualKeyReads:0, actualReceiptAuthenticated:false, modelQualityMeasured:false, releaseVerdict:'held'};
    }),
    inspect: () => structuredClone(state()),
    release: () => {check(!busy && !released,'V2E_SESSION_BUSY'); session.close(); released=true;}
  });
}
