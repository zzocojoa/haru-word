import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {executorFixtureV2} from './ai-quality-v147-executor-fixture-v2.mjs';
import {openSyntheticExecutorV2} from './ai-quality-v147-executor-v2.mjs';
import {createV2Journal,readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {inspectV2Recovery,recoverV2Journal} from './ai-quality-v147-recovery-v2.mjs';
import {slotKey,accountV2,costUpperMicros,digest} from './ai-quality-v147-budget-v2.mjs';
import {reportSyntheticJournalV2} from './ai-quality-v147-journal-report-v2.mjs';

const here=dirname(fileURLToPath(import.meta.url)),out=resolve(process.env.QA_OUTPUT_DIR??resolve(here,'../../work/executor-v2-'+randomUUID()));mkdirSync(out,{recursive:true});
const observations={actualProviderCalls:0,actualKeyReads:0,actualPaidApprovalUsd:0,task22Complete:false,fullWorkerIntegrated:false,full756CollectionExecuted:false,pairs:[],faults:[],cli:[],processExits:[]};
function setup(options){const bundle=executorFixtureV2(options),context={directory:resolve(out,bundle.spec.runId),allowedRoot:out,spec:bundle.spec};createV2Journal(context,bundle.approval);return {bundle,context,calls:[]};}
function open(f,extra={}){return openSyntheticExecutorV2({context:f.context,seal:f.bundle.seal,observeCurrent:()=>f.bundle.current,readWire:key=>f.bundle.wires[key],transport:async request=>{
 const ledger=readV2Journal(f.context).ledger;assert.equal(ledger.slots[request.key].state,'consumed');assert.equal(ledger.slots[request.key].requestId,request.requestId);assert.equal(ledger.bindings[request.key].bodyDigest,digest(JSON.parse(request.raw)));
 const policy=f.bundle.spec.wirePolicies[request.key];if(policy.parentKey)assert.deepEqual(JSON.parse(JSON.parse(request.raw).input[0].content).feedback,JSON.parse(f.bundle.responses[policy.parentKey].payloadRaw));
 f.calls.push({key:request.key,requestId:request.requestId});return structuredClone(f.bundle.responses[request.key]);},...extra});}
async function collect(f,extra){const e=open(f,extra);try{return await e.collect();}finally{e.release();}}
function child(bundleFile,root,stage){const cp=spawn(process.execPath,[resolve(here,'ai-quality-v147-executor-cli-v2.mjs'),'--synthetic',bundleFile,root,...(stage?[stage]:[])],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';cp.stdout.on('data',x=>stdout+=x.toString());cp.stderr.on('data',x=>stderr+=x.toString());
 const done=new Promise((res,rej)=>{const timer=setTimeout(()=>{cp.kill();rej(Error('V2E_CLI_TIMEOUT'));},120000);cp.once('error',rej);cp.once('exit',exitCode=>{clearTimeout(timer);res({exitCode,stdout,stderr});});});return {cp,done,output:()=>stdout};}
function bundleFile(bundle){const file=resolve(out,bundle.spec.runId+'-bundle.json');writeFileSync(file,JSON.stringify(bundle),{flag:'wx'});return file;}
function sends(bundle){const file=resolve(out,bundle.spec.runId+'-v2-provider.jsonl');return existsSync(file)?readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];}

test('whole pair reserve→frozen bind→durable consume→transport→capture→derived judge→close;repeat collection sends0',async()=>{
 const f=setup(),first=await collect(f);assert.equal(first.status,'synthetic-collection-complete');assert.equal(first.closed,true);assert.deepEqual(first.counts,{completed:2});assert.equal(f.calls.length,2);assert.equal(new Set(f.calls.map(c=>c.requestId)).size,2);
 const ledger=readV2Journal(f.context).ledger;assert.equal(Object.keys(ledger.bindings).length,2);assert.equal(Object.keys(ledger.results).length,2);const second=await collect(f);assert.equal(second.status,first.status);assert.equal(f.calls.length,2);assert.equal(existsSync(resolve(f.context.directory,'LOCK.json')),false);observations.pairs.push({runId:f.bundle.spec.runId,sends:2,repeatAdded:0,closed:true});
});

test('approval0,frozen source/price drift and actual runtime mismatch refuse before a transport callback or executor lease',()=>{
 const f=setup();f.bundle.current.components.quote=digest('changed price');assert.throws(()=>open(f),/FREEZE_CONDITIONS_CHANGED/);assert.equal(f.calls.length,0);assert.equal(existsSync(resolve(f.context.directory,'LOCK.json')),false);
 const runtime=setup({nodeVersion:'v24.0.0'});assert.throws(()=>open(runtime),/V2E_ACTUAL_RUNTIME/);assert.equal(existsSync(resolve(runtime.context.directory,'LOCK.json')),false);
 const bundle=executorFixtureV2();bundle.approval={...bundle.approval,kind:'unapproved',amountMicros:'0',evidenceHash:null};const context={directory:resolve(out,bundle.spec.runId),allowedRoot:out,spec:bundle.spec};createV2Journal(context,bundle.approval);assert.throws(()=>open({bundle,context,calls:[]}),/V2E_UNAPPROVED/);assert.equal(existsSync(resolve(context.directory,'LOCK.json')),false);
});

test('changed exact input after binding or after consume refuses before transport;consumed maximum remains after close',async()=>{
 for(const stage of ['executor:after-binding','executor:after-consume-before-transport']){
  const f=setup(),key=slotKey(f.bundle.spec.batches[0].requests[0]);const result=await collect(f,{testFault:point=>{if(point===stage)f.bundle.wires[key].raw+=' ';}});assert.equal(result.status,'held');assert.equal(f.calls.length,0);const ledger=readV2Journal(f.context).ledger;
  assert.equal(ledger.closed,true);assert.equal(ledger.slots[key].state,stage.includes('after-consume')?'consumed':'unused');if(stage.includes('after-consume'))assert.equal(accountV2(f.bundle.spec,ledger).upperMicros,costUpperMicros(f.bundle.spec,f.bundle.spec.batches[0].requests[0]));observations.faults.push({stage,sends:0,retained:ledger.slots[key].state});
 }
});

test('ambiguous transport failure closes unsent work,retains consumed maximum and restart cannot resend',async()=>{
 const f=setup();let calls=0;const first=await collect(f,{transport:async()=>{calls++;throw new Error('SYNTHETIC_PRIVATE_DO_NOT_PRINT');}});assert.equal(first.status,'held');assert.equal(first.results[0].diagnostic.networkCalls,null);assert.doesNotMatch(JSON.stringify(first),/SYNTHETIC_PRIVATE/);const key=slotKey(f.bundle.spec.batches[0].requests[0]),ledger=readV2Journal(f.context).ledger;
 assert.equal(ledger.slots[key].state,'consumed');assert.equal(ledger.closed,true);assert.equal(first.balance.upperMicros,costUpperMicros(f.bundle.spec,f.bundle.spec.batches[0].requests[0]));await collect(f,{transport:async()=>{calls++;}});assert.equal(calls,1);
});

test('foreign model,private extra payload or missing visible capture is held;bounded overspend remains maximum and stops',async()=>{
 for(const kind of ['model','payload','usage']){
  const f=setup(),key=slotKey(f.bundle.spec.batches[0].requests[0]),response=f.bundle.responses[key];if(kind==='model')response.modelId='unknown-model';if(kind==='payload'){const v=JSON.parse(response.payloadRaw);v.private='SYNTHETIC_PRIVATE';response.payloadRaw=JSON.stringify(v);}if(kind==='usage')response.usage.inputTokens=70001;
  const result=await collect(f);assert.equal(result.status,'held');assert.equal(f.calls.length,1);assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_PRIVATE/);assert.equal(result.balance.upperMicros,costUpperMicros(f.bundle.spec,f.bundle.spec.batches[0].requests[0]));if(kind!=='usage')assert.equal(result.results[0].diagnostic.stage,'generation_format');
 }
});

