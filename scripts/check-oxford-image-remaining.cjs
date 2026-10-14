// Isolated permission/provenance fixtures; never generates real learning images.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..'), fixture = fs.mkdtempSync(path.join(repo, 'work/oxford-remaining-check-'));
const read = f => JSON.parse(fs.readFileSync(f)), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
for (const d of ['data', 'docs', 'scripts', 'work']) fs.mkdirSync(path.join(fixture, d));
for (const f of ['words.json', 'content.json', 'word-image-manifest.json']) fs.copyFileSync(path.join(repo, 'data', f), path.join(fixture, 'data', f));
for (const f of ['oxford-images.cjs', 'verify-oxford-images.cjs']) fs.copyFileSync(path.join(repo, 'scripts', f), path.join(fixture, 'scripts', f));
for (const f of fs.readdirSync(path.join(repo, 'docs')).filter(f => /^oxford-word-image-recovery.*proposal\.json$/.test(f))) fs.copyFileSync(path.join(repo, 'docs', f), path.join(fixture, 'docs', f));
const mf = path.join(fixture, 'data/word-image-manifest.json'), pf = path.join(fixture, 'work/oxford-images-progress.json');
const original = read(mf), ids = ['d056f2650b116cba', '49717992a5fb1a1a', '53b4f95ddd122fc2', '8e5aef6a2138e99b'];
const productionManifestSha256 = sha(fs.readFileSync(mf));
if (original.generation.remainingApproval) {
  for (const spec of original.generation.remainingApproval.entries) original.entries[original.entries.findIndex(e => e.entryId === spec.entryId)] = JSON.parse(JSON.stringify(spec.entryBefore));
  delete original.generation.remainingApproval;
  original.generation.recoveryRounds = original.generation.recoveryRounds.filter(a => !a.remainingApprovalId);
  original.counts = { total: 3809, waiting: 0, generating: 0, generated: 0, approved: 0, held: 0, failed: 0 };
  for (const e of original.entries) original.counts[e.status]++;
  write(mf, original);
}
const slots = original.entries.reduce((n, e) => n + e.attempts.length, 0), root = path.join(fixture, original.assetRoot);
fs.mkdirSync(root, { recursive: true });
const ref = original.entries.find(e => e.entryId === original.generation.styleReferenceEntryId);
const source = path.join(root, ref.file);
fs.copyFileSync(path.join(process.env.OXFORD_ASSET_WORKSPACE || 'C:/Users/user/Documents/ChatGPT/하루단어', original.assetRoot, ref.file), source);
write(pf, { dataset: original.dataset.sha256, generationCalls: slots, current: null, history: [] });
const initialLedger = fs.readFileSync(pf);
const run = (...args) => spawnSync(process.execPath, [path.join(fixture, 'scripts/oxford-images.cjs'), ...args], { cwd: fixture, env: { ...process.env, OXFORD_ASSET_WORKSPACE: fixture }, encoding: 'utf8' });
let checks = 0;
const hashes = () => [sha(fs.readFileSync(mf)), sha(fs.readFileSync(pf))];
function passed(...args) { const r = run(...args); assert.equal(r.status, 0, r.stderr); checks++; return r; }
function rejected(...args) { const before = hashes(), r = run(...args); assert.notEqual(r.status, 0, r.stdout); assert.deepEqual(hashes(), before); checks++; }
const decisionFile = path.join(fixture, 'work/remaining.json');
function decision() { const m = read(mf); return { approvalId: 'fixture-remaining', approvedAt: '2026-10-14T00:00:00.000Z', letterDecision: '세 항목의 영문 글자 형태만 허용 (추천)', breastDecision: '노출 없는 의료상담 후보로 진행', provider: 'built-in-image_gen', automaticServiceRetry: false, qualityIterationsUntilApproved: true, entryIds: ids, textExceptionEntryIds: [ids[0], ids[1], ids[3]], baseManifestSha256: sha(fs.readFileSync(mf)), baseLedgerSha256: sha(fs.readFileSync(pf)), entries: ids.map(id => { const e = m.entries.find(e => e.entryId === id); return { entryId: id, entryBefore: e, entrySnapshotSha256: sha(JSON.stringify(e)), sourceFingerprint: e.sourceFingerprint, slug: e.slug || (id === ids[1] ? 'letter-character' : 'print-n') }; }) }; }
const good = decision();
for (const invalid of [{ ...good, letterDecision: 'unanswered' }, { ...good, breastDecision: 'unanswered' }, { ...good, entryIds: ids.slice(1) }, { ...good, textExceptionEntryIds: ids }, { ...good, automaticServiceRetry: true }, { ...good, provider: 'cli' }, { ...good, baseManifestSha256: '0'.repeat(64) }, { ...good, baseLedgerSha256: '0'.repeat(64) }, { ...good, qualityIterationsUntilApproved: false }]) { write(decisionFile, invalid); rejected('remaining-authorize', decisionFile); }
write(decisionFile, good); passed('remaining-authorize', decisionFile);
const authHashes = hashes(); passed('remaining-authorize', decisionFile); assert.deepEqual(hashes(), authHashes);
write(decisionFile, { ...good, approvalId: 'replacement' }); rejected('remaining-authorize', decisionFile); write(decisionFile, good);
let m = read(mf);
assert.deepEqual(m.generation.recoveryApproval, original.generation.recoveryApproval);
assert.deepEqual(m.generation.qualityContinuationApproval, original.generation.qualityContinuationApproval);
assert.deepEqual(m.generation.recoveryRounds, original.generation.recoveryRounds);
for (const id of [ids[0], ids[1], ids[3]]) { const e = m.entries.find(e => e.entryId === id); assert(!e.policyHold); assert.deepEqual(e.policyHoldHistory.at(-1).hold, original.entries.find(e => e.entryId === id).policyHold); }
assert.equal(m.entries.find(e => e.entryId === ids[2]).status, 'failed'); checks += 7;
const round = (m.generation.recoveryRounds?.length || 0) + 2, qpath = `docs/oxford-word-image-recovery-round${round}-proposal.json`, qf = path.join(fixture, qpath), af = path.join(fixture, 'work/round.json');
const q = { schemaVersion: 2, round, proposalId: 'fixture-remaining-round', executionAllowed: false, authorization: null, sourceSnapshot: { dataset: m.dataset, manifestSha256: sha(fs.readFileSync(mf)), ledgerSha256: sha(fs.readFileSync(pf)), firstApprovalSnapshotSha256: sha(JSON.stringify(m.generation.recoveryApproval)), remainingApprovalSha256: sha(JSON.stringify(m.generation.remainingApproval)) }, executionOrder: ids, currentStartSlots: slots, proposedStartSlotLimit: 4, maximumStartSlotsAfterProposal: slots + 4, entries: ids.map(id => { const e = m.entries.find(e => e.entryId === id), fullPrompt = 'fixture synthetic subject ' + id; return { entryId: id, currentStatus: e.status, currentAttempts: e.attempts.length, entrySnapshotSha256: sha(JSON.stringify(e)), sourceFingerprint: e.sourceFingerprint, proposedAdditionalStartSlots: 1, proposedNextAttemptNumber: e.attempts.length + 1, fullPrompt, fullPromptSha256: sha(fullPrompt), mode: 'redraw', references: [{ role: 'style-only', file: ref.file, sha256: ref.sha256 }] }; }) };
write(qf, q);
const approval = { approvalId: 'fixture-remaining-round', round, remainingApprovalId: m.generation.remainingApproval.approvalId, firstApprovalId: m.generation.recoveryApproval.approvalId, userDecision: 'fixture direct remaining scope', approvedAt: good.approvedAt, proposalCommit: 'a'.repeat(40), proposalPath: qpath, proposalId: q.proposalId, proposalSha256: sha(fs.readFileSync(qf)), baseManifestSha256: sha(fs.readFileSync(mf)), baseLedgerSha256: sha(fs.readFileSync(pf)), baseGenerationCalls: slots, maximumNewStartSlots: 4, maximumTotalStartSlots: slots + 4, entryIds: ids, provider: 'built-in-image_gen', automaticRetry: false, oneAdditionalStartPerEntry: true, textPolicyHoldsPreserved: true };
for (const bad of [{ ...approval, remainingApprovalId: 'wrong' }, { ...approval, entryIds: [...ids].reverse() }, { ...approval, maximumNewStartSlots: 5 }, { ...approval, maximumTotalStartSlots: slots + 5 }]) { write(af, bad); rejected('recovery-round-authorize', af); }
write(af, approval); passed('recovery-round-authorize', af); passed('recovery-round-authorize', af);
rejected('recovery-round-start', ids[1], approval.approvalId);
const reviewFile = path.join(fixture, 'work/review.json');
function review(id, extra = {}) { const e = read(mf).entries.find(e => e.entryId === id); const input = { entryId: id, decision: 'approve', note: 'Synthetic fixture contract; no real learning-image approval.', textFree: !e.textPolicyException, styleConsistent: true, meaningMatch: true, smallScreenChecked: true, pngDecoded: true, ...(e.textPolicyException ? { textPolicyExceptionVerified: true, nonAuthorizedTextAbsent: true, textExceptionApprovalId: good.approvalId } : {}), ...extra }; write(reviewFile, [input]); return input; }
for (const id of ids.slice(0, 2)) { passed('recovery-round-start', id, approval.approvalId); passed('capture', id, source); review(id, { textFree: true }); rejected('review', reviewFile); review(id, { nonAuthorizedTextAbsent: false }); rejected('review', reviewFile); review(id, { textExceptionApprovalId: 'other' }); rejected('review', reviewFile); review(id); passed('review', reviewFile); rejected('recovery-round-start', id, approval.approvalId); }
const checkpointM = fs.readFileSync(mf), checkpointP = fs.readFileSync(pf);
passed('recovery-round-start', ids[2], approval.approvalId);
const raw = path.join(fixture, 'work/failure-raw.json'); write(raw, { fixture: 'terminal synthetic failure' });
const failureFile = path.join(fixture, 'work/failure.json'); write(failureFile, { entryId: ids[2], error: { code: 'fixture_service_failure', category: 'fixture', stage: 'output', outcome: 'terminal-no-image-returned' }, rawResultFile: 'work/failure-raw.json', rawResultSha256: sha(fs.readFileSync(raw)) });
passed('recovery-fail', failureFile); rejected('recovery-round-start', ids[3], approval.approvalId);
const stoppedHashes = hashes(); passed('remaining-authorize', decisionFile); assert.deepEqual(hashes(), stoppedHashes); checks++;
// Restore only the isolated synthetic branch to exercise successful capture contracts.
fs.writeFileSync(mf, checkpointM); fs.writeFileSync(pf, checkpointP);
for (const id of ids.slice(2)) { passed('recovery-round-start', id, approval.approvalId); passed('capture', id, source); review(id, { textFree: id === ids[3] }); rejected('review', reviewFile); review(id); passed('review', reviewFile); }
m = read(mf); assert.equal(m.counts.approved, 3809); assert.equal(read(pf).generationCalls, slots + 4);
for (const e of m.entries) { const old = original.entries.find(o => o.entryId === e.entryId); if (ids.includes(e.entryId)) assert.deepEqual(e.attempts.slice(0, old.attempts.length), old.attempts); else assert.deepEqual(e, old); }
assert.deepEqual(m.generation.recoveryApproval, original.generation.recoveryApproval); assert.deepEqual(m.generation.qualityContinuationApproval, original.generation.qualityContinuationApproval); checks += 5;
const v = spawnSync(process.execPath, [path.join(fixture, 'scripts/verify-oxford-images.cjs'), ids[0]], { cwd: fixture, env: { ...process.env, OXFORD_ASSET_WORKSPACE: fixture }, encoding: 'utf8' }); assert.equal(v.status, 0, v.stderr); checks++;
const generated = m.entries.find(e => e.entryId === ids[0]); generated.review.textFree = true; write(mf, m);
const invalidV = spawnSync(process.execPath, [path.join(fixture, 'scripts/verify-oxford-images.cjs'), ids[0]], { cwd: fixture, env: { ...process.env, OXFORD_ASSET_WORKSPACE: fixture }, encoding: 'utf8' }); assert.notEqual(invalidV.status, 0); checks++;
assert.equal(sha(fs.readFileSync(path.join(repo, 'data/word-image-manifest.json'))), productionManifestSha256);
assert.equal(JSON.parse(initialLedger).generationCalls, slots);
console.log(JSON.stringify({ result: 'pass', checks, fixture, nativeCalls: 0, syntheticPixelsOnly: true, realManifestUnchanged: true, falseTextFreeClaimsRejected: true }));
