// Derived reporting only. Real collection UUIDs/receipt hashes remain explicit;
// logical panel IDs are an adapter namespace,never substituted in raw captures.
import {digest,DIMENSIONS,CRITICAL,summarizeCalibration,sameGrade} from './ai-quality-v147-calibration.mjs';
import {compileAiPanel,parsePanelPayload,parsePanelPayloadForRequest,summarizeAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {verifyProductRubricPolicyV1,PRODUCT_RUBRIC_V1,PRODUCT_RUBRIC_HASH_V1} from './ai-quality-v147-product-rubric-v1.mjs';
import {REFERENCE_V4,buildReferenceReportV4,referenceHandoffV4} from './ai-quality-v147-reference-v4.mjs';
import {applyProgramExclusionReportV1,openProgramExclusionGuardV1} from './ai-quality-v147-program-exclusion-v1.mjs';
import {applyProgramLiteralReportV1,openProgramLiteralGuardV1} from './ai-quality-v147-program-literal-exclusion-v1.mjs';
import {inspectCalibrationAdmissionV1} from './ai-quality-v147-calibration-admission-v1.mjs';
import {verifyOperationalReferencePolicyV1,buildOperationalReferenceReportV1,operationalReferenceHandoffV1} from './ai-quality-v147-operational-reference-v1.mjs';
import {verifyAssessmentContextV1,assessmentContextEnabledV1,ASSESSMENT_CONTEXT_HASH_V1,capturedProductInputV1,summarizeAssessmentAxesV1} from './ai-quality-v147-assessment-context-v1.mjs';
import {verifyExplanationMainV1,explanationMainEnabledV1,inspectExplanationMainAdmissionV1} from './ai-quality-v147-explanation-main-v1.mjs';
import {PRODUCT_RUBRIC_HASH_V4} from './ai-quality-v147-explanation-scope-v1.mjs';
export const REPORT_V3='ai-quality-v147-panel-report-v3';
const check=(ok,code)=>{if(!ok)throw Error('PR3_'+code);};
export const collectionPolicyV3=(stage,inputs)=>digest({protocol:REPORT_V3,stage,witnesses:inputs.witnesses,cases:inputs.cases,contract:inputs.contract,gradeGate:'both-layouts-all-three-judges-11of12-critical-misses0',reference:'two-nonself-unanimous;unresolved-held',claims:'synthetic-tooling-only;no-English-truth-or-release'});
export function verifyReportInputsV3({spec,seal,inputs}){
 check(inputs&&Array.isArray(inputs.cases)&&Array.isArray(inputs.witnesses)&&inputs.contract&&digest(inputs.cases.map(c=>c.id))===digest(spec.profile.caseIds),'CASES');check(inputs.cases.every(c=>['word','grammar'].includes(c.domain)&&['normal','needsCorrection','insufficientContext'].includes(c.stratum)&&typeof c.familyId==='string'&&c.input&&c.reference),'CASE_METADATA');
 check(seal.payload.components.corpus===digest(inputs.cases)&&seal.payload.components.rubric===digest(inputs.contract)&&seal.payload.components.collectionPolicy===collectionPolicyV3(spec.profile.stage,inputs),'FROZEN_INPUTS');
 verifyOperationalReferencePolicyV1({spec,seal,inputs});
 verifyProductRubricPolicyV1({spec,seal,inputs});if(!verifyExplanationMainV1({spec,seal,inputs}))verifyAssessmentContextV1({spec,seal,inputs});
 if(spec.profile.stage==='pilot-panel')check(digest(inputs.witnesses.map(w=>w.id))===digest(spec.profile.witnessIds),'WITNESSES');return true;
}
export function calibrationGateV3({spec,ledger,store,inputs}){
 const legacyQualification=inspectCalibrationAdmissionV1({inputs,stage:spec.profile.stage}),sourceQualification=inspectExplanationMainAdmissionV1({inputs,stage:spec.profile.stage})??legacyQualification;
 if(spec.profile.stage!=='pilot-panel')return {required:false,thresholdArithmeticSatisfied:true,files:[],scope:'Reference-preparation has no main calibration role.',sourceQualification,calibrationAcceptanceAllowed:false};
 const files=[],layouts=[];for(const layout of ['input-first','feedback-first']){
  const records=[],axesRecords=[];for(const d of spec.requests.filter(d=>d.role==='calibration'&&d.layout===layout)){
   const row=ledger.slots[d.key];if(!row)continue;let grade=null;
   if(['completed','failed','unknown'].includes(row.state)){
    const c=store.read({ledger,key:d.key});for(const [name,h]of Object.entries(c.files))files.push({directory:c.directory,name,sha256:h});if(row.state==='completed'){const parsed=parsePanelPayloadForRequest({requestRaw:c.requestRaw,payloadRaw:c.payloadRaw});grade=parsed.grade;if(inputs.contract.assessmentContext)axesRecords.push({judgeId:d.modelId,witnessId:d.caseId,state:'graded',sourceAdequacy:parsed.sourceAdequacy,learnerContext:parsed.learnerContext,abstentionNeed:parsed.abstentionNeed});}
   }
   records.push({judgeId:d.modelId,witnessId:d.caseId,state:grade?'graded':'failed',grade});
  }
  layouts.push({layout,...summarizeCalibration(inputs.witnesses,records),...(inputs.contract.assessmentContext?{evidenceAxes:summarizeAssessmentAxesV1(inputs.witnesses,axesRecords)}:{})});
 }
 const thresholdArithmeticSatisfied=layouts.every(x=>x.thresholdArithmeticSatisfied&&(!x.evidenceAxes||x.evidenceAxes.arithmeticSatisfied));
 return {required:true,thresholdArithmeticSatisfied,layouts,files,modelCalibrationMeasured:false,humanAgreementMeasured:false,referenceLevel:'public-development-ai-authored',sourceQualification,calibrationAcceptanceAllowed:thresholdArithmeticSatisfied&&sourceQualification.required&&sourceQualification.sourceQualified};
}
function referenceReport({spec,ledger,store,inputs}){
 const rows=inputs.cases.map(c=>{
  const author=spec.requests.find(d=>d.role==='referenceDraft'&&d.caseId===c.id),children=spec.requests.filter(d=>d.parentKey===author.key),grades=[],raw=[];let available=false;
  for(const d of [author,...children]){const r=ledger.slots[d.key];if(r&&['completed','failed','unknown'].includes(r.state)){const cap=store.read({ledger,key:d.key});raw.push({key:d.key,requestId:r.requestId,role:d.role,modelId:d.modelId,state:r.state,receiptHash:r.receiptHash,captureHash:cap.result.captureHash});if(d===author)available=r.state==='completed';else if(r.state==='completed')grades.push(parsePanelPayload(cap.payloadRaw).grade);}}
  let state;if(!available||grades.length!==2)state='held-incomplete';else if(grades.some(g=>CRITICAL.some(k=>g.criticalErrors[k])))state='held-critical';else if(grades.some(g=>DIMENSIONS.some(k=>['uncertain','unavailable'].includes(g[k]))))state='held-uncertain';else if(!sameGrade(grades[0],grades[1]))state='held-disagreement';else if(DIMENSIONS.some(k=>grades[0][k]==='fail'))state='ai-consensus-fail';else state='ai-consensus-pass';
  return {caseId:c.id,referenceLevel:state==='ai-consensus-pass'?'ai-consensus':'unresolved',state,raw};
 });return {denominator:inputs.cases.length,rows,held:rows.some(r=>r.state!=='ai-consensus-pass'),englishTruthCertified:false};
}
export function buildPanelReportV3({spec,seal,ledger,store,inputs}){
 verifyReportInputsV3({spec,seal,inputs});const calibration=calibrationGateV3({spec,ledger,store,inputs}),counts=Object.values(ledger.slots).reduce((a,r)=>{a[r.state]=(a[r.state]??0)+1;return a;},{}),provenance=[];let panel=null,references=null;
 if(spec.profile.stage==='reference-preparation')references=inputs.contract.protocol===REFERENCE_V4?applyProgramLiteralReportV1({report:applyProgramExclusionReportV1({report:(inputs.contract.referenceOperationalRubric?buildOperationalReferenceReportV1({spec,seal,ledger,store,inputs}):buildReferenceReportV4({spec,ledger,store,inputs})),inputs}),inputs}):referenceReport({spec,ledger,store,inputs});else{
  const observations=spec.requests.filter(d=>d.role==='generation').map(d=>{
   const c=inputs.cases.find(c=>c.id===d.caseId),row=ledger.slots[d.key],cap=row&&['completed','failed','unknown'].includes(row.state)?store.read({ledger,key:d.key}):null;
   return {id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:d.caseId,familyId:c.familyId,domain:c.domain,stratum:c.stratum,input:c.input,reference:c.reference,feedback:row?.state==='completed'?JSON.parse(cap.payloadRaw):null,...(assessmentContextEnabledV1(inputs.contract)?{requestInput:cap?capturedProductInputV1(cap.requestRaw):c.requestInput}:{}),parentReceiptHash:cap?.receiptHash??digest({unavailable:d.key,specHash:ledger.specHash})};
  });const plan=compileAiPanel({runId:spec.runId,observations,witnesses:inputs.witnesses,contract:inputs.contract,salt:Buffer.from(digest({adapter:REPORT_V3,specHash:ledger.specHash}),'hex')}),records=[],ids=new Map();
  for(const d of spec.requests.filter(d=>['review','calibration'].includes(d.role))){
   const row=ledger.slots[d.key];if(!row||!['completed','failed','unknown'].includes(row.state))continue;const cap=store.read({ledger,key:d.key}),slot=plan.slots.find(s=>d.role==='review'?s.kind==='review'&&s.privateBinding.sourceId===d.parentKey&&s.judgeId===d.modelId&&s.layout===d.layout:s.kind==='calibration'&&s.privateBinding.witnessId===d.caseId&&s.judgeId===d.modelId&&s.layout===d.layout);
   check(slot&&cap.requestRaw===slot.raw&&cap.result.bodySha256===slot.bodySha256&&cap.result.requestId===row.requestId&&row.receiptHash===cap.receiptHash,'CAPTURE_PANEL_BINDING');
   if(!slot.dispatchEligible){check(row.state!=='completed','UNAVAILABLE_REVIEW');continue;}
   const record={key:slot.key,requestId:slot.requestId,judgeId:d.modelId,layout:d.layout,evidenceHash:slot.evidenceHash,bodySha256:slot.bodySha256,state:row.state==='completed'?'graded':'failed',payloadRaw:row.state==='completed'?cap.payloadRaw:null};records.push(record);ids.set(slot.requestId,row.requestId);provenance.push({collectionKey:d.key,collectionRequestId:row.requestId,specHash:ledger.specHash,sourceSeal:spec.sourceSeal,receiptHash:row.receiptHash,captureHash:cap.result.captureHash,panelKey:slot.key,panelProtocolRequestId:slot.requestId,bodySha256:cap.result.bodySha256});
  }
  panel=summarizeAiPanel(plan,records);for(const r of panel.rows)for(const g of r.rawReviews){const panelProtocolRequestId=g.requestId;check(ids.has(panelProtocolRequestId),'REPORT_ID');g.requestId=ids.get(panelProtocolRequestId);g.panelProtocolRequestId=panelProtocolRequestId;}
 }
 const complete=Object.keys(ledger.slots).length===spec.requests.length&&Object.values(ledger.slots).every(r=>r.state==='completed');
 return {protocol:REPORT_V3,runId:spec.runId,specHash:ledger.specHash,sourceSeal:spec.sourceSeal,stage:spec.profile.stage,plannedSlots:spec.requests.length,counts,closed:ledger.closed,collectionComplete:complete,calibration,panel,references,provenance,...(inputs.contract.productOperationalRubric?{productOperationalRubric:{protocol:PRODUCT_RUBRIC_V1,hash:PRODUCT_RUBRIC_HASH_V1,dimensions:5,criticalFlags:4,semanticCorrectnessVerified:false}}:{}),...(inputs.contract.assessmentContext?{assessmentContext:{hash:ASSESSMENT_CONTEXT_HASH_V1,explicitModeAndOriginalRequestFields:true,englishAndBoundedPolicySeparate:true,qualificationVerified:false}}:{}),...(explanationMainEnabledV1(inputs.contract)?{explanationScope:{hash:PRODUCT_RUBRIC_HASH_V4,outputTokenMax:1024,syntheticMainIntegrated:true,liveDispatchSupported:false,qualificationVerified:false,automaticAdmission:false}}:{}),rawCaptureIdsRewritten:false,logicalPanelIdsAreAdapterOnly:true,actualProviderCalls:0,actualKeyReads:0,actualEnglishQualityMeasured:false,humanExpertValidation:false,learnerEfficacyMeasured:false,providerReceiptAuthenticated:false,releaseVerdict:'held'};
}
export function referenceHandoffV3({spec,seal,ledger,store,inputs}){
 if(inputs.contract.protocol===REFERENCE_V4){verifyReportInputsV3({spec,seal,inputs});const guard=openProgramExclusionGuardV1(inputs),literalGuard=openProgramLiteralGuardV1(inputs);if(guard||literalGuard){const checked=applyProgramLiteralReportV1({report:applyProgramExclusionReportV1({report:(inputs.contract.referenceOperationalRubric?buildOperationalReferenceReportV1({spec,seal,ledger,store,inputs}):buildReferenceReportV4({spec,ledger,store,inputs})),inputs}),inputs});check(!checked.held,'REFERENCE_CONSENSUS_REQUIRED');}const records=(inputs.contract.referenceOperationalRubric?operationalReferenceHandoffV1:referenceHandoffV4)({spec,seal,ledger,store,inputs});return guard||literalGuard?records.map(r=>({...r,provenance:{...r.provenance,...(guard?{programExposure:{protocol:guard.protocol,indexHash:guard.indexHash,knownSurfaces:69,sourceExpansions:76,coverage:'partial',freshnessQualified:false,modelSourceSentencesForwarded:false}}:{}),...(literalGuard?{programLiteralExposure:{protocol:literalGuard.protocol,indexHash:literalGuard.indexHash,knownCandidateSurfaces:433,sourceOccurrences:629,coverage:'selected-program-candidates-only',freshnessQualified:false,englishOriginalCertified:false,modelSourceTextForwarded:false}}:{})}})):records;}
 check(spec.profile.stage==='reference-preparation'&&ledger.closed,'CLOSED_REFERENCE_STAGE');const r=buildPanelReportV3({spec,seal,ledger,store,inputs});check(r.collectionComplete&&!r.references.held,'REFERENCE_CONSENSUS_REQUIRED');
 return inputs.cases.map(c=>{const d=spec.requests.find(d=>d.role==='referenceDraft'&&d.caseId===c.id),cap=store.read({ledger,key:d.key}),draft=JSON.parse(cap.payloadRaw);check(draft.sentence===c.input.sentence&&draft.target===c.input.target,'REFERENCE_INPUT');return {caseId:c.id,level:'ai-consensus',criterion:draft.criterion,provenance:{stage:spec.profile.stage,runId:spec.runId,specHash:ledger.specHash,sourceSeal:spec.sourceSeal,raw:r.references.rows.find(x=>x.caseId===c.id).raw,englishTruthCertified:false,humanReviewed:false,ledgerClosed:true}};});
}
