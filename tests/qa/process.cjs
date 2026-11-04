const { spawn } = require('node:child_process');
const { createWriteStream } = require('node:fs');

async function runCase(args, { logPath, timeoutMs, graceMs = 5000, env = process.env, signal }) {
  const interruptionCode=name=>name==='SIGTERM'?143:130;
  if(signal?.aborted)return {code:interruptionCode(signal.reason?.signal),timedOut:false,interrupted:true,signal:signal.reason?.signal};
  const log = createWriteStream(logPath);
  const child = spawn(process.execPath, args, {
    env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], detached: process.platform !== 'win32',
  });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  let timedOut = false, interrupted = false, interruptedSignal, forceTimer;
  function stop() {
    if (forceTimer) return;
    // Give the shared browser lifecycle time to flush contexts and close Chromium.
    if (child.connected) child.send('qa-stop', () => {});
    else child.kill('SIGTERM');
    forceTimer = setTimeout(() => {
      // Only terminate the process tree created by this invocation.
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', () => child.kill());
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') log.write('QA process cleanup failed.\n'); }
      }
    }, graceMs);
  }
  const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  const interrupt = name => { interrupted = true;interruptedSignal||=name;stop(); };
  const onInt=()=>interrupt('SIGINT'),onTerm=()=>interrupt('SIGTERM'),onAbort=()=>interrupt(signal.reason?.signal);
  if(signal)signal.addEventListener('abort',onAbort,{once:true});
  else{process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);}
  const code = await new Promise(resolve => {
    child.once('error', error => { log.write(error.message); resolve(1); });
    child.once('close', code => resolve(code ?? 1));
  });
  clearTimeout(timer); clearTimeout(forceTimer);
  signal?.removeEventListener('abort',onAbort);
  process.removeListener('SIGINT',onInt);process.removeListener('SIGTERM',onTerm);
  await new Promise(resolve => log.end(resolve));
  return { code: interrupted ? interruptionCode(interruptedSignal) : code, timedOut, ...(interrupted ? { interrupted: true,signal:interruptedSignal } : {}) };
}
module.exports = { runCase };
