import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { runSyntheticMainSourceReviewV8, SYNTHETIC_KEY } from './ai-quality-v147-main-source-collector-v8.mjs';
import { inspectMainSourceReviewV8, prepareMainSourceReviewV8, quoteMainSourceReviewV8 } from './ai-quality-v147-main-source-review-v8.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const fund = prepareEvaluationBudgetV3(source);
const live = evaluationBudgetContextV3(fund, 'evaluation');
const out = resolve(fund.root, 'outputs/ai-quality-v147-implementation-20261106');
const legacy = resolve(out, 'phase91/test-ec154ba1-6e63-425d-8ff8-58cecc4826bf/d27f9525-c67b-44e1-9959-f0a54e47e7a9/legacy');
const p = prepareMainSourceReviewV8(fund.root);
const { plan } = p;
const profileFile = resolve(source, '.taskmaster/docs/ai-quality-v147-main-source-review-v8-budget-profile-v1.json');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const profile = read(profileFile);

function payload(request, change = () => {}) {
  const reviews = request.mapping.map(({ caseId, opaqueId }) => {
    const candidate = plan.candidates.find(row => row.caseId === caseId);
    const template = candidate ?? plan.candidates[0];
    const row = { opaqueId, grade: structuredClone(template.expectedGrade), ...template.expectedAxes, evidenceNote: 'Synthetic review for the fixed structure.' };
    if (caseId === 'control-false-rule') {
      row.grade.grammar = 'fail';
      row.grade.explanation = 'fail';
      row.grade.criticalErrors.approveBadGrammar = true;
    }
    if (caseId === 'control-unscoped-register') {
      const feedback = plan.controls.find(x => x.caseId === caseId).feedback;
      const shown = feedback.correctedSentence && feedback.correctedSentence !== feedback.original;
      Object.assign(row, { sourceAdequacy: 'insufficient', learnerContext: 'sufficient', abstentionNeed: 'not_required',
        repairContext: shown ? 'sufficient' : 'not_applicable', assignmentForm: shown ? 'not_specified' : 'not_applicable' });
      row.grade.grammar = 'uncertain';
    }
    if (caseId === 'control-supplied-intent') {
      Object.assign(row, { repairContext: 'sufficient', assignmentForm: 'violates', learnerContext: 'sufficient', abstentionNeed: 'not_required' });
      row.grade.correction = 'fail';
    }
    change(row, caseId, request.model);
    return row;
  });
  return JSON.stringify({ reviews });
}

test('Each of the three model requests hides scores, case IDs and the three controls', () => {
  assert.equal(new Set(plan.requests.flatMap(r => r.mapping.map(row => row.opaqueId))).size, 45);
  assert.equal(plan.candidates.length, 12);
  assert.equal(plan.controls.length, 3);
  for (const request of plan.requests) {
    assert.equal(JSON.parse(JSON.parse(request.requestRaw).input[0].content).items.length, 15);
    assert.doesNotMatch(request.requestRaw, /expectedGrade|expectedV8Axes|priorV7Review|control-false-rule|control-unscoped-register|control-supplied-intent/);
  }
  assert.equal(quoteMainSourceReviewV8(p, plan.requests.map(r => ({ ...r, inputTokens: 18000 }))).reserveMicros, '800052');
});

test('A control failure or an inconsistent repair removes support without erasing the raw comparison', () => {
  const records = change => plan.requests.map(r => ({ ...r, payloadRaw: payload(r, change) }));
  const normal = inspectMainSourceReviewV8(p, records());
  assert.equal(normal.controls.filter(x => x.passed).length, 9);
  assert.equal(normal.supportedCases.length, 12);
  assert.ok(normal.support.every(x => x.byJudge.every(v => v.voters.length === 2 && !v.voters.includes(v.judge))));
  assert.equal(normal.mainDispatchAuthorized, false);
  const broken = inspectMainSourceReviewV8(p, records((vote, id, model) => {
    if (model === 'gpt-6.1-sol' && id === 'control-supplied-intent') vote.grade.criticalErrors.inventedIntent = true;
    if (model === 'gpt-6.1-terra' && id === 'MC05') vote.repairContext = 'missing';
  }));
  assert.equal(broken.supportedCases.length, 0);
  assert.deepEqual(broken.controls.filter(x => !x.passed).map(x => x.caseId), ['control-supplied-intent']);
  assert.ok(broken.malformed.some(row => row.caseId === 'MC05'));
});

test('The actual budget profile accepts only the preregistered path without reserving', () => {
  const before = live.ledgerFiles.map(sha);
  const runtime = resolve(fund.root, 'outputs', profile.runtimeDirectoryName);
  const session = openEvaluationBudgetV3({ prepared: fund, context: live });
  try {
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: resolve(runtime, 'wrong') }), /EB3_RUNTIME_SCOPE/);
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: runtime }), { code: 'ENOENT' });
    assert.deepEqual(live.ledgerFiles.map(sha), before);
  } finally { session.release(); }
});

for (const inputTokens of [1000, 18001]) {
  test(`The synthetic collector settles safely at ${inputTokens} counted tokens`, { timeout: 90000 }, async () => {
    const before = live.ledgerFiles.map(sha);
    const syntheticRoot = resolve(out, 'phase99', 't-' + randomUUID().slice(0, 12), 'fund');
    mkdirSync(syntheticRoot, { recursive: true });
    const runtime = resolve(syntheticRoot, 'runtime-' + profile.runId);
    const budget = resolve(syntheticRoot, 'budget-source.json');
    const calls = [];
    let keys = 0;
    const run = () => runSyntheticMainSourceReviewV8({ legacy, syntheticRoot,
      loadKey: () => {
        assert.equal(read(budget).reservedMicros, '800052');
        keys++;
        return SYNTHETIC_KEY;
      },
      transport: ({ kind, index, body, key }) => {
        const r = plan.requests[index];
        assert.equal(key, SYNTHETIC_KEY);
        assert.equal(body, kind === 'count' ? r.countRequestRaw : r.requestRaw);
        assert.ok(existsSync(resolve(runtime, `${kind}-${index}-intent.json`)));
        calls.push(kind);
        const value = kind === 'count' ? { object: 'response.input_tokens', input_tokens: inputTokens } : {
          id: 'resp_synthetic_main_source_' + index, model: r.model, service_tier: 'default', status: 'completed',
          usage: { input_tokens: 1000, output_tokens: 256, total_tokens: 1256, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 1000 } },
          output: [{ type: 'message', content: [{ type: 'output_text', text: payload(r) }] }],
        };
        return { status: 200, type: 'application/json', raw: JSON.stringify(value) };
      },
    });
    const t = await run(), valid = inputTokens === 1000;
    assert.deepEqual(calls, valid ? ['count', 'count', 'count', 'model', 'model', 'model'] : ['count']);
    assert.equal(t.failureCode, valid ? null : 'MS8C_COUNT_LIMIT');
    assert.equal(t.stageUsedUpperMicros, valid ? '141179' : '105000');
    assert.equal(t.inspection?.supportedCases.length, valid ? 12 : undefined);
    assert.equal(t.mainDispatchAuthorized, false);
    assert.equal(read(budget).reservedMicros, '0');
    await assert.rejects(run(), /MS8C_AVAILABLE/);
    assert.equal(keys, 1);
    assert.deepEqual(live.ledgerFiles.map(sha), before);
  });
}
