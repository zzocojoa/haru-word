// Explicit synthetic Windows recovery. No dispatch,provider,reset or resend path.
import {readFileSync, readdirSync, lstatSync, realpathSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, existsSync} from 'node:fs';
import {resolve, dirname, basename} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {digest, validateSpecV2} from './ai-quality-v147-budget-v2.mjs';
import {checkedStoreDirectory, newStoreOwner, validateStoreOwner} from './ai-quality-v147-budget-store.mjs';
import {observeProcess, ownProcessIdentity, acquireRecoveryMutex} from './ai-quality-v147-process.mjs';
import {readV2Journal, readV2JournalHistory, replayV2Prefix, inspectV2Pending} from './ai-quality-v147-journal-v2.mjs';
import {inspectCaptureV2, completeCaptureV2} from './ai-quality-v147-capture-v2.mjs';
const check = (ok, code) => {if (!ok) throw new Error(code);};
const sha = x => createHash('sha256').update(x).digest('hex');
function regular(file) {const s = lstatSync(file); check(s.isFile() && !s.isSymbolicLink() && s.nlink === 1, 'V2R_NONREGULAR_FILE');}
function raw(file) {regular(file); return readFileSync(file);}
function parse(file) {try {return JSON.parse(raw(file).toString('utf8'));} catch {throw new Error('V2R_JSON');}}
function durable(file, bytes) {const fd = openSync(file, 'wx', 0o600); try {writeFileSync(fd, bytes); fsyncSync(fd);} finally {closeSync(fd);}}
const durableJson = (file, data) => durable(file, Buffer.from(JSON.stringify(data) + '\n'));
function scoped(context) {
  validateSpecV2(context.spec); check(context.spec.mode === 'synthetic' && process.platform === 'win32', 'V2R_SYNTHETIC_WINDOWS_ONLY');
  const path = checkedStoreDirectory(context.directory, context.allowedRoot), root = realpathSync(context.allowedRoot); check(dirname(path) === root && basename(path) === context.spec.runId, 'V2R_SCOPE'); return {path, root};
}
function ownerObservation(context, owner, locked) {
  validateStoreOwner(context, owner); const observed = observeProcess(owner.pid); check(observed.status !== 'unknown', 'V2R_OWNER_UNKNOWN');
  if (observed.status === 'present') {
    check(digest(observed.identity) === digest(owner.identity), 'V2R_PID_IDENTITY_CHANGED');
    check(!locked && owner.pid === process.pid && digest(owner.identity) === digest(ownProcessIdentity()), 'V2R_OWNER_LIVE'); return 'self-unlocked';
  }
  return 'confirmed-absent';
}
function fileBindings(path, files) {
  return Object.fromEntries(files.filter(x => x !== 'LOCK.json').sort().map(file => {check(/^(?:CHAIN\.jsonl|HEAD\.json|PENDING\.json|HEAD-[a-f0-9-]{36}\.tmp)$/.test(file), 'V2R_FOREIGN_FILE'); return [file, sha(raw(resolve(path, file)))];}));
}
function captureSummary(value, key) {return {key, result: value.result, directory: basename(value.directory), files: value.files, committed: value.committed};}
function sameCapture(before, value) {for (const [file, hash] of Object.entries(before.files)) check(value.files[file] === hash, 'V2R_CAPTURE_CHANGED');}
function linkedOwner(context, path, current, lock) {
  const ref = lock.recoveryOf, root = realpathSync(context.allowedRoot), prefix = context.spec.runId + '-v2-recovery-';
  check(ref && typeof ref.auditDirectory === 'string' && ref.auditDirectory.startsWith(prefix) && /^[a-f0-9-]{36}$/.test(ref.auditDirectory.slice(prefix.length)), 'V2R_AUDIT_NAME');
  const audit = resolve(root, ref.auditDirectory); check(dirname(audit) === root && !lstatSync(audit).isSymbolicLink() && realpathSync(audit) === audit, 'V2R_AUDIT_SCOPE');
  const {inspectionHash, mutexHelperPid, ...before} = parse(resolve(audit, 'inspection.json'));
  check(Number.isSafeInteger(mutexHelperPid) && inspectionHash === ref.inspectionHash && digest(before) === inspectionHash && before.runId === context.spec.runId
    && before.specHash === digest(context.spec) && before.directoryHash === digest(path) && before.lockHash === ref.priorLockHash, 'V2R_AUDIT_BINDING');
  if (before.lockHash) check(sha(raw(resolve(audit, 'previous-owned-lock.json'))) === before.lockHash, 'V2R_ARCHIVED_LOCK');
  const expected = {...before.files};
  if (before.pending) {
    if (digest(current.head) === digest(before.pending.nextHead)) {expected['HEAD.json'] = before.pending.nextHeadFileHash; if (before.pending.temporaryHeadFile) delete expected[before.pending.temporaryHeadFile];}
    else check(digest(current.head) === digest(before.head), 'V2R_LINKED_HEAD');
    if (!current.files.includes('PENDING.json')) {check(digest(current.head) === digest(before.pending.nextHead) && sha(raw(resolve(audit, 'previous-pending.json'))) === before.files['PENDING.json'], 'V2R_ARCHIVED_PENDING'); delete expected['PENDING.json'];}
  } else check(digest(current.head) === digest(before.head), 'V2R_LINKED_HEAD');
  check(digest(fileBindings(path, current.files)) === digest(expected), 'V2R_LINKED_FILES');
  if (before.capture) {const value = inspectCaptureV2({context, ledger: current.ledger, key: before.capture.key, expectedResult: before.capture.result}); sameCapture(before.capture, value); if (!current.files.includes('PENDING.json')) check(value.committed, 'V2R_CAPTURE_NOT_COMMITTED');}
  return true;
}

