// A bounded, proposed two-model diagnostic; not a replacement for the full plan.
import {createHash} from 'node:crypto';
import {compileRubricPublicControlPlanV1,inspectRubricPublicControlResponseV1,REFERENCE_RUBRIC_HASH_V1} from './ai-quality-v147-reference-rubric-v1.mjs';
import {digest} from './ai-quality-v147-budget-v3.mjs';
export const TWO_REVIEWER_FOLLOWUP_V1='ai-quality-v147-two-reviewer-followup-v1';
const models=Object.freeze(['gpt-6.1-sol','gpt-6.1-terra']),rates={'gpt-6.1-sol':[2n,10n],'gpt-6.1-terra':[1n,5n]},prior=3788335n,cap=5000000n;
const check=(ok,c)=>{if(!ok)throw Error('TF1_'+c);},sha=x=>createHash('sha256').update(x).digest('hex');
const cost=(m,n)=>{const [input,output]=rates[m];return ((BigInt(n)*input+4096n*output)*11n+9n)/10n;};
export function compileTwoReviewerFollowupV1(){
 const fullPlan=compileRubricPublicControlPlanV1(),requests=fullPlan.requests.filter(r=>models.includes(r.modelId)).map(r=>({...structuredClone(r),requestRawSha256:sha(r.requestRaw),countRequestRawSha256:sha(r.countRequestRaw)}));
 check(requests.length===4&&requests.every(r=>r.plannedControlVotes===6),'SCOPE');
 for(const model of models)check(requests.filter(r=>r.modelId===model).map(r=>r.layout).sort().join('|')==='candidate-first|control-first','ORDERS');
 for(const r of requests){const w=JSON.parse(r.requestRaw);check(w.max_output_tokens===4096&&w.store===false&&w.service_tier==='default'&&digest(w.prompt_cache_options)===digest({mode:'explicit',ttl:'30m'})&&!r.requestRaw.includes('prompt_cache_breakpoint'),'MODEL_OPTIONS');}
 const basis={protocol:TWO_REVIEWER_FOLLOWUP_V1,rubricHash:REFERENCE_RUBRIC_HASH_V1,fullPlan,fullPlanHash:fullPlan.hash,selectedModels:[...models],excludedModels:['gpt-6-astra'],requests,responseSlots:4,countSlots:4,controlVotes:24,anchorGrades:4,inputCeiling:50000,outputCeiling:4096,priorDebitMicros:String(prior),campaignCapMicros:String(cap),newCountAllowanceMicros:'465168',newGenerationApprovalMicros:'746497',expectedVectorsChanged:false,allThreeModelScopeComplete:false,independentExpectationsQualified:false,developmentExposed:true,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,newScopeApproved:false,liveDispatchAuthorized:false,englishQualityQualified:false,releaseVerdict:'held'};
 return {...basis,hash:digest(basis)};
}
function trusted(plan){const {hash,...basis}=plan;check(digest(basis)===hash&&hash===compileTwoReviewerFollowupV1().hash,'PLAN_BINDING');}
export function quoteTwoReviewerFollowupV1(plan,counts=null){
 trusted(plan);if(counts!==null)check(counts&&Object.keys(counts).sort().join('|')===plan.requests.map(r=>r.key).sort().join('|'),'COUNT_KEYS');
 const rows=plan.requests.map(r=>{const n=counts===null?50000:counts[r.key];check(Number.isSafeInteger(n)&&n>0&&n<=50000,'INPUT_BOUND');return {key:r.key,inputTokens:n,generationMaximumMicros:String(cost(r.modelId,n))};}),generation=rows.reduce((n,x)=>n+BigInt(x.generationMaximumMicros),0n),total=prior+465168n+generation;
 check(generation<=746497n&&total<=cap,'CAMPAIGN_CAP');return {protocol:TWO_REVIEWER_FOLLOWUP_V1,rows,priorDebitMicros:String(prior),campaignCapMicros:String(cap),generationMaximumMicros:String(generation),newCountAllowanceMicros:'465168',campaignUpperMicros:String(total),remainingMicros:String(cap-total),actualInputTokensMeasured:false,callerSuppliedCountScenario:counts!==null,countTariffExplicitlyVerified:false,invoiceGuarantee:false,allThreeModelScopeComplete:false,newScopeApproved:false};
}
export function inspectTwoReviewerFollowupV1(plan,records){
 trusted(plan);check(Array.isArray(records)&&records.length===4&&new Set(records.map(r=>r.key)).size===4&&records.every(r=>plan.requests.some(p=>p.key===r.key)),'FIXED_DENOMINATOR');
 const views=records.map(r=>inspectRubricPublicControlResponseV1(plan.fullPlan,r)),rows=views.flatMap(x=>x.rows),anchors=views.map(x=>x.anchor);check(rows.length===24&&anchors.length===4,'VOTE_COUNT');
 return {protocol:TWO_REVIEWER_FOLLOWUP_V1,rubricHash:plan.rubricHash,denominator:24,matched:rows.filter(x=>x.matched).length,rows,anchors,proposalAgreementSatisfied:rows.every(x=>x.matched),selectedModels:[...models],astraIncluded:false,allThreeModelScopeComplete:false,expectedVectorsChanged:false,independentExpectationsQualified:false,semanticCorrectnessVerified:false,referenceRoleQualified:false,englishQualityQualified:false,causalEffectOfRubricEstablished:false,releaseVerdict:'held'};
}
