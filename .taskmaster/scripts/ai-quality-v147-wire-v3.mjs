// Synthetic v3 exact-byte wire and frozen derivation recipes. No transport/key IO.
import {createHash} from 'node:crypto';
import {compileBudgetV3,digest,PROTOCOL_V3,PLAN_V3} from './ai-quality-v147-budget-v3.mjs';
import {materializeReferenceReviewV4} from './ai-quality-v147-reference-v4.mjs';
export const FREEZE_V3='ai-quality-v147-wire-freeze-v3';
export const V3_COMPONENTS=Object.freeze(['sourceBaseline','sourceCandidate','buildBaseline','buildCandidate','runtime','rubric','corpus','requestBuilder','modelOptions','quote','limits','collectionPolicy','riskDecision','aiPanelPolicy','referenceProtocol','projection']);
const flags=['grammar_enabled','grammar_practice_v2_enabled','grammar_practice_v3_enabled','grammar_practice_v4_enabled','large_backup_restore_enabled','ai_feedback_enabled','feedback_judgment_enabled'];
const check=(ok,code)=>{if(!ok)throw Error('W3_'+code);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),fields=(x,n)=>obj(x)&&Object.keys(x).sort().join('|')===[...n].sort().join('|');
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const freeze=x=>{if(obj(x)||Array.isArray(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export function parseV3Json(raw,maximum=262144){
 check(typeof raw==='string'&&Buffer.byteLength(raw)<=maximum&&Buffer.from(raw).toString('utf8')===raw,'JSON_BYTES');let value;try{value=JSON.parse(raw);}catch{throw Error('W3_JSON');}
 const stack=[];for(let i=0;i<raw.length;){if(raw[i]==='"'){const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"')break;}let next=i;while(next<raw.length&&/\s/.test(raw[next]))next++;if(raw[next]===':'){const key=JSON.parse(raw.slice(start,i)),set=stack.at(-1);check(set&&!set.has(key),'JSON_DUPLICATE_KEY');set.add(key);}}else{if(raw[i]==='{')stack.push(new Set());else if(raw[i]==='}')stack.pop();i++;}}
 return value;
}
function environment(e){
 check(fields(e,['nodeVersion','platform','arch','timezone','compatibilityDate','compatibilityFlags','featureFlags','providerEndpoint','outboundMode']),'ENVIRONMENT');
 check(/^v(?:22|24)\.\d+\.\d+$/.test(e.nodeVersion)&&['win32','linux','darwin'].includes(e.platform)&&['x64','arm64'].includes(e.arch)&&e.timezone==='Asia/Seoul'&&/^20\d\d-\d\d-\d\d$/.test(e.compatibilityDate),'RUNTIME');
 check(Array.isArray(e.compatibilityFlags)&&e.compatibilityFlags.every(x=>typeof x==='string'&&/^[a-z0-9_]{1,80}$/.test(x))&&new Set(e.compatibilityFlags).size===e.compatibilityFlags.length&&fields(e.featureFlags,flags)&&flags.every(k=>['true','false'].includes(e.featureFlags[k])),'FEATURE_FLAGS');
 check(e.providerEndpoint==='https://api.openai.com/v1/responses'&&e.outboundMode==='synthetic-intercept','SYNTHETIC_ENDPOINT');
}
function observation(current){
 check(fields(current,['schemaVersion','protocol','planId','runId','mode','components','environment','order'])&&current.schemaVersion===3&&current.protocol===FREEZE_V3&&current.planId===PLAN_V3&&current.mode==='synthetic'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(current.runId),'FREEZE_IDENTITY');
 check(fields(current.components,V3_COMPONENTS)&&V3_COMPONENTS.every(k=>hash(current.components[k])),'COMPONENTS');environment(current.environment);check(current.components.runtime===digest(current.environment)&&Array.isArray(current.order)&&current.order.length>0&&new Set(current.order).size===current.order.length&&current.order.every(k=>typeof k==='string'&&/^[A-Za-z0-9_.:/-]{1,300}$/.test(k)),'FREEZE_ORDER');
}
export function sealV3Wire(current){observation(current);const payload=structuredClone(current);return freeze({schemaVersion:3,protocol:FREEZE_V3,hash:digest(payload),payload});}
export function verifyV3WireFreeze({seal,current,spec}){
 check(fields(seal,['schemaVersion','protocol','hash','payload'])&&seal.schemaVersion===3&&seal.protocol===FREEZE_V3&&hash(seal.hash),'SEAL');observation(seal.payload);observation(current);check(digest(seal.payload)===seal.hash&&digest(current)===seal.hash,'FREEZE_CHANGED');const k=compileBudgetV3(spec);check(k.spec.mode==='synthetic','SYNTHETIC_ONLY');const {sourceSeal,...outline}=k.spec;
 check(sourceSeal===seal.hash&&spec.protocol===PROTOCOL_V3&&spec.runId===current.runId&&digest(outline)===current.components.limits&&digest(spec.quote)===current.components.quote&&digest(spec.order)===digest(current.order),'SPEC_FREEZE');return k;
}
export function validateV3Request(raw,d){
 const b=parseV3Json(raw,d.maximumBytes);check(fields(b,['model','instructions','input','text','reasoning','max_output_tokens','store','stream','service_tier'])&&b.model===d.modelId&&b.max_output_tokens===d.outputTokenMax&&b.store===false&&b.stream===false&&b.service_tier==='default'&&fields(b.reasoning,['effort'])&&['low','medium','high'].includes(b.reasoning.effort)&&typeof b.instructions==='string'&&b.instructions.length>0&&Array.isArray(b.input)&&b.input.length===1&&fields(b.input[0],['role','content'])&&b.input[0].role==='user'&&typeof b.input[0].content==='string'&&fields(b.text,['format'])&&fields(b.text.format,['type','name','strict','schema'])&&b.text.format.type==='json_schema'&&b.text.format.strict===true&&typeof b.text.format.name==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(b.text.format.name)&&obj(b.text.format.schema),'REQUEST_FIELDS');parseV3Json(b.input[0].content);return b;
}
// Supported frozen-schema subset used by current product and panel contracts.
// Unsupported schema keywords are held,never silently ignored.
export function validateV3Output(requestRaw,payloadRaw){
 const body=parseV3Json(requestRaw),value=parseV3Json(payloadRaw);function visit(schema,v,depth){
  check(depth<=32&&obj(schema)&&Object.keys(schema).every(k=>['type','properties','required','additionalProperties','enum','items','minItems','maxItems','minLength','maxLength','pattern','description'].includes(k)),'OUTPUT_SCHEMA');
  const type=Array.isArray(schema.type)?schema.type:[schema.type];check(type.every(t=>['object','array','string','boolean','number','integer','null'].includes(t)),'OUTPUT_SCHEMA');
  check(type.some(t=>t==='object'?obj(v):t==='array'?Array.isArray(v):t==='null'?v===null:t==='integer'?Number.isSafeInteger(v):t==='number'?typeof v==='number'&&Number.isFinite(v):typeof v===t),'OUTPUT_TYPE');
  if(schema.enum)check(Array.isArray(schema.enum)&&schema.enum.some(x=>digest(x)===digest(v)),'OUTPUT_ENUM');
  if(obj(v)){
   check(obj(schema.properties)&&Array.isArray(schema.required)&&schema.additionalProperties===false&&schema.required.every(k=>typeof k==='string'&&Object.hasOwn(schema.properties,k)&&Object.hasOwn(v,k))&&Object.keys(v).every(k=>Object.hasOwn(schema.properties,k)),'OUTPUT_FIELDS');for(const [k,x]of Object.entries(v))visit(schema.properties[k],x,depth+1);
  }else if(Array.isArray(v)){check(obj(schema.items)&&(!Object.hasOwn(schema,'minItems')||Number.isSafeInteger(schema.minItems)&&v.length>=schema.minItems)&&(!Object.hasOwn(schema,'maxItems')||Number.isSafeInteger(schema.maxItems)&&v.length<=schema.maxItems),'OUTPUT_ARRAY');for(const x of v)visit(schema.items,x,depth+1);}
  else if(typeof v==='string'){
   check((!Object.hasOwn(schema,'minLength')||Number.isSafeInteger(schema.minLength)&&v.length>=schema.minLength)&&(!Object.hasOwn(schema,'maxLength')||Number.isSafeInteger(schema.maxLength)&&v.length<=schema.maxLength),'OUTPUT_STRING');
   if(schema.pattern!==undefined){check(typeof schema.pattern==='string'&&/^\^\[\\s\\S\]\{\d+,\d+\}\$$/.test(schema.pattern),'OUTPUT_PATTERN');check(new RegExp(schema.pattern,'u').test(v),'OUTPUT_PATTERN_VALUE');}
  }
 }visit(body.text?.format?.schema,value,0);return value;
}
function prepareCompiledV3({k,seal,current,ledger,key,wire,parentCapture=null}){
 const spec=k.spec,d=spec.requests.find(x=>x.key===key),row=ledger?.slots?.[key];check(d&&row&&ledger.specHash===k.specHash&&Object.isFrozen(ledger)&&Object.isFrozen(row)&&row.descriptorHash===digest(d)&&row.requestId===k.requestId(key)&&row.state==='reserved'&&!ledger.closed&&!ledger.hold,'UNSENT_SLOT');
 check(current.environment.nodeVersion===process.version&&current.environment.platform===process.platform&&current.environment.arch===process.arch,'ACTUAL_RUNTIME');let raw,binding;
 if(d.bodyKind==='static'){
  check(fields(wire,['raw'])&&parentCapture===null,'STATIC_INPUT');raw=wire.raw;validateV3Request(raw,d);check(sha(raw)===d.bodyHash,'STATIC_BYTES');binding={bodySha256:sha(raw),recipeHash:null,parentKey:null,parentRequestId:null,parentReceiptHash:null,parentOutputHash:null};
 }else{
  check(fields(wire,['templateRaw'])&&typeof wire.templateRaw==='string'&&sha(wire.templateRaw)===d.bodyHash,'RECIPE_BYTES');const p=ledger.slots[d.parentKey],c=parentCapture;check(p?.state==='completed'&&c?.committed===true&&c.sourceSeal===spec.sourceSeal&&c.specHash===k.specHash&&c.runId===spec.runId&&digest(c.result)===digest(p.result)&&c.receiptHash===p.receiptHash&&sha(c.payloadRaw)===p.result.outputHash,'PHYSICAL_PARENT');
  const template=validateV3Request(wire.templateRaw,d),content=parseV3Json(template.input[0].content),payload=parseV3Json(c.payloadRaw);
  if(d.role==='review'){
   check(fields(content,['EVALUATION_DATA'])&&fields(content.EVALUATION_DATA,['input','feedback','reference'])&&content.EVALUATION_DATA.feedback===null&&obj(content.EVALUATION_DATA.input)&&payload.original===content.EVALUATION_DATA.input.sentence,'REVIEW_RECIPE');const order=d.layout==='input-first'?['input','feedback','reference']:['feedback','reference','input'];check(digest(Object.keys(content.EVALUATION_DATA))===digest(order),'REVIEW_LAYOUT');content.EVALUATION_DATA.feedback=payload;
  }else{check(d.role==='referenceReview'&&fields(content,['REFERENCE_DATA'])&&fields(content.REFERENCE_DATA,['context','draft'])&&content.REFERENCE_DATA.draft===null,'REFERENCE_RECIPE');if(template.text.format.name==='reference_review_v4'){const projected=materializeReferenceReviewV4(content,payload);for(const key of Object.keys(content))delete content[key];Object.assign(content,projected);}else content.REFERENCE_DATA.draft=payload;}
  template.input[0].content=JSON.stringify(content);raw=JSON.stringify(template);validateV3Request(raw,d);binding={bodySha256:sha(raw),recipeHash:d.bodyHash,parentKey:d.parentKey,parentRequestId:p.requestId,parentReceiptHash:p.receiptHash,parentOutputHash:p.result.outputHash};
 }
 check(!row.binding||digest(row.binding)===digest(binding),'REBIND');return {raw,binding,bindOperation:row.binding?null:{kind:'bind',key,binding},bodyBytes:Buffer.byteLength(raw),sourceSeal:seal.hash,wireEqualityVerified:true,inputTokenBoundVerified:false,providerReceiptAuthenticated:false,realDispatchAuthorized:false};
}
// Reuse only a deep-frozen spec/seal,never mutable IO/mtime observations. Current
// environment/components/order and each actual body remain checked on every use.
export function compileV3Wire({seal:inputSeal,spec}){
 const seal=freeze(structuredClone(inputSeal)),k=verifyV3WireFreeze({seal,current:seal.payload,spec});
 const verify=current=>{observation(current);check(digest(current)===seal.hash,'FREEZE_CHANGED');return {sourceSeal:seal.hash,realDispatchAuthorized:false};};
 return Object.freeze({spec:k.spec,specHash:k.specHash,requestId:key=>k.requestId(key),verify,prepare:args=>{verify(args.current);return prepareCompiledV3({...args,k,seal});}});
}
export function prepareV3Wire(args){return compileV3Wire(args).prepare(args);}
