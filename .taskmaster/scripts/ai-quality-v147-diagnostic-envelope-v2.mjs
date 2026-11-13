// Six original diagnostic roles, one $5 run. Each request must fit in full
// before dispatch. No token-count endpoint, inferred byte/token limit or retry.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {digest,PROTOCOL,PLAN,validateSpec,costUpperMicros,slotKey} from './ai-quality-v147-budget.mjs';
import {loadDiagnosticEnvelopeV1} from './ai-quality-v147-diagnostic-envelope-v1.mjs';
import {compileCaseReviewPlanV1,inspectCaseReviewResponseV1} from './ai-quality-v147-case-review-v1.mjs';
export const DIAGNOSTIC_ENVELOPE_V2='ai-quality-v147-direct-diagnostic-envelope-v2';
const sha=x=>createHash('sha256').update(x).digest('hex'),check=(v,c)=>{if(!v)throw Error('DE2_'+c);};
const FACTS_SHA='3244932fb505e46781222a9e85dccdbe2bdf6124250deb952a3ff710d1f68462';
export function loadDiagnosticEnvelopeV2(sourceRoot=null){
 const old=loadDiagnosticEnvelopeV1(sourceRoot),file=resolve(old.prepared.root,'outputs/ai-quality-v147-implementation-20261106/phase47/official-five-dollar-facts.json'),raw=readFileSync(file);check(sha(raw)===FACTS_SHA,'FACTS_BINDING');
 const facts=JSON.parse(raw);check(facts.cachePolicy.mode==='explicit'&&facts.cachePolicy.explicitBreakpoints===0&&facts.cachePolicy.cacheWritesAllowed===false&&facts.maximumInputTokens===922000,'CACHE_PROFILE');
 return {old,prepared:old.prepared,facts};
}
export function compileDiagnosticEnvelopeV2(p,mode='evaluation'){
 check(['evaluation','synthetic'].includes(mode),'MODE');
 const canonical=compileCaseReviewPlanV1(p.prepared),order=['gpt-6.1-terra','gpt-6.1-sol','gpt-6-astra'];
 const requests=order.flatMap(m=>canonical.requests.filter(r=>r.modelId===m)).map((r,index)=>{
  const body={...JSON.parse(r.requestRaw),prompt_cache_options:{mode:'explicit'}},requestRaw=JSON.stringify(body);
  const descriptor={phase:'calibration',caseId:'g12-n04-'+r.layout,targetModelId:r.modelId,modelId:r.modelId,role:'calibration',repetition:1,inputTokenMax:922000,outputTokenMax:4096,inputBoundHash:digest({method:'official-max-input-not-measured',inputTokenMax:922000,factsSha256:FACTS_SHA,cacheWritesDisabled:true}),bodyCommitment:sha(requestRaw)};
  return {...r,canonicalRequestRaw:r.requestRaw,requestRaw,sha256:sha(requestRaw),bytes:Buffer.byteLength(requestRaw),descriptor,budgetKey:slotKey(descriptor),batchId:'public-diagnostic-'+index};
 });
 const sourceFiles=['ai-quality-v147-diagnostic-envelope-v2.mjs','ai-quality-v147-diagnostic-live-v2.mjs','ai-quality-v147-budget.mjs','ai-quality-v147-budget-store.mjs'].map(f=>'.taskmaster/scripts/'+f);
 const sourceSeal=digest({protocol:DIAGNOSTIC_ENVELOPE_V2,oldData:p.old.dataSha256,requestBodies:requests.map(r=>r.sha256),sources:Object.fromEntries(sourceFiles.map(f=>[f,sha(readFileSync(resolve(p.prepared.sourceRoot,f)))])),runtime:{node:process.version,platform:process.platform,arch:process.arch}});
 const spec={schemaVersion:1,protocol:PROTOCOL,planId:PLAN,runId:'688a0788-c6f8-47ee-b612-4ae5944d3f4b',mode,sourceSeal,quote:{kind:mode==='evaluation'?'verified-price':'synthetic-test',evidenceHash:FACTS_SHA,regionalNumerator:'11',regionalDenominator:'10',inputFactorNumerator:'1',inputFactorDenominator:'1',models:structuredClone(p.facts.models)},batches:requests.map(r=>({id:r.batchId,requests:[r.descriptor]}))};validateSpec(spec);
 const basis={protocol:DIAGNOSTIC_ENVELOPE_V2,spec,requests,perRequest:requests.map(r=>({key:r.key,modelId:r.modelId,maximumMicros:costUpperMicros(spec,r.descriptor)})),requestedApprovalMicros:'5000000',factsSha256:FACTS_SHA,originalDiagnosticRoles:6,automaticRetry:false,countCallsAllowed:false,inputTokensActuallyMeasured:false,allSixGuaranteedWithinApproval:false,actualEnglishQualityQualified:false};return {...basis,hash:digest(basis)};
}
export function validateDiagnosticApprovalV2(bundle,a){
 const {hash,...basis}=bundle;check(hash===digest(basis),'BUNDLE_HASH');const live=bundle.spec.mode==='evaluation';
 check(a&&a.sessionUserApproved===live&&a.authorizationSource===(live?'current-user-message':'synthetic-fixture')&&a.officialLimitsAndRatesRechecked===true&&a.runId===bundle.spec.runId&&a.bundleHash===bundle.hash&&a.amountMicros==='5000000'&&/^[a-f0-9]{64}$/.test(a.evidenceHash),'USER_APPROVAL_REQUIRED');
 return {schemaVersion:1,protocol:PROTOCOL,runId:bundle.spec.runId,specHash:digest(bundle.spec),kind:live?'user-approval':'synthetic-test',amountMicros:'5000000',evidenceHash:a.evidenceHash};
}
export function inspectDiagnosticResponseV2({prepared,request,payloadRaw}){
 const body=JSON.parse(request.requestRaw);check(JSON.stringify(body.prompt_cache_options)==='{"mode":"explicit"}'&&!request.requestRaw.includes('prompt_cache_breakpoint'),'CACHE_WIRE');delete body.prompt_cache_options;
 check(JSON.stringify(body)===request.canonicalRequestRaw,'CANONICAL_WIRE');
 return inspectCaseReviewResponseV1({prepared,key:request.key,requestRaw:request.canonicalRequestRaw,payloadRaw});
}
