// Opt-in V4 main-panel plumbing. No transport, credentials or admission bypass.
import {digest} from './ai-quality-v147-calibration.mjs';
import {parseV3Json} from './ai-quality-v147-wire-v3.mjs';
import {assessmentContextEnabledV1,assessmentContextPolicyV1,assessmentContextGradeSchemaV1,capturedProductInputV1,ASSESSMENT_CONTEXT_HASH_V1} from './ai-quality-v147-assessment-context-v1.mjs';
import {separateEnglishScopeRequestV1} from './ai-quality-v147-english-assessment-scope-v1.mjs';
import {reviseCriticalBoundaryRequestV1} from './ai-quality-v147-critical-boundary-v1.mjs';
import {budgetCriticalRequestV1} from './ai-quality-v147-critical-budget-profile-v1.mjs';
import {reviseExplanationScopeRequestV1,validateExplanationScopeRequestV1,loadExplanationScopeV1,PRODUCT_RUBRIC_HASH_V4} from './ai-quality-v147-explanation-scope-v1.mjs';

export const EXPLANATION_MAIN_V1='ai-quality-v147-explanation-main-v1';
const check=(ok,code)=>{if(!ok)throw Error('XM1_'+code);};
export const explanationMainPolicyV1=()=>({protocol:EXPLANATION_MAIN_V1,englishPolicyHash:PRODUCT_RUBRIC_HASH_V4,outputTokenMax:1024,required:true,kind:'synthetic-only',sourceQualificationRequired:true});
export const explanationMainComponentV1=()=>digest({protocol:'ai-quality-v147-ai-panel-v1',assessmentContext:assessmentContextPolicyV1(),explanationScope:explanationMainPolicyV1()});
export function explanationMainEnabledV1(contract){
 if(contract.explanationScope===undefined)return false;
 check(digest(contract.explanationScope)===digest(explanationMainPolicyV1())&&assessmentContextEnabledV1(contract)&&contract.englishAssessmentScope===undefined,'CONTRACT');
 loadExplanationScopeV1();return true;
}
export function assertExplanationMainCaptureV1({spec,seal}){
 check(spec.mode==='synthetic'&&spec.profile.stage==='pilot-panel'&&seal.payload.components.aiPanelPolicy===explanationMainComponentV1(),'CAPTURE_POLICY');
}
export function verifyExplanationMainV1({spec,seal,inputs}){
 const enabled=explanationMainEnabledV1(inputs.contract);
 if(!enabled){check(seal.payload.components.aiPanelPolicy!==explanationMainComponentV1(),'ORPHAN_POLICY');return false;}
 assertExplanationMainCaptureV1({spec,seal});check(seal.payload.components.rubric===digest(inputs.contract)&&inputs.contract.inputCountPolicy?.required===true,'FROZEN_POLICY');return true;
}
// This immutable chain is also used by the paid public-development diagnostics.
// Only the new actual request is returned; validation projections are never sent.
export function attachExplanationMainRequestV1(contextRaw){
 return reviseExplanationScopeRequestV1(budgetCriticalRequestV1(reviseCriticalBoundaryRequestV1(separateEnglishScopeRequestV1(contextRaw))));
}
export function explanationMainSchemaV1(base){
 const schema=assessmentContextGradeSchemaV1(base);schema.properties.productRubricHash={type:'string',enum:[PRODUCT_RUBRIC_HASH_V4]};return schema;
}
export function assertExplanationMainParentV1({requestRaw,parentRequestRaw=null,role}){
 const body=validateExplanationScopeRequestV1(requestRaw),input=parseV3Json(body.input[0].content).EVALUATION_DATA.input;
 if(role==='review'){
  check(input.assignmentContext.origin==='generation-request'&&typeof parentRequestRaw==='string','PARENT_REQUIRED');
  check(digest(capturedProductInputV1(parentRequestRaw))===input.assignmentContext.requestInputHash,'ACTUAL_PARENT_INPUT');
 }else check(role==='calibration'&&input.assignmentContext.origin==='hypothetical-calibration','CALIBRATION_ORIGIN');return true;
}
export function inspectExplanationMainAdmissionV1({inputs,stage}){
 if(!explanationMainEnabledV1(inputs.contract))return null;
 check(stage==='pilot-panel','ADMISSION_STAGE');
 // Public two-model diagnostics do not qualify the 12 main witnesses, hidden
 // families, grammar lessons or the third model. No caller boolean can promote
 // them. A future independently supported registry needs an explicit version.
 return {protocol:EXPLANATION_MAIN_V1,required:true,sourceQualified:false,calibrationAcceptanceAllowed:false,qualifiedWitnesses:0,requiredWitnesses:12,englishPolicyHash:PRODUCT_RUBRIC_HASH_V4,assessmentContextHash:ASSESSMENT_CONTEXT_HASH_V1,reason:'no-source-qualified-v4-main-witness-registry',publicDevelopmentEvidenceIsQualification:false,automaticAdmission:false};
}
export function assertExplanationMainAdmissionV1(options){
 const admission=inspectExplanationMainAdmissionV1(options);if(admission)check(admission.sourceQualified,'SOURCE_QUALIFICATION_REQUIRED');return admission;
}
