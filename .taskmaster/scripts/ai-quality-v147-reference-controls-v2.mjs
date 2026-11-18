// Offline preparation of public reference-review controls. No transport, key IO,
// English-truth certification or real reviewer qualification is implemented here.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {digest,MODELS_V3} from './ai-quality-v147-budget-v3.mjs';
import {projectGlobalExposureV1,globalExposureMatchesV1} from './ai-quality-v147-global-exposure-v1.mjs';
import {REFERENCE_DIMENSIONS,REFERENCE_CRITICAL,validateReferenceAssignmentV4,validateReferenceDraftV4,validateReferenceGradeV4,referencePublicControlRequestV4,referenceReviewBindingV4,validateReferenceReviewV4} from './ai-quality-v147-reference-v4.mjs';
import {validateV3Request} from './ai-quality-v147-wire-v3.mjs';
export const REFERENCE_CONTROLS_V2='ai-quality-v147-public-reference-controls-v2';
const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),FILE='.taskmaster/evaluation/ai-quality-v147/reference-controls-v2.json';
const read=f=>JSON.parse(readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex'),textSha=x=>createHash('sha256').update(x).digest('hex'),check=(ok,c)=>{if(!ok)throw Error('RC2_'+c);};
const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
export function loadReferenceControlsV2(sourceRoot=null){
 const source=sourceRoot??read(resolve(HERE,'.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.sourceRoot,data=read(resolve(source,FILE)),root=read(resolve(source,'.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot;
 check(data.protocol===REFERENCE_CONTROLS_V2&&data.schemaVersion===2&&data.stage==='source-reviewed-proposed-vectors-not-independent-role-qualification','PROTOCOL');
 for(const [f,h]of Object.entries(data.sourceBindings))check(sha(resolve(source,f))===h,'SOURCE_BINDING');
 check(digest(data.dimensions)===digest(REFERENCE_DIMENSIONS)&&digest(data.criticalFlags)===digest(REFERENCE_CRITICAL)&&data.sources.length===5&&data.controls.length===6,'SCOPE');
 check(new Set(data.sources.map(s=>s.id)).size===5&&new Set(data.controls.map(c=>c.id)).size===6,'DUPLICATE');
 for(const row of data.sources){
  const url=new URL(row.url);check(url.protocol==='https:'&&['dictionary.cambridge.org','learnenglish.britishcouncil.org'].includes(url.hostname),'SOURCE_URL');
  check(row.excerptWords===row.excerpt.split(/\s+/).length&&row.excerptWords<=25&&row.excerptSha256===textSha(row.excerpt)&&row.excerptFound&&row.fullCopyrightedPagePersisted===false,'EXCERPT');
  check(/^phase40\/control-source-(?:fetch-first|web-excerpt)\.json$/.test(row.captureFile),'CAPTURE_SCOPE');const f=resolve(root,'outputs/ai-quality-v147-implementation-20261106',row.captureFile);check(sha(f)===row.captureSha256,'CAPTURE_BINDING');const original=read(f).rows.find(s=>s.id===row.id);check(original&&digest(original)===digest(Object.fromEntries(Object.keys(original).map(k=>[k,row[k]]))),'CAPTURE_ROW');
  check(row.status===200&&/^[a-f0-9]{64}$/.test(row.rawPageSha256)||row.status===null&&row.rawPageSha256===null&&row.contentHashScope.includes('excerpt only'),'CAPTURE_METHOD');
 }
 for(const c of data.controls){
  validateReferenceGradeV4(c.proposedExpectedGrade);check(fields(c.dimensionRationale,REFERENCE_DIMENSIONS)&&fields(c.criticalRationale,REFERENCE_CRITICAL)&&c.allSevenDimensionsExplicit===true,'EXPLICIT_CELLS');
  check(c.sourceIds.length>0&&c.sourceIds.length<=4&&new Set(c.sourceIds).size===c.sourceIds.length&&c.sourceIds.every(id=>data.sources.some(s=>s.id===id)),'MEMBERSHIP');
  for(const d of REFERENCE_DIMENSIONS){const a=c.dimensionRationale[d];check(fields(a,['grade','sourceIds','reason'])&&a.grade===c.proposedExpectedGrade[d]&&a.reason.length>20&&a.sourceIds.every(id=>c.sourceIds.includes(id)),'RATIONALE');}
  check(c.sourceReview==='same-author-Codex-source-based-proposal'&&c.independentlyAiQualified===false&&c.allowedInHiddenEvaluation===false,'CLAIMS');
 }
 check(data.actualProviderCalls===0&&data.actualJudgeCalls===0&&data.actualReferenceControlsQualified===false&&data.actualRoleQualificationMeasured===false&&data.actualEnglishQualityMeasured===false&&data.historicGoldOrScoresModified===false&&data.liveDispatchAuthorized===false&&data.newPaidApprovalUsd===0,'NO_LIVE_CLAIMS');
 const corpusFile='.taskmaster/evaluation/ai-quality-v147/global-exposure-corpus-v1.json',globalCorpus=read(resolve(source,corpusFile));
 for(const c of data.controls)check(globalExposureMatchesV1(globalCorpus,c.input,'public-controls-v2-unknown-family').length>0&&c.proposedExpectedGrade.exposureAndFamilyCompliance==='fail'&&c.proposedExpectedGrade.criticalErrors.knownExposureLeak===true,'PUBLIC_EXPOSURE');
 return {sourceRoot:source,root,data,globalCorpus,dataSha256:sha(resolve(source,FILE)),dataSeal:digest(data),corpusSeal:digest(globalCorpus)};
}
export function controlSourcePackV2(data,sourceIds){
 const sources=sourceIds.map(id=>{const s=data.sources.find(s=>s.id===id);check(s,'UNKNOWN_SOURCE');return Object.fromEntries(['id','url','checkedAt','contentSha256','excerpt'].map(k=>[k,s[k]]));});
 const basis={id:'public-reference-sources',sources,level:'source-checked',provenanceHash:digest({protocol:REFERENCE_CONTROLS_V2,sourceIds,sources})};return {...basis,hash:digest(basis)};
}
function assignment(c,p,suffix){return {caseId:'public-reference-'+suffix,domain:'grammar',targetKey:c.targetKey,targetSummary:c.targetSummary,stratum:c.stratum,familyId:'public-reference-family-'+suffix,familyBrief:'Public diagnostic record already exposed;not an independent hidden family.',lengthBand:'ordinary',complexityBand:'simple',permittedSourcePackId:p.id,permittedSourceIds:[...c.sourceIds],sourcePackHash:p.hash,exposureInventoryHash:digest('unprojected')};}
function bind(a,e){const basis={...a,exposureInventoryHash:e.hash};return {...basis,assignmentHash:digest(basis)};}
function record(c,a){return {caseId:a.caseId,assignmentHash:a.assignmentHash,domain:a.domain,targetKey:c.draftTargetKey,familyId:a.familyId,familyRationale:'Public diagnostic material;not a fresh assessment family.',input:structuredClone(c.input),expectedOriginal:structuredClone(c.expectedOriginal),acceptedCorrectionExamples:[...c.acceptedCorrectionExamples],criterion:c.criterion,sourceIds:[...c.sourceIds],evidenceLevelClaim:'unresolved',unresolved:true,reasonCodes:['family-exposure-uncertain']};}
function nonceFor(key,reverse){for(let i=0;i<100;i++){const n=digest({protocol:REFERENCE_CONTROLS_V2,key,i});if((parseInt(n.slice(-1),16)%2===1)===reverse)return n;}throw Error('RC2_NONCE');}
export function compileReferenceControlPlanV2(prepared){
 check(digest(prepared.data)===prepared.dataSeal&&digest(prepared.globalCorpus)===prepared.corpusSeal,'PREPARATION_CHANGED');const {data,globalCorpus}=prepared,anchor=data.controls.find(c=>c.id==='public-positive-agreement');check(anchor,'ANCHOR');const requests=[];
 for(const c of data.controls){
  const p=controlSourcePackV2(data,anchor.sourceIds),cp=controlSourcePackV2(data,c.sourceIds),a0=assignment(anchor,p,'anchor'),ca0=assignment(c,cp,c.id),e=projectGlobalExposureV1(globalCorpus,a0,ca0),a=bind(a0,e),ca=bind(ca0,e);
  validateReferenceAssignmentV4(a,p);validateReferenceAssignmentV4(ca,cp);const parent=record(anchor,a),control={assignment:ca,sourcePack:cp,draft:record(c,ca)};validateReferenceDraftV4(parent,a,p);
  for(const modelId of MODELS_V3)for(const layout of ['candidate-first','control-first']){
   const key=c.id+'/'+modelId+'/'+layout,nonce=nonceFor(key,layout==='control-first'),binding=referenceReviewBindingV4({protocol:'ai-quality-v147-reference-v4',nonce}),requestRaw=referencePublicControlRequestV4({modelId,anchor:{assignment:a,sourcePack:p,draft:parent},control,nonce,exposureEvidence:e}),materialized=JSON.parse(JSON.parse(requestRaw).input[0].content);validateV3Request(requestRaw,{modelId,outputTokenMax:4096,maximumBytes:131072});
   const expectedByItemId={[binding.draftItemId]:structuredClone(anchor.proposedExpectedGrade),[binding.controlItemId]:structuredClone(c.proposedExpectedGrade)};
   check(materialized.REFERENCE_REVIEW_ITEMS.items[0].itemId===(layout==='control-first'?binding.controlItemId:binding.draftItemId),'LAYOUT');
   requests.push({key,controlId:c.id,modelId,layout,requestRaw,requestSha256:textSha(requestRaw),bytes:Buffer.byteLength(requestRaw),privateExpectedByItemId:expectedByItemId,exposureEntries:e.entries.length});
  }
 }
 check(requests.length===36&&new Set(requests.map(r=>r.key)).size===36,'REQUEST_COUNT');return {protocol:REFERENCE_CONTROLS_V2,controlDataSha256:prepared.dataSha256,globalCorpusHash:globalCorpus.hash,requests,proposedReviewRequests:36,additionalCallsApproved:0,alreadyIncludedIn180Or1872:false,finalStageCountAndCostRecalculationRequired:true,actualProviderCalls:0,actualRoleQualificationMeasured:false,actualReferenceControlsQualified:false,actualEnglishQualityMeasured:false,liveDispatchAuthorized:false};
}
export function evaluateControlReviewResponseV2({prepared,key,requestRaw,payloadRaw}){
 const r=compileReferenceControlPlanV2(prepared).requests.find(r=>r.key===key);check(r&&r.requestRaw===requestRaw,'REQUEST_BINDING');
 return evaluateResponse(r,payloadRaw);
}
function evaluateResponse(r,payloadRaw){
 const {key,requestRaw}=r;
 let v;try{const items=JSON.parse(JSON.parse(requestRaw).input[0].content).REFERENCE_REVIEW_ITEMS;v=validateReferenceReviewV4(JSON.parse(payloadRaw),items.items,items.exposureEvidence);}catch(error){return {key,matched:false,failureCode:/^(REF4|EX1)_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'RC2_RESPONSE_SHAPE',mismatches:[],actualRoleQualificationMeasured:false};}
 const mismatches=[];for(const row of v.items){const expected=r.privateExpectedByItemId[row.itemId];for(const d of REFERENCE_DIMENSIONS)if(row.grade[d]!==expected[d])mismatches.push({itemId:row.itemId,dimension:d,expected:expected[d],actual:row.grade[d]});for(const flag of REFERENCE_CRITICAL)if(row.grade.criticalErrors[flag]!==expected.criticalErrors[flag])mismatches.push({itemId:row.itemId,criticalFlag:flag,expected:expected.criticalErrors[flag],actual:row.grade.criticalErrors[flag]});}
 return {key,matched:mismatches.length===0,failureCode:mismatches.length?'RC2_PROPOSED_GRADE_MISMATCH':null,mismatches,actualRoleQualificationMeasured:false};
}
export function evaluateControlReviewBatchV2({prepared,records}){
 const plan=compileReferenceControlPlanV2(prepared),keys=new Set(plan.requests.map(r=>r.key));check(Array.isArray(records)&&records.length===36&&new Set(records.map(r=>r.key)).size===36&&records.every(r=>keys.has(r.key)),'FIXED_DENOMINATOR');
 const rows=records.map(record=>{const r=plan.requests.find(r=>r.key===record.key);check(record.requestRaw===r.requestRaw,'REQUEST_BINDING');return evaluateResponse(r,record.payloadRaw);});return {protocol:REFERENCE_CONTROLS_V2,denominator:36,matched:rows.filter(r=>r.matched).length,proposalAgreementSatisfied:rows.every(r=>r.matched),rows,actualProviderCalls:0,actualRoleQualificationMeasured:false,actualReferenceControlsQualified:false,actualEnglishQualityMeasured:false,providerReceiptAuthenticated:false,humanReviewed:false,liveDispatchAuthorized:false,releaseVerdict:'held'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const prepared=loadReferenceControlsV2(),plan=compileReferenceControlPlanV2(prepared);if(process.env.QA_OUTPUT_DIR){mkdirSync(resolve(process.env.QA_OUTPUT_DIR),{recursive:false});writeFileSync(resolve(process.env.QA_OUTPUT_DIR,'control-review-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});}console.log(JSON.stringify({publicControls:6,explicitDimensionCells:42,proposedReviewRequests:36,actualProviderCalls:0,actualRoleQualificationMeasured:false,actualReferenceControlsQualified:false,liveDispatchAuthorized:false}));
}
