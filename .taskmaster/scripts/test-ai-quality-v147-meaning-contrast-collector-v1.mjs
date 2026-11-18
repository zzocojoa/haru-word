import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { CRITICAL, DIMENSIONS } from './ai-quality-v147-calibration.mjs';
import { evaluationBudgetContextV2, openEvaluationBudgetV2, prepareEvaluationBudgetV2 } from './ai-quality-v147-evaluation-budget-v2.mjs';
import { evaluationBudgetContextV3, openEvaluationBudgetV3, reconcileEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { meaningContrastRuntimeRootV1, prepareMeaningContrastCollectorV1, runSyntheticMeaningContrastV1, SYNTHETIC_KEY } from './ai-quality-v147-meaning-contrast-collector-v1.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const p = prepareMeaningContrastCollectorV1(source);
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, value) => writeFileSync(file, JSON.stringify(value) + '\n', { flag: 'wx' });
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const out = resolve(p.root, 'outputs/ai-quality-v147-implementation-20261106/phase91', 'test-' + randomUUID());
mkdirSync(out);
const v2 = prepareEvaluationBudgetV2(source);
const realV2 = evaluationBudgetContextV2(v2, 'evaluation');
const basis = read(resolve(source, '.taskmaster/docs/ai-quality-v147-budget-v3-reconciliation-basis-v1.json'));

function fixture() {
  const dir = resolve(out, randomUUID());
  mkdirSync(dir);
  const legacy = resolve(dir, 'legacy');
  mkdirSync(legacy);
  const context = evaluationBudgetContextV2(v2, 'synthetic', legacy);
  const session = openEvaluationBudgetV2({ prepared: v2, context });
  try {
    session.initialize();
    for (const row of JSON.parse(basis.baselineV2LedgerRaw).allocations) {
      const scope = read(resolve(realV2.directory, 'scope-profile-' + row.runId + '.json'));
      const profileFile = resolve(legacy, 'scope-input-' + row.runId + '.json');
      const runtimeRoot = resolve(legacy, 'runtime-' + row.runId);
      write(profileFile, scope);
      mkdirSync(runtimeRoot);
      session.reserve({ profileFile, collectorPlanHash: row.collectorPlanHash, runtimeRoot });
      const held = row.state === 'held';
      const runtimeTerminalFile = resolve(runtimeRoot, 'terminal.json');
      write(runtimeTerminalFile, {
        protocol: scope.collectorProtocol, planHash: scope.studyPlanHash, collectorPlanHash: row.collectorPlanHash,
        stageUsedUpperMicros: row.usedUpperMicros, countAllowanceRetainedMicros: scope.countAllowanceMicros,
        status: held ? 'held' : scope.successStatus, automaticRetry: false, automaticResume: false,
        clientModelAttempts: held ? 0 : scope.expectedModelCalls, clientCountAttempts: held ? 0 : scope.expectedCountCalls,
        records: held ? [] : Array(scope.expectedModelCalls).fill({ synthetic: true }),
        receipts: held ? [] : Array(scope.expectedCountCalls).fill({ synthetic: true }),
      });
      session.settle({ runId: row.runId, runtimeTerminalFile, usedUpperMicros: row.usedUpperMicros, held });
    }
  } finally { session.release(); }
  reconcileEvaluationBudgetV3({ sourceRoot: source, syntheticLegacyRoot: legacy });
  const prepared = prepareMeaningContrastCollectorV1(source, 'synthetic', legacy);
  const budgetRoot = resolve(dir, 'fund');
  mkdirSync(budgetRoot);
  return { prepared, budgetRoot };
}

