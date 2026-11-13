import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { prepareReferenceSupplementV1, quoteReferenceSupplementV1 } from './ai-quality-v147-reference-supplement-v1.mjs';
import { runSyntheticReferenceSupplementV1, SYNTHETIC_KEY } from './ai-quality-v147-reference-supplement-collector-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const root = resolve(source, '../..'), out = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
const legacy = resolve(out, 'phase91/test-ec154ba1-6e63-425d-8ff8-58cecc4826bf/d27f9525-c67b-44e1-9959-f0a54e47e7a9/legacy');
const prepared = prepareReferenceSupplementV1(root);
const { plan } = prepared;
const mirrors = [root, source].map(base => resolve(base, '.taskmaster/docs/ai-quality-v147-evaluation-budget-ledger-v3.json'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const profile = JSON.parse(readFileSync(resolve(source, '.taskmaster/docs/ai-quality-v147-reference-supplement-budget-profile-v1.json')));

test('Each case has both non-author reviewers and exact cost and count bodies', () => {
  assert.equal(new Set(plan.requests.map(r => r.key)).size, 24);
  for (const c of plan.cases) {
    const rows = plan.requests.filter(x => x.caseId === c.caseId);
    assert.equal(rows.length, 2);
    assert.ok(rows.every(r => r.model !== c.author));
    for (const r of rows) {
      const body = JSON.parse(r.requestRaw);
      assert.deepEqual(JSON.parse(body.input[0].content), c.evidence);
      assert.deepEqual(JSON.parse(r.countRequestRaw), Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(k => [k, body[k]])));
      assert.doesNotMatch(r.requestRaw, /unresolvedReasons|peerReviews|pilot-grammar|pilot-word|shortEvidenceSummary|"reviewers"/);
    }
  }
  assert.equal(quoteReferenceSupplementV1(prepared, plan.requests.map(r => ({ ...r, inputTokens: 6000 }))).reserveMicros, '2308192');
});

for (const tokens of [1000, 6001]) test('Exact scope settles with input ' + tokens, async () => {
  const before = mirrors.map(sha), syntheticRoot = resolve(out, 'phase109', 't-' + randomUUID().slice(0, 12), 'fund');
  mkdirSync(syntheticRoot, { recursive: true });
  const book = resolve(syntheticRoot, 'budget-source.json'), runtime = resolve(syntheticRoot, 'runtime-' + profile.runId);
  const attempts = [];
  let keys = 0;
  const opts = { syntheticRoot, legacy, loadKey() {
    keys++;
    assert.equal(JSON.parse(readFileSync(book)).reservedMicros, '2308192');
    return SYNTHETIC_KEY;
  }, transport({ kind, index, body, key }) {
    assert.equal(key, SYNTHETIC_KEY);
    const r = plan.requests[index];
    assert.equal(body, kind === 'count' ? r.countRequestRaw : r.requestRaw);
    assert.ok(existsSync(resolve(runtime, kind + '-' + index + '-intent.json')));
    attempts.push(kind);
    const payload = { target: 'supported', grammar: 'supported', repair: 'supported',
      sourceCoverage: index === 0 ? 'insufficient' : 'sufficient', sourcesUsed: ['supplement-1'], rationale: 'Synthetic source audit for verified shape.' };
    const response = kind === 'count' ? { object: 'response.input_tokens', input_tokens: tokens } : {
      id: 'resp_synthetic_reference_' + index, model: r.model, service_tier: 'default', status: 'completed',
      usage: { input_tokens: tokens, output_tokens: 150, total_tokens: tokens + 150,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: tokens } },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
    };
    return { status: 200, type: 'application/json', raw: JSON.stringify(response) };
  } };
  const t = await runSyntheticReferenceSupplementV1(opts);
  const valid = tokens === 1000;
  assert.deepEqual(attempts, valid ? [...Array(24).fill('count'), ...Array(24).fill('model')] : Array(6).fill('count'));
  assert.equal(t.failureCode, valid ? null : 'RSC1_COUNT_LIMIT');
  assert.equal(t.inspection?.supportedCases.length, valid ? 11 : undefined);
  assert.equal(t.actualProviderCalls, 0);
  assert.equal(t.mainDispatchAuthorized, false);
  assert.equal(JSON.parse(readFileSync(book)).reservedMicros, '0');
  await assert.rejects(runSyntheticReferenceSupplementV1(opts), /RSC1_AVAILABLE/);
  assert.equal(keys, 1);
  assert.deepEqual(mirrors.map(sha), before);
});
