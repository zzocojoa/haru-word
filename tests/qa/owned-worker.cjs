const {execFileSync}=require('node:child_process');

// The detached Worker group belongs to this invocation, including descendants
// that outlive Wrangler. Install cleanup before waiting for readiness.
function ownWorker(child,closeLog){
 let stopPromise,spawnError;
 const closed=new Promise(resolve=>{child.once('close',resolve);child.once('error',error=>{spawnError=error;resolve();});});
 const killGroup=signal=>{try{process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
 const handlers=new Map([['SIGINT',130],['SIGTERM',143],['SIGHUP',129]].map(([signal,code])=>[signal,()=>void finish(code)]));
 const message=value=>{if(value==='qa-stop')void finish(124);};
 function stop(){
  return stopPromise||=(async()=>{
   let timer;
   try{
    if(Number.isSafeInteger(child.pid)&&child.pid>0){
     if(process.platform==='win32'){
      try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}
      catch(error){if(child.exitCode===null&&child.signalCode===null)throw error;}
     }else{
      killGroup('SIGTERM');
      await Promise.race([closed,new Promise(ok=>timer=setTimeout(ok,2000))]);
      // Reap the owned group even if its leader exited before its children.
      killGroup('SIGKILL');
     }
    }
    await closed;
   }finally{
    clearTimeout(timer);for(const [signal,handler]of handlers)process.removeListener(signal,handler);
    process.removeListener('message',message);closeLog();
   }
  })();
 }
 async function finish(code){try{await stop();}catch{console.error('Owned resource Worker cleanup failed.');code=1;}process.exit(code);}
 for(const [signal,handler]of handlers)process.on(signal,handler);
 process.on('message',message);process.channel?.unref();
 return {stop,get spawnError(){return spawnError;}};
}
module.exports={ownWorker};
