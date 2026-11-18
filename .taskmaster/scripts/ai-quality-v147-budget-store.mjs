// Append-only verified snapshots + fsynced commit descriptors + atomic HEAD.
import {mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, readFileSync, readdirSync, renameSync, unlinkSync, realpathSync, lstatSync} from 'node:fs';
import {resolve, relative, basename, dirname, isAbsolute, sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {digest, newLedger, transition} from './ai-quality-v147-budget.mjs';
import {ownProcessIdentity} from './ai-quality-v147-process.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
const parse = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { throw new Error('STORE_JSON'); } };
const filename = n => `${String(n).padStart(6, '0')}.json`;
export function checkedStoreDirectory(directory, allowedRoot, creating = false) {
  check(isAbsolute(directory) && isAbsolute(allowedRoot), 'ABSOLUTE_STORE_PATH');
  const root = realpathSync(allowedRoot), path = resolve(directory), rel = relative(root, path);
  check(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'STORE_OUTSIDE_SCOPE');
  const parent = realpathSync(dirname(path)); check(parent === dirname(path), 'STORE_LINKED_PARENT');
  if (!creating) check(!lstatSync(path).isSymbolicLink() && realpathSync(path) === path, 'STORE_LINKED_DIRECTORY');
  return path;
}
function regular(path) { check(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), 'STORE_NONREGULAR_FILE'); }
function durableNew(path, value, testFault, stage) {
  const fd = openSync(path, 'wx');
  try { writeFileSync(fd, JSON.stringify(value) + '\n', 'utf8'); testFault?.(`${stage}:before-fsync`); fsyncSync(fd); }
  finally { closeSync(fd); }
  testFault?.(`${stage}:after-fsync`);
}
function headFor(snapshot) { return {index: snapshot.index, hash: digest(snapshot)}; }
export const commitFilename = snapshot => {
  check(Number.isSafeInteger(snapshot.index) && snapshot.index > 0 && /^[a-f0-9-]{36}$/.test(snapshot.transactionNonce), 'COMMIT_FILENAME');
  return `COMMIT-${String(snapshot.index).padStart(6, '0')}-${snapshot.transactionNonce}.json`;
};
export function newStoreOwner(context) {
  const path = checkedStoreDirectory(context.directory, context.allowedRoot);
  return {schemaVersion: 2, nonce: randomUUID(), pid: process.pid, identity: ownProcessIdentity(), runId: context.spec.runId,
    specHash: digest(context.spec), directoryHash: digest(path)};
}
export function validateStoreOwner(context, owner) {
  const path = checkedStoreDirectory(context.directory, context.allowedRoot), identity = owner?.identity;
  check(owner?.schemaVersion === 2 && typeof owner.nonce === 'string' && /^[a-f0-9-]{36}$/.test(owner.nonce)
    && owner.runId === context.spec.runId && owner.specHash === digest(context.spec) && owner.directoryHash === digest(path)
    && Number.isSafeInteger(owner.pid) && owner.pid > 0 && identity?.pid === owner.pid
    && ['win32', 'linux'].includes(identity.platform) && typeof identity.createdAt === 'string' && identity.createdAt.length > 0
    && /^[a-f0-9]{64}$/.test(identity.commandHash) && /^[a-f0-9]{64}$/.test(identity.executableHash), 'STORE_OWNER_BINDING');
}
export function validatePreparedSnapshot(context, current, snapshot) {
  check(snapshot.schemaVersion === 1 && snapshot.index === current.head.index + 1 && snapshot.previousHash === current.head.hash
    && digest(snapshot.spec) === digest(context.spec) && /^[a-f0-9-]{36}$/.test(snapshot.transactionNonce), 'PREPARED_CHAIN');
  const computed = transition(context.spec, current.ledger, snapshot.operation);
  check(digest(computed) === digest(snapshot.ledger), 'PREPARED_TRANSITION');
  return {head: headFor(snapshot), ledger: snapshot.ledger};
}
export function validateCommitDescriptor(context, currentHead, snapshot, commit) {
  validateStoreOwner(context, commit.owner);
  check(commit.schemaVersion === 1 && commit.runId === context.spec.runId && commit.specHash === digest(context.spec)
    && commit.directoryHash === digest(checkedStoreDirectory(context.directory, context.allowedRoot))
    && digest(commit.from) === digest(currentHead) && digest(commit.to) === digest(headFor(snapshot))
    && commit.snapshotFile === filename(snapshot.index) && commit.pendingHeadFile === `HEAD-${snapshot.transactionNonce}.tmp`
    && commit.owner.nonce === snapshot.transactionNonce, 'COMMIT_BINDING');
}

