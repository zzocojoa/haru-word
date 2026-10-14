// Isolated bookkeeping regression checks. Never invokes image_gen or an external API.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const recorded = JSON.parse(fs.readFileSync(path.join(repo, 'data/word-image-manifest.json')));
const completedSeed = recorded.entries.find(e => e.file && e.attempts.length === 1);
const correctedSeed = recorded.entries.find(e => e.file && e.attempts.length === 2);
assert(completedSeed && correctedSeed, 'Seed fixtures need one original and one corrected image');
// Fixed synthetic states keep these checks usable even when production has no waiting/held items.
const original = JSON.parse(JSON.stringify(recorded));
// These synthetic v1/v2 fixtures exercise the legacy path, not the production recovery scope.
delete original.generation.recoveryApproval;
for (const e of original.entries) {
  e.status = 'waiting'; e.attempts = [];
  for (const key of ['file', 'sha256', 'bytes', 'width', 'height', 'review', 'policyHold', 'pendingCorrection']) delete e[key];
}
Object.assign(original.entries.find(e => e.entryId === completedSeed.entryId), completedSeed, { status: 'approved' });
Object.assign(original.entries.find(e => e.entryId === correctedSeed.entryId), correctedSeed, { status: 'held' });
original.counts = { total: 3809, waiting: 3807, generating: 0, generated: 0, approved: 1, held: 1, failed: 0 };
const slots = original.entries.reduce((sum, e) => sum + e.attempts.length, 0);
assert(original.entries.some(e => e.status === 'approved'));
assert(original.entries.some(e => e.status === 'held' && e.attempts.length === 2));
assert(original.entries.filter(e => e.status === 'waiting').length >= 2);
const fixture = fs.mkdtempSync(path.join(repo, 'work/oxford-resume-check-'));
for (const dir of ['scripts', 'data', 'work']) fs.mkdirSync(path.join(fixture, dir));
for (const name of ['words.json', 'content.json']) fs.copyFileSync(path.join(repo, 'data', name), path.join(fixture, 'data', name));
fs.copyFileSync(path.join(repo, 'scripts/oxford-images.cjs'), path.join(fixture, 'scripts/oxford-images.cjs'));
const manifestFile = path.join(fixture, 'data/word-image-manifest.json');
const progressFile = path.join(fixture, 'work/oxford-images-progress.json');
const journalFile = path.join(fixture, 'work/oxford-images-pending.json');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const run = (...args) => spawnSync(process.execPath, [path.join(fixture, 'scripts/oxford-images.cjs'), ...args], { cwd: fixture, encoding: 'utf8' });
write(manifestFile, original);
// A missing ignored ledger is reconstructed from all recorded call slots, not a fixed pilot count.
let result = run('status'); assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(result.stdout).generationCalls, slots);
const approved = original.entries.find(e => e.status === 'approved');
const second = original.entries.filter(e => e.status === 'waiting')[1];
const held = original.entries.find(e => e.status === 'held' && e.attempts.length === 2);
const correction = path.join(fixture, 'work/correction.json');
write(correction, { entryId: held.entryId, defect: 'fixture', prompt: 'fixture' });
for (const args of [['start', approved.entryId], ['start', second.entryId], ['start', held.entryId, correction]]) {
  const before = hash(manifestFile);
  result = run(...args); assert.notEqual(result.status, 0);
  assert.equal(hash(manifestFile), before); assert(!fs.existsSync(progressFile));
}
// A lost ledger must preserve the unresolved slot and block every new call.
const interrupted = copy(original), current = interrupted.entries.find(e => e.status === 'waiting');
current.status = 'generating'; current.slug = 'fixture-interrupted';
current.attempts.push({ number: 1, status: 'generating', startedAt: '2026-10-05T00:00:00.000Z' });
interrupted.counts.waiting--; interrupted.counts.generating++;
write(manifestFile, interrupted);
result = run('status'); assert.equal(result.status, 0, result.stderr);
const reconstructed = JSON.parse(result.stdout);
assert.equal(reconstructed.generationCalls, slots + 1); assert.equal(reconstructed.current.entryId, current.entryId);
result = run('start', second.entryId); assert.notEqual(result.status, 0);
assert(result.stderr.includes('Previous image call is unresolved'));
// Replay only a complete metadata journal; this never repeats an image request.
const progress = { dataset: interrupted.dataset.sha256, assetWorkspace: 'fixture', generationCalls: slots + 1, current: reconstructed.current, history: [] };
write(journalFile, { manifest: interrupted, progress });
write(manifestFile, original);
result = run('status'); assert.equal(result.status, 0, result.stderr);
assert(!fs.existsSync(journalFile));
assert.deepEqual(JSON.parse(fs.readFileSync(manifestFile)), interrupted);
assert.deepEqual(JSON.parse(fs.readFileSync(progressFile)), progress);
// Conflicting call counts are rejected before any new state is written.
progress.generationCalls--;
write(progressFile, progress);
const before = [hash(manifestFile), hash(progressFile)];
result = run('status'); assert.notEqual(result.status, 0);
assert(result.stderr.includes('Call ledger and manifest differ'));
assert.deepEqual([hash(manifestFile), hash(progressFile)], before);
// User policy holds preserve old images and skip ungenerated items without inventing calls.
write(manifestFile, original);
const baseProgress = { dataset: original.dataset.sha256, assetWorkspace: 'fixture', generationCalls: slots, current: null, history: [] };
write(progressFile, baseProgress);
const firstWaiting = original.entries.find(e => e.status === 'waiting');
const policyFile = path.join(fixture, 'work/policy-hold.json');
const policy = { entryIds: [held.entryId, firstWaiting.entryId], reason: 'text-policy-meaning-conflict',
  userDecision: 'fixture explicit text ban and hold', note: 'fixture letter meaning conflicts with text ban' };