export function inspectV2Recovery(context) {
  const {path} = scoped(context), lockPath = resolve(path, 'LOCK.json'), lock = existsSync(lockPath) ? parse(lockPath) : null;
  const lockObservation = lock ? ownerObservation(context, lock, true) : null, current = readV2JournalHistory(context);
  const linked = lock?.recoveryOf ? linkedOwner(context, path, current, lock) : false; let pending = null, capture = null;
  if (current.files.includes('PENDING.json')) {
    const p = inspectV2Pending(context), data = parse(resolve(path, 'PENDING.json')); ownerObservation(context, p.owner, Boolean(lock && !linked));
    check(!lock || linked || digest(lock) === digest(p.owner), 'V2R_PENDING_OWNER');
    pending = {...p, nextHeadFileHash: sha(raw(resolve(path, p.temporaryHeadFile ?? 'HEAD.json')))};
    if (data.record.operation.kind === 'settle') {
      const before = replayV2Prefix(context, data.from, raw(resolve(path, 'CHAIN.jsonl'))), op = data.record.operation;
      capture = captureSummary(inspectCaptureV2({context, ledger: before.ledger, key: op.key, expectedResult: op.result}), op.key);
    }
  } else readV2Journal(context);
  const plan = {schemaVersion: 2, runId: context.spec.runId, specHash: digest(context.spec), directoryHash: digest(path), head: current.head,
    files: fileBindings(path, current.files), lockHash: lock ? sha(raw(lockPath)) : null, lockObservation, pending, capture,
    action: pending ? pending.action : lock ? 'release-confirmed-dead-lock' : 'none'};
  return {...plan, inspectionHash: digest(plan)};
}

