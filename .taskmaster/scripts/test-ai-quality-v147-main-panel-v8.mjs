import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { JUDGES, digest } from './ai-quality-v147-calibration.mjs';
import { compileMainAssessmentPanelV8, inspectMainCalibrationV8, MAIN_RUBRIC_HASH_V8, prepareMainCalibrationV8, quoteMainCalibrationV8 } from './ai-quality-v147-main-panel-v8.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const prepared = prepareMainCalibrationV8(resolve(manifest.baseline.existingDashboardRoot));
const { plan } = prepared;

test('All 72 calibration requests carry the tested v8 policy and no private labels', () => {
  assert.equal(plan.requests.length, 72);
  assert.equal(new Set(plan.requests.map(slot => slot.key)).size, 72);
  for (const wave of plan.waveKeys) {
    const slots = plan.requests.filter(slot => wave.keys.includes(slot.key));
    assert.deepEqual(slots.map(slot => slot.model).sort(), [...JUDGES, ...JUDGES].sort());
    assert.equal(slots.filter(slot => slot.layout === 'input-first').length, 3);
    assert.equal(slots.filter(slot => slot.layout === 'feedback-first').length, 3);
  }
  for (const slot of plan.requests) {
    const body = JSON.parse(slot.requestRaw);
    assert.equal(body.max_output_tokens, 1024);
    assert.deepEqual(body.text.format.schema.properties.productRubricHash.enum, [MAIN_RUBRIC_HASH_V8]);
    assert.doesNotMatch(body.input[0].content, /expectedV8Axes|expectedGrade|priorV7Review|sourceQualifiedV8|witnessId/);
    assert.deepEqual(JSON.parse(slot.countRequestRaw), Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, body[key]])));
  }
});

test('Earlier source reviews remain versioned, with no self reviewer or automatic adoption', () => {
  assert.equal(plan.witnesses.filter(row => row.priorV7Review.supported).length, 9);
  assert.deepEqual(plan.witnesses.filter(row => !row.priorV7Review.supported).map(row => row.id), ['MC02', 'MC05', 'MC08']);
  for (const row of plan.witnesses) {
    assert.equal(row.sourceQualifiedV8, false);
    assert.ok(row.priorV7Review.byJudge.every(x => x.voters.length === 2 && !x.voters.includes(x.judge)));
  }
  const sourceUrls = id => plan.witnesses.find(row => row.id === id).reference.sources.map(row => row.url);
  assert.ok(sourceUrls('MC05').includes('https://www.merriam-webster.com/dictionary/go'));
  assert.ok(sourceUrls('MC06').includes('https://www.merriam-webster.com/dictionary/own'));
});

test('The real panel compiler keeps review parents, two layouts and two other models', () => {
  const witness = plan.witnesses.find(row => row.id === 'MC10');
  const generatorId = JUDGES[0];
  const parent = JSON.stringify({ model: generatorId, input: [{ role: 'user', content: JSON.stringify(witness.requestInput) }] });
  const row = { id: 'fixture-review', generatorId, phase: 'candidate', caseId: 'fixture-case', familyId: 'fixture-family',
    domain: witness.assessmentDomain, stratum: 'needsCorrection', parentReceiptHash: digest(parent), input: witness.input,
    requestInput: witness.requestInput, feedback: witness.feedback, reference: witness.reference };
  const args = { observations: [row], witnesses: plan.witnesses, parents: new Map([[row.id, parent]]), salt: Buffer.alloc(32, 2) };
  const { plan: main } = compileMainAssessmentPanelV8(args);
  const review = main.slots.filter(slot => slot.kind === 'review');
  assert.equal(review.length, 4);
  assert.deepEqual([...new Set(review.map(slot => slot.model))].sort(), JUDGES.filter(model => model !== generatorId).sort());
  for (const slot of review) {
    assert.equal(slot.dispatchEligible, true);
    assert.equal(slot.privateBinding.parentReceiptHash, row.parentReceiptHash);
    assert.equal(main.mainDispatchAuthorized, false);
  }
  assert.throws(() => compileMainAssessmentPanelV8({ ...args, parents: new Map() }), /PARENT_REQUIRED/);
  const wrongModel = JSON.stringify({ ...JSON.parse(parent), model: JUDGES[1] });
  assert.throws(() => compileMainAssessmentPanelV8({ ...args, parents: new Map([[row.id, wrongModel]]) }), /MP8_PARENT_MODEL/);
  const wrongInput = JSON.stringify({ model: generatorId, input: [{ role: 'user', content: JSON.stringify({ ...witness.requestInput, target: 'Other target' }) }] });
  assert.throws(() => compileMainAssessmentPanelV8({ ...args, parents: new Map([[row.id, wrongInput]]) }), /ACTUAL_PARENT_INPUT/);
});

test('Separate reference and arithmetic gates are maintained across a full synthetic calibration', () => {
  const records = plan.requests.map(slot => {
    const row = plan.witnesses.find(x => x.id === slot.privateBinding.witnessId);
    const body = { grade: row.expectedGrade, ...row.expectedV8Axes, reasonCodes: ['confirmed'], productRubricHash: MAIN_RUBRIC_HASH_V8,
      assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1 };
    return { key: slot.key, requestRaw: slot.requestRaw, payloadRaw: JSON.stringify(body) };
  });
  const report = inspectMainCalibrationV8(prepared, records);
  assert.equal(report.arithmeticMatches, 72);
  assert.equal(report.sourceQualified, false);
  assert.equal(report.calibrationAcceptanceAllowed, false);
  assert.equal(report.mainDispatchAuthorized, false);
  assert.throws(() => inspectMainCalibrationV8(prepared, records.slice(1)), /MP8_DENOMINATOR/);
  assert.throws(() => inspectMainCalibrationV8(prepared, records.with(0, { ...records[0], requestRaw: records[1].requestRaw })), /MP8_REQUEST_BINDING/);
});

test('The 72-request ceiling equals 12 intact six-request waves and rejects unbound counts', () => {
  const counts = plan.requests.map(slot => ({ ...slot, inputTokens: 8000 }));
  const q = quoteMainCalibrationV8(prepared, counts);
  assert.equal(q.totals.totalMicros, '8567184');
  assert.equal(q.totals.countAllowanceMicros, '2520000');
  assert.equal(q.waves.length, 12);
  assert.ok(q.waves.every(wave => wave.totalMicros === '713932'));
  assert.equal(q.reservationCreated, false);
  assert.throws(() => quoteMainCalibrationV8(prepared, counts.with(0, { ...counts[0], inputTokens: 8001 })), /MC1_INPUT_BOUND/);
  assert.throws(() => quoteMainCalibrationV8(prepared, counts.with(0, { ...counts[0], countRequestSha256: '0'.repeat(64) })), /MC1_INPUT_BOUND/);
});
