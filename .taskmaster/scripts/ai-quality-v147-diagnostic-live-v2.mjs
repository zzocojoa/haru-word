// Approval-gated six-request diagnostic. No CLI --live switch,no key discovery,
// automatic retry,resume,old-ledger access or production learner writes.
import {mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,readFileSync,realpathSync,lstatSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {digest,account} from './ai-quality-v147-budget.mjs';
import {createBudgetStore,transactBudgetStore,readBudgetStore} from './ai-quality-v147-budget-store.mjs';
import {loadDiagnosticEnvelopeV2,compileDiagnosticEnvelopeV2,validateDiagnosticApprovalV2} from './ai-quality-v147-diagnostic-envelope-v2.mjs';
import {inspectDiagnosticResponseV2} from './ai-quality-v147-diagnostic-envelope-v2.mjs';
import {parseV3Json} from './ai-quality-v147-wire-v3.mjs';
const check=(ok,c)=>{if(!ok)throw Error('DL2_'+c);},sha=x=>createHash('sha256').update(x).digest('hex');
const safe=e=>/^(?:DL2|DE2|CR1|W3)_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'DL2_IO_OR_TRANSPORT';
function durableNew(file,value){const raw=typeof value==='string'?value:JSON.stringify(value)+'\n',fd=openSync(file,'wx');try{writeFileSync(fd,raw,'utf8');fsyncSync(fd);}finally{closeSync(fd);}const stat=lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&sha(readFileSync(file))===sha(raw),'FILE_READBACK');}
function checkedRoot(root){const path=resolve(root);check(realpathSync(dirname(path))===dirname(path),'ROOT_PARENT');if(!existsSync(path))mkdirSync(path);check(!lstatSync(path).isSymbolicLink()&&realpathSync(path)===path,'ROOT_LINK');return path;}
function parsedResponse(raw,expectedModel){
 const v=parseV3Json(raw,262144);check(v.status==='completed'&&v.model===expectedModel&&v.service_tier==='default'&&Array.isArray(v.output),'RESPONSE_MODEL_OR_STATUS');check(v.usage?.input_tokens_details?.cached_tokens===0&&v.usage?.input_tokens_details?.cache_write_tokens===0,'UNEXPECTED_CACHE_USAGE');const inputTokens=v.usage?.input_tokens,outputTokens=v.usage?.output_tokens;check(Number.isSafeInteger(inputTokens)&&inputTokens>0&&Number.isSafeInteger(outputTokens)&&outputTokens>=0&&v.usage.total_tokens===inputTokens+outputTokens,'USAGE_REQUIRED');
 const texts=v.output.flatMap(x=>x.type==='message'&&Array.isArray(x.content)?x.content.filter(c=>c.type==='output_text'&&typeof c.text==='string').map(c=>c.text):[]);check(texts.length===1&&texts[0].length>0,'OUTPUT_TEXT');return {usage:{inputTokens,outputTokens},payloadRaw:texts[0]};
}
async function runWithTransport({p,bundle,sessionApproval,runtimeRoot,loadExistingKey,transport,testFault=null}){
 const budgetApproval=validateDiagnosticApprovalV2(bundle,sessionApproval),mode=bundle.spec.mode;
 check(digest(compileDiagnosticEnvelopeV2(loadDiagnosticEnvelopeV2(p.prepared.sourceRoot),mode))===digest(bundle),'CURRENT_BUNDLE');check(typeof loadExistingKey==='function'&&typeof transport==='function','CALLBACKS');
 const root=checkedRoot(runtimeRoot),runId=bundle.spec.runId,marker=resolve(root,'ONCE-'+runId+'.json');
 try{durableNew(marker,{protocol:bundle.protocol,runId,bundleHash:bundle.hash,approvalEvidenceHash:sessionApproval.evidenceHash,pid:process.pid,rule:'Permanentone-invocationclaim;notproofthisPIDislive.Noautomaticremovalorresend.'});}catch(e){if(e.code==='EEXIST')throw Error('DL2_ONCE_ALREADY_CLAIMED');throw e;}
 const context={directory:resolve(root,runId),allowedRoot:root,spec:bundle.spec},captures=resolve(root,'captures-'+runId);mkdirSync(captures);let state=createBudgetStore({...context,approval:budgetApproval}),sent=0,keyReads=0,failureCode=null,currentRow=null;
 const point=async stage=>{await testFault?.(stage);},verify=()=>{validateDiagnosticApprovalV2(bundle,sessionApproval);check(digest(compileDiagnosticEnvelopeV2(loadDiagnosticEnvelopeV2(p.prepared.sourceRoot),mode))===digest(bundle),'CURRENT_BUNDLE');};
 const tx=operation=>state=transactBudgetStore({...context,operation}),records=[];
 try{
  let apiKey=null;
  for(const [index,sourceRequest]of bundle.requests.entries()){
   const r=structuredClone(sourceRequest);
   verify();const descriptor=bundle.spec.batches[index].requests[0];check(r.budgetKey&&descriptor.bodyCommitment===sha(r.requestRaw),'REQUEST_BYTES');
   const available=account(bundle.spec,readBudgetStore(context).ledger),bound=bundle.perRequest[index].maximumMicros;
   if(BigInt(bound)>BigInt(available.remainingMicros)){failureCode='DL2_INSUFFICIENT_NEXT_REQUEST';break;}
   tx({kind:'reserve',batchId:r.batchId});await point('after-reserve');verify();
   if(apiKey===null){apiKey=await loadExistingKey();keyReads++;check(typeof apiKey==='string'&&apiKey.trim().length>0,'KEY_UNAVAILABLE');}
   currentRow=r;
   durableNew(resolve(captures,index+'-request.json'),r.requestRaw);tx({kind:'consume',key:r.budgetKey});await point('after-consume');verify();
   const committed=readBudgetStore(context);check(committed.ledger.slots[r.budgetKey].state==='consumed','CONSUMPTION_REQUIRED');const requestId=committed.ledger.slots[r.budgetKey].requestId;
   sent++;const response=await transport({requestRaw:r.requestRaw,requestId,modelId:r.modelId,apiKey});await point('after-transport');
   check(response&&Number.isSafeInteger(response.status)&&typeof response.contentType==='string'&&typeof response.responseRaw==='string'&&Buffer.byteLength(response.responseRaw)<=262144,'TRANSPORT_SHAPE');
   const secretEcho=response.responseRaw.includes(apiKey),jsonType=/^application\/json(?:\s*;|$)/i.test(response.contentType),admissible=response.status===200&&jsonType&&!secretEcho;
   const meta={runId,key:r.key,requestId,requestSha256:sha(r.requestRaw),status:response.status,jsonContentType:jsonType,responseSha256:sha(response.responseRaw),responseBytes:Buffer.byteLength(response.responseRaw),rawPersisted:admissible,possibleCredentialEcho:secretEcho};
   if(admissible)durableNew(resolve(captures,index+'-response.json'),response.responseRaw);durableNew(resolve(captures,index+'-capture.json'),meta);await point('after-capture');
   check(sha(readFileSync(resolve(captures,index+'-capture.json')))===sha(JSON.stringify(meta)+'\n')&&(!admissible||sha(readFileSync(resolve(captures,index+'-response.json')))===sha(response.responseRaw)),'CAPTURE_READBACK');verify();
   if(!admissible){tx({kind:'settle',key:r.budgetKey,state:'unknown',usage:null,evidenceHash:digest(meta)});failureCode=secretEcho?'DL2_CREDENTIAL_ECHO_HELD':'DL2_HTTP_OR_CONTENT_HELD';break;}
   let parsed;try{parsed=parsedResponse(response.responseRaw,r.modelId);check(parsed.usage.inputTokens<=descriptor.inputTokenMax&&parsed.usage.outputTokens<=descriptor.outputTokenMax,'USAGE_BOUND');inspectDiagnosticResponseV2({prepared:p.prepared,request:r,payloadRaw:parsed.payloadRaw});}
   catch(error){tx({kind:'settle',key:r.budgetKey,state:'unknown',usage:null,evidenceHash:digest(meta)});failureCode=safe(error);break;}
   tx({kind:'settle',key:r.budgetKey,state:'completed',usage:parsed.usage,evidenceHash:digest(meta)});records.push({key:r.key,requestRaw:r.requestRaw,canonicalRequestRaw:r.canonicalRequestRaw,payloadRaw:parsed.payloadRaw});await point('after-settle');currentRow=null;
  }
 }catch(error){failureCode=safe(error);try{const row=currentRow&&readBudgetStore(context).ledger.slots[currentRow.budgetKey];if(row?.state==='consumed')tx({kind:'settle',key:currentRow.budgetKey,state:'unknown',usage:null,evidenceHash:null});}catch{failureCode='DL2_STORE_READBACK_HELD';}}
 try{if(!readBudgetStore(context).ledger.closed)tx({kind:'close'});}catch{failureCode??='DL2_STORE_CLOSE_HELD';}
 let readbackVerified=true;try{state=readBudgetStore(context);}catch{readbackVerified=false;failureCode??='DL2_STORE_READBACK_HELD';}
 const diagnostic={denominator:6,collected:records.length,missingKeys:bundle.requests.filter(r=>!records.some(x=>x.key===r.key)).map(r=>r.key),rows:records.map(row=>inspectDiagnosticResponseV2({prepared:p.prepared,request:bundle.requests.find(r=>r.key===row.key),payloadRaw:row.payloadRaw})),complete:records.length===6,calibrationGoldEligible:false,releaseVerdict:'held'},result={protocol:bundle.protocol,runId,bundleHash:bundle.hash,status:failureCode?'held':'collected-public-diagnostic',failureCode,readbackVerified,plannedRequests:6,clientDispatches:sent,completedPayloads:records.length,account:account(bundle.spec,state.ledger),diagnostic,actualProviderCalls:mode==='evaluation'?sent:0,actualKeyReads:mode==='evaluation'?keyReads:0,actualCountApiCalls:0,countApiUsed:false,oldBudgetTransferred:false,automaticRetryOrResumeSupported:false,providerReceiptAuthenticated:false,actualEnglishQualityQualified:false,releaseVerdict:'held'};
 durableNew(resolve(root,'terminal-'+runId+'.json'),result);return result;
}
export async function runSyntheticDiagnosticEnvelopeV2(args){check(args.bundle?.spec?.mode==='synthetic','SYNTHETIC_ONLY');return runWithTransport(args);}
async function officialTransport({requestRaw,apiKey}){
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',Accept:'application/json'},body:requestRaw,redirect:'error',signal:AbortSignal.timeout(120000)}),reader=response.body?.getReader();check(reader,'RESPONSE_BODY');const chunks=[];let length=0;
 while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>262144){await reader.cancel();throw Error('DL2_RESPONSE_BYTES');}chunks.push(Buffer.from(part.value));}
 return {status:response.status,contentType:response.headers.get('content-type')??'',responseRaw:Buffer.concat(chunks).toString('utf8')};
}
// The caller must first observe an explicit current user approval and recheck the
// official limits/rates. A local JSON field or this export is not authorization.
export async function runAuthorizedDiagnosticEnvelopeV2({p,bundle,sessionApproval,runtimeRoot,loadExistingKey}){
 check(bundle?.spec?.mode==='evaluation','EVALUATION_ONLY');validateDiagnosticApprovalV2(bundle,sessionApproval);
 const allowed=resolve(p.prepared.root,'outputs/ai-quality-v147-direct-diagnostic-five-dollar-runtime-20261107');check(resolve(runtimeRoot)===allowed,'LIVE_RUNTIME_ROOT');
 return runWithTransport({p,bundle,sessionApproval,runtimeRoot:allowed,loadExistingKey,transport:officialTransport});
}
export function inspectDiagnosticEnvelopeRunV2({bundle,runtimeRoot}){const root=realpathSync(runtimeRoot),context={directory:resolve(root,bundle.spec.runId),allowedRoot:root,spec:bundle.spec},state=readBudgetStore(context);return {...state,account:account(bundle.spec,state.ledger),permanentClaimPresent:existsSync(resolve(root,'ONCE-'+bundle.spec.runId+'.json')),noDispatchPerformed:true,automaticRetryOrResumeSupported:false};}
