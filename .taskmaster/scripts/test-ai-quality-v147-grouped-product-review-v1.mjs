import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { CRITICAL, DIMENSIONS } from './ai-quality-v147-calibration.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';
import { compileGroupedProductReviewV1, GROUPED_PRODUCT_POLICY_HASH_V1, parseGroupedProductReviewV1,
  quoteGroupedProductReviewV1, validateGroupedProductReviewRequestV1 } from './ai-quality-v147-grouped-product-review-v1.mjs';

const root = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8')).baseline.existingDashboardRoot;
const read = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const old = read('outputs/ai-quality-v147-implementation-20261106/phase174/prepared-product-reviews.json');
const synthetic = compileGroupedProductReviewV1(old.synthetic), actual = compileGroupedProductReviewV1(old.recordedActual);
const payload = request => ({ groupProtocolHash: GROUPED_PRODUCT_POLICY_HASH_V1, items: request.privateMembers.map(m => {
  const feedback = JSON.parse(JSON.parse(m.individual.requestRaw).input[0].content).EVALUATION_DATA.feedback;
  const changed = !!feedback.correctedSentence && feedback.correctedSentence !== feedback.original.trim();
  return { itemId: m.itemId, grade: { ...Object.fromEntries(DIMENSIONS.map(d => [d, 'pass'])), criticalErrors: Object.fromEntries(CRITICAL.map(k => [k, false])) },
    reasonCodes: ['confirmed'], productRubricHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V1,
    sourceAdequacy: 'sufficient', learnerContext: 'sufficient', abstentionNeed: 'not_required',
    repairContext: changed ? 'sufficient' : 'not_applicable', assignmentForm: changed ? 'not_specified' : 'not_applicable' };
}) });

test('grouping preserves all 1440 slots with no vote reuse and keeps unavailable180 out of model inputs', () => {
  assert.equal(synthetic.logicalSlots, 1440); assert.equal(synthetic.availableSlots, 1260); assert.equal(synthetic.unavailableSlots.length, 180);
  const members = synthetic.requests.flatMap(r => r.privateMembers);
  assert.equal(members.length, 1260); assert.equal(new Set(members.map(m => m.individual.key)).size, 1260);
  assert.deepEqual(new Set(members.map(m => m.individual.key)), new Set(old.synthetic.slots.filter(s => s.feedbackAvailable).map(s => s.key)));
  assert.ok(synthetic.requests.length < 1260); assert.equal(synthetic.mainDispatchAuthorized, false);
  assert.equal(synthetic.actualEquivalenceEstablished, false);
});

test('each group keeps model/layout, splits identical originals, preserves full1024 per judgment and hides private labels', () => {
  for (const r of [...synthetic.requests, ...actual.requests]) {
    validateGroupedProductReviewRequestV1(r);
    const b = JSON.parse(r.requestRaw), items = JSON.parse(b.input[0].content).items;
    assert.ok(items.length <= 8); assert.equal(b.max_output_tokens, items.length * 1024);
    assert.equal(new Set(items.map(i => i.EVALUATION_DATA.input.requestInput.sentence)).size, items.length);
    assert.doesNotMatch(b.input[0].content, /generatorId|validationVersion|promptVersion|expectedGrade|authorDraft|privateBinding/);
    for (const m of r.privateMembers) { assert.equal(m.individual.model, r.model); assert.equal(m.individual.layout, r.layout); assert.notEqual(m.individual.privateBinding.generatorId, r.model); }
  }
  assert.equal(actual.logicalSlots, 24); assert.equal(actual.requests.length, 12);
});

test('reordered valid responses map to their original individual votes and never certify semantic equivalence', () => {
  const r = actual.requests[0], v = payload(r); v.items.reverse();
  const rows = parseGroupedProductReviewV1(r, JSON.stringify(v));
  assert.deepEqual(rows.map(x => x.key), r.privateMembers.map(x => x.individual.key));
  for (const x of rows) { assert.equal(x.assessment.policyCompliance.state, 'pass'); assert.equal(x.assessment.semanticCorrectnessVerified, false); assert.equal(x.actualEquivalenceEstablished, false); }
});

