import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inspectRevisedPilotDispatchV1 } from './ai-quality-v147-revised-pilot-dispatch-preflight-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const root = read(resolve(source, '.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot;
const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
const sha = value => createHash('sha256').update(value).digest('hex');
const inputs = {
  draft: read(resolve(evidence, 'phase137/pilot-60-replacement-draft.json')),
  generation: read(resolve(evidence, 'phase137/pilot-60-replacement-capture.json')),
  rehearsal: read(resolve(evidence, 'phase138/review-handoff.json')),
  quarantinedCaseIds: read(resolve(evidence, 'phase136/pilot-exposure-quarantine.json')).quarantined.map(row => row.caseId),
  readiness: read(resolve(evidence, 'phase118/readiness.json')),
  live: read(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json')),
  ledger: read(resolve(root, '.taskmaster/docs/ai-quality-v147-evaluation-budget-ledger-v3.json')),
};
const inspect = (change = {}) => inspectRevisedPilotDispatchV1({ ...inputs, ...change });
const withGeneration = row => ({ ...inputs.generation, rows: inputs.generation.rows.with(0, row) });
const withReview = row => ({ ...inputs.rehearsal, reviewSlots: inputs.rehearsal.reviewSlots.with(0, row) });

test('current draft and all synthetic bodies have a deterministic evidence identity and remain held', () => {
  const result = inspect();
  assert.deepEqual(result, inspect());
  assert.deepEqual([result.plannedGenerations, result.plannedReviews, result.syntheticReviewBodies,
    result.unavailableReviewBodies], [360, 1440, 1428, 12]);
  assert.equal(result.status, 'held');
  assert.equal(result.mainDispatchAuthorized, false);
  assert.match(result.evidenceHash, /^[a-f0-9]{64}$/);
  assert.ok(result.blockers.includes('exact-pilot-execution-approval-required'));
});

test('reinstating the previous draft or reusing a quarantined generation cannot satisfy the revised plan', () => {
  assert.throws(() => inspect({ draft: read(resolve(evidence, 'phase120/pilot-60-draft-v2.json')) }));
  const previous = read(resolve(evidence, 'phase120/pilot-60-capture.json'));
  const excluded = previous.rows.find(row => inputs.quarantinedCaseIds.includes(row.caseId));
  assert.throws(() => inspect({ generation: withGeneration(excluded) }), /Unplanned or exposed generation/);
});

test('generation body substitution is rejected even when the changed body is rehashed', () => {
  const row = inputs.generation.rows[0];
  const body = JSON.parse(row.requestRaw);
  const input = JSON.parse(body.input[0].content);
  body.input[0].content = JSON.stringify({ ...input, sentence: 'A substituted synthetic sentence.' });
  const requestRaw = JSON.stringify(body);
  assert.throws(() => inspect({ generation: withGeneration({ ...row, requestRaw, requestSha256: sha(requestRaw) }) }),
    /Generation assignment differs from the draft/);
});

test('duplicate generation and review seats, self-review and an omitted slot are rejected', () => {
  assert.throws(() => inspect({ generation: withGeneration(inputs.generation.rows[1]) }), /Duplicate generation/);
  assert.throws(() => inspect({ rehearsal: withReview(inputs.rehearsal.reviewSlots[1]) }), /Duplicate review/);
  const row = inputs.rehearsal.reviewSlots[0];
  assert.throws(() => inspect({ rehearsal: withReview({ ...row, model: row.privateBinding.generatorId }) }),
    /Invalid judge or layout/);
  assert.throws(() => inspect({ rehearsal: { ...inputs.rehearsal, reviewSlots: inputs.rehearsal.reviewSlots.slice(1) } }));
});

test('a rehashed count body and a rehashed mismatched parent body are held before use', () => {
  const row = inputs.rehearsal.reviewSlots[0];
  const count = JSON.parse(row.countRequestRaw);
  count.instructions += ' Altered.';
  const countRequestRaw = JSON.stringify(count);
  assert.throws(() => inspect({ rehearsal: withReview({ ...row, countRequestRaw, countRequestSha256: sha(countRequestRaw) }) }));
  const request = JSON.parse(row.requestRaw);
  const data = JSON.parse(request.input[0].content);
  data.EVALUATION_DATA.input.assignmentContext.requestInput.sentence = 'A substituted synthetic parent.';
  request.input[0].content = JSON.stringify(data);
  const requestRaw = JSON.stringify(request);
  const alignedCount = JSON.stringify(Object.fromEntries(Object.keys(count).map(key => [key, request[key]])));
  assert.throws(() => inspect({ rehearsal: withReview({ ...row, requestRaw, requestSha256: sha(requestRaw),
    countRequestRaw: alignedCount, countRequestSha256: sha(alignedCount) }) }), /Review assignment differs from its parent/);
});

test('synthetic scoring bodies and draft generation slots cannot be marked for live use', () => {
  assert.throws(() => inspect({ generation: withGeneration({ ...inputs.generation.rows[0], dispatchEligible: true }) }), /draft-only/);
  assert.throws(() => inspect({ rehearsal: withReview({ ...inputs.rehearsal.reviewSlots[0], dispatchEligible: true }) }),
    /synthetic-only/);
  assert.throws(() => inspect({ rehearsal: { ...inputs.rehearsal,
    summary: { ...inputs.rehearsal.summary, mainDispatchAuthorized: true } } }));
});

test('a stale live balance, inconsistent reservation arithmetic and a changed floor are rejected', () => {
  assert.throws(() => inspect({ live: { ...inputs.live, generalV3AvailableMicros: '0' } }), /differs from ledger/);
  assert.throws(() => inspect({ ledger: { ...inputs.ledger, reservedMicros: '1' } }));
  assert.throws(() => inspect({ readiness: { ...inputs.readiness, oneCaseReviewReservationFloorMicros: 1 } }));
});
