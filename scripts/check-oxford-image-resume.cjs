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
for (const e of original.entries) { e.status = 'waiting'; e.attempts = []; }
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
console.log(JSON.stringify({ result: 'pass', checks: 7, imageCalls: 0, apiCalls: 0, fixture }));
