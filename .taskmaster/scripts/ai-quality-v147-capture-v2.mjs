// Synthetic-only immutable visible payload and receipt capture. No transport.
import {mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, readFileSync, lstatSync, realpathSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {digest, slotKey, validateSpecV2, accountV2, transitionV2} from './ai-quality-v147-budget-v2.mjs';
import {checkedStoreDirectory, validateStoreOwner} from './ai-quality-v147-budget-store.mjs';
import {ownProcessIdentity} from './ai-quality-v147-process.mjs';
import {validateGrade} from './ai-quality-v147-calibration.mjs';
const check = (ok, code) => {if (!ok) throw new Error(code);};
const fields = (x, keys) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|');
const sha = x => createHash('sha256').update(x).digest('hex');
function regular(file) {const s = lstatSync(file); check(s.isFile() && !s.isSymbolicLink() && s.nlink === 1, 'V2C_NONREGULAR_FILE');}
function bytes(file) {regular(file); return readFileSync(file);}
function parse(data) {try {return JSON.parse(data.toString('utf8'));} catch {throw new Error('V2C_JSON');}}
function durable(file, data, fault, stage) {const fd = openSync(file, 'wx', 0o600); try {writeFileSync(fd, data); fault?.(stage + ':before-fsync'); fsyncSync(fd);} finally {closeSync(fd);} fault?.(stage + ':after-fsync');}
function owned(context) {
  validateSpecV2(context.spec); check(context.spec.mode === 'synthetic', 'V2C_SYNTHETIC_ONLY');
  const path = checkedStoreDirectory(context.directory, context.allowedRoot), owner = parse(bytes(resolve(path, 'LOCK.json'))); validateStoreOwner(context, owner);
  check(owner.pid === process.pid && digest(owner.identity) === digest(ownProcessIdentity()), 'V2C_NOT_OWNED');
}
function directory(context, creating = false) {
  validateSpecV2(context.spec); check(context.spec.mode === 'synthetic', 'V2C_SYNTHETIC_ONLY');
  const root = realpathSync(context.allowedRoot), parent = realpathSync(dirname(context.directory)); check(root === parent, 'V2C_SCOPE');
  const path = resolve(root, context.spec.runId + '-v2-captures');
  if (creating) {try {mkdirSync(path);} catch (error) {if (error.code !== 'EEXIST') throw error;}}
  check(!lstatSync(path).isSymbolicLink() && realpathSync(path) === path, 'V2C_LINK'); return path;
}
function payload(role, state, raw) {
  check(typeof raw === 'string' && Buffer.byteLength(raw) <= 262144, 'V2C_PAYLOAD_SIZE');
  if (state !== 'completed') {check(raw === '', 'V2C_FAILED_VISIBLE_PAYLOAD'); return;}
  const value = parse(Buffer.from(raw));
  if (role !== 'generation') {validateGrade(value); return;}
  check(fields(value, ['original', 'meaningUsage', 'grammar', 'correctedSentence', 'explanation']) && typeof value.original === 'string' && value.original.length <= 2000
    && typeof value.correctedSentence === 'string' && value.correctedSentence.length <= 2000 && typeof value.explanation === 'string' && value.explanation.length <= 6000
    && ['appropriate', 'needs_work', 'uncertain'].includes(value.meaningUsage) && ['natural', 'needs_work', 'uncertain'].includes(value.grammar), 'V2C_VISIBLE_FIELDS');
}
function target(context, ledger, key) {
  accountV2(context.spec, ledger); const d = context.spec.batches.flatMap(b => b.requests).find(d => slotKey(d) === key), row = ledger.slots[key];
  check(d && row && ['consumed', 'completed', 'failed', 'unknown'].includes(row.state) && ledger.bindings[key], 'V2C_SLOT'); return {d, row};
}

export function inspectCaptureV2({context, ledger, key, expectedResult}) {
  const {d, row} = target(context, ledger, key), path = directory(context), base = row.requestId;
  const preparedFile = resolve(path, base + '.prepared.json'), payloadFile = resolve(path, base + '.payload.txt'), receiptFile = resolve(path, base + '.receipt.json');
  const prepared = bytes(preparedFile), envelope = parse(prepared), raw = bytes(payloadFile);
  check(fields(envelope, ['schemaVersion', 'protocol', 'runId', 'specHash', 'key', 'result', 'payloadBytes', 'payloadHash']) && envelope.schemaVersion === 2 && envelope.protocol === context.spec.protocol
    && envelope.runId === context.spec.runId && envelope.specHash === digest(context.spec) && envelope.key === key && envelope.payloadBytes === raw.length && envelope.payloadHash === sha(raw)
    && envelope.result?.outputHash === envelope.payloadHash && Buffer.from(raw.toString('utf8')).equals(raw), 'V2C_BINDING');
  const result = envelope.result; payload(d.role, result.state, raw.toString('utf8'));
  if (row.state === 'consumed') transitionV2(context.spec, ledger, {kind: 'settle', key, state: result.state, usage: result.usage, result});
  else check(digest(ledger.results[key]) === digest(result) && row.evidenceHash === digest(result), 'V2C_TERMINAL_RESULT');
  check(expectedResult === undefined || digest(expectedResult) === digest(result), 'V2C_EXPECTED_RESULT');
  const committed = existsSync(receiptFile); if (committed) check(bytes(receiptFile).equals(prepared), 'V2C_RECEIPT_CHANGED');
  const files = {[base + '.prepared.json']: sha(prepared), [base + '.payload.txt']: sha(raw), ...(committed ? {[base + '.receipt.json']: sha(bytes(receiptFile))} : {})};
  return {result: structuredClone(result), evidenceHash: digest(result), payloadRaw: raw.toString('utf8'), directory: path, files, committed, receiptAuthenticated: false, actualProviderCalls: 0};
}
export function readCaptureV2(args) {const value = inspectCaptureV2(args); check(value.committed, 'V2C_RECEIPT_INCOMPLETE'); return value;}
export function completeCaptureV2(args) {
  owned(args.context); const before = inspectCaptureV2(args), base = before.result.requestId;
  for (const suffix of ['.prepared.json', '.payload.txt']) {const file = resolve(before.directory, base + suffix), fd = openSync(file, 'r+'); try {fsyncSync(fd);} finally {closeSync(fd);} check(sha(bytes(file)) === before.files[base + suffix], 'V2C_COMPLETION_CHANGED');}
  const receipt = resolve(before.directory, base + '.receipt.json');
  if (!before.committed) durable(receipt, bytes(resolve(before.directory, base + '.prepared.json')));
  else {const fd = openSync(receipt, 'r+'); try {fsyncSync(fd);} finally {closeSync(fd);}}
  return readCaptureV2(args);
}
export function captureResultV2({context, ledger, key, state, usage, payloadRaw, testFault}) {
  owned(context); const {d, row} = target(context, ledger, key); check(row.state === 'consumed', 'V2C_CAPTURE_NOT_CONSUMED'); payload(d.role, state, payloadRaw);
  const binding = ledger.bindings[key], raw = Buffer.from(payloadRaw), result = {sourceSeal: context.spec.sourceSeal, requestId: row.requestId, modelId: d.modelId,
    bodySha256: binding.bodySha256, bodyDigest: binding.bodyDigest, outputHash: sha(raw), state, usage: structuredClone(usage)};
  transitionV2(context.spec, ledger, {kind: 'settle', key, state, usage, result});
  const envelope = {schemaVersion: 2, protocol: context.spec.protocol, runId: context.spec.runId, specHash: digest(context.spec), key, result, payloadBytes: raw.length, payloadHash: sha(raw)}, data = Buffer.from(JSON.stringify(envelope) + '\n');
  const path = directory(context, true), base = row.requestId;
  durable(resolve(path, base + '.prepared.json'), data, testFault, 'capture-prepared'); durable(resolve(path, base + '.payload.txt'), raw, testFault, 'capture-payload'); durable(resolve(path, base + '.receipt.json'), data, testFault, 'capture-receipt');
  return readCaptureV2({context, ledger, key, expectedResult: result});
}
export function settleCaptureV2({context, session, key}) {
  const {ledger} = session.current(), row = ledger.slots[key]; check(row && ['consumed', 'completed', 'failed', 'unknown'].includes(row.state), 'V2C_SETTLE_SLOT');
  const capture = completeCaptureV2({context, ledger, key});
  if (row.state !== 'consumed') return {status: 'already-settled', requestId: row.requestId, noDispatchPerformed: true};
  const result = capture.result, next = session.append({kind: 'settle', key, state: result.state, usage: result.usage, result});
  return {status: result.state, requestId: row.requestId, evidenceHash: capture.evidenceHash, head: next.head, noDispatchPerformed: true};
}
