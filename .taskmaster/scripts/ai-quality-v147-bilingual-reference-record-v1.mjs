// Prospective reference-record validation, separate from product feedback grading.
// No transport, credentials, reference admission or changes to old v4 evidence.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateReferenceDraftV4, validateReferenceGradeV4, REFERENCE_DIMENSIONS, REFERENCE_CRITICAL } from './ai-quality-v147-reference-v4.mjs';
import { validateReferenceRubricConsistencyV1 } from './ai-quality-v147-reference-rubric-v1.mjs';

export const BILINGUAL_REFERENCE_RECORD_V1 = 'ai-quality-v147-bilingual-reference-record-v1';
const policySha = 'fb02988f3d4997aeb465cd5bfade2984077476ee47e1e4180c29c76f124ed833';
const sha = x => createHash('sha256').update(x).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('BRR1_' + code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export function loadBilingualReferencePolicyV1() {
  const bytes = readFileSync(new URL('../docs/ai-quality-v147-reference-operational-rubric-v2.json', import.meta.url));
  check(sha(bytes) === policySha, 'POLICY_HASH'); const policy = JSON.parse(bytes);
  check(policy.version === 2 && Object.keys(policy.dimensions).length === 7 && Object.keys(policy.criticalFlags).length === 5
    && !policy.independentQualification && !policy.englishTruthCertified && !policy.liveDispatchAuthorized, 'POLICY_BOUNDARY');
  return policy;
}

function parentInput(binding, domain) {
  check(binding && typeof binding.parentRequestRaw === 'string' && binding.parentRequestSha256 === sha(binding.parentRequestRaw), 'PARENT_HASH');
  const body = JSON.parse(binding.parentRequestRaw), input = JSON.parse(body.input?.[0]?.content);
  check(object(input) && typeof input.sentence === 'string' && input.sentence.length > 0 && input.sentence.length <= 2000, 'PARENT_INPUT');
  const required = domain === 'word' ? ['word', 'pos', 'meaning', 'expression'] : domain === 'grammar' ? ['target', 'targetCriterion'] : [];
  check(required.length > 0 && required.every(k => typeof input[k] === 'string'), 'PARENT_DOMAIN');
  check(input.contextRole === undefined || (domain === 'word' && input.contextRole === 'intended_korean' && typeof input.contextNote === 'string' && input.contextNote.trim().length > 0), 'INTENT_ROLE');
  return input;
}

export function validateBilingualReferenceDraftV1(draft, assignment, sourcePack, binding, exposureEvidence = null) {
  loadBilingualReferencePolicyV1();
  const parent = parentInput(binding, assignment.domain), role = parent.contextRole;
  check(object(draft?.input) && Object.keys(draft.input).every(k => ['sentence', 'contextKind', 'contextNote', 'contextRole'].includes(k)), 'INPUT_FIELDS');
  check(draft.input.sentence === parent.sentence && draft.input.contextKind === (parent.contextKind ?? 'sentence')
    && draft.input.contextNote === (parent.contextNote ?? '') && draft.input.contextRole === role, 'PARENT_INPUT_BINDING');
  check(object(draft.expectedOriginal) && Array.isArray(draft.acceptedCorrectionExamples) && draft.acceptedCorrectionExamples.length <= 2
    && draft.acceptedCorrectionExamples.every(x => typeof x === 'string' && x.isWellFormed() && x.trim().length >= 1 && x.length <= 2000), 'CORRECTION_SIZE');
  const actual = structuredClone(draft), projection = structuredClone(draft);
  delete projection.input.contextRole;
  const intended = assignment.domain === 'word' && role === 'intended_korean';
  // Old v4 still verifies assignment/source metadata, sizes, field sets, ordinary
  // grammar invariants and exposure bindings. This projection is never a review
  // packet or a semantic verdict: the actual examples below remain unchanged.
  const changedNatural = intended && actual.expectedOriginal.grammar === 'natural'
    && actual.acceptedCorrectionExamples.some(x => x !== actual.input.sentence);
  if (changedNatural) projection.acceptedCorrectionExamples = actual.acceptedCorrectionExamples.map(() => actual.input.sentence);
  validateReferenceDraftV4(projection, assignment, sourcePack, exposureEvidence);
  check(Buffer.byteLength(JSON.stringify(actual)) <= 16384, 'RECORD_SIZE');
  return { draft: actual, parentRequestSha256: binding.parentRequestSha256, explicitKoreanIntent: intended,
    structureVerified: true, semanticCorrectnessVerified: false, referenceRoleQualified: false, referenceQualified: false,
    mainDispatchAuthorized: false, structuralProjectionUsed: changedNatural };
}

export function validateBilingualReferenceGradeV1(item, grade, exposureEvidence = null) {
  loadBilingualReferencePolicyV1(); validateReferenceGradeV4(grade);
  if (item.draft === null) {
    check(REFERENCE_DIMENSIONS.every(k => grade[k] === 'unavailable') && REFERENCE_CRITICAL.every(k => !grade.criticalErrors[k]), 'ABSENT_RECORD');
  } else {
    validateReferenceRubricConsistencyV1(item, grade);
    if (item.draft.acceptedCorrectionExamples.length === 0) check(grade.minimalCorrectionMeaning !== 'unavailable', 'WITHHOLDING_IS_OBSERVABLE');
    if (exposureEvidence === null) check(grade.exposureAndFamilyCompliance !== 'pass', 'EXPOSURE_EVIDENCE_REQUIRED');
  }
  return { grade: structuredClone(grade), protocol: BILINGUAL_REFERENCE_RECORD_V1, semanticCorrectnessVerified: false,
    referenceRoleQualified: false, referenceQualified: false, mainDispatchAuthorized: false };
}
