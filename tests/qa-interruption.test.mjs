import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createConnection} from 'node:net';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';

const runner=resolve('tests/qa/run.cjs');
const live=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
const listening=port=>new Promise(ok=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();ok(true);});socket.once('error',()=>ok(false));});
const until=async condition=>{const end=Date.now()+10000;while(Date.now()<end){if(await condition())return;await new Promise(ok=>setTimeout(ok,25));}throw Error('Synthetic QA process did not settle');};
function readOwnedMarker(file){
  let value;
  try{value=JSON.parse(readFileSync(file,'utf8'));}
  catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return;throw error;}
  if(!value||![value.pid,value.child,value.port].every(Number.isSafeInteger)||value.pid<=0||value.child<=0||value.port<=0||value.port>65535)return;
  return value;
}

// Real runner/profile/lock, with a synthetic inventory/case, readiness checks,
// and Wrangler replacement that owns an actual loopback process and child.
async function scenario(phase,signal){
    const root=mkdtempSync(join(tmpdir(),'haru-suite-interrupt-'));
    for(const dir of ['work','drizzle','dist/server'])mkdirSync(join(root,dir),{recursive:true});
    writeFileSync(join(root,'dist/server/wrangler.json'),JSON.stringify({main:'index.js',assets:{directory:'../client'}}));
    const preload=join(root,'preload.cjs'),worker=join(root,'worker.cjs'),marker=join(root,'owned.json'),cleanupMarker=join(root,'cleanup-signals');
    writeFileSync(worker,`const net=require('node:net'),fs=require('node:fs'),{spawn}=require('node:child_process');
const port=Number(process.argv[2]),child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
const server=net.createServer();server.listen(port,'127.0.0.1',()=>{const temporary=${JSON.stringify(marker)}+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,JSON.stringify({pid:process.pid,child:child.pid,port}));fs.renameSync(temporary,${JSON.stringify(marker)});});setInterval(()=>{},1000);`);
    writeFileSync(preload,`const Module=require('node:module'),fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const original=Module._load,realSpawn=cp.spawn,realExec=cp.execFileSync,realKill=process.kill.bind(process);let reads=0;
const duringCleanup=()=>{if(${JSON.stringify(signal)}!==undefined){for(const next of [${JSON.stringify(signal)},${JSON.stringify(signal==='SIGINT'?'SIGTERM':'SIGINT')}])if(!process.emit(next))process.exit(99);fs.writeFileSync(${JSON.stringify(cleanupMarker)},'handled');}};
if(process.platform!=='win32')process.kill=(pid,name)=>{if(pid<0&&name==='SIGTERM')duringCleanup();return realKill(pid,name);};
const hold=signal=>new Promise((ok,fail)=>{process.send('ready');if(signal?.aborted)return fail(signal.reason);signal?.addEventListener('abort',()=>fail(signal.reason),{once:true});});
Module._load=function(name,parent,...rest){
 const source=parent?.filename?.replaceAll('\\\\','/');
 if(source?.endsWith('/tests/qa/run.cjs')&&name==='node:fs')return {...fs,readdirSync:()=>['grammar-v4-qa.cjs','ordinary-qa.cjs']};
 if(source?.endsWith('/tests/qa/run.cjs')&&name==='./manifest.cjs')return ['grammar-v4-qa.cjs','ordinary-qa.cjs'];
 if(source?.endsWith('/tests/qa/run.cjs')&&name==='./worker-profile.cjs'&&${JSON.stringify(phase)}==='concurrent-stop'){
  const profile=original.call(this,name,parent,...rest);return {...profile,grammarWorker:async(...args)=>{
   const owned=await profile.grammarWorker(...args),first=owned.stop();if(owned.stop()!==first)throw Error('Concurrent stop did not share its cleanup promise');await first;process.send('ready');return owned;
  }};
 }
 if(source?.includes('/tests/qa/')&&name==='./runtime.cjs')return {localBase:()=> 'http://127.0.0.1:8787',accountHeaders:()=>({}),waitForWorker:async(base,timeout,signal)=>{
  if(base?.includes(':8787')||!base){reads++;if(${JSON.stringify(phase)}==='between-cases'&&reads===3)return hold(signal);return;}
  const markerReady=()=>{try{const m=JSON.parse(fs.readFileSync(${JSON.stringify(marker)},'utf8'));return [m.pid,m.child,m.port].every(Number.isSafeInteger)&&m.pid>0&&m.child>0&&m.port>0&&m.port<=65535;}catch{return false;}};
  while(!markerReady())await new Promise(ok=>setTimeout(ok,10));
  if(${JSON.stringify(phase)}==='profile-start')return hold(signal);
 }};
 if(source?.includes('/tests/qa/')&&name==='./preflight.cjs')return {validateEnvironment:()=>{},requireDisabledAiStatus:async()=>{}};
 if(source?.endsWith('/tests/qa/run.cjs')&&name==='./process.cjs')return {runCase:async()=>({code:0,timedOut:false})};
 if(source?.endsWith('/tests/qa/worker-profile.cjs')&&name==='node:child_process')return {...cp,execFileSync:(file,args,options)=>{if(args.includes('d1'))return;if(file==='taskkill')duringCleanup();return realExec(file,args,options);},spawn:(file,args,options)=>realSpawn(file,[${JSON.stringify(worker)},args[args.indexOf('--port')+1]],options)};
 return original.call(this,name,parent,...rest);
};
process.on('message',message=>{if(message==='interrupt'){if(!process.emit(${JSON.stringify(signal)}))process.exit(${signal==='SIGINT'?130:143});else process.emit(${JSON.stringify(signal)});}});process.channel.unref();`);
    const child=spawn(process.execPath,['--require',preload,runner,'functional'],{cwd:root,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
    let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
    const exited=new Promise(ok=>child.once('close',code=>ok(code)));
    let owned,primary;
    try{
      await new Promise((ok,fail)=>{child.once('message',ok);child.once('error',fail);child.once('exit',code=>fail(Error('Runner exited before preparation: '+code+' '+output)));});
      await until(()=>readOwnedMarker(marker));owned=readOwnedMarker(marker);assert.equal(await listening(owned.port),phase!=='concurrent-stop');
      if(signal)child.send('interrupt');assert.equal(await exited,signal?(signal==='SIGINT'?130:143):0,output);
      await until(()=>!live(owned.pid)&&!live(owned.child));
      assert.equal(await listening(owned.port),false);assert.equal(existsSync(join(root,'work/browser-qa.lock')),false);
      if(signal)assert.equal(readFileSync(cleanupMarker,'utf8'),'handled','same and different signals remain handled during cleanup');
      assert.equal(live(process.pid),true,'cleanup must not terminate the test process');
    }catch(error){primary=error;throw error;}
    finally{
     try{
      if(child.exitCode===null){child.kill('SIGTERM');await exited;}
      owned ||= readOwnedMarker(marker);
      if(owned){
        if(live(owned.pid)){if(process.platform==='win32')execFileSync('taskkill',['/PID',String(owned.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else process.kill(-owned.pid,'SIGKILL');}
      }
     }catch(error){if(!primary)throw error;console.error('Synthetic interruption cleanup also failed; preserving the first failure.');}
    }
}
test('TEST-3: marker readiness requires complete validated JSON; partial or malformed data never masks the primary failure',()=>{
 const root=mkdtempSync(join(tmpdir(),'haru-owned-marker-')),file=join(root,'owned.json');
 assert.equal(readOwnedMarker(file),undefined);
 for(const raw of ['', '{"pid":', '{"pid":1}', '{"pid":0,"child":2,"port":1234}', '{"pid":1,"child":2,"port":99999}']){writeFileSync(file,raw);assert.equal(readOwnedMarker(file),undefined);}
 const valid={pid:1,child:2,port:1234};writeFileSync(file,JSON.stringify(valid));assert.deepEqual(readOwnedMarker(file),valid);
 const primary=Error('primary synthetic failure');writeFileSync(file,'{');
 assert.throws(()=>{try{throw primary;}finally{readOwnedMarker(file);}},error=>error===primary);
});
for(const phase of ['profile-start','between-cases'])for(const signal of ['SIGINT','SIGTERM']){
  test(`suite ${signal} during ${phase} closes its owned Worker and lock`,()=>scenario(phase,signal));
}
test('concurrent profile stop waits once and later suite cleanup remains safe',()=>scenario('concurrent-stop'));

test('Worker readiness abort cancels an in-flight loopback request',async()=>{
  const {waitForWorker}=createRequire(import.meta.url)('./qa/runtime.cjs');
  let arrived;
  const requested=new Promise(ok=>arrived=ok),server=createServer(()=>arrived());
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const controller=new AbortController(),reason=Error('synthetic preparation interruption');
  try{
    const waiting=waitForWorker('http://127.0.0.1:'+server.address().port,30000,controller.signal);
    await requested;controller.abort(reason);await assert.rejects(waiting,error=>error===reason);
  }finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
});
