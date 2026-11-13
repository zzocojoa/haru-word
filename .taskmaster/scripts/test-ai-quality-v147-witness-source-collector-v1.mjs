import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { runSyntheticWitnessSourceReviewV1, SYNTHETIC_KEY } from './ai-quality-v147-witness-source-collector-v1.mjs';
import { prepareWitnessSourceReviewV1 } from './ai-quality-v147-witness-source-review-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const fund = prepareEvaluationBudgetV3(source);
const plan = prepareWitnessSourceReviewV1(fund.root).plan;
const live = evaluationBudgetContextV3(fund, 'evaluation');
const profileFile = resolve(source, '.taskmaster/docs/ai-quality-v147-witness-source-budget-profile-v1.json');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const profile = read(profileFile);
const evidence = resolve(fund.root, 'outputs/ai-quality-v147-implementation-20261106');
const legacy = resolve(evidence, 'phase91/test-ec154ba1-6e63-425d-8ff8-58cecc4826bf/d27f9525-c67b-44e1-9959-f0a54e47e7a9/legacy');

function fake({ kind, index, body, key }, inputTokens) {
  const request = plan.requests[index];
  assert.equal(key, SYNTHETIC_KEY);
  assert.equal(body, kind === 'count' ? request.countRequestRaw : request.requestRaw);
  if (kind === 'count') {
    return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: inputTokens }) };
  }
  const reviews = request.mapping.map(({ opaqueId, caseId }) => {
    const seed = plan.candidates.find(x => x.caseId === caseId) ?? plan.candidates[0];
    const vote = { opaqueId, grade: structuredClone(seed.expectedGrade), ...seed.expectedAxes, evidenceNote: 'Synthetic vote.' };
    if (caseId === 'control-false-rule') {
      vote.grade.explanation = 'fail';
      vote.grade.grammar = 'fail';
      vote.grade.criticalErrors.approveBadGrammar = true;
    }
    if (caseId === 'control-unscoped-register') {
      vote.grade.grammar = 'uncertain';
      vote.sourceAdequacy = 'conflicting';
    }
    return vote;
  });
  const value = {
    id: 'resp_synthetic_witness_' + index, status: 'completed', model: request.model, service_tier: 'default',
    usage: { input_tokens: 1250, output_tokens: 256, total_tokens: 1506, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } },
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ reviews }) }] }],
  };
  return { status: 200, type: 'application/json', raw: JSON.stringify(value) };
}

test('The live profile checks the exact runtime directory without reserving or reading a key', () => {
  const before = live.ledgerFiles.map(sha);
  const runtime = resolve(fund.root, 'outputs', profile.runtimeDirectoryName);
  const session = openEvaluationBudgetV3({ prepared: fund, context: live });
  try {
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: resolve(runtime, 'wrong') }), /EB3_RUNTIME_SCOPE/);
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: runtime }), { code: 'ENOENT' });
    assert.equal(session.current().reservedMicros, '0');
    assert.ok(!existsSync(resolve(live.directory, 'allocation-intent-' + profile.runId + '.json')));
    assert.deepEqual(live.ledgerFiles.map(sha), before);
  } finally { session.release(); }
});

for (const inputTokens of [1000, 18001]) {
  test(`The synthetic collector settles safely with input count ${inputTokens}`, { timeout: 120000 }, async () => {
    const before = live.ledgerFiles.map(sha);
    const syntheticRoot = resolve(evidence, 'phase95', 't-' + randomUUID().slice(0, 12), 'fund');
    mkdirSync(syntheticRoot, { recursive: true });
    const runtime = resolve(syntheticRoot, 'runtime-' + profile.runId);
    const calls = [];
    let keys = 0;
    const run = () => runSyntheticWitnessSourceReviewV1({ legacy, syntheticRoot,
      loadKey: () => {
        assert.equal(read(resolve(syntheticRoot, 'budget-source.json')).reservedMicros, '800052');
        assert.ok(existsSync(resolve(runtime, 'grant-reservation.json')));
        keys++;
        return SYNTHETIC_KEY;
      },
      transport: request => {
        const { kind, index } = request;
        const intent = read(resolve(runtime, `${kind}-${index}-intent.json`));
        assert.equal(intent.consumedBeforeTransport, true);
        calls.push(kind);
        return fake(request, inputTokens);
      },
    });
    const result = await run();
    const withinLimit = inputTokens === 1000;
    assert.equal(keys, 1);
    assert.deepEqual(calls, withinLimit ? ['count', 'count', 'count', 'model', 'model', 'model'] : ['count']);
    assert.equal(result.status, withinLimit ? profile.successStatus : 'held', result.failureCode);
    assert.equal(result.failureCode, withinLimit ? null : 'WSC1_COUNT_LIMIT');
    assert.equal(result.stageUsedUpperMicros, withinLimit ? '141179' : '105000');
    assert.equal(result.inspection?.passedAcrossJudges, withinLimit ? 12 : undefined);
    assert.equal(result.sourceQualified, false);
    assert.equal(result.mainDispatchAuthorized, false);
    assert.equal(read(resolve(syntheticRoot, 'budget-source.json')).reservedMicros, '0');
    assert.equal(read(resolve(syntheticRoot, 'budget-root.json')).allocations[0].state, withinLimit ? 'settled' : 'held');
    await assert.rejects(run(), /WSC1_AVAILABLE/);
    assert.equal(keys, 1);
    assert.deepEqual(live.ledgerFiles.map(sha), before);
  });
}
