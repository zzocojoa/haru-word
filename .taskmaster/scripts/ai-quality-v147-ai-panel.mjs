import {legacyPanelInstructionsV1} from './ai-quality-v147-panel-instructions-v1.mjs';
// Offline AI-only panel compiler/accounting. No network, credentials or ledger IO.
// Body/receipt hashes bind observations, not provider authenticity or English truth.
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {DIMENSIONS,CRITICAL,JUDGES,digest,validateGrade,sameGrade,summarizeCalibration} from './ai-quality-v147-calibration.mjs';
import {assessmentContextEnabledV1,ASSESSMENT_CONTEXT_HASH_V1,ASSESSMENT_CONTEXT_FORMAT_V1,normalizeAssessmentInputV1,boundedProductPolicyV1,attachAssessmentContextRequestV1,assessmentContextGradeSchemaV1,validateAssessmentContextRequestV1,parseAssessmentContextPayloadV1,summarizeAssessmentAxesV1} from './ai-quality-v147-assessment-context-v1.mjs';
import {PRODUCT_RUBRIC_HASH_V2} from './ai-quality-v147-product-rubric-v2.mjs';
import {productRubricEnabledV1,PRODUCT_RUBRIC_HASH_V1,PRODUCT_RUBRIC_FORMAT_V1,attachProductRubricRequestV1,productGradeSchemaV1,validateProductRubricRequestV1,parseProductRubricPayloadV1} from './ai-quality-v147-product-rubric-v1.mjs';

