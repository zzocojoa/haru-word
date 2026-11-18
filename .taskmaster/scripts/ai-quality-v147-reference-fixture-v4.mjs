// Synthetic data only. The request/validation/report code is shared with the
// reference preparation adapter; no real English corpus or approval is implied.
import {createHash} from 'node:crypto';
import {panelFixtureV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
import {REFERENCE_V4,REFERENCE_DIMENSIONS,REFERENCE_CRITICAL,referenceDraftRequestV4,referenceReviewTemplateV4,materializeReferenceReviewV4,referenceReviewBindingV4} from './ai-quality-v147-reference-v4.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const positiveReferenceGradeV4=()=>({...Object.fromEntries(REFERENCE_DIMENSIONS.map(k=>[k,'pass'])),criticalErrors:Object.fromEntries(REFERENCE_CRITICAL.map(k=>[k,false]))});
export function referenceFixtureV4({caseCount=2}={}){
 const b=panelFixtureV3({stage:'reference-preparation',caseCount});
 function assignment(caseId,domain,stratum,familyId){
  const pack={id:'public-pack',sources:[{id:'synthetic-source',url:'https://example.invalid/synthetic-only',checkedAt:'2026-11-07T00:00:00Z',contentSha256:digest('synthetic-excerpt'),excerpt:'Synthetic provenance metadata; no source was actually fetched or certified.'}],level:'synthetic-test',provenanceHash:digest('synthetic-public-source-provenance')};pack.hash=digest(pack);
  const a={caseId,domain,targetKey:'synthetic-target',targetSummary:'warm adjective',stratum,familyId,familyBrief:'Synthetic structural family, no independent freshness claim.',lengthBand:'ordinary',complexityBand:'simple',permittedSourcePackId:pack.id,permittedSourceIds:pack.sources.map(x=>x.id),sourcePackHash:pack.hash,exposureInventoryHash:digest('synthetic-exposure-inventory')};a.assignmentHash=digest(a);return {assignment:a,sourcePack:pack};
 }
 function draft(a,sentence){return {caseId:a.caseId,assignmentHash:a.assignmentHash,domain:a.domain,targetKey:a.targetKey,familyId:a.familyId,familyRationale:'Synthetic transport case only.',input:{sentence,contextKind:'sentence',contextNote:''},expectedOriginal:{meaningUsage:'appropriate',grammar:'natural',contextNeeded:'none'},acceptedCorrectionExamples:[],criterion:'Synthetic reference; no actual English correctness assertion.',sourceIds:[...a.permittedSourceIds],evidenceLevelClaim:'ai-consensus',unresolved:false,reasonCodes:['ai-consensus-only']};}
 b.reportInputs.cases=b.reportInputs.cases.map((c,i)=>{
  const base=assignment(c.id,c.domain,c.stratum,c.familyId),controlBase=assignment('control-'+(i+1),c.domain,c.stratum,'control-family-'+(i+1));
  const control={...controlBase,draft:draft(controlBase.assignment,'A second synthetic reference stays warm.')},controlExpectedGrade=positiveReferenceGradeV4();controlExpectedGrade.originalLabelSupport='fail';
  const record=draft(base.assignment,'A newly authored synthetic input '+(i+1)+' stays warm.');record.criterion+=' Safe correction examples are not exhaustive.';
  // The control's English/label error is a synthetic expected outcome, not a
  // certified reference. Expected review grades are never sent in a request.
  control.draft.expectedOriginal.grammar='needs_work';control.draft.acceptedCorrectionExamples=['A changed synthetic control.'];
  const reviewNonces=Object.fromEntries(b.spec.requests.filter(d=>d.caseId===c.id&&d.role==='referenceReview').map(d=>[d.modelId,digest({fixture:'private-review-nonce',caseId:c.id,judge:d.modelId})]));
  for(const d of b.spec.requests.filter(d=>d.caseId===c.id)){
   const raw=d.role==='referenceDraft'?referenceDraftRequestV4({modelId:d.modelId,...base}):referenceReviewTemplateV4({modelId:d.modelId,...base,control,nonce:reviewNonces[d.modelId]});
   d.bodyHash=sha(raw);b.wires[d.key]=d.bodyKind==='static'?{raw}:{templateRaw:raw};
   if(d.role==='referenceDraft')b.responses[d.key]=JSON.stringify(record);else{
    const recipe=JSON.parse(JSON.parse(raw).input[0].content),binding=referenceReviewBindingV4(recipe.REFERENCE_DATA.context),items=materializeReferenceReviewV4(recipe,record).REFERENCE_REVIEW_ITEMS.items;
    b.responses[d.key]=JSON.stringify({items:items.map(item=>({itemId:item.itemId,grade:item.itemId===binding.controlItemId?structuredClone(controlExpectedGrade):positiveReferenceGradeV4(),reasonCodes:['confirmed'],shortEvidenceSummary:'Synthetic fixed response; not model judgment.'}))});
   }
  }
  return {...c,input:{target:base.assignment.targetSummary},reference:{level:'unresolved',criterion:'No prewritten sentence or gold input supplied to author.',sources:[]},referencePreparation:{...base,control,controlExpectedGrade,reviewNonces}};
 });
 b.reportInputs.contract={protocol:REFERENCE_V4,referenceReviewDimensions:REFERENCE_DIMENSIONS,criticalFlags:REFERENCE_CRITICAL,scope:'Synthetic transport qualification only;controls andAIbehavior unqualified.'};
 b.current.components.corpus=digest(b.reportInputs.cases);b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);b.current.components.referenceProtocol=digest(REFERENCE_V4);b.current.components.requestBuilder=digest({protocol:REFERENCE_V4,cap:4096});b.current.components.projection=digest({protocol:REFERENCE_V4,semanticAcceptance:true});const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
