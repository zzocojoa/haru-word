// Scoped collector for the three prepared reference-adjudication packets.
// Transport and key loading are supplied only by the explicitly invoked runner.
import fs from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {quoteBilingualReferencesV1 as quote} from './ai-quality-v147-bilingual-reference-v1.mjs';
import {validateV3Request,validateV3Output,parseV3Json} from './ai-quality-v147-wire-v3.mjs';
import {inspectResponseCredentialsV1} from './ai-quality-v147-response-credential-guard-v1.mjs';
import {durableEvaluationV3 as save} from './ai-quality-v147-evaluation-budget-v3.mjs';
import {REFERENCE_ADJUDICATION_V1,inspectReferenceAdjudicationV1} from './ai-quality-v147-reference-adjudication-v1.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const check=(ok,code)=>{if(!ok)throw Error('RAD1_'+code);};
export async function collectReferenceAdjudicationV1({plan,directory,mode='synthetic',transport,loadKey,onProgress=()=>{}}){
 const{hash,...basis}=plan;check(digest(basis)===hash&&plan.protocol===REFERENCE_ADJUDICATION_V1&&plan.requests.length===3&&plan.judgments===22,'PLAN');
 const cap=BigInt(plan.maximumMicros),countProvision=35000n;
 check(plan.countProvisionMicros==='105000'&&cap>=plan.requests.reduce((n,r)=>n+quote(r.model,1,r.outputMax),105000n),'CAP');
 for(const r of plan.requests){check(sha(r.requestRaw)===r.requestSha256&&sha(r.countRequestRaw)===r.countRequestSha256,'REQUEST_HASH');validateV3Request(r.requestRaw,{modelId:r.model,outputTokenMax:r.outputMax,maximumBytes:131072});}
 check(!fs.existsSync(resolve(directory,'ONCE.json')),'ONCE');save(resolve(directory,'ONCE.json'),{protocol:plan.protocol,planHash:hash,mode,automaticRetry:false});
 let key=null,keyReads=0,countCalls=0,modelCalls=0,observed=0n,pending=0n,failureCode=null,measured=null;
 const counts=[],records=[],ids=new Set(),answers=plan.requests.map(r=>({key:r.key,payloadRaw:null}));
 async function capture(kind,index,raw){
  const prefix=resolve(directory,kind+'-'+index);save(prefix+'-request.json',raw);save(prefix+'-intent.json',{kind,index,requestSha256:sha(raw),consumedBeforeTransport:true});
  if(kind==='count')countCalls++;else modelCalls++;
  const response=await transport({kind,index,body:raw,key});check(typeof response.raw==='string'&&Buffer.byteLength(response.raw)<=262144,'SIZE');
  check(!inspectResponseCredentialsV1(response.raw,key).blocked,'CREDENTIAL_OR_JSON');save(prefix+'-response.json',response.raw);save(prefix+'-capture.json',{status:response.status,responseSha256:sha(response.raw)});
  check(response.status===200&&/^application\/json(?:;|$)/i.test(response.type),'HTTP');return parseV3Json(response.raw,262144);
 }
 try{
  keyReads++;key=await loadKey();check(typeof key==='string'&&key.length>=16,'KEY');
  for(const[i,r]of plan.requests.entries()){
   const count=await capture('count',i,r.countRequestRaw);check(count.object==='response.input_tokens'&&Number.isSafeInteger(count.input_tokens)&&count.input_tokens>0&&count.input_tokens<=r.inputLimit,'INPUT_LIMIT');
   counts.push({key:r.key,model:r.model,inputTokens:count.input_tokens,inputBound:Math.ceil(count.input_tokens*1.25)});onProgress({kind:'count',completed:counts.length,total:3});
  }
  measured=counts.reduce((n,c,i)=>n+quote(plan.requests[i].model,c.inputBound,plan.requests[i].outputMax),105000n);
  save(resolve(directory,'measured-budget.json'),{upperMicros:String(measured),maximumMicros:String(cap),counts,countProvisionMicros:'105000'});check(measured<=cap,'MEASURED_CAP');
  for(const[i,r]of plan.requests.entries()){
   pending=quote(r.model,counts[i].inputBound,r.outputMax);const value=await capture('model',i,r.requestRaw),usage=value.usage;
   check(value.status==='completed'&&value.model===r.model&&value.service_tier==='default'&&/^resp_[\w-]+$/.test(value.id)&&!ids.has(value.id),'IDENTITY');
   check(Number.isSafeInteger(usage?.input_tokens)&&usage.input_tokens>0&&usage.input_tokens<=counts[i].inputBound&&Number.isSafeInteger(usage.output_tokens)&&usage.output_tokens>=0&&usage.output_tokens<=r.outputMax&&usage.total_tokens===usage.input_tokens+usage.output_tokens&&!(usage.input_tokens_details?.cache_write_tokens_details?.ttl_12h_tokens>0),'USAGE');
   ids.add(value.id);observed+=quote(r.model,usage.input_tokens,usage.output_tokens);pending=0n;check(observed+105000n<=measured,'OBSERVED_CAP');
   const texts=value.output?.flatMap(m=>m.type==='message'?(m.content??[]).filter(c=>c.type==='output_text').map(c=>c.text):[])??[];check(texts.length===1,'OUTPUT');
   validateV3Output(r.requestRaw,texts[0]);answers[i].payloadRaw=texts[0];records.push({key:r.key,model:r.model,responseId:value.id,inputTokens:usage.input_tokens,outputTokens:usage.output_tokens});
   const partial=inspectReferenceAdjudicationV1(plan,answers),controls=partial.rows.filter(row=>row.kind==='control'&&r.bindings.some(b=>b.itemId===row.itemId));
   check(controls.length>0&&controls.every(c=>c.available&&c.controlMatched),'CONTROL_MISMATCH');onProgress({kind:'model',completed:records.length,total:3});
  }
 }catch(error){failureCode=/^RAD1_[A-Z_]+$/.test(error?.message??'')?error.message:'RAD1_LOCAL_OR_TRANSPORT_HELD';}
 key=null;
 const inspection=inspectReferenceAdjudicationV1(plan,answers),used=observed+pending+BigInt(countCalls)*countProvision;check(used<=cap,'TERMINAL_CAP');save(resolve(directory,'reference-adjudication-evidence.json'),inspection);
 const terminal={protocol:plan.protocol,planHash:hash,mode,status:failureCode?'held':'collected-reference-adjudication-proposals',failureCode,actualProviderCalls:mode==='evaluation'?modelCalls:0,actualCountCalls:mode==='evaluation'?countCalls:0,actualKeyReads:mode==='evaluation'?keyReads:0,clientModelAttempts:modelCalls,clientCountAttempts:countCalls,counts,records,measuredUpperMicros:measured===null?null:String(measured),modelUpperMicros:String(observed),unresolvedAttemptUpperMicros:String(pending),countProvisionRetainedMicros:String(BigInt(countCalls)*countProvision),usedUpperMicros:String(used),conditionalRemainingMicros:String(cap-used),judgments:22,availableJudgments:inspection.availableJudgments,controlsMatched:inspection.controlsMatched,referencesQualified:0,formalPilotGenerations:0,formalPilotGrades:0,mainDispatchAuthorized:false,automaticRetry:false};
 save(resolve(directory,'terminal.json'),terminal);return terminal;
}
