import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { inspectWitnessSourceReviewV1, prepareWitnessSourceReviewV1, quoteWitnessSourceReviewV1 } from './ai-quality-v147-witness-source-review-v1.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const p = prepareWitnessSourceReviewV1(resolve(manifest.baseline.existingDashboardRoot));
const { plan } = p;
function mockRecords(mutate = () => {}) {
  return plan.requests.map(request => {
    const reviews = request.mapping.map(({ opaqueId, caseId }) => {
      const row = plan.candidates.find(x => x.caseId === caseId);
      const seed = row ?? plan.candidates.find(x => x.caseId === 'MC01');
      const vote = { opaqueId, grade: structuredClone(seed.expectedGrade), ...seed.expectedAxes, evidenceNote: 'Synthetic vote for structural verification.' };
      if (caseId === 'control-false-rule') {
        vote.grade.explanation = 'fail';
        vote.grade.grammar = 'fail';
        vote.grade.criticalErrors.approveBadGrammar = true;
      }
      if (caseId === 'control-unscoped-register') {
        vote.grade.grammar = 'uncertain';
        vote.sourceAdequacy = 'conflicting';
      }
      mutate(vote, caseId, request.model);
      return vote;
    });
    return { key: request.key, requestRaw: request.requestRaw, payloadRaw: JSON.stringify({ reviews }) };
  });
}

test('All 12 witnesses and two controls use model-specific aliases with private judgments omitted', () => {
  assert.equal(plan.candidates.length, 12);
  assert.equal(plan.controls.length, 2);
  assert.equal(plan.requests.length, 3);
  const allIds = plan.requests.flatMap(x => x.mapping.map(y => y.opaqueId));
  assert.equal(new Set(allIds).size, 42);
  for (const r of plan.requests) {
    const raw = JSON.parse(r.requestRaw), items = JSON.parse(raw.input[0].content).items;
    assert.equal(items.length, 14);
    assert.deepEqual(items.map(x => x.opaqueId), r.mapping.map(x => x.opaqueId));
    assert.ok(items.every(x => Object.keys(x).sort().join() === 'feedback,input,opaqueId,sources'));
    assert.doesNotMatch(r.requestRaw, /expectedGrade|expectedAxes|caseId|control-unscoped-register|control-false-rule/);
    assert.deepEqual(JSON.parse(r.countRequestRaw), Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(k => [k, raw[k]])));
  }
});

test('A review can support the source hypothesis with two other models but cannot enable dispatch', () => {
  const report = inspectWitnessSourceReviewV1(p, mockRecords());
  assert.equal(report.passedAcrossJudges, 12);
  assert.equal(report.controls.filter(x => x.passed).length, 6);
  assert.ok(report.support.every(row => row.byJudge.every(x => x.voters.length === 2 && !x.voters.includes(x.judge))));
  assert.equal(report.support.find(x => x.caseId === 'MC08').appPolicy.state, 'fail');
  assert.equal(report.sourceQualified, false);
  assert.equal(report.mainDispatchAuthorized, false);
});

test('A reviewer who misses a control cannot clear a case, and a source disagreement is kept visible', () => {
  const report = inspectWitnessSourceReviewV1(p, mockRecords((vote, id, model) => {
    if (model === 'gpt-6.1-terra' && id === 'control-unscoped-register') vote.sourceAdequacy = 'sufficient';
    if (model === 'gpt-6-astra' && id === 'MC05') vote.sourceAdequacy = 'insufficient';
  }));
  assert.equal(report.passedAcrossJudges, 0);
  assert.deepEqual(report.controls.filter(x => !x.passed).map(x => x.model), ['gpt-6.1-terra']);
  assert.deepEqual(report.disagreements.map(x => [x.caseId, x.model, x.axes]), [['MC05', 'gpt-6-astra', ['sourceAdequacy']]]);
  assert.equal(report.support.find(x => x.caseId === 'MC05').byJudge.filter(x => x.supported).length, 0);
});

test('Wrong aliases, missing batches and out-of-scope token receipts are rejected', () => {
  const records = mockRecords();
  assert.throws(() => inspectWitnessSourceReviewV1(p, records.slice(1)), /WSR1_DENOMINATOR/);
  const payload = JSON.parse(records[0].payloadRaw);
  payload.reviews[0].opaqueId = payload.reviews[1].opaqueId;
  assert.throws(() => inspectWitnessSourceReviewV1(p, [{ ...records[0], payloadRaw: JSON.stringify(payload) }, ...records.slice(1)]), /WSR1_ALIASES/);
  const counts = plan.requests.map(x => ({ ...x, inputTokens: 18000 }));
  assert.equal(quoteWitnessSourceReviewV1(p, counts).reserveMicros, '800052');
  assert.throws(() => quoteWitnessSourceReviewV1(p, [{ ...counts[0], inputTokens: 18001 }, ...counts.slice(1)]), /WSR1_TOKEN_LIMIT/);
});
