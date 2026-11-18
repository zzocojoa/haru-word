// Synthetic-only v2 delta journal. A session holds one exclusive owned LOCK.
// Every fast read hashes all committed bytes; full replay occurs at open/audit.
import {mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, readFileSync, readdirSync, renameSync, unlinkSync, lstatSync, fstatSync, realpathSync} from 'node:fs';
import {resolve, basename, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {digest, validateSpecV2, newLedgerV2, transitionV2} from './ai-quality-v147-budget-v2.mjs';
import {checkedStoreDirectory, newStoreOwner, validateStoreOwner} from './ai-quality-v147-budget-store.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
const fields = (x, names) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join('|') === [...names].sort().join('|');
const sha = data => createHash('sha256').update(data).digest('hex');
const isHash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const bytesFor = record => Buffer.from(JSON.stringify(record) + '\n', 'utf8');
function regular(file) { const s = lstatSync(file); check(s.isFile() && !s.isSymbolicLink() && s.nlink === 1, 'V2J_NONREGULAR_FILE'); }
function parseBytes(bytes) { try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error('V2J_JSON'); } }
function readJson(file) { regular(file); return parseBytes(readFileSync(file)); }
function durableNew(file, data, fault, stage) {
  const fd = openSync(file, 'wx', 0o600);
  try { writeFileSync(fd, data); fault?.(stage + ':before-fsync'); fsyncSync(fd); } finally { closeSync(fd); }
  fault?.(stage + ':after-fsync');
}
function scoped(context, creating = false) {
  validateSpecV2(context.spec); check(context.spec.mode === 'synthetic', 'V2J_SYNTHETIC_ONLY');
  const path = checkedStoreDirectory(context.directory, context.allowedRoot, creating);
  check(basename(path) === context.spec.runId && dirname(path) === realpathSync(context.allowedRoot), 'V2J_RUN_SCOPE'); return path;
}
function validateHead(head) {
  check(fields(head, ['schemaVersion', 'index', 'recordHash', 'logBytes', 'logSha256']) && head.schemaVersion === 2 && Number.isSafeInteger(head.index) && head.index >= 0 && head.index <= 5000
    && Number.isSafeInteger(head.logBytes) && head.logBytes > 0 && isHash(head.recordHash) && isHash(head.logSha256), 'V2J_HEAD');
}
function headFor(record, bytes) { return {schemaVersion: 2, index: record.index, recordHash: digest(record), logBytes: bytes.length, logSha256: sha(bytes)}; }
function pendingName(owner) { return `HEAD-${owner.nonce}.tmp`; }

// Also used by explicit recovery inspection. Prefix replay never silently treats
// uncommitted suffix bytes as committed or truncates them to a convenient state.
export function replayV2Prefix(context, head, log) {
  scoped(context); validateHead(head); check(Buffer.isBuffer(log) && log.length >= head.logBytes, 'V2J_LOG_LENGTH');
  const prefix = log.subarray(0, head.logBytes); check(sha(prefix) === head.logSha256 && prefix.at(-1) === 10 && Buffer.from(prefix.toString('utf8')).equals(prefix), 'V2J_PREFIX_HASH');
  const lines = prefix.toString('utf8').split('\n'); lines.pop(); check(lines.length === head.index + 1, 'V2J_RECORD_COUNT');
  let ledger, last, previousHash = null;
  for (let i = 0; i < lines.length; i++) {
    const record = parseBytes(Buffer.from(lines[i]));
    if (i === 0) {
      check(fields(record, ['schemaVersion', 'index', 'previousHash', 'spec', 'approval', 'ledgerHash']) && record.schemaVersion === 2 && record.index === 0 && record.previousHash === null && digest(record.spec) === digest(context.spec), 'V2J_INITIAL_RECORD');
      ledger = newLedgerV2(context.spec, record.approval);
    } else {
      check(fields(record, ['schemaVersion', 'index', 'previousHash', 'specHash', 'operation', 'ledgerHash', 'owner']) && record.schemaVersion === 2 && record.index === i && record.previousHash === previousHash && record.specHash === digest(context.spec), 'V2J_RECORD_CHAIN');
      validateStoreOwner(context, record.owner); ledger = transitionV2(context.spec, ledger, record.operation);
    }
    check(record.ledgerHash === digest(ledger), 'V2J_STATE_REPLAY'); previousHash = digest(record); last = record;
  }
  check(digest(last) === head.recordHash, 'V2J_HEAD_RECORD'); return {head: structuredClone(head), ledger, last};
}
export function readV2JournalHistory(context) {
  const path = scoped(context), files = readdirSync(path); regular(resolve(path, 'CHAIN.jsonl'));
  const head = readJson(resolve(path, 'HEAD.json')), log = readFileSync(resolve(path, 'CHAIN.jsonl')), replay = replayV2Prefix(context, head, log);
  return {...replay, files, logBytesActual: log.length, uncommittedBytes: log.length - head.logBytes};
}
export function readV2Journal(context) {
  const current = readV2JournalHistory(context);
  check(current.files.every(x => ['CHAIN.jsonl', 'HEAD.json', 'LOCK.json'].includes(x)) && current.uncommittedBytes === 0, 'V2J_PREPARED_OR_FOREIGN'); return current;
}
export function createV2Journal(context, approval) {
  const path = scoped(context, true), ledger = newLedgerV2(context.spec, approval); mkdirSync(path);
  const record = {schemaVersion: 2, index: 0, previousHash: null, spec: structuredClone(context.spec), approval: structuredClone(approval), ledgerHash: digest(ledger)}, bytes = bytesFor(record);
  durableNew(resolve(path, 'CHAIN.jsonl'), bytes); durableNew(resolve(path, 'HEAD.json'), bytesFor(headFor(record, bytes))); return readV2Journal(context);
}

