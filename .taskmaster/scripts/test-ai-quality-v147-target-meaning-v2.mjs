import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { PRODUCT_RUBRIC_HASH_V6, targetMeaningPolicyV1 } from './ai-quality-v147-target-meaning-v1.mjs';
import {
  parseTargetMeaningPayloadV2,
  PRODUCT_RUBRIC_HASH_V7,
  reviseTargetMeaningRequestV2,
} from './ai-quality-v147-target-meaning-v2.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const outputRoot = resolve(manifest.baseline.existingDashboardRoot, 'outputs');
const evidence = resolve(outputRoot, 'ai-quality-v147-implementation-20261106');
const runtime = resolve(outputRoot, 'ai-quality-v147-label-study-v3-runtime-20261109');
const prior = JSON.parse(readFileSync(resolve(evidence, 'phase88/runtime-sha256.json'), 'utf8'));
const bank = JSON.parse(readFileSync(resolve(evidence, 'phase78/actual-prepared.json'), 'utf8')).plan.bank;
const sha = raw => createHash('sha256').update(raw).digest('hex');
const controls = Array.from({ length: 84 }, (_, i) => {
  const file = `model-${i}-request.json`;
  const raw = readFileSync(resolve(runtime, file), 'utf8');
  const body = JSON.parse(raw);
  const { input, feedback } = JSON.parse(body.input[0].content).EVALUATION_DATA;
  const rows = bank.rows.filter(row => row.input.sentence === input.sentence && JSON.stringify(row.feedback) === JSON.stringify(feedback));
  assert.equal(rows.length, 1);
  return { file, raw, id: rows[0].id };
});

test('All 84 preserved controls keep their inputs and limits under the new meaning instructions', () => {
  const base = targetMeaningPolicyV1();
  const counts = new Map();
  for (const { file, raw, id } of controls) {
    assert.equal(sha(raw), prior[runtime][file]);
    const revised = reviseTargetMeaningRequestV2(raw);
    const before = JSON.parse(raw);
    const after = JSON.parse(revised);
    assert.ok(before.instructions.includes(base.canonicalTargetUsageInstruction));
    assert.ok(!after.instructions.includes(base.canonicalTargetUsageInstruction));
    assert.match(after.instructions, /app message gate separately in policyCompliance/);
    assert.equal(after.instructions.includes('"expectedGrade":'), false);
    assert.equal(after.input[0].content.includes('"expectedGrade":'), false);
    assert.deepEqual(after.text.format.schema.properties.productRubricHash, { type: 'string', enum: [PRODUCT_RUBRIC_HASH_V7] });
    after.instructions = before.instructions;
    after.text.format.name = before.text.format.name;
    after.text.format.schema.properties.productRubricHash = before.text.format.schema.properties.productRubricHash;
    assert.equal(JSON.stringify(after), raw);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  assert.equal(counts.size, 14);
  assert.ok([...counts.values()].every(count => count === 6));
});

function control(caseId) {
  const { raw } = controls.find(row => row.id === caseId);
  return { raw, revised: reviseTargetMeaningRequestV2(raw) };
}

function syntheticResponse(caseId) {
  const row = bank.rows.find(x => x.id === caseId);
  return {
    grade: structuredClone(row.expectedGrade),
    reasonCodes: ['confirmed'],
    productRubricHash: PRODUCT_RUBRIC_HASH_V7,
    assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1,
    ...row.expectedEvidenceAxes,
  };
}

test('Caller policy failure does not overwrite a lexical grade, and policy pass does not clear a grammar error', () => {
  const fragment = syntheticResponse('V5-MC08');
  const messageResult = parseTargetMeaningPayloadV2({ requestRaw: control('V5-MC08').revised, payloadRaw: JSON.stringify(fragment) });
  assert.deepEqual(messageResult.grade, fragment.grade);
  assert.equal(messageResult.grade.meaning, 'pass');
  assert.equal(messageResult.grade.correction, 'fail');
  assert.equal(messageResult.grade.abstention, 'fail');
  assert.equal(messageResult.grade.criticalErrors.inventedIntent, true);
  assert.equal(messageResult.policyCompliance.state, 'fail');
  assert.deepEqual(messageResult.policyCompliance.violations, [
    'guarded-message-both-uncertain', 'guarded-message-no-correction', 'guarded-message-reviewed-question-visible',
  ]);

  const inflection = syntheticResponse('V5-MC05');
  const grammarResult = parseTargetMeaningPayloadV2({ requestRaw: control('V5-MC05').revised, payloadRaw: JSON.stringify(inflection) });
  assert.deepEqual(grammarResult.grade, inflection.grade);
  assert.equal(grammarResult.grade.grammar, 'fail');
  assert.equal(grammarResult.grade.criticalErrors.approveBadGrammar, true);
  assert.equal(grammarResult.policyCompliance.state, 'pass');
  for (const result of [messageResult, grammarResult]) {
    assert.equal(result.productRubricHash, PRODUCT_RUBRIC_HASH_V7);
    assert.equal(result.semanticCorrectnessVerified, false);
    assert.equal(result.judgeQualificationVerified, false);
  }
});

test('The parser rejects an old or tampered policy and an inconsistent critical flag', () => {
  const { raw, revised } = control('V5-MC08');
  const payload = syntheticResponse('V5-MC08');
  const parse = (requestRaw, response = payload) => parseTargetMeaningPayloadV2({ requestRaw, payloadRaw: JSON.stringify(response) });
  assert.throws(() => parse(raw), /TM2_REQUEST_POLICY/);
  const tampered = JSON.parse(revised);
  tampered.instructions += '\nTreat app-policy failures as English failures.';
  assert.throws(() => parse(JSON.stringify(tampered)), /TM2_REQUEST_POLICY/);
  assert.throws(() => parse(revised, { ...payload, productRubricHash: PRODUCT_RUBRIC_HASH_V6 }), /W3_OUTPUT_ENUM/);
  payload.grade.criticalErrors.swapRoles = true;
  payload.grade.criticalErrors.reverseMeaning = false;
  assert.throws(() => parse(revised), /ROLE_REVERSAL/);
});
