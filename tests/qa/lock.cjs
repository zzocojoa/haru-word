const fs=require('node:fs');
function withRecoveryOwner(lockPath,action){
  const guardPath=lockPath+'.recovery';let guard;
  try{guard=fs.openSync(guardPath,'wx');}
  catch(error){if(error.code==='EEXIST')throw Error('QA lock recovery is already owned; inspect '+guardPath);throw error;}
  try{fs.writeFileSync(guard,String(process.pid));return action();}
  finally{fs.closeSync(guard);fs.unlinkSync(guardPath);}
}
function acquireLock(lockPath){
 return withRecoveryOwner(lockPath,()=>{
  try{
    const owner=Number(fs.readFileSync(lockPath,'utf8'));
    if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Invalid QA lock; inspect work/browser-qa.lock.');
    try{process.kill(owner,0);throw Error('Another browser suite is running; performance must run alone.');}
    catch(error){if(error.code!=='ESRCH')throw error;}
    fs.unlinkSync(lockPath);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,String(process.pid));fs.closeSync(lock);
  return ()=>withRecoveryOwner(lockPath,()=>{
    if(fs.readFileSync(lockPath,'utf8')!==String(process.pid))throw Error('QA lock ownership changed; refusing to remove it.');
    fs.unlinkSync(lockPath);
  });
 });
}
module.exports={acquireLock};