// Root must already exist; each run receives a brand-new directory named by its UUID.
export function createBudgetStore({directory, allowedRoot, spec, approval}) {
  const ledger = newLedger(spec, approval), path = checkedStoreDirectory(directory, allowedRoot, true);
  check(basename(path) === spec.runId, 'STORE_RUN_DIRECTORY'); mkdirSync(path);
  const first = {schemaVersion: 1, index: 0, previousHash: null, spec, operation: null, ledger};
  durableNew(resolve(path, filename(0)), first);
  durableNew(resolve(path, 'HEAD.json'), headFor(first));
  return readBudgetStore({directory: path, allowedRoot, spec});
}

// Read-only committed prefix for recovery inspection. Dispatch always uses the strict reader below.
export function readBudgetHistoryForRecovery({directory, allowedRoot, spec}) {
  const context = {directory, allowedRoot, spec}, path = checkedStoreDirectory(directory, allowedRoot); check(basename(path) === spec.runId, 'STORE_RUN_DIRECTORY');
  const files = readdirSync(path); regular(resolve(path, 'HEAD.json')); const head = parse(resolve(path, 'HEAD.json'));
  check(Object.keys(head).sort().join('|') === 'hash|index' && Number.isSafeInteger(head.index) && head.index >= 0 && head.index <= 5000, 'STORE_HEAD');
  const allowedFiles = ['HEAD.json', 'LOCK.json']; let prior = null, ledger;
  for (let i = 0; i <= head.index; i++) {
    const file = resolve(path, filename(i)); regular(file); const snap = parse(file);
    check(snap.schemaVersion === 1 && snap.index === i && snap.previousHash === (prior ? digest(prior) : null)
      && digest(snap.spec) === digest(spec), 'STORE_CHAIN');
    const computed = i === 0 ? newLedger(spec, snap.ledger.approval) : transition(spec, ledger, snap.operation);
    check(digest(computed) === digest(snap.ledger), 'STORE_TRANSITION');
    allowedFiles.push(filename(i));
    if (i > 0 && snap.transactionNonce) {
      const committedFile = commitFilename(snap); regular(resolve(path, committedFile));
      validateCommitDescriptor(context, headFor(prior), snap, parse(resolve(path, committedFile))); allowedFiles.push(committedFile);
    }
    ledger = snap.ledger; prior = snap;
  }
  check(digest(prior) === head.hash, 'STORE_HEAD_HASH');
  return {head, ledger, files, allowedFiles};
}
export function readBudgetStore(context) {
  const {head, ledger, files, allowedFiles} = readBudgetHistoryForRecovery(context);
  check(files.every(file => allowedFiles.includes(file)), 'STORE_PREPARED_OR_FOREIGN_FILES');
  return {head, ledger};
}

export function transactBudgetStore({directory, allowedRoot, spec, operation, testFault}) {
  const context = {directory, allowedRoot, spec}, path = checkedStoreDirectory(directory, allowedRoot), lockPath = resolve(path, 'LOCK.json');
  const owner = newStoreOwner(context);
  // Exclusive acquisition; dead/foreign locks never get removed automatically.
  durableNew(lockPath, owner);
  try {
    testFault?.('lock:after-acquire');
    const current = readBudgetStore({directory, allowedRoot, spec});
    check(current.head.index < 5000, 'STORE_JOURNAL_LIMIT');
    const ledger = transition(spec, current.ledger, operation);
    const snap = {schemaVersion: 1, index: current.head.index + 1, previousHash: current.head.hash, spec, operation, ledger, transactionNonce: owner.nonce};
    durableNew(resolve(path, filename(snap.index)), snap, testFault, 'snapshot');
    const pending = resolve(path, `HEAD-${owner.nonce}.tmp`);
    durableNew(pending, headFor(snap), testFault, 'head');
    const commit = {schemaVersion: 1, runId: spec.runId, specHash: digest(spec), directoryHash: digest(path), from: current.head,
      to: headFor(snap), snapshotFile: filename(snap.index), pendingHeadFile: `HEAD-${owner.nonce}.tmp`, owner};
    durableNew(resolve(path, commitFilename(snap)), commit, testFault, 'commit'); testFault?.('head:before-rename');
    renameSync(pending, resolve(path, 'HEAD.json')); testFault?.('head:after-rename');
    return readBudgetStore({directory, allowedRoot, spec});
  } finally {
    regular(lockPath); check(digest(parse(lockPath)) === digest(owner), 'LOCK_OWNERSHIP_CHANGED');
    // This exact newly created file only; never recursive deletion.
    unlinkSync(lockPath);
  }
}
