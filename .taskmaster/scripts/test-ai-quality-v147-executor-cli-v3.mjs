import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {executorFixtureV2} from './ai-quality-v147-executor-fixture-v2.mjs';
import {inspectV2Recovery,recoverV2Journal} from './ai-quality-v147-recovery-v2.mjs';
import {openSyntheticExecutorV2} from './ai-quality-v147-executor-v2.mjs';
import {slotKey} from './ai-quality-v147-budget-v2.mjs';
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(process.env.QA_OUTPUT_DIR??resolve(here,'../../work/cli-v3-'+randomUUID()));mkdirSync(out,{recursive:true});
const observations={actualProviderCalls:0,actualKeyReads:0,task22Complete:false,full756CollectionExecuted:false,crashes:[]},sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(options){const bundle=executorFixtureV2(options),root=resolve(out,bundle.spec.runId);mkdirSync(root);return {bundle,root,file:resolve(root,'bundle.json')};}
function save(f){writeFileSync(f.file,JSON.stringify(f.bundle),{flag:'wx'});}
function child(f,stage){const cp=spawn(process.execPath,[resolve(here,'ai-quality-v147-executor-cli-v3.mjs'),'--synthetic',f.file,f.root,...(stage?[stage]:[])],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';cp.stdout.on('data',x=>stdout+=x.toString());cp.stderr.on('data',x=>stderr+=x.toString());const done=new Promise((yes,no)=>{const timer=setTimeout(()=>{cp.kill();no(Error('V3_TEST_CHILD_TIMEOUT'));},60000);cp.once('error',no);cp.once('exit',exitCode=>{clearTimeout(timer);yes({exitCode,stdout,stderr});});});return {cp,done,output:()=>stdout};}
function log(f){return resolve(f.root,f.bundle.spec.runId+'-http-v2.jsonl');}

test('actual CLI3 pair completes on2 closed sockets;second process on closed ledger adds0 HTTP requests and preserves log bytes',async()=>{
 const f=fixture();save(f);const first=await child(f).done;assert.equal(first.exitCode,0,first.stderr);const a=JSON.parse(first.stdout);assert.equal(a.syntheticProviderSendsAdded,2);assert.equal(a.syntheticClientFailures,0);assert.equal(a.closed,true);const bytes=readFileSync(log(f)),events=bytes.toString('utf8').trim().split('\n').map(x=>JSON.parse(x));assert.equal(events.filter(x=>x.kind==='socket-open').length,2);assert.equal(events.filter(x=>x.kind==='stopped').length,1);
 const second=await child(f).done;assert.equal(second.exitCode,0,second.stderr);assert.equal(JSON.parse(second.stdout).syntheticProviderSendsAdded,0);assert.equal(sha(readFileSync(log(f))),sha(bytes));assert.equal(existsSync(resolve(f.root,f.bundle.spec.runId,'LOCK.json')),false);observations.closedRestart={initialRequests:2,addedRequests:0,firstExit:0,secondExit:0,closedLogBytesPreserved:true};
});

test('approval0 and actual runtime mismatch reject before a journal,HTTP log or listener is created',async()=>{
 for(const kind of ['approval','runtime']){const f=fixture(kind==='runtime'?{nodeVersion:'v24.0.0'}:undefined);if(kind==='approval')f.bundle.approval={...f.bundle.approval,kind:'unapproved',amountMicros:'0',evidenceHash:null};save(f);const before=readdirSync(f.root);const result=await child(f).done;assert.equal(result.exitCode,1);assert.deepEqual(readdirSync(f.root),before);assert.equal(JSON.parse(result.stderr).code,kind==='approval'?'V3CLI_UNAPPROVED':'V3CLI_ACTUAL_RUNTIME');}
});

test('actual CLI3 exits4 boundaries;existing open run is refused and explicit same-UUID recovery adds0 requests',async()=>{
 for(const stage of ['executor:after-binding','executor:after-consume-before-transport','executor:after-transport-before-capture','executor:after-capture-before-settle']){
  const f=fixture();save(f);const crashed=await child(f,stage).done;assert.equal(crashed.exitCode,82,crashed.stderr);const before=readFileSync(log(f)),refused=await child(f).done;assert.equal(refused.exitCode,1);assert.equal(JSON.parse(refused.stderr).code,'V3CLI_EXISTING_OPEN_HELD');assert.equal(sha(readFileSync(log(f))),sha(before));
  const context={directory:resolve(f.root,f.bundle.spec.runId),allowedRoot:f.root,spec:f.bundle.spec},plan=inspectV2Recovery(context);await recoverV2Journal({context,expectedInspectionHash:plan.inspectionHash});let callbacks=0;const executor=openSyntheticExecutorV2({context,seal:f.bundle.seal,observeCurrent:()=>f.bundle.current,readWire:key=>f.bundle.wires[key],transport:async()=>{callbacks++;throw Error('MUST_NOT_RETRY');}});
  try{if(stage!=='executor:after-binding'){const result=await executor.dispatch(slotKey(f.bundle.spec.batches[0].requests[0]));assert.equal(result.status,stage==='executor:after-capture-before-settle'?'recovered-capture':'held');}}finally{executor.release();}
  assert.equal(callbacks,0);assert.equal(sha(readFileSync(log(f))),sha(before));observations.crashes.push({stage,exitCode:82,refusedOpenExit:1,recoveryAdded:0,originalLogPreserved:true});
 }
});

test('two actual CLI3 processes compete;one owns the run,one is refused and only2 unique UUIDs are accepted',async()=>{
 const f=fixture();f.bundle.testOwnedGate=true;save(f);const pair=[child(f),child(f)],ready=pair.map((c,i)=>new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('V3_TEST_RACE_TIMEOUT')),15000),inspect=()=>{if(c.output().includes('"ownedReady":true')){clearTimeout(timer);c.cp.stdout.off('data',inspect);yes(i);}};c.cp.stdout.on('data',inspect);c.done.then(()=>{clearTimeout(timer);no(Error('V3_TEST_NOT_OWNER'));});inspect();}));
 const owner=await Promise.any(ready);assert.equal((await pair[1-owner].done).exitCode,1);pair[owner].cp.stdin.end('continue\n');assert.equal((await pair[owner].done).exitCode,0);const events=readFileSync(log(f),'utf8').trim().split('\n').map(x=>JSON.parse(x)),accepted=events.filter(x=>x.kind==='server-accepted');assert.equal(accepted.length,2);assert.equal(new Set(accepted.map(x=>x.requestId)).size,2);observations.race={completed:1,refused:1,accepted:2};
});

test.after(()=>writeFileSync(resolve(out,'executor-cli-v3-observations.json'),JSON.stringify(observations,null,2)+'\n'));
