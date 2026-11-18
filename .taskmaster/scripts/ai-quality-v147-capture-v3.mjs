// Synthetic-only physical capture. Exact request/provider bytes and projected
// learner-visible bytes are distinct. Receipt hashes do not authenticate OpenAI.
import {mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,readFileSync,lstatSync,fstatSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {compileV3Wire,validateV3Request,validateV3Output,parseV3Json} from './ai-quality-v147-wire-v3.mjs';
import {parsePanelPayload} from './ai-quality-v147-ai-panel.mjs';
import {PRODUCT_RUBRIC_FORMAT_V1,productRubricComponentV1,assertProductRubricCaptureV1,parseProductRubricPayloadV1} from './ai-quality-v147-product-rubric-v1.mjs';
import {ASSESSMENT_CONTEXT_FORMAT_V1,assessmentContextComponentV1,assertAssessmentContextCaptureV1,parseAssessmentContextPayloadV1} from './ai-quality-v147-assessment-context-v1.mjs';
import {ownProcessIdentity} from './ai-quality-v147-process.mjs';
import {validateReferenceCaptureV4} from './ai-quality-v147-reference-v4.mjs';
import {assertOperationalReferenceCaptureV1} from './ai-quality-v147-operational-reference-v1.mjs';
import {validateOperationalReferenceReviewV1} from './ai-quality-v147-reference-rubric-v1.mjs';
import {EXPLANATION_FORMAT_V1,parseExplanationScopePayloadV1} from './ai-quality-v147-explanation-scope-v1.mjs';
import {explanationMainComponentV1,assertExplanationMainCaptureV1} from './ai-quality-v147-explanation-main-v1.mjs';
export const CAPTURE_V3='ai-quality-v147-physical-capture-v3';
const check=(ok,code)=>{if(!ok)throw Error('C3_'+code);};
const sha=x=>createHash('sha256').update(x).digest('hex'),bytes=x=>Buffer.from(JSON.stringify(x)+'\n','utf8');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),fields=(x,n)=>obj(x)&&Object.keys(x).sort().join('|')===[...n].sort().join('|');
function regular(f){const s=lstatSync(f);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'NONREGULAR');return s;}
function raw(f,max=1048576){const before=regular(f);check(before.size<=max,'FILE_SIZE');const fd=openSync(f,'r');try{const a=fstatSync(fd);check(a.ino===before.ino&&a.dev===before.dev&&a.nlink===1,'FILE_REPLACED');const b=readFileSync(fd),z=fstatSync(fd),last=regular(f);check(b.length===a.size&&z.size===a.size&&z.mtimeMs===a.mtimeMs&&last.ino===a.ino&&last.dev===a.dev,'READ_CHANGED');return b;}finally{closeSync(fd);}}
function utf8(b){try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{throw Error('C3_UTF8');}}
function durable(f,b,fault,stage){const fd=openSync(f,'wx',0o600);try{writeFileSync(fd,b);fault?.(stage+':before-fsync');fsyncSync(fd);}finally{closeSync(fd);}fault?.(stage+':after-fsync');check(raw(f).equals(b),'WRITE_READBACK');}
const maxResponse=262144;
export function openV3CaptureStore({context:input,seal:inputSeal,observeCurrent,projectGeneration=null}){
 check(input&&isAbsolute(input.allowedRoot)&&isAbsolute(input.directory)&&typeof observeCurrent==='function','SCOPE');const seal=structuredClone(inputSeal),initial=structuredClone(observeCurrent()),k=compileV3Wire({seal,spec:input.spec}),spec=k.spec;k.verify(initial);check(spec.mode==='synthetic','SYNTHETIC_ONLY');
 check(!input.allowedRoot.split(/[\\/]/).some(p=>/^(?:\.env(?:[._-].*)?|\.sites-runtime|\.wrangler|\.git)$/i.test(p)),'PROTECTED_ROOT');const root=realpathSync(input.allowedRoot),path=resolve(input.directory);check(root===resolve(input.allowedRoot)&&!lstatSync(root).isSymbolicLink()&&path===resolve(root,'v3-'+spec.runId)&&dirname(path)===root&&!lstatSync(path).isSymbolicLink()&&realpathSync(path)===path,'RUN_SCOPE');const captureRoot=resolve(root,'v3-'+spec.runId+'-captures');
 function current(){const c=structuredClone(observeCurrent());k.verify(c);check(c.environment.nodeVersion===process.version&&c.environment.platform===process.platform&&c.environment.arch===process.arch,'ACTUAL_RUNTIME');check(realpathSync(root)===root&&!lstatSync(root).isSymbolicLink()&&realpathSync(path)===path&&!lstatSync(path).isSymbolicLink(),'SCOPE_CHANGED');return c;}
 function folder(creating=false){current();if(creating){try{mkdirSync(captureRoot);}catch(e){if(e.code!=='EEXIST')throw e;}}check(!lstatSync(captureRoot).isSymbolicLink()&&realpathSync(captureRoot)===captureRoot,'CAPTURE_LINK');return captureRoot;}
 function owned(){current();const file=resolve(path,'LOCK.json'),stat=regular(file),b=raw(file,4096),o=parseV3Json(utf8(b),4096);check(fields(o,['schemaVersion','protocol','runId','stage','specHash','directoryHash','nonce','pid','identity'])&&o.schemaVersion===3&&o.protocol==='ai-quality-v147-journal-v3'&&o.runId===spec.runId&&o.stage===spec.profile.stage&&o.specHash===k.specHash&&o.directoryHash===digest(path)&&o.pid===process.pid&&digest(o.identity)===digest(ownProcessIdentity()),'NOT_OWNED');return ()=>{current();const next=regular(file);check(next.ino===stat.ino&&next.dev===stat.dev&&raw(file,4096).equals(b),'OWNER_CHANGED');};}
 function target(ledger,key){const d=spec.requests.find(x=>x.key===key),row=ledger?.slots?.[key];check(d&&row&&Object.isFrozen(ledger)&&Object.isFrozen(row)&&ledger.specHash===k.specHash&&row.descriptorHash===digest(d)&&row.requestId===k.requestId(key)&&row.binding&&['consumed','completed','failed','unknown'].includes(row.state),'SLOT');return {d,row};}
 function projection(d,wireRaw,responseRaw,status,contentType){
  const request=validateV3Request(wireRaw,d);check(Number.isSafeInteger(status)&&status>=100&&status<=599&&typeof contentType==='string'&&contentType.length<=200,'HTTP_METADATA');check(typeof responseRaw==='string'&&Buffer.byteLength(responseRaw)<=maxResponse&&Buffer.from(responseRaw).toString('utf8')===responseRaw,'RESPONSE_BYTES');
  if(d.role==='generation'&&request.text.format.name!=='synthetic_feedback')check(typeof projectGeneration==='function','PROJECTOR_REQUIRED');let usage=null,body;
  try{body=parseV3Json(responseRaw,maxResponse);const u=body?.usage;if(obj(u)&&['input_tokens','output_tokens'].every(t=>Number.isSafeInteger(u[t])&&u[t]>=0&&u[t]<=100000000))usage={inputTokens:u.input_tokens,outputTokens:u.output_tokens};}catch{return {state:status>=200&&status<300?'unknown':'failed',usage,payloadRaw:'',reason:'response-json'};}
  if(status<200||status>=300)return {state:'failed',usage,payloadRaw:'',reason:'http'};
  if(!/^application\/json(?:\s*;|$)/i.test(contentType))return {state:'unknown',usage,payloadRaw:'',reason:'content-type'};
  if(!obj(body)||body.model!==d.modelId||body.status!=='completed'||!Array.isArray(body.output))return {state:body?.status==='failed'?'failed':'unknown',usage,payloadRaw:'',reason:'envelope'};
  const messages=body.output.filter(x=>x?.type==='message');if(body.output.some(x=>!['reasoning','message'].includes(x?.type))||messages.length!==1||messages[0].role!=='assistant'||messages[0].status!=='completed'||!Array.isArray(messages[0].content)||messages[0].content.length===0||messages[0].content.some(x=>x?.type!=='output_text'||typeof x.text!=='string'))return {state:'unknown',usage,payloadRaw:'',reason:'output-envelope'};
  const text=messages[0].content.map(x=>x.text).join('');try{
   const value=validateV3Output(wireRaw,text);let payloadRaw=text;
   if(d.role==='generation'){
    payloadRaw=projectGeneration?projectGeneration({requestRaw:wireRaw,responseRaw,payloadRaw:text,modelId:d.modelId,key:d.key,phase:d.phase,caseId:d.caseId,role:d.role}):JSON.stringify(value);const visible=parseV3Json(payloadRaw),input=parseV3Json(request.input[0].content);check(fields(visible,['original','meaningUsage','grammar','correctedSentence','explanation'])&&visible.original===input.sentence&&typeof visible.original==='string'&&visible.original.length<=2000&&typeof visible.correctedSentence==='string'&&visible.correctedSentence.length<=2000&&typeof visible.explanation==='string'&&visible.explanation.length<=6000&&['appropriate','needs_work','uncertain'].includes(visible.meaningUsage)&&['natural','needs_work','uncertain'].includes(visible.grammar),'VISIBLE_OUTPUT');
   }else if(request.text.format.name==='reference_review_operational_v1'&&d.role==='referenceReview'){assertOperationalReferenceCaptureV1({spec,seal});validateOperationalReferenceReviewV1({requestRaw:wireRaw,payloadRaw:text});}
   else if(['reference_draft_v4','reference_review_v4'].includes(request.text.format.name)&&['referenceDraft','referenceReview'].includes(d.role))validateReferenceCaptureV4(request,value);
   else if(['review','calibration'].includes(d.role)&&(request.text.format.name===EXPLANATION_FORMAT_V1||seal.payload.components.aiPanelPolicy===explanationMainComponentV1())){assertExplanationMainCaptureV1({spec,seal});parseExplanationScopePayloadV1({requestRaw:wireRaw,payloadRaw});}
   else if(['review','calibration'].includes(d.role)&&(request.text.format.name===ASSESSMENT_CONTEXT_FORMAT_V1||seal.payload.components.aiPanelPolicy===assessmentContextComponentV1())){assertAssessmentContextCaptureV1({spec,seal});parseAssessmentContextPayloadV1({requestRaw:wireRaw,payloadRaw});}
   else if(['review','calibration'].includes(d.role)&&(request.text.format.name===PRODUCT_RUBRIC_FORMAT_V1||seal.payload.components.aiPanelPolicy===productRubricComponentV1())){assertProductRubricCaptureV1({spec,seal});parseProductRubricPayloadV1({requestRaw:wireRaw,payloadRaw});}
   else if(['review','calibration','referenceReview'].includes(d.role))parsePanelPayload(payloadRaw);
   if(usage===null)return {state:'unknown',usage,payloadRaw:'',reason:'usage-missing'};
   return {state:'completed',usage,payloadRaw,reason:'completed'};
  }catch{return {state:'unknown',usage,payloadRaw:'',reason:'output-contract'};}
 }
 function build({ledger,key,requestRaw,responseRaw,status,contentType}){
  current();const {d,row}=target(ledger,key);check(sha(requestRaw)===row.binding.bodySha256,'REQUEST_BINDING');const projected=projection(d,requestRaw,responseRaw,status,contentType),payloadRaw=projected.payloadRaw;
  const core={requestSha256:sha(requestRaw),responseSha256:sha(responseRaw),payloadSha256:sha(payloadRaw),requestBytes:Buffer.byteLength(requestRaw),responseBytes:Buffer.byteLength(responseRaw),payloadBytes:Buffer.byteLength(payloadRaw),status,contentType,projectionHash:seal.payload.components.projection,reason:projected.reason};
  const result={specHash:k.specHash,requestId:row.requestId,modelId:d.modelId,bodySha256:row.binding.bodySha256,state:projected.state,usage:projected.usage,outputHash:projected.state==='completed'?sha(payloadRaw):null,captureHash:digest(core)};
  return {envelope:{schemaVersion:3,protocol:CAPTURE_V3,runId:spec.runId,sourceSeal:spec.sourceSeal,specHash:k.specHash,key,core,result},payloadRaw,requestRaw,responseRaw};
 }
 function inspect({ledger,key,expectedResult,allowMissingPayload=false}){
  const {row}=target(ledger,key),dir=folder(),prefix=resolve(dir,row.requestId),prepared=raw(prefix+'.prepared.json'),e=parseV3Json(utf8(prepared));check(fields(e,['schemaVersion','protocol','runId','sourceSeal','specHash','key','core','result'])&&e.schemaVersion===3&&e.protocol===CAPTURE_V3&&e.runId===spec.runId&&e.sourceSeal===spec.sourceSeal&&e.specHash===k.specHash&&e.key===key,'ENVELOPE');
  const request=raw(prefix+'.request.json'),response=raw(prefix+'.response.txt'),a=build({ledger,key,requestRaw:utf8(request),responseRaw:utf8(response),status:e.core?.status,contentType:e.core?.contentType});check(digest(e)===digest(a.envelope),'CAPTURE_BINDING');const payloadExists=existsSync(prefix+'.payload.txt');check(payloadExists||allowMissingPayload,'PAYLOAD_MISSING');const payload=payloadExists?raw(prefix+'.payload.txt'):null;if(payload)check(payload.equals(Buffer.from(a.payloadRaw)),'PAYLOAD_CHANGED');
  if(row.state!=='consumed')check(digest(row.result)===digest(e.result)&&row.receiptHash===digest(e.result),'TERMINAL_RESULT');if(expectedResult!==undefined)check(digest(expectedResult)===digest(e.result),'EXPECTED_RESULT');
  const committed=existsSync(prefix+'.receipt.json');if(committed)check(payloadExists&&raw(prefix+'.receipt.json').equals(prepared),'RECEIPT_CHANGED');
  const names=['prepared.json','request.json','response.txt',...(payloadExists?['payload.txt']:[]),...(committed?['receipt.json']:[])],files=Object.fromEntries(names.map(n=>[row.requestId+'.'+n,sha(raw(prefix+'.'+n))]));
  return {result:structuredClone(e.result),payloadRaw:a.payloadRaw,requestRaw:a.requestRaw,responseRaw:a.responseRaw,receiptHash:digest(e.result),directory:dir,files,committed,payloadExists,sourceSeal:spec.sourceSeal,specHash:k.specHash,runId:spec.runId,physicalCaptureValidated:true,projectionSourceAuthenticated:false,providerReceiptAuthenticated:false,noDispatchPerformed:true};
 }
 function complete(args,testFault){
  const owns=owned(),a=inspect({...args,allowMissingPayload:true}),prefix=resolve(a.directory,a.result.requestId);owns();if(!a.payloadExists)durable(prefix+'.payload.txt',Buffer.from(a.payloadRaw),testFault,'complete-payload');
  for(const n of ['prepared.json','request.json','response.txt','payload.txt']){owns();const f=prefix+'.'+n,b=raw(f),fd=openSync(f,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}check(raw(f).equals(b),'COMPLETION_CHANGED');}
  owns();if(!a.committed)durable(prefix+'.receipt.json',raw(prefix+'.prepared.json'),testFault,'complete-receipt');else{const fd=openSync(prefix+'.receipt.json','r+');try{fsyncSync(fd);}finally{closeSync(fd);}}
  return inspect(args);
 }
 return Object.freeze({
  capture(args,testFault){const owns=owned(),{row}=target(args.ledger,args.key);check(row.state==='consumed','NOT_CONSUMED');const a=build(args),dir=folder(true),prefix=resolve(dir,row.requestId);for(const [n,b]of [['prepared.json',bytes(a.envelope)],['request.json',Buffer.from(a.requestRaw)],['response.txt',Buffer.from(a.responseRaw)],['payload.txt',Buffer.from(a.payloadRaw)],['receipt.json',bytes(a.envelope)]]){owns();durable(prefix+'.'+n,b,testFault,'capture-'+n.split('.')[0]);}return inspect({...args,expectedResult:a.envelope.result});},
  inspect:args=>inspect(args),
  read(args){const a=inspect(args);check(a.committed,'RECEIPT_INCOMPLETE');return a;},
  complete,
  settle({session,key},testFault){const {ledger}=session.current(),a=complete({ledger,key},testFault);if(ledger.slots[key].state!=='consumed')return {status:'already-settled',result:a.result,noDispatchPerformed:true};const next=session.append({kind:'settle',key,result:a.result});return {status:a.result.state,result:a.result,head:next.head,noDispatchPerformed:true};},
  physicalCaptureValidated:true,providerReceiptAuthenticated:false,liveDispatchSupported:false,actualProviderCalls:0,actualKeyReads:0
 });
}