// Session state and validated prefix are private. Returned ledgers are detached.
// There is no reset,rewind,automatic lock theft,initialization or network path.
export function openV2Journal(context) {
  const path = scoped(context), fixed = {directory: context.directory, allowedRoot: context.allowedRoot, spec: structuredClone(context.spec)}, specHash = digest(fixed.spec);
  validateHead(readJson(resolve(path, 'HEAD.json'))); regular(resolve(path, 'CHAIN.jsonl'));
  const owner = newStoreOwner(fixed), lockPath = resolve(path, 'LOCK.json'), ownerBytes = bytesFor(owner); durableNew(lockPath, ownerBytes);
  let current, closed = false, poisoned = false;
  function owns() { check(scoped(fixed) === path, 'V2J_PATH_CHANGED'); regular(lockPath); check(sha(readFileSync(lockPath)) === sha(ownerBytes), 'V2J_LOCK_CHANGED'); }
  function release() { owns(); unlinkSync(lockPath); closed = true; }
  try { current = readV2Journal(fixed); } catch (error) { release(); throw error; }
  function verify() {
    check(!closed && !poisoned, 'V2J_SESSION_HELD');
    check(context.directory === fixed.directory && context.allowedRoot === fixed.allowedRoot && digest(context.spec) === specHash, 'V2J_CONTEXT_CHANGED');
    check(scoped(fixed) === path, 'V2J_PATH_CHANGED'); owns();
    const files = readdirSync(path); check(files.every(x => ['CHAIN.jsonl', 'HEAD.json', 'LOCK.json'].includes(x)), 'V2J_PREPARED_OR_FOREIGN');
    check(digest(readJson(resolve(path, 'HEAD.json'))) === digest(current.head), 'V2J_HEAD_CHANGED'); regular(resolve(path, 'CHAIN.jsonl'));
    const log = readFileSync(resolve(path, 'CHAIN.jsonl')); check(log.length === current.head.logBytes && sha(log) === current.head.logSha256, 'V2J_LOG_CHANGED'); return log;
  }
  function detached() { return {head: structuredClone(current.head), ledger: structuredClone(current.ledger)}; }
  return {
    current() { verify(); return detached(); },
    audit() { verify(); const disk = readV2Journal(fixed); check(digest(disk.ledger) === digest(current.ledger), 'V2J_AUDIT_CHANGED'); return detached(); },
    append(operation, testFault) {
      const log = verify(); check(current.head.index < 5000, 'V2J_JOURNAL_LIMIT');
      const ledger = transitionV2(fixed.spec, current.ledger, operation), record = {schemaVersion: 2, index: current.head.index + 1, previousHash: current.head.recordHash, specHash, operation: structuredClone(operation), ledgerHash: digest(ledger), owner: structuredClone(owner)};
      const line = bytesFor(record), combined = Buffer.concat([log, line]), nextHead = headFor(record, combined), pending = {schemaVersion: 2, from: current.head, to: nextHead, record, lineBytes: line.length, lineSha256: sha(line)};
      const pendingFile = resolve(path, 'PENDING.json'), pendingHead = resolve(path, pendingName(owner)), pendingBytes = bytesFor(pending); let touched = false;
      try {
        touched = true; durableNew(pendingFile, pendingBytes, testFault, 'pending');
        const file = resolve(path, 'CHAIN.jsonl'); regular(file); const before = lstatSync(file), fd = openSync(file, 'a');
        try { const opened = fstatSync(fd); check(opened.ino === before.ino && opened.dev === before.dev && opened.nlink === 1, 'V2J_LOG_REPLACED'); writeFileSync(fd, line); testFault?.('log:before-fsync'); fsyncSync(fd); } finally { closeSync(fd); }
        testFault?.('log:after-fsync'); regular(file); check(sha(readFileSync(file)) === nextHead.logSha256, 'V2J_APPEND_CHANGED');
        durableNew(pendingHead, bytesFor(nextHead), testFault, 'head'); testFault?.('head:before-rename'); renameSync(pendingHead, resolve(path, 'HEAD.json')); testFault?.('head:after-rename');
        owns(); regular(pendingFile); check(sha(readFileSync(pendingFile)) === sha(pendingBytes), 'V2J_PENDING_CHANGED'); testFault?.('pending:before-unlink'); unlinkSync(pendingFile); testFault?.('pending:after-unlink');
        owns(); regular(file); check(digest(readJson(resolve(path, 'HEAD.json'))) === digest(nextHead) && sha(readFileSync(file)) === nextHead.logSha256
          && readdirSync(path).every(x => ['CHAIN.jsonl', 'HEAD.json', 'LOCK.json'].includes(x)), 'V2J_COMMIT_READBACK');
        current = {head: nextHead, ledger, last: record}; return detached();
      } catch (error) { if (touched) poisoned = true; throw error; }
    },
    close() {
      check(!closed, 'V2J_SESSION_CLOSED');
      try { check(!poisoned, 'V2J_SESSION_HELD'); verify(); const replay = readV2Journal(fixed); check(digest(replay.ledger) === digest(current.ledger), 'V2J_AUDIT_CHANGED'); return {status: 'closed', head: replay.head, noDispatchPerformed: true}; }
      finally { release(); }
    },
    abandon() { check(!closed, 'V2J_SESSION_CLOSED'); release(); return {status: 'held', noDispatchPerformed: true, incompleteFilesPreserved: true}; }
  };
}

