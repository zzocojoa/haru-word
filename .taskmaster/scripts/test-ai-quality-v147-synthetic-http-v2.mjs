import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {executorFixtureV2} from './ai-quality-v147-executor-fixture-v2.mjs';
import {startSyntheticHttpV2} from './ai-quality-v147-synthetic-http-v2.mjs';
import {openSyntheticExecutorV2} from './ai-quality-v147-executor-v2.mjs';
import {createV2Journal,readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {slotKey,v2RequestId,digest,costUpperMicros} from './ai-quality-v147-budget-v2.mjs';
const out=resolve(process.env.QA_OUTPUT_DIR??resolve(dirname(fileURLToPath(import.meta.url)),'../../work/http-v2-'+randomUUID()));mkdirSync(out,{recursive:true});
const observations={actualProviderCalls:0,actualKeyReads:0,task22Complete:false,full756CollectionExecuted:false,failures:[],connectionControl:null};
function setup(full=false){const root=resolve(out,randomUUID());mkdirSync(root);return {root,bundle:executorFixtureV2({full})};}
function request(f,key){return {key,requestId:v2RequestId(f.bundle.spec,key),raw:f.bundle.wires[key].raw};}
async function pipeline(f,options={}){
 const provider=await startSyntheticHttpV2({bundle:f.bundle,allowedRoot:f.root,...options}),context={directory:resolve(f.root,f.bundle.spec.runId),allowedRoot:f.root,spec:f.bundle.spec};createV2Journal(context,f.bundle.approval);
 const executor=openSyntheticExecutorV2({context,seal:f.bundle.seal,observeCurrent:()=>f.bundle.current,readWire:key=>f.bundle.wires[key],transport:r=>provider.send(r)});
 try{const result=await executor.collect(),before=provider.inspect().events.filter(e=>e.kind==='client-start').length;await executor.collect();assert.equal(provider.inspect().events.filter(e=>e.kind==='client-start').length,before);return {result,ledger:readV2Journal(context).ledger,info:provider.inspect(),logFile:provider.logFile};}
 finally{executor.release();await provider.stop();}
}

test('frozen pair reaches owned HTTP provider once per UUID;every request has a distinct closed connection and no restart sends',async()=>{
 const f=setup(),v=await pipeline(f);assert.equal(v.result.status,'synthetic-collection-complete');assert.equal(v.info.accepted,2);assert.equal(v.info.sockets,2);assert.equal(v.info.connectionPolicy,'close-every-request');assert.equal(v.ledger.closed,true);
 assert.equal(v.info.events.filter(e=>e.kind==='client-completed').length,2);assert.equal(new Set(v.info.events.filter(e=>e.kind==='server-accepted').map(e=>e.requestId)).size,2);
 const raw=readFileSync(v.logFile,'utf8');assert.doesNotMatch(raw,/The synthetic fixture|Bearer|SYNTHETIC_PRIVATE|payloadRaw|instructions/);
});

test('actual socket disconnect before acceptance yields finite native error,generation transport stage and consumed maximum;no automatic resend',async()=>{
 const f=setup(),v=await pipeline(f,{testFault:stage=>stage==='server-before-accept'?'disconnect':null});assert.equal(v.result.status,'held');assert.equal(v.result.results[0].diagnostic.stage,'generation_transport');assert.equal(v.result.results[0].diagnostic.slotRetry,'never-resend');assert.equal(v.info.accepted,0);
 const key=slotKey(f.bundle.spec.batches[0].requests[0]);assert.equal(v.ledger.slots[key].state,'consumed');assert.equal(v.result.balance.upperMicros,costUpperMicros(f.bundle.spec,f.bundle.spec.batches[0].requests[0]));const failed=v.info.events.find(e=>e.kind==='client-failed');assert.equal(failed.failureCode,'NETWORK');assert.ok(['UND_ERR_SOCKET','ECONNRESET','EPIPE'].includes(failed.nativeCode));observations.failures.push({kind:'generation-disconnect',stage:v.result.results[0].diagnostic.stage,nativeCode:failed.nativeCode,accepted:0,retry:0});
});

test('actual judge disconnect keeps captured parent and judge maximum;known owned boundary is judge transport,not unknown',async()=>{
 const f=setup(),judge=slotKey(f.bundle.spec.batches[0].requests[1]),v=await pipeline(f,{testFault:(stage,info)=>stage==='server-before-accept'&&info.keyHash===digest(judge)?'disconnect':null});assert.equal(v.result.status,'held');assert.equal(v.result.results.at(-1).diagnostic.stage,'judge_transport');assert.equal(v.info.accepted,1);assert.equal(v.ledger.slots[judge].state,'consumed');assert.equal(Object.keys(v.ledger.results).length,1);observations.failures.push({kind:'judge-disconnect',stage:'judge_transport',accepted:1,retry:0});
});

test('nonJSON response and explicit HTTP503 have distinct finite format/status diagnostics with no raw body or error text',async()=>{
 for(const kind of ['non-json','status503']){
  const f=setup(),v=await pipeline(f,{testFault:stage=>kind==='non-json'&&stage==='server-response'?'non-json':kind==='status503'&&stage==='server-before-accept'?'status503':null});assert.equal(v.result.status,'held');const failed=v.info.events.find(e=>e.kind==='client-failed');assert.equal(failed.failureCode,kind==='non-json'?'BODY_JSON':'HTTP_STATUS');assert.equal(failed.status,kind==='non-json'?200:503);assert.equal(v.result.results[0].diagnostic.stage,kind==='non-json'?'generation_format':'generation_transport');observations.failures.push({kind,stage:v.result.results[0].diagnostic.stage,failureCode:failed.failureCode,status:failed.status});
 }
});

test('foreign raw body and duplicate UUID are rejected with finite identifiers;private sentinel never enters diagnostics',async()=>{
 const f=setup(),provider=await startSyntheticHttpV2({bundle:f.bundle,allowedRoot:f.root}),key=slotKey(f.bundle.spec.batches[0].requests[0]),args=request(f,key);
 try{
  await assert.rejects(provider.send({...args,raw:'{"private":"SYNTHETIC_PRIVATE_DO_NOT_PRINT"}'}));assert.equal(provider.inspect().accepted,0);assert.equal(provider.inspect().events.find(e=>e.kind==='server-rejected').failureCode,'BODY');
  await provider.send(args);await assert.rejects(provider.send(args));assert.equal(provider.inspect().accepted,1);assert.ok(provider.inspect().events.some(e=>e.kind==='server-rejected'&&e.failureCode==='DUPLICATE'));assert.doesNotMatch(readFileSync(provider.logFile,'utf8'),/SYNTHETIC_PRIVATE|private|instructions/);
 }finally{await provider.stop();}
});

test('otherwise valid evaluation mode refuses before a listener or diagnostic file;only explicit synthetic fixture is accepted',async()=>{
 const f=setup(),before=readdirSync(f.root);f.bundle.spec.mode='evaluation';f.bundle.spec.quote.kind='verified-price';await assert.rejects(startSyntheticHttpV2({bundle:f.bundle,allowedRoot:f.root}));assert.deepEqual(readdirSync(f.root),before);
});

test('actual reused-socket disconnect contrast:keepalive control fails,close-each-request prevents socket reuse and accepts every unique request',async()=>{
 const results=[];
 for(const testKeepAlive of [true,false]){
  const f=setup(true),provider=await startSyntheticHttpV2({bundle:f.bundle,allowedRoot:f.root,testKeepAlive,testFault:stage=>stage==='server-before-accept'?'disconnect-reuse':null}),keys=f.bundle.spec.batches.slice(0,12).map(b=>slotKey(b.requests[0]));let failed=0;
  try{for(const key of keys){await new Promise(setImmediate);try{await provider.send(request(f,key));}catch{failed++;}}const info=provider.inspect();results.push({testKeepAlive,requests:keys.length,accepted:info.accepted,failed,sockets:info.sockets,reusedSocketFailures:info.events.filter(e=>e.failureCode==='REUSED_SOCKET_DISCONNECT').length});}
  finally{await provider.stop();}
 }
 assert.ok(results[0].reusedSocketFailures>0);assert.ok(results[0].failed>0);assert.equal(results[1].reusedSocketFailures,0);assert.equal(results[1].failed,0);assert.equal(results[1].accepted,12);assert.equal(results[1].sockets,12);observations.connectionControl={results,oldPhase17RootCauseEstablished:false,scope:'Controlled actual socket-reuse failure only;original failure lacked native diagnostics and remains unknown.'};
});

test.after(()=>writeFileSync(resolve(out,'synthetic-http-observations.json'),JSON.stringify(observations,null,2)+'\n'));
