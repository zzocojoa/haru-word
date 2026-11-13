// Prospective request preparation and mechanical inspection only. No transport,
// credential access, budget reservation or independent-reference admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {contextReviewInstruction as priorContextInstruction} from './ai-quality-v147-blind-reference-inspection-v2.mjs';
import {contextReviewInstruction,inspectBlindReferenceV3} from './ai-quality-v147-blind-reference-inspection-v3.mjs';
import {inspectBilingualItemV2} from './ai-quality-v147-bilingual-reference-v2.mjs';
import {validateV3Request,validateV3Output} from './ai-quality-v147-wire-v3.mjs';

export const CONTEXT_LANGUAGE_V1='ai-quality-v147-context-language-v1';
const sha=x=>createHash('sha256').update(x).digest('hex');

export function compileContextLanguageV1({priorPlan,parents,wordPolicyPlan}){
 const{hash:priorHash,...priorBasis}=priorPlan;assert.equal(priorHash,digest(priorBasis));
 assert.equal(priorPlan.requests.length,4);assert.equal(parents.cases.length,60);
 assert.equal(wordPolicyPlan.protocol,'ai-quality-v147-bilingual-reference-v2');
 const{hash:wordHash,...wordBasis}=wordPolicyPlan;assert.equal(wordHash,digest(wordBasis));
 const parentMap=new Map(parents.cases.map(c=>[c.caseId,c]));assert.equal(parentMap.size,60);
 for(const parent of parentMap.values()){
  assert.equal(sha(parent.parentBinding.parentRequestRaw),parent.parentBinding.parentRequestSha256);
  assert.deepEqual(JSON.parse(JSON.parse(parent.parentBinding.parentRequestRaw).input[0].content),parent.input);
 }
 const changedInputs=new Set(),requests=[];
 for(const prior of priorPlan.requests){
  assert(['word','grammar'].includes(prior.domain));assert(['gpt-6.1-sol','gpt-6.1-terra'].includes(prior.model));
  const body=validateV3Request(prior.requestRaw,{modelId:prior.model,outputTokenMax:prior.outputMax,maximumBytes:131072});
  assert.equal(sha(prior.requestRaw),prior.requestSha256);
  const bindings=prior.bindings.map(b=>{
   const parent=parentMap.get(b.caseId);assert(parent&&parent.domain===prior.domain);
   return{caseId:b.caseId,reviewer:prior.model,itemId:'item-'+sha(CONTEXT_LANGUAGE_V1+'/'+prior.domain+'/'+prior.model+'/'+b.caseId).slice(0,24),parentRequestSha256:parent.parentBinding.parentRequestSha256,parentInputHash:digest(parent.input)};
  });
  assert.equal(new Set(bindings.map(b=>b.caseId)).size,bindings.length);
  const items=bindings.map(b=>{
   const parent=parentMap.get(b.caseId),oldItem=prior.privateItems.find(i=>i.itemId===prior.bindings.find(x=>x.caseId===b.caseId).itemId);assert(oldItem);
   if(digest(oldItem.assignment)!==digest(parent.input))changedInputs.add(b.caseId);
   assert(!['authorDraft','familyId','stratum','expectedGrade','caseId'].some(k=>Object.hasOwn(parent.input,k)));
   if(prior.domain==='word')assert.equal(parent.input.contextRole,'intended_korean');else assert.equal(parent.input.contextRole,undefined);
   return{itemId:b.itemId,assignment:structuredClone(parent.input),...(prior.domain==='grammar'?{sources:structuredClone(oldItem.sources)}:{})};
  });
  if(prior.domain==='word'){
   const policy=wordPolicyPlan.requests.find(r=>r.model===prior.model);assert(policy);body.instructions=JSON.parse(policy.requestRaw).instructions;
  }else{
   assert.equal(body.instructions.split(priorContextInstruction).length,2,'one known grammar context instruction');
   const packing=body.instructions.indexOf('The user payload is losslessly packed as strings and data.');assert(packing>0);
   body.instructions=body.instructions.slice(0,packing).replace(/\\n$/,'').trimEnd().replace(priorContextInstruction,contextReviewInstruction);
   assert(!body.instructions.includes(priorContextInstruction));
  }
  // Plain item data avoids carrying an obsolete dictionary-decoding directive.
  body.input=[{role:'user',content:JSON.stringify({items})}];
  const itemSchema=structuredClone(prior.privateItemSchema);itemSchema.properties.itemId.enum=bindings.map(b=>b.itemId);
  body.text={format:{type:'json_schema',name:'haru_context_language_v1',strict:true,schema:{type:'object',properties:{items:{type:'array',items:itemSchema,minItems:items.length,maxItems:items.length}},required:['items'],additionalProperties:false}}};
  const requestRaw=JSON.stringify(body),countRequestRaw=JSON.stringify(Object.fromEntries(['model','instructions','input','text','reasoning'].map(k=>[k,body[k]])));
  validateV3Request(requestRaw,{modelId:prior.model,outputTokenMax:prior.outputMax,maximumBytes:131072});
  requests.push({key:prior.key,domain:prior.domain,model:prior.model,bindings,privateItems:items,privateItemSchema:itemSchema,requestRaw,requestSha256:sha(requestRaw),countRequestRaw,countRequestSha256:sha(countRequestRaw),outputMax:prior.outputMax,dispatchEligible:false});
 }
 const cases=new Set(requests.flatMap(r=>r.bindings.map(b=>b.caseId)));assert.equal(cases.size,priorPlan.caseCount);
 for(const caseId of cases){const seats=requests.flatMap(r=>r.bindings.filter(b=>b.caseId===caseId));assert.equal(seats.length,2);assert.notEqual(seats[0].reviewer,seats[1].reviewer);}
 const plan={protocol:CONTEXT_LANGUAGE_V1,parentPlanHash:priorHash,parentInputBindingsHash:digest(parents),requests,caseCount:cases.size,judgmentSlots:requests.reduce((n,r)=>n+r.bindings.length,0),changedInputCaseIds:[...changedInputs].sort(),sourceFactsCopiedExactly:true,inputBindingsOnly:true,newProductPolicyCaptureClaimed:false,authorDraftsShown:false,oldVotesShown:false,productResponsesShown:false,freshnessQualified:false,referenceRoleQualified:false,referencesQualified:0,budgetVerified:false,inputTokensMeasured:false,scopeApproved:false,mainDispatchAuthorized:false,actualProviderCalls:0,actualCountCalls:0,actualKeyReads:0};
 return{...plan,hash:digest(plan)};
}