export async function recoverV2Journal({context, expectedInspectionHash, testFault}) {
  const {path, root} = scoped(context); check(typeof expectedInspectionHash === 'string' && /^[a-f0-9]{64}$/.test(expectedInspectionHash), 'V2R_INSPECTION_REQUIRED');
  const mutex = await acquireRecoveryMutex(digest({protocol: context.spec.protocol, directory: path, runId: context.spec.runId}));
  let owner, ownerBytes, lockAcquired = false, audit; const lockPath = resolve(path, 'LOCK.json');
  function owns() {check(scoped(context).path === path && sha(raw(lockPath)) === sha(ownerBytes), 'V2R_LOCK_CHANGED');}
  try {
    const plan = inspectV2Recovery(context); check(plan.inspectionHash === expectedInspectionHash, 'V2R_INSPECTION_CHANGED');
    if (plan.action === 'none') return {status: 'unchanged', head: plan.head, noDispatchPerformed: true};
    audit = resolve(root, context.spec.runId + '-v2-recovery-' + randomUUID()); check(dirname(audit) === root, 'V2R_AUDIT_SCOPE'); mkdirSync(audit);
    durableJson(resolve(audit, 'inspection.json'), {...plan, mutexHelperPid: mutex.pid});
    if (plan.lockHash) {
      check(sha(raw(lockPath)) === plan.lockHash, 'V2R_LOCK_CHANGED'); ownerObservation(context, parse(lockPath), true);
      const archived = resolve(audit, 'previous-owned-lock.json'); check(dirname(archived) === audit && dirname(lockPath) === path, 'V2R_MOVE_SCOPE');
      await testFault?.('recovery:before-lock-archive', {mutexHelperPid: mutex.pid});
      await mutex.archiveLock({source: lockPath, destination: archived, allowedRoot: root, expectedHash: plan.lockHash}); check(sha(raw(archived)) === plan.lockHash, 'V2R_LOCK_ARCHIVE');
    }
    owner = {...newStoreOwner(context), recoveryOf: {inspectionHash: plan.inspectionHash, auditDirectory: basename(audit), priorLockHash: plan.lockHash}};
    ownerBytes = Buffer.from(JSON.stringify(owner) + '\n'); durable(lockPath, ownerBytes); lockAcquired = true; testFault?.('recovery:after-lock-acquire'); owns();
    check(digest(fileBindings(path, readdirSync(path))) === digest(plan.files), 'V2R_FILES_CHANGED'); durable(resolve(audit, 'head-before.json'), raw(resolve(path, 'HEAD.json')));
    if (plan.pending) {
      const data = parse(resolve(path, 'PENDING.json')); durable(resolve(audit, 'pending-before.json'), raw(resolve(path, 'PENDING.json')));
      if (plan.capture) {
        const before = replayV2Prefix(context, data.from, raw(resolve(path, 'CHAIN.jsonl'))), value = completeCaptureV2({context, ledger: before.ledger, key: plan.capture.key, expectedResult: plan.capture.result}); sameCapture(plan.capture, value);
      }
      for (const name of ['CHAIN.jsonl', 'PENDING.json', ...(plan.pending.temporaryHeadFile ? [plan.pending.temporaryHeadFile] : [])]) {
        const file = resolve(path, name); regular(file); if (name.startsWith('HEAD-')) durable(resolve(audit, 'pending-head-before.json'), raw(file));
        const fd = openSync(file, 'r+'); try {fsyncSync(fd);} finally {closeSync(fd);} check(sha(raw(file)) === plan.files[name], 'V2R_PREPARED_CHANGED');
      }
      if (plan.pending.temporaryHeadFile) {
        testFault?.('recovery:before-head-rename'); owns(); check(digest(fileBindings(path, readdirSync(path))) === digest(plan.files), 'V2R_FILES_CHANGED');
        renameSync(resolve(path, plan.pending.temporaryHeadFile), resolve(path, 'HEAD.json')); testFault?.('recovery:after-head-rename');
      }
      owns(); check(digest(parse(resolve(path, 'HEAD.json'))) === digest(plan.pending.nextHead) && sha(raw(resolve(path, 'PENDING.json'))) === plan.files['PENDING.json'], 'V2R_COMMIT_CHANGED');
      const pendingFile = resolve(path, 'PENDING.json'), archived = resolve(audit, 'previous-pending.json'); check(dirname(pendingFile) === path && dirname(archived) === audit, 'V2R_MOVE_SCOPE');
      renameSync(pendingFile, archived); testFault?.('recovery:after-pending-archive'); check(sha(raw(archived)) === plan.files['PENDING.json'], 'V2R_PENDING_ARCHIVE');
    }
    owns(); const after = readV2Journal(context); check(digest(after.head) === digest(plan.pending?.nextHead ?? plan.head), 'V2R_RESULT_HEAD');
    const result = {status: 'recovered', action: plan.action, before: plan.head, after: after.head, rawFilesPreserved: true, noDispatchPerformed: true, receiptAuthenticated: false};
    durableJson(resolve(audit, 'result.json'), result); return {...result, evidenceDirectory: audit};
  } finally {
    try {if (lockAcquired) {owns(); unlinkSync(lockPath);}} finally {await mutex.release();}
  }
}
