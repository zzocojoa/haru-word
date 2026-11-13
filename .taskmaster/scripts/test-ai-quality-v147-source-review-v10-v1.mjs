import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSourceReviewV10, inspectSourceReviewV10, collectSourceReviewV10, SOURCE_REVIEW_MAXIMUM_V10 } from './ai-quality-v147-source-review-v10-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url)), root = JSON.parse(readFileSync(resolve(source, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8')).baseline.existingDashboardRoot;
const read = f => JSON.parse(readFileSync(resolve(root, f), 'utf8'));
const witness = JSON.parse(readFileSync(resolve(source, '.taskmaster/evaluation/ai-quality-v147/withholding-calibration-v10-plan-v1.json'), 'utf8'));
const prepared = prepareSourceReviewV10(witness, read('outputs/ai-quality-v147-implementation-20261106/phase99/prepared.json').plan.controls);
const out = resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase183/source-review-tests'); mkdirSync(out, { recursive: true });
const payload = request => ({ reviews: request.mapping.map(({ caseId, opaqueId }) => {
  const row = prepared.plan.candidates.find(c => c.caseId === caseId);
  if (row) return { opaqueId, grade: row.expectedGrade, ...row.expectedAxes, evidenceNote: 'A synthetic transport fixture; this note is not actual source qualification.' };
  const r = structuredClone(prepared.plan.candidates[0]);
  r.expectedGrade.grammar = 'fail'; r.expectedGrade.explanation = 'fail'; r.expectedGrade.criticalErrors.approveBadGrammar = true;
  if (caseId === 'control-unscoped-register') {
    r.expectedGrade = { ...r.expectedGrade, grammar: 'uncertain', explanation: 'pass', correction: 'uncertain', criticalErrors: Object.fromEntries(Object.keys(r.expectedGrade.criticalErrors).map(k => [k, false])) };
    r.expectedAxes = { sourceAdequacy: 'conflicting', learnerContext: 'missing', abstentionNeed: 'required', repairContext: 'missing', assignmentForm: 'not_specified' };
  }
  return { opaqueId, grade: r.expectedGrade, ...r.expectedAxes, evidenceNote: 'Synthetic false-rule/register control for collector verification only.' };
}) });
const records = () => prepared.plan.requests.map(r => ({ key: r.key, requestSha256: r.requestSha256, payloadRaw: JSON.stringify(payload(r)) }));
async function run(options = {}) {
  const directory = mkdtempSync(resolve(out, 'run-')), events = []; let keys = 0, models = 0;
  const terminal = await collectSourceReviewV10({ prepared: options.prepared ?? prepared, directory,
    loadKey: async () => { keys++; return 'synthetic-source-review-secret'; }, transport: async ({ kind, body, key }) => {
      events.push(kind);
      if (options.throwAt === events.length) throw Error('synthetic lost response');
      if (kind === 'count') return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: options.count ?? 9000 }) };
      const request = prepared.plan.requests.find(r => r.requestRaw === body); models++;
      const p = payload(request); if (options.badPayload) options.badPayload(p);
      const v = { id: options.duplicateIds ? 'resp_repeated' : 'resp_synthetic_' + models, model: request.model, status: 'completed', service_tier: 'default',
        usage: { input_tokens: options.count ?? 9000, output_tokens: options.output ?? 1000, total_tokens: (options.count ?? 9000) + (options.output ?? 1000) },
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(p) }] }] };
      if (options.echoSecret) v.output[0].content[0].text = key;
      return { status: 200, type: 'application/json', raw: JSON.stringify(v) };
    } });
  return { directory, terminal, events, keys, models };
}