test('duplicate/missing/foreign item, wrong policy echo and incomplete response cannot silently drop a vote', () => {
  const r = actual.requests[0], parse = v => parseGroupedProductReviewV1(r, JSON.stringify(v));
  let v = payload(r); v.items[1] = structuredClone(v.items[0]); assert.throws(() => parse(v), /DUPLICATE_ITEM/);
  v = payload(r); v.items.pop(); assert.throws(() => parse(v), /OUTPUT_ARRAY/);
  v = payload(r); v.items[0].itemId = 'foreign'; assert.throws(() => parse(v), /OUTPUT_ENUM/);
  v = payload(r); v.groupProtocolHash = '0'.repeat(64); assert.throws(() => parse(v), /OUTPUT_ENUM/);
  v = payload(r); delete v.items[0].grade.grammar; assert.throws(() => parse(v), /OUTPUT_FIELDS/);
});

test('one critical or uncertain vote remains distinct from the other item, with no majority or automatic repair', () => {
  const r = actual.requests[0], v = payload(r);
  v.items[0].grade.correction = 'fail'; v.items[0].grade.criticalErrors.reverseMeaning = true;
  const rows = parseGroupedProductReviewV1(r, JSON.stringify(v));
  assert.equal(rows[0].assessment.grade.criticalErrors.reverseMeaning, true); assert.equal(rows[1].assessment.grade.correction, 'pass');
  const uncertain = payload(r); uncertain.items[0].grade.correction = 'uncertain';
  assert.equal(parseGroupedProductReviewV1(r, JSON.stringify(uncertain))[0].assessment.grade.correction, 'uncertain');
});

test('mutated member, body and count body cannot be quoted or parsed as the sealed group', () => {
  const r = actual.requests[0];
  for (const mutate of [x => { x.requestRaw += ' '; }, x => { x.countRequestRaw = '{}'; }, x => { x.privateMembers[0].itemId = 'changed'; }]) {
    const changed = structuredClone(r); mutate(changed); assert.throws(() => validateGroupedProductReviewRequestV1(changed));
  }
  const wrong = structuredClone(old.recordedActual); wrong.slots[0].privateBinding.generatorId = wrong.slots[0].model;
  assert.throws(() => compileGroupedProductReviewV1(wrong), /BINDING/);
});

test('scenario costs preserve fixed count allowance and full output caps, bind every receipt and create no reservation', () => {
  const receipts = actual.requests.map(r => ({ key: r.key, countRequestSha256: r.countRequestSha256, inputTokens: 5000, provenance: 'synthetic-scenario' }));
  const q = quoteGroupedProductReviewV1(actual, receipts);
  assert.equal(q.countProvisionMicros, '420000'); assert.equal(q.reservationCreated, false); assert.equal(q.inputTokensReportedAsApiCount, false);
  assert.equal(q.inputCountProvenanceVerified, false); assert.ok(q.rows.every(r => r.reservedInputTokens === 6250));
  assert.equal(q.rows.reduce((n, r) => n + r.outputTokenMax, 0), 24 * 1024);
  assert.ok(BigInt(q.totalMicros) > 723750n);
  assert.throws(() => quoteGroupedProductReviewV1(actual, receipts.slice(1)), /COUNT_DENOMINATOR/);
  const changed = structuredClone(receipts); changed[0].countRequestSha256 = '0'.repeat(64); assert.throws(() => quoteGroupedProductReviewV1(actual, changed), /COUNT_RECEIPT/);
  changed[0] = { ...receipts[0], inputTokens: 50001 }; assert.throws(() => quoteGroupedProductReviewV1(actual, changed), /COUNT_RECEIPT/);
});
