import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { runSyntheticRenderedReviewV1, SYNTHETIC_KEY } from './ai-quality-v147-rendered-review-collector-v1.mjs';
import { inspectRenderedReviewV1, prepareRenderedReviewV1, quoteRenderedReviewV1 } from './ai-quality-v147-rendered-review-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const fund = prepareEvaluationBudgetV3(source);
const live = evaluationBudgetContextV3(fund, 'evaluation');
const out = resolve(fund.root, 'outputs/ai-quality-v147-implementation-20261106');
const legacy = resolve(out, 'phase91/test-ec154ba1-6e63-425d-8ff8-58cecc4826bf/d27f9525-c67b-44e1-9959-f0a54e47e7a9/legacy');
const p = prepareRenderedReviewV1(fund.root), { plan } = p;
const profileFile = resolve(source, '.taskmaster/docs/ai-quality-v147-rendered-review-budget-profile-v1.json');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const profile = read(profileFile);

function payload(request, change = () => {}) {
  const reviews = request.mapping.map(({ caseId, opaqueId }) => {
    const row = { opaqueId, grade: { meaning: 'pass', grammar: caseId.endsWith('/baseline') ? 'fail' : 'pass', correction: 'pass',
      explanation: 'pass', abstention: 'pass', criticalErrors: { approveBadGrammar: false, reverseMeaning: false, swapRoles: false, inventedIntent: false } },
    sourceAdequacy: 'sufficient', learnerContext: 'missing', abstentionNeed: 'required', repairContext: 'not_applicable', assignmentForm: 'not_applicable',
    evidenceNote: 'Synthetic review for the fixed structure.' };
    if (caseId === 'control-false-rule') {
      row.grade.grammar = 'fail'; row.grade.explanation = 'fail'; row.grade.criticalErrors.approveBadGrammar = true;
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

test('The model sees rendered evidence only with independent opaque aliases', () => {
  assert.equal(new Set(plan.requests.flatMap(r => r.mapping.map(row => row.opaqueId))).size, 18);
  for (const r of plan.requests) {
    const body = JSON.parse(r.requestRaw), items = JSON.parse(body.input[0].content).items;
    assert.equal(items.length, 6);
    assert.ok(items.every(x => Object.keys(x.feedback).sort().join() === 'correctedSentence,explanation,headings'));
    assert.doesNotMatch(r.requestRaw, /validationVersion|promptVersion|providerBodySha256|time\/baseline|time\/candidate|control-supplied-intent/);
  }
  assert.equal(quoteRenderedReviewV1(p, plan.requests.map(r => ({ ...r, inputTokens: 9000 }))).reserveMicros, '452527');
});

test('A failed control and a preexisting pass both preclude the paired improvement claim', () => {
  const inspect = change => inspectRenderedReviewV1(p, plan.requests.map(r => ({ ...r, payloadRaw: payload(r, change) })));
  assert.equal(inspect().passed, true);
  const failed = inspect((vote, caseId, model) => {
    if (model === 'gpt-6.1-sol' && caseId === 'control-supplied-intent') vote.grade.criticalErrors.inventedIntent = true;
    if (model === 'gpt-6.1-terra' && caseId === 'quantity/baseline') vote.grade.grammar = 'pass';
  });
  assert.equal(failed.passed, false);
  assert.equal(failed.improved, 3);
  assert.equal(failed.mainDispatchAuthorized, false);
});

test('The live profile preflight does not reserve or access a key', () => {
  const prior = live.ledgerFiles.map(sha);
  const session = openEvaluationBudgetV3({ prepared: fund, context: live });
  try {
    const runtime = resolve(fund.root, 'outputs', profile.runtimeDirectoryName);
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: resolve(runtime, 'wrong') }), /EB3_RUNTIME_SCOPE/);
    assert.throws(() => session.reserve({ profileFile, collectorPlanHash: profile.studyPlanHash, runtimeRoot: runtime }), { code: 'ENOENT' });
    assert.deepEqual(live.ledgerFiles.map(sha), prior);
  } finally { session.release(); }
});

for (const inputTokens of [1000, 9001]) test(`The budget closes safely at ${inputTokens} input tokens`, { timeout: 90000 }, async () => {
  const prior = live.ledgerFiles.map(sha);
  const syntheticRoot = resolve(out, 'phase101', 't-' + randomUUID().slice(0, 12), 'fund');
  mkdirSync(syntheticRoot, { recursive: true });
  const runtime = resolve(syntheticRoot, 'runtime-' + profile.runId), budget = resolve(syntheticRoot, 'budget-source.json');
  const calls = [];
  let keys = 0;
  const run = () => runSyntheticRenderedReviewV1({ legacy, syntheticRoot,
    loadKey: () => { assert.equal(read(budget).reservedMicros, '452527'); keys++; return SYNTHETIC_KEY; },
    transport: ({ kind, index, body, key }) => {
      const r = plan.requests[index];
      assert.equal(body, kind === 'count' ? r.countRequestRaw : r.requestRaw);
      assert.equal(key, SYNTHETIC_KEY);
      assert.ok(existsSync(resolve(runtime, `${kind}-${index}-intent.json`)));
      calls.push(kind);
      const value = kind === 'count' ? { object: 'response.input_tokens', input_tokens: inputTokens } : {
        id: 'resp_synthetic_rendered_' + index, model: r.model, service_tier: 'default', status: 'completed',
        usage: { input_tokens: 1000, output_tokens: 256, total_tokens: 1256, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 1000 } },
        output: [{ type: 'message', content: [{ type: 'output_text', text: payload(r) }] }],
      };
      return { status: 200, type: 'application/json', raw: JSON.stringify(value) };
    } });
  const t = await run(), valid = inputTokens === 1000;
  assert.deepEqual(calls, valid ? ['count', 'count', 'count', 'model', 'model', 'model'] : ['count']);
  assert.equal(t.failureCode, valid ? null : 'RR1C_COUNT_LIMIT');
  assert.equal(t.stageUsedUpperMicros, valid ? '141179' : '105000');
  assert.equal(t.inspection?.improved, valid ? 6 : undefined);
  assert.equal(read(budget).reservedMicros, '0');
  await assert.rejects(run(), /RR1C_AVAILABLE/);
  assert.equal(keys, 1);
  assert.deepEqual(live.ledgerFiles.map(sha), prior);
});
