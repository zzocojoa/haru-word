import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { compilePublicControlBatchV1, decodeBatchExposureV1 } from './ai-quality-v147-public-control-batch-v1.mjs';
import { compileReferenceRoleCalibrationV2, referenceRolePolicyV2, inspectReferenceRoleCalibrationV2 } from './ai-quality-v147-reference-role-calibration-v2.mjs';
import { collectReferenceRoleV2 } from './ai-quality-v147-reference-role-collector-v2.mjs';
import { REFERENCE_DIMENSIONS, REFERENCE_CRITICAL } from './ai-quality-v147-reference-v4.mjs';
import { digest } from './ai-quality-v147-budget-v3.mjs';

const prepared = compileReferenceRoleCalibrationV2(), old = compilePublicControlBatchV1();
const key = 'synthetic-reference-role-v2-key', fresh = () => mkdtempSync(resolve(process.env.QA_OUTPUT_DIR ?? tmpdir(), 'reference-role-'));
function records() {
  return prepared.plan.requests.map(r => ({ key: r.key, requestSha256: r.requestSha256, payloadRaw: JSON.stringify({
    rubricHash: prepared.plan.policyHash, items: Object.entries(r.privateExpectedByItemId).map(([itemId, grade]) => ({
      itemId, grade: structuredClone(grade), reasonCodes: ['exposure'], shortEvidenceSummary: 'Synthetic wire and consistency check; no English qualification.' })) }) }));
}
function fakeTransport(events, mutation = null) {
  const answers = records(); let modelIndex = 0;
  return async ({ kind, body }) => {
    events.push(kind);
    if (kind === 'count') return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: 1000 }) };
    const r = prepared.plan.requests[modelIndex], answer = answers[modelIndex++];
    const value = { status: 'completed', model: JSON.parse(body).model, service_tier: 'default', id: 'resp_synthetic_' + modelIndex,
      usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: answer.payloadRaw }] }] };
    mutation?.(value, modelIndex, r);
    return { status: 200, type: 'application/json', raw: JSON.stringify(value) };
  };
}

test('prospective policy removes the contradictory empty-correction boundary and preserves all seven dimensions/five flags', () => {
  const p = referenceRolePolicyV2().policy;
  assert.equal(p.version, 3); assert.deepEqual(Object.keys(p.dimensions), REFERENCE_DIMENSIONS);
  assert.deepEqual(Object.keys(p.criticalFlags), REFERENCE_CRITICAL);
  assert(!p.boundaryRules.some(r => r.id === 'NO_REPAIR_ERROR_OR_UNKNOWN_MESSAGE'));
  const rule = p.boundaryRules.find(r => r.id === 'VISIBLE_WITHHOLDING_IS_ASSESSABLE').rule;
  for (const text of ['pass when', 'fail when', 'uncertain', 'absent records']) assert(rule.includes(text));
  assert.equal(p.independentQualification, false); assert.equal(p.englishTruthCertified, false);
});

test('six blind ten-item requests retain every legacy control, exposure row, output criterion and source record', () => {
  assert.equal(prepared.plan.requests.length, 6); assert.equal(prepared.plan.grades, 60);
  assert.equal(prepared.plan.maximumMicros, '1912918');
  for (const [index, r] of prepared.plan.requests.entries()) {
    const data = JSON.parse(JSON.parse(r.requestRaw).input[0].content), previous = JSON.parse(JSON.parse(old.requests[index].requestRaw).input[0].content);
    assert.equal(data.items.length, 10); assert.equal(r.prospectiveDeltas.length, 2);
    assert(!r.requestRaw.includes('privateExpected')); assert(!r.requestRaw.includes('korean-natural-meaning-repair'));
    for (const item of previous.items) {
      assert.deepEqual(data.items.find(v => v.itemId === item.itemId), item);
      assert.deepEqual(decodeBatchExposureV1(data.exposure, item.assignment.exposureInventoryHash),
        decodeBatchExposureV1(previous.exposure, item.assignment.exposureInventoryHash));
    }
    for (const name of ['korean-natural-meaning-repair', 'justified-withholding', 'omitted-supported-completion'])
      assert.equal(Object.values(r.privateNamesByItemId).filter(v => v === name).length, 1);
    const body = JSON.parse(r.requestRaw); assert.equal(body.max_output_tokens, 4096); assert.equal(body.store, false);
    assert.equal(body.prompt_cache_options, undefined);
  }
  assert.equal(old.hash, compilePublicControlBatchV1().hash);
});

