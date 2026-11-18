import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSourceAdmissionV10, assertCurrentWitnessSourcesV10 } from './ai-quality-v147-source-admission-v10-v1.mjs';

const trusted = loadSourceAdmissionV10(), packets = trusted.prepared.plan.candidates;
const check = p => assertCurrentWitnessSourcesV10({ packets: p, policyHash: trusted.registry.policyHash });
test('actual source provenance supports the twelve fixed current witnesses without granting calibration or pilot acceptance', () => {
  const v = check(packets); assert.equal(v.qualifiedWitnesses, 12); assert.equal(v.sourceQualified, true);
  for (const k of ['formalCalibrationQualification', 'calibrationAcceptanceAllowed', 'mainDispatchAuthorized', 'englishTruthCertified']) assert.equal(v[k], false);
  assert.equal(v.referencesQualified, 0);
});
test('Korean intent, original, feedback, source or expected-score changes cannot inherit source qualification', () => {
  const changes = [p => { p[0].input.requestInput.sentence += ' changed'; }, p => { p[4].input.requestInput.contextNote += ' 다른 뜻'; },
    p => { p[0].feedback.explanation += ' false fact'; }, p => { p[0].reference.sources[0].excerpt += ' different source'; },
    p => { p[0].expectedGrade.grammar = 'fail'; }, p => { p[0].expectedAxes.sourceAdequacy = 'insufficient'; }];
  for (const mutate of changes) { const p = structuredClone(packets); mutate(p); assert.throws(() => check(p), /SA10_WITNESS_CONTENT/); }
});
test('aliases and order preserve content binding; duplicate, missing or wrong-policy sets remain blocked', () => {
  const reordered = [...packets].reverse().map((p, i) => ({ ...p, caseId: 'alias-' + i })); assert.equal(check(reordered).sourceQualified, true);
  assert.throws(() => check(packets.slice(1)), /SA10_DENOMINATOR/);
  const duplicate = structuredClone(packets); duplicate[11] = { ...duplicate[0], caseId: 'different-id' }; assert.throws(() => check(duplicate), /SA10_WITNESS_CONTENT/);
  assert.throws(() => assertCurrentWitnessSourcesV10({ packets, policyHash: '0'.repeat(64) }), /SA10_POLICY/);
});