export function inspectContextLanguageV1(plan,answers){
 const{hash,...basis}=plan;assert.equal(hash,digest(basis));assert.equal(plan.protocol,CONTEXT_LANGUAGE_V1);
 const votes=[];
 for(const r of plan.requests){
  assert.equal(sha(r.requestRaw),r.requestSha256);let items;
  try{const matching=answers.filter(a=>a.key===r.key);assert.equal(matching.length,1);items=validateV3Output(r.requestRaw,matching[0].payloadRaw).items;assert.deepEqual(items.map(x=>x.itemId).sort(),r.bindings.map(b=>b.itemId).sort());}catch{items=null;}
  for(const b of r.bindings){const item=r.privateItems.find(i=>i.itemId===b.itemId),response=items?.find(i=>i.itemId===b.itemId)??null;let parsed=null;
   if(response)try{
    if(r.domain==='word')parsed=inspectBilingualItemV2(item.assignment,response);
    else{const local=JSON.parse(r.requestRaw);local.input=[{role:'user',content:JSON.stringify({assignment:item.assignment,sources:item.sources})}];local.text.format.schema=r.privateItemSchema;parsed=inspectBlindReferenceV3({requestRaw:JSON.stringify(local),sourceIds:item.sources.map(s=>s.id)},response);}
   }catch{/* Preserve raw responses and unavailable seats; never repair labels. */}
   votes.push({...b,domain:r.domain,response,parsed,available:parsed!==null});
  }
 }
 return{protocol:CONTEXT_LANGUAGE_V1,planHash:plan.hash,votes,rawSlots:plan.judgmentSlots,availableVotes:votes.filter(v=>v.available).length,referencesQualified:0,englishTruthCertified:false,mainDispatchAuthorized:false};
}
