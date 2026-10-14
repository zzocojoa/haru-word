// Isolated recovery bookkeeping fixtures. Never calls image_gen, an API, or production.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(repo, 'work/oxford-recovery-check-'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const copy = v => JSON.parse(JSON.stringify(v));
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const read = f => JSON.parse(fs.readFileSync(f));
for (const d of ['data', 'scripts', 'docs', 'work']) fs.mkdirSync(path.join(fixture, d));
for (const f of ['words.json', 'content.json', 'word-image-manifest.json']) fs.copyFileSync(path.join(repo, 'data', f), path.join(fixture, 'data', f));
for (const f of ['oxford-images.cjs', 'verify-oxford-images.cjs']) fs.copyFileSync(path.join(repo, 'scripts', f), path.join(fixture, 'scripts', f));
const proposalPath = 'docs/oxford-word-image-recovery-proposal.json';
fs.copyFileSync(path.join(repo, proposalPath), path.join(fixture, proposalPath));
const mf = path.join(fixture, 'data/word-image-manifest.json'), pf = path.join(fixture, 'work/oxford-images-progress.json');
const af = path.join(fixture, 'work/approval.json'), jf = path.join(fixture, 'work/oxford-images-pending.json');
const original = read(mf), proposal = read(path.join(fixture, proposalPath));
delete original.generation.recoveryApproval;
// Start from the approved proposal's original entry states even after real recovery has progressed.
for (const spec of proposal.entries) {
  const e = original.entries.find(e => e.entryId === spec.entryId);
  e.attempts = e.attempts.slice(0, spec.currentAttempts); e.status = spec.currentStatus;
  const a = e.attempts.at(-1);
  for (const key of ['file', 'sha256', 'bytes', 'width', 'height']) {
    if (a?.[key] !== undefined) e[key] = a[key]; else delete e[key];
  }
}
original.counts = { total: 3809, waiting: 0, generating: 0, generated: 0, approved: 0, held: 0, failed: 0 };
for (const e of original.entries) original.counts[e.status]++;
const slots = original.entries.reduce((n, e) => n + e.attempts.length, 0);
const progress = { dataset: original.dataset.sha256, assetWorkspace: fixture, generationCalls: slots, current: null, history: [] };
const reference = original.entries.find(e => e.entryId === original.generation.styleReferenceEntryId);
const root = path.join(fixture, original.assetRoot); fs.mkdirSync(root, { recursive: true });
const assetWorkspace = process.env.OXFORD_ASSET_WORKSPACE || 'C:/Users/user/Documents/ChatGPT/하루단어';
fs.copyFileSync(path.join(assetWorkspace, original.assetRoot, reference.file), path.join(root, reference.file));
const ids = proposal.executionOrder.slice(0, 2), policyId = proposal.entries.find(e => e.kind === 'policy-hold').entryId;
const run = (...args) => spawnSync(process.execPath, [path.join(fixture, 'scripts/oxford-images.cjs'), ...args], {
  cwd: fixture, encoding: 'utf8', env: { ...process.env, OXFORD_ASSET_WORKSPACE: fixture }
});
const hashes = () => [sha(fs.readFileSync(mf)), fs.existsSync(pf) ? sha(fs.readFileSync(pf)) : null];
let checks = 0;
function rejected(args, message) {
  const before = hashes(), r = run(...args); assert.notEqual(r.status, 0, r.stdout);
  if (message) assert(r.stderr.includes(message), r.stderr);
  assert.deepEqual(hashes(), before); checks++;
}
function reset() { write(mf, original); write(pf, progress); }
function approval() {
  return { approvalId: 'fixture-recovery', approvedAt: '2026-10-14T00:00:00.000Z', userDecision: 'fixture explicit two-entry approval',
    proposalCommit: 'da87a533e7ba5267ee01044d0cc2e2bb3406e48f', proposalPath, proposalSha256: sha(fs.readFileSync(path.join(fixture, proposalPath))),
    proposalId: proposal.proposalId, baseManifestSha256: sha(fs.readFileSync(mf)), baseLedgerSha256: sha(fs.readFileSync(pf)),
    baseGenerationCalls: slots, maximumNewStartSlots: 2, maximumTotalStartSlots: slots + 2, entryIds: ids,
    oneAdditionalStartPerEntry: true, automaticRetry: false, provider: 'built-in-image_gen', textPolicyHoldsPreserved: true };
}
reset(); rejected(['recovery-start', ids[0]], 'Explicit recovery approval');
const good = approval();
for (const invalid of [
  { ...good, proposalSha256: '0'.repeat(64) }, { ...good, baseManifestSha256: '0'.repeat(64) },
  { ...good, baseLedgerSha256: '0'.repeat(64) }, { ...good, maximumNewStartSlots: 3 },
  { ...good, entryIds: [policyId] }, { ...good, entryIds: [ids[0], ids[0]] }, { ...good, automaticRetry: true }
]) { write(af, invalid); rejected(['recovery-authorize', af]); }
write(af, good); let r = run('recovery-authorize', af); assert.equal(r.status, 0, r.stderr); checks++;
const authorized = read(mf), authorizedProgress = read(pf);
assert.deepEqual(authorized.entries, original.entries); assert.equal(authorizedProgress.generationCalls, slots);
const priorHashes = hashes(); r = run('recovery-authorize', af); assert.equal(r.status, 0, r.stderr);
assert.deepEqual(hashes(), priorHashes); checks++;
write(af, { ...good, approvalId: 'refill' }); rejected(['recovery-authorize', af], 'cannot be replaced'); write(af, good);
rejected(['recovery-start', ids[1]], 'textbook order');
rejected(['recovery-start', policyId], 'Explicit policy hold');
rejected(['recovery-start', reference.entryId], 'outside the approved');
rejected(['start', ids[0]], 'legacy starts are closed');
r = run('recovery-start', ids[0]); assert.equal(r.status, 0, r.stderr); checks++;
let started = read(mf), startedProgress = read(pf), first = started.entries.find(e => e.entryId === ids[0]);
assert.equal(first.attempts.length, 3); assert.equal(first.attempts.at(-1).recoveryApprovalId, good.approvalId);
assert.deepEqual(first.attempts.slice(0, 2), original.entries.find(e => e.entryId === ids[0]).attempts);
assert.equal(startedProgress.generationCalls, slots + 1);
rejected(['recovery-start', ids[1]], 'Previous image call is unresolved');
// A journal replay restores the same consumed slot; it never starts the native tool again.
write(jf, { manifest: started, progress: startedProgress }); write(mf, authorized); write(pf, authorizedProgress);
r = run('status'); assert.equal(r.status, 0, r.stderr); assert.deepEqual(read(mf), started); assert.deepEqual(read(pf), startedProgress);
assert(!fs.existsSync(jf)); checks++;
// Losing the ignored ledger reconstructs the pending slot and its consumed allowance from the manifest.
assert.equal(path.dirname(pf), path.join(fixture, 'work')); fs.unlinkSync(pf);
r = run('status'); assert.equal(r.status, 0, r.stderr);
assert.equal(JSON.parse(r.stdout).recovery.used, 1); assert.equal(JSON.parse(r.stdout).current.entryId, ids[0]); checks++;
rejected(['recovery-start', ids[0]], 'Previous image call is unresolved');
write(pf, startedProgress);
// The reference PNG is a synthetic capture fixture, never a real mnemonic or a product approval.
r = run('capture', ids[0], path.join(root, reference.file)); assert.equal(r.status, 0, r.stderr); checks++;
first = read(mf).entries.find(e => e.entryId === ids[0]); assert(first.file.endsWith('-v3.png'));
assert.equal(first.attempts[0].file, original.entries.find(e => e.entryId === ids[0]).attempts[0].file);
rejected(['recovery-start', ids[1]], 'Review the previous candidate');
const verifier = () => spawnSync(process.execPath, [path.join(fixture, 'scripts/verify-oxford-images.cjs'), ids[0]], {
  cwd: fixture, encoding: 'utf8', env: { ...process.env, OXFORD_ASSET_WORKSPACE: fixture }
});
const captured = read(mf); const invalidV3 = copy(captured);
delete invalidV3.entries.find(e => e.entryId === ids[0]).attempts.at(-1).recoveryApprovalId;
write(mf, invalidV3); r = verifier(); assert.notEqual(r.status, 0); assert(!fs.existsSync(path.join(fixture, 'work/oxford-images-latest-verification.json'))); checks++;
write(mf, captured); r = verifier(); assert.equal(r.status, 0, r.stderr); checks++;
const reviewFile = path.join(fixture, 'work/review.json');
write(reviewFile, [{ entryId: ids[0], decision: 'hold', note: 'synthetic fixture only; no learning approval' }]);
r = run('review', reviewFile); assert.equal(r.status, 0, r.stderr);
rejected(['recovery-start', ids[0]], 'already consumed');
r = run('recovery-start', ids[1]); assert.equal(r.status, 0, r.stderr);
const failureFile = path.join(fixture, 'work/failure.json'), rawFile = path.join(fixture, 'work/raw-failure.json');
write(rawFile, { synthetic: true, error: 'request_timeout', image: null });
write(failureFile, { entryId: ids[1], error: { code: 'request_timeout', category: 'service-timeout', stage: 'request-body', outcome: 'terminal-no-image-returned', httpStatus: 408 },
  rawResultFile: 'work/raw-failure.json', rawResultSha256: sha(fs.readFileSync(rawFile)) });
