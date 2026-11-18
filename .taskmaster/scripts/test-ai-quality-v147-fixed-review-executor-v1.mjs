import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { CRITICAL, DIMENSIONS } from './ai-quality-v147-calibration.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';
import { GROUPED_PRODUCT_POLICY_HASH_V1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { collectFixedReviewsV1, executeAuthorizedFixedReviewsV1, FIXED_REVIEW_MAX_MICROS } from './ai-quality-v147-fixed-review-executor-v1.mjs';

const root = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8')).baseline.existingDashboardRoot;
const plan = JSON.parse(readFileSync(resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase175/prepared-grouped-product-reviews.json'), 'utf8')).recordedActual;
const key = 'synthetic-fixed-review-key';
const out = resolve(process.env.QA_OUTPUT_DIR);
function fixture() {
  const directory = mkdtempSync(resolve(out, 'test-'));
  const events = []; let loads = 0;
  const transport = async ({ kind, body }) => {
    const index = events.filter(e => e.kind === kind).length; events.push({ kind, body });
    if (kind === 'count') return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: 5000 }) };
    const request = JSON.parse(body), items = JSON.parse(request.input[0].content).items;
    const payload = { groupProtocolHash: GROUPED_PRODUCT_POLICY_HASH_V1, items: items.map(item => {
      const f = item.EVALUATION_DATA.feedback, changed = !!f.correctedSentence && f.correctedSentence !== f.original.trim();
      return { itemId: item.itemId, grade: { ...Object.fromEntries(DIMENSIONS.map(d => [d, 'pass'])), criticalErrors: Object.fromEntries(CRITICAL.map(k => [k, false])) },
        reasonCodes: ['confirmed'], productRubricHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V1,
        sourceAdequacy: 'sufficient', learnerContext: 'sufficient', abstentionNeed: 'not_required',
        repairContext: changed ? 'sufficient' : 'not_applicable', assignmentForm: changed ? 'not_specified' : 'not_applicable' };
    }) };
    return { status: 200, type: 'application/json', raw: JSON.stringify({ id: 'synthetic-response-' + index, model: request.model,
      status: 'completed', service_tier: 'default', usage: { input_tokens: 5000, output_tokens: 400, total_tokens: 5400 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] }) };
  };
  const options = { plan, directory, loadKey: () => { loads++; return key; }, transport };
  return { directory, events, transport, options, loads: () => loads };
}

test('all12 counts precede12 model calls;24 grades settle once and synthetic usage never claims real AI', async () => {
  const f = fixture(), r = await collectFixedReviewsV1(f.options);
  assert.equal(r.failureCode, null); assert.equal(r.independentJudgments, 24); assert.equal(f.loads(), 1);
  assert.deepEqual(f.events.map(e => e.kind), [...Array(12).fill('count'), ...Array(12).fill('model')]);
  assert.deepEqual([r.actualProviderCalls, r.actualCountCalls, r.actualKeyReads], [0, 0, 0]);
  assert.equal(r.clientModelAttempts, 12); assert.equal(r.clientCountAttempts, 12);
  assert.ok(BigInt(r.combinedUsedUpperMicros) < FIXED_REVIEW_MAX_MICROS);
  await assert.rejects(() => collectFixedReviewsV1(f.options), { code: 'EEXIST' }); assert.equal(f.events.length, 24);
});

test('a changed body is rejected before key read or once claim', async () => {
  const f = fixture(), changed = structuredClone(plan); changed.requests[0].requestRaw += ' ';
  await assert.rejects(() => collectFixedReviewsV1({ ...f.options, plan: changed }));
  assert.equal(f.loads(), 0); assert.equal(readdirSync(f.directory).length, 0);
});

test('the live wrapper rejects the wrong fixed scope before credentials or funding', async () => {
  let loads = 0;
  await assert.rejects(() => executeAuthorizedFixedReviewsV1({ scopeHash: '0'.repeat(64), loadKey: () => { loads++; return key; } }), /FRE1_SCOPE/);
  assert.equal(loads, 0);
});

test('over10000 input tokens stops with zero model calls and retains the count provision', async () => {
  const f = fixture(), r = await collectFixedReviewsV1({ ...f.options, transport: async () => ({ status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: 10001 }) }) });
  assert.equal(r.failureCode, 'FRE1_COUNT_SHAPE_OR_LIMIT'); assert.equal(r.clientCountAttempts, 1); assert.equal(r.clientModelAttempts, 0);
  assert.equal(r.combinedUsedUpperMicros, '420000');
});

test('an HTTP model error is never retried and holds the full fixed scope', async () => {
  const f = fixture(), r = await collectFixedReviewsV1({ ...f.options, transport: async v => v.kind === 'count' ? f.transport(v) : { status: 503, type: 'application/json', raw: '{"error":"synthetic"}' } });
  assert.equal(r.failureCode, 'FRE1_HTTP'); assert.equal(r.clientModelAttempts, 1);
  assert.equal(r.combinedUsedUpperMicros, String(FIXED_REVIEW_MAX_MICROS));
});

test('duplicate provider IDs and invalid grade envelopes cannot produce a completed collection', async () => {
  for (const kind of ['duplicate', 'invalid']) {
    const f = fixture(), r = await collectFixedReviewsV1({ ...f.options, transport: async v => {
      const response = await f.transport(v); if (v.kind === 'count') return response;
      const b = JSON.parse(response.raw); if (kind === 'duplicate') b.id = 'same-synthetic-id'; else b.output[0].content[0].text = '{}';
      return { ...response, raw: JSON.stringify(b) };
    } });
    assert.ok(r.failureCode); assert.ok(r.clientModelAttempts <= 2); assert.equal(r.status, 'held');
  }
});

test('secret echo is not persisted; only fixed error and capture metadata remain', async () => {
  const f = fixture(), r = await collectFixedReviewsV1({ ...f.options, transport: async () => ({ status: 200, type: 'application/json', raw: key }) });
  assert.equal(r.failureCode, 'FRE1_SECRET_ECHO');
  for (const name of readdirSync(f.directory)) assert.equal(readFileSync(resolve(f.directory, name), 'utf8').includes(key), false);
});

test('interruption after a consumed intent cannot be resumed or sent a second time', async () => {
  const f = fixture(), r = await collectFixedReviewsV1({ ...f.options, testFault: (point, kind) => { if (point === 'after-consume' && kind === 'model') throw Error('synthetic interruption'); } });
  assert.equal(r.clientModelAttempts, 1); assert.equal(f.events.filter(e => e.kind === 'model').length, 0);
  assert.equal(r.combinedUsedUpperMicros, String(FIXED_REVIEW_MAX_MICROS));
  await assert.rejects(() => collectFixedReviewsV1(f.options), { code: 'EEXIST' });
});
