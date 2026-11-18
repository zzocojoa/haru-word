import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { MAIN_RUBRIC_HASH_V8 } from './ai-quality-v147-main-panel-v8.mjs';
import { issueClosedDayCalibrationFundingV1 } from './ai-quality-v147-closed-day-calibration-funding-v1.mjs';
import { runSyntheticRenderedCalibrationV1, SYNTHETIC_KEY } from './ai-quality-v147-rendered-calibration-collector-v1.mjs';
import { prepareRenderedCalibrationV1 } from './ai-quality-v147-rendered-calibration-v1.mjs';

const root = fileURLToPath(new URL('../../../..', import.meta.url));
const { plan } = prepareRenderedCalibrationV1(root);
const directory = () => resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase106', 'test-' + randomUUID());

test('Missing earmark stops before key access', async () => {
  const syntheticDirectory = directory();
  mkdirSync(syntheticDirectory);
  await assert.rejects(runSyntheticRenderedCalibrationV1({ syntheticDirectory, loadKey: assert.fail, transport: assert.fail }), { code: 'ENOENT' });
  assert.equal(existsSync(resolve(syntheticDirectory, 'runtime')), false);
});

for (const tokens of [5500, 8001]) test('One funded matrix with input count ' + tokens, async () => {
  const syntheticDirectory = directory();
  mkdirSync(syntheticDirectory);
  issueClosedDayCalibrationFundingV1({ syntheticDirectory });
  let keys = 0;
  const attempts = [];
  const options = { syntheticDirectory, loadKey: () => { keys++; return SYNTHETIC_KEY; },
    transport({ kind, index, body, key }) {
      assert.equal(key, SYNTHETIC_KEY);
      const r = plan.requests[index];
      assert.equal(body, kind === 'count' ? r.countRequestRaw : r.requestRaw);
      assert.ok(existsSync(resolve(syntheticDirectory, 'runtime', kind + '-' + index + '-intent.json')));
      attempts.push(kind);
      const row = plan.witnesses.find(w => w.id === r.privateBinding.witnessId);
      const responseText = JSON.stringify({ grade: row.expectedGrade, ...row.expectedV8Axes, reasonCodes: ['confirmed'],
        productRubricHash: MAIN_RUBRIC_HASH_V8, assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1 });
      const value = kind === 'count' ? { object: 'response.input_tokens', input_tokens: tokens } :
        { status: 'completed', model: r.model, service_tier: 'default', id: 'resp_synthetic_' + index,
          usage: { input_tokens: tokens, output_tokens: 300, total_tokens: tokens + 300,
            input_tokens_details: { cached_tokens: 0, cache_write_tokens: tokens } },
          output: [{ type: 'message', content: [{ type: 'output_text', text: responseText }] }] };
      return { status: 200, type: 'application/json', raw: JSON.stringify(value) };
    } };
  const t = await runSyntheticRenderedCalibrationV1(options);
  const valid = tokens === 5500;
  assert.deepEqual([t.clientCountAttempts, t.clientModelAttempts, t.failureCode], valid ? [72, 72, null] : [6, 0, 'RCC1_COUNT_LIMIT']);
  assert.deepEqual(attempts, valid ? [...Array(72).fill('count'), ...Array(72).fill('model')] : Array(6).fill('count'));
  assert.equal(t.inspection?.arithmeticMatches, valid ? 72 : undefined);
  assert.equal(t.mainDispatchAuthorized, false);
  assert.ok(BigInt(t.stageUsedUpperMicros) <= 8567184n);
  assert.equal(t.actualProviderCalls, 0);
  await assert.rejects(runSyntheticRenderedCalibrationV1(options), /RCC1_RUN_ONCE/);
  assert.equal(keys, 1);
});
