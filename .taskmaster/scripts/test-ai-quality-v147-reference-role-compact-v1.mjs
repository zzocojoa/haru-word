import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {REFERENCE_DIMENSIONS,REFERENCE_CRITICAL} from './ai-quality-v147-reference-v4.mjs';
import {compileReferenceRoleCompactV1,restoreReferenceRoleAliasesV1,unpackReferenceRoleStringsV1,decodeReferenceRoleGradeV1,inspectReferenceRoleCompactV1} from './ai-quality-v147-reference-role-compact-v1.mjs';
import {collectReferenceRoleCompactV1} from './ai-quality-v147-reference-role-compact-collector-v1.mjs';

const prepared=compileReferenceRoleCompactV1(),dir=()=>mkdtempSync(resolve(tmpdir(),'reference-role-compact-'));
const syntheticKey='synthetic-reference-role-compact-key';
function records(){
 return prepared.plan.requests.map(r=>({key:r.key,requestSha256:r.requestSha256,payloadRaw:JSON.stringify({
  rubricHash:prepared.plan.policyHash,items:Object.entries(r.privateExpectedByItemId).map(([id,g])=>({
   i:r.privateAliases[id],g:{...Object.fromEntries(REFERENCE_DIMENSIONS.map((d,i)=>['d'+i,g[d]])),
    c:Object.fromEntries(REFERENCE_CRITICAL.map((f,i)=>['c'+i,g.criticalErrors[f]]))},r:['exposure'],e:'Synthetic transport verification only.'}))})}));
}
test('all six full inputs restore exactly, including every source/exposure row, and ambiguity/omission are explicitly separated',()=>{
 assert.equal(prepared.plan.policy.version,4);
 assert(prepared.plan.policy.dimensions.ambiguityHandling.boundary.includes('minimalCorrectionMeaning=fail and ambiguityHandling=pass'));
 assert.equal(Object.keys(prepared.plan.policy.dimensions).length,7);assert.equal(Object.keys(prepared.plan.policy.criticalFlags).length,5);
 for(const r of prepared.plan.requests){
  const b=JSON.parse(r.requestRaw),packed=JSON.parse(b.input[0].content),aliased=unpackReferenceRoleStringsV1(packed);
  assert.deepEqual(restoreReferenceRoleAliasesV1(aliased,r.privateAliases),r.privateOriginalData);
  assert.equal(aliased.items.length,10);assert(packed.strings.length>0);
  assert(!r.requestRaw.includes('privateExpected'));assert(!r.requestRaw.includes('omitted-supported-completion'));
  assert(Buffer.byteLength(r.requestRaw)<60000);assert.equal(b.max_output_tokens,2048);assert.equal(b.store,false);
  const corrupted=structuredClone(packed);corrupted.data={$s:99999};assert.throws(()=>unpackReferenceRoleStringsV1(corrupted),/RRC4_STRING_REFERENCE/);
 }
});
test('every output axis and critical flag survives decoding; a critical miss and duplicate cannot pass',()=>{
 const good=records(),r=prepared.plan.requests[0],row=JSON.parse(good[0].payloadRaw).items[0],decoded=decodeReferenceRoleGradeV1(row,r);
 assert.deepEqual(decoded.grade,r.privateExpectedByItemId[decoded.itemId]);
 const result=inspectReferenceRoleCompactV1(prepared.plan,good);
 assert.equal(result.matched,60);assert.equal(result.referencesQualified,0);assert.equal(result.mainDispatchAuthorized,false);
 const value=JSON.parse(good[0].payloadRaw);value.items[0].g.c.c4=false;good[0].payloadRaw=JSON.stringify(value);
 const bad=inspectReferenceRoleCompactV1(prepared.plan,good);assert.equal(bad.criticalMisses,1);assert.equal(bad.declaredPublicRoleCalibrationPassed,false);
 value.items[1]=value.items[0];good[0].payloadRaw=JSON.stringify(value);assert.throws(()=>inspectReferenceRoleCompactV1(prepared.plan,good),/RRC4_ITEMS/);
});
test('all actual counts precede generation, bounded usage settles, and repeat invocation is rejected',async()=>{
 const events=[],answers=records(),directory=dir();let i=0;
 const transport=async({kind,body})=>{
  events.push(kind);
  if(kind==='count')return{status:200,type:'application/json',raw:JSON.stringify({object:'response.input_tokens',input_tokens:10000})};
  const payload=answers[i++].payloadRaw;
  return{status:200,type:'application/json',raw:JSON.stringify({status:'completed',model:JSON.parse(body).model,service_tier:'default',id:'resp_compact_'+i,
   usage:{input_tokens:10000,output_tokens:1000,total_tokens:11000},output:[{type:'message',content:[{type:'output_text',text:payload}]}]})};
 };
 const t=await collectReferenceRoleCompactV1({prepared,directory,loadKey:async()=>syntheticKey,transport});
 assert.equal(t.failureCode,null);assert.equal(t.inspection.matched,60);assert.deepEqual(events,[...Array(6).fill('count'),...Array(6).fill('model')]);
 assert(BigInt(t.combinedUsedUpperMicros)<=1213206n);
 await assert.rejects(collectReferenceRoleCompactV1({prepared,directory,loadKey:async()=>syntheticKey,transport}),/EEXIST/);
 assert.equal(events.length,12);
});
test('combined measured quote above the remaining grant stops all generation, without treating a context bound as spendable funds',async()=>{
 let models=0;
 const t=await collectReferenceRoleCompactV1({prepared,directory:dir(),loadKey:async()=>syntheticKey,transport:async({kind})=>{
  if(kind==='model')models++;
  return{status:200,type:'application/json',raw:JSON.stringify({object:'response.input_tokens',input_tokens:25000})};
 }});
 assert.equal(t.failureCode,'RRCC1_MEASURED_CAP');assert.equal(t.clientCountAttempts,6);assert.equal(models,0);assert.equal(t.clientModelAttempts,0);
 const bad=structuredClone(prepared);bad.plan.maximumMicros='99999999';bad.hash=digest(bad.plan);
 let reads=0;await assert.rejects(collectReferenceRoleCompactV1({prepared:bad,directory:dir(),loadKey:async()=>{reads++;return syntheticKey;},transport:async()=>{}}),/RRCC1_PLAN/);
 assert.equal(reads,0);
});
test('a credential echo is not persisted and the consumed uncertain model attempt is retained without retransmission',async()=>{
 let models=0;const directory=dir();
 const t=await collectReferenceRoleCompactV1({prepared,directory,loadKey:async()=>syntheticKey,transport:async({kind})=>{
  if(kind==='count')return{status:200,type:'application/json',raw:JSON.stringify({object:'response.input_tokens',input_tokens:10000})};
  models++;return{status:200,type:'application/json',raw:JSON.stringify({unsafe:syntheticKey})};
 }});
 assert.equal(t.failureCode,'RRCC1_CREDENTIAL_OR_JSON');assert.equal(models,1);assert(BigInt(t.unresolvedAttemptUpperMicros)>0n);
 assert(!existsSync(resolve(directory,'model-0-response.json')));
 for(const file of readdirSync(directory))assert(!readFileSync(resolve(directory,file),'utf8').includes(syntheticKey));
});

