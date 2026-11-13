// Prospective English assessment boundary for the public controls.
import { digest } from './ai-quality-v147-calibration.mjs';
import { parseV3Json, validateV3Output } from './ai-quality-v147-wire-v3.mjs';
import {
  parseTargetMeaningPayloadV1,
  PRODUCT_RUBRIC_HASH_V6,
  TARGET_MEANING_FORMAT_V1,
  targetMeaningInstructionsV1,
  targetMeaningPolicyV1,
  validateTargetMeaningRequestV1,
} from './ai-quality-v147-target-meaning-v1.mjs';

const protocol = 'ai-quality-v147-target-meaning-v2';
const format = 'haru_target_meaning_v2';

function candidatePolicy(base) {
  const policy = structuredClone(base);
  policy.version = 7;
  policy.supersedesHash = PRODUCT_RUBRIC_HASH_V6;
  policy.targetMeaningProtocol = protocol;
  // Keep the source digest for provenance. The generation instruction belongs to the app.
  delete policy.canonicalTargetUsageInstruction;
  policy.dimensions.meaning = {
    question: 'Is the visible assessment of the original requested English target supported?',
    rule: 'For a word, judge the supplied lexical sense and part of speech in the original. A recognizable inflection error can coexist with correct lexical use. For a grammar lesson, judge the requested criterion, including any required form or agreement.',
    boundary: 'Evaluate the visible target-use claim on its linguistic evidence. A fragment can supply clear lexical evidence while leaving the intended message unknown. Use uncertain when essential evidence for the target claim is unresolved. Missing or wrong sense and derivation into the wrong part of speech can fail the target claim. Grade repair and handling of missing context on their own axes. The caller checks the app message gate separately in policyCompliance.',
  };
  return policy;
}

export const PRODUCT_RUBRIC_HASH_V7 = '38c5403537248ea6373cee6ccad8c70fb7227d5bed80d7519359c56ae9b1f85c';

function instructions() {
  const base = targetMeaningPolicyV1();
  const candidate = candidatePolicy(base);
  if (digest(candidate) !== PRODUCT_RUBRIC_HASH_V7) throw new Error('TM2_POLICY_HASH');
  const oldInstructions = targetMeaningInstructionsV1();
  const oldDimensions = JSON.stringify({ dimensions: base.dimensions, critical: base.criticalFlags });
  const oldPolicy = JSON.stringify(base);
  if (!oldInstructions.includes(oldDimensions) || !oldInstructions.includes(oldPolicy)) {
    throw new Error('TM2_BASE_POLICY');
  }
  return oldInstructions
    .replace(oldDimensions, JSON.stringify({ dimensions: candidate.dimensions, critical: candidate.criticalFlags }))
    .replace(oldPolicy, JSON.stringify(candidate))
    .replace('TRUSTED ENGLISH TARGET MEANING BOUNDARY V1', 'TRUSTED ENGLISH TARGET MEANING BOUNDARY V2');
}

function withPolicy(body, instruction, name, rubricHash) {
  body.instructions = instruction;
  body.text.format.name = name;
  body.text.format.schema.properties.productRubricHash = { type: 'string', enum: [rubricHash] };
  return JSON.stringify(body);
}

export function reviseTargetMeaningRequestV2(raw) {
  const body = validateTargetMeaningRequestV1(raw);
  const result = withPolicy(body, instructions(), format, PRODUCT_RUBRIC_HASH_V7);
  if (Buffer.byteLength(result) > 131072) throw new Error('TM2_REQUEST_SIZE');
  return result;
}

export function parseTargetMeaningPayloadV2({ requestRaw, payloadRaw }) {
  const body = parseV3Json(requestRaw, 131072);
  const hashSchema = body.text?.format?.schema?.properties?.productRubricHash;
  if (body.instructions !== instructions() || body.text?.format?.name !== format ||
      !hashSchema || digest(hashSchema) !== digest({ type: 'string', enum: [PRODUCT_RUBRIC_HASH_V7] })) {
    throw new Error('TM2_REQUEST_POLICY');
  }
  const payload = validateV3Output(requestRaw, payloadRaw);
  if (payload.productRubricHash !== PRODUCT_RUBRIC_HASH_V7) throw new Error('TM2_RESPONSE_POLICY');

  // Reuse the schema, critical flags and independent caller policy check from the existing parser.
  const result = parseTargetMeaningPayloadV1({
    requestRaw: withPolicy(body, targetMeaningInstructionsV1(), TARGET_MEANING_FORMAT_V1, PRODUCT_RUBRIC_HASH_V6),
    payloadRaw: JSON.stringify({ ...payload, productRubricHash: PRODUCT_RUBRIC_HASH_V6 }),
  });
  return { ...result, productRubricHash: PRODUCT_RUBRIC_HASH_V7, targetMeaningPolicyHash: PRODUCT_RUBRIC_HASH_V7 };
}
