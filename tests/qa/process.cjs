const { spawn } = require('node:child_process');
const { createWriteStream } = require('node:fs');

async function runCase(args, { logPath, timeoutMs, graceMs = 5000, env = process.env }) {
  const log = createWriteStream(logPath);
  const child = spawn(process.execPath, args, {
    env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], detached: process.platform !== 'win32',
  });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  let timedOut = false, interrupted = false, forceTimer;
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
  const interrupt = () => { interrupted = true; stop(); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  const code = await new Promise(resolve => {
    child.once('error', error => { log.write(error.message); resolve(1); });
    child.once('close', code => resolve(code ?? 1));
  });
  clearTimeout(timer); clearTimeout(forceTimer);
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
  await new Promise(resolve => log.end(resolve));
  return { code: interrupted ? 130 : code, timedOut, ...(interrupted ? { interrupted: true } : {}) };
}
module.exports = { runCase };
