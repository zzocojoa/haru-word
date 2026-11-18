// Synthetic transport fixture,including a declared-complete twoentry fixture
// scope. That declaration is not complete project exposure or English truth.
import {createHash} from 'node:crypto';
import {referenceFixtureV4,positiveReferenceGradeV4} from './ai-quality-v147-reference-fixture-v4.mjs';
import {referenceDraftRequestV4,referenceReviewTemplateV4,materializeReferenceReviewV4,referenceReviewBindingV4} from './ai-quality-v147-reference-v4.mjs';
import {EXPOSURE_V1,validateExposureInventoryV1} from './ai-quality-v147-exposure-v1.mjs';
import {INPUT_COUNT_V1} from './ai-quality-v147-input-count-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function syntheticExposureInventoryV1({coverage='complete-for-declared-scope'}={}){
 const basis={protocol:EXPOSURE_V1,scope:{kind:'synthetic-fixture',description:'Exactly two specified synthetic development records;no broader projectcoverage or Englishtruth claim.'},coverage,entries:[1,2].map(i=>({id:'exposure-'+digest({entry:i}).slice(0,24),domain:'word',targetKey:'synthetic-target',familyId:'family-'+digest({family:i}).slice(0,24),familyBrief:'Previously exposed synthetic fixture structure '+i+';no actual independent-family claim.',input:{sentence:'Previously exposed synthetic sentence '+i+' stays unchanged.',contextKind:'sentence',contextNote:''}})),provenanceHash:digest('synthetic-two-entry-source')};return validateExposureInventoryV1({...basis,hash:digest(basis)});
}
export function exposureFixtureV1({caseCount=2,inventory=null,counted=true,controlKnownExposure=false}={}){
 const b=referenceFixtureV4({caseCount}),e=structuredClone(inventory??syntheticExposureInventoryV1());validateExposureInventoryV1(e);
 for(const c of b.reportInputs.cases){const p=c.referencePreparation;p.exposureEvidence=structuredClone(e);for(const a of [p.assignment,p.control.assignment]){a.exposureInventoryHash=e.hash;delete a.assignmentHash;a.assignmentHash=digest(a);}p.control.draft.assignmentHash=p.control.assignment.assignmentHash;if(controlKnownExposure){p.control.draft.input.sentence=e.entries[0].input.sentence;p.controlExpectedGrade.exposureAndFamilyCompliance='fail';p.controlExpectedGrade.criticalErrors.knownExposureLeak=true;}
  const author=b.spec.requests.find(d=>d.caseId===c.id&&d.role==='referenceDraft'),record=JSON.parse(b.responses[author.key]);record.assignmentHash=p.assignment.assignmentHash;if(e.coverage==='partial'){record.unresolved=true;record.evidenceLevelClaim='unresolved';record.reasonCodes=['family-exposure-uncertain'];if(!controlKnownExposure)p.controlExpectedGrade.exposureAndFamilyCompliance='unavailable';}
  for(const d of b.spec.requests.filter(d=>d.caseId===c.id)){
   const raw=d.role==='referenceDraft'?referenceDraftRequestV4({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,exposureEvidence:e}):referenceReviewTemplateV4({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,control:p.control,nonce:p.reviewNonces[d.modelId],exposureEvidence:e});d.bodyHash=sha(raw);b.wires[d.key]=d.bodyKind==='static'?{raw}:{templateRaw:raw};
   if(d.role==='referenceDraft')b.responses[d.key]=JSON.stringify(record);else{const recipe=JSON.parse(JSON.parse(raw).input[0].content),binding=referenceReviewBindingV4(recipe.REFERENCE_DATA.context),items=materializeReferenceReviewV4(recipe,record).REFERENCE_REVIEW_ITEMS.items;b.responses[d.key]=JSON.stringify({items:items.map(item=>{const grade=item.itemId===binding.controlItemId?structuredClone(p.controlExpectedGrade):positiveReferenceGradeV4();if(e.coverage==='partial'&&!grade.criticalErrors.knownExposureLeak)grade.exposureAndFamilyCompliance='unavailable';return {itemId:item.itemId,grade,reasonCodes:['confirmed'],shortEvidenceSummary:'Synthetic fixed response;not actual AI judgment.'};})});}
  }
 }
 b.reportInputs.contract.exposurePolicy={protocol:EXPOSURE_V1,required:true,inventoryHash:e.hash};if(counted)b.reportInputs.contract.inputCountPolicy={protocol:INPUT_COUNT_V1,kind:'synthetic-only',required:true};
 b.current.components.corpus=digest(b.reportInputs.cases);b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);b.current.components.requestBuilder=digest({reference:'v4',exposure:EXPOSURE_V1,cap:4096});b.current.components.projection=digest({reference:'v4',exposure:EXPOSURE_V1,partialHeld:true});const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