r = run('recovery-fail', failureFile); assert.equal(r.status, 0, r.stderr);
const failed = read(mf).entries.find(e => e.entryId === ids[1]);
assert.equal(failed.status, 'failed'); assert.equal(failed.attempts.length, 3);
assert.deepEqual(failed.attempts.slice(0, 2), original.entries.find(e => e.entryId === ids[1]).attempts);
assert.equal(read(pf).generationCalls, slots + 2); assert.equal(read(pf).current, null); checks++;
rejected(['recovery-start', ids[1]], 'stopped after a service failure');
const finalHashes = hashes(); r = run('recovery-authorize', af); assert.equal(r.status, 0, r.stderr); assert.deepEqual(hashes(), finalHashes); checks++;
fs.unlinkSync(pf); r = run('status'); assert.equal(r.status, 0, r.stderr);
assert.equal(JSON.parse(r.stdout).recovery.used, 2); assert(JSON.parse(r.stdout).recovery.stoppedByFailure); checks++;
// Even corrupted limits cannot grant another start; the independent usage count is retained.
const exhausted = read(mf); delete exhausted.generation.recoveryApproval.stoppedByFailure;
write(mf, exhausted); write(pf, { ...progress, generationCalls: slots + 2 });
rejected(['recovery-start', ids[1]], 'already consumed');
console.log(JSON.stringify({ result: 'pass', checks, imageCalls: 0, apiCalls: 0, fixture, syntheticImageOnly: true }));
