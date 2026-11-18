import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { inspectResponseCredentialsV1 } from './ai-quality-v147-response-credential-guard-v1.mjs';
import { collectGroupedReviewsV3 } from './ai-quality-v147-grouped-review-executor-v3.mjs';
import { GROUPED_PRODUCT_POLICY_HASH_V1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';

const key='synthetic-configured-credential-key';
const unknown='sk-proj-'+ 'Z'.repeat(32), ciphertext='opaque_sk-'+ 'A'.repeat(48);
const plan=JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/calibration-remainder-plan-v1.json',import.meta.url),'utf8'));

test('embedded provider markers reproduce the old false positive without being treated as credentials',()=>{
  for(const body of [{id:'task-'+ 'a'.repeat(32)},{id:'resp_public_sk-'+ 'b'.repeat(32)},{output:[{type:'reasoning',encrypted_content:'sk-'+ 'C'.repeat(40)}]}]){
    const raw=JSON.stringify(body);assert.equal(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(raw),true);
    assert.equal(inspectResponseCredentialsV1(raw,key).blocked,false);
  }
});
test('the configured credential is blocked in prose, identifiers, ciphertext, object keys and JSON escapes',()=>{
  for(const body of [{text:'prefix'+key+'suffix'},{id:'resp_'+key},{output:[{type:'reasoning',encrypted_content:'opaque'+key}]},{[key]:'value'}]){
    const raw=JSON.stringify(body);assert.equal(inspectResponseCredentialsV1(raw,key).reason,'configured-key');
    assert.equal(inspectResponseCredentialsV1(raw.replaceAll('-',String.raw`\u002d`),key).reason,'configured-key');
  }
});
test('standalone unknown credential shapes are blocked in content, errors and keys',()=>{
  for(const body of [{text:unknown},{error:{message:'Bearer '+unknown}},{[unknown]:'value'}])
    assert.equal(inspectResponseCredentialsV1(JSON.stringify(body),key).reason,'standalone-key-shape');
});
test('unparseable/nonobject responses fail closed; safe diagnostic metadata cannot include message text or secrets',()=>{
  for(const raw of ['not-json','null','[]'])assert.equal(inspectResponseCredentialsV1(raw,key).blocked,true);
  const r=inspectResponseCredentialsV1(JSON.stringify({id:'resp_public1',model:'gpt-6-astra',usage:{input_tokens:20,output_tokens:30,total_tokens:50},output:[{text:key}],arbitrary:key}),key);
  assert.deepEqual(r.metadata,{providerResponseId:'resp_public1',providerModel:'gpt-6-astra',providerUsage:{input_tokens:20,output_tokens:30,total_tokens:50}});
  assert.equal(JSON.stringify(r).includes(key),false);
});

function fixture(secret=false){
  const directory=mkdtempSync(resolve(process.env.QA_OUTPUT_DIR,'guard-')),events=[];let n=0;
  const transport=async({kind,body})=>{
    events.push(kind);if(kind==='count')return{status:200,type:'application/json',raw:'{"object":"response.input_tokens","input_tokens":5000}'};
    const b=JSON.parse(body),r=plan.requests[n++];
    const items=r.privateMembers.map(m=>{
      const row=plan.witnesses.find(w=>w.id===m.individual.privateBinding.sourceId),f=row.feedback,changed=f&&!!f.correctedSentence&&f.correctedSentence!==f.original;
      return{itemId:m.itemId,grade:row.expectedGrade,...row.expectedEvidenceAxes,repairContext:f===null?'unavailable':changed?row.expectedEvidenceAxes.learnerContext:'not_applicable',
        assignmentForm:f===null?'unavailable':changed?'not_specified':'not_applicable',reasonCodes:[f===null?'unavailable':'confirmed'],productRubricHash:BILINGUAL_PRODUCT_RUBRIC_HASH_V1};
    });
    return{status:200,type:'application/json',raw:JSON.stringify({id:'resp_synthetic_'+n,model:b.model,status:'completed',service_tier:'default',usage:{input_tokens:5000,output_tokens:600,total_tokens:5600},
      output:[{type:'reasoning',encrypted_content:secret?key:ciphertext},{type:'message',content:[{type:'output_text',text:JSON.stringify({groupProtocolHash:GROUPED_PRODUCT_POLICY_HASH_V1,items})}]}]})};
  };
  return{directory,events,options:{plan,directory,transport,loadKey:()=>key,limits:{requests:18,judgments:48,maximumInputTokens:7500,maximumMicros:'2806936'}}};
}
test('v3 retains all48 grades with embedded ciphertext markers and reports mock calls as zero actual calls',async()=>{
  const f=fixture(),r=await collectGroupedReviewsV3(f.options);assert.equal(r.failureCode,null);assert.equal(r.logicalJudgments,48);
  assert.equal(r.actualProviderCalls,0);assert.equal(r.actualCountCalls,0);assert.equal(f.events.length,36);
  const capture=JSON.parse(readFileSync(resolve(f.directory,'model-0-capture.json'),'utf8'));assert.equal(capture.embeddedCredentialMarkerIgnored,true);
  await assert.rejects(()=>collectGroupedReviewsV3(f.options),{code:'EEXIST'});
});
test('v3 still stops once for an exact credential, retains only safe identity/usage and never persists it',async()=>{
  const f=fixture(true),r=await collectGroupedReviewsV3(f.options);assert.equal(r.failureCode,'GRV3_SECRET_ECHO');assert.equal(r.clientModelAttempts,1);
  const capture=JSON.parse(readFileSync(resolve(f.directory,'model-0-capture.json'),'utf8'));assert.equal(capture.guardReason,'configured-key');assert.equal(capture.providerResponseId,'resp_synthetic_1');assert.equal(capture.rawPersisted,false);
  for(const file of readdirSync(f.directory))assert.equal(readFileSync(resolve(f.directory,file),'utf8').includes(key),false);
});
