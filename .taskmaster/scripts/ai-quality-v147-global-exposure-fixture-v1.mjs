// Synthetic response/approval only. The corpus is public; no live calls occur.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {referenceFixtureV4,positiveReferenceGradeV4} from './ai-quality-v147-reference-fixture-v4.mjs';
import {referenceDraftRequestV4,referenceReviewTemplateV4,materializeReferenceReviewV4,referenceReviewBindingV4} from './ai-quality-v147-reference-v4.mjs';
import {GLOBAL_EXPOSURE_V1,projectGlobalExposureV1} from './ai-quality-v147-global-exposure-v1.mjs';
import {INPUT_COUNT_V1} from './ai-quality-v147-input-count-v1.mjs';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function globalExposureFixtureV1({caseCount=2,corpus=null,knownOutsideProjection=false}={}){
 const b=referenceFixtureV4({caseCount}),g=structuredClone(corpus??JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/global-exposure-corpus-v1.json',import.meta.url),'utf8'))),byCaseHash={};b.reportInputs.globalExposureCorpus=g;
 for(const c of b.reportInputs.cases){const p=c.referencePreparation;for(const a of [p.assignment,p.control.assignment])a.targetKey=a.domain==='grammar'?'noun':'warm';const e=projectGlobalExposureV1(g,p.assignment,p.control.assignment);p.exposureEvidence=e;byCaseHash[c.id]=e.hash;
  for(const a of [p.assignment,p.control.assignment]){a.exposureInventoryHash=e.hash;delete a.assignmentHash;a.assignmentHash=digest(a);}p.control.draft.assignmentHash=p.control.assignment.assignmentHash;p.control.draft.targetKey=p.control.assignment.targetKey;p.controlExpectedGrade.exposureAndFamilyCompliance='unavailable';
  const author=b.spec.requests.find(d=>d.caseId===c.id&&d.role==='referenceDraft'),record=JSON.parse(b.responses[author.key]);record.assignmentHash=p.assignment.assignmentHash;record.targetKey=p.assignment.targetKey;record.unresolved=true;record.evidenceLevelClaim='unresolved';record.reasonCodes=['family-exposure-uncertain'];
  if(knownOutsideProjection){const visible=new Set(e.entries.map(x=>x.id)),known=g.records.find(r=>!visible.has(r.id)&&r.sourceRecordIds.every(id=>id.startsWith('curriculum/')));if(!known)throw Error('GEX1_FIXTURE_OUTSIDE_RECORD');record.input=structuredClone(known.input);}
  for(const d of b.spec.requests.filter(d=>d.caseId===c.id)){
   const raw=d.role==='referenceDraft'?referenceDraftRequestV4({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,exposureEvidence:e}):referenceReviewTemplateV4({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,control:p.control,nonce:p.reviewNonces[d.modelId],exposureEvidence:e});d.bodyHash=sha(raw);b.wires[d.key]=d.bodyKind==='static'?{raw}:{templateRaw:raw};
   if(d.role==='referenceDraft')b.responses[d.key]=JSON.stringify(record);else{const recipe=JSON.parse(JSON.parse(raw).input[0].content),binding=referenceReviewBindingV4(recipe.REFERENCE_DATA.context),items=materializeReferenceReviewV4(recipe,record).REFERENCE_REVIEW_ITEMS.items;b.responses[d.key]=JSON.stringify({items:items.map(item=>{const grade=item.itemId===binding.controlItemId?structuredClone(p.controlExpectedGrade):positiveReferenceGradeV4();grade.exposureAndFamilyCompliance='unavailable';return {itemId:item.itemId,grade,reasonCodes:['confirmed'],shortEvidenceSummary:'Synthetic fixed response only;actual English quality unmeasured.'};})});}
  }
 }
 b.reportInputs.contract.exposurePolicy={protocol:GLOBAL_EXPOSURE_V1,required:true,corpusHash:g.hash,byCaseHash};b.reportInputs.contract.inputCountPolicy={protocol:INPUT_COUNT_V1,kind:'synthetic-only',required:true};
 b.current.components.corpus=digest(b.reportInputs.cases);b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);b.current.components.requestBuilder=digest({reference:'v4',globalExposure:GLOBAL_EXPOSURE_V1,cap:4096});b.current.components.projection=digest({reference:'v4',globalExposure:GLOBAL_EXPOSURE_V1,partialHeld:true});const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
