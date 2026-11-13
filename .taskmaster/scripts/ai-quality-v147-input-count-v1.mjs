// Exact-body count projection and synthetic receipt checks. No network/key IO.
// This component does not authorize count/generation calls or authenticate them.
import {createHash} from 'node:crypto';
import {parseV3Json,validateV3Request} from './ai-quality-v147-wire-v3.mjs';
import {digest,MODELS_V3} from './ai-quality-v147-budget-v3.mjs';
export const INPUT_COUNT_V1='ai-quality-v147-input-count-v1';
const fields=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const check=(ok,code)=>{if(!ok)throw Error('IC1_'+code);};
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),sha=x=>createHash('sha256').update(x).digest('hex');
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x),object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const frozen=x=>{if(x!==null&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};
const bindings=['bodySha256','recipeHash','parentKey','parentRequestId','parentReceiptHash','parentOutputHash'];
export function prepareInputCountV1({requestRaw,descriptor,wireBinding,sourceSeal,quoteHash}){
 const d=structuredClone(descriptor),body=validateV3Request(requestRaw,d);check(hash(sourceSeal)&&hash(quoteHash)&&hash(d.bodyHash)&&MODELS_V3.includes(d.modelId)&&fields(wireBinding,bindings),'BINDING');
 check(wireBinding.bodySha256===sha(requestRaw),'BODY_HASH');
 if(d.bodyKind==='static')check(d.bodyHash===wireBinding.bodySha256&&bindings.slice(1).every(k=>wireBinding[k]===null),'STATIC_BINDING');
 else{
  check(d.bodyKind==='derived'&&wireBinding.recipeHash===d.bodyHash&&wireBinding.parentKey===d.parentKey&&uuid(wireBinding.parentRequestId)&&hash(wireBinding.parentReceiptHash)&&hash(wireBinding.parentOutputHash),'PARENT_BINDING');
  const data=parseV3Json(body.input[0].content);
  check(d.role==='review'?object(data.EVALUATION_DATA?.feedback):d.role==='referenceReview'&&(data.REFERENCE_REVIEW_ITEMS?.items?.length===2&&data.REFERENCE_REVIEW_ITEMS.items.every(x=>object(x.draft))||object(data.REFERENCE_DATA?.draft)),'RESOLVED_PARENT');
 }
 // Only the current nine-field request profile is accepted by validateV3Request.
 // Never silently drop new create/count fields or use a null derived template.
 const projection=Object.fromEntries(['model','instructions','input','reasoning','text'].map(k=>[k,body[k]])),countRaw=JSON.stringify(projection);
 return frozen({protocol:INPUT_COUNT_V1,countRaw,binding:{fullBodySha256:sha(requestRaw),projectionSha256:sha(countRaw),descriptorHash:digest(d),wireBindingHash:digest(wireBinding),sourceSeal,quoteHash,modelId:d.modelId,outputTokenMax:d.outputTokenMax},actualInputTokensMeasured:false,counterFeesVerified:false,liveRequestAuthorized:false});
}
export function parseInputCountResponseV1({status,contentType,responseRaw}){
 check(status===200,'HTTP_STATUS');check(typeof contentType==='string'&&/^application\/json(?:\s*;|$)/i.test(contentType),'CONTENT_TYPE');const value=parseV3Json(responseRaw,16384);
 check(fields(value,['object','input_tokens'])&&value.object==='response.input_tokens'&&Number.isSafeInteger(value.input_tokens)&&value.input_tokens>0,'RESPONSE');return value.input_tokens;
}
export function recordSyntheticInputCountV1({prepared,status,contentType,responseRaw,counterRequestId}){
 check(prepared.protocol===INPUT_COUNT_V1&&sha(prepared.countRaw)===prepared.binding.projectionSha256&&typeof counterRequestId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(counterRequestId),'PREPARED');
 const inputTokens=parseInputCountResponseV1({status,contentType,responseRaw}),payload={schemaVersion:1,protocol:INPUT_COUNT_V1,mode:'synthetic',binding:structuredClone(prepared.binding),counterRequestId,responseSha256:sha(responseRaw),inputTokens,providerAuthenticated:false,actualInputTokensMeasured:false,counterFeesVerified:false,liveRequestAuthorized:false};return frozen({...payload,receiptHash:digest(payload)});
}
export function verifySyntheticInputCountV1({receipt,prepared,maximumInputTokens}){
 check(fields(receipt,['schemaVersion','protocol','mode','binding','counterRequestId','responseSha256','inputTokens','providerAuthenticated','actualInputTokensMeasured','counterFeesVerified','liveRequestAuthorized','receiptHash']),'RECEIPT_FIELDS');
 const {receiptHash,...payload}=receipt;check(receipt.schemaVersion===1&&receipt.protocol===INPUT_COUNT_V1&&receipt.mode==='synthetic'&&prepared.protocol===INPUT_COUNT_V1&&uuid(receipt.counterRequestId)&&hash(receipt.responseSha256)&&hash(receiptHash)&&digest(payload)===receiptHash&&digest(receipt.binding)===digest(prepared.binding)&&sha(prepared.countRaw)===prepared.binding.projectionSha256,'RECEIPT_BINDING');
 check(Number.isSafeInteger(maximumInputTokens)&&maximumInputTokens>0&&Number.isSafeInteger(receipt.inputTokens)&&receipt.inputTokens>0&&receipt.inputTokens<=maximumInputTokens,'INPUT_BOUND');
 check(receipt.providerAuthenticated===false&&receipt.actualInputTokensMeasured===false&&receipt.counterFeesVerified===false&&receipt.liveRequestAuthorized===false,'CLAIMS');
 return {syntheticCountWithinConfiguredBound:true,inputTokens:receipt.inputTokens,actualInputTokenBoundVerified:false,paymentQuoteReady:false,liveRequestAuthorized:false};
}
