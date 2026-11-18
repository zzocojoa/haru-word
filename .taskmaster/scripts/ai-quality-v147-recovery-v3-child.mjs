import {readFileSync} from 'node:fs';
import {openV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {recoverV3Journal} from './ai-quality-v147-recovery-v3.mjs';
const [command,file,inspectionHash,stage]=process.argv.slice(2),context=JSON.parse(readFileSync(file,'utf8')).context;
try{
 if(command==='drop-lease'){openV3Journal(context);process.exit(86);}
 const result=await recoverV3Journal({context,expectedInspectionHash:inspectionHash,testFault:async point=>{
  if(point!==stage)return;
  if(command==='crash')process.exit(84);
  if(command==='hold'){
   process.stdout.write(JSON.stringify({ownedReady:true,stage:point})+'\n');process.stdin.resume();await new Promise(yes=>process.stdin.once('data',yes));process.stdin.pause();
  }
 }});
 process.stdout.write(JSON.stringify({status:result.status,noDispatchPerformed:result.noDispatchPerformed,evidenceDirectory:result.evidenceDirectory??null})+'\n');
}catch(e){process.stdout.write(JSON.stringify({held:true,code:e.message==='R3_RECOVERY_HELD'?e.message:'R3_CHILD_HELD',failureCode:typeof e.failureCode==='string'?e.failureCode:'UNKNOWN',nativeCode:typeof e.nativeCode==='string'?e.nativeCode:'UNKNOWN'})+'\n');process.exitCode=75;}
