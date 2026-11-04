const fs=require('node:fs');
function acquireLock(lockPath){
  try{
    const owner=Number(fs.readFileSync(lockPath,'utf8'));
    if(!Number.isSafeInteger(owner)||owner<=0)throw Error('Invalid QA lock; inspect work/browser-qa.lock.');
    try{process.kill(owner,0);throw Error('Another browser suite is running; performance must run alone.');}
    catch(error){if(error.code!=='ESRCH')throw error;}
    fs.unlinkSync(lockPath);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,String(process.pid));fs.closeSync(lock);
  return ()=>{
    if(fs.readFileSync(lockPath,'utf8')!==String(process.pid))throw Error('QA lock ownership changed; refusing to remove it.');
    fs.unlinkSync(lockPath);
  };
}
module.exports={acquireLock};