test('actual CLI sends exact loopback bodies2 and closes;second CLI process adds0 and releases its listener/lease',async()=>{
 const bundle=executorFixtureV2(),file=bundleFile(bundle),first=await child(file,out).done;assert.equal(first.exitCode,0,first.stderr);const a=JSON.parse(first.stdout);assert.equal(a.syntheticProviderSendsAdded,2);assert.equal(a.closed,true);
 const second=await child(file,out).done;assert.equal(second.exitCode,0,second.stderr);assert.equal(JSON.parse(second.stdout).syntheticProviderSendsAdded,0);assert.equal(sends(bundle).length,2);assert.equal(existsSync(resolve(out,bundle.spec.runId,'LOCK.json')),false);observations.cli.push({runId:bundle.spec.runId,firstExit:0,secondExit:0,sends:2,restartAdded:0});
});

test('actual CLI exits4 boundaries;explicit journal/capture recovery adds0 sends and preserves the original UUID',async()=>{
 for(const stage of ['executor:after-binding','executor:after-consume-before-transport','executor:after-transport-before-capture','executor:after-capture-before-settle']){
  const bundle=executorFixtureV2(),file=bundleFile(bundle),before=await child(file,out,stage).done;assert.equal(before.exitCode,81,before.stderr);const context={directory:resolve(out,bundle.spec.runId),allowedRoot:out,spec:bundle.spec},rows=sends(bundle),plan=inspectV2Recovery(context);await recoverV2Journal({context,expectedInspectionHash:plan.inspectionHash});
  const key=slotKey(bundle.spec.batches[0].requests[0]),uuid=readV2Journal(context).ledger.slots[key].requestId;let callbackCalls=0;const e=open({bundle,context,calls:[]},{transport:async()=>{callbackCalls++;throw Error('NO_RECOVERY_TRANSPORT');}});
  try{if(stage!=='executor:after-binding'){const result=await e.dispatch(key);assert.equal(result.status,stage==='executor:after-capture-before-settle'?'recovered-capture':'held');assert.equal(result.requestId,uuid);}}finally{e.release();}
  assert.equal(callbackCalls,0);assert.deepEqual(sends(bundle),rows);observations.processExits.push({runId:bundle.spec.runId,stage,exitCode:81,sendsBefore:rows.length,recoveryAdded:0,requestId:uuid});
 }
});

