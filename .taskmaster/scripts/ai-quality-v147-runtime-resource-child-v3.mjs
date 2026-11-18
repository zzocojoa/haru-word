// A real owned child for two-process lease races and restart/dead-owner QA.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startPersistentSyntheticWorkerV3} from './ai-quality-v147-persistent-worker-v3.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),ROOT=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot,[mode,file]=process.argv.slice(2),cfg=JSON.parse(readFileSync(file,'utf8'));
assert.ok(['race','writer'].includes(mode)&&cfg.syntheticOnly===true&&resolve(file).startsWith(resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106/phase28')+'\\'));
let profile;
const send=value=>new Promise((done,reject)=>process.send(value,e=>e?reject(e):done()));
try{
 try{profile=await startPersistentSyntheticWorkerV3({...cfg.options,workspaceRoot:ROOT,mode:mode==='race'?'reopen':'create',respond:()=>{throw Error('FORBIDDEN_PROVIDER');}});}
 catch(error){assert.equal(mode,'race');assert.match(error.message,/RECOVERY_MUTEX_BUSY_OR_FAILED|PW3_OWNER_OR_RUNTIME_LIVE_OR_UNKNOWN/);const result={held:true,error:error.message,actualProviderCalls:0};writeFileSync(resolve(dirname(file),'result.json'),JSON.stringify(result)+'\n',{flag:'wx'});await send(result);process.exitCode=75;}
 if(profile){await send({owned:true,proof:profile.proof,base:profile.base});await new Promise(done=>process.once('message',message=>{assert.equal(message,'stop');done();}));const stop=await profile.stop();profile=null;writeFileSync(resolve(dirname(file),'result.json'),JSON.stringify({stopped:true,stop,actualProviderCalls:0})+'\n',{flag:'wx'});}
}finally{await profile?.stop();process.disconnect();}
