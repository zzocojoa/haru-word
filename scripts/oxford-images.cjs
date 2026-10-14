// Local production bookkeeping only. Image calls remain in the built-in image_gen tool.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..');
const file = path.join(repo, 'data/word-image-manifest.json');
const progressFile = path.join(repo, 'work/oxford-images-progress.json');
const journalFile = path.join(repo, 'work/oxford-images-pending.json');
const assetWorkspace = process.env.OXFORD_ASSET_WORKSPACE || 'C:/Users/user/Documents/ChatGPT/하루단어';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const serializeManifest = value => {
  const { entries, ...header } = value;
  // One entry per line keeps large inventories compact and changed entries reviewable.
  return JSON.stringify(header, null, 2).slice(0, -2) + ',\n  "entries": [\n' +
    entries.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]\n}\n';
};
const writeAtomic = (target, value) => {
  const temporary = target + '.tmp';
  fs.writeFileSync(temporary, target === file ? serializeManifest(value) : JSON.stringify(value, null, 2) + '\n');
  // A transient EPERM must retry only this metadata replacement, never a new image slot.
  const delays = [50, 100, 250];
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(temporary, target);
      break;
    } catch (error) {
      if (error.code !== 'EPERM' || attempt >= delays.length) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
};
fs.mkdirSync(path.join(repo, 'work'), { recursive: true });
// Replay a recorded metadata transaction after an interrupted file write, never an image call.
if (fs.existsSync(journalFile)) {
  const pending = JSON.parse(fs.readFileSync(journalFile));
  writeAtomic(file, pending.manifest);
  writeAtomic(progressFile, pending.progress);
  fs.unlinkSync(journalFile);
}
const m = JSON.parse(fs.readFileSync(file));
const wordsBytes = fs.readFileSync(path.join(repo, 'data/words.json'));
const contentBytes = fs.readFileSync(path.join(repo, 'data/content.json'));
assert.equal(sha(wordsBytes), m.dataset.wordsSha256, 'Word dataset changed');
assert.equal(sha(contentBytes), m.dataset.contentSha256, 'Content dataset changed');
const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
assert.equal(m.entries.length, 3809);
assert.equal(new Set(m.entries.map(e => e.entryId)).size, 3809);
const unresolved = m.entries.filter(e => e.status === 'generating');
assert(unresolved.length <= 1, 'Resolve inconsistent concurrent image calls manually');
const slotCount = m.entries.reduce((sum, e) => sum + e.attempts.length, 0);
const interrupted = unresolved[0];
const p = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile)) : {
  dataset: m.dataset.sha256, assetWorkspace, generationCalls: slotCount,
  current: interrupted ? {
    entryId: interrupted.entryId, attempt: interrupted.attempts.at(-1).number,
    slug: interrupted.slug, startedAt: interrupted.attempts.at(-1).startedAt,
    outcome: 'awaiting-tool-result'
  } : null,
  history: [], startedAt: new Date().toISOString()
};
assert.equal(p.dataset, m.dataset.sha256);
assert.equal(p.generationCalls, slotCount, 'Call ledger and manifest differ; do not retry blindly');
assert.equal(p.current?.entryId ?? null, interrupted?.entryId ?? null, 'Unresolved image call differs from ledger');
const root = path.join(assetWorkspace, m.assetRoot);
const find = id => {
  const e = m.entries.find(e => e.entryId === id || e.slug === id);
  if (!e) throw Error('Unknown entry: ' + id);
  const w = words.find(w => w.id === e.entryId);
  assert.equal(e.sourceFingerprint, sha(JSON.stringify({ word: w, content: content[e.entryId] })), 'Entry source changed');
  return e;
};
function save() {
  m.counts = { total: m.entries.length, waiting: 0, generating: 0, generated: 0, approved: 0, held: 0, failed: 0 };
  for (const e of m.entries) {
    if (!(e.status in m.counts) || e.status === 'total') throw Error('Unknown entry status');
    m.counts[e.status]++;
  }
  p.updatedAt = new Date().toISOString();
  p.counts = m.counts;
  writeAtomic(journalFile, { manifest: m, progress: p });
  writeAtomic(file, m);
  writeAtomic(progressFile, p);
  fs.unlinkSync(journalFile);
}
function consent() {
  assert.equal(p.current, null);
  m.generation.userApproval = 'style-approved-continue';
  m.generation.styleApproval = {
    recordedAt: new Date().toISOString(),
    instruction: '지금과 같은 생성 방식을 유지하여 나머지도 진행해라.',
    scope: 'Same built-in generation method and pilot style; every image still requires individual quality review.'
  };
  p.history.push({ action: 'style-approved-continue', at: new Date().toISOString() });
  save(); console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls }));
}
function prepare(sceneFile) {
  assert.equal(p.current, null, 'Resolve the current call before preparing new work');
  for (const spec of JSON.parse(fs.readFileSync(sceneFile))) {
    const e = find(spec.entryId);
    assert.equal(e.status, 'waiting');
    assert(spec.scene?.trim() && /^[a-z0-9-]+$/.test(spec.slug));
    e.slug = spec.slug; e.scene = spec.scene;
    e.promptVersion = m.generation.promptVersion;
    e.prompt = m.generation.stylePrompt + '\nSubject and meaning: ' + spec.scene;
  }
  save(); console.log('Prepared static entry-specific scenes');
}
function start(id, correctionFile) {
  assert.equal(m.generation.userApproval, 'style-approved-continue');
  assert.equal(p.current, null, 'Previous image call is unresolved; do not retry blindly');
  const e = find(id);
  assert(!e.policyHold, 'Explicit policy hold must be resolved before generation');
  assert(!m.generation.recoveryApproval, 'Use the approved recovery-start scope; legacy starts are closed');
  if (correctionFile) {
    assert(['generated', 'held'].includes(e.status));
    assert.equal(e.attempts.length, 1, 'Only one quality correction is allowed');
    const correction = JSON.parse(fs.readFileSync(correctionFile));
    assert.equal(correction.entryId, e.entryId);
    assert(correction.prompt?.trim() && correction.defect?.trim());
    e.pendingCorrection = correction;
  } else {
    assert.equal(e.status, 'waiting', 'Completed entries must not be generated again');
    const next = m.entries.find(entry => entry.status === 'waiting');
    assert.equal(e.entryId, next.entryId, 'Keep A1/A2/B1/B2 textbook order');
    assert(e.prompt && e.slug, 'Prepare the reviewed scene first');
  }
  const prompt = correctionFile ? e.pendingCorrection.prompt : e.prompt + '\n' + m.generation.referenceInstruction;
  const attempt = {
    number: e.attempts.length + 1, startedAt: new Date().toISOString(), status: 'generating',
    prompt, promptSha256: sha(prompt), promptVersion: m.generation.promptVersion,
    referenceEntryId: m.generation.styleReferenceEntryId,
    ...(correctionFile ? { correctionDefect: e.pendingCorrection.defect } : {})
  };
  const references = [path.join(root, find(m.generation.styleReferenceEntryId).file)];
  if (correctionFile) references.unshift(path.join(root, e.file));
  for (const reference of references) assert(fs.existsSync(reference));
  e.attempts.push(attempt); e.status = 'generating';
  p.generationCalls++;
  p.current = { entryId: e.entryId, attempt: attempt.number, slug: e.slug, startedAt: attempt.startedAt, outcome: 'awaiting-tool-result' };
  save(); console.log(JSON.stringify({ entryId: e.entryId, slug: e.slug, prompt, references, attempt: attempt.number }));
}
function capture(id, source) {
  const e = find(id), a = e.attempts.at(-1);
  assert.equal(p.current?.entryId, e.entryId); assert.equal(e.status, 'generating');
  assert(fs.existsSync(source), 'Tool result file must exist');
  p.current.source = path.resolve(source); p.current.outcome = 'result-file-found';
  save();
  const filename = `${e.entryId}-${e.slug}-v${a.number}.png`, target = path.join(root, filename);
  const bytes = fs.readFileSync(source);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), hash = sha(bytes);
  assert(width < height && Math.abs(width / height - 0.75) <= 0.05);
  if (fs.existsSync(target)) assert.equal(sha(fs.readFileSync(target)), hash, 'Never overwrite a different image');
  else fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  Object.assign(a, { status: 'generated', finishedAt: new Date().toISOString(), file: filename, sha256: hash, width, height, bytes: bytes.length });
  Object.assign(e, { status: 'generated', file: filename, sha256: hash, width, height, bytes: bytes.length });
  delete e.pendingCorrection;
  p.current = null;
  p.history.push({ action: 'captured', entryId: e.entryId, attempt: a.number, at: a.finishedAt });
  save(); console.log(JSON.stringify({ entryId: e.entryId, target, counts: m.counts, generationCalls: p.generationCalls }));
}
function review(reviewFile) {
  assert.equal(p.current, null);
  for (const input of JSON.parse(fs.readFileSync(reviewFile))) {
    const e = find(input.entryId);
    assert(!e.policyHold, 'Explicit policy hold must be resolved before review');
    assert(['generated', 'approved', 'held'].includes(e.status));
    assert(['approve', 'hold'].includes(input.decision));
    assert(input.note?.trim());
    if (input.decision === 'approve') {
      if (e.textPolicyException) {
        const approval = m.generation.remainingApproval;
        assert(approval && approval.textExceptionEntryIds.includes(e.entryId));
        assert.equal(e.textPolicyException.approvalId, approval.approvalId);
        assert.equal(input.textFree, false, 'Allowed subject letters must not be reported as text-free');
        assert.equal(input.textPolicyExceptionVerified, true);
        assert.equal(input.nonAuthorizedTextAbsent, true);
        assert.equal(input.textExceptionApprovalId, approval.approvalId);
      } else assert.equal(input.textFree, true);
      assert(input.styleConsistent === true && input.meaningMatch === true && input.smallScreenChecked === true && input.pngDecoded === true);
      const bytes = fs.readFileSync(path.join(root, e.file));
      assert.equal(sha(bytes), e.sha256);
      assert.equal(bytes.length, e.bytes);
    }
    e.status = input.decision === 'approve' ? 'approved' : 'held';
    e.review = { ...input, reviewer: 'Codex', reviewedAt: new Date().toISOString(),
      userApproval: 'style-approved', caveat: 'An image is a mnemonic; it does not uniquely identify an English word or explain every use.' };
  }
  save(); console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls }));
}
function authorizeRemaining(decisionFile) {
  assert.equal(p.current, null, 'Resolve the current call first');
  const bytes = fs.readFileSync(decisionFile), decision = JSON.parse(bytes), existing = m.generation.remainingApproval;
  if (existing) {
    assert.equal(existing.approvalSourceSha256, sha(bytes), 'Remaining approval cannot be replaced');
    console.log(JSON.stringify({ approvalId: existing.approvalId, changed: false })); return;
  }
  const ids = ['d056f2650b116cba', '49717992a5fb1a1a', '53b4f95ddd122fc2', '8e5aef6a2138e99b'];
  const letterIds = [ids[0], ids[1], ids[3]];
  assert(decision.approvalId?.trim() && Number.isFinite(Date.parse(decision.approvedAt)));
  assert.equal(decision.letterDecision, '세 항목의 영문 글자 형태만 허용 (추천)');
  assert.equal(decision.breastDecision, '노출 없는 의료상담 후보로 진행');
  assert.equal(decision.provider, 'built-in-image_gen'); assert.equal(decision.automaticServiceRetry, false);
  assert.equal(decision.qualityIterationsUntilApproved, true);
  assert.deepEqual(decision.entryIds, ids); assert.deepEqual(decision.textExceptionEntryIds, letterIds);
  assert.deepEqual(m.entries.filter(e => e.status !== 'approved').map(e => e.entryId), ids);
  assert.equal(decision.baseManifestSha256, sha(fs.readFileSync(file)));
  assert.equal(decision.baseLedgerSha256, sha(fs.readFileSync(progressFile)));
  const entries = ids.map(find);
  for (const e of entries) {
    const spec = decision.entries.find(s => s.entryId === e.entryId);
    assert(spec); assert.equal(spec.entrySnapshotSha256, sha(JSON.stringify(e)));
    assert.deepEqual(spec.entryBefore, e, 'Preserve the full previous policy/failure entry');
    assert.equal(spec.sourceFingerprint, e.sourceFingerprint); assert.match(spec.slug, /^[a-z0-9-]+$/);
    if (letterIds.includes(e.entryId)) assert(e.policyHold?.userDecision.includes('글자 금지 유지'));
    else { assert.equal(e.status, 'failed'); assert.equal(e.attempts.at(-1).error?.code, 'moderation_blocked'); }
  }
  m.generation.remainingApproval = { ...decision, approvalSourceSha256: sha(bytes) };
  for (const e of entries) {
    e.slug = decision.entries.find(s => s.entryId === e.entryId).slug;
    if (letterIds.includes(e.entryId)) {
      e.policyHoldHistory = [...(e.policyHoldHistory || []), { hold: e.policyHold, releasedByApprovalId: decision.approvalId, releasedAt: decision.approvedAt }];
      e.textPolicyException = { approvalId: decision.approvalId, scope: 'English letter forms constituting the subject only; no additional captions, numbers, labels, brands or watermarks.' };
      delete e.policyHold;
    }
  }
  p.history.push({ action: 'remaining-scope-approved', approvalId: decision.approvalId, at: decision.approvedAt });
  save(); console.log(JSON.stringify({ approvalId: decision.approvalId, changed: true, counts: m.counts, generationCalls: p.generationCalls }));
}
function holdPolicy(decisionFile) {
  assert.equal(m.generation.userApproval, 'style-approved-continue');
  assert.equal(p.current, null, 'Resolve the current image call before recording policy holds');
  const decision = JSON.parse(fs.readFileSync(decisionFile));
  assert(Array.isArray(decision.entryIds) && decision.entryIds.length > 0);
  assert.equal(new Set(decision.entryIds).size, decision.entryIds.length);
  assert.equal(decision.reason, 'text-policy-meaning-conflict');
  assert(decision.userDecision?.trim() && decision.note?.trim());
  // Validate every entry before changing any state; no image slot or file is fabricated.
  const entries = decision.entryIds.map(find);
  for (const e of entries) {
    assert(['waiting', 'held'].includes(e.status), 'Policy holds cannot replace generated or approved work');
    if (e.status === 'waiting') {
      assert.equal(e.attempts.length, 0);
      assert(!e.file, 'Waiting policy hold must not have an image');
    }
    if (e.policyHold) {
      assert.equal(e.policyHold.reason, decision.reason);
      assert.equal(e.policyHold.userDecision, decision.userDecision);
      assert.equal(e.policyHold.note, decision.note);
    }
  }
  const changed = entries.filter(e => !e.policyHold);
  if (changed.length) {
    const recordedAt = new Date().toISOString();
    for (const e of changed) {
      e.status = 'held';
      e.policyHold = { reason: decision.reason, userDecision: decision.userDecision, note: decision.note,
        phase: e.attempts.length ? 'after-generation' : 'before-generation', recordedAt };
    }
    p.history.push({ action: 'policy-held', entryIds: changed.map(e => e.entryId), reason: decision.reason, at: recordedAt });
    save();
  }
  console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls, policyHeld: entries.map(e => e.entryId), changed: changed.length }));
}
function status() {
  console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls, current: p.current,
    recovery: m.generation.recoveryApproval ? {
      approvalId: m.generation.recoveryApproval.approvalId,
      maximumNewStartSlots: m.generation.recoveryApproval.maximumNewStartSlots,
      used: recoveryUsage(m.generation.recoveryApproval).length,
      stoppedByFailure: m.generation.recoveryApproval.stoppedByFailure || null
    } : null,
    recoveryRounds: (m.generation.recoveryRounds || []).map(a => ({ approvalId: a.approvalId, round: a.round,
      maximumNewStartSlots: a.maximumNewStartSlots, used: recoveryUsage(a).length, stoppedByFailure: a.stoppedByFailure || null })),
    next: m.entries.filter(e => e.status === 'waiting').slice(0, 10).map(e => ({ id: e.entryId, word: e.headword || e.word, pos: e.pos, meaning: e.baseMeaning, prepared: Boolean(e.prompt) })) }));
}
function recoveryProposal(approval) {
  assert.equal(approval.proposalPath, approval.round >= 2 ? `docs/oxford-word-image-recovery-round${approval.round}-proposal.json` : 'docs/oxford-word-image-recovery-proposal.json');
  const bytes = fs.readFileSync(path.join(repo, approval.proposalPath));
  assert.equal(sha(bytes), approval.proposalSha256, 'Approved proposal changed');
  const proposal = JSON.parse(bytes);
  assert.equal(proposal.proposalId, approval.proposalId);
  assert.equal(proposal.executionAllowed, false); // The proposal remains an inert record.
  assert.equal(proposal.authorization, null);
  assert.equal(proposal.sourceSnapshot.dataset.sha256, m.dataset.sha256);
  if (approval.round >= 2) {
    assert.equal(proposal.schemaVersion, 2); assert.equal(proposal.round, approval.round);
    assert.equal(proposal.sourceSnapshot.firstApprovalSnapshotSha256, sha(JSON.stringify(m.generation.recoveryApproval)), 'Original recovery approval changed');
    if (approval.round > 2) {
      if (approval.remainingApprovalId) {
        const remaining = m.generation.remainingApproval;
        assert(remaining?.qualityIterationsUntilApproved && approval.remainingApprovalId === remaining.approvalId);
        assert.equal(proposal.sourceSnapshot.remainingApprovalSha256, sha(JSON.stringify(remaining)));
      } else {
        const standing = m.generation.qualityContinuationApproval;
        assert(standing?.untilApproved && approval.continuationApprovalId === standing.approvalId);
        assert.equal(proposal.sourceSnapshot.continuationApprovalSha256, sha(JSON.stringify(standing)));
      }
    }
  }
  assert(Array.isArray(approval.entryIds) && approval.entryIds.length > 0);
  assert.equal(new Set(approval.entryIds).size, approval.entryIds.length);
  assert.deepEqual(approval.entryIds, proposal.executionOrder.filter(id => approval.entryIds.includes(id)));
  return proposal;
}
function recoveryApprovalById(id) {
  const approval = [m.generation.recoveryApproval, ...(m.generation.recoveryRounds || [])].find(a => a && a.approvalId === id);
  assert(approval, 'Explicit recovery approval is required');
  return approval;
}
function authorizeQualityContinuation(decisionFile) {
  assert.equal(p.current, null, 'Resolve the current call before recording quality continuation');
  const bytes = fs.readFileSync(decisionFile), decision = JSON.parse(bytes), existing = m.generation.qualityContinuationApproval;
  if (existing) {
    assert.equal(existing.approvalSourceSha256, sha(bytes), 'Quality continuation cannot be replaced');
    console.log(JSON.stringify({ approvalId: existing.approvalId, changed: false })); return;
  }
  const firstRound = m.generation.recoveryRounds?.[0];
  assert(firstRound?.round === 2, 'Record the original fourteen-entry scope first');
  assert(decision.approvalId?.trim() && decision.userDecision?.trim()); assert(Number.isFinite(Date.parse(decision.approvedAt)));
  assert.equal(decision.parentApprovalId, firstRound.approvalId); assert.deepEqual(decision.entryIds, firstRound.entryIds);
  assert.equal(decision.untilApproved, true); assert.equal(decision.provider, 'built-in-image_gen');
  assert.equal(decision.automaticServiceRetry, false); assert.equal(decision.textPolicyHoldsPreserved, true);
  for (const id of decision.entryIds) { const e = find(id); assert(!e.policyHold && e.file, 'Quality scope must contain existing non-policy images'); }
  m.generation.qualityContinuationApproval = { ...decision, approvalSourceSha256: sha(bytes) };
  p.history.push({ action: 'quality-continuation-approved', approvalId: decision.approvalId, at: decision.approvedAt });
  save(); console.log(JSON.stringify({ approvalId: decision.approvalId, changed: true, untilApproved: true, generationCalls: p.generationCalls }));
}
function authorizeRecoveryRound(approvalFile) {
  assert.equal(p.current, null, 'Resolve the current call before recording recovery approval');
  const bytes = fs.readFileSync(approvalFile), approval = JSON.parse(bytes);
  assert(Number.isInteger(approval.round) && approval.round >= 2);
  const existing = (m.generation.recoveryRounds || []).find(a => a.approvalId === approval.approvalId);
  if (existing) {
    assert.equal(existing.approvalSourceSha256, sha(bytes), 'Recovery approval cannot be replaced or refilled');
    recoveryProposal(existing); recoveryUsage(existing);
    console.log(JSON.stringify({ approvalId: existing.approvalId, changed: false, generationCalls: p.generationCalls }));
    return;
  }
  const rounds = m.generation.recoveryRounds || [];
  assert.equal(approval.round, rounds.length + 2, 'The additional round cannot be replaced or refilled');
  const first = m.generation.recoveryApproval;
  assert(first, 'Preserve the original recovery approval');
  const previous = rounds.at(-1) || first;
  assert.equal(recoveryUsage(previous).length, previous.maximumNewStartSlots, 'Finish the previous allowance first');
  assert(!previous.stoppedByFailure, 'Investigate the previous recovery stop first');
  const proposal = recoveryProposal(approval);
  assert(approval.approvalId?.trim() && approval.userDecision?.trim());
  assert.notEqual(approval.approvalId, first.approvalId);
  assert(Number.isFinite(Date.parse(approval.approvedAt)));
  assert.match(approval.proposalCommit, /^[a-f0-9]{40}$/);
  assert.equal(approval.firstApprovalId, first.approvalId);
  assert.equal(approval.provider, 'built-in-image_gen'); assert.equal(approval.automaticRetry, false);
  assert.equal(approval.oneAdditionalStartPerEntry, true); assert.equal(approval.textPolicyHoldsPreserved, true);
  assert.deepEqual(approval.entryIds, proposal.executionOrder, 'Use the exact approved additional scope');
  assert.deepEqual(approval.entryIds, m.entries.filter(e => approval.entryIds.includes(e.entryId)).map(e => e.entryId), 'Keep textbook order');
  if (approval.round === 2) assert.equal(approval.maximumNewStartSlots, 14);
  else {
    if (approval.remainingApprovalId) {
      const remaining = m.generation.remainingApproval;
      assert(remaining?.qualityIterationsUntilApproved && approval.remainingApprovalId === remaining.approvalId);
      assert(approval.entryIds.every(id => remaining.entryIds.includes(id)), 'Outside the remaining resolution scope');
    } else {
      const standing = m.generation.qualityContinuationApproval;
      assert(standing?.untilApproved, 'Explicit quality continuation approval is required');
      assert.equal(approval.continuationApprovalId, standing.approvalId);
      assert.equal(proposal.sourceSnapshot.continuationApprovalSha256, sha(JSON.stringify(standing)));
      assert(approval.entryIds.every(id => standing.entryIds.includes(id)), 'Outside the quality continuation scope');
    }
  }
  assert.equal(approval.maximumNewStartSlots, approval.entryIds.length);
  assert(approval.maximumNewStartSlots > 0 && approval.maximumNewStartSlots <= 14);
  assert.equal(approval.maximumNewStartSlots, proposal.proposedStartSlotLimit);
  assert.equal(approval.baseGenerationCalls, p.generationCalls); assert.equal(approval.baseGenerationCalls, proposal.currentStartSlots);
  assert.equal(approval.maximumTotalStartSlots, p.generationCalls + approval.maximumNewStartSlots);
  assert.equal(approval.maximumTotalStartSlots, proposal.maximumStartSlotsAfterProposal);
  assert.equal(approval.baseManifestSha256, sha(fs.readFileSync(file)));
  assert.equal(approval.baseManifestSha256, proposal.sourceSnapshot.manifestSha256);
  assert.equal(approval.baseLedgerSha256, sha(fs.readFileSync(progressFile)));
  assert.equal(approval.baseLedgerSha256, proposal.sourceSnapshot.ledgerSha256);
  for (const id of approval.entryIds) {
    const e = find(id), spec = proposal.entries.find(s => s.entryId === id);
    assert(spec && !e.policyHold && (e.status === 'held' || (approval.remainingApprovalId && e.status === 'failed')), 'Additional scope contains an unsupported entry');
    assert.equal(spec.currentStatus, e.status); assert.equal(spec.currentAttempts, e.attempts.length);
    assert.equal(spec.sourceFingerprint, e.sourceFingerprint); assert.equal(spec.entrySnapshotSha256, sha(JSON.stringify(e)));
    assert.equal(spec.proposedAdditionalStartSlots, 1); assert.equal(spec.proposedNextAttemptNumber, e.attempts.length + 1);
    assert.equal(spec.fullPromptSha256, sha(spec.fullPrompt));
    assert(Array.isArray(spec.references), 'Additional reference roles are required');
    recoveryReferences(spec, e);
  }
  m.generation.recoveryRounds = [...rounds, { ...approval, approvalSourceSha256: sha(bytes) }];
  p.history.push({ action: 'recovery-round-approved', approvalId: approval.approvalId, round: approval.round, at: approval.approvedAt });
  save(); console.log(JSON.stringify({ approvalId: approval.approvalId, changed: true, maximumNewStartSlots: approval.maximumNewStartSlots, generationCalls: p.generationCalls }));
}
function recoveryReferences(spec, e) {
  const reference = find(m.generation.styleReferenceEntryId);
  assert.equal(reference.status, 'approved');
  if (!spec.references) {
    const file = path.join(root, reference.file); assert.equal(sha(fs.readFileSync(file)), reference.sha256);
    return [file];
  }
  assert(['edit', 'redraw'].includes(spec.mode));
  const expected = spec.mode === 'edit' ? [{ role: 'edit-target', file: e.file, sha256: e.sha256 },
    { role: 'style-only', file: reference.file, sha256: reference.sha256 }] : [{ role: 'style-only', file: reference.file, sha256: reference.sha256 }];
  assert.deepEqual(spec.references, expected, 'Reference roles/order changed');
  return spec.references.map(r => {
    assert.equal(path.basename(r.file), r.file); const file = path.join(root, r.file);
    assert.equal(sha(fs.readFileSync(file)), r.sha256, 'Reference image changed'); return file;
  });
}
function authorizeRecovery(approvalFile) {
  assert.equal(p.current, null, 'Resolve the current call before recording recovery approval');
  const approvalBytes = fs.readFileSync(approvalFile), approval = JSON.parse(approvalBytes);
  const existing = m.generation.recoveryApproval;
  if (existing) {
    assert.equal(existing.approvalSourceSha256, sha(approvalBytes), 'Recovery approval cannot be replaced or refilled');
    recoveryProposal(existing);
    console.log(JSON.stringify({ approvalId: existing.approvalId, changed: false, generationCalls: p.generationCalls }));
    return;
  }
  const proposal = recoveryProposal(approval);
  assert(approval.approvalId?.trim() && approval.userDecision?.trim());
  assert(Number.isFinite(Date.parse(approval.approvedAt)));
  assert.match(approval.proposalCommit, /^[a-f0-9]{40}$/);
  assert.equal(approval.provider, 'built-in-image_gen');
  assert.equal(approval.automaticRetry, false);
  assert.equal(approval.oneAdditionalStartPerEntry, true);
  assert.equal(approval.textPolicyHoldsPreserved, true);
  assert.equal(approval.maximumNewStartSlots, approval.entryIds.length);
  assert(approval.maximumNewStartSlots <= 53);
  assert.equal(approval.baseGenerationCalls, p.generationCalls);
  assert.equal(approval.maximumTotalStartSlots, p.generationCalls + approval.maximumNewStartSlots);
  assert.equal(approval.baseManifestSha256, sha(fs.readFileSync(file)));
  assert.equal(approval.baseLedgerSha256, sha(fs.readFileSync(progressFile)));
  for (const id of approval.entryIds) {
    const e = find(id), spec = proposal.entries.find(s => s.entryId === id);
    assert(spec && !e.policyHold && ['held', 'failed'].includes(e.status));
    assert.equal(e.status, spec.currentStatus);
    assert.equal(e.attempts.length, spec.currentAttempts);
    assert.equal(e.sourceFingerprint, spec.sourceFingerprint);
    assert.equal(spec.proposedAdditionalStartSlots, 1);
    assert.equal(spec.proposedNextAttemptNumber, e.attempts.length + 1);
    assert.equal(spec.fullPromptSha256, sha(spec.fullPrompt));
  }
  m.generation.recoveryApproval = { ...approval, approvalSourceSha256: sha(approvalBytes) };
  p.history.push({ action: 'recovery-approved', approvalId: approval.approvalId, at: approval.approvedAt });
  save();
  console.log(JSON.stringify({ approvalId: approval.approvalId, changed: true, maximumNewStartSlots: approval.maximumNewStartSlots, generationCalls: p.generationCalls }));
}
function recoveryUsage(approval) {
  const used = m.entries.flatMap(e => e.attempts.filter(a => a.recoveryApprovalId === approval.approvalId).map(a => ({ entryId: e.entryId, attempt: a })));
  assert.equal(new Set(used.map(u => u.entryId)).size, used.length, 'Each recovery entry gets one start');
  assert(used.every(u => approval.entryIds.includes(u.entryId)));
  const approvals = [m.generation.recoveryApproval, ...(m.generation.recoveryRounds || [])];
  assert(approvals.every(Boolean)); assert.equal(new Set(approvals.map(a => a.approvalId)).size, approvals.length);
  const allUsed = m.entries.flatMap(e => e.attempts.filter(a => a.recoveryApprovalId));
  assert(allUsed.every(a => approvals.some(r => r.approvalId === a.recoveryApprovalId)), 'Unscoped recovery slot');
  let ceiling = approvals[0].baseGenerationCalls;
  for (let i = 0; i < approvals.length; i++) {
    const round = approvals[i], entries = m.entries.flatMap(e => e.attempts.filter(a => a.recoveryApprovalId === round.approvalId).map(() => e.entryId));
    assert.equal(round.baseGenerationCalls, ceiling); assert.equal(round.maximumTotalStartSlots, ceiling + round.maximumNewStartSlots);
    assert.equal(new Set(entries).size, entries.length); assert(entries.every(id => round.entryIds.includes(id)));
    assert(entries.length <= round.maximumNewStartSlots);
    if (i < approvals.length - 1) assert.equal(entries.length, round.maximumNewStartSlots);
    ceiling = round.maximumTotalStartSlots;
  }
  assert.equal(p.generationCalls, approvals[0].baseGenerationCalls + allUsed.length, 'Recovery slots cannot be reset or bypassed');
  assert(used.length <= approval.maximumNewStartSlots);
  return used;
}
function startRecovery(id, approvalId = m.generation.recoveryApproval?.approvalId) {
  assert.equal(m.generation.userApproval, 'style-approved-continue');
  assert.equal(p.current, null, 'Previous image call is unresolved; do not retry blindly');
  const approval = recoveryApprovalById(approvalId);
  assert(!approval.stoppedByFailure, 'Recovery is stopped after a service failure; investigate before continuing');
  const proposal = recoveryProposal(approval), used = recoveryUsage(approval), e = find(id);
  assert(!e.policyHold, 'Explicit policy hold must be resolved before generation');
  assert(approval.entryIds.includes(e.entryId), 'Entry is outside the approved recovery scope');
  assert(!used.some(u => u.entryId === e.entryId), 'The approved additional start is already consumed');
  assert(used.every(u => find(u.entryId).status !== 'generated'), 'Review the previous candidate first');
  assert(used.length < approval.maximumNewStartSlots && p.generationCalls < approval.maximumTotalStartSlots, 'Recovery start limit exhausted');
  assert.equal(e.entryId, approval.entryIds.find(entryId => !used.some(u => u.entryId === entryId)), 'Keep approved textbook order');
  const spec = proposal.entries.find(s => s.entryId === e.entryId);
  assert.equal(e.status, spec.currentStatus);
  assert.equal(e.attempts.length, spec.currentAttempts);
  assert.equal(e.sourceFingerprint, spec.sourceFingerprint);
  assert.equal(spec.fullPromptSha256, sha(spec.fullPrompt));
  assert.match(e.slug, /^[a-z0-9-]+$/);
  const reference = find(m.generation.styleReferenceEntryId), references = recoveryReferences(spec, e);
  const attempt = {
    number: e.attempts.length + 1, startedAt: new Date().toISOString(), status: 'generating',
    prompt: spec.fullPrompt, promptSha256: spec.fullPromptSha256, promptVersion: m.generation.promptVersion,
    referenceEntryId: reference.entryId, recoveryApprovalId: approval.approvalId,
    recoveryProposalSha256: approval.proposalSha256, recoveryOriginalStatus: e.status,
    recoveryDefect: spec.latestReviewBasis || spec.previousError || spec.verificationConditions,
    ...(approval.round >= 2 ? { recoveryRound: approval.round, imageMode: spec.mode, imageReferences: spec.references } : {})
  };
  e.attempts.push(attempt); e.status = 'generating'; p.generationCalls++;
  p.current = { entryId: e.entryId, attempt: attempt.number, slug: e.slug, startedAt: attempt.startedAt, outcome: 'awaiting-tool-result', recoveryApprovalId: approval.approvalId };
  save();
  console.log(JSON.stringify({ entryId: e.entryId, slug: e.slug, prompt: attempt.prompt, references, attempt: attempt.number }));
}
function resumeRecovery(decisionFile) {
  const bytes = fs.readFileSync(decisionFile), decision = JSON.parse(bytes), approval = recoveryApprovalById(decision.recoveryApprovalId);
  assert(decision.resumeId?.trim() && decision.userDecision?.trim());
  const existing = approval.resumptions?.find(r => r.resumeId === decision.resumeId);
  if (existing) {
    assert.equal(existing.decisionSourceSha256, sha(bytes), 'Resume decision cannot be replaced');
    console.log(JSON.stringify({ resumeId: existing.resumeId, changed: false, generationCalls: p.generationCalls }));
    return; // Repeating an old decision must not clear a subsequent failure.
  }
  assert.equal(p.current, null, 'Resolve the current call before resuming');
  recoveryProposal(approval);
  const used = recoveryUsage(approval), stopped = approval.stoppedByFailure;
  assert(stopped, 'Recovery is not stopped');
  assert.equal(decision.recoveryApprovalId, approval.approvalId);
  assert.equal(decision.scope, 'unstarted-approved-entries-only');
  assert.equal(decision.provider, 'built-in-image_gen');
  assert.equal(decision.automaticRetry, false);
  assert(Number.isFinite(Date.parse(decision.approvedAt)));
  assert.equal(decision.maximumTotalStartSlots, approval.maximumTotalStartSlots);
  assert.equal(decision.manifestSha256, sha(fs.readFileSync(file)), 'Resume manifest changed');
  assert.equal(decision.ledgerSha256, sha(fs.readFileSync(progressFile)), 'Resume ledger changed');
  assert.deepEqual(decision.stoppedByFailure, stopped, 'Resume failure changed');
  const failed = find(stopped.entryId), attempt = failed.attempts.at(-1);
  assert.equal(failed.status, 'failed'); assert.equal(attempt.number, stopped.attempt);
  assert.equal(attempt.error?.code, stopped.code);
  assert.equal(attempt.error?.outcome, 'terminal-no-image-returned', 'Unconfirmed output cannot be resumed');
  assert.equal(decision.failedAttemptSha256, sha(JSON.stringify(attempt)), 'Failed attempt changed');
  const rawPath = path.resolve(repo, attempt.error.rawResultFile);
  assert(rawPath.startsWith(path.join(repo, 'work') + path.sep));
  assert.equal(sha(fs.readFileSync(rawPath)), attempt.error.rawResultSha256);
  const unused = approval.entryIds.filter(id => !used.some(u => u.entryId === id));
  assert(unused.length > 0, 'No unused recovery starts remain');
  assert.deepEqual(decision.entryIds, unused, 'Resume only the untouched approved scope');
  const record = { ...decision, decisionSourceSha256: sha(bytes), recordedAt: new Date().toISOString() };
  approval.resumptions = [...(approval.resumptions || []), record];
  delete approval.stoppedByFailure;
  p.history.push({ action: 'recovery-resumed', resumeId: record.resumeId, approvalId: approval.approvalId,
    entryIds: unused, stoppedByFailure: stopped, at: record.recordedAt });
  save();
  console.log(JSON.stringify({ resumeId: record.resumeId, changed: true, unused: unused.length, generationCalls: p.generationCalls }));
}
function failRecovery(failureFile) {
  const failure = JSON.parse(fs.readFileSync(failureFile)), e = find(failure.entryId), a = e.attempts.at(-1), approval = recoveryApprovalById(a.recoveryApprovalId);
  assert(approval && a.recoveryApprovalId === approval.approvalId);
  assert.equal(p.current?.entryId, e.entryId); assert.equal(e.status, 'generating');
  assert.equal(p.current.source, undefined, 'A returned image must be captured, not marked as failed');
  assert(failure.error?.code?.trim() && failure.error?.category?.trim() && failure.error?.stage?.trim());
  assert(['terminal-no-image-returned', 'terminal-exec-aborted-no-image-observed'].includes(failure.error.outcome));
  const rawPath = path.resolve(repo, failure.rawResultFile);
  assert(rawPath.startsWith(path.join(repo, 'work') + path.sep));
  assert.equal(sha(fs.readFileSync(rawPath)), failure.rawResultSha256);
  Object.assign(a, { status: 'failed', finishedAt: new Date().toISOString(), error: { ...failure.error, rawResultFile: failure.rawResultFile, rawResultSha256: failure.rawResultSha256 } });
  e.status = 'failed'; p.current = null;
  approval.stoppedByFailure = { entryId: e.entryId, attempt: a.number, code: a.error.code, at: a.finishedAt };
  p.history.push({ action: 'recovery-failed', entryId: e.entryId, attempt: a.number, at: a.finishedAt });
  save(); console.log(JSON.stringify({ entryId: e.entryId, status: 'failed', generationCalls: p.generationCalls, recoveryStopped: true }));
}
const [command, ...args] = process.argv.slice(2);
if (command === 'consent') consent();
else if (command === 'prepare') prepare(args[0]);
else if (command === 'start') start(args[0], args[1]);
else if (command === 'capture') capture(args[0], args[1]);
else if (command === 'review') review(args[0]);
else if (command === 'hold-policy') holdPolicy(args[0]);
else if (command === 'remaining-authorize') authorizeRemaining(args[0]);
else if (command === 'status') status();
else if (command === 'recovery-authorize') authorizeRecovery(args[0]);
else if (command === 'recovery-start') startRecovery(args[0]);
else if (command === 'recovery-fail') failRecovery(args[0]);
else if (command === 'recovery-resume') resumeRecovery(args[0]);
else if (command === 'recovery-round-authorize') authorizeRecoveryRound(args[0]);
else if (command === 'recovery-quality-authorize') authorizeQualityContinuation(args[0]);
else if (command === 'recovery-round-start') { assert(args[1], 'Specify the additional approval ID'); startRecovery(args[0], args[1]); }
else throw Error('Use consent / prepare / start / capture / review / hold-policy / status / recovery-authorize / recovery-start / recovery-fail / recovery-resume / recovery-round-authorize / recovery-round-start');
