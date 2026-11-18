import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { compileCalibrationRemainderV1, inspectCalibrationRemainderV1 } from './ai-quality-v147-calibration-remainder-v1.mjs';
import { calibrationRemainderFundingV1 } from './run-ai-quality-v147-calibration-remainder-v1.mjs';
import { collectGroupedReviewsV2 } from './ai-quality-v147-grouped-review-executor-v2.mjs';
import { validateGroupedProductReviewRequestV1, GROUPED_PRODUCT_POLICY_HASH_V1, quoteGroupedProductReviewV1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';

const root = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8')).baseline.existingDashboardRoot;
const bank = JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/explanation-main-witness-candidate-v1.json', import.meta.url), 'utf8'));
const original = JSON.stringify(bank), plan = compileCalibrationRemainderV1(bank);
const negativeVotes = JSON.parse(readFileSync(resolve(root, 'outputs/ai-quality-v147-negative-controls-runtime-20261112/negative-control-results.json'), 'utf8')).votes;
const limits = { requests: 18, judgments: 48, maximumInputTokens: 7500, maximumMicros: '2846091' };
function payload(request) {
  return JSON.stringify({ groupProtocolHash: GROUPED_PRODUCT_POLICY_HASH_V1, items: request.privateMembers.map(m => {
    const row = plan.witnesses.find(r => r.id === m.individual.privateBinding.sourceId), f = row.feedback;
    const changed = f && !!f.correctedSentence && f.correctedSentence !== f.original;
    return { itemId: m.itemId, grade: row.expectedGrade, ...row.expectedEvidenceAxes,
      repairContext: f === null ? 'unavailable' : changed ? row.expectedEvidenceAxes.learnerContext : 'not_applicable',
      assignmentForm: f === null ? 'unavailable' : changed ? 'not_specified' : 'not_applicable',
      productRubricHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V1, reasonCodes: [f === null ? 'unavailable' : 'confirmed'] };
  }) });
}
function fixture() {
  const events = []; let n = 0, keys = 0;
  const directory = mkdtempSync(resolve(process.env.QA_OUTPUT_DIR, 'remainder-'));
  const transport = async ({ kind, body }) => {
    events.push(kind);
    if (kind === 'count') return { status: 200, type: 'application/json', raw: JSON.stringify({ object: 'response.input_tokens', input_tokens: 5000 }) };
    const b = JSON.parse(body), r = plan.requests[n++];
    return { status: 200, type: 'application/json', raw: JSON.stringify({ id: 'synthetic-remainder-' + n, status: 'completed', model: b.model, service_tier: 'default',
      usage: { input_tokens: 5000, output_tokens: 600, total_tokens: 5600 }, output: [{ type: 'message', content: [{ type: 'output_text', text: payload(r) }] }] }) };
  };
  return { events, directory, keys: () => keys, transport, options: { plan, limits, directory, transport, loadKey: () => { keys++; return 'synthetic-remainder-key'; } } };
}

test('unchanged eight witnesses form18 requests/48 unique votes without the four previously measured controls', () => {
  assert.equal(JSON.stringify(bank), original); assert.equal(plan.witnesses.length, 8); assert.equal(plan.requests.length, 18);
  const coverage = new Set(); let nulls = 0;
  for (const r of plan.requests) {
    validateGroupedProductReviewRequestV1(r); assert.ok([2,3].includes(r.itemCount));
    assert.equal(r.requestRaw.includes('expectedGrade'), false);
    const items = JSON.parse(JSON.parse(r.requestRaw).input[0].content).items;
    assert.equal(new Set(items.map(i => i.EVALUATION_DATA.input.requestInput.sentence)).size, items.length);
    for (const m of r.privateMembers) {
      const id = m.individual.privateBinding.sourceId; assert.equal(['MC05','MC06','MC07','MC08'].includes(id), false);
      coverage.add(id + '|' + r.model + '|' + r.layout);
      if (id === 'MC04') { assert.equal(JSON.parse(JSON.parse(m.individual.requestRaw).input[0].content).EVALUATION_DATA.feedback, null); nulls++; }
    }
  }
  assert.equal(coverage.size, 48); assert.equal(nulls, 6);
  assert.deepEqual(plan.witnesses, plan.witnesses.map(r => bank.rows.find(b => b.id === r.id)));
});

test('48 expected vectors and five axes parse, combine with prior24 once, and cannot grant admission', () => {
  const records = plan.requests.map(r => ({ key:r.key, requestSha256:r.requestSha256, payloadRaw:payload(r) }));
  const result = inspectCalibrationRemainderV1(plan, records, negativeVotes);
  assert.deepEqual([result.newGradeMatches,result.newAxesMatches,result.combinedGradeMatches],[48,48,72]);
  assert.equal(result.observedGradeCriterionSatisfied,true);assert.equal(result.formalCalibrationQualification,false);
  assert.equal(result.mainDispatchAuthorized,false);assert.equal(result.votes.filter(v=>v.grade.meaning==='unavailable').length,6);
  assert.throws(()=>inspectCalibrationRemainderV1(plan,records,negativeVotes.slice(1)),/CRM1_PREVIOUS_VOTES/);
});

test('all18 counts precede18 responses; nonuniform groups preserve48 grades and cannot run twice', async () => {
  const f=fixture(),r=await collectGroupedReviewsV2(f.options);
  assert.equal(r.failureCode,null);assert.equal(r.logicalJudgments,48);assert.equal(f.keys(),1);
  assert.deepEqual(f.events,[...Array(18).fill('count'),...Array(18).fill('model')]);assert.equal(r.actualProviderCalls,0);assert.equal(r.actualCountCalls,0);
  assert.equal(inspectCalibrationRemainderV1(plan,r.records,negativeVotes).combinedGradeMatches,72);
  await assert.rejects(()=>collectGroupedReviewsV2(f.options),{code:'EEXIST'});assert.equal(f.events.length,36);
});

test('changed wires or an understated denominator are rejected before credentials or intents', async () => {
  for(const change of ['body','count','duplicate']) {
    const f=fixture(),p=structuredClone(plan);if(change==='body')p.requests[0].requestRaw+=' ';else if(change==='duplicate')p.requests[1]=p.requests[0];else p.logicalSlots--;
    await assert.rejects(()=>collectGroupedReviewsV2({...f.options,plan:p}));assert.equal(f.keys(),0);assert.equal(readdirSync(f.directory).length,0);
  }
});

test('token/cost cap stops before model calls; an uncertain model attempt holds the cap with no retry',async()=>{
  const f=fixture(),over=await collectGroupedReviewsV2({...f.options,transport:async()=>({status:200,type:'application/json',raw:'{"object":"response.input_tokens","input_tokens":7501}'})});
  assert.equal(over.failureCode,'GRV2_COUNT_SHAPE_OR_LIMIT');assert.equal(over.clientModelAttempts,0);assert.equal(over.combinedUsedUpperMicros,'630000');
  const low=fixture(),cost=await collectGroupedReviewsV2({...low.options,limits:{...limits,maximumMicros:'630000'}});
  assert.equal(cost.failureCode,'GRV2_MEASURED_CAP');assert.equal(cost.clientModelAttempts,0);
  const fail=fixture(),held=await collectGroupedReviewsV2({...fail.options,testFault:(p,k)=>{if(k==='model'&&p==='after-consume')throw Error('synthetic');}});
  assert.equal(held.clientModelAttempts,1);assert.equal(held.combinedUsedUpperMicros,limits.maximumMicros);
  assert.equal(fail.events.filter(e=>e==='model').length,0);
});

test('bounded reservation fits the existing child source and conserves it without reopening old funds',()=>{
  const parent=JSON.parse(readFileSync(resolve(root,'outputs/ai-quality-v147-negative-controls-runtime-20261112/restricted-funding-settlement.json'),'utf8'));
  const quote=quoteGroupedProductReviewV1(plan,plan.requests.map(r=>({key:r.key,countRequestSha256:r.countRequestSha256,inputTokens:7500,provenance:'synthetic-scenario'})));
  const funding=calibrationRemainderFundingV1(parent,BigInt(quote.totalMicros));
  assert.ok(BigInt(quote.totalMicros)<=2846091n);assert.equal(BigInt(funding.assignedMaximumMicros)+BigInt(funding.unassignedProvisionHeldMicros),2846091n);
  assert.equal(funding.generalDebitMicros,'0');assert.equal(funding.newGrantCreated,false);
  assert.throws(()=>calibrationRemainderFundingV1({...parent,restrictedUnusedMicros:'974579'},BigInt(quote.totalMicros)),/CRM1_PARENT_FUNDS/);
});
