import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { referenceFixtureV4, positiveReferenceGradeV4 } from './ai-quality-v147-reference-fixture-v4.mjs';
import { validateReferenceDraftV4 } from './ai-quality-v147-reference-v4.mjs';
import { validateBilingualReferenceDraftV1, validateBilingualReferenceGradeV1 } from './ai-quality-v147-bilingual-reference-record-v1.mjs';

const here = fileURLToPath(new URL('../..', import.meta.url)), root = JSON.parse(readFileSync(resolve(here, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8')).baseline.existingDashboardRoot;
const capture = JSON.parse(readFileSync(resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase169/captured-proposal-requests.json'), 'utf8'));
const chosen = capture.records.find(r => r.profile === 'candidate' && r.caseId === 'ko-word-needsCorrection-03');
const sha = s => createHash('sha256').update(s).digest('hex');
const fixture = referenceFixtureV4(), entry = fixture.reportInputs.cases.find(c => c.domain === 'word').referencePreparation;
const assignment = entry.assignment, pack = entry.sourcePack;
const grammarAssignment = fixture.reportInputs.cases.find(c => c.domain === 'grammar').referencePreparation.assignment;
function record() {
  const input = JSON.parse(JSON.parse(chosen.requestRaw).input[0].content);
  return { caseId: assignment.caseId, assignmentHash: assignment.assignmentHash, domain: assignment.domain, targetKey: assignment.targetKey,
    familyId: assignment.familyId, familyRationale: 'Synthetic schema fixture; no freshness or English qualification.',
    input: { sentence: input.sentence, contextKind: input.contextKind ?? 'sentence', contextNote: input.contextNote, contextRole: input.contextRole },
    expectedOriginal: { meaningUsage: 'needs_work', grammar: 'natural', contextNeeded: 'none' }, acceptedCorrectionExamples: ['The kite drifted over the bridge.'],
    criterion: 'Repair the intended Korean relation; this is not an original grammar error.', sourceIds: [...assignment.permittedSourceIds], evidenceLevelClaim: 'ai-consensus', unresolved: false, reasonCodes: ['ai-consensus-only'] };
}
const binding = () => ({ parentRequestRaw: chosen.requestRaw, parentRequestSha256: sha(chosen.requestRaw) });
const partialGrade = () => ({ ...positiveReferenceGradeV4(), exposureAndFamilyCompliance: 'unavailable' });

test('the old English-only invariant rejects the real intent-repair shape; the prospective validator preserves its actual correction', () => {
  const draft = record(), old = structuredClone(draft); delete old.input.contextRole;
  assert.throws(() => validateReferenceDraftV4(old, assignment, pack), /REF4_NATURAL_CORRECTION/);
  const before = JSON.stringify(draft), value = validateBilingualReferenceDraftV1(draft, assignment, pack, binding());
  assert.equal(JSON.stringify(draft), before); assert.deepEqual(value.draft, draft);
  assert.equal(value.draft.acceptedCorrectionExamples[0], 'The kite drifted over the bridge.');
  assert.equal(value.structureVerified, true); assert.equal(value.semanticCorrectnessVerified, false); assert.equal(value.referenceQualified, false);
});
test('ordinary Korean notes cannot authorize natural-English rewrites and grammar targets cannot acquire the word-only role', () => {
  const b = JSON.parse(chosen.requestRaw), input = JSON.parse(b.input[0].content); delete input.contextRole; b.input[0].content = JSON.stringify(input);
  const raw = JSON.stringify(b), draft = record(); delete draft.input.contextRole;
  assert.throws(() => validateBilingualReferenceDraftV1(draft, assignment, pack, { parentRequestRaw: raw, parentRequestSha256: sha(raw) }), /REF4_NATURAL_CORRECTION/);
  assert.throws(() => validateBilingualReferenceDraftV1(record(), grammarAssignment, pack, binding()), /BRR1_PARENT_DOMAIN|BRR1_INTENT_ROLE/);
});
test('changed Korean, English, role or parent hash is rejected before a reference can inherit the frozen input', () => {
  for (const mutate of [d => { d.input.contextNote += ' 다른 뜻'; }, d => { d.input.sentence += ' changed'; }, d => { delete d.input.contextRole; }]) {
    const d = record(); mutate(d); assert.throws(() => validateBilingualReferenceDraftV1(d, assignment, pack, binding()), /BRR1_PARENT_INPUT_BINDING/);
  }
  assert.throws(() => validateBilingualReferenceDraftV1(record(), assignment, pack, { ...binding(), parentRequestSha256: '0'.repeat(64) }), /BRR1_PARENT_HASH/);
});
test('visible withholding permits pass, fail or uncertainty but never automatic unavailability or automatic qualification', () => {
  const draft = record(); draft.acceptedCorrectionExamples = []; draft.expectedOriginal = { meaningUsage: 'appropriate', grammar: 'needs_work', contextNeeded: 'message' };
  const item = { assignment, draft, sourcePack: pack };
  for (const state of ['pass', 'fail', 'uncertain']) { const g = partialGrade(); g.minimalCorrectionMeaning = state;
    const result = validateBilingualReferenceGradeV1(item, g); assert.equal(result.referenceQualified, false); assert.equal(result.grade.minimalCorrectionMeaning, state); }
  const unavailable = partialGrade(); unavailable.minimalCorrectionMeaning = 'unavailable';
  assert.throws(() => validateBilingualReferenceGradeV1(item, unavailable), /BRR1_WITHHOLDING_IS_OBSERVABLE/);
});
test('absent records remain unavailable; partial exposure cannot pass and invented corrections cannot support critical flags', () => {
  const absent = { ...positiveReferenceGradeV4(), ...Object.fromEntries(Object.keys(positiveReferenceGradeV4()).filter(k => k !== 'criticalErrors').map(k => [k, 'unavailable'])) };
  assert.equal(validateBilingualReferenceGradeV1({ draft: null }, absent).referenceQualified, false);
  assert.throws(() => validateBilingualReferenceGradeV1({ draft: null }, partialGrade()), /BRR1_ABSENT_RECORD/);
  const draft = record(), item = { assignment, draft, sourcePack: pack };
  assert.throws(() => validateBilingualReferenceGradeV1(item, positiveReferenceGradeV4()), /BRR1_EXPOSURE_EVIDENCE_REQUIRED/);
  draft.acceptedCorrectionExamples = []; const grade = partialGrade(); grade.criticalErrors.meaningConstraintViolation = true; grade.minimalCorrectionMeaning = 'fail';
  assert.throws(() => validateBilingualReferenceGradeV1(item, grade), /RR1_NO_INVENTED_REPAIR/);
});
