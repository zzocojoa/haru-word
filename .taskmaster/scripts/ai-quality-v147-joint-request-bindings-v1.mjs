// Bind new author drafts to actual frozen-application request bodies.
// Request capture is not a provider answer, a language reference or a score.
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const check=(v,c)=>{if(!v)throw Error('JRB1_'+c);};
const models=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'];
export const JOINT_REQUEST_BINDINGS_V1='ai-quality-v147-joint-request-bindings-v1';

export function buildJointRequestBindingsV1({bank,capture,lessons}){
 check(bank.cases.length===60&&new Set(bank.cases.map(c=>c.id)).size===60,'COHORT');
 check(capture.jointFreezeHash===bank.jointFreezeHash&&capture.candidateBuildFreezeSha256===bank.candidateFreezeSha256
  &&capture.proposalCases===60&&capture.applicationBodiesCaptured===360,'FROZEN_CAPTURE');
 check(capture.actualProviderCalls===0&&capture.actualCountCalls===0&&capture.actualKeyReads===0
  &&capture.syntheticRequestPathVerified===true&&capture.actualProviderTransportVerified===false
  &&capture.successfulLanguageFeedbackPathMeasured===false&&!capture.mainDispatchAuthorized,'SYNTHETIC_SCOPE');
 check(capture.records.length===360&&capture.lifecycle.length===2
  &&capture.lifecycle.every(x=>x.loopbackOnly&&x.realProviderEgress===0&&x.syntheticProviderRequests===180),'CAPTURE_DENOMINATOR');
 const indexed=new Map(),lessonMap=new Map(lessons.map(l=>[l.id,l]));
 for(const r of capture.records){
  const item=bank.cases.find(c=>c.id===r.caseId),key=r.profile+'/'+r.caseId+'/'+r.model;
  check(item&&['baseline','candidate'].includes(r.profile)&&models.includes(r.model)&&!indexed.has(key),'IDENTITY');
  const body=JSON.parse(r.requestRaw),input=JSON.parse(body.input[0].content);
  check(sha(r.requestRaw)===r.requestSha256&&body.model===r.model&&r.domain===item.domain
   &&digest(input)===digest(r.input),'RAW_BODY');
  check(input.sentence===item.sentence&&input.contextNote===(item.contextNote||undefined)
   &&(input.contextKind??'sentence')===item.contextKind,'COHORT_INPUT');
  check(input.contextRole===(item.domain==='word'&&r.profile==='candidate'?'intended_korean':undefined),'INTENT_ROLE');
  check(!['familyId','familyHypothesis','stratum','allocationSlot','authorDraft','referenceQualified'].some(k=>Object.hasOwn(input,k)),'PRIVATE_LABEL');
  if(item.domain==='word')for(const k of ['word','pos','meaning','expression'])check(input[k]===item.wordTarget[k],'WORD_TARGET');
  else check(r.lessonId===item.lessonId&&input.target===lessonMap.get(item.lessonId)?.title
   &&typeof input.targetCriterion==='string'&&input.targetCriterion.length>0,'GRAMMAR_TARGET');
  check(body.store===false&&body.stream===false&&body.max_output_tokens===4096&&body.service_tier==='default'
   &&body.text.format.name==='study_judgment'&&body.text.format.strict===true,'OPTIONS');
  check(r.httpSchemaAccepted&&r.syntheticProviderEnvelope&&r.syntheticEnvelopeStatus==='incomplete'
   &&r.httpStatus===502&&r.code==='provider_truncated'&&r.failedReceiptStored&&r.failedReceiptReadBack&&r.duplicateProviderResends===0
   &&r.actualProviderCalls===0&&!r.liveDispatchAuthorized&&!r.languageQualityMeasured,'FAILURE_RECEIPT');
  indexed.set(key,r);
 }
 const cases=bank.cases.map(item=>{
  const candidate=models.map(m=>indexed.get('candidate/'+item.id+'/'+m)),baseline=models.map(m=>indexed.get('baseline/'+item.id+'/'+m));
  check(candidate.every(Boolean)&&baseline.every(Boolean),'MISSING_CELL');
  check(candidate.every(r=>digest(r.input)===digest(candidate[0].input))&&baseline.every(r=>digest(r.input)===digest(baseline[0].input)),'MODEL_INPUT_DRIFT');
  const differences=[...new Set([...Object.keys(candidate[0].input),...Object.keys(baseline[0].input)])]
   .filter(k=>digest(candidate[0].input[k]??null)!==digest(baseline[0].input[k]??null)).sort();
  check(digest(differences)===digest(item.domain==='word'?['contextRole']:[]),'PROFILE_INPUT_DRIFT');
  const parent=candidate[0];
  return {caseId:item.id,domain:item.domain,lessonId:item.lessonId??null,input:parent.input,inputHash:digest(parent.input),
   parentBinding:{parentRequestRaw:parent.requestRaw,parentRequestSha256:parent.requestSha256},
   parentRequests:candidate.map(r=>({model:r.model,requestSha256:r.requestSha256})),
   baselineRequests:baseline.map(r=>({model:r.model,requestSha256:r.requestSha256})),
   baselineInputDifferenceFields:differences,cohortDraftCaseHash:digest(item),
   parentIsUnsubmittedProductRequest:true,parentModelIsReferenceAuthor:false,
   actualProductGenerationObserved:false,referenceQualified:false,mainDispatchAuthorized:false};
 });
 const basis={protocol:JOINT_REQUEST_BINDINGS_V1,jointFreezeHash:bank.jointFreezeHash,cohortHash:digest(bank),cases,
  counts:{cases:60,parentCandidateRequests:180,baselineRequests:180,wordCases:30,grammarCases:30,
   candidateExplicitKoreanRequests:90,baselineOrdinaryKoreanRequests:90,grammarProfileInputEqualPairs:90},
  comparisonScope:'Word bodies differ by explicit Korean-intent role; preserve that intervention instead of claiming an identical-prompt model comparison.',
  actualProviderCalls:0,actualCountCalls:0,actualKeyReads:0,actualProductGenerations:0,referencesQualified:0,
  liveDispatchAuthorized:false,englishTruthCertified:false,mainDispatchAuthorized:false};
 return {...basis,hash:digest(basis)};
}

