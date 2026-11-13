import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CRITICAL, DIMENSIONS, JUDGES, digest, sameGrade } from './ai-quality-v147-calibration.mjs';
import { validateProductGradeV2 } from './ai-quality-v147-product-rubric-v2.mjs';
import { parseV3Json, validateV3Output } from './ai-quality-v147-wire-v3.mjs';

const axes = ['sourceAdequacy', 'learnerContext', 'abstentionNeed', 'repairContext', 'assignmentForm'];
const sha = value => createHash('sha256').update(value).digest('hex');
const tally = (rows, key) => {
  const result = {};
  for (const row of rows) result[key(row)] = (result[key(row)] ?? 0) + 1;
  return result;
};

function readVote(slot, capture, data) {
  const identity = { requestId: slot.requestId, requestSha256: slot.requestSha256, model: slot.model, layout: slot.layout };
  if (!capture) return { ...identity, state: slot.readyForRehearsal ? 'missing' : 'no-screen' };
  assert.equal(capture.dataClass, 'synthetic');
  assert.equal(capture.requestSha256, slot.requestSha256, 'Review capture body changed');
  assert.equal(capture.model, slot.model, 'Review capture model changed');
  assert.ok(slot.readyForRehearsal, 'Review capture has no visible screen');
  assert.ok(['graded', 'failed'].includes(capture.state));
  if (capture.state === 'failed') {
    assert.equal(capture.payloadRaw, null);
    return { ...identity, state: 'failed' };
  }
  assert.equal(typeof capture.payloadRaw, 'string');
  const payloadSha256 = sha(capture.payloadRaw);
  try {
    const vote = validateProductGradeV2(validateV3Output(slot.requestRaw, capture.payloadRaw));
    assert.equal(new Set(vote.reasonCodes).size, vote.reasonCodes.length);
    const repair = data.feedback.correctedSentence?.trim();
    const changed = !!repair && repair !== data.input.sentence.trim();
    assert.equal(['not_applicable', 'unavailable'].includes(vote.repairContext), !changed);
    assert.equal(['not_applicable', 'unavailable'].includes(vote.assignmentForm), !changed);
    if (!changed) {
      assert.equal(vote.repairContext, 'not_applicable');
      assert.equal(vote.assignmentForm, 'not_applicable');
    }
    if (vote.repairContext === 'missing') {
      assert.equal(vote.learnerContext, 'missing');
      assert.equal(vote.abstentionNeed, 'required');
      assert.notEqual(vote.grade.correction, 'pass');
    }
    if (vote.assignmentForm === 'violates') assert.equal(vote.grade.correction, 'fail');
    return { ...identity, state: 'graded', payloadSha256, grade: vote.grade, reasonCodes: vote.reasonCodes,
      evidenceAxes: Object.fromEntries(axes.map(key => [key, vote[key]])) };
  } catch {
    return { ...identity, state: 'invalid', payloadSha256 };
  }
}

