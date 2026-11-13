import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JUDGES, digest } from './ai-quality-v147-calibration.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

const profiles = ['baseline', 'candidate'];
const layouts = ['input-first', 'feedback-first'];
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];
const sha = value => createHash('sha256').update(value).digest('hex');
const keyFor = (caseId, profile, model) => [caseId, profile, model].join('/');
const money = value => {
  assert.match(value, /^(0|[1-9]\d*)$/);
  return BigInt(value);
};

// Readiness inventory only. Its hash identifies evidence and never grants a live dispatch.
export function inspectRevisedPilotDispatchV1({ draft, generation, rehearsal, quarantinedCaseIds, readiness, live, ledger }) {
  assert.equal(draft.protocol, 'ai-quality-v147-post-freeze-pilot-draft-v3');
  assert.equal(rehearsal.protocol, 'ai-quality-v147-pilot-review-handoff-v1');
  assert.equal(draft.mainDispatchAuthorized, false);
  assert.equal(rehearsal.summary.mainDispatchAuthorized, false);
  const excluded = new Set(quarantinedCaseIds);
  assert.equal(excluded.size, 2);
  const cases = new Map(draft.cases.map(row => [row.id, row]));
  assert.equal(draft.cases.length, 60);
  assert.equal(cases.size, 60);
  for (const id of excluded) assert.ok(!cases.has(id), 'Exposed case in pilot draft');
  assert.equal(generation.rows.length, 360);
  const parentInputs = new Map();
  const generations = [];
  for (const row of generation.rows) {
    const item = cases.get(row.caseId);
    assert.ok(item && !excluded.has(row.caseId), 'Unplanned or exposed generation');
    assert.ok(profiles.includes(row.label) && JUDGES.includes(row.model), 'Invalid generation profile or model');
    const parent = keyFor(row.caseId, row.label, row.model);
    assert.ok(!parentInputs.has(parent), 'Duplicate generation');
    assert.equal(row.dispatchEligible, false, 'Generation is draft-only');
    assert.equal(sha(row.requestRaw), row.requestSha256, 'Generation body digest');
    const body = parseV3Json(row.requestRaw);
    assert.equal(body.model, row.model, 'Generation body model');
    const assignment = parseV3Json(body.input[0].content);
    assert.equal(assignment.sentence, item.sentence, 'Generation assignment differs from the draft');
    assert.equal(assignment.contextKind ?? 'sentence', item.contextKind);
    assert.equal(assignment.contextNote ?? '', item.contextNote);
    parentInputs.set(parent, assignment);
    generations.push({ parent, requestSha256: row.requestSha256 });
  }
  for (const caseId of cases.keys()) for (const model of JUDGES) {
    const baseline = parentInputs.get(keyFor(caseId, 'baseline', model));
    const candidate = parentInputs.get(keyFor(caseId, 'candidate', model));
    assert.ok(baseline && candidate, 'Incomplete generation matrix');
    assert.deepEqual(baseline, candidate, 'Generation assignments differ across profiles');
  }
  assert.equal(rehearsal.reviewSlots.length, 1440);
  const reviewers = new Map(), requestIds = new Set(), reviews = [];
  for (const row of rehearsal.reviewSlots) {
    const { sourceId, phase, caseId, generatorId } = row.privateBinding;
    assert.equal(sourceId, keyFor(caseId, phase, generatorId), 'Invalid review parent binding');
    const assignment = parentInputs.get(sourceId);
    assert.ok(assignment && !excluded.has(caseId), 'Review has no planned parent');
    assert.ok(JUDGES.includes(row.model) && row.model !== generatorId && layouts.includes(row.layout), 'Invalid judge or layout');
    const seat = row.model + '/' + row.layout;
    const group = reviewers.get(sourceId) ?? new Set();
    assert.ok(!group.has(seat) && !requestIds.has(row.requestId), 'Duplicate review');
    group.add(seat);
    reviewers.set(sourceId, group);
    requestIds.add(row.requestId);
    assert.equal(row.dispatchEligible, false, 'Rehearsal is synthetic-only');
    assert.equal(sha(row.requestRaw), row.requestSha256, 'Review body digest');
    assert.equal(sha(row.countRequestRaw), row.countRequestSha256, 'Count body digest');
    const body = parseV3Json(row.requestRaw, 131072);
    assert.equal(body.model, row.model);
    assert.deepEqual(parseV3Json(row.countRequestRaw, 131072), Object.fromEntries(countFields.map(key => [key, body[key]])));
    const { EVALUATION_DATA: data } = parseV3Json(body.input[0].content);
    assert.deepEqual(Object.keys(data), row.layout === 'input-first'
      ? ['input', 'feedback', 'reference'] : ['feedback', 'reference', 'input']);
    assert.deepEqual(data.input.assignmentContext.requestInput, assignment, 'Review assignment differs from its parent');
    assert.equal(data.input.assignmentContext.requestInputHash, digest(assignment));
    assert.equal(data.input.sentence, assignment.sentence);
    assert.equal(data.reference.level, 'unresolved', 'Rehearsal references are unresolved');
    assert.equal(row.readyForRehearsal, data.feedback !== null);
    reviews.push({ sourceId, seat, requestSha256: row.requestSha256, countRequestSha256: row.countRequestSha256,
      evidenceRole: 'synthetic-rehearsal-only', hasFeedback: row.readyForRehearsal });
  }
  assert.equal(reviewers.size, 360);
  assert.ok([...reviewers.values()].every(group => group.size === 4), 'Incomplete review matrix');
  const linked = reviews.filter(row => row.hasFeedback).length;
  assert.equal(linked, rehearsal.summary.rehearsalReviewBodies);
  assert.equal(reviews.length - linked, rehearsal.summary.heldReviews);

  const available = money(ledger.availableMicros);
  assert.equal(live.generalV3AvailableMicros, ledger.availableMicros, 'Live balance differs from ledger');
  assert.equal(available + money(ledger.usedUpperMicros) + money(ledger.reservedMicros), money(ledger.capMicros));
  const generationFloor = money(String(readiness.oneCaseGenerationReservationFloorMicros));
  const reviewFloor = money(String(readiness.oneCaseReviewReservationFloorMicros));
  const concurrentFloor = money(String(readiness.oneCaseConcurrentReservationFloorMicros));
  assert.equal(generationFloor + reviewFloor, concurrentFloor);
  assert.equal(live.oneCaseConcurrentReservationFloorMicros, String(concurrentFloor));
  const binding = { protocol: 'ai-quality-v147-revised-pilot-dispatch-preflight-v1',
    generations, reviews, availableMicros: ledger.availableMicros, ledgerRevision: ledger.revision };
  const blockers = ['exact-pilot-execution-approval-required', 'actual-app-review-bodies-unavailable'];
  if (live.qualifiedReferences !== cases.size) blockers.push('references-incomplete');
  if (!live.calibrationCurrentScreensRated) blockers.push('current-screen-calibration-pending');
  if (available < reviewFloor) blockers.push('one-case-review-reservation-exceeds-balance');
  if (money(ledger.reservedMicros) > 0n) blockers.push('ledger-already-reserved');
  return {
    protocol: binding.protocol, evidenceHash: digest(binding), status: 'held',
    plannedGenerations: generations.length, plannedReviews: reviews.length,
    syntheticReviewBodies: linked, unavailableReviewBodies: reviews.length - linked,
    availableMicros: ledger.availableMicros, oneCaseGenerationFloorMicros: String(generationFloor),
    oneCaseReviewFloorMicros: String(reviewFloor), oneCaseConcurrentFloorMicros: String(concurrentFloor),
    reviewShortfallMicros: String(available < reviewFloor ? reviewFloor - available : 0n),
    blockers, referencesQualified: live.qualifiedReferences, mainDispatchAuthorized: false,
    actualProviderCalls: 0, actualCountCalls: 0, actualKeyReads: 0,
  };
}
