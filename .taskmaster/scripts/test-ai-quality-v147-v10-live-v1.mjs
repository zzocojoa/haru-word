import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { v10FundingV1, settleV10FundingV1, claimV10SourcesV1, inspectV10ReviewsV1, executeV10LiveV1 } from './run-ai-quality-v147-v10-live-v1.mjs';
import { GROUPED_PRODUCT_POLICY_HASH_V2 } from './ai-quality-v147-grouped-product-review-v2.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V2 } from './ai-quality-v147-bilingual-product-review-v2.mjs';

const root=JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json',import.meta.url),'utf8')).baseline.existingDashboardRoot;
const proof=JSON.parse(readFileSync(resolve(root,'outputs/ai-quality-v147-implementation-20261106/phase181/funding-basis.json'),'utf8'));
const plan=JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/withholding-calibration-v10-plan-v1.json',import.meta.url),'utf8'));
const maximum=3727812n;
function records(){return plan.requests.map(r=>({key:r.key,requestSha256:r.requestSha256,payloadRaw:JSON.stringify({groupProtocolHash:GROUPED_PRODUCT_POLICY_HASH_V2,items:r.privateMembers.map(m=>{
  const w=plan.witnesses.find(w=>w.id===m.individual.privateBinding.sourceId),f=w.feedback,changed=f&&!!f.correctedSentence&&f.correctedSentence!==f.original;
  return{itemId:m.itemId,grade:w.expectedGrade,...w.expectedEvidenceAxes,repairContext:f===null?'unavailable':changed?w.expectedEvidenceAxes.learnerContext:'not_applicable',assignmentForm:f===null?'unavailable':changed?'not_specified':'not_applicable',productRubricHash:BILINGUAL_PRODUCT_RUBRIC_HASH_V2,reasonCodes:[f===null?'unavailable':'confirmed']};
})})}));}

test('failed-source closure retains all18 count provisions and the full unknown request maximum',()=>{
  const f=v10FundingV1(proof,maximum);
  assert.equal(f.failedReconciledUpperMicros,'1067082');assert.equal(f.failedRefundMicros,'1739854');assert.equal(f.failedSourceAssignedMicros,'1779009');
  assert.equal(BigInt(f.failedSourceAssignedMicros)+BigInt(f.failedReconciledUpperMicros)+744007n+924902n,4515000n);
  assert.equal(BigInt(f.failedSourceAssignedMicros)+BigInt(f.formalSourceAssignedMicros),maximum);
  assert.equal(BigInt(f.formalSourceAssignedMicros)+BigInt(f.formalProvisionUnassignedMicros),2520000n);
  assert.equal(f.generalDebitMicros,'0');assert.equal(f.newGrantCreated,false);
});
test('uncertain source identity, an active collector or an excessive reservation cannot issue funding',()=>{
  for(const patch of [{failedCollectorProcessCount:1},{formal72DisjointFromPreviouslyClaimed245:false},{failedUnretainedRequestMaximumMicros:'0'},{pastUnbilledContingencyRetainedMicros:'0'}])
    assert.throws(()=>v10FundingV1({...proof,...patch},maximum));
  assert.throws(()=>v10FundingV1(proof,4300000n),/V10_RESERVATION/);
});
test('settlement spends recovered funds first and returns unused formal collateral to its original provision',()=>{
  const f=v10FundingV1(proof,maximum),s=settleV10FundingV1(f,1500000n);
  assert.equal(s.formalSourceUsedUpperMicros,'0');assert.equal(s.formalCountProvisionRetainedMicros,'2520000');assert.equal(s.conditionalRemainingMicros,'846518');
  const used=settleV10FundingV1(f,maximum);assert.equal(used.formalCountProvisionRetainedMicros,f.formalProvisionUnassignedMicros);
  assert.throws(()=>settleV10FundingV1(f,maximum+1n),/V10_SETTLEMENT_LIMIT/);
});
test('source claims are once-only, including a partially preexisting claim set',()=>{
  const d=mkdtempSync(resolve(process.env.QA_OUTPUT_DIR,'claims-'));claimV10SourcesV1(d,{scopeHash:'synthetic'});
  assert.equal(readdirSync(d).length,3);assert.throws(()=>claimV10SourcesV1(d,{scopeHash:'synthetic'}),/V10_SOURCES_ONCE/);assert.equal(readdirSync(d).length,3);
});
test('all72 prospective vectors retain model denominators and critical detection without granting qualification',()=>{
  const r=inspectV10ReviewsV1(plan,records());assert.equal(r.available,72);assert.equal(r.matches,72);assert.equal(r.axesMatches,72);assert.equal(r.observedCriterionSatisfied,true);
  assert.equal(r.formalCalibrationQualification,false);assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.englishTruthCertified,false);
  assert.equal(r.votes.filter(v=>v.grade.meaning==='unavailable').length,6);
});
test('partial or critical-missing results cannot pass, and duplicate votes cannot inflate completion',()=>{
  assert.equal(inspectV10ReviewsV1(plan,records().slice(1)).observedCriterionSatisfied,false);
  const r=records(),index=plan.requests.findIndex(r=>r.privateMembers.some(m=>m.individual.privateBinding.sourceId==='MC05'));
  const body=JSON.parse(r[index].payloadRaw),item=plan.requests[index].privateMembers.find(m=>m.individual.privateBinding.sourceId==='MC05');body.items.find(i=>i.itemId===item.itemId).grade.criticalErrors.approveBadGrammar=false;r[index].payloadRaw=JSON.stringify(body);
  assert.equal(inspectV10ReviewsV1(plan,r).observedCriterionSatisfied,false);
  assert.throws(()=>inspectV10ReviewsV1(plan,[...records(),records()[0]]),/V10_DUPLICATE_VOTE/);
});
test('a foreign live scope is refused before credentials or source claims',async()=>{
  let keys=0;await assert.rejects(()=>executeV10LiveV1('0'.repeat(64),()=>{keys++;return 'synthetic';}),/V10_SCOPE/);assert.equal(keys,0);
});
