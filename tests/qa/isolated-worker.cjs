const {spawn,execFileSync}=require('node:child_process');
const {createServer}=require('node:net');
const {mkdirSync,openSync,closeSync,readFileSync}=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {waitForWorker}=require('./runtime.cjs');
const freePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
async function isolatedWorker(label){
 const root=path.resolve('work',label+'-'+randomUUID());mkdirSync(root,{recursive:true});
 const args=['--import',require('node:url').pathToFileURL(path.resolve('scripts/sites-env.mjs')).href,path.resolve('node_modules/wrangler/bin/wrangler.js')],config=path.resolve('dist/server/wrangler.json');
 for(const file of ['0000_worthless_doctor_faustus','0001_ai_daily_usage','0002_old_golden_guardian','0003_bright_zarda'])execFileSync(process.execPath,[...args,'d1','execute','DB','--local','--config',config,'--persist-to',root,'--file',path.resolve('drizzle',file+'.sql')],{windowsHide:true,stdio:'pipe',timeout:30000});
 const port=await freePort(),inspector=await freePort(),log=openSync(path.join(root,'worker.log'),'w');
 const child=spawn(process.execPath,['--require',path.resolve('tests/qa/heap-limit.cjs'),...args,'dev','--config',config,'--local','--persist-to',root,'--ip','127.0.0.1','--port',String(port),'--inspector-port',String(inspector),'--var','large_backup_restore_enabled:true'],{windowsHide:true,detached:process.platform!=='win32',stdio:['ignore',log,log]});
 const stop=()=>{if(child.exitCode===null){if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else process.kill(-child.pid,'SIGTERM');}closeSync(log);};
 try{await waitForWorker('http://127.0.0.1:'+port);if(!readFileSync(path.join(root,'worker.log'),'utf8').includes('QA workerd V8 cap: old space 96 MB, semi space 4 MB'))throw Error('The resource test did not activate its V8 memory cap');return {base:'http://127.0.0.1:'+port,inspector:'http://127.0.0.1:'+inspector,root,stop};}catch(e){stop();throw e;}
}
async function inspectorSession(origin){
 const WS=require('ws'),targets=await(await fetch(origin+'/json/list')).json();
 const socket=new WS(targets[0].webSocketDebuggerUrl,{headers:{Origin:'http://localhost'}});let sequence=0;const waiting=new Map();
 socket.on('message',data=>{const message=JSON.parse(data);if(!message.id)return;const p=waiting.get(message.id);if(p){waiting.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 return {send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{waiting.delete(id);reject(Error('Inspector timeout: '+method))},10000);waiting.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});},close(){socket.close();}};
}
module.exports={isolatedWorker,inspectorSession};
