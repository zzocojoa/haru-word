// Owned loopback Workers with synthetic bindings and no provider credentials.
const {spawn,execFileSync}=require('node:child_process');
const {createServer}=require('node:net');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {waitForWorker,accountHeaders}=require('./runtime.cjs');
const {requireDisabledAiStatus}=require('./preflight.cjs');
const freePort=()=>new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
function profileConfig(built,version){
  if(![2,3,4].includes(version))throw Error('Unsupported QA grammar profile');
  return {name:'haru-grammar-qa-v'+version,main:path.resolve('dist/server',built.main),compatibility_date:built.compatibility_date,
    compatibility_flags:built.compatibility_flags,no_bundle:true,rules:built.rules,assets:{directory:path.resolve('dist/server',built.assets.directory)},
    d1_databases:[{binding:'DB',database_name:'qa-only',database_id:'00000000-0000-0000-0000-000000000001'}],
    r2_buckets:[{binding:'BUCKET',bucket_name:'qa-only'}],
    vars:{grammar_enabled:'true',grammar_practice_v2_enabled:'true',grammar_practice_v3_enabled:String(version>=3),grammar_practice_v4_enabled:String(version>=4),
      word_image_pilot_enabled:'true',large_backup_restore_enabled:'true',ai_feedback_enabled:'false',feedback_judgment_enabled:'true',
      OPENAI_API_KEY:'synthetic-disabled',OPENAI_ALLOWED_MODELS:'gpt-6.1-sol,gpt-6.1-terra,gpt-6-astra'}};
}
async function grammarWorker(version,{signal}={}){
  signal?.throwIfAborted();
  const root=fs.mkdtempSync(path.resolve('work','grammar-profile-v'+version+'-'));
  const configPath=path.join(root,'wrangler.json'),config=profileConfig(JSON.parse(fs.readFileSync('dist/server/wrangler.json','utf8')),version);
  fs.writeFileSync(configPath,JSON.stringify(config,null,2));
  const args=['--import',pathToFileURL(path.resolve('scripts/sites-env.mjs')).href,path.resolve('node_modules/wrangler/bin/wrangler.js')];
  for(const file of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())execFileSync(process.execPath,[...args,'d1','execute','DB','--local','--config',configPath,'--persist-to',root,'--file',path.resolve('drizzle',file)],{windowsHide:true,stdio:'pipe',timeout:30000});
  const port=await freePort(),base='http://127.0.0.1:'+port,log=fs.openSync(path.join(root,'worker.log'),'w');
  if(signal?.aborted){fs.closeSync(log);signal.throwIfAborted();}
  const child=spawn(process.execPath,[...args,'dev','--config',configPath,'--local','--persist-to',root,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0'],{windowsHide:true,detached:process.platform!=='win32',stdio:['ignore',log,log]});
  let stopPromise,spawnError;
  const closed=new Promise(resolve=>{child.once('close',resolve);child.once('error',error=>{spawnError=error;resolve();});});
  function stop(){
    return stopPromise||=(async()=>{
      let force;
      try{
        if(Number.isSafeInteger(child.pid)&&child.pid>0&&child.exitCode===null&&child.signalCode===null){
          try{
            if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
            else{
              process.kill(-child.pid,'SIGTERM');
              force=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')console.error('Owned QA Worker force cleanup failed.');}},2000);
            }
          }catch(error){if(error.code!=='ESRCH'&&child.exitCode===null&&child.signalCode===null)throw error;}
        }
        await closed;
      }finally{clearTimeout(force);fs.closeSync(log);}
    })();
  }
  try{
    await waitForWorker(base,30_000,signal);if(spawnError)throw spawnError;
    await requireDisabledAiStatus(base,accountHeaders('grammar_profile'),undefined,signal);signal?.throwIfAborted();
    return {base,version,configPath,root,pid:child.pid,stop};
  }catch(error){await stop();throw error;}
}
module.exports={profileConfig,grammarWorker};