test('two actual CLI processes compete on one fresh run;one completes and exactly one request UUID per slot reaches fake provider',async()=>{
 const bundle=executorFixtureV2();bundle.testOwnedGate=true;const file=bundleFile(bundle),pair=[child(file,out),child(file,out)];
 const ready=pair.map((c,i)=>new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('V2E_RACE_READY_TIMEOUT')),15000);const inspect=()=>{if(c.output().includes('"ownedReady":true')){clearTimeout(timer);c.cp.stdout.off('data',inspect);res(i);}};c.cp.stdout.on('data',inspect);c.done.then(()=>{clearTimeout(timer);rej(Error('V2E_NOT_RACE_OWNER'));});inspect();}));
 const owner=await Promise.any(ready),other=1-owner;assert.equal((await pair[other].done).exitCode,1);pair[owner].cp.stdin.end('continue\n');const results=await Promise.all(pair.map(c=>c.done));assert.equal(results.filter(r=>r.exitCode===0).length,1);assert.equal(results.filter(r=>r.exitCode===1).length,1);const rows=sends(bundle);assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.requestId)).size,2);observations.cliRace={completed:1,refused:1,syntheticProviderSends:2};
});

test('verified full plan with no collected responses keeps360 planned cells and60 per model;changed corpus is refused',()=>{
 const f=setup({full:true}),output=reportSyntheticJournalV2({context:f.context,seal:f.bundle.seal,cases:f.bundle.cases,witnesses:f.bundle.witnesses});assert.equal(output.records.length,360);assert.equal(output.modelQualityMeasured,false);assert.equal(output.releaseVerdict,'held');
 for(const phase of ['baseline','candidate'])for(const model of Object.values(output.report.byPhase[phase])){assert.equal(model.raw.denominator,60);assert.equal(model.raw.unmeasured,60);assert.equal(model.raw.correct,0);assert.equal(model.raw.risk.upper,null);}
 assert.equal(output.calibration.modelCalibrationMeasured,false);assert.equal(output.calibration.thresholdArithmeticSatisfied,false);
 const cases=structuredClone(f.bundle.cases);cases[0].familyId='changed-family';assert.throws(()=>reportSyntheticJournalV2({context:f.context,seal:f.bundle.seal,cases}),/V2JR_CASES_CHANGED/);observations.emptyReport={plannedCells:360,denominatorEach:60,qualityMeasured:false};
});

test('otherwise valid evaluation-mode spec is refused without a journal,provider client or credential callback',()=>{
 const bundle=executorFixtureV2();bundle.spec.mode='evaluation';bundle.spec.quote.kind='verified-price';const context={directory:resolve(out,bundle.spec.runId),allowedRoot:out,spec:bundle.spec};let callbacks=0;
 assert.throws(()=>openSyntheticExecutorV2({context,seal:bundle.seal,observeCurrent:()=>{callbacks++;return bundle.current;},readWire:()=>{callbacks++;},transport:async()=>{callbacks++;}}),/V2E_SYNTHETIC_ONLY/);assert.equal(callbacks,0);assert.equal(existsSync(context.directory),false);
});

test('invalid judge grade is classified as judge format,with consumed maximum retained and no invented filesystem failure',async()=>{
 const f=setup(),judge=slotKey(f.bundle.spec.batches[0].requests[1]);f.bundle.responses[judge].payloadRaw=JSON.stringify({grammar:'made-up-grade'});const result=await collect(f);assert.equal(result.status,'held');assert.equal(f.calls.length,2);assert.equal(result.results.at(-1).diagnostic.stage,'judge_format');assert.equal(result.results.at(-1).diagnostic.category,'format_failure');assert.equal(readV2Journal(f.context).ledger.slots[judge].state,'consumed');
});

test.after(()=>{writeFileSync(resolve(out,'executor-v2-observations.json'),JSON.stringify(observations,null,2)+'\n');});
