// Explicit, synthetic-only Windows recovery. No initialization, provider or retry path.
import {readFileSync, readdirSync, lstatSync, realpathSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {digest} from './ai-quality-v147-budget.mjs';
import {checkedStoreDirectory, readBudgetHistoryForRecovery, readBudgetStore, newStoreOwner, validateStoreOwner, validatePreparedSnapshot, validateCommitDescriptor, commitFilename} from './ai-quality-v147-budget-store.mjs';
import {observeProcess, ownProcessIdentity, acquireRecoveryMutex} from './ai-quality-v147-process.mjs';
import {capturedSettlementForRecovery} from './ai-quality-v147-dispatch.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
const fileHash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function regular(file) { const s = lstatSync(file); check(s.isFile() && !s.isSymbolicLink(), 'RECOVERY_NONREGULAR_FILE'); }
function parse(file) { regular(file); try { return JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('RECOVERY_JSON'); } }
function durableNew(file, data) {
  const fd = openSync(file, 'wx'); try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
}
const durableJson = (file, value) => durableNew(file, JSON.stringify(value) + '\n');
function ownerObservation(context, owner, locked) {
  validateStoreOwner(context, owner); const observed = observeProcess(owner.pid);
  check(observed.status !== 'unknown', 'RECOVERY_OWNER_UNKNOWN');
  if (observed.status === 'present') {
    check(digest(observed.identity) === digest(owner.identity), 'RECOVERY_PID_OR_COMMAND_MISMATCH');
    check(!locked && owner.pid === process.pid && digest(owner.identity) === digest(ownProcessIdentity()), 'RECOVERY_OWNER_LIVE');
    return 'self-unlocked';
  }
  return 'confirmed-absent';
}
function checkSettlement(context, current, snapshot) {
  if (snapshot.operation.kind !== 'settle') return;
  const op = snapshot.operation, row = current.ledger.slots[op.key];
  const capture = capturedSettlementForRecovery({context, key: op.key, row});
  check(op.state === capture.state && digest(op.usage) === digest(capture.usage) && op.evidenceHash === digest(capture), 'RECOVERY_CAPTURE_USAGE_MISMATCH');
}
function fileBindings(path, files) {
  return Object.fromEntries(files.filter(file => file !== 'LOCK.json').sort().map(file => { regular(resolve(path, file)); return [file, fileHash(resolve(path, file))]; }));
}
function recoveryOwnerLink(context, path, current, owner) {
  const ref = owner.recoveryOf;
  check(ref && typeof ref.auditDirectory === 'string' && ref.auditDirectory.startsWith(`${context.spec.runId}-recovery-`)
    && /^[a-f0-9-]{36}$/.test(ref.auditDirectory.slice(context.spec.runId.length + 10)), 'RECOVERY_OWNER_AUDIT_NAME');
  const root = realpathSync(context.allowedRoot), audit = resolve(root, ref.auditDirectory);
  check(dirname(audit) === root && !lstatSync(audit).isSymbolicLink() && realpathSync(audit) === audit, 'RECOVERY_OWNER_AUDIT_SCOPE');
  const {inspectionHash, mutexHelperPid, ...before} = parse(resolve(audit, 'inspection.json'));
  check(Number.isSafeInteger(mutexHelperPid) && inspectionHash === ref.inspectionHash && digest(before) === inspectionHash
    && before.runId === context.spec.runId && before.specHash === digest(context.spec) && before.directoryHash === digest(path)
    && before.lockHash === ref.priorLockHash, 'RECOVERY_OWNER_AUDIT_BINDING');
  if (before.lockHash) check(fileHash(resolve(audit, 'previous-owned-lock.json')) === before.lockHash, 'RECOVERY_OWNER_ARCHIVE_HASH');
  const expected = {...before.files};
  if (before.prepared) {
    check(ref.commitHash === before.files[before.prepared.commitFile], 'RECOVERY_OWNER_COMMIT_HASH');
    if (digest(current.head) === digest(before.prepared.nextHead)) {
      expected['HEAD.json'] = expected[before.prepared.pendingHeadFile]; delete expected[before.prepared.pendingHeadFile];
    } else check(digest(current.head) === digest(before.head), 'RECOVERY_OWNER_HEAD');
  } else check(ref.commitHash === null && digest(current.head) === digest(before.head), 'RECOVERY_OWNER_HEAD');
  check(digest(fileBindings(path, current.files)) === digest(expected), 'RECOVERY_OWNER_FILES');
  return true;
}

export function inspectBudgetRecovery(context) {
  check(context.spec.mode === 'synthetic' && process.platform === 'win32', 'SYNTHETIC_WINDOWS_RECOVERY_ONLY');
  const path = checkedStoreDirectory(context.directory, context.allowedRoot), current = readBudgetHistoryForRecovery(context);
  check(realpathSync(dirname(path)) === realpathSync(context.allowedRoot), 'RECOVERY_SCOPE');
  const lockPath = resolve(path, 'LOCK.json'), lock = existsSync(lockPath) ? parse(lockPath) : null;
  const lockObservation = lock ? ownerObservation(context, lock, true) : null;
  const linkedRecoveryOwner = lock?.recoveryOf ? recoveryOwnerLink(context, path, current, lock) : false;
  const extra = current.files.filter(f => !current.allowedFiles.includes(f)); let prepared = null;
  if (extra.length) {
    const snapshotFile = String(current.head.index + 1).padStart(6, '0') + '.json';
    check(extra.includes(snapshotFile), 'RECOVERY_INCOMPLETE_PREPARATION');
    const snapshot = parse(resolve(path, snapshotFile)), next = validatePreparedSnapshot(context, current, snapshot), commitFile = commitFilename(snapshot);
    const pendingHeadFile = `HEAD-${snapshot.transactionNonce}.tmp`;
    check(extra.length === 3 && extra.every(f => [snapshotFile, commitFile, pendingHeadFile].includes(f)), 'RECOVERY_INCOMPLETE_OR_AMBIGUOUS');
    const commit = parse(resolve(path, commitFile)); validateCommitDescriptor(context, current.head, snapshot, commit);
    check(digest(parse(resolve(path, pendingHeadFile))) === digest(next.head), 'RECOVERY_PENDING_HEAD_MISMATCH');
    check(!lock || digest(lock) === digest(commit.owner) || linkedRecoveryOwner, 'RECOVERY_LOCK_COMMIT_MISMATCH');
    const writerObservation = ownerObservation(context, commit.owner, Boolean(lock)); checkSettlement(context, current, snapshot);
    prepared = {snapshotFile, commitFile, pendingHeadFile, nextHead: next.head, operationKind: snapshot.operation.kind, writerObservation};
  }
  const plan = {schemaVersion: 1, runId: context.spec.runId, specHash: digest(context.spec), directoryHash: digest(path),
    head: current.head, files: fileBindings(path, current.files), lockHash: lock ? fileHash(lockPath) : null,
    lockObservation, prepared, action: prepared ? 'finish-prepared-write' : lock ? 'release-confirmed-dead-lock' : 'none'};
  return {...plan, inspectionHash: digest(plan)};
}

// Both paths are resolved below the same allowed root before any exact-file move.
// A kernel mutex prevents two recoverers from stealing a newly acquired live lock.
export async function recoverBudgetStore({context, expectedInspectionHash, testFault}) {
  check(context.spec.mode === 'synthetic' && process.platform === 'win32', 'SYNTHETIC_WINDOWS_RECOVERY_ONLY');
  check(/^[a-f0-9]{64}$/.test(expectedInspectionHash), 'RECOVERY_INSPECTION_REQUIRED');
  const mutex = await acquireRecoveryMutex(digest({directory: realpathSync(context.directory), runId: context.spec.runId}));
  let audit, owner, lockAcquired = false, lockPath;
  try {
    const plan = inspectBudgetRecovery(context); check(plan.inspectionHash === expectedInspectionHash, 'RECOVERY_INSPECTION_CHANGED');
    if (plan.action === 'none') return {status: 'unchanged', head: plan.head};
    const path = checkedStoreDirectory(context.directory, context.allowedRoot), root = realpathSync(context.allowedRoot);
    audit = resolve(root, `${context.spec.runId}-recovery-${randomUUID()}`); check(dirname(audit) === root, 'RECOVERY_AUDIT_SCOPE'); mkdirSync(audit);
    durableJson(resolve(audit, 'inspection.json'), {...plan, mutexHelperPid: mutex.pid});
    lockPath = resolve(path, 'LOCK.json');
    if (plan.lockHash) {
      check(fileHash(lockPath) === plan.lockHash, 'RECOVERY_LOCK_CHANGED'); ownerObservation(context, parse(lockPath), true);
      const archived = resolve(audit, 'previous-owned-lock.json'); check(dirname(lockPath) === path && dirname(archived) === audit, 'RECOVERY_MOVE_SCOPE');
      await testFault?.('recovery:before-lock-archive', {mutexHelperPid: mutex.pid});
      // The thread that owns the kernel mutex performs this exact move. A helper
      // exit cannot leave Node moving a new live owner's lock without ownership.
      await mutex.archiveLock({source: lockPath, destination: archived, allowedRoot: root, expectedHash: plan.lockHash});
      check(fileHash(archived) === plan.lockHash, 'RECOVERY_LOCK_ARCHIVE_MISMATCH');
    }
    owner = {...newStoreOwner(context), recoveryOf: {inspectionHash: plan.inspectionHash, auditDirectory: audit.slice(root.length + 1),
      priorLockHash: plan.lockHash, commitHash: plan.prepared ? plan.files[plan.prepared.commitFile] : null}};
    durableJson(lockPath, owner); lockAcquired = true;
    testFault?.('recovery:after-lock-acquire');
    const unchanged = fileBindings(path, readdirSync(path)); check(digest(unchanged) === digest(plan.files), 'RECOVERY_FILES_CHANGED');
    durableNew(resolve(audit, 'head-before.json'), readFileSync(resolve(path, 'HEAD.json')));
    if (plan.prepared) {
      const {snapshotFile, commitFile, pendingHeadFile} = plan.prepared;
      for (const name of [snapshotFile, commitFile, pendingHeadFile]) {
        const file = resolve(path, name); regular(file); durableNew(resolve(audit, name), readFileSync(file));
        // Complete durability now; readable bytes alone never prove an earlier fsync returned.
        const fd = openSync(file, 'r+'); try { fsyncSync(fd); } finally { closeSync(fd); }
        check(fileHash(file) === plan.files[name], 'RECOVERY_PREPARED_FILE_CHANGED');
      }
      const prefix = readBudgetHistoryForRecovery(context), candidate = parse(resolve(path, snapshotFile));
      validatePreparedSnapshot(context, prefix, candidate); validateCommitDescriptor(context, prefix.head, candidate, parse(resolve(path, commitFile)));
      checkSettlement(context, prefix, candidate); testFault?.('recovery:before-head-rename');
      check(digest(fileBindings(path, readdirSync(path))) === digest(plan.files), 'RECOVERY_FILES_CHANGED');
      renameSync(resolve(path, pendingHeadFile), resolve(path, 'HEAD.json')); testFault?.('recovery:after-head-rename');
    }
    const recovered = readBudgetStore(context);
    const result = {status: 'recovered', action: plan.action, before: plan.head, after: recovered.head, oldHeadHash: fileHash(resolve(audit, 'head-before.json')),
      originalFilesPreservedInAudit: true, noDispatchPerformed: true};
    durableJson(resolve(audit, 'result.json'), result); return {...result, evidenceDirectory: audit};
  } finally {
    try {
      if (lockAcquired) { regular(lockPath); check(digest(parse(lockPath)) === digest(owner), 'RECOVERY_LOCK_OWNERSHIP_CHANGED'); unlinkSync(lockPath); }
    } finally { await mutex.release(); }
  }
}
