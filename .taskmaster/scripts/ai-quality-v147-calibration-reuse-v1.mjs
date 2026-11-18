import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseV3Json, validateV3Output } from './ai-quality-v147-wire-v3.mjs';
import { validateProductGradeV2 } from './ai-quality-v147-product-rubric-v2.mjs';

const sha = raw => createHash('sha256').update(raw).digest('hex');
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];

function checkCapture(capture, kind, index, raw) {
  assert.deepEqual([capture.kind, capture.index, capture.status, capture.persisted, capture.responseSha256],
    [kind, index, 200, true, sha(raw)], 'Archived response capture changed');
}

// A count/grade only travels with the original exact request and review seat.
// Changed requests deliberately carry no historical vote or measured count.
export function bindCalibrationEvidenceV1({ slot, currentFeedback, historical, index }) {
  const body = parseV3Json(slot.requestRaw, 131072);
  assert.equal(body.model, slot.model);
  assert.equal(sha(slot.requestRaw), slot.requestSha256);
  assert.equal(JSON.stringify(Object.fromEntries(countFields.map(key => [key, body[key]]))), slot.countRequestRaw);
  assert.equal(sha(slot.countRequestRaw), slot.countRequestSha256);
  const input = parseV3Json(body.input[0].content);
  const data = input.EVALUATION_DATA;
  assert.equal(data.feedback === null, currentFeedback === null, 'Public control availability changed');
  const originalFeedback = data.feedback;
  const seat = { key: slot.key, caseId: slot.privateBinding.witnessId, model: slot.model, layout: slot.layout };
  if (JSON.stringify(originalFeedback) !== JSON.stringify(currentFeedback)) {
    data.feedback = currentFeedback;
    body.input[0].content = JSON.stringify(input);
    const requestRaw = JSON.stringify(body);
    const countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(key => [key, body[key]])));
    return { ...seat, status: 'needs-new-count-and-review', requestRaw, countRequestRaw,
      requestSha256: sha(requestRaw), countRequestSha256: sha(countRequestRaw), dispatchEligible: false };
  }

  const { record, receipt, countCapture, modelCapture, countRaw, modelRaw } = historical;
  assert.equal(historical.requestRaw, slot.requestRaw, 'Archived model request changed');
  assert.equal(historical.countRequestRaw, slot.countRequestRaw, 'Archived count request changed');
  assert.deepEqual([record.key, record.requestRaw], [slot.key, slot.requestRaw]);
  assert.deepEqual([receipt.key, receipt.requestSha256, receipt.countRequestSha256],
    [slot.key, slot.requestSha256, slot.countRequestSha256], 'Archived count receipt changed');
  checkCapture(countCapture, 'count', index, countRaw);
  checkCapture(modelCapture, 'model', index, modelRaw);
  const count = parseV3Json(countRaw);
  const model = parseV3Json(modelRaw);
  assert.ok(Number.isSafeInteger(count.input_tokens) && count.input_tokens > 0);
  assert.deepEqual([count.object, count.input_tokens], ['response.input_tokens', receipt.inputTokens]);
  assert.deepEqual([model.status, model.model, model.id, model.usage.input_tokens],
    ['completed', slot.model, record.providerResponseId, count.input_tokens], 'Archived model identity or usage changed');
  const output = model.output.filter(row => row.type === 'message').flatMap(row => row.content)
    .filter(row => row.type === 'output_text').map(row => row.text);
  assert.deepEqual(output, [record.payloadRaw], 'Archived model payload changed');
  const vote = validateProductGradeV2(validateV3Output(slot.requestRaw, record.payloadRaw),
    { available: originalFeedback !== null });
  return { ...seat, status: 'unchanged-archived-evidence', requestSha256: slot.requestSha256,
    countRequestSha256: slot.countRequestSha256, countResponseSha256: countCapture.responseSha256,
    modelResponseSha256: modelCapture.responseSha256, inputTokens: count.input_tokens, vote, dispatchEligible: false };
}
