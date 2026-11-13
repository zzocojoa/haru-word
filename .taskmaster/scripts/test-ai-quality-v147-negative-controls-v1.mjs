import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { compileNegativeControlsV1, inspectNegativeControlsV1 } from './ai-quality-v147-bilingual-negative-controls-v1.mjs';
import { negativeControlFundingV1 } from './run-ai-quality-v147-negative-controls-v1.mjs';
import { collectFixedReviewsV1 } from './ai-quality-v147-fixed-review-executor-v1.mjs';
import { validateGroupedProductReviewRequestV1, GROUPED_PRODUCT_POLICY_HASH_V1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';

const bank = JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/explanation-main-witness-candidate-v1.json', import.meta.url), 'utf8'));
const before = JSON.stringify(bank), plan = compileNegativeControlsV1(bank);
function payload(request, allPass = false) {
  return JSON.stringify({ groupProtocolHash: GROUPED_PRODUCT_POLICY_HASH_V1, items: request.privateMembers.map(member => {
    const r = plan.controls.find(c => c.id === member.individual.privateBinding.sourceId);
    const changed = r.feedback.correctedSentence !== r.feedback.original;
    const grade = structuredClone(r.expectedGrade);
    if (allPass) { for (const k of ['meaning', 'grammar', 'correction', 'explanation', 'abstention']) grade[k] = 'pass'; for (const k in grade.criticalErrors) grade.criticalErrors[k] = false; }
    return { itemId: member.itemId, productRubricHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V1, grade, reasonCodes: ['grammar'],
      sourceAdequacy: 'sufficient', learnerContext: allPass ? 'sufficient' : r.expectedEvidenceAxes.learnerContext,
      abstentionNeed: allPass ? 'not_required' : r.expectedEvidenceAxes.abstentionNeed,
      repairContext: changed ? (!allPass && r.id === 'MC08' ? 'missing' : 'sufficient') : 'not_applicable',
      assignmentForm: changed ? 'not_specified' : 'not_applicable' };
  }) });
}
const records = allPass => plan.requests.map(r => ({ key: r.key, requestSha256: r.requestSha256, payloadRaw: payload(r, allPass) }));

test('four controls cover three judges and both layouts; old bank is unchanged and expected labels stay private', () => {
  assert.equal(JSON.stringify(bank), before); assert.equal(plan.requests.length, 12); assert.equal(plan.logicalSlots, 24);
  const coverage = new Set();
  for (const r of plan.requests) {
    validateGroupedProductReviewRequestV1(r); assert.equal(r.itemCount, 2); assert.equal(r.outputTokenMax, 2048);
    assert.equal(r.requestRaw.includes('expectedGrade'), false); assert.equal(r.requestRaw.includes('MC05'), false);
    const items = JSON.parse(JSON.parse(r.requestRaw).input[0].content).items;
    assert.equal(new Set(items.map(i => i.EVALUATION_DATA.input.requestInput.sentence)).size, 2);
    for (const m of r.privateMembers) coverage.add(m.individual.privateBinding.sourceId + '|' + r.model + '|' + r.layout);
    for (const item of items) assert.equal(item.EVALUATION_DATA.input.requestInput.contextRole, 'intended_korean');
  }
  assert.equal(coverage.size, 24); assert.equal(plan.formalCalibrationQualification, false);
});

test('fixed negative expectations parse independently, and an always-pass judge misses all24 harmful votes', () => {
  const matched = inspectNegativeControlsV1(plan, records(false));
  assert.equal(matched.exactGradeMatches, 24); assert.equal(matched.missedCriticalVotes, 0);
  const blind = inspectNegativeControlsV1(plan, records(true));
  assert.equal(blind.exactGradeMatches, 0); assert.equal(blind.missedCriticalVotes, 24);
  assert.equal(matched.mainDispatchAuthorized, false); assert.equal(matched.sourceQualified, false);
});

test('wrong request binding and a missing vote cannot be counted as calibration success', () => {
  const r = records(false); r[0].requestSha256 = '0'.repeat(64);
  assert.throws(() => inspectNegativeControlsV1(plan, r), /BNC1_BINDING/);
  assert.throws(() => inspectNegativeControlsV1(plan, records(false).slice(1)), /BNC1_RECORDS/);
});

test('restricted child funds conserve the parent source without a general allocation or a new grant', () => {
  const parent = { assignedMicros: '1743239', restrictedUsedUpperMicros: '744007', restrictedUnusedMicros: '999232', unassignedProvisionHeldMicros: '2771761' };
  const f = negativeControlFundingV1(parent);
  assert.equal(BigInt(parent.restrictedUsedUpperMicros) + BigInt(f.assignedMaximumMicros) + BigInt(f.unassignedProvisionHeldMicros), 4515000n);
  assert.equal(f.sourceRemainderMicros, '3770993'); assert.equal(f.generalDebitMicros, '0'); assert.equal(f.newGrantCreated, false);
  assert.throws(() => negativeControlFundingV1({ ...parent, restrictedUnusedMicros: '999233' }), /BNC1_PARENT_FUNDS/);
  assert.throws(() => negativeControlFundingV1(parent, 3770994n), /BNC1_RESTRICTED_CAP/);
});

test('existing collector runs this new plan once with12 counts before12 responses and no real-AI claim for mocks', async () => {
  const directory = mkdtempSync(resolve(process.env.QA_OUTPUT_DIR, 'negative-controls-'));
  const events = []; let models = 0, keys = 0;
  const r = await collectFixedReviewsV1({ plan, directory, loadKey: () => { keys++; return 'synthetic-negative-control-key'; }, transport: async ({ kind, body }) => {
    events.push(kind);
    if (kind === 'count') return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: 5000 }) };
    const request = JSON.parse(body), row = plan.requests[models++];
    return { status: 200, type: 'application/json', raw: JSON.stringify({ id: 'synthetic-negative-' + models, status: 'completed', model: request.model,
      service_tier: 'default', usage: { input_tokens: 5000, output_tokens: 500, total_tokens: 5500 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: payload(row) }] }] }) };
  } });
  assert.equal(r.failureCode, null); assert.equal(inspectNegativeControlsV1(plan, r.records).exactGradeMatches, 24);
  assert.deepEqual(events, [...Array(12).fill('count'), ...Array(12).fill('model')]); assert.equal(keys, 1);
  assert.equal(r.actualProviderCalls, 0); assert.equal(r.actualCountCalls, 0);
});
