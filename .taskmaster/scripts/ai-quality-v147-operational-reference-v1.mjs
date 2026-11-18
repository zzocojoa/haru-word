// Opt-in synthetic reference-preparation integration. Reuses the existing
// journal, physical capture and recovery; never rewrites raw evidence.
import {createHash} from 'node:crypto';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {compileV3Wire,validateV3Request,parseV3Json} from './ai-quality-v147-wire-v3.mjs';
import {REFERENCE_V4,referenceReviewTemplateV4,materializeReferenceReviewV4,referenceReviewBindingV4,referenceDraftRequestV4,validateReferenceDraftV4,validateReferenceAssignmentV4,validateReferenceGradeV4,referenceGradeStateV4,validateReferenceExposurePolicyV4} from './ai-quality-v147-reference-v4.mjs';
import {REFERENCE_RUBRIC_V1,REFERENCE_RUBRIC_HASH_V1,referenceRubricInstructionsSuffixV1,validateOperationalReferenceReviewV1} from './ai-quality-v147-reference-rubric-v1.mjs';
import {GLOBAL_EXPOSURE_V1,globalExposureMatchesV1} from './ai-quality-v147-global-exposure-v1.mjs';
import {EXPOSURE_V1} from './ai-quality-v147-exposure-v1.mjs';
import {INPUT_COUNT_V1} from './ai-quality-v147-input-count-v1.mjs';
export const OPERATIONAL_REFERENCE_V1='ai-quality-v147-operational-reference-runtime-v1';
const check=(ok,c)=>{if(!ok)throw Error('OR1_'+c);},sha=x=>createHash('sha256').update(x).digest('hex');
export const operationalReferencePolicyV1=()=>({protocol:REFERENCE_RUBRIC_V1,hash:REFERENCE_RUBRIC_HASH_V1,required:true,kind:'synthetic-only'});
const component=()=>digest({reference:REFERENCE_V4,operationalRubric:operationalReferencePolicyV1()});
export function assertOperationalReferenceCaptureV1({spec,seal}){check(spec.mode==='synthetic'&&spec.profile.stage==='reference-preparation'&&seal.payload.components.referenceProtocol===component(),'CAPTURE_POLICY');}
export function verifyOperationalReferencePolicyV1({spec,seal,inputs}){
 const p=inputs.contract.referenceOperationalRubric;if(p===undefined)return false;
 check(digest(p)===digest(operationalReferencePolicyV1())&&inputs.contract.protocol===REFERENCE_V4,'POLICY');assertOperationalReferenceCaptureV1({spec,seal});
 const count=inputs.contract.inputCountPolicy;check(count?.protocol===INPUT_COUNT_V1&&count.kind==='synthetic-only'&&count.required===true,'INPUT_COUNT_REQUIRED');
 check(seal.payload.components.rubric===digest(inputs.contract),'FROZEN_POLICY');return true;
}
export function operationalReferenceTemplateV1(options){
 const wire=parseV3Json(referenceReviewTemplateV4(options));wire.instructions+=referenceRubricInstructionsSuffixV1();wire.text.format.name='reference_review_operational_v1';
 wire.text.format.schema.properties.rubricHash={type:'string',enum:[REFERENCE_RUBRIC_HASH_V1]};wire.text.format.schema.required.push('rubricHash');
 const raw=JSON.stringify(wire);validateV3Request(raw,{modelId:wire.model,outputTokenMax:4096,maximumBytes:131072});return raw;
}
export function materializeOperationalReferenceWireV1(templateRaw,parent){
 const wire=parseV3Json(templateRaw);check(wire.text?.format?.name==='reference_review_operational_v1'&&wire.instructions.endsWith(referenceRubricInstructionsSuffixV1()),'RECIPE_POLICY');
 wire.input[0].content=JSON.stringify(materializeReferenceReviewV4(parseV3Json(wire.input[0].content),parent));
 const raw=JSON.stringify(wire);validateV3Request(raw,{modelId:wire.model,outputTokenMax:4096,maximumBytes:131072});return raw;
}
export function compileOperationalReferenceWireV1({seal,spec}){
 assertOperationalReferenceCaptureV1({spec,seal});const base=compileV3Wire({seal,spec});
 return Object.freeze({...base,prepare(args){
  base.verify(args.current);const d=base.spec.requests.find(x=>x.key===args.key);check(d,'REQUEST_KEY');if(d.role!=='referenceReview')return base.prepare(args);
  const row=args.ledger?.slots?.[d.key],parent=args.parentCapture,p=args.ledger?.slots?.[d.parentKey];
  check(Object.isFrozen(args.ledger)&&Object.isFrozen(row)&&row?.state==='reserved'&&args.ledger.specHash===base.specHash&&!args.ledger.closed&&!args.ledger.hold&&row.descriptorHash===digest(d)&&row.requestId===base.requestId(d.key),'UNSENT_SLOT');
  check(d.bodyKind==='derived'&&Object.keys(args.wire).join('|')==='templateRaw'&&sha(args.wire.templateRaw)===d.bodyHash,'RECIPE_BINDING');validateV3Request(args.wire.templateRaw,d);
  check(p?.state==='completed'&&parent?.committed===true&&parent.sourceSeal===seal.hash&&parent.specHash===base.specHash&&parent.runId===base.spec.runId&&digest(parent.result)===digest(p.result)&&parent.receiptHash===p.receiptHash&&sha(parent.payloadRaw)===p.result.outputHash,'PHYSICAL_PARENT');
  const raw=materializeOperationalReferenceWireV1(args.wire.templateRaw,parseV3Json(parent.payloadRaw)),binding={bodySha256:sha(raw),recipeHash:d.bodyHash,parentKey:d.parentKey,parentRequestId:p.requestId,parentReceiptHash:p.receiptHash,parentOutputHash:p.result.outputHash};validateV3Request(raw,d);
  check(!row.binding||digest(row.binding)===digest(binding),'REBIND');return {raw,binding,bindOperation:row.binding?null:{kind:'bind',key:d.key,binding},bodyBytes:Buffer.byteLength(raw),sourceSeal:seal.hash,wireEqualityVerified:true,inputTokenBoundVerified:false,providerReceiptAuthenticated:false,realDispatchAuthorized:false};
 }});
}
export function buildOperationalReferenceReportV1({spec,seal,ledger,store,inputs}){
 check(verifyOperationalReferencePolicyV1({spec,seal,inputs}),'POLICY_REQUIRED');const exposureRequired=validateReferenceExposurePolicyV4(inputs),global=inputs.contract.exposurePolicy?.protocol===GLOBAL_EXPOSURE_V1?inputs.globalExposureCorpus:null;
 const rows=inputs.cases.map(c=>{
  const p=c.referencePreparation;check(p,'PREPARATION');validateReferenceAssignmentV4(p.assignment,p.sourcePack);validateReferenceGradeV4(p.controlExpectedGrade);check(c.id===p.assignment.caseId&&c.familyId===p.assignment.familyId&&c.domain===p.assignment.domain&&c.stratum===p.assignment.stratum,'ASSIGNMENT');
  const author=spec.requests.find(d=>d.role==='referenceDraft'&&d.caseId===c.id);check(author,'AUTHOR');const children=spec.requests.filter(d=>d.parentKey===author.key),raw=[],votes=[];let draft=null,terminalFailure=false,controlFailure=false;
  for(const d of [author,...children]){
   const row=ledger.slots[d.key];if(!row||!['completed','failed','unknown'].includes(row.state))continue;const cap=store.read({ledger,key:d.key});raw.push({key:d.key,requestId:row.requestId,role:d.role,modelId:d.modelId,state:row.state,receiptHash:row.receiptHash,captureHash:cap.result.captureHash,outputHash:cap.result.outputHash,requestSha256:sha(cap.requestRaw),rubricHash:d.role==='referenceReview'?REFERENCE_RUBRIC_HASH_V1:null});
   if(row.state!=='completed'){terminalFailure=true;continue;}
   if(d===author){check(cap.requestRaw===referenceDraftRequestV4({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,exposureEvidence:p.exposureEvidence??null}),'AUTHOR_WIRE');draft=validateReferenceDraftV4(parseV3Json(cap.payloadRaw),p.assignment,p.sourcePack,p.exposureEvidence??null);continue;}
   check(draft&&d.modelId!==author.modelId,'NONSELF_REVIEW');const template=operationalReferenceTemplateV1({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,control:p.control,nonce:p.reviewNonces[d.modelId],exposureEvidence:p.exposureEvidence??null}),recipe=parseV3Json(parseV3Json(template).input[0].content),binding=referenceReviewBindingV4(recipe.REFERENCE_DATA.context);
   check(cap.requestRaw===materializeOperationalReferenceWireV1(template,draft),'REVIEW_WIRE');const parsed=validateOperationalReferenceReviewV1({requestRaw:cap.requestRaw,payloadRaw:cap.payloadRaw}).value,control=parsed.items.find(x=>x.itemId===binding.controlItemId),candidate=parsed.items.find(x=>x.itemId===binding.draftItemId),controlMatches=digest(control.grade)===digest(p.controlExpectedGrade);controlFailure||=!controlMatches;votes.push({modelId:d.modelId,requestId:row.requestId,grade:candidate.grade,controlMatches,rubricHash:parsed.rubricHash});
  }
  const matches=global&&draft?globalExposureMatchesV1(global,draft.input,p.assignment.familyId):[];let state='held-incomplete';
  if(terminalFailure)state='held-collection';else if(matches.length)state='held-known-global-exposure';else if(draft?.unresolved)state='held-unresolved-reference';else if(controlFailure)state='held-control';else if(votes.some(x=>referenceGradeStateV4(x.grade)==='critical'))state='held-critical';else if(votes.some(x=>referenceGradeStateV4(x.grade)==='uncertain'))state='held-uncertain';else if(votes.length===2&&digest(votes[0].grade)!==digest(votes[1].grade))state='held-disagreement';else if(votes.some(x=>referenceGradeStateV4(x.grade)==='fail'))state='held-review-fail';else if(draft&&votes.length===2)state='ai-consensus-pass';
  return {caseId:c.id,state,referenceLevel:state==='ai-consensus-pass'?'ai-consensus':'unresolved',gateViolated:!['held-incomplete','ai-consensus-pass'].includes(state),raw,votes,draft,...(exposureRequired?{exposure:{inventoryHash:p.exposureEvidence.hash,coverage:p.exposureEvidence.coverage,entries:p.exposureEvidence.entries.length,actualIndependenceCertified:false,...(global?{global:{protocol:GLOBAL_EXPOSURE_V1,corpusHash:global.hash,coverage:global.coverage,selectedSourceRecords:global.sourceRecordCount,exactSurfaces:global.records.length,checked:draft!==null,matchingRecordIds:matches.map(x=>x.id),structuralIndependenceCertified:false}}:{})}}:{})};
 });
 return {protocol:OPERATIONAL_REFERENCE_V1,baseProtocol:REFERENCE_V4,rubricHash:REFERENCE_RUBRIC_HASH_V1,denominator:inputs.cases.length,rows,held:rows.some(x=>x.state!=='ai-consensus-pass'),gateViolated:rows.some(x=>x.gateViolated),englishTruthCertified:false,actualRoleQualificationMeasured:false,developmentExposed:true};
}
export function operationalReferenceHandoffV1({spec,seal,ledger,store,inputs}){
 check(ledger.closed&&spec.sourceSeal===seal.hash&&digest(seal.payload)===seal.hash&&seal.payload.components.corpus===digest(inputs.cases)&&seal.payload.components.rubric===digest(inputs.contract)&&ledger.specHash===compileBudgetV3(spec).specHash&&Object.keys(ledger.slots).length===spec.requests.length&&Object.values(ledger.slots).every(x=>x.state==='completed'),'CLOSED_COMPLETE_COLLECTION');
 const report=buildOperationalReferenceReportV1({spec,seal,ledger,store,inputs});check(!report.held,'CONSENSUS_REQUIRED');return report.rows.map(row=>{
  const c=inputs.cases.find(c=>c.id===row.caseId),p=c.referencePreparation,d=row.draft,criterion=JSON.stringify({criterion:d.criterion,expectedOriginal:d.expectedOriginal,acceptedCorrectionExamples:d.acceptedCorrectionExamples,correctionExamplesAreExhaustive:false,evidenceLevel:d.evidenceLevelClaim,aiConsensusIsEnglishTruth:false});check(criterion.length<=4000,'CRITERION_LIMIT');
  return {caseId:c.id,familyId:c.familyId,domain:c.domain,stratum:c.stratum,input:{sentence:d.input.sentence,target:p.assignment.targetSummary,contextKind:d.input.contextKind,contextNote:d.input.contextNote},level:'ai-consensus',criterion,sources:d.sourceIds.map(id=>{const x=p.sourcePack.sources.find(x=>x.id===id);return {url:x.url,checkedAt:x.checkedAt,contentSha256:x.contentSha256,excerpt:x.excerpt};}),referenceRecord:structuredClone(d),provenance:{protocol:OPERATIONAL_REFERENCE_V1,baseProtocol:REFERENCE_V4,operationalRubricHash:REFERENCE_RUBRIC_HASH_V1,runId:spec.runId,specHash:ledger.specHash,sourceSeal:spec.sourceSeal,ledgerClosed:true,assignmentHash:p.assignment.assignmentHash,sourcePackHash:p.sourcePack.hash,exposureInventoryHash:p.assignment.exposureInventoryHash,raw:row.raw,controlResults:row.votes.map(x=>({modelId:x.modelId,requestId:x.requestId,controlMatches:x.controlMatches,rubricHash:x.rubricHash})),englishTruthCertified:false,humanReviewed:false,actualRoleQualificationMeasured:false,newCorpusFreezeRequired:true,...(p.exposureEvidence?{exposureProtocol:EXPOSURE_V1,exposureCoverage:p.exposureEvidence.coverage,exposureEntries:p.exposureEvidence.entries.length,structuralIndependenceCertified:false}:{})}};
 });
}