import {explanationMainEnabledV1,attachExplanationMainRequestV1,explanationMainSchemaV1} from './ai-quality-v147-explanation-main-v1.mjs';
import {EXPLANATION_FORMAT_V1,PRODUCT_RUBRIC_HASH_V4,validateExplanationScopeRequestV1,parseExplanationScopePayloadV1} from './ai-quality-v147-explanation-scope-v1.mjs';
export const PANEL_PROTOCOL='ai-quality-v147-ai-panel-v1';
export const PANEL_LAYOUTS=Object.freeze(['input-first','feedback-first']);
const MODELS=Object.freeze([...JUDGES]),DIMS=Object.freeze([...DIMENSIONS]),FLAGS=Object.freeze([...CRITICAL]);
const REASONS=Object.freeze(['confirmed','target','grammar','meaning_preservation','explanation','abstention','unavailable','insufficient_reference']);
const LEVELS=['mechanically-verified','source-supported','ai-consensus','unresolved'];
const check=(ok,code)=>{if(!ok)throw Error('PANEL_'+code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fields=(v,keys)=>object(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_.:/-]{1,160}$/.test(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const sha=v=>createHash('sha256').update(v).digest('hex');
const grade=g=>{try{validateGrade(g);}catch{throw Error('PANEL_GRADE_SCHEMA');}return structuredClone(g);};
const frozen=v=>{if(object(v)||Array.isArray(v)){for(const x of Object.values(v))frozen(x);Object.freeze(v);}return v;};
const uuid=value=>{const b=Buffer.from(sha(value).slice(0,32),'hex');b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const projectInput=input=>{
 check(object(input),'INPUT');const out={};
 for(const [k,n]of [['sentence',2000],['target',300],['contextKind',30],['contextNote',500]])if(Object.hasOwn(input,k)){check(text(input[k],n),'INPUT');out[k]=input[k];}
 check(!!out.sentence&&!!out.target,'INPUT');return out;
};
const projectFeedback=(f,input)=>{
 if(f===null)return null;check(object(f)&&f.original===input.sentence,'FEEDBACK_CONTEXT');
 check(['appropriate','needs_work','uncertain'].includes(f.meaningUsage)&&['natural','needs_work','uncertain'].includes(f.grammar),'FEEDBACK_LABEL');
 for(const [k,n]of [['original',2000],['correctedSentence',2000],['explanation',6000]])check(text(f[k],n),'FEEDBACK_TEXT');
 return Object.fromEntries(['original','meaningUsage','grammar','correctedSentence','explanation'].map(k=>[k,f[k]]));
};
const projectReference=ref=>{
 check(fields(ref,['level','criterion','sources'])&&LEVELS.includes(ref.level)&&text(ref.criterion,4000)&&Array.isArray(ref.sources)&&ref.sources.length<=8,'REFERENCE');
 const sources=ref.sources.map(s=>{
  check(fields(s,['url','checkedAt','contentSha256','excerpt'])&&text(s.url,600)&&text(s.checkedAt,40)&&hex(s.contentSha256)&&text(s.excerpt,1600),'REFERENCE_SOURCE');
  let url;try{url=new URL(s.url);}catch{throw Error('PANEL_REFERENCE_SOURCE');}check(url.protocol==='https:'&&!url.username&&!url.password,'REFERENCE_SOURCE');
  check(Number.isFinite(Date.parse(s.checkedAt)),'REFERENCE_SOURCE');return structuredClone(s);
 });
 check(ref.level!=='source-supported'||sources.length>0,'REFERENCE_SOURCE_REQUIRED');
 return {level:ref.level,criterion:ref.criterion,sources};
};
function rubric(contract){
 check(object(contract)&&object(contract.dimensionDefinitions)&&object(contract.criticalPolicy),'RUBRIC');
 check(DIMS.every(k=>text(contract.dimensionDefinitions[k],2200)&&contract.dimensionDefinitions[k])&&FLAGS.every(k=>text(contract.criticalPolicy[k],1800)&&contract.criticalPolicy[k]),'RUBRIC');
 return {dimensions:Object.fromEntries(DIMS.map(k=>[k,contract.dimensionDefinitions[k]])),critical:Object.fromEntries(FLAGS.map(k=>[k,contract.criticalPolicy[k]]))};
}
export function panelWorkload({caseCount,generationRepeats=1,reviewLayouts=2,referenceConstructionCalls=null,referenceReviewCalls=null}){
 check(Number.isSafeInteger(caseCount)&&caseCount>0&&Number.isSafeInteger(generationRepeats)&&generationRepeats>0&&reviewLayouts===2,'WORKLOAD');
 for(const n of [referenceConstructionCalls,referenceReviewCalls])check(n===null||Number.isSafeInteger(n)&&n>=0,'WORKLOAD');
 const generation=caseCount*3*2*generationRepeats,review=generation*2*reviewLayouts,calibration=12*3*reviewLayouts;
 check([generation,review,calibration,generation+review+calibration].every(Number.isSafeInteger),'WORKLOAD');
 const additionalRolesSpecified=referenceConstructionCalls!==null&&referenceReviewCalls!==null;
 const knownSubtotal=generation+review+calibration+(referenceConstructionCalls??0)+(referenceReviewCalls??0);
 check(Number.isSafeInteger(knownSubtotal),'WORKLOAD');
 return frozen({protocol:PANEL_PROTOCOL,caseCount,generationRepeats,generation,review,calibration,referenceConstructionCalls,referenceReviewCalls,knownSubtotal,additionalRolesSpecified,totalIsApprovalCap:false,independentFamilyCount:null,repeatedOutputsAreIndependentFamilies:false,adjudicationCalls:0,disagreementsHeldWithoutRetry:true,old756Compatible:false,priceQuoted:false,realDispatchAuthorized:false});
}
function schema(){
 const critical={type:'object',properties:Object.fromEntries(FLAGS.map(k=>[k,{type:'boolean'}])),required:[...FLAGS],additionalProperties:false};
 const g={type:'object',properties:{...Object.fromEntries(DIMS.map(k=>[k,{type:'string',enum:['pass','fail','uncertain','unavailable']}])),criticalErrors:critical},required:[...DIMS,'criticalErrors'],additionalProperties:false};
 return {type:'object',properties:{grade:g,reasonCodes:{type:'array',items:{type:'string',enum:[...REASONS]},minItems:1,maxItems:8}},required:['grade','reasonCodes'],additionalProperties:false};
}
function requestRaw({judgeId,layout,evidence,trustedRubric,productOperational,assessmentContext,explanationScope}){
 const sections=layout==='input-first'?{input:evidence.input,feedback:evidence.feedback,reference:evidence.reference}:{feedback:evidence.feedback,reference:evidence.reference,input:evidence.input};
 const instructions=legacyPanelInstructionsV1(trustedRubric);
 const body={model:judgeId,instructions,input:[{role:'user',content:JSON.stringify({EVALUATION_DATA:sections})}],text:{format:{type:'json_schema',name:'haru_ai_panel_grade',strict:true,schema:schema()}},reasoning:{effort:'low'},max_output_tokens:4096,store:false,stream:false,service_tier:'default'};
 const base=JSON.stringify(body),contextRaw=assessmentContext?attachAssessmentContextRequestV1(base):productOperational?attachProductRubricRequestV1(base):base,raw=explanationScope?attachExplanationMainRequestV1(contextRaw):contextRaw;check(Buffer.byteLength(raw)<=131072,'REQUEST_BYTES');return raw;
}
export function compileAiPanel({runId,observations,witnesses,contract,salt=randomBytes(32)}){
 check(typeof runId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(runId)&&Buffer.isBuffer(salt)&&salt.length>=32,'IDENTITY');
 check(Array.isArray(observations)&&observations.length>0&&Array.isArray(witnesses)&&witnesses.length===12,'ROWS');
 // Reuse the frozen reference contract's coverage checks; no actual judge claim.
 try{summarizeCalibration(witnesses,[]);}catch{throw Error('PANEL_WITNESSES');}
 const explanationScope=explanationMainEnabledV1(contract),trustedRubric=rubric(contract),assessmentContext=assessmentContextEnabledV1(contract),productOperational=productRubricEnabledV1(contract),slots=[],rows=[],calibrationReferences=[],seen=new Set();
 function add(kind,sourceId,generatorId,judgeId,layout,evidence,privateParent){
  check(kind==='calibration'||judgeId!==generatorId,'SELF_JUDGE');
  const blindId=createHmac('sha256',salt).update(kind+'|'+sourceId+'|'+digest(evidence)+(explanationScope?'|'+PRODUCT_RUBRIC_HASH_V4:assessmentContext?'|'+ASSESSMENT_CONTEXT_HASH_V1:productOperational?'|'+PRODUCT_RUBRIC_HASH_V1:'')).digest('hex').slice(0,24);
  const key=kind+'/'+blindId+'/'+judgeId+'/'+layout,requestId=uuid(PANEL_PROTOCOL+'|'+runId+'|'+key),raw=requestRaw({judgeId,layout,evidence,trustedRubric,productOperational,assessmentContext,explanationScope});
  // A calibration witness intentionally has unavailable feedback: the judge
  // must recognize it. An unavailable main generation is held without a call.
  slots.push({key,requestId,kind,judgeId,layout,blindId,evidenceHash:digest(evidence),bodySha256:sha(raw),raw,dispatchEligible:kind==='calibration'||evidence.feedback!==null,privateBinding:{sourceId,generatorId,...privateParent}});
  return key;
 }
 for(const row of observations){
  check(object(row)&&id(row.id)&&!seen.has(row.id)&&MODELS.includes(row.generatorId)&&['baseline','candidate'].includes(row.phase)&&id(row.caseId)&&id(row.familyId)&&['word','grammar'].includes(row.domain)&&['normal','needsCorrection','insufficientContext'].includes(row.stratum)&&hex(row.parentReceiptHash),'OBSERVATION');seen.add(row.id);
  const baseInput=projectInput(row.input),input=assessmentContext?normalizeAssessmentInputV1(baseInput,{domain:row.domain,requestInput:row.requestInput}):baseInput,feedback=projectFeedback(row.feedback,input),reference=projectReference(row.reference),evidence={input,feedback,reference},keys=[];
  for(const judgeId of MODELS.filter(m=>m!==row.generatorId))for(const layout of PANEL_LAYOUTS)keys.push(add('review',row.id,row.generatorId,judgeId,layout,evidence,{phase:row.phase,caseId:row.caseId,parentReceiptHash:row.parentReceiptHash}));
  rows.push({id:row.id,generatorId:row.generatorId,phase:row.phase,caseId:row.caseId,familyId:row.familyId,domain:row.domain,stratum:row.stratum,evidenceHash:digest(evidence),parentReceiptHash:row.parentReceiptHash,available:feedback!==null,referenceLevel:reference.level,...(assessmentContext?{productPolicyCompliance:boundedProductPolicyV1(input,feedback)}:{}),slots:keys});
 }
 for(const w of witnesses){
  const baseInput=projectInput(w.input),input=assessmentContext?normalizeAssessmentInputV1(baseInput,{domain:w.assessmentDomain,requestInput:w.requestInput,origin:'hypothetical-calibration'}):baseInput,feedback=projectFeedback(w.feedback,input),evidence={input,feedback,reference:assessmentContext&&w.reference!==undefined?projectReference(w.reference):{level:'ai-consensus',criterion:'Apply the fixed common rubric. No expected score is supplied.',sources:[]}};
  for(const judgeId of MODELS)for(const layout of PANEL_LAYOUTS)add('calibration',w.id,null,judgeId,layout,evidence,{witnessId:w.id});
  calibrationReferences.push({witnessId:w.id,group:w.group,expectedGrade:grade(w.expectedGrade),...(assessmentContext?{expectedEvidenceAxes:structuredClone(w.expectedEvidenceAxes)}:{})});
 }
 const plan={protocol:PANEL_PROTOCOL,runId,rubricHash:digest(trustedRubric),...(assessmentContext?{assessmentContextHash:ASSESSMENT_CONTEXT_HASH_V1,productOperationalRubricHash:explanationScope?PRODUCT_RUBRIC_HASH_V4:PRODUCT_RUBRIC_HASH_V2,...(explanationScope?{explanationScopeHash:PRODUCT_RUBRIC_HASH_V4}:{})}:productOperational?{productOperationalRubricHash:PRODUCT_RUBRIC_HASH_V1}:{}),witnessesHash:digest(witnesses),rows,slots,calibrationReferences,partiallyBlindedOnly:true,sourceClaimsAreCallerSupplied:true,providerReceiptsAuthenticated:false,realDispatchAuthorized:false};
 check(new Set(slots.map(s=>s.key)).size===slots.length&&new Set(slots.map(s=>s.requestId)).size===slots.length,'DUPLICATE_SLOT');
 return frozen({...plan,seal:digest(plan)});
}
export function validateAiPanel(plan){
 check(object(plan)&&plan.protocol===PANEL_PROTOCOL,'PROTOCOL');const {seal,...body}=plan;check(seal===digest(body),'PLAN_CHANGED');
 check(plan.realDispatchAuthorized===false&&plan.providerReceiptsAuthenticated===false,'UNSUPPORTED_CLAIM');
 const explanationScope=plan.explanationScopeHash!==undefined,assessmentContext=plan.assessmentContextHash!==undefined,productOperational=!assessmentContext&&plan.productOperationalRubricHash!==undefined;check(!explanationScope||assessmentContext&&plan.explanationScopeHash===PRODUCT_RUBRIC_HASH_V4,'EXPLANATION_POLICY');check(!assessmentContext||plan.assessmentContextHash===ASSESSMENT_CONTEXT_HASH_V1&&plan.productOperationalRubricHash===(explanationScope?PRODUCT_RUBRIC_HASH_V4:PRODUCT_RUBRIC_HASH_V2),'CONTEXT_POLICY');check(!productOperational||plan.productOperationalRubricHash===PRODUCT_RUBRIC_HASH_V1,'PRODUCT_POLICY');
 check(new Set(plan.slots.map(s=>s.key)).size===plan.slots.length&&new Set(plan.slots.map(s=>s.requestId)).size===plan.slots.length,'DUPLICATE_SLOT');
 for(const s of plan.slots){check(sha(s.raw)===s.bodySha256&&MODELS.includes(s.judgeId)&&PANEL_LAYOUTS.includes(s.layout),'WIRE_CHANGED');const b=JSON.parse(s.raw);check(b.model===s.judgeId&&b.store===false&&b.stream===false&&b.max_output_tokens===(explanationScope?1024:4096)&&digest(b.text.format.schema)===digest(explanationScope?explanationMainSchemaV1(schema()):assessmentContext?assessmentContextGradeSchemaV1(schema()):productOperational?productGradeSchemaV1(schema()):schema()),'WIRE_CHANGED');if(explanationScope)validateExplanationScopeRequestV1(s.raw);else if(assessmentContext)validateAssessmentContextRequestV1(s.raw);if(productOperational)validateProductRubricRequestV1(s.raw);check(s.kind==='calibration'||s.judgeId!==s.privateBinding.generatorId,'SELF_JUDGE');}
 for(const r of plan.rows){
  const slots=plan.slots.filter(s=>s.kind==='review'&&s.privateBinding.sourceId===r.id);check(slots.length===4&&digest(slots.map(s=>s.key))===digest(r.slots),'ROW_SLOTS');
  for(const judge of MODELS.filter(m=>m!==r.generatorId))check(PANEL_LAYOUTS.every(layout=>slots.some(s=>s.judgeId===judge&&s.layout===layout)),'ROW_SLOTS');
  check(slots.every(s=>s.evidenceHash===r.evidenceHash&&s.privateBinding.parentReceiptHash===r.parentReceiptHash&&s.privateBinding.generatorId===r.generatorId),'ROW_BINDING');
 }
 check(plan.slots.filter(s=>s.kind==='review').length===plan.rows.length*4&&plan.slots.filter(s=>s.kind==='calibration').length===72,'ROLE_COUNT');return true;
}
export function parsePanelPayload(raw){
 check(typeof raw==='string'&&Buffer.byteLength(raw)<=24000,'RESPONSE_BYTES');let v;try{v=JSON.parse(raw);}catch{throw Error('PANEL_RESPONSE_JSON');}
 // JSON.parse silently keeps the last duplicate key. Reject that ambiguity,
 // including escaped spellings, before accepting a structured judge record.
 const stack=[];for(let i=0;i<raw.length;){
  if(raw[i]==='"'){
   const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"')break;}
   let next=i;while(/\s/.test(raw[next]??'')&&next<raw.length)next++;
   if(raw[next]===':'){const key=JSON.parse(raw.slice(start,i)),set=stack.at(-1);check(set&&!set.has(key),'RESPONSE_DUPLICATE_KEY');set.add(key);}
  }else{if(raw[i]==='{')stack.push(new Set());else if(raw[i]==='}')stack.pop();i++;}
 }
 check(fields(v,['grade','reasonCodes'])&&Array.isArray(v.reasonCodes)&&v.reasonCodes.length>0&&v.reasonCodes.length<=8&&v.reasonCodes.every(k=>REASONS.includes(k))&&new Set(v.reasonCodes).size===v.reasonCodes.length,'RESPONSE_SCHEMA');
 return {grade:grade(v.grade),reasonCodes:[...v.reasonCodes]};
}
export function parsePanelPayloadForRequest({requestRaw,payloadRaw}){
 const request=JSON.parse(requestRaw);if(request.text?.format?.name===EXPLANATION_FORMAT_V1)return parseExplanationScopePayloadV1({requestRaw,payloadRaw});if(request.text?.format?.name===ASSESSMENT_CONTEXT_FORMAT_V1)return parseAssessmentContextPayloadV1({requestRaw,payloadRaw});return request.text?.format?.name===PRODUCT_RUBRIC_FORMAT_V1?parseProductRubricPayloadV1({requestRaw,payloadRaw}):parsePanelPayload(payloadRaw);
}
function indexRecords(plan,records){
 validateAiPanel(plan);check(Array.isArray(records),'RECORDS');const indexed=new Map(),slots=new Map(plan.slots.map(s=>[s.key,s]));
 for(const r of records){
  check(fields(r,['key','requestId','judgeId','layout','evidenceHash','bodySha256','state','payloadRaw']),'RECORD_SCHEMA');const s=slots.get(r.key);
  check(s&&!indexed.has(r.key),'RECORD_SLOT');check(s.dispatchEligible,'UNAVAILABLE_NOT_DISPATCHED');
  check(r.requestId===s.requestId&&r.judgeId===s.judgeId&&r.layout===s.layout&&r.evidenceHash===s.evidenceHash&&r.bodySha256===s.bodySha256,'RECORD_BINDING');
  check(['graded','failed'].includes(r.state),'RECORD_STATE');const result=r.state==='graded'?parsePanelPayloadForRequest({requestRaw:s.raw,payloadRaw:r.payloadRaw}):null;check(r.state==='graded'||r.payloadRaw===null,'RECORD_FAILED');indexed.set(r.key,{record:structuredClone(r),result});
 }
 return indexed;
}
function calibration(plan,indexed){
 const results=[];for(const layout of PANEL_LAYOUTS){
  const witnesses=plan.calibrationReferences.map(w=>({id:w.witnessId,group:w.group,expectedGrade:w.expectedGrade}));
  const records=plan.slots.filter(s=>s.kind==='calibration'&&s.layout===layout).flatMap(s=>{const r=indexed.get(s.key);return r?[{judgeId:s.judgeId,witnessId:s.privateBinding.witnessId,state:r.result?'graded':'failed',grade:r.result?.grade??null}]:[];});
  const report=summarizeCalibration(witnesses,records),axes=plan.assessmentContextHash?summarizeAssessmentAxesV1(plan.calibrationReferences.map(w=>({id:w.witnessId,expectedEvidenceAxes:w.expectedEvidenceAxes})),plan.slots.filter(s=>s.kind==='calibration'&&s.layout===layout).flatMap(s=>{const r=indexed.get(s.key);return r?[{judgeId:s.judgeId,witnessId:s.privateBinding.witnessId,state:r.result?'graded':'failed',sourceAdequacy:r.result?.sourceAdequacy,learnerContext:r.result?.learnerContext,abstentionNeed:r.result?.abstentionNeed}]:[];})):null;results.push({layout,...report,...(axes?{evidenceAxes:axes}:{})});
 }
 return {layouts:results,thresholdArithmeticSatisfied:results.every(x=>x.thresholdArithmeticSatisfied&&(!x.evidenceAxes||x.evidenceAxes.arithmeticSatisfied)),calibrationReferenceLevel:'public-development-ai-authored',modelCalibrationMeasured:false,humanAgreementMeasured:false};
}
export function summarizeAiPanel(plan,records){
 const indexed=indexRecords(plan,records),cal=calibration(plan,indexed),rows=plan.rows.map(row=>{
  const received=row.slots.flatMap(k=>indexed.has(k)?[indexed.get(k)]:[]),valid=received.filter(x=>x.result),grades=valid.map(x=>x.result.grade);
  const critical=Object.fromEntries(FLAGS.map(k=>[k,grades.some(g=>g.criticalErrors[k])]));
  let state;if(!row.available)state='held-unavailable';else if(Object.values(critical).some(Boolean))state='held-critical';else if(row.productPolicyCompliance?.state==='fail')state='held-policy';else if(received.length!==4||valid.length!==4)state='held-incomplete';else if(!cal.thresholdArithmeticSatisfied)state='held-calibration';else if(row.referenceLevel==='unresolved')state='held-reference';else if(valid.some(x=>x.result.assessmentContextHash&&x.result.sourceAdequacy!=='sufficient'))state='held-reference';else if(valid.some(x=>x.result.assessmentContextHash)&&!valid.every(x=>digest([x.result.sourceAdequacy,x.result.learnerContext,x.result.abstentionNeed])===digest([valid[0].result.sourceAdequacy,valid[0].result.learnerContext,valid[0].result.abstentionNeed])))state='held-disagreement';else if(grades.some(g=>DIMS.some(k=>['uncertain','unavailable'].includes(g[k]))))state='held-uncertain';else if(!grades.every(g=>sameGrade(g,grades[0])))state='held-disagreement';else if(DIMS.some(k=>grades[0][k]==='fail'))state='ai-consensus-fail';else state='ai-consensus-pass';
  return {rowId:row.id,phase:row.phase,generatorId:row.generatorId,caseId:row.caseId,familyId:row.familyId,domain:row.domain,stratum:row.stratum,referenceLevel:row.referenceLevel,plannedReviews:4,received:received.length,valid:valid.length,state,critical,...(row.productPolicyCompliance?{productPolicyCompliance:structuredClone(row.productPolicyCompliance)}:{}),rawReviews:received.map(x=>({requestId:x.record.requestId,judgeId:x.record.judgeId,layout:x.record.layout,state:x.record.state,grade:x.result?.grade??null,reasonCodes:x.result?.reasonCodes??[],...(x.result?.assessmentContextHash?{assessmentContext:{hash:x.result.assessmentContextHash,sourceAdequacy:x.result.sourceAdequacy,learnerContext:x.result.learnerContext,abstentionNeed:x.result.abstentionNeed,policyCompliance:x.result.policyCompliance}}:{}),...(x.result?.explanationScopeHash?{explanationScope:{hash:x.result.explanationScopeHash,outputTokenMax:x.result.actualRequestOutputCap}}:{})}))};
 });
 const counts={};for(const r of rows)counts[r.state]=(counts[r.state]??0)+1;
 const groups=[];for(const phase of ['baseline','candidate'])for(const generatorId of MODELS)for(const domain of ['word','grammar'])for(const stratum of ['normal','needsCorrection','insufficientContext']){
  const selected=rows.filter(r=>r.phase===phase&&r.generatorId===generatorId&&r.domain===domain&&r.stratum===stratum);if(!selected.length)continue;
  const c={};for(const r of selected)c[r.state]=(c[r.state]??0)+1;groups.push({phase,generatorId,domain,stratum,denominator:selected.length,familyTags:new Set(selected.map(r=>r.familyId)).size,familyIndependenceVerified:false,counts:c});
 }
 return {protocol:PANEL_PROTOCOL,planSeal:plan.seal,...(plan.explanationScopeHash?{explanationScope:{hash:plan.explanationScopeHash,outputTokenMax:1024,sourceQualified:false}}:{}),denominator:rows.length,plannedReviewRequests:rows.length*4,calibrationPlanned:72,counts,rows,groups,calibration:cal,held:rows.some(r=>r.state.startsWith('held-')),rawGradesOverwritten:false,majorityVoteApplied:false,providerCallsMadeByThisModule:0,upstreamProvenanceVerified:false,actualKeyReads:0,humanExpertValidation:false,learnerEfficacyMeasured:false,englishAccuracyCertified:false,realDispatchAuthorized:false,releaseVerdict:'held',scope:'Offline accounting of caller-supplied AI grades only. A consensus pass is not independently validated English truth.'};
}