export function inspectV2Pending(context) {
  const path = scoped(context), current = readV2JournalHistory(context), pending = readJson(resolve(path, 'PENDING.json'));
  check(fields(pending, ['schemaVersion', 'from', 'to', 'record', 'lineBytes', 'lineSha256']) && pending.schemaVersion === 2, 'V2J_PENDING_FIELDS');
  validateHead(pending.from); validateHead(pending.to); check(fields(pending.record, ['schemaVersion', 'index', 'previousHash', 'specHash', 'operation', 'ledgerHash', 'owner']), 'V2J_PENDING_RECORD'); validateStoreOwner(context, pending.record.owner);
  const log = readFileSync(resolve(path, 'CHAIN.jsonl')), before = replayV2Prefix(context, pending.from, log), ledger = transitionV2(context.spec, before.ledger, pending.record.operation), line = bytesFor(pending.record);
  check(pending.record.schemaVersion === 2 && pending.record.index === before.head.index + 1 && pending.record.previousHash === before.head.recordHash && pending.record.specHash === digest(context.spec)
    && pending.record.ledgerHash === digest(ledger) && pending.lineBytes === line.length && pending.lineSha256 === sha(line), 'V2J_PENDING_TRANSITION');
  check(digest(pending.to) === digest(headFor(pending.record, Buffer.concat([log.subarray(0, pending.from.logBytes), line]))), 'V2J_PENDING_HEAD');
  check(log.length === pending.to.logBytes && log.subarray(pending.from.logBytes).equals(line), 'V2J_INCOMPLETE_APPEND');
  const beforeHead = digest(current.head) === digest(pending.from), committed = digest(current.head) === digest(pending.to); check(beforeHead || committed, 'V2J_PENDING_CURRENT_HEAD');
  const temp = pendingName(pending.record.owner), expectedFiles = ['CHAIN.jsonl', 'HEAD.json', 'LOCK.json', 'PENDING.json', ...(beforeHead ? [temp] : [])];
  check(current.files.every(x => expectedFiles.includes(x)) && (committed || current.files.includes(temp) && digest(readJson(resolve(path, temp))) === digest(pending.to)), 'V2J_INCOMPLETE_HEAD');
  return {head: current.head, nextHead: pending.to, operationKind: pending.record.operation.kind, owner: pending.record.owner,
    action: committed ? 'archive-committed-pending' : 'finish-prepared-head', pendingHash: sha(readFileSync(resolve(path, 'PENDING.json'))),
    logHash: sha(log), temporaryHeadFile: beforeHead ? temp : null, noDispatchPerformed: true, recoveryImplemented: false};
}