write(policyFile, policy);
result = run('hold-policy', policyFile); assert.equal(result.status, 0, result.stderr);
const deferred = JSON.parse(fs.readFileSync(manifestFile)), heldProgress = JSON.parse(fs.readFileSync(progressFile));
assert.equal(heldProgress.generationCalls, slots); assert.equal(heldProgress.current, null);
assert.equal(heldProgress.history.length, 1); assert.equal(heldProgress.history[0].action, 'policy-held');
const noImage = deferred.entries.find(e => e.entryId === firstWaiting.entryId);
assert.equal(noImage.status, 'held'); assert.deepEqual(noImage.attempts, []); assert.equal(noImage.file, undefined); assert.equal(noImage.review, undefined);
assert.equal(noImage.policyHold.phase, 'before-generation');
const priorImage = deferred.entries.find(e => e.entryId === held.entryId);
const unchangedPriorImage = { ...priorImage }; delete unchangedPriorImage.policyHold;
assert.deepEqual(unchangedPriorImage, held); assert.equal(priorImage.policyHold.phase, 'after-generation');
assert.equal(deferred.counts.waiting, original.counts.waiting - 1); assert.equal(deferred.counts.held, original.counts.held + 1);
result = run('status'); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).next[0].id, second.entryId);
const heldHashes = [hash(manifestFile), hash(progressFile)];
result = run('hold-policy', policyFile); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).changed, 0);
assert.deepEqual([hash(manifestFile), hash(progressFile)], heldHashes);
result = run('start', firstWaiting.entryId); assert.notEqual(result.status, 0); assert(result.stderr.includes('Explicit policy hold'));
result = run('start', held.entryId, correction); assert.notEqual(result.status, 0); assert(result.stderr.includes('Explicit policy hold'));
const attemptedReview = path.join(fixture, 'work/policy-review.json');
write(attemptedReview, [{ entryId: held.entryId, decision: 'approve', note: 'fixture', textFree: true, styleConsistent: true,
  meaningMatch: true, smallScreenChecked: true, pngDecoded: true }]);
result = run('review', attemptedReview); assert.notEqual(result.status, 0); assert(result.stderr.includes('Explicit policy hold'));
for (const invalid of [
  { ...policy, entryIds: [second.entryId, approved.entryId] },
  { ...policy, entryIds: [second.entryId], reason: 'budget-limit' },
  { ...policy, entryIds: [second.entryId, second.entryId] }
]) {
  write(policyFile, invalid); result = run('hold-policy', policyFile); assert.notEqual(result.status, 0);
  assert.deepEqual([hash(manifestFile), hash(progressFile)], heldHashes);
}
write(policyFile, policy);
write(manifestFile, interrupted);
write(progressFile, { ...baseProgress, generationCalls: slots + 1, current: reconstructed.current });
const interruptedHashes = [hash(manifestFile), hash(progressFile)];
result = run('hold-policy', policyFile); assert.notEqual(result.status, 0); assert(result.stderr.includes('Resolve the current image call'));
assert.deepEqual([hash(manifestFile), hash(progressFile)], interruptedHashes);
write(manifestFile, deferred);
// Only the isolated fixture's ignored ledger is removed to check reconstruction.
assert.equal(path.dirname(progressFile), path.join(fixture, 'work')); fs.unlinkSync(progressFile);
result = run('status'); assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(result.stdout).generationCalls, slots); assert.equal(JSON.parse(result.stdout).current, null);
assert.equal(JSON.parse(result.stdout).next[0].id, second.entryId);
assert.deepEqual(JSON.parse(fs.readFileSync(manifestFile)), deferred); assert(!fs.existsSync(progressFile));
// The independent verifier rejects invented approval or image metadata on a policy hold before launching a browser.
fs.copyFileSync(path.join(repo, 'scripts/verify-oxford-images.cjs'), path.join(fixture, 'scripts/verify-oxford-images.cjs'));
for (const invalid of [
  (() => { const value = copy(deferred); value.entries.find(e => e.entryId === firstWaiting.entryId).status = 'approved'; value.counts.held--; value.counts.approved++; return value; })(),
  (() => { const value = copy(deferred); value.entries.find(e => e.entryId === firstWaiting.entryId).file = 'invented.png'; return value; })()
]) {
  write(manifestFile, invalid);
  result = spawnSync(process.execPath, [path.join(fixture, 'scripts/verify-oxford-images.cjs')], { cwd: fixture, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert(result.stderr.includes('AssertionError'));
  assert(!fs.existsSync(path.join(fixture, 'work/oxford-images-latest-verification.json')));
}
write(manifestFile, deferred);
console.log(JSON.stringify({ result: 'pass', checks: 19, imageCalls: 0, apiCalls: 0, fixture }));
