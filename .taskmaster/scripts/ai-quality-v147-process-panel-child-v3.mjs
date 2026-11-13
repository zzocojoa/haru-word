// Owned test child. Theparent kills thisNode (andselectedworkerd) after an
// fsynced checkpoint;no finally path is executed in thecrashing writer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,openSync,closeSync,fsyncSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {startPersistentSyntheticWorkerV3} from './ai-quality-v147-persistent-worker-v3.mjs';
import {openSyntheticWorkerPanelBridgeV3} from './ai-quality-v147-worker-panel-v3.mjs';
import {startSyntheticHttpV3} from './ai-quality-v147-synthetic-http-v3.mjs';
import {createV3Journal,readV3Journal,openV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openSyntheticPanelExecutorV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {openV3SettlementProof} from './ai-quality-v147-settlement-proof-v3.mjs';
import {inspectV3Recovery,recoverV3Journal} from './ai-quality-v147-recovery-v3.mjs';
import {ownProcessIdentity} from './ai-quality-v147-process.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),ROOT=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot,[mode,file]=process.argv.slice(2),cfg=JSON.parse(readFileSync(file,'utf8')),b=cfg.bundle,context=cfg.context;
assert.ok(['write','recover'].includes(mode)&&cfg.schemaVersion===3&&cfg.syntheticOnly===true&&context.allowedRoot===dirname(resolve(file))&&context.allowedRoot.startsWith(resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106/phase28')+'\\')&&context.spec.runId===b.spec.runId&&b.spec.mode==='synthetic');
const sha=x=>createHash('sha256').update(x).digest('hex'),durable=(name,value)=>{const fd=openSync(resolve(context.allowedRoot,name),'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}},read=name=>JSON.parse(readFileSync(resolve(context.allowedRoot,name),'utf8'));
let profiles={},bridge=null,executor=null,http=null,appInfo=null,projectGeneration=null,activeKey=null;const projectors={};
if(cfg.kind==='app'){
 for(const label of ['baseline','candidate']){assert.equal(sha(readFileSync(cfg.projectors[label].file)),cfg.projectors[label].sha256);projectors[label]=await import(pathToFileURL(cfg.projectors[label].file));}
 projectGeneration=({phase,requestRaw,responseRaw,modelId})=>{const r=projectors[phase],{text,actualModel}=r.openAiOutputText(JSON.parse(responseRaw),modelId),input=JSON.parse(JSON.parse(requestRaw).input[0].content),value=r.parseJudgmentFeedback(text,input.sentence,actualModel,input);return JSON.stringify(Object.fromEntries(['original','meaningUsage','grammar','correctedSentence','explanation'].map(k=>[k,value[k]])));};
}
const options=()=>({context,seal:b.seal,observeCurrent:()=>b.current,readWire:key=>b.wires[key],reportInputs:b.reportInputs,projectGeneration});
const target=b.spec.requests.find(d=>d.key===cfg.targetKey);assert.ok(target);let checkpointWritten=false;
async function checkpoint(stage){
 assert.equal(checkpointWritten,false);checkpointWritten=true;let app=null;if(appInfo){const p=profiles[appInfo.descriptor.phase],snapshot=await bridge.api(p,appInfo.seeded.owner,'/api/state'),receipt=await bridge.api(p,appInfo.seeded.owner,'/api/feedback-requests/'+appInfo.request.requestId);assert.equal(snapshot.status,200);assert.equal(receipt.status,200);app={owner:appInfo.seeded.owner,request:appInfo.request,phase:appInfo.descriptor.phase,domain:cfg.domain,row:appInfo.row,savedState:snapshot.value.state,receipt:receipt.value};}
 durable('checkpoint.json',{schemaVersion:3,runId:b.spec.runId,kind:cfg.kind,stage,targetKey:target.key,targetRole:target.role,nodeIdentity:ownProcessIdentity(),workerProofs:Object.fromEntries(Object.entries(profiles).map(([label,p])=>[label,p.proof])),app,ledger:readV3Journal(context),actualProviderCalls:0,actualKeyReads:0});
 assert.ok(process.send);await new Promise((done,reject)=>process.send({checkpoint:true,file:resolve(context.allowedRoot,'checkpoint.json'),sha256:sha(readFileSync(resolve(context.allowedRoot,'checkpoint.json'))),nodePid:process.pid},e=>e?reject(e):done()));await new Promise(()=>{});
}
try{
 if(mode==='write'){
  assert.equal(existsSync(context.directory),false);createV3Journal(context,b.approval);
  if(cfg.kind==='app')for(const label of ['baseline','candidate'])profiles[label]=await startPersistentSyntheticWorkerV3({workspaceRoot:ROOT,runId:b.spec.runId,label,buildSourceRoot:cfg.buildRoots[label],mode:'create',respond:body=>bridge.respond(body)});
  http=await startSyntheticHttpV3({bundle:b,logFile:resolve(context.allowedRoot,'writer-http.jsonl')});
  if(cfg.kind==='app')bridge=openSyntheticWorkerPanelBridgeV3({context,bundle:b,profiles,projectGeneration,leafTransport:http.send,diskBindings:cfg.diskBindings,word:cfg.word,material:cfg.material,testFault:async(stage,data)=>{appInfo=data;if(cfg.stage==='after-worker-commit')await checkpoint(stage);}});
  executor=openSyntheticPanelExecutorV3({...options(),transport:cfg.kind==='app'?bridge.transport:http.send,testFault:async stage=>{if(stage===cfg.stage&&activeKey===target.key){if(cfg.kind==='app')assert.ok(appInfo);await checkpoint(stage);}}});
  const dispatch=key=>{activeKey=key;return executor.dispatch(key);};
  if(b.spec.profile.stage==='pilot-panel'&&target.role!=='calibration')for(const d of b.spec.requests.filter(d=>d.role==='calibration'))assert.equal((await dispatch(d.key)).state,'completed');
  if(target.parentKey)assert.equal((await dispatch(target.parentKey)).state,'completed');
  await dispatch(target.key);throw Error('CHECKPOINT_NOT_REACHED');
 }
 const checkpointData=read('checkpoint.json');assert.equal(checkpointData.runId,b.spec.runId);const settlementProof=openV3SettlementProof(options()),inspection=inspectV3Recovery(context,{settlementProof}),recovery=await recoverV3Journal({context,expectedInspectionHash:inspection.inspectionHash,settlementProof});let forbidden=0,firstStatus,firstError=null;
 executor=openSyntheticPanelExecutorV3({...options(),transport:async()=>{forbidden++;throw Error('FORBIDDEN_RECOVERY_TRANSPORT');}});
 try{firstStatus=await executor.dispatch(target.key);}catch(error){firstError=typeof error?.code==='string'?error.code:error.message;assert.equal(cfg.stage==='after-worker-commit'||cfg.stage==='after-consume',true);assert.ok(firstError==='ENOENT'||/^C3_/.test(firstError));}executor.release();executor=null;
 const session=openV3Journal(context);if(!session.current().ledger.closed)session.append({kind:'close'});session.close();
 executor=openSyntheticPanelExecutorV3({...options(),transport:async()=>{forbidden++;throw Error('FORBIDDEN_CLOSED_TRANSPORT');}});let repeatedStatus=null;try{repeatedStatus=await executor.dispatch(target.key);}catch(error){assert.equal(firstError!==null,true);assert.ok(error.code==='ENOENT'||/^C3_/.test(error.message));}const final=executor.inspect(),report=executor.report();executor.release();executor=null;assert.equal(forbidden,0);
 let appRecovered=null,providerAdded=0,lifecycle=[];
 if(cfg.kind==='app'){
  for(const label of ['baseline','candidate'])profiles[label]=await startPersistentSyntheticWorkerV3({workspaceRoot:ROOT,runId:b.spec.runId,label,buildSourceRoot:cfg.buildRoots[label],mode:'reopen',expectedReopenProof:checkpointData.workerProofs[label],respond:()=>{providerAdded++;throw Error('NO_PROVIDER_ON_REOPEN');}});
  bridge=openSyntheticWorkerPanelBridgeV3({context,bundle:b,profiles,projectGeneration,leafTransport:async()=>{throw Error('NO_LEAF_ON_REOPEN');},diskBindings:cfg.diskBindings,word:cfg.word,material:cfg.material});const a=checkpointData.app,p=profiles[a.phase],state=await bridge.api(p,a.owner,'/api/state');assert.equal(state.status,200);assert.deepEqual(state.value.state,a.savedState);const receipt=await bridge.api(p,a.owner,'/api/feedback-requests/'+a.request.requestId);assert.equal(receipt.status,200);assert.deepEqual(receipt.value.feedback,a.receipt.feedback);const duplicate=await bridge.api(p,a.owner,'/api/'+(a.domain==='word'?'sentence':'grammar')+'-feedback','POST',a.request);assert.equal(duplicate.status,200);assert.deepEqual(duplicate.value.feedback,a.receipt.feedback);assert.deepEqual((await bridge.api(p,a.owner,'/api/state')).value.state,a.savedState);assert.equal(providerAdded,0);appRecovered={savedStateEqual:true,receiptRecovered:true,duplicatePostProviderAdded:0,feedbackEqual:true,independentScoresAndReviewPreserved:true};
  for(const label of ['baseline','candidate']){const p=profiles[label],stop=await p.stop();lifecycle.push({proof:p.proof,stop});}profiles={};
 }
 const result={passed:true,kind:cfg.kind,runId:b.spec.runId,role:target.role,stage:cfg.stage,nodeVersion:process.version,recovery,firstStatus:firstStatus??null,firstError,repeatedStatus,final,report,noResend:forbidden===0,appRecovered,providerAdded,lifecycle,actualProviderCalls:0,actualKeyReads:0,actualModelQualityMeasured:false,powerLossDurabilityMeasured:false,releaseVerdict:'held'};durable('recovered.json',result);console.log(JSON.stringify({passed:true,role:target.role,stage:cfg.stage,upperMicros:final.account.upperMicros,appRecovered:appRecovered!==null,actualProviderCalls:0}));
}finally{try{executor?.abandon();}catch{/* leave unproved bytes */}try{await http?.close();}catch{/* preserve raw logs */}for(const p of Object.values(profiles))await p.stop();}
