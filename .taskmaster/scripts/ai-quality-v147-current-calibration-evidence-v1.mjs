import assert from 'node:assert/strict';
import { bindCalibrationEvidenceV1 } from './ai-quality-v147-calibration-reuse-v1.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

// Bind the settled MC12 diagnostic to its exact current review seat. This
// supplies evidence only; it grants no calibration, dispatch or budget status.
export function bindCurrentMc12EvidenceV1({ slot, currentFeedback, diagnostic, index, scopeSha256 }) {
  const { terminal, archive } = diagnostic;
  assert.deepEqual([terminal.protocol, terminal.planHash, terminal.status, terminal.failureCode,
    terminal.lineage, terminal.actualProviderCalls, terminal.actualCountCalls,
    terminal.clientModelAttempts, terminal.clientCountAttempts, terminal.records.length, terminal.receipts.length],
  ['ai-quality-v147-current-mc12-collector-v1', scopeSha256, 'collected-current-mc', null,
    'after-settled-noor', 6, 6, 6, 6, 6, 6]);
  assert.equal(terminal.mainDispatchAuthorized, false);
  assert.equal(terminal.automaticRetry, false);
  assert.equal(terminal.automaticResume, false);
  assert.ok(Number.isSafeInteger(index) && index >= 0 && index < 6);
  assert.equal(slot.privateBinding.witnessId, 'MC12');
  const record = terminal.records[index], receipt = terminal.receipts[index];
  assert.deepEqual([record.key, record.model, record.layout, record.requestSha256],
    [slot.key, slot.model, slot.layout, slot.requestSha256], 'Diagnostic review seat changed');
  assert.ok(record.inspection?.vote, 'Diagnostic vote unavailable');
  const response = parseV3Json(archive.modelRaw), count = parseV3Json(archive.countRaw);
  assert.equal(response.service_tier, 'default');
  assert.deepEqual([response.id, response.usage.input_tokens, response.usage.output_tokens],
    [record.providerResponseId, record.inputTokens, record.outputTokens]);
  assert.equal(response.usage.total_tokens, response.usage.input_tokens + response.usage.output_tokens);
  assert.ok(record.outputTokens >= 0 && record.outputTokens <= 1024);
  assert.ok(count.input_tokens > 0 && count.input_tokens <= 8000);
  assert.equal(count.input_tokens, receipt.inputTokens);
  const text = response.output.filter(row => row.type === 'message').flatMap(row => row.content)
    .filter(row => row.type === 'output_text').map(row => row.text);
  assert.equal(text.length, 1);
  assert.deepEqual(parseV3Json(text[0]), record.inspection.vote, 'Diagnostic stored vote differs from original response');
  const bound = bindCalibrationEvidenceV1({ slot, currentFeedback, index, historical: {
    ...archive, receipt, record: { ...record, requestRaw: archive.requestRaw, payloadRaw: text[0] },
  } });
  if (bound.status === 'needs-new-count-and-review') return bound;
  return { ...bound, status: 'current-diagnostic-evidence',
    origin: { protocol: terminal.protocol, runId: terminal.runId, planHash: terminal.planHash,
      collectorPlanHash: terminal.collectorPlanHash, index }, fullCalibrationQualified: false };
}