test('synthetic agreement does not admit reference records or grant main execution; critical misses and duplicates cannot pass', () => {
  const rows = records(), result = inspectReferenceRoleCalibrationV2(prepared.plan, rows);
  assert.equal(result.matched, 60); assert.equal(result.declaredPublicRoleCalibrationPassed, true);
  assert.equal(result.referenceRecordsQualified, 0); assert.equal(result.mainDispatchAuthorized, false);
  const value = JSON.parse(rows[0].payloadRaw);
  value.items[0].grade.criticalErrors.knownExposureLeak = false;
  rows[0].payloadRaw = JSON.stringify(value);
  const bad = inspectReferenceRoleCalibrationV2(prepared.plan, rows);
  assert.equal(bad.declaredPublicRoleCalibrationPassed, false); assert.equal(bad.criticalMisses, 1);
  value.items[1] = value.items[0]; rows[0].payloadRaw = JSON.stringify(value);
  assert.throws(() => inspectReferenceRoleCalibrationV2(prepared.plan, rows), /RRC2_ITEM_BINDING/);
});

test('all counts precede model transport; output usage accumulates and the same invocation cannot run again', async () => {
  const events = [], dir = fresh(), transport = fakeTransport(events);
  const result = await collectReferenceRoleV2({ prepared, directory: dir, loadKey: async () => key, transport });
  assert.equal(result.failureCode, null); assert.equal(result.inspection.matched, 60);
  assert.deepEqual(events, [...Array(6).fill('count'), ...Array(6).fill('model')]);
  assert.equal(result.actualProviderCalls, 0); assert.equal(result.clientModelAttempts, 6);
  assert.equal(BigInt(result.combinedUsedUpperMicros), BigInt(result.modelUpperMicros) + 210000n);
  await assert.rejects(collectReferenceRoleV2({ prepared, directory: dir, loadKey: async () => key, transport }), /EEXIST/);
  assert.equal(events.length, 12);
});

test('oversized count stops before every model; a changed frozen plan is rejected before key discovery', async () => {
  const events = [], result = await collectReferenceRoleV2({ prepared, directory: fresh(), loadKey: async () => key,
    transport: async ({ kind }) => { events.push(kind); return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: 25001 }) }; } });
  assert.equal(result.failureCode, 'RRCX2_COUNT_LIMIT'); assert.deepEqual(events, ['count']); assert.equal(result.clientModelAttempts, 0);
  const mutated = structuredClone(prepared); mutated.plan.requests[0].requestRaw += ' '; mutated.hash = digest(mutated.plan);
  let reads = 0;
  await assert.rejects(collectReferenceRoleV2({ prepared: mutated, directory: fresh(), loadKey: async () => { reads++; return key; }, transport: fakeTransport([]) }), /RRCX2_PLAN/);
  assert.equal(reads, 0);
});

test('credential echoes are not persisted and uncertain attempts remain charged without retransmission', async () => {
  const events = [], dir = fresh(), result = await collectReferenceRoleV2({ prepared, directory: dir, loadKey: async () => key,
    transport: fakeTransport(events, value => { value.output[0].content[0].text = key; }) });
  assert.equal(result.failureCode, 'RRCX2_CREDENTIAL_OR_JSON'); assert.equal(result.clientModelAttempts, 1);
  assert(BigInt(result.unresolvedAttemptUpperMicros) > 0n); assert(!existsSync(resolve(dir, 'model-0-response.json')));
  for (const f of readdirSync(dir)) assert(!readFileSync(resolve(dir, f), 'utf8').includes(key));
  assert.equal(events.filter(e => e === 'model').length, 1);
});

test('duplicate response IDs stop collection and reserve the unresolved attempt instead of refunding it', async () => {
  const result = await collectReferenceRoleV2({ prepared, directory: fresh(), loadKey: async () => key,
    transport: fakeTransport([], value => { value.id = 'resp_unchanged'; }) });
  assert.equal(result.failureCode, 'RRCX2_RESPONSE_IDENTITY'); assert.equal(result.records.length, 1);
  assert.equal(result.clientModelAttempts, 2); assert(BigInt(result.unresolvedAttemptUpperMicros) > 0n);
});

