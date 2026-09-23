import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { localBase, account, accountHeaders, closeBrowser }=createRequire(import.meta.url)('./qa/runtime.cjs');
const { runCase }=createRequire(import.meta.url)('./qa/process.cjs');
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('browser QA accepts only loopback origins before test account headers can be sent',()=>{
 for(const value of ['http://127.0.0.1:8787','http://localhost:9000','http://[::1]:8787'])assert.equal(localBase(value),value);
 for(const value of ['https://example.com','http://localhost.example.com','http://user:pass@localhost','http://127.0.0.1/path','file:///tmp/x'])assert.throws(()=>localBase(value));
});
test('QA accounts are unique across scripts and retain their scenario prefix',()=>{
 assert.notEqual(account('same'),account('same'));
 assert.match(accountHeaders('editor')['oai-authenticated-user-id'],/^editor_/);
});
test('browser cleanup closes all contexts and the browser, including failed context shutdown',async()=>{
 for(const fail of [false,true]){
  const events=[];
  const browser={contexts:()=>[1,2].map(n=>({close:async()=>{events.push(n);if(fail&&n===1)throw Error('close failure')}})),close:async()=>events.push('browser')};
  if(fail)await assert.rejects(closeBrowser(browser),AggregateError);else await closeBrowser(browser);
  assert.deepEqual(events,[1,2,'browser']);
 }
});
test('QA process timeout requests cleanup and retains a failure result even if child exits zero',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'haru-qa-process-'));
 const logPath=path.join(dir,'result.log');
 const result=await runCase(['-e',"process.on('message',m=>{if(m==='qa-stop'){console.log('cleanup');process.exit(0)}})"],{logPath,timeoutMs:300});
 assert.equal(result.timedOut,true);assert.equal(readFileSync(logPath,'utf8').trim(),'cleanup');
 const failed=await runCase(['-e','process.exit(2)'],{logPath:path.join(dir,'failed.log'),timeoutMs:3000});
 assert.deepEqual(failed,{code:2,timedOut:false});
});
test('interrupting a QA process is reported so the runner stops without running remaining cases',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'haru-qa-interrupt-'));
 const pending=runCase(['-e',"process.on('message',()=>process.exit(0))"],{logPath:path.join(dir,'result.log'),timeoutMs:3000});
 const timer=setTimeout(()=>process.emit('SIGINT'),300);
 try{assert.deepEqual(await pending,{code:130,timedOut:false,interrupted:true});}finally{clearTimeout(timer);}
});
