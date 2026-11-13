// Offline dispatch/receipt procedure. Live evaluation mode is deliberately unsupported.
import {mkdirSync, lstatSync, realpathSync, openSync, writeFileSync, fsyncSync, closeSync, readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {digest, slotKey} from './ai-quality-v147-budget.mjs';
import {readBudgetStore, transactBudgetStore} from './ai-quality-v147-budget-store.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const token = x => Number.isSafeInteger(x) && x >= 0 && x <= 100_000_000;
const fields = (x, names) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join('|') === [...names].sort().join('|');
function bound(ctx, key) {
  check(ctx.spec.mode === 'synthetic', 'LIVE_EVALUATION_NOT_SUPPORTED');
  const state = readBudgetStore(ctx), d = ctx.spec.batches.flatMap(b => b.requests).find(d => slotKey(d) === key), row = state.ledger.slots[key];
  check(d && row, 'UNRESERVED_SLOT'); return {state, d, row};
}
function wire(d, body) {
  check(body && typeof body === 'object' && body.model === d.modelId && body.max_output_tokens === d.outputTokenMax
    && digest(body) === d.bodyCommitment, 'WIRE_BINDING');
}
function receiptPath(ctx, requestId, creating) {
  // A sibling under the same allowed root. Never write a capture inside the strict journal.
  const root = realpathSync(ctx.allowedRoot), parent = realpathSync(dirname(ctx.directory));
  check(parent === root, 'CAPTURE_SCOPE');
  const directory = resolve(root, `${ctx.spec.runId}-captures`);
  if (creating) { try { mkdirSync(directory); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  check(!lstatSync(directory).isSymbolicLink() && realpathSync(directory) === directory, 'CAPTURE_LINK');
  return resolve(directory, requestId + '.json');
}
function resultData(result, modelId) {
  const valid = fields(result, ['status', 'modelId', 'usage', 'outputHash']) && ['completed', 'failed'].includes(result.status)
    && result.modelId === modelId && hash(result.outputHash);
  const usage = valid && fields(result.usage, ['inputTokens', 'outputTokens']) && token(result.usage.inputTokens) && token(result.usage.outputTokens)
    ? structuredClone(result.usage) : null;
  return {state: valid ? result.status : 'failed', usage, resultHash: digest(result), modelValidated: Boolean(valid)};
}
function makeCapture(ctx, key, row, d, body, result) {
  return {schemaVersion: 1, runId: ctx.spec.runId, specHash: digest(ctx.spec), key, requestId: row.requestId,
    bodyHash: digest(body), modelId: d.modelId, ...resultData(result, d.modelId)};
}
function capture(ctx, record) {
  const file = receiptPath(ctx, record.requestId, true), fd = openSync(file, 'wx');
  try { writeFileSync(fd, JSON.stringify({hash: digest(record), record}) + '\n', 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  return record;
}
function loadCapture(ctx, key, row, d, bodyHash) {
  const file = receiptPath(ctx, row.requestId, false); check(!lstatSync(file).isSymbolicLink() && lstatSync(file).isFile(), 'CAPTURE_FILE');
  let envelope; try { envelope = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('CAPTURE_JSON'); }
  check(fields(envelope, ['hash', 'record']) && envelope.hash === digest(envelope.record), 'CAPTURE_HASH');
  const record = envelope.record;
  check(fields(record, ['schemaVersion', 'runId', 'specHash', 'key', 'requestId', 'bodyHash', 'modelId', 'state', 'usage', 'resultHash', 'modelValidated'])
    && record.schemaVersion === 1 && record.runId === ctx.spec.runId && record.specHash === digest(ctx.spec) && record.key === key
    && record.requestId === row.requestId && record.bodyHash === bodyHash && record.modelId === d.modelId
    && ['completed', 'failed'].includes(record.state) && hash(record.resultHash) && typeof record.modelValidated === 'boolean'
    && (record.state !== 'completed' || record.modelValidated)
    && (record.usage === null || fields(record.usage, ['inputTokens', 'outputTokens']) && token(record.usage.inputTokens) && token(record.usage.outputTokens)), 'CAPTURE_BINDING');
  return record;
}
function applyCapture(ctx, key, body) {
  const {d, row} = bound(ctx, key); wire(d, body);
  const record = loadCapture(ctx, key, row, d, digest(body)), evidenceHash = digest(record);
  if (['completed', 'failed'].includes(row.state)) {
    check(row.evidenceHash === evidenceHash, 'TERMINAL_RECEIPT_MISMATCH'); return {status: 'already-settled', requestId: row.requestId};
  }
  check(row.state === 'consumed', 'RECEIPT_NOT_FOR_SENT_SLOT');
  const final = transactBudgetStore({...ctx, operation: {kind: 'settle', key, state: record.state, usage: record.usage, evidenceHash}});
  return {status: final.ledger.hold ? 'held' : record.state, requestId: row.requestId, evidenceHash};
}

// Recovery inspects the verified committed prefix because strict store reads hold
// while a prepared journal exists. The descriptor binds this fixed synthetic wire.
export function capturedSettlementForRecovery({context: ctx, key, row}) {
  check(ctx.spec.mode === 'synthetic', 'LIVE_EVALUATION_NOT_SUPPORTED');
  const d = ctx.spec.batches.flatMap(b => b.requests).find(d => slotKey(d) === key);
  check(d && row?.state === 'consumed', 'RECOVERY_CAPTURE_SLOT');
  return loadCapture(ctx, key, row, d, d.bodyCommitment);
}

export async function dispatchSyntheticOnce({context: ctx, key, body, transport, testFault}) {
  const {d, row} = bound(ctx, key); wire(d, body); check(typeof transport === 'function', 'SYNTHETIC_TRANSPORT_REQUIRED');
  check(row.state === 'reserved', 'NO_AUTOMATIC_RESEND'); testFault?.('before-consume');
  transactBudgetStore({...ctx, operation: {kind: 'consume', key}});
  testFault?.('after-consume-before-transport');
  let result;
  try { result = await transport({requestId: row.requestId, body: structuredClone(body)}); }
  catch { return {status: 'held', reason: 'TRANSPORT_UNKNOWN', requestId: row.requestId}; }
  // If the process exits at either boundary, the consumed reservation still exists.
  testFault?.('after-transport-before-capture');
  capture(ctx, makeCapture(ctx, key, row, d, body, result));
  testFault?.('after-capture-before-settle');
  return applyCapture(ctx, key, body);
}

// No transport argument: neither recovery path can generate/grade again.
export function recoverCapturedSynthetic({context, key, body}) { return applyCapture(context, key, body); }

// The caller supplies a local synthetic receipt for the exact request. This does not
// certify an untrusted/live receipt; live authenticated retrieval belongs to T24.
export function recoverSyntheticReceipt({context: ctx, key, body, receipt}) {
  const {d, row} = bound(ctx, key); wire(d, body);
  check(row.state === 'consumed' && fields(receipt, ['requestId', 'bodyHash', 'result'])
    && receipt.requestId === row.requestId && receipt.bodyHash === digest(body), 'RECEIPT_BINDING');
  capture(ctx, makeCapture(ctx, key, row, d, body, receipt.result)); return applyCapture(ctx, key, body);
}