test('fixed source packets omit expectations and author labels while preserving all twelve current witnesses and two controls', () => {
  assert.equal(prepared.plan.candidates.length, 12); assert.equal(prepared.plan.controls.length, 2);
  for (const r of prepared.plan.requests) {
    const b = JSON.parse(r.requestRaw), items = JSON.parse(b.input[0].content).items;
    assert.equal(items.length, 14); assert.equal(b.max_output_tokens, 4096);
    assert.doesNotMatch(b.input[0].content, /expectedGrade|expectedAxes|caseId|generatorId|priorVotes|sourceReviewKind/);
    const music = prepared.plan.candidates.find(c => c.caseId === 'MC08');
    assert.equal(music.input.requestInput.contextRole, 'intended_korean');
  }
});
test('all counts precede model sends, each is consumed once, and successful synthetic review never claims formal qualification', async () => {
  const r = await run(); assert.equal(r.terminal.failureCode, null);
  assert.deepEqual(r.events, ['count', 'count', 'count', 'model', 'model', 'model']); assert.equal(r.keys, 1);
  assert.equal(r.terminal.inspection.qualifiedWitnesses, 12); assert.equal(r.terminal.inspection.controlsPassed, 6);
  assert.equal(r.terminal.inspection.formalCalibrationQualification, false); assert.equal(r.terminal.mainDispatchAuthorized, false);
  await assert.rejects(collectSourceReviewV10({ prepared, directory: r.directory, loadKey: () => { throw Error('must not read'); }, transport: () => { throw Error('must not send'); } }));
});
test('the complete measured ceiling fits the fixed reservation; over-ceiling count stops before any model', async () => {
  const full = await run({ count: 12000, output: 4096 }); assert.equal(full.terminal.failureCode, null);
  assert.ok(BigInt(full.terminal.combinedUsedUpperMicros) <= SOURCE_REVIEW_MAXIMUM_V10);
  const over = await run({ count: 12001 }); assert.equal(over.models, 0); assert.equal(over.events.length, 1);
  assert.equal(over.terminal.failureCode, 'SR10_COUNT_LIMIT'); assert.equal(over.terminal.combinedUsedUpperMicros, '105000');
});
test('a source disagreement or failed control holds qualification without changing expectations or majority repair', () => {
  const rs = records(), p = JSON.parse(rs[0].payloadRaw), target = prepared.plan.requests[0].mapping.find(m => m.caseId === 'MC05');
  const v = p.reviews.find(v => v.opaqueId === target.opaqueId); v.grade.grammar = 'pass'; v.grade.criticalErrors.approveBadGrammar = false;
  rs[0].payloadRaw = JSON.stringify(p); const report = inspectSourceReviewV10(prepared.plan, rs);
  assert.equal(report.qualifiedWitnesses, 11); assert.equal(report.sourceQualifiedForDeclaredAiOnlyPolicy, false);
  const clean = records(), c = JSON.parse(clean[0].payloadRaw), control = prepared.plan.requests[0].mapping.find(m => m.caseId === 'control-unscoped-register');
  c.reviews.find(v => v.opaqueId === control.opaqueId).sourceAdequacy = 'sufficient'; clean[0].payloadRaw = JSON.stringify(c);
  assert.equal(inspectSourceReviewV10(prepared.plan, clean).qualifiedWitnesses, 0);
});
test('lost response, duplicate provider ID and duplicate review identity stay terminal and retain the model-attempt ceiling', async () => {
  for (const options of [{ throwAt: 4 }, { duplicateIds: true }, { badPayload: p => { p.reviews[1] = structuredClone(p.reviews[0]); } }]) {
    const r = await run(options); assert.ok(r.terminal.failureCode); assert.equal(r.terminal.combinedUsedUpperMicros, String(SOURCE_REVIEW_MAXIMUM_V10));
    assert.equal(r.terminal.automaticRetry, false); assert.ok(r.events.filter(x => x === 'model').length <= 3);
  }
});
test('credential echoes are not written and stale preparation is rejected before credential access', async () => {
  const r = await run({ echoSecret: true }); assert.equal(r.terminal.failureCode, 'SR10_RESPONSE_CREDENTIAL_OR_JSON');
  assert.equal(existsSync(resolve(r.directory, 'model-0-response.json')), false);
  assert.equal(JSON.parse(readFileSync(resolve(r.directory, 'model-0-capture.json'), 'utf8')).persisted, false);
  let keys = 0;
  await assert.rejects(collectSourceReviewV10({ prepared: { ...prepared, hash: '0'.repeat(64) }, directory: mkdtempSync(resolve(out, 'bad-')), loadKey: () => { keys++; }, transport: () => {} }), /SR10_PLAN/);
  assert.equal(keys, 0);
});
