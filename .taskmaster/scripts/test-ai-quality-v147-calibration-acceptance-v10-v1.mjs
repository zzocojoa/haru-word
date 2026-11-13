import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSourceAdmissionV10 } from './ai-quality-v147-source-admission-v10-v1.mjs';
import { loadCalibrationAcceptanceV10, inspectCalibrationAcceptanceV10, compileCalibratedGroupsV10 } from './ai-quality-v147-calibration-acceptance-v10-v1.mjs';
import { validateGroupedProductReviewRequestV2 } from './ai-quality-v147-grouped-product-review-v2.mjs';

const sources = loadSourceAdmissionV10(), root = sources.projectRoot;
const read = f => JSON.parse(readFileSync(resolve(root, f), 'utf8'));
const plan = read('.taskmaster/evaluation/ai-quality-v147/withholding-calibration-v10-plan-v1.json');
const terminal = read('outputs/ai-quality-v147-v10-calibration-runtime-20261112/terminal.json');
const packets = sources.prepared.plan.candidates;

test('unchanged actual 72 votes and qualified sources meet each model/order threshold without English or release certification', () => {
  const a = loadCalibrationAcceptanceV10();
  assert.equal(a.calibrationAccepted, true); assert.equal(a.gradeMatches, 72); assert.equal(a.axesMatches, 72);
  assert.equal(a.cells.length, 6); assert.ok(a.cells.every(c => c.denominator === 12 && c.matches === 12 && c.criticalMisses === 0));
  assert.equal(a.maximumCalibratedGroupItems, 4); assert.equal(a.mainDispatchAuthorized, false); assert.equal(a.englishTruthCertified, false);
  assert.equal(a.sourceQualificationOccurredAfterMeasurement, true); assert.equal(a.existingVotesRescored, false);
  assert.deepEqual([a.newProviderCalls, a.newCountCalls, a.newKeyReads], [0, 0, 0]);
});
test('missing, duplicate or misbound physical records and a foreign policy cannot inherit acceptance', () => {
  assert.throws(() => inspectCalibrationAcceptanceV10(plan, terminal.records.slice(1), packets), /CA10_DENOMINATOR/);
  const duplicated = structuredClone(terminal.records); duplicated[1] = duplicated[0];
  assert.throws(() => inspectCalibrationAcceptanceV10(plan, duplicated, packets), /CA10_DENOMINATOR/);
  const wrong = structuredClone(terminal.records); wrong[0].requestSha256 = '0'.repeat(64);
  assert.throws(() => inspectCalibrationAcceptanceV10(plan, wrong, packets), /CA10_RECORD_BINDING/);
  assert.throws(() => inspectCalibrationAcceptanceV10({ ...plan, individualPolicyHash: '0'.repeat(64) }, terminal.records, packets), /CA10_POLICY/);
});
test('content changes and groups larger than the measured ceiling are rejected', () => {
  const changed = structuredClone(packets); changed[4].input.requestInput.contextNote += ' 다른 뜻';
  assert.throws(() => inspectCalibrationAcceptanceV10(plan, terminal.records, changed), /CA10_SOURCE_CONTENT/);
  const prior = read('outputs/ai-quality-v147-implementation-20261106/phase182/prepared-grouped-product-reviews-v10.json');
  const tooLarge = structuredClone(plan); tooLarge.requests[0] = prior.synthetic.requests.find(r => r.itemCount > 4);
  assert.throws(() => inspectCalibrationAcceptanceV10(tooLarge, terminal.records, packets), /CA10_MEASURED_GROUP_SIZE/);
});
test('a missed critical flag still holds calibration even when ordinary per-model accuracy exceeds the threshold', () => {
  const records = structuredClone(terminal.records);
  const index = plan.requests.findIndex(r => r.privateMembers.some(m => m.individual.privateBinding.sourceId === 'MC05'));
  const group = plan.requests[index], itemId = group.privateMembers.find(m => m.individual.privateBinding.sourceId === 'MC05').itemId;
  const response = JSON.parse(records[index].payloadRaw); response.items.find(x => x.itemId === itemId).grade.criticalErrors.approveBadGrammar = false;
  records[index].payloadRaw = JSON.stringify(response);
  const result = inspectCalibrationAcceptanceV10(plan, records, packets);
  assert.equal(result.observedCriterionSatisfied, false); assert.ok(result.cells.some(c => c.criticalMisses === 1));
  assert.ok(result.cells.every(c => c.matches >= 11));
});
test('four-member compilation preserves every individual vote, unavailable slot, full output allowance and nonself binding', () => {
  const prepared = read('outputs/ai-quality-v147-implementation-20261106/phase182/prepared-product-reviews-v10.json');
  for (const name of ['synthetic', 'recordedActual']) {
    const old = prepared[name], p = compileCalibratedGroupsV10(old), members = p.requests.flatMap(r => r.privateMembers.map(m => m.individual));
    assert.equal(p.logicalSlots, old.slots.length); assert.equal(members.length + p.unavailableSlots.length, old.slots.length);
    assert.deepEqual(new Set([...members, ...p.unavailableSlots].map(s => s.key)), new Set(old.slots.map(s => s.key)));
    const byKey = new Map(old.slots.map(s => [s.key, s]));
    for (const s of [...members, ...p.unavailableSlots]) assert.deepEqual(s, byKey.get(s.key));
    for (const r of p.requests) { validateGroupedProductReviewRequestV2(r); assert.ok(r.itemCount <= 4); assert.equal(r.outputTokenMax, r.itemCount * 1024); }
    assert.equal(p.mainDispatchAuthorized, false); assert.equal(p.referencesQualified, 0); assert.equal(p.actualEquivalenceEstablished, false);
    assert.equal(p.calibratedUnderDeclaredAiOnlyCriterion, true); assert.equal(p.lowerOccupancyGeneralEquivalenceCertified, false);
    if (name === 'synthetic') { assert.equal(p.logicalSlots, 1440); assert.equal(p.availableSlots, 1260); assert.equal(p.unavailableSlots.length, 180); }
    else assert.equal(p.logicalSlots, 24);
  }
});
