import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const until=async condition=>{const end=Date.now()+5000;while(Date.now()<end){if(condition())return;await new Promise(ok=>setTimeout(ok,20));}throw Error('Lock scenario not ready');};

test('OPS-3: two stale reclaimers cannot unlink the new owner, including the paused stale-read interleaving',async()=>{
 const root=mkdtempSync(join(tmpdir(),'haru-lock-race-')),lock=join(root,'qa.lock'),ready=join(root,'read-ready'),gate=join(root,'continue');
 const dead=spawn(process.execPath,['-e','']);await new Promise(ok=>dead.once('close',ok));writeFileSync(lock,String(dead.pid));
 const lockModule=resolve('tests/qa/lock.cjs'),script=join(root,'acquire.cjs');
 writeFileSync(script,`const fs=require('node:fs'),Module=require('node:module'),original=Module._load;let paused=false;
 if(process.argv[2]==='paused')Module._load=function(name,parent,...rest){const value=original.call(this,name,parent,...rest);if(name==='node:fs')return {...value,readFileSync:(file,...args)=>{const result=value.readFileSync(file,...args);if(file===${JSON.stringify(lock)}&&!paused){paused=true;fs.writeFileSync(${JSON.stringify(ready)},'ready');while(!fs.existsSync(${JSON.stringify(gate)}))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);}return result;}};return value;};
 try{const release=require(${JSON.stringify(lockModule)}).acquireLock(${JSON.stringify(lock)});process.send('acquired');process.on('message',()=>{release();process.exit(0);});}catch(error){console.error(error.message);process.exit(3);}`);
 const start=mode=>{const child=spawn(process.execPath,[script,mode],{stdio:['ignore','pipe','pipe','ipc']});let output='';child.stderr.on('data',chunk=>output+=chunk);return {child,exit:new Promise(ok=>child.once('close',code=>ok({code,output}))) };};
 const first=start('paused');let acquired=false;first.child.on('message',()=>acquired=true);
 try{
  await until(()=>existsSync(ready));const second=start('normal'),rejected=await second.exit;
  assert.equal(rejected.code,3);assert.match(rejected.output,/recovery is already owned/);
  writeFileSync(gate,'continue');await until(()=>acquired);assert.equal(readFileSync(lock,'utf8'),String(first.child.pid));
  const third=start('normal'),live=await third.exit;assert.equal(live.code,3);assert.match(live.output,/Another browser suite/);
  assert.equal(readFileSync(lock,'utf8'),String(first.child.pid));first.child.send('release');assert.equal((await first.exit).code,0);
  assert.equal(existsSync(lock),false);assert.equal(existsSync(lock+'.recovery'),false);
 }finally{writeFileSync(gate,'continue');if(first.child.exitCode===null){if(acquired)first.child.send('release');else first.child.kill();}await first.exit;}
});
