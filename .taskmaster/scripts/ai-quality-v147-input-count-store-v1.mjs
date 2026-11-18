// Synthetic preflight intent/response/receipt store. No credentials, provider
// endpoint, implicit resend, replacement or real fee/price authorization.
import {mkdirSync,openSync,readFileSync,writeFileSync,fsyncSync,closeSync,lstatSync,fstatSync,realpathSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {parseV3Json} from './ai-quality-v147-wire-v3.mjs';
import {prepareInputCountV1,recordSyntheticInputCountV1,verifySyntheticInputCountV1} from './ai-quality-v147-input-count-v1.mjs';
export const INPUT_COUNT_STORE_V1='ai-quality-v147-input-count-store-v1';
const check=(ok,code)=>{if(!ok)throw Error('ICJ1_'+code);};
const fields=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
function regular(file){const s=lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'NONREGULAR');return s;}
function read(file){const before=regular(file);check(before.size<=1048576,'FILE_SIZE');const fd=openSync(file,'r');try{const a=fstatSync(fd),b=readFileSync(fd),z=fstatSync(fd),last=regular(file);check(a.ino===before.ino&&a.dev===before.dev&&a.nlink===1&&z.size===a.size&&z.mtimeMs===a.mtimeMs&&b.length===a.size&&last.ino===a.ino&&last.dev===a.dev,'READ_CHANGED');return parseV3Json(new TextDecoder('utf-8',{fatal:true}).decode(b),1048576);}finally{closeSync(fd);}}
function scope(context){
 check(isAbsolute(context.allowedRoot)&&isAbsolute(context.directory)&&!context.allowedRoot.split(/[\\/]/).some(p=>/^(?:\.env(?:[._-].*)?|\.sites-runtime|\.wrangler|\.git)$/i.test(p)),'SCOPE');
 const root=realpathSync(context.allowedRoot),k=compileBudgetV3(context.spec);check(root===resolve(context.allowedRoot)&&!lstatSync(root).isSymbolicLink()&&k.spec.mode==='synthetic'&&resolve(context.directory)===resolve(root,'v3-'+k.spec.runId),'SYNTHETIC_SCOPE');
 const directory=resolve(root,'v3-'+k.spec.runId+'-input-counts'),ids=new Set(k.spec.requests.map(d=>k.requestId(d.key)));
 function folder(create=false){check(realpathSync(root)===root&&!lstatSync(root).isSymbolicLink(),'ROOT_CHANGED');if(!existsSync(directory)){if(!create)return false;mkdirSync(directory);}check(!lstatSync(directory).isSymbolicLink()&&realpathSync(directory)===directory&&dirname(directory)===root,'DIRECTORY_LINK');for(const n of readdirSync(directory)){const m=/^([a-f0-9-]{36})\.(intent|response|receipt)\.json$/.exec(n);check(m&&ids.has(m[1]),'FOREIGN_FILE');}return true;}
 const file=(d,kind)=>resolve(directory,k.requestId(d.key)+'.'+kind+'.json');
 function descriptor(d){const actual=k.spec.requests.find(x=>x.key===d.key);check(actual&&digest(actual)===digest(d),'DESCRIPTOR');}
 function intent(d,value){
  check(fields(value,['schemaVersion','protocol','mode','runId','specHash','key','counterRequestId','generationWire','prepared'])&&value.schemaVersion===1&&value.protocol===INPUT_COUNT_STORE_V1&&value.mode==='synthetic'&&value.runId===k.spec.runId&&value.specHash===k.specHash&&value.key===d.key&&uuid(value.counterRequestId)&&fields(value.generationWire,['raw','binding']),'INTENT');
  const p=prepareInputCountV1({requestRaw:value.generationWire.raw,descriptor:d,wireBinding:value.generationWire.binding,sourceSeal:k.spec.sourceSeal,quoteHash:digest(k.spec.quote)});check(digest(value.prepared)===digest(p),'INTENT_BINDING');return value;
 }
 function response(value){check(fields(value,['status','contentType','responseRaw'])&&Number.isSafeInteger(value.status)&&typeof value.contentType==='string'&&value.contentType.length<=200&&typeof value.responseRaw==='string'&&Buffer.byteLength(value.responseRaw)<=16384,'RESPONSE_FIELDS');return value;}
 function verified(d,p){descriptor(d);folder();const i=intent(d,read(file(d,'intent')));check(digest(p)===digest(i.prepared),'PREPARED_CHANGED');const r=response(read(file(d,'response'))),receipt=read(file(d,'receipt')),expected=recordSyntheticInputCountV1({prepared:p,...r,counterRequestId:i.counterRequestId});check(digest(receipt)===digest(expected),'RECEIPT_CHANGED');verifySyntheticInputCountV1({receipt,prepared:p,maximumInputTokens:d.inputTokenMax});return receipt;}
 return {k,directory,folder,file,intent,response,verified,descriptor};
}
export function inspectSyntheticInputCountsV1(context){
 const s=scope(context),rows=[];if(s.folder())for(const d of s.k.spec.requests){const names=['intent','response','receipt'].filter(n=>existsSync(s.file(d,n)));if(!names.length)continue;check(names.includes('intent'),'ORPHAN_RECORD');const i=s.intent(d,read(s.file(d,'intent')));if(names.includes('response'))s.response(read(s.file(d,'response')));check(!names.includes('receipt')||names.includes('response'),'ORPHAN_RECEIPT');if(names.includes('receipt'))s.verified(d,i.prepared);rows.push({key:d.key,counterRequestId:i.counterRequestId,state:names.includes('receipt')?'receipt-recorded':names.includes('response')?'response-captured-unsettled':'intent-only-held',files:names});}
 check(new Set(rows.map(r=>r.counterRequestId)).size===rows.length,'DUPLICATE_COUNTER_ID');return {required:true,protocol:INPUT_COUNT_STORE_V1,records:rows.length,receipts:rows.filter(r=>r.state==='receipt-recorded').length,rows,actualCountApiCalls:0,actualInputTokensMeasured:false,counterFeesVerified:false,counterBudgetQualified:false,liveDispatchSupported:false};
}
export function openSyntheticInputCountStoreV1({context,session,observeCurrent}){
 const s=scope(context),observedReceipts=new Map();check(typeof session?.current==='function'&&typeof observeCurrent==='function','SESSION');
 function owned(){observeCurrent();const v=session.current();check(v.ledger.specHash===s.k.specHash,'SESSION_CHANGED');s.folder();return v;}
 function durable(file,value,testFault,stage){owned();s.folder(true);const raw=JSON.stringify(value)+'\n';check(Buffer.byteLength(raw)<=1048576,'WRITE_SIZE');const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,raw);testFault?.(stage+':before-fsync');fsyncSync(fd);}finally{closeSync(fd);}testFault?.(stage+':after-fsync');owned();check(digest(read(file))===digest(value),'WRITE_READBACK');}
 return Object.freeze({
  async ensure({descriptor:d,generationWire,transport,testFault=null}){
   s.descriptor(d);const v=owned();check(v.ledger.slots[d.key]?.state==='reserved'&&!v.ledger.closed&&!v.ledger.hold&&typeof transport==='function','UNSENT_SLOT');
   const p=prepareInputCountV1({requestRaw:generationWire.raw,descriptor:d,wireBinding:generationWire.binding,sourceSeal:s.k.spec.sourceSeal,quoteHash:digest(s.k.spec.quote)});let i;
   if(s.folder()&&existsSync(s.file(d,'intent'))){i=s.intent(d,read(s.file(d,'intent')));check(digest(i.prepared)===digest(p),'PREPARED_CHANGED');check(existsSync(s.file(d,'response')),'MISSING_RESPONSE_HELD');}
   else{
    check(!existsSync(s.file(d,'response'))&&!existsSync(s.file(d,'receipt')),'ORPHAN_RECORD');i={schemaVersion:1,protocol:INPUT_COUNT_STORE_V1,mode:'synthetic',runId:s.k.spec.runId,specHash:s.k.specHash,key:d.key,counterRequestId:randomUUID(),generationWire:{raw:generationWire.raw,binding:structuredClone(generationWire.binding)},prepared:p};durable(s.file(d,'intent'),i,testFault,'count-intent');testFault?.('after-intent');owned();
    // A durable intent is never sent a second time. Unknown response => held.
    const result=await transport({key:d.key,counterRequestId:i.counterRequestId,requestRaw:p.countRaw,modelId:d.modelId});testFault?.('after-counter-transport');owned();s.response(result);durable(s.file(d,'response'),result,testFault,'count-response');
   }
   if(!existsSync(s.file(d,'receipt'))){const r=s.response(read(s.file(d,'response'))),receipt=recordSyntheticInputCountV1({prepared:p,...r,counterRequestId:i.counterRequestId});verifySyntheticInputCountV1({receipt,prepared:p,maximumInputTokens:d.inputTokenMax});durable(s.file(d,'receipt'),receipt,testFault,'count-receipt');}
   const receipt=s.verified(d,p);observedReceipts.set(d.key,digest(receipt));return receipt;
  },
  verify({descriptor:d,generationWire}){owned();const p=prepareInputCountV1({requestRaw:generationWire.raw,descriptor:d,wireBinding:generationWire.binding,sourceSeal:s.k.spec.sourceSeal,quoteHash:digest(s.k.spec.quote)}),receipt=s.verified(d,p);check(observedReceipts.get(d.key)===digest(receipt),'RECEIPT_CHANGED_SINCE_PREFLIGHT');return receipt;},
  inspect(){owned();return inspectSyntheticInputCountsV1(context);},
  directory:s.directory,actualCountApiCalls:0,liveDispatchSupported:false
 });
}
