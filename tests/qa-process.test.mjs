import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {runCase}=createRequire(import.meta.url)('./qa/process.cjs');
const {acquireLock}=createRequire(import.meta.url)('./qa/lock.cjs');
const live=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
test('QA lock rejects live owners and never removes a replacement owner',()=>{
  const dir=mkdtempSync(join(tmpdir(),'haru-qa-lock-')),file=join(dir,'qa.lock');
  const release=acquireLock(file);
  assert.throws(()=>acquireLock(file),/Another browser suite/);assert.equal(readFileSync(file,'utf8'),String(process.pid));
  writeFileSync(file,'invalid-replacement');assert.throws(release,/ownership changed/);assert.equal(readFileSync(file,'utf8'),'invalid-replacement');
  writeFileSync(file,String(process.pid));release();assert.equal(existsSync(file),false);
  writeFileSync(file,'0');assert.throws(()=>acquireLock(file),/Invalid QA lock/);assert.equal(readFileSync(file,'utf8'),'0');
});
test('QA subprocess keeps real failures nonzero and cleans only its own timed-out tree',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'haru-qa-process-')),file=join(dir,'case.cjs'),pidFile=join(dir,'child.pid');
  writeFileSync(file,"throw Error('intentional regression');");
  const failed=await runCase([file],{logPath:join(dir,'failure.log'),timeoutMs:10000});
  assert.equal(failed.code,1);assert.equal(failed.timedOut,false);assert.match(readFileSync(join(dir,'failure.log'),'utf8'),/intentional regression/);
  writeFileSync(file,`const {spawn}=require('node:child_process'),fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidFile)},String(child.pid));setInterval(()=>{},1000);`);
  const timed=await runCase([file],{logPath:join(dir,'timeout.log'),timeoutMs:1200,graceMs:100});
  assert.equal(timed.timedOut,true);assert.notEqual(timed.code,0);
  const until=Date.now()+5000;while(live(Number(readFileSync(pidFile,'utf8')))&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(live(Number(readFileSync(pidFile,'utf8'))),false);assert.equal(live(process.pid),true);
});
for(const [signal,delegated]of [['SIGINT',false],['SIGTERM',false],['SIGTERM',true]])test('QA '+signal+(delegated?' suite abort':'')+' interruption waits for child cleanup and preserves its exit code',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'haru-qa-interrupt-')),file=join(dir,'case.cjs'),marker=join(dir,'closed');
  writeFileSync(file,`process.on('message',m=>{if(m==='qa-stop'){require('node:fs').writeFileSync(${JSON.stringify(marker)},'closed');process.exit(124);}});setInterval(()=>{},1000);`);
  const controller=new AbortController();
  const run=runCase([file],{logPath:join(dir,'interrupt.log'),timeoutMs:10000,...(delegated?{signal:controller.signal}:{})});
  const timer=setTimeout(()=>{if(delegated)controller.abort({signal});else{process.emit(signal);process.emit(signal);}},700);
  try{const stopped=await run;assert.equal(stopped.code,signal==='SIGINT'?130:143);assert.equal(stopped.signal,signal);assert.equal(stopped.interrupted,true);assert.equal(stopped.timedOut,false);assert.equal(readFileSync(marker,'utf8'),'closed');}
  finally{clearTimeout(timer);}
});
