import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { digest } from './ai-quality-v147-budget-v3.mjs';
import { compileReferenceRoleContinuationV3, collectReferenceRoleV3 } from './ai-quality-v147-reference-role-collector-v3.mjs';
const prepared=compileReferenceRoleContinuationV3(), key='synthetic-reference-role-continuation-key';
const directory=()=>mkdtempSync(resolve(tmpdir(),'reference-role-v3-'));

test('unchanged physical request/count binding is reused, then only five counts precede six responses',async()=>{
 const events=[],dir=directory();let models=0;
 const transport=async({kind,body})=>{
  events.push(kind);
  if(kind==='count')return {status:200,type:'application/json',raw:JSON.stringify({object:'response.input_tokens',input_tokens:28387})};
  const r=prepared.plan.requests[models++],items=Object.entries(r.privateExpectedByItemId).map(([itemId,grade])=>({itemId,grade,
   reasonCodes:['exposure'],shortEvidenceSummary:'Synthetic continuation and budget verification only.'}));
  const payload=JSON.stringify({rubricHash:prepared.plan.policyHash,items});
  return {status:200,type:'application/json',raw:JSON.stringify({status:'completed',model:JSON.parse(body).model,service_tier:'default',id:'resp_test_'+models,
   usage:{input_tokens:28387,output_tokens:500,total_tokens:28887},output:[{type:'message',content:[{type:'output_text',text:payload}]}]})};
 };
 const t=await collectReferenceRoleV3({prepared,directory:dir,loadKey:async()=>key,transport});
 assert.equal(t.failureCode,null);assert.equal(t.inspection.matched,60);assert.equal(t.clientCountAttempts,5);
 assert.equal(t.receipts.length,6);assert.deepEqual(events,[...Array(5).fill('count'),...Array(6).fill('model')]);
 assert.equal(t.countProvisionMicros,'175000');assert.equal(prepared.plan.reusedCount.inputTokens,28387);
 assert(BigInt(t.combinedUsedUpperMicros)<=BigInt(prepared.plan.maximumMicros));
 assert(!existsSync(resolve(dir,'count-0-intent.json')));
 await assert.rejects(collectReferenceRoleV3({prepared,directory:dir,loadKey:async()=>key,transport}),/EEXIST/);
});
test('a new over-ceiling count stops all generation; altered prior receipt cannot be substituted',async()=>{
 const events=[],t=await collectReferenceRoleV3({prepared,directory:directory(),loadKey:async()=>key,transport:async({kind})=>{
  events.push(kind);return {status:200,type:'application/json',raw:JSON.stringify({object:'response.input_tokens',input_tokens:30001})};
 }});
 assert.equal(t.failureCode,'RRCX3_COUNT_LIMIT');assert.equal(t.clientModelAttempts,0);assert.deepEqual(events,['count']);
 const bad=structuredClone(prepared);bad.plan.reusedCount.inputTokens=1;bad.hash=digest(bad.plan);
 let reads=0;await assert.rejects(collectReferenceRoleV3({prepared:bad,directory:directory(),loadKey:async()=>{reads++;return key;},transport:async()=>{throw Error('unused');}}),/RRCX3_PLAN/);
 assert.equal(reads,0);
});

