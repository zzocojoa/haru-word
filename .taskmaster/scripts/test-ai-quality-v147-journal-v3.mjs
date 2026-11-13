import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync,utimesSync,linkSync,symlinkSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3BudgetFixture,v3SyntheticApproval,v3SyntheticBinding,v3SyntheticResult} from './ai-quality-v147-budget-v3-fixture.mjs';
import {createV3Journal,readV3Journal,readV3CommittedPrefix,openV3Journal,inspectV3Pending} from './ai-quality-v147-journal-v3.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),OUT=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(OUT,{recursive:false});
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex'),snapshot=dir=>Object.fromEntries(readdirSync(dir).sort().map(n=>[n,sha(resolve(dir,n))]));
function scenario(name,options={}){const root=resolve(OUT,name);mkdirSync(root);const spec=v3BudgetFixture({stage:'reference-preparation',...options}),kernel=compileBudgetV3(spec),approval=v3SyntheticApproval(kernel),context={allowedRoot:root,directory:resolve(root,'v3-'+spec.runId),spec};createV3Journal(context,approval);const file=resolve(root,'context.json');writeFileSync(file,JSON.stringify({context,approval}));return {root,spec,kernel,approval,context,file};}
function reserveAndBind(c,s){const d=c.spec.requests[0];s.append([{kind:'reserve',groupId:c.kernel.groupIds[0]},{kind:'bind',key:d.key,binding:v3SyntheticBinding(c.kernel,s.current().ledger,d.key)}]);return d.key;}
function child(command,file,stage){
 const env={};for(const k of ['Path','PATH','PATHEXT','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC'])if(process.env[k]!==undefined)env[k]=process.env[k];
 const args=[resolve(SOURCE,'.taskmaster/scripts/ai-quality-v147-journal-v3-child.mjs'),command,file,...stage?[stage]:[]],cp=spawn(process.execPath,args,{cwd:SOURCE,env,windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='',notify;
 const first=new Promise(res=>notify=res);cp.stdout.on('data',b=>{output+=b.toString();if(output.includes('\n'))notify(JSON.parse(output.slice(0,output.indexOf('\n'))));});cp.stderr.on('data',b=>error+=b.toString());
 const done=new Promise((yes,no)=>{const timer=setTimeout(()=>{cp.kill();no(Error('CHILD_TIMEOUT'));},45000);cp.once('error',no);cp.once('exit',exitCode=>{clearTimeout(timer);yes({exitCode,output,error});});});return {cp,first,done};
}
const observations={actualProviderCalls:0,actualKeyReads:0,syntheticOnly:true,durableAppendReplayImplemented:true,explicitRecoveryImplemented:false,physicalCaptureImplemented:false,liveDispatchSupported:false,powerLossDurabilityMeasured:false,processExits:[]};
test('create/open/append/audit/reopen preserves exact frozen state and exclusive namespace',()=>{
 const c=scenario('ordinary'),s=openV3Journal(c.context);reserveAndBind(c,s);const before=s.current();assert.equal(before.ledger.sequence,2);assert.equal(before.head.index,1);assert.equal(before.account.slots,3);assert.ok(Object.isFrozen(before.ledger));assert.equal(s.audit().account.slots,3);s.close();const reopened=openV3Journal(c.context);assert.equal(digest(reopened.current().ledger),digest(before.ledger));reopened.append({kind:'close'});reopened.close();assert.equal(readV3Journal(c.context).ledger.closed,true);assert.throws(()=>createV3Journal(c.context,c.approval),e=>e.code==='EEXIST');
});
test('a clean restart cannot consume an already-consumed request or reset a closed ledger',()=>{
 const c=scenario('consumed'),a=openV3Journal(c.context),key=reserveAndBind(c,a);a.append({kind:'consume',key});a.close();const before=snapshot(c.context.directory),b=openV3Journal(c.context);assert.equal(b.current().ledger.slots[key].state,'consumed');assert.throws(()=>b.append({kind:'consume',key}),e=>e.failureCode==='P3_UNSENT_BOUND_SLOT');b.abandon();assert.equal(sha(resolve(c.context.directory,'CHAIN.jsonl')),before['CHAIN.jsonl']);assert.equal(sha(resolve(c.context.directory,'HEAD.json')),before['HEAD.json']);
 const d=openV3Journal(c.context);d.append({kind:'close'});d.close();const e=openV3Journal(c.context);assert.throws(()=>e.append({kind:'consume',key}),x=>x.failureCode==='P3_DISPATCH_HELD');e.abandon();
});
test('invalid operation batches poison the in-memory session without committing partial operations',()=>{
 const c=scenario('invalid-batch'),s=openV3Journal(c.context),before=snapshot(c.context.directory);assert.throws(()=>s.append([{kind:'reserve',groupId:c.kernel.groupIds[0]},{kind:'consume',key:'missing'}]),e=>e.failureCode==='P3_UNSENT_BOUND_SLOT');assert.throws(()=>s.current(),/J3_SESSION_HELD/);s.abandon();const after=snapshot(c.context.directory);assert.equal(after['CHAIN.jsonl'],before['CHAIN.jsonl']);assert.equal(after['HEAD.json'],before['HEAD.json']);assert.equal(readV3Journal(c.context).ledger.sequence,0);
});
test('two actual child processes race for one lease;only one owns it',async()=>{
 const c=scenario('race'),children=[child('lease',c.file),child('lease',c.file)],ready=await Promise.all(children.map(x=>x.first));assert.equal(ready.filter(x=>x.ownedReady).length,1);assert.equal(ready.filter(x=>x.code==='J3_LEASE_REFUSED').length,1);children[ready.findIndex(x=>x.ownedReady)].cp.stdin.end('release\n');const done=await Promise.all(children.map(x=>x.done));assert.deepEqual(done.map(x=>x.exitCode).sort((a,b)=>a-b),[0,75]);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),false);observations.leaseRace={owners:1,refused:1,exitCodes:done.map(x=>x.exitCode)};
});
test('ten actual process exits preserve pending bytes and never auto-recover/reopen',async()=>{
 const stages=['pending:before-fsync','pending:after-fsync','log:before-fsync','log:after-fsync','head:before-fsync','head:after-fsync','head:before-rename','head:after-rename','pending:before-unlink','pending:after-unlink'];
 for(const stage of stages){const c=scenario('crash-'+stage.replaceAll(':','-')),cp=child('crash',c.file,stage),done=await cp.done;assert.equal(done.exitCode,83,done.output+done.error);const before=snapshot(c.context.directory);assert.throws(()=>openV3Journal(c.context),e=>e.code==='EEXIST');assert.deepEqual(snapshot(c.context.directory),before);const prefix=readV3CommittedPrefix(c.context),inspection=inspectV3Pending(c.context);assert.equal(inspection.recoveryImplemented,false);assert.equal(inspection.noDispatchPerformed,true);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),true);
  if(stage==='pending:after-unlink'){assert.equal(inspection.pending,false);assert.equal(prefix.account.consumedSlots,1);}else{assert.equal(inspection.pending,true);assert.equal(inspection.proposedConsumedSlots,1);}
  observations.processExits.push({stage,exitCode:done.exitCode,rawDirectory:c.context.directory,rawFilesSha256:before,pending:inspection.pending,logState:inspection.logState??'committed-clean',headState:inspection.headState??'committed',committedConsumed:prefix.account.consumedSlots,recoveryImplemented:false,refusedOpenPreservedAllBytes:true});
 }
});
test('same-length log mutation with restored mtime is detected from full bytes',()=>{
 const c=scenario('log-tamper'),s=openV3Journal(c.context);reserveAndBind(c,s);const file=resolve(c.context.directory,'CHAIN.jsonl'),before=readFileSync(file),times=statSync(file),text=before.toString('utf8');assert.ok(text.includes('"kind":"reserve"'));const changed=text.replace('"kind":"reserve"','"kind":"reserVe"');assert.equal(Buffer.byteLength(changed),before.length);writeFileSync(resolve(c.root,'before-log.jsonl'),before);writeFileSync(file,changed);utimesSync(file,times.atime,times.mtime);assert.throws(()=>s.current(),/J3_LOG_CHANGED/);s.abandon();assert.throws(()=>readV3Journal(c.context),/J3_PREFIX_HASH/);
});
test('uncommitted suffix and foreign files are held without truncation or deletion',()=>{
 const c=scenario('suffix');const file=resolve(c.context.directory,'CHAIN.jsonl'),before=readFileSync(file);writeFileSync(file,Buffer.concat([before,Buffer.from('{"uncommitted":true}\n')]));assert.throws(()=>readV3Journal(c.context),/J3_PREPARED_OR_FOREIGN/);assert.ok(readV3CommittedPrefix(c.context).uncommittedBytes>0);assert.ok(readFileSync(file).length>before.length);
 const d=scenario('foreign');writeFileSync(resolve(d.context.directory,'unknown.json'),'{}');assert.throws(()=>openV3Journal(d.context),/J3_PREPARED_OR_FOREIGN/);assert.equal(existsSync(resolve(d.context.directory,'unknown.json')),true);
});
test('partial appended bytes and malformed pending JSON stay held without repair',()=>{
 const c=scenario('partial-prepared'),s=openV3Journal(c.context),key=reserveAndBind(c,s);assert.throws(()=>s.append({kind:'consume',key},point=>{if(point==='log:after-fsync')throw Error('controlled local interruption');}),/J3_APPEND_HELD/);s.abandon();const file=resolve(c.context.directory,'CHAIN.jsonl'),pending=JSON.parse(readFileSync(resolve(c.context.directory,'PENDING.json'),'utf8')),full=readFileSync(file);writeFileSync(resolve(c.root,'complete-prepared-log.jsonl'),full);writeFileSync(file,full.subarray(0,pending.from.logBytes+Math.floor(pending.lineBytes/2)));const before=snapshot(c.context.directory),partial=inspectV3Pending(c.context);assert.equal(partial.logState,'partial');assert.equal(partial.proposedConsumedSlots,1);assert.equal(partial.recoveryImplemented,false);assert.throws(()=>readV3Journal(c.context),/J3_PREPARED_OR_FOREIGN/);assert.deepEqual(snapshot(c.context.directory),before);
 const d=scenario('malformed-pending'),other=openV3Journal(d.context),k=reserveAndBind(d,other);assert.throws(()=>other.append({kind:'consume',key:k},point=>{if(point==='pending:after-fsync')throw Error('controlled local interruption');}),/J3_APPEND_HELD/);other.abandon();const p=resolve(d.context.directory,'PENDING.json');writeFileSync(resolve(d.root,'complete-pending.json'),readFileSync(p));writeFileSync(p,'{');const bad=snapshot(d.context.directory);assert.throws(()=>inspectV3Pending(d.context),/J3_JSON/);assert.deepEqual(snapshot(d.context.directory),bad);observations.partialAndMalformedPreparedBytesHeld=true;
});
test('rehashing an altered state proof does not bypass deterministic replay validation',()=>{
 const c=scenario('rehashed-state'),s=openV3Journal(c.context);reserveAndBind(c,s);s.close();const file=resolve(c.context.directory,'CHAIN.jsonl'),headFile=resolve(c.context.directory,'HEAD.json'),original=readFileSync(file),lines=original.toString('utf8').trimEnd().split('\n').map(x=>JSON.parse(x));writeFileSync(resolve(c.root,'original-log.jsonl'),original);writeFileSync(resolve(c.root,'original-head.json'),readFileSync(headFile));lines.at(-1).stateProof.accountHash=digest('altered-state-proof');const changed=Buffer.from(lines.map(x=>JSON.stringify(x)).join('\n')+'\n'),head=JSON.parse(readFileSync(headFile,'utf8'));head.logBytes=changed.length;head.logSha256=createHash('sha256').update(changed).digest('hex');head.recordHash=digest(lines.at(-1));writeFileSync(file,changed);writeFileSync(headFile,JSON.stringify(head)+'\n');assert.throws(()=>readV3Journal(c.context),/J3_STATE_REPLAY/);observations.rehashedStateProofRejected=true;
});
test('interrupted creation is preserved and never overwritten by a second create',()=>{
 const root=resolve(OUT,'interrupted-create');mkdirSync(root);const spec=v3BudgetFixture({stage:'reference-preparation'}),kernel=compileBudgetV3(spec),approval=v3SyntheticApproval(kernel),context={allowedRoot:root,directory:resolve(root,'v3-'+spec.runId),spec};assert.throws(()=>createV3Journal(context,approval,point=>{if(point==='create-log:after-fsync')throw Error('controlled creation interruption');}),/controlled creation interruption/);const before=snapshot(context.directory);assert.throws(()=>createV3Journal(context,approval),e=>e.code==='EEXIST');assert.deepEqual(snapshot(context.directory),before);assert.throws(()=>readV3Journal(context),e=>e.code==='ENOENT');observations.interruptedCreationHeld=true;
});
test('hardlinked committed files and linked roots are refused',()=>{
 const c=scenario('hardlink');linkSync(resolve(c.context.directory,'HEAD.json'),resolve(c.root,'head-link.json'));assert.throws(()=>readV3Journal(c.context),/J3_NONREGULAR/);
 const d=scenario('root-link'),alias=resolve(OUT,'linked-root');symlinkSync(d.root,alias,process.platform==='win32'?'junction':'dir');assert.throws(()=>readV3Journal({...d.context,allowedRoot:alias,directory:resolve(alias,'v3-'+d.spec.runId)}),/J3_ROOT_LINK/);
});
test('a changed lease is never removed or treated as owned',()=>{
 const c=scenario('changed-lease'),s=openV3Journal(c.context),file=resolve(c.context.directory,'LOCK.json'),changed=JSON.parse(readFileSync(file,'utf8'));changed.nonce='00000000-0000-0000-0000-000000000000';writeFileSync(file,JSON.stringify(changed));assert.throws(()=>s.current(),/J3_OWNER_CHANGED/);assert.throws(()=>s.abandon(),/J3_OWNER_CHANGED/);assert.equal(existsSync(file),true);
});
test('real Windows sharing denial leaves a complete prepared commit held',async()=>{
 if(process.platform!=='win32'){observations.windowsSharingDenial='not-run-nonwindows';return;}
 const c=scenario('actual-eperm'),s=openV3Journal(c.context),key=reserveAndBind(c,s),file=resolve(c.context.directory,'HEAD.json'),script="$ErrorActionPreference='Stop';$f=[IO.File]::Open('"+file.replaceAll("'","''")+"',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);try{[Console]::Out.WriteLine('owned');[Console]::Out.Flush();[Console]::In.ReadLine()|Out-Null}finally{$f.Dispose()}";
 const helper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';await new Promise((yes,no)=>{helper.once('error',no);helper.stdout.on('data',b=>{out+=b.toString();if(out.includes('owned'))yes();});});const exited=new Promise((yes,no)=>{helper.once('error',no);helper.once('exit',yes);});let caught;
 try{assert.throws(()=>s.append({kind:'consume',key}),e=>{caught=e;return e.message==='J3_APPEND_HELD'&&e.failureStage==='head'&&['EPERM','EACCES'].includes(e.nativeCode);});assert.throws(()=>s.current(),/J3_SESSION_HELD/);}finally{helper.stdin.end('release\n');assert.equal(await exited,0);}
 const inspected=inspectV3Pending(c.context);assert.equal(inspected.logState,'complete');assert.equal(inspected.headState,'previous');assert.equal(inspected.proposedConsumedSlots,1);s.abandon();assert.throws(()=>readV3Journal(c.context),/J3_PREPARED_OR_FOREIGN/);observations.actualWindowsRenameError=caught.nativeCode;
});
test('v2 and evaluation specs are rejected before creating a new store',()=>{
 const c=scenario('protocol-control'),legacy=structuredClone(c.context);legacy.spec.protocol='ai-quality-v147-pilot-v2';assert.throws(()=>readV3Journal(legacy),/P3_SPEC_IDENTITY/);const evaluation=structuredClone(c.context);evaluation.spec.mode='evaluation';evaluation.spec.quote.kind='verified-price';assert.throws(()=>openV3Journal(evaluation),/J3_SYNTHETIC_ONLY/);
});
test('full180/1872 staged journals persist,replay and close2052 synthetic slots',()=>{
 const reports=[];for(const stage of ['reference-preparation','pilot-panel']){
  const c=scenario('full-'+stage,{stage,caseCount:60}),k=compileBudgetV3(c.spec);let state=k.newLedger(c.approval);const operations=[];
  const op=x=>{state=k.transition(state,x);operations.push(x);};for(const groupId of k.groupIds)op({kind:'reserve',groupId});for(const key of c.spec.order){op({kind:'bind',key,binding:v3SyntheticBinding(k,state,key)});op({kind:'consume',key});op({kind:'settle',key,result:v3SyntheticResult(k,state,key)});}op({kind:'close'});
  const s=openV3Journal(c.context);for(let i=0;i<operations.length;i+=64)s.append(operations.slice(i,i+64));assert.equal(digest(s.audit().ledger),digest(state));s.close();const final=readV3Journal(c.context);assert.equal(digest(final.ledger),digest(state));assert.equal(final.ledger.closed,true);assert.equal(final.account.slots,c.spec.requests.length);assert.equal(final.account.realDispatchAuthorized,false);assert.equal(final.physicalCaptureValidated,false);reports.push({stage,slots:final.account.slots,stateSequence:final.ledger.sequence,commitIndex:final.head.index,closed:true,stateHash:digest(state),directory:c.context.directory,headSha256:sha(resolve(c.context.directory,'HEAD.json')),chainSha256:sha(resolve(c.context.directory,'CHAIN.jsonl')),batchMaximumOperations:64});
 }
 assert.equal(reports.reduce((n,x)=>n+x.slots,0),2052);observations.fullStages=reports;
});
test.after(()=>writeFileSync(resolve(OUT,'journal-v3-observations.json'),JSON.stringify(observations,null,2)+'\n'));
