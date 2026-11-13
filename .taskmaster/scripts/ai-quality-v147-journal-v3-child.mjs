// Child-process qualification helper. Wholly synthetic, never a live entrypoint.
import {readFileSync} from 'node:fs';
import {openV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticBinding} from './ai-quality-v147-budget-v3-fixture.mjs';
const [command,file,stage]=process.argv.slice(2);let session;
try{
 const {context}=JSON.parse(readFileSync(file,'utf8'));if(context.spec.mode!=='synthetic')throw Error('J3_CHILD_SYNTHETIC_ONLY');session=openV3Journal(context);
 if(command==='lease'){
  process.stdout.write(JSON.stringify({ownedReady:true,pid:process.pid})+'\n');await new Promise(res=>{process.stdin.once('data',res);process.stdin.once('end',res);});process.stdin.destroy();session.close();session=null;process.stdout.write('{"released":true}\n');
 }else if(command==='crash'){
  const k=compileBudgetV3(context.spec),d=context.spec.requests[0];session.append([{kind:'reserve',groupId:k.groupIds[0]},{kind:'bind',key:d.key,binding:v3SyntheticBinding(k,session.current().ledger,d.key)}]);
  session.append({kind:'consume',key:d.key},point=>{if(point===stage)process.exit(83);});throw Error('J3_CHILD_FAULT_NOT_REACHED');
 }else throw Error('J3_CHILD_COMMAND');
}catch(e){const code=typeof e?.message==='string'&&/^(?:J3|P3)_[A-Z0-9_]+$/.test(e.message)?e.message:e?.code==='EEXIST'?'J3_LEASE_REFUSED':'J3_CHILD_HELD';process.stdout.write(JSON.stringify({held:true,code})+'\n');process.exitCode=code==='J3_LEASE_REFUSED'?75:1;}
finally{if(session)try{session.abandon();}catch{process.exitCode=1;}}
