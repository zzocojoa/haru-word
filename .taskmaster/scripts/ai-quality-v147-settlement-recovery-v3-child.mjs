import {readFileSync} from 'node:fs';
import {compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {openV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {prepareV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {openV3SettlementProof} from './ai-quality-v147-settlement-proof-v3.mjs';
import {recoverV3Journal} from './ai-quality-v147-recovery-v3.mjs';
const [command,file,stage,inspectionHash]=process.argv.slice(2),{context,bundle,variant='completed',closed=false}=JSON.parse(readFileSync(file,'utf8')),options={context,seal:bundle.seal,observeCurrent:()=>bundle.current};
try{
 if(command==='writer'){
  const k=compileBudgetV3(context.spec),s=openV3Journal(context),key=context.spec.order[0],d=context.spec.requests[0];s.append({kind:'reserve',groupId:k.groupIds[0]});const w=prepareV3Wire({...bundle,ledger:s.current().ledger,key,wire:bundle.wires[key]});s.append(w.bindOperation);s.append({kind:'consume',key});
  const usage=variant==='unknown'?undefined:variant==='overflow'?{input_tokens:70001,output_tokens:4097}:{input_tokens:20,output_tokens:20};const responseRaw=JSON.stringify({status:'completed',model:d.modelId,...usage?{usage}:{},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:bundle.responses[key]}]}]});
  const cap=openV3CaptureStore(options).capture({ledger:s.current().ledger,key,requestRaw:w.raw,responseRaw,status:variant==='failed'?402:200,contentType:'application/json'});if(closed)s.append({kind:'close'});
  s.append({kind:'settle',key,result:cap.result},point=>{if(point===stage)process.exit(88);});s.close();process.stdout.write('{"unexpectedComplete":true}\n');process.exitCode=1;
 }else{
  const settlementProof=openV3SettlementProof(options),result=await recoverV3Journal({context,expectedInspectionHash:inspectionHash,settlementProof,testFault:async point=>{if(point!==stage)return;if(command==='recoverer')process.exit(89);if(command==='hold'){process.stdout.write('{"ownedReady":true}\n');process.stdin.resume();await new Promise(yes=>process.stdin.once('data',yes));process.stdin.pause();}}});
  process.stdout.write(JSON.stringify({status:result.status,physicalCaptureValidated:result.physicalCaptureValidated,noDispatchPerformed:result.noDispatchPerformed})+'\n');
 }
}catch(e){process.stdout.write(JSON.stringify({held:true,code:e.message==='R3_RECOVERY_HELD'?e.message:'S3_CHILD_HELD',failureCode:typeof e.failureCode==='string'?e.failureCode:'UNKNOWN',nativeCode:typeof e.nativeCode==='string'?e.nativeCode:'UNKNOWN'})+'\n');process.exitCode=75;}
