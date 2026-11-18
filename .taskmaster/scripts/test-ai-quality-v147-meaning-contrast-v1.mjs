import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { CRITICAL, DIMENSIONS, JUDGES } from './ai-quality-v147-calibration.mjs';
import { inspectMeaningContrastV1, meaningContrastBudgetV1, prepareMeaningContrastV1 } from './ai-quality-v147-meaning-contrast-v1.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const evidence = resolve(manifest.baseline.existingDashboardRoot, 'outputs/ai-quality-v147-implementation-20261106');
const prepared = prepareMeaningContrastV1(evidence);
const { plan } = prepared;

test('Both versions see the same case, reference, layout, model and output cap in every pair', () => {
  assert.equal(plan.requests.length, 36);
  assert.equal(new Set(plan.requests.map(x => x.key)).size, 36);
  for (const model of JUDGES) {
    const v7 = plan.requests.filter(x => x.model === model && x.version === 7);
    assert.equal(v7.length, 6);
    assert.deepEqual(new Set(v7.map(x => x.layout)), new Set(['input-first', 'feedback-first']));
    for (const [left, right] of [['message-sentence', 'message-title'], ['inflection-word', 'inflection-grammar'], ['lexical-noun', 'lexical-derived']]) {
      assert.equal(v7.find(x => x.caseId === left).layout, v7.find(x => x.caseId === right).layout);
    }
    for (const request of v7) {
      const baseline = plan.requests.find(x => x.caseId === request.caseId && x.model === model && x.version === 6);
      assert.equal(request.layout, baseline.layout);
      const before = JSON.parse(baseline.requestRaw);
      const after = JSON.parse(request.requestRaw);
      assert.equal(after.max_output_tokens, 1024);
      assert.equal(JSON.parse(request.countRequestRaw).instructions, after.instructions);
      assert.deepEqual(JSON.parse(request.countRequestRaw).input, after.input);
      for (const { requestRaw } of [request, baseline]) {
        assert.ok(!requestRaw.includes(request.caseId));
        assert.ok(!requestRaw.includes('"expectedGrade":'));
        assert.ok(!requestRaw.includes('"hypotheses":'));
      }
      after.instructions = before.instructions;
      after.text.format.name = before.text.format.name;
      after.text.format.schema.properties.productRubricHash = before.text.format.schema.properties.productRubricHash;
      assert.equal(JSON.stringify(after), baseline.requestRaw);
    }
  }
  assert.equal(plan.liveDispatchAuthorized, false);
});

test('Reserve against both bound bodies and reject an over-limit, swapped or missing count', () => {
  const receipts = plan.requests.map(r => ({ key: r.key, requestSha256: r.requestSha256, countRequestSha256: r.countRequestSha256, inputTokens: 8000 }));
  assert.deepEqual(meaningContrastBudgetV1(prepared, receipts), { generationMicros: '3023592', countAllowanceMicros: '1260000', totalMicros: '4283592' });
  assert.throws(() => meaningContrastBudgetV1(prepared, receipts.slice(1)), /MC1_BUDGET_BINDING/);
  assert.throws(() => meaningContrastBudgetV1(prepared, [{ ...receipts[0], inputTokens: 8001 }, ...receipts.slice(1)]), /MC1_INPUT_BOUND/);
  assert.throws(() => meaningContrastBudgetV1(prepared, [{ ...receipts[0], requestSha256: receipts[1].requestSha256 }, ...receipts.slice(1)]), /MC1_INPUT_BOUND/);
});

test('Pairwise inspection reports the expected meaning and the separate caller policy without admitting the result', () => {
  const records = plan.requests.map(request => {
    const row = plan.hypotheses.find(x => x.id === request.caseId);
    const incomplete = row.id === 'message-sentence';
    const grade = Object.fromEntries(DIMENSIONS.map(d => [d, 'pass']));
    grade.meaning = incomplete && request.version === 6 ? 'fail' : row.meaning;
    grade.criticalErrors = Object.fromEntries(CRITICAL.map(f => [f, false]));
    return { key: request.key, requestRaw: request.requestRaw, payloadRaw: JSON.stringify({ grade, reasonCodes: ['confirmed'], productRubricHash: plan.rubricHashes[request.version], assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1, sourceAdequacy: 'sufficient', learnerContext: incomplete ? 'missing' : 'sufficient', abstentionNeed: incomplete ? 'required' : 'not_required' }) };
  });
  const outcome = inspectMeaningContrastV1(prepared, records);
  assert.deepEqual([outcome.baselineMatched, outcome.candidateMatched, outcome.pairedDenominator], [15, 18, 18]);
  assert.equal(outcome.messageBoundaryGains, 3);
  assert.equal(outcome.localMeaningRuleMet, true);
  assert.equal(outcome.sourceQualified, false);
  assert.equal(outcome.mainDispatchAuthorized, false);
  const fragment = outcome.pairs.filter(p => p.candidate.caseId === 'message-sentence');
  assert.equal(fragment.length, 3);
  assert.ok(fragment.every(p => p.candidate.meaningMatched && p.candidate.policyCompliance.state === 'fail'));
  assert.throws(() => inspectMeaningContrastV1(prepared, records.slice(1)), /MC1_DENOMINATOR/);
  assert.throws(() => inspectMeaningContrastV1(prepared, [{ ...records[0], requestRaw: records[1].requestRaw }, ...records.slice(1)]), /MC1_REQUEST_BINDING/);
});
