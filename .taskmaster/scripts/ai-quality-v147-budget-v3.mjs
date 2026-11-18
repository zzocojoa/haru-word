// New staged panel budget kernel. No network, credentials, files or old ledgers.
// A compiled immutable spec and producer-owned immutable states avoid repeatedly
// revalidating/rehashing the whole large spec during every journal operation.
import {digest} from './ai-quality-v147-calibration.mjs';
export {digest};
export const PROTOCOL_V3='ai-quality-v147-panel-v3';
export const PLAN_V3='ai-quality-v147-2026-11-06';
export const MODELS_V3=Object.freeze(['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra']);
export const ROLES_V3=Object.freeze(['referenceDraft','referenceReview','generation','review','calibration']);
const layouts=['input-first','feedback-first'];
const check=(ok,code)=>{if(!ok)throw Error('P3_'+code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fields=(x,names)=>object(x)&&Object.keys(x).sort().join('|')===[...names].sort().join('|');
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const money=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,49})$/.test(x);
const freeze=x=>{if(object(x)||Array.isArray(x)){for(const v of Object.values(x))if(!Object.isFrozen(v))freeze(v);Object.freeze(x);}return x;};
const emptyCounts=()=>Object.fromEntries(ROLES_V3.map(r=>[r,0]));
const requestFields=['key','role','phase','caseId','modelId','generatorId','repetition','layout','parentKey','bodyKind','bodyHash','maximumBytes','inputTokenMax','outputTokenMax','inputBoundHash'];
export const v3SlotKey=d=>[d.phase,d.generatorId??'none',d.caseId,d.role,d.modelId,d.repetition,d.layout??'single'].join('/');
const group=d=>d.role==='calibration'?'calibration/'+d.caseId:d.phase==='reference'?'reference/'+d.caseId:[d.phase,d.generatorId,d.caseId,d.repetition].join('/');
const matches=(d,v)=>Object.entries(v).every(([k,x])=>d[k]===x);
function profile(p){
 check(fields(p,['stage','caseIds','generationRepeats','witnessIds'])&&['reference-preparation','pilot-panel'].includes(p.stage),'PROFILE');
 check(Array.isArray(p.caseIds)&&p.caseIds.length>0&&p.caseIds.every(id)&&new Set(p.caseIds).size===p.caseIds.length,'CASES');
 check(Number.isSafeInteger(p.generationRepeats)&&p.generationRepeats>0&&Array.isArray(p.witnessIds),'REPETITIONS');
 const counts=emptyCounts();if(p.stage==='reference-preparation'){
  check(p.generationRepeats===1&&p.witnessIds.length===0,'REFERENCE_PROFILE');counts.referenceDraft=p.caseIds.length;counts.referenceReview=2*p.caseIds.length;
 }else{
  check(p.witnessIds.length===12&&p.witnessIds.every(id)&&new Set(p.witnessIds).size===12,'CALIBRATION_PROFILE');
  counts.generation=p.caseIds.length*6*p.generationRepeats;counts.review=counts.generation*4;counts.calibration=72;
 }
 check(Object.values(counts).every(integer)&&Number.isSafeInteger(Object.values(counts).reduce((a,b)=>a+b,0)),'PROFILE_SIZE');return counts;
}
function quote(q,mode){
 check(fields(q,['kind','evidenceHash','regionalNumerator','regionalDenominator','inputFactorNumerator','inputFactorDenominator','models'])&&q.kind===(mode==='synthetic'?'synthetic-test':'verified-price')&&hash(q.evidenceHash),'QUOTE');
 for(const k of ['regionalNumerator','regionalDenominator','inputFactorNumerator','inputFactorDenominator'])check(money(q[k])&&BigInt(q[k])>0n,'QUOTE_FACTOR');
 check(BigInt(q.regionalNumerator)>=BigInt(q.regionalDenominator)&&BigInt(q.inputFactorNumerator)>=BigInt(q.inputFactorDenominator),'UNSAFE_FACTOR');
 check(fields(q.models,MODELS_V3),'MODEL_PRICES');for(const r of Object.values(q.models))check(fields(r,['inputMicrosPerMillion','outputMicrosPerMillion'])&&money(r.inputMicrosPerMillion)&&money(r.outputMicrosPerMillion)&&BigInt(r.inputMicrosPerMillion)>0n&&BigInt(r.outputMicrosPerMillion)>0n,'PRICE');
}
export function validateSpecV3(s){
 check(fields(s,['schemaVersion','protocol','planId','runId','mode','sourceSeal','profile','quote','requests','order'])&&s.schemaVersion===3&&s.protocol===PROTOCOL_V3&&s.planId===PLAN_V3&&uuid(s.runId),'SPEC_IDENTITY');
 check(['synthetic','evaluation'].includes(s.mode)&&hash(s.sourceSeal),'SOURCE');quote(s.quote,s.mode);const expected=profile(s.profile),counts=emptyCounts();
 check(Array.isArray(s.requests)&&s.requests.length===Object.values(expected).reduce((a,b)=>a+b,0),'REQUEST_COUNT');const by=new Map();
 for(const d of s.requests){
  check(fields(d,requestFields)&&ROLES_V3.includes(d.role)&&id(d.caseId)&&MODELS_V3.includes(d.modelId)&&Number.isSafeInteger(d.repetition)&&d.repetition>0,'DESCRIPTOR');
  check(d.key===v3SlotKey(d)&&!by.has(d.key),'SLOT_IDENTITY');by.set(d.key,d);counts[d.role]++;
  check(integer(d.inputTokenMax)&&d.inputTokenMax>0&&integer(d.outputTokenMax)&&d.outputTokenMax>0&&d.outputTokenMax<=4096&&(d.role!=='generation'||d.outputTokenMax===4096)&&integer(d.maximumBytes)&&d.maximumBytes>0&&d.maximumBytes<=262144&&hash(d.inputBoundHash)&&hash(d.bodyHash),'BOUNDS');
  if(d.role==='calibration')check(s.profile.stage==='pilot-panel'&&s.profile.witnessIds.includes(d.caseId)&&d.phase==='calibration'&&d.generatorId===null&&d.repetition===1&&layouts.includes(d.layout)&&d.parentKey===null&&d.bodyKind==='static','CALIBRATION_SLOT');
  else{
   check(s.profile.caseIds.includes(d.caseId)&&MODELS_V3.includes(d.generatorId),'CASE_SLOT');
   const reference=d.role.startsWith('reference');check(reference?s.profile.stage==='reference-preparation'&&d.phase==='reference'&&d.repetition===1:s.profile.stage==='pilot-panel'&&['baseline','candidate'].includes(d.phase)&&d.repetition<=s.profile.generationRepeats,'STAGE_SLOT');
   const derived=['review','referenceReview'].includes(d.role);check(derived?d.modelId!==d.generatorId&&d.bodyKind==='derived'&&typeof d.parentKey==='string':d.modelId===d.generatorId&&d.bodyKind==='static'&&d.parentKey===null,'ROLE_SLOT');
   check(d.role==='review'?layouts.includes(d.layout):d.layout===null,'LAYOUT');
  }
 }
 check(digest(counts)===digest(expected),'ROLE_CAPS');
 check(Array.isArray(s.order)&&s.order.length===by.size&&new Set(s.order).size===by.size&&s.order.every(k=>by.has(k)),'ORDER');const positions=new Map(s.order.map((k,i)=>[k,i]));
 for(const d of s.requests)if(d.parentKey!==null){const p=by.get(d.parentKey);check(p&&p.role===(d.role==='review'?'generation':'referenceDraft')&&matches(p,{phase:d.phase,caseId:d.caseId,generatorId:d.generatorId,modelId:d.generatorId,repetition:d.repetition})&&positions.get(p.key)<positions.get(d.key),'PARENT');}
 for(const d of s.requests.filter(d=>['generation','referenceDraft'].includes(d.role))){
  const children=s.requests.filter(c=>c.parentKey===d.key),other=MODELS_V3.filter(m=>m!==d.generatorId);check(children.length===(d.role==='generation'?4:2),'REVIEW_COVERAGE');
  for(const model of other)for(const layout of(d.role==='generation'?layouts:[null]))check(children.some(c=>c.modelId===model&&c.layout===layout),'REVIEW_COVERAGE');
 }
 if(s.profile.stage==='reference-preparation')for(const caseId of s.profile.caseIds)check(s.requests.filter(d=>d.role==='referenceDraft'&&d.caseId===caseId).length===1,'DRAFT_COVERAGE');
 else{
  for(const caseId of s.profile.caseIds)for(const phase of ['baseline','candidate'])for(const model of MODELS_V3)for(let repetition=1;repetition<=s.profile.generationRepeats;repetition++)check(s.requests.some(d=>matches(d,{role:'generation',phase,caseId,generatorId:model,modelId:model,repetition})),'GENERATION_COVERAGE');
  for(const caseId of s.profile.witnessIds)for(const modelId of MODELS_V3)for(const layout of layouts)check(s.requests.some(d=>matches(d,{role:'calibration',caseId,modelId,layout})),'CALIBRATION_COVERAGE');
  const calibrationMax=Math.max(...s.requests.filter(d=>d.role==='calibration').map(d=>positions.get(d.key))),generationMin=Math.min(...s.requests.filter(d=>d.role==='generation').map(d=>positions.get(d.key)));check(calibrationMax<generationMin,'CALIBRATION_ORDER');
 }
 return counts;
}
export function v3RequestId(specHash,key){check(hash(specHash)&&typeof key==='string','REQUEST_ID');const h=digest({protocol:PROTOCOL_V3,specHash,key});return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
function approval(s,specHash,a){
 check(fields(a,['schemaVersion','protocol','stage','runId','specHash','kind','amountMicros','evidenceHash'])&&a.schemaVersion===3&&a.protocol===PROTOCOL_V3&&a.stage===s.profile.stage&&a.runId===s.runId&&a.specHash===specHash&&money(a.amountMicros),'APPROVAL_BINDING');
 check(a.kind==='unapproved'?a.amountMicros==='0'&&a.evidenceHash===null:a.kind===(s.mode==='synthetic'?'synthetic-test':'user-approval')&&hash(a.evidenceHash),'APPROVAL_KIND');
}
function price(s,d,u){
 check(fields(u,['inputTokens','outputTokens'])&&integer(u.inputTokens)&&integer(u.outputTokens),'USAGE');const q=s.quote,r=q.models[d.modelId];
 const n=(BigInt(u.inputTokens)*BigInt(r.inputMicrosPerMillion)*BigInt(q.inputFactorNumerator)+BigInt(u.outputTokens)*BigInt(r.outputMicrosPerMillion)*BigInt(q.inputFactorDenominator))*BigInt(q.regionalNumerator),den=1000000n*BigInt(q.inputFactorDenominator)*BigInt(q.regionalDenominator);return(n+den-1n)/den;
}
export function compileBudgetV3(input){
 const spec=structuredClone(input),caps=validateSpecV3(spec),specHash=digest(spec);freeze(spec);
 const by=new Map(spec.requests.map(d=>[d.key,d])),groups=new Map(),compiled=new Map(),known=new WeakMap(),calibration=spec.requests.filter(d=>d.role==='calibration').map(d=>d.key);let head=null;
 for(const d of spec.requests){const g=group(d);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(d.key);compiled.set(d.key,{descriptorHash:digest(d),requestId:v3RequestId(specHash,d.key),max:price(spec,d,{inputTokens:d.inputTokenMax,outputTokens:d.outputTokenMax})});}
 const publish=(l,b)=>{Object.freeze(l.slots);Object.freeze(l);known.set(l,b);head=l;return l;};
 function owned(l){check(known.has(l)&&l.specHash===specHash,'STATE_REPLAY_REQUIRED');return known.get(l);}
 function inspect(l){const b=owned(l),limit=BigInt(l.approval.amountMicros);return freeze({protocol:PROTOCOL_V3,stage:spec.profile.stage,limitMicros:limit.toString(),upperMicros:b.upper.toString(),remainingMicros:(limit>b.upper?limit-b.upper:0n).toString(),overBudget:b.upper>limit,slots:b.slots,consumedSlots:b.consumed,knownUsageSlots:b.known,counts:{...b.counts},closed:l.closed,hold:l.hold,realDispatchAuthorized:false,invoiceVerified:false,inputTokenBoundVerified:false,providerReceiptAuthenticated:false});}
 function fresh(a){check(head===null,'ALREADY_INITIALIZED');approval(spec,specHash,a);return publish({schemaVersion:3,protocol:PROTOCOL_V3,stage:spec.profile.stage,runId:spec.runId,specHash,approval:freeze(structuredClone(a)),closed:false,hold:null,sequence:0,slots:{}},{upper:0n,slots:0,consumed:0,known:0,counts:emptyCounts()});}
 function charge(d,row){
  const maximum=compiled.get(d.key).max;if(row.state==='unused')return 0n;const u=row.result?.usage,bounded=u&&u.inputTokens<=d.inputTokenMax&&u.outputTokens<=d.outputTokenMax;
  if(row.state==='completed'&&bounded)return price(spec,d,u);const observed=u?price(spec,d,u):0n;return observed>maximum?observed:maximum;
 }
 function transition(l,op){
  const balance=owned(l);check(l===head,'STALE_HEAD');check(object(op)&&typeof op.kind==='string','OPERATION');const b={...balance,counts:{...balance.counts}},next={...l,sequence:l.sequence+1,slots:{...l.slots}};
  const allowed=()=>check(!l.closed&&!l.hold&&balance.upper<=BigInt(l.approval.amountMicros)&&BigInt(l.approval.amountMicros)>0n,'DISPATCH_HELD');
  if(op.kind==='reserve'){
   check(fields(op,['kind','groupId']),'RESERVE');allowed();const keys=groups.get(op.groupId);check(keys,'GROUP');let extra=0n;for(const key of keys){check(!Object.hasOwn(l.slots,key),'DUPLICATE_RESERVATION');extra+=compiled.get(key).max;}
   check(balance.upper+extra<=BigInt(l.approval.amountMicros),'WHOLE_GROUP_BUDGET');
   for(const key of keys){const c=compiled.get(key),d=by.get(key);next.slots[key]=freeze({descriptorHash:c.descriptorHash,requestId:c.requestId,state:'reserved',binding:null,result:null,receiptHash:null});b.slots++;b.counts[d.role]++;}b.upper+=extra;
  }else if(op.kind==='bind'){
   check(fields(op,['kind','key','binding']),'BIND');allowed();const d=by.get(op.key),row=l.slots[op.key],v=op.binding;
   check(d&&row?.state==='reserved'&&fields(v,['bodySha256','recipeHash','parentKey','parentRequestId','parentReceiptHash','parentOutputHash'])&&hash(v.bodySha256),'BIND');
   if(d.bodyKind==='static')check(v.bodySha256===d.bodyHash&&v.recipeHash===null&&v.parentKey===null&&v.parentRequestId===null&&v.parentReceiptHash===null&&v.parentOutputHash===null,'STATIC_BODY');
   else{const p=l.slots[d.parentKey];check(p?.state==='completed'&&p.result&&v.recipeHash===d.bodyHash&&v.parentKey===d.parentKey&&v.parentRequestId===p.requestId&&v.parentReceiptHash===p.receiptHash&&v.parentOutputHash===p.result.outputHash,'DERIVED_PARENT');}
   check(!row.binding||digest(row.binding)===digest(v),'REBIND');next.slots[op.key]=freeze({...row,binding:structuredClone(v)});
  }else if(op.kind==='consume'){
   check(fields(op,['kind','key']),'CONSUME');allowed();const d=by.get(op.key),row=l.slots[op.key];check(d&&row?.state==='reserved'&&row.binding,'UNSENT_BOUND_SLOT');
   if(d.role==='generation')check(calibration.every(k=>l.slots[k]?.state==='completed'),'CALIBRATION_INCOMPLETE');
   if(d.parentKey!==null)check(l.slots[d.parentKey]?.state==='completed'&&row.binding.parentReceiptHash===l.slots[d.parentKey].receiptHash,'PARENT_CHANGED');next.slots[op.key]=freeze({...row,state:'consumed'});b.consumed++;
  }else if(op.kind==='settle'){
   check(fields(op,['kind','key','result']),'SETTLE');const d=by.get(op.key),row=l.slots[op.key],v=op.result;
   check(d&&row?.state==='consumed'&&fields(v,['specHash','requestId','modelId','bodySha256','state','usage','outputHash','captureHash'])&&v.specHash===specHash&&v.requestId===row.requestId&&v.modelId===d.modelId&&v.bodySha256===row.binding.bodySha256&&['completed','failed','unknown'].includes(v.state),'RESULT_BINDING');
   check(v.outputHash===null||hash(v.outputHash),'OUTPUT_HASH');check(v.captureHash===null||hash(v.captureHash),'CAPTURE_HASH');if(v.state==='completed')check(hash(v.outputHash)&&hash(v.captureHash),'COMPLETION_CAPTURE');
   if(v.usage!==null)price(spec,d,v.usage);const result=freeze(structuredClone(v)),bounded=v.usage&&v.usage.inputTokens<=d.inputTokenMax&&v.usage.outputTokens<=d.outputTokenMax;
   const after=freeze({...row,state:v.state,result,receiptHash:digest(result)});next.slots[op.key]=after;b.upper+=charge(d,after)-compiled.get(d.key).max;
   if(v.state==='completed'&&bounded)b.known++;if(v.usage&&!bounded)next.hold='USAGE_BOUND';
  }else if(op.kind==='approval'){
   check(fields(op,['kind','approval'])&&!l.closed,'APPROVAL_CLOSED');approval(spec,specHash,op.approval);next.approval=freeze(structuredClone(op.approval));if(BigInt(op.approval.amountMicros)<balance.upper&&!next.hold)next.hold='AUTHORIZATION_REDUCED';
  }else if(op.kind==='close'){
   check(fields(op,['kind'])&&!l.closed,'CLOSE');next.closed=true;for(const [key,row]of Object.entries(l.slots))if(row.state==='reserved'){next.slots[key]=freeze({...row,state:'unused',binding:row.binding});b.upper-=compiled.get(key).max;}
  }else throw Error('P3_OPERATION');
  return publish(next,b);
 }
 function audit(l){
  const expected=owned(l),b={upper:0n,slots:0,consumed:0,known:0,counts:emptyCounts()};approval(spec,specHash,l.approval);
  for(const [key,row]of Object.entries(l.slots)){
   const d=by.get(key),c=compiled.get(key);check(d&&Object.isFrozen(row)&&row.descriptorHash===c.descriptorHash&&row.requestId===c.requestId,'AUDIT_SLOT');
   check(['reserved','consumed','completed','failed','unknown','unused'].includes(row.state),'AUDIT_STATE');if(['completed','failed','unknown'].includes(row.state))check(row.result&&row.receiptHash===digest(row.result),'AUDIT_RECEIPT');else check(row.result===null&&row.receiptHash===null,'AUDIT_UNSETTLED');
   b.slots++;b.counts[d.role]++;if(!['reserved','unused'].includes(row.state))b.consumed++;const u=row.result?.usage;if(row.state==='completed'&&u&&u.inputTokens<=d.inputTokenMax&&u.outputTokens<=d.outputTokenMax)b.known++;b.upper+=charge(d,row);
  }
  check(b.upper===expected.upper&&b.slots===expected.slots&&b.consumed===expected.consumed&&b.known===expected.known&&digest(b.counts)===digest(expected.counts),'AUDIT_BALANCE');return inspect(l);
 }
 return Object.freeze({protocol:PROTOCOL_V3,spec,specHash,roleCaps:freeze(caps),groupIds:Object.freeze([...groups.keys()]),newLedger:fresh,transition,account:inspect,audit,current:()=>head,requestId:key=>{check(compiled.has(key),'REQUEST_KEY');return compiled.get(key).requestId;},maximumCost:key=>{check(compiled.has(key),'REQUEST_KEY');return compiled.get(key).max.toString();},cost:(key,u)=>{check(by.has(key),'REQUEST_KEY');return price(spec,by.get(key),u).toString();},liveDispatchSupported:false,wireEqualityVerified:false,tokenBoundProofVerified:false,approvalEvidenceAuthenticated:false,durableStoreImplemented:false,calibrationGradeGateImplemented:false});
}
