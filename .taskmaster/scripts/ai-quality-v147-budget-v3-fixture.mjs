// Wholly synthetic state/price fixtures. No provider bodies, English judgments,
// credentials, approval authority, files or network. Never use as a paid quote.
import {randomUUID} from 'node:crypto';
import {PROTOCOL_V3,PLAN_V3,MODELS_V3,v3SlotKey,digest} from './ai-quality-v147-budget-v3.mjs';
const h=digest('synthetic-v3-fixture-not-a-real-quote-or-source-seal');
export function v3BudgetFixture({stage='pilot-panel',caseCount=1,repeats=1}={}){
 const caseIds=Array.from({length:caseCount},(_,i)=>'fixture-case-'+(i+1)),witnessIds=stage==='pilot-panel'?Array.from({length:12},(_,i)=>'witness-'+(i+1)):[],requests=[];
 function add(value){const d={...value,key:'',bodyKind:value.parentKey===null?'static':'derived',bodyHash:h,maximumBytes:131072,inputTokenMax:1000,outputTokenMax:4096,inputBoundHash:h};d.key=v3SlotKey(d);d.bodyHash=digest({syntheticOnly:true,key:d.key});requests.push(d);return d;}
 if(stage==='reference-preparation')for(const caseId of caseIds){
  const generatorId=MODELS_V3[1],d=add({role:'referenceDraft',phase:'reference',caseId,modelId:generatorId,generatorId,repetition:1,layout:null,parentKey:null});
  for(const modelId of MODELS_V3.filter(m=>m!==generatorId))add({role:'referenceReview',phase:'reference',caseId,modelId,generatorId,repetition:1,layout:null,parentKey:d.key});
 }else{
  for(const caseId of witnessIds)for(const modelId of MODELS_V3)for(const layout of ['input-first','feedback-first'])add({role:'calibration',phase:'calibration',caseId,modelId,generatorId:null,repetition:1,layout,parentKey:null});
  for(const phase of ['baseline','candidate'])for(const generatorId of MODELS_V3)for(const caseId of caseIds)for(let repetition=1;repetition<=repeats;repetition++){
   const d=add({role:'generation',phase,caseId,modelId:generatorId,generatorId,repetition,layout:null,parentKey:null});
   for(const modelId of MODELS_V3.filter(m=>m!==generatorId))for(const layout of ['input-first','feedback-first'])add({role:'review',phase,caseId,modelId,generatorId,repetition,layout,parentKey:d.key});
  }
 }
 return {schemaVersion:3,protocol:PROTOCOL_V3,planId:PLAN_V3,runId:randomUUID(),mode:'synthetic',sourceSeal:h,profile:{stage,caseIds,generationRepeats:repeats,witnessIds},quote:{kind:'synthetic-test',evidenceHash:h,regionalNumerator:'1',regionalDenominator:'1',inputFactorNumerator:'1',inputFactorDenominator:'1',models:Object.fromEntries(MODELS_V3.map(m=>[m,{inputMicrosPerMillion:'1000000',outputMicrosPerMillion:'1000000'}]))},requests,order:requests.map(d=>d.key)};
}
export function v3SyntheticApproval(kernel,amountMicros='1000000000'){
 return {schemaVersion:3,protocol:PROTOCOL_V3,stage:kernel.spec.profile.stage,runId:kernel.spec.runId,specHash:kernel.specHash,kind:'synthetic-test',amountMicros,evidenceHash:h};
}
export function v3SyntheticBinding(kernel,ledger,key){
 const d=kernel.spec.requests.find(d=>d.key===key);if(d.bodyKind==='static')return {bodySha256:d.bodyHash,recipeHash:null,parentKey:null,parentRequestId:null,parentReceiptHash:null,parentOutputHash:null};
 const parent=ledger.slots[d.parentKey];return {bodySha256:digest({syntheticDerived:true,recipe:d.bodyHash,parent:parent.receiptHash,judge:d.modelId,layout:d.layout}),recipeHash:d.bodyHash,parentKey:d.parentKey,parentRequestId:parent.requestId,parentReceiptHash:parent.receiptHash,parentOutputHash:parent.result.outputHash};
}
export function v3SyntheticResult(kernel,ledger,key,{state='completed',usage={inputTokens:20,outputTokens:20}}={}){
 const d=kernel.spec.requests.find(d=>d.key===key),row=ledger.slots[key];return {specHash:kernel.specHash,requestId:row.requestId,modelId:d.modelId,bodySha256:row.binding.bodySha256,state,usage,outputHash:state==='completed'?digest('synthetic-output-'+key):null,captureHash:state==='completed'?digest('synthetic-capture-'+key):null};
}
