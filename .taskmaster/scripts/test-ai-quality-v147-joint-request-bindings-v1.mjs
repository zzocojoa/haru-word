import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadJointCohortContextV1} from './ai-quality-v147-joint-cohort-draft-v1.mjs';
import {buildJointRequestBindingsV1} from './ai-quality-v147-joint-request-bindings-v1.mjs';
const c=loadJointCohortContextV1(),read=f=>JSON.parse(readFileSync(resolve(c.root,f)));
const bank=read('outputs/ai-quality-v147-implementation-20261106/phase191/joint-candidate-draft.json');
const capture=read('outputs/ai-quality-v147-implementation-20261106/phase192/captured-application-bodies.json');
const run=x=>buildJointRequestBindingsV1({bank,capture:x,lessons:c.lessons}),sha=s=>createHash('sha256').update(s).digest('hex');
function replaceInput(row,mutate){
 const body=JSON.parse(row.requestRaw),input=JSON.parse(body.input[0].content);mutate(input);
 body.input[0].content=JSON.stringify(input);row.requestRaw=JSON.stringify(body);row.requestSha256=sha(row.requestRaw);row.input=input;
}
test('all360 actual built-API bodies bind to60 post-seal drafts; Korean-role intervention and grammar equivalence stay explicit',()=>{
 const r=run(capture);
 assert.equal(r.cases.length,60);assert.equal(r.counts.parentCandidateRequests,180);assert.equal(r.counts.baselineRequests,180);
 assert.equal(r.counts.candidateExplicitKoreanRequests,90);assert.equal(r.counts.grammarProfileInputEqualPairs,90);
 for(const item of r.cases){
  assert.equal(item.parentRequests.length,3);assert.equal(item.baselineRequests.length,3);
  assert.deepEqual(item.baselineInputDifferenceFields,item.domain==='word'?['contextRole']:[]);
  assert.equal(item.parentIsUnsubmittedProductRequest,true);assert.equal(item.parentModelIsReferenceAuthor,false);
  assert.equal(item.actualProductGenerationObserved,false);assert.equal(item.referenceQualified,false);
 }
 assert.equal(r.actualProviderCalls,0);assert.equal(r.actualProductGenerations,0);assert.equal(r.mainDispatchAuthorized,false);
});
test('transplanting a source record, losing a cell or duplicating a model request cannot produce a qualified binding',()=>{
 const a=structuredClone(capture);a.records.pop();assert.throws(()=>run(a),/JRB1_CAPTURE_DENOMINATOR/);
 const b=structuredClone(capture);b.records[1]=structuredClone(b.records[0]);assert.throws(()=>run(b),/JRB1_IDENTITY/);
 const d=structuredClone(capture);d.records[0].caseId=bank.cases[1].id;
 assert.throws(()=>run(d),/JRB1_COHORT_INPUT|JRB1_IDENTITY/);
});
test('changing Korean intent or its explicit role is rejected even with a recomputed body hash',()=>{
 const a=structuredClone(capture),word=a.records.find(r=>r.profile==='candidate'&&r.domain==='word');
 replaceInput(word,input=>{input.contextNote+=' 다른 뜻';});
 assert.throws(()=>run(a),/JRB1_COHORT_INPUT/);
 const b=structuredClone(capture),row=b.records.find(r=>r.profile==='candidate'&&r.domain==='word');
 replaceInput(row,input=>{delete input.contextRole;});assert.throws(()=>run(b),/JRB1_INTENT_ROLE/);
 const d=structuredClone(capture),privateRow=d.records[0];replaceInput(privateRow,input=>{input.authorDraft={grammar:'natural'};});
 assert.throws(()=>run(d),/JRB1_PRIVATE_LABEL/);
});
test('failure receipts and synthetic-only provenance cannot be relabeled as actual model success or safe duplicate behavior',()=>{
 const a=structuredClone(capture);a.actualProviderCalls=1;assert.throws(()=>run(a),/JRB1_SYNTHETIC_SCOPE/);
 const b=structuredClone(capture);b.records[0].duplicateProviderResends=1;assert.throws(()=>run(b),/JRB1_FAILURE_RECEIPT/);
 const d=structuredClone(capture);d.records[0].httpStatus=200;d.records[0].languageQualityMeasured=true;
 assert.throws(()=>run(d),/JRB1_FAILURE_RECEIPT/);
});

