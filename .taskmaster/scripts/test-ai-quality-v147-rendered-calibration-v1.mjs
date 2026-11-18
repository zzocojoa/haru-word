import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { MAIN_RUBRIC_HASH_V8 } from './ai-quality-v147-main-panel-v8.mjs';
import { inspectRenderedCalibrationV1, prepareRenderedCalibrationV1, projectRenderedCalibrationSlot,
  quoteRenderedCalibrationV1 } from './ai-quality-v147-rendered-calibration-v1.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const root = resolve(manifest.baseline.existingDashboardRoot);
const prepared = prepareRenderedCalibrationV1(root);
const { plan } = prepared;
const unpack = request => JSON.parse(JSON.parse(request).input[0].content).EVALUATION_DATA;

test('All 72 individual requests retain their rubric, assignment, reference, model and field order', () => {
  assert.equal(new Set(plan.requests.map(r => r.requestSha256)).size, 72);
  assert.equal(new Set(plan.requests.map(r => r.key)).size, 72);
  for (const slot of plan.requests) {
    const before = unpack(slot.legacyLabelRequestRaw), after = unpack(slot.requestRaw);
    const body = JSON.parse(slot.requestRaw), legacy = JSON.parse(slot.legacyLabelRequestRaw);
    assert.deepEqual(Object.keys(before), Object.keys(after));
    assert.deepEqual(before.input, after.input);
    assert.deepEqual(before.reference, after.reference);
    assert.deepEqual(body.text, legacy.text);
    assert.equal(body.model, slot.model);
    assert.equal(body.max_output_tokens, legacy.max_output_tokens);
    assert.equal(slot.dispatchEligible, false);
    assert.deepEqual(JSON.parse(slot.countRequestRaw), Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(k => [k, body[k]])));
    assert.doesNotMatch(body.input[0].content, /expectedV8Axes|expectedGrade|priorV7Review|sourceQualifiedV8|witnessId|meaningUsage/);
    if (after.feedback !== null) {
      assert.deepEqual(Object.keys(after.feedback).sort(), ['correctedSentence', 'explanation', 'headings']);
    }
    if (['MC01', 'MC03'].includes(slot.privateBinding.witnessId)) {
      assert.deepEqual(after.feedback.headings, ['수업 목표 · 보완 필요', '문법 · 형태 오류 확인', '교정 · 문맥 확인 필요']);
      assert.equal(after.feedback.correctedSentence, null);
    }
  }
  assert.equal(plan.sourceBindings.filter(r => r.evidenceKind === 'source-excerpts-and-screen').length, 11);
  assert.deepEqual(plan.sourceBindings.filter(r => r.evidenceKind === 'unavailable-control').map(r => r.caseId), ['MC04']);
});

test('Changed repairs, mismatched availability and undisplayed fields are rejected', () => {
  const slot = plan.requests.find(r => r.privateBinding.witnessId === 'MC01');
  const legacy = { ...slot, requestRaw: slot.legacyLabelRequestRaw };
  const copy = { ...legacy, requestSha256: createHash('sha256').update(legacy.requestRaw).digest('hex') };
  const feedback = unpack(slot.requestRaw).feedback;
  const instructions = '\nFor this comparison, feedback contains only learner-visible content.';
  assert.throws(() => projectRenderedCalibrationSlot(copy, { ...feedback, correctedSentence: 'You might bring a torch.' }, instructions), /RC1_SCREEN_SHAPE/);
  assert.throws(() => projectRenderedCalibrationSlot(copy, { ...feedback, grammar: 'uncertain' }, instructions), /RC1_SCREEN_SHAPE/);
  assert.throws(() => projectRenderedCalibrationSlot(copy, null, instructions), /RC1_AVAILABILITY/);
});

test('The full count and output reserve alone exceeds the active balance', () => {
  const q = quoteRenderedCalibrationV1(prepared, '3039780');
  assert.deepEqual([q.minimumReservationMicros, q.maximumReservationMicros, q.countAllowanceMicros, q.shortfallAtMinimumMicros],
    ['4278072', '8567184', '2520000', '1238292']);
  assert.deepEqual([q.minimumReservationFits, q.fitsConservativeMaximum, q.actualCountsMeasured, q.reservationCreated],
    [false, false, false, false]);
});

test('Full synthetic responses exercise applicability and preserve critical failures without promoting the gate', () => {
  const records = plan.requests.map(slot => {
    const row = plan.witnesses.find(r => r.id === slot.privateBinding.witnessId);
    const body = { grade: structuredClone(row.expectedGrade), ...row.expectedV8Axes, reasonCodes: ['confirmed'],
      productRubricHash: MAIN_RUBRIC_HASH_V8, assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1 };
    return { key: slot.key, requestRaw: slot.requestRaw, payloadRaw: JSON.stringify(body) };
  });
  assert.throws(() => inspectRenderedCalibrationV1(prepared, records.slice(1)), /RC1_DENOMINATOR/);
  assert.throws(() => inspectRenderedCalibrationV1(prepared, records.with(0, { ...records[0], requestRaw: plan.requests[0].legacyLabelRequestRaw })), /RC1_REQUEST_BINDING/);
  const withheld = plan.requests.findIndex(r => r.privateBinding.witnessId === 'MC01');
  const withheldVote = { ...JSON.parse(records[withheld].payloadRaw), repairContext: 'missing' };
  assert.throws(() => inspectRenderedCalibrationV1(prepared, records.with(withheld, { ...records[withheld], payloadRaw: JSON.stringify(withheldVote) })),
    /RC1_REPAIR_APPLICABILITY/);
  const index = plan.requests.findIndex(r => r.privateBinding.witnessId === 'MC06');
  const value = JSON.parse(records[index].payloadRaw);
  value.grade.criticalErrors.reverseMeaning = false;
  const report = inspectRenderedCalibrationV1(prepared, records.with(index, { ...records[index], payloadRaw: JSON.stringify(value) }));
  assert.equal(report.arithmeticMatches, 71);
  assert.deepEqual(report.rows[index].missedCriticalFlags, ['reverseMeaning']);
  assert.deepEqual([report.sourceQualified, report.calibrationAcceptanceAllowed, report.mainDispatchAuthorized], [false, false, false]);
});
