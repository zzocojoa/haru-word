import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createConnection} from 'node:net';
import {createRequire} from 'node:module';
const {runCase}=createRequire(import.meta.url)('./qa/process.cjs');
const until=async check=>{const end=Date.now()+7000;while(Date.now()<end){if(await check())return;await new Promise(ok=>setTimeout(ok,20));}throw Error('Owned resource process did not settle');};
const live=pid=>{try{process.kill(pid,0);if(process.platform==='linux'&&readFileSync('/proc/'+pid+'/stat','utf8').split(' ')[2]==='Z')return false;return true;}catch(error){if(['ESRCH','ENOENT'].includes(error.code))return false;throw error;}};
const listening=port=>new Promise(ok=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();ok(true);});socket.once('error',()=>ok(false));});

for(const mode of ['timeout','SIGINT','SIGTERM','concurrent-stop'])test(`OPS-2 ${process.platform}: isolated resource Worker ${mode} cleans its separate group and loopback port`,async()=>{
 const root=mkdtempSync(join(tmpdir(),'haru-resource-lifetime-')),marker=join(root,'owned.json'),runner=join(root,'runner.cjs'),worker=join(root,'worker.cjs');
 for(const dir of ['work','drizzle','dist/server'])mkdirSync(join(root,dir),{recursive:true});
 writeFileSync(join(root,'dist/server/wrangler.json'),'{}');
 // Synthetic process/port fixture only: the log line satisfies the existing
 // startup boundary; this test makes no memory-cap or real workerd claim.
 writeFileSync(worker,`const fs=require('node:fs'),net=require('node:net'),{spawn}=require('node:child_process');
 const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'ignore'});
 const server=net.createServer();console.log('QA workerd V8 cap: old space 96 MB, semi space 4 MB');
 server.listen(Number(process.argv[2]),'127.0.0.1',()=>{const file=${JSON.stringify(marker)};fs.writeFileSync(file+'.tmp',JSON.stringify({pid:process.pid,child:child.pid,port:server.address().port}));fs.renameSync(file+'.tmp',file);});
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`);
 writeFileSync(runner,`const Module=require('node:module'),fs=require('node:fs'),cp=require('node:child_process'),original=Module._load;
 Module._load=function(name,parent,...rest){const source=parent?.filename?.replaceAll('\\\\','/');
 if(source?.endsWith('/qa/isolated-worker.cjs')&&name==='node:child_process')return {...cp,execFileSync:()=>{},spawn:(file,args,options)=>cp.spawn(process.execPath,[${JSON.stringify(worker)},args[args.indexOf('--port')+1]],options)};
 if(source?.endsWith('/qa/isolated-worker.cjs')&&name==='./worker-profile.cjs')return {profileConfig:()=>({})};
 if(source?.endsWith('/qa/isolated-worker.cjs')&&name==='./runtime.cjs')return {waitForWorker:async()=>{while(!fs.existsSync(${JSON.stringify(marker)}))await new Promise(ok=>setTimeout(ok,10));}};
 return original.call(this,name,parent,...rest);};
 process.chdir(${JSON.stringify(root)});
 (async()=>{const worker=await require(${JSON.stringify(resolve('tests/qa/isolated-worker.cjs'))}).isolatedWorker('synthetic-resource');
 if(${JSON.stringify(mode)}==='concurrent-stop'){const first=worker.stop();if(worker.stop()!==first)throw Error('Cleanup promise changed');await first;}
 else if(${JSON.stringify(mode)}!=='timeout')process.emit(${JSON.stringify(mode)});
 else setInterval(()=>{},1000);
 })().catch(error=>{console.error(error);process.exitCode=1;});`);
 const outcome=await runCase([runner],{logPath:join(root,'case.log'),timeoutMs:mode==='timeout'?1500:10000,graceMs:3500});
 assert.equal(outcome.timedOut,mode==='timeout');assert.equal(outcome.code,mode==='timeout'?124:mode==='SIGINT'?130:mode==='SIGTERM'?143:0,readFileSync(join(root,'case.log'),'utf8'));
 assert.ok(existsSync(marker));const owned=JSON.parse(readFileSync(marker,'utf8'));
 await until(()=>!live(owned.pid)&&!live(owned.child));assert.equal(await listening(owned.port),false);assert.equal(live(process.pid),true);
});
