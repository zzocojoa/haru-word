import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { runSyntheticAssessmentBoundaryV1, SYNTHETIC_KEY } from './ai-quality-v147-assessment-boundary-collector-v1.mjs';
import { evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const fund = prepareEvaluationBudgetV3(source);
const live = evaluationBudgetContextV3(fund, 'evaluation');
const out = resolve(fund.root, 'outputs/ai-quality-v147-implementation-20261106');
const legacy = resolve(out, 'phase91/test-ec154ba1-6e63-425d-8ff8-58cecc4826bf/d27f9525-c67b-44e1-9959-f0a54e47e7a9/legacy');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const { plan } = read(resolve(out, 'phase96/prepared.json'));
const profileFile = resolve(source, '.taskmaster/docs/ai-quality-v147-assessment-boundary-budget-profile-v1.json');
const profile = read(profileFile);

function simulate({ kind, index, body, key }, scenario) {
  assert.equal(key, SYNTHETIC_KEY);
  const r = plan.requests[index];
  assert.equal(body, kind === 'count' ? r.countRequestRaw : r.requestRaw);
  if (kind === 'count') return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: scenario === 'limit' && index === 0 ? 8001 : 1000 }) };
  const row = plan.cases.find(x => x.id === r.caseId);
  const { repairContext, assignmentForm, ...grade } = structuredClone(row.expected);
  if (r.version === 7 && r.caseId === 'time-open') grade.grade.grammar = 'uncertain';
  const payload = { ...grade, ...(r.version === 8 ? { repairContext, assignmentForm } : {}), reasonCodes: ['confirmed'],
    productRubricHash: plan.rubricHashes[r.version], assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1 };
  const inputDetails = { cached_tokens: 0, cache_write_tokens: 1000 };
  if (scenario === 'unexpected-ttl' && index === 2) inputDetails.cache_write_tokens_details = { ttl_30m_tokens: 0, ttl_12h_tokens: 1000 };
  const raw = JSON.stringify({ id: 'resp_synthetic_boundary_' + index, model: r.model, service_tier: 'default', status: 'completed',
    usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100, input_tokens_details: inputDetails },
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] });
  return { status: 200, type: 'application/json', raw };
}

test('The actual budget profile accepts only the preregistered path without reserving', () => {
  const original = live.ledgerFiles.map(sha);
  const runtimeRoot = resolve(fund.root, 'outputs', profile.runtimeDirectoryName);
  const session = openEvaluationBudgetV3({ prepared: fund, context: live });
  try {
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: resolve(runtimeRoot, 'wrong') }), /EB3_RUNTIME_SCOPE/);
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot }), { code: 'ENOENT' });
    assert.deepEqual(live.ledgerFiles.map(sha), original);
  } finally { session.release(); }
});

for (const scenario of ['normal', 'limit', 'unexpected-ttl']) {
  test(`The reserved run settles safely in the ${scenario} scenario`, { timeout: 240000 }, async () => {
    const original = live.ledgerFiles.map(sha);
    const syntheticRoot = resolve(out, 'phase97', 't-' + randomUUID().slice(0, 12), 'fund');
    mkdirSync(syntheticRoot, { recursive: true });
    const runtime = resolve(syntheticRoot, 'runtime-' + profile.runId);
    const budget = resolve(syntheticRoot, 'budget-source.json');
    let keyReads = 0, inFlight = 0, peak = 0;
    const started = [];
    const run = () => runSyntheticAssessmentBoundaryV1({ legacy, syntheticRoot,
      loadKey: () => {
        assert.equal(read(budget).reservedMicros, '4283592');
        keyReads++;
        return SYNTHETIC_KEY;
      },
      transport: async request => {
        const { kind, index } = request;
        assert.ok(read(resolve(runtime, `${kind}-${index}-intent.json`)).consumedBeforeTransport);
        if (kind === 'model') assert.ok(existsSync(resolve(runtime, 'count-35-receipt.json')));
        started.push(`${kind}:${index}`);
        peak = Math.max(peak, ++inFlight);
        await new Promise(resolve => setImmediate(resolve));
        inFlight--;
        return simulate(request, scenario);
      },
    });
    const result = await run();
    const cases = {
      normal: [36, 36, '1560300', null], limit: [3, 0, '1260000', 'ABC1_COUNT_LIMIT'],
      'unexpected-ttl': [36, 3, '4283592', 'ABC1_UNEXPECTED_CACHE_TTL'],
    };
    assert.deepEqual([result.clientCountAttempts, result.clientModelAttempts, result.stageUsedUpperMicros, result.failureCode], cases[scenario]);
    assert.equal(peak, 3);
    assert.equal(started.length, result.clientCountAttempts + result.clientModelAttempts);
    if (scenario === 'normal') {
      assert.equal(result.inspection.candidatePasses, 18);
      assert.equal(result.inspection.improvements, 3);
      assert.equal(result.inspection.diagnosticImprovement, true);
      assert.equal(result.sourceQualified, false);
      assert.equal(result.mainDispatchAuthorized, false);
      await assert.rejects(run(), /ABC1_AVAILABLE/);
    }
    assert.equal(keyReads, 1);
    assert.equal(read(budget).reservedMicros, '0');
    assert.deepEqual(live.ledgerFiles.map(sha), original);
  });
}
