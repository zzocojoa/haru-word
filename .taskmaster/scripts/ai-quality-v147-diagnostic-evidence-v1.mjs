// Match the public-case prompt's visible-feedback scope without qualifying its
// English claims. Missing explanation-specific evidence remains a separate hold.
import {createHash} from 'node:crypto';
import {compileCaseReviewPlanV1} from './ai-quality-v147-case-review-v1.mjs';
import {validateV3Output} from './ai-quality-v147-wire-v3.mjs';
const check=(v,c)=>{if(!v)throw Error('DV1_'+c);},sha=x=>createHash('sha256').update(x).digest('hex');
export function inspectDiagnosticEvidenceV1({prepared:p,request:r,payloadRaw}){
 const canonical=compileCaseReviewPlanV1(p).requests.find(x=>x.key===r.key),body=JSON.parse(r.requestRaw);check(canonical&&canonical.requestRaw===r.canonicalRequestRaw&&JSON.stringify(body.prompt_cache_options)==='{"mode":"explicit"}','REQUEST_BINDING');delete body.prompt_cache_options;check(JSON.stringify(body)===r.canonicalRequestRaw,'WIRE_BINDING');
 const value=validateV3Output(r.canonicalRequestRaw,payloadRaw),ids=p.data.questions.map(q=>q.id);check(new Set(value.assessments.map(a=>a.questionId)).size===5&&value.assessments.every(a=>ids.includes(a.questionId)),'DENOMINATOR');
 const visible=p.publicDossier.visibleFeedback,fields=Object.entries(visible).filter(([,v])=>typeof v==='string'),quoteLocations=[];let explanationClaimEvidenceHeld=false;
 for(const a of value.assessments){
  check(a.verdict==='not-established'||a.sourceEvidence.length+a.feedbackQuotes.length>0,'EVIDENCE_REQUIRED');
  for(const e of a.sourceEvidence){const source=p.sourcePack.sources.find(s=>s.id===e.sourceId);check(source&&source.excerpt.includes(e.quote),'SOURCE_QUOTE');}
  for(const quote of a.feedbackQuotes){const locations=fields.filter(([,v])=>v.includes(quote)).map(([field,v])=>({field,offset:v.indexOf(quote)}));check(locations.length>0,'FEEDBACK_QUOTE');quoteLocations.push({questionId:a.questionId,quote,locations});}
  if(a.questionId==='visible-is-speaking-edit-claim'&&a.verdict!=='not-established'&&!a.feedbackQuotes.some(q=>visible.explanation.includes(q)))explanationClaimEvidenceHeld=true;
 }
 const unresolved=value.assessments.filter(a=>a.verdict==='not-established').map(a=>a.questionId),unsupportedGoldEligibilityClaim=value.categoricalGoldRecommendation!=='hold'&&(value.exactOriginalSupport!=='provided-case-specific'||!value.declaredUsageScope.trim()||unresolved.includes('categorical-original-error'));
 return {protocol:'ai-quality-v147-diagnostic-evidence-v1',key:r.key,responseHash:sha(payloadRaw),value,quoteLocations,unresolvedQuestionIds:unresolved,unsupportedGoldEligibilityClaim,explanationClaimEvidenceHeld,calibrationGoldEligible:false,actualEnglishQualityMeasured:false,actualRoleQualificationMeasured:false,providerReceiptAuthenticated:false,releaseVerdict:'held'};
}