function fake({ kind, index, requestRaw }, inputTokens = 1000, used = 1250) {
  const r = p.plan.requests[index];
  const row = p.study.plan.hypotheses.find(x => x.id === r.caseId);
  const incomplete = row.id === 'message-sentence';
  const grade = Object.fromEntries(DIMENSIONS.map(d => [d, 'pass']));
  grade.meaning = incomplete && r.version === 6 ? 'fail' : row.meaning;
  grade.criticalErrors = Object.fromEntries(CRITICAL.map(f => [f, false]));
  const payload = {
    grade, reasonCodes: ['confirmed'], productRubricHash: p.study.plan.rubricHashes[r.version],
    assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1, sourceAdequacy: 'sufficient',
    learnerContext: incomplete ? 'missing' : 'sufficient', abstentionNeed: incomplete ? 'required' : 'not_required',
  };
  const response = kind === 'count' ? { object: 'response.input_tokens', input_tokens: inputTokens } : {
    id: 'resp_synthetic_contrast_' + index, model: JSON.parse(requestRaw).model, service_tier: 'default', status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
    usage: { input_tokens: used, output_tokens: 256, total_tokens: used + 256, input_tokens_details: { cached_tokens: 0 } },
  };
  return { status: 200, contentType: 'application/json', responseRaw: JSON.stringify(response) };
}

test('The actual budget accepts the preregistered path up to the missing runtime check without reserving', () => {
  const context = evaluationBudgetContextV3(p.recovery, 'evaluation');
  const before = context.ledgerFiles.map(sha);
  const session = openEvaluationBudgetV3({ prepared: p.recovery, context });
  try {
    const profileFile = resolve(source, '.taskmaster/docs/ai-quality-v147-meaning-contrast-budget-profile-v1.json');
    const runtimeRoot = meaningContrastRuntimeRootV1(p, context);
    assert.ok(!existsSync(runtimeRoot));
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: p.hash, runtimeRoot: resolve(runtimeRoot, 'wrong') }), /EB3_RUNTIME_SCOPE/);
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: p.hash, runtimeRoot }), e => e.code === 'ENOENT');
    assert.equal(session.current().reservedMicros, '0');
    assert.ok(!existsSync(resolve(context.directory, 'allocation-intent-' + p.plan.runId + '.json')));
    assert.deepEqual(context.ledgerFiles.map(sha), before);
  } finally { session.release(); }
});

test('All 36 counts precede generation, the grant settles, and the same run cannot be sent again', { timeout: 360000 }, async () => {
  const f = fixture();
  let keys = 0;
  const run = () => runSyntheticMeaningContrastV1({ ...f,
    loadExistingKey: () => {
      keys++;
      assert.equal(read(resolve(f.budgetRoot, 'budget-source.json')).reservedMicros, '4283592');
      return SYNTHETIC_KEY;
    },
    transport: x => {
      if (x.kind === 'model') assert.ok(existsSync(resolve(f.budgetRoot, 'runtime-' + p.plan.runId, 'count-35-receipt.json')));
      return fake(x);
    },
  });
  const result = await run();
  assert.equal(result.failureCode, null);
  assert.deepEqual([result.clientCountAttempts, result.clientModelAttempts, keys], [36, 36, 1]);
  assert.deepEqual([result.actualCountApiCalls, result.actualProviderCalls, result.actualKeyReads], [0, 0, 0]);
  assert.equal(result.inspection.pairedDenominator, 18);
  assert.equal(result.inspection.localMeaningRuleMet, true);
  assert.ok(result.records.every(record => record.inputCountDelta === 250));
  assert.equal(result.cacheAccounting.fallbackCode, 'CR1_CACHE_COST_USAGE');
  assert.equal(result.cacheAccounting.fullReservationRetained, true);
  assert.equal(result.stageUsedUpperMicros, '4283592');
  assert.equal(read(resolve(f.budgetRoot, 'budget-source.json')).reservedMicros, '0');
  await assert.rejects(run(), /GRANT_AVAILABLE/);
  assert.equal(keys, 1);
});

test('An over-limit count halts before generation and retains only the approved count provision', { timeout: 360000 }, async () => {
  const f = fixture();
  const result = await runSyntheticMeaningContrastV1({ ...f, loadExistingKey: () => SYNTHETIC_KEY, transport: x => fake(x, 8001) });
  assert.equal(result.failureCode, 'MCC1_COUNT_LIMIT');
  assert.deepEqual([result.clientCountAttempts, result.clientModelAttempts, result.records.length], [1, 0, 0]);
  assert.equal(result.stageUsedUpperMicros, '1260000');
  assert.equal(result.receipts[0].inputTokens, 8001);
  assert.equal(read(resolve(f.budgetRoot, 'budget-source.json')).reservedMicros, '0');
});