// Synthetic report for the frozen revised rehearsal. Reference admission and
// calibration are deliberately outside this report's authority.
export function summarizeRehearsedPilotV1({ handoff, cases, captures }) {
  assert.equal(handoff.protocol, 'ai-quality-v147-pilot-review-handoff-v1');
  assert.equal(handoff.summary.referenceQualified, false);
  assert.equal(handoff.summary.mainDispatchAuthorized, false);
  const caseById = new Map(cases.map(row => [row.id, row]));
  assert.equal(cases.length, 60);
  assert.equal(caseById.size, 60);
  assert.equal(handoff.reviewSlots.length, 1440);
  const captureById = new Map(captures.map(row => [row.requestId, row]));
  assert.equal(captureById.size, captures.length, 'Duplicate review capture');
  const parents = new Map(), seenSlots = new Set();
  for (const slot of handoff.reviewSlots) {
    assert.ok(!seenSlots.has(slot.requestId), 'Duplicate planned review');
    seenSlots.add(slot.requestId);
    assert.equal(slot.dispatchEligible, false);
    assert.equal(sha(slot.requestRaw), slot.requestSha256);
    const { sourceId, caseId, phase, generatorId, parentReceiptHash } = slot.privateBinding;
    const item = caseById.get(caseId);
    assert.ok(item && ['baseline', 'candidate'].includes(phase) && JUDGES.includes(generatorId));
    assert.equal(sourceId, [caseId, phase, generatorId].join('/'));
    assert.match(parentReceiptHash, /^[a-f0-9]{64}$/);
    assert.ok(JUDGES.includes(slot.model) && slot.model !== generatorId);
    assert.ok(['input-first', 'feedback-first'].includes(slot.layout));
    const body = parseV3Json(slot.requestRaw, 131072);
    assert.equal(body.model, slot.model);
    const { EVALUATION_DATA: data } = parseV3Json(body.input[0].content);
    assert.equal(digest(data), slot.evidenceHash, 'Review evidence changed');
    assert.equal(data.input.sentence, item.sentence);
    assert.equal(data.reference.level, 'unresolved');
    assert.equal(slot.readyForRehearsal, data.feedback !== null);
    const parent = parents.get(sourceId) ?? { sourceId, caseId, phase, generatorId, domain: item.domain,
      stratum: item.stratum, parentReceiptHash, evidenceHash: slot.evidenceHash,
      visible: slot.readyForRehearsal, votes: [], seats: new Set() };
    const seat = slot.model + '/' + slot.layout;
    assert.ok(!parent.seats.has(seat), 'Duplicate review seat');
    assert.equal(parent.parentReceiptHash, parentReceiptHash, 'Review seat has a different parent receipt');
    assert.equal(parent.evidenceHash, slot.evidenceHash, 'Review seat sees different evidence');
    assert.equal(parent.visible, slot.readyForRehearsal);
    parent.seats.add(seat);
    parent.votes.push(readVote(slot, captureById.get(slot.requestId), data));
    parents.set(sourceId, parent);
  }
  assert.ok([...captureById.keys()].every(id => seenSlots.has(id)), 'Unplanned review capture');
  assert.equal(parents.size, 360);
  assert.ok([...parents.values()].every(parent => parent.seats.size === 4));
  const rows = [...parents.values()].map(({ seats, ...row }) => {
    assert.equal(seats.size, 4);
    const graded = row.votes.filter(vote => vote.state === 'graded');
    const critical = CRITICAL.filter(flag => graded.some(vote => vote.grade.criticalErrors[flag]));
    const gradeUncertain = graded.some(vote => DIMENSIONS.some(key => ['uncertain', 'unavailable'].includes(vote.grade[key])));
    const formUncertain = graded.some(vote => vote.evidenceAxes.assignmentForm === 'uncertain');
    const sourceInsufficient = graded.some(vote => vote.evidenceAxes.sourceAdequacy !== 'sufficient');
    const disagreement = graded.some(vote => !sameGrade(vote.grade, graded[0].grade) ||
      axes.some(key => vote.evidenceAxes[key] !== graded[0].evidenceAxes[key]));
    const reasons = [];
    if (!row.visible) reasons.push('no-visible-feedback');
    if (critical.length) reasons.push('critical-flag');
    if (row.visible && graded.length !== 4) reasons.push('incomplete-review');
    if (gradeUncertain) reasons.push('uncertain-grade');
    if (formUncertain) reasons.push('uncertain-assignment-form');
    if (sourceInsufficient) reasons.push('insufficient-review-source');
    if (disagreement) reasons.push('disagreement');
    reasons.push('reference-unqualified', 'current-calibration-unqualified');
    return { ...row, critical, reasons, observedUnanimity: graded.length === 4 && !gradeUncertain && !formUncertain &&
      !sourceInsufficient && !disagreement && !critical.length ?
        (DIMENSIONS.some(key => graded[0].grade[key] === 'fail') ? 'unanimous-fail' : 'unanimous-pass') : null,
      disposition: 'held' };
  });
  const rowById = new Map(rows.map(row => [row.sourceId, row]));
  const pairs = cases.flatMap(item => JUDGES.map(model => {
    const baseline = rowById.get([item.id, 'baseline', model].join('/'));
    const candidate = rowById.get([item.id, 'candidate', model].join('/'));
    assert.ok(baseline && candidate);
    const visible = baseline.visible ? candidate.visible ? 'both' : 'baseline-only'
      : candidate.visible ? 'candidate-only' : 'neither';
    return { caseId: item.id, model, visible, comparison: 'unmeasured' };
  }));
  const byGroup = new Map();
  for (const row of rows) {
    const key = [row.phase, row.generatorId, row.domain, row.stratum].join('/');
    const group = byGroup.get(key) ?? [];
    group.push(row);
    byGroup.set(key, group);
  }
  const groups = [...byGroup.entries()].map(([group, members]) => ({ group, planned: members.length,
    visible: members.filter(row => row.visible).length, held: members.length, qualifiedPasses: 0 }));
  return {
    protocol: 'ai-quality-v147-revised-pilot-report-v1', plannedParents: rows.length, plannedReviews: 1440,
    voteStates: tally(rows.flatMap(row => row.votes), vote => vote.state),
    pairedVisibility: tally(pairs, pair => pair.visible),
    criticalParents: rows.filter(row => row.critical.length).length,
    dissentingParents: rows.filter(row => row.reasons.includes('disagreement')).length,
    observedUnanimousPasses: rows.filter(row => row.observedUnanimity === 'unanimous-pass').length,
    observedUnanimousFailures: rows.filter(row => row.observedUnanimity === 'unanimous-fail').length,
    qualifiedPasses: 0, heldParents: rows.length, unmeasuredComparisons: pairs.length,
    actualProviderCalls: 0, englishQualityMeasured: false, learnerEfficacyMeasured: false,
    mainDispatchAuthorized: false, releaseVerdict: 'held', groups, pairs, rows,
  };
}
