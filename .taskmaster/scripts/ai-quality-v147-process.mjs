// Hash process identity locally; never return command lines or credential arguments.
import {execFileSync, spawn} from 'node:child_process';
import {readFileSync, readlinkSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
let self;
export function observeProcess(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return {status: 'unknown'};
  if (process.platform === 'win32') {
    const script = `$ErrorActionPreference='Stop';function Get-Aiq147Digest([string]$v){$a=[System.Security.Cryptography.SHA256]::Create();try{([BitConverter]::ToString($a.ComputeHash([Text.Encoding]::UTF8.GetBytes($v)))).Replace('-','').ToLowerInvariant()}finally{$a.Dispose()}};$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}';if($null -eq $p){'{"status":"absent"}'}elseif([string]::IsNullOrEmpty($p.CommandLine) -or [string]::IsNullOrEmpty($p.ExecutablePath)){'{"status":"unknown"}'}else{@{status='present';identity=@{platform='win32';pid=[int]$p.ProcessId;createdAt=$p.CreationDate.ToUniversalTime().ToString('o');commandHash=(Get-Aiq147Digest $p.CommandLine);executableHash=(Get-Aiq147Digest $p.ExecutablePath)}}|ConvertTo-Json -Depth 3 -Compress}`;
    try { return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe']})); }
    catch { return {status: 'unknown'}; }
  }
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8'), fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      return {status: 'present', identity: {platform: 'linux', pid, createdAt: fields[19], commandHash: sha(readFileSync(`/proc/${pid}/cmdline`)), executableHash: sha(readlinkSync(`/proc/${pid}/exe`))}};
    } catch (e) { return {status: e.code === 'ENOENT' ? 'absent' : 'unknown'}; }
  }
  return {status: 'unknown'};
}
export function ownProcessIdentity() {
  if (!self) { const observation = observeProcess(process.pid); if (observation.status !== 'present') throw new Error('OWN_PROCESS_IDENTITY_UNKNOWN'); self = Object.freeze(observation.identity); }
  return self;
}

// Windows kernel mutex serializes recoverers. The helper releases on stdin EOF;
// an abrupt helper death abandons the mutex, which the next owner must audit.
export async function acquireRecoveryMutex(scopeHash) {
  if (process.platform !== 'win32' || !/^[a-f0-9]{64}$/.test(scopeHash)) throw new Error('WINDOWS_RECOVERY_MUTEX_REQUIRED');
  const script = `
$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$m=[System.Threading.Mutex]::new($false,'Global\\CodexAIQ147-${scopeHash}')
$owned=$false
try {
  try {$owned=$m.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$owned=$true}
  if(-not $owned){[Console]::Out.WriteLine('busy');exit 75}
  [Console]::Out.WriteLine('owned');[Console]::Out.Flush()
  while($null -ne ($line=[Console]::In.ReadLine())) {
    if($line -eq 'release'){break}
    $request=$null;$stage='PARSE'
    try {
      $request=ConvertFrom-Json -InputObject $line;$stage='FIELDS'
      $source=[IO.Path]::GetFullPath($request.source)
      $destination=[IO.Path]::GetFullPath($request.destination)
      $root=[IO.Path]::GetFullPath($request.allowedRoot).TrimEnd('\\')+'\\'
      if($request.op -ne 'archive' -or $request.expectedHash -notmatch '^[a-f0-9]{64}$' -or
        -not $source.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or
        -not $destination.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($source) -ne 'LOCK.json' -or
        [IO.Path]::GetFileName($destination) -ne 'previous-owned-lock.json' -or
        ([IO.File]::GetAttributes($source) -band [IO.FileAttributes]::ReparsePoint)){throw 'refused'}
      $stage='READ';$hash=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($source)
      try {$actual=([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
      finally {$stream.Dispose();$hash.Dispose()}
      $stage='HASH';if($actual -ne $request.expectedHash){throw 'changed'}
      $stage='MOVE';[IO.File]::Move($source,$destination);$reply=@{id=$request.id;ok=$true}
    } catch {$reply=@{id=$request.id;ok=$false;code=$stage}}
    [Console]::Out.WriteLine(($reply|ConvertTo-Json -Compress));[Console]::Out.Flush()
  }
} finally {if($owned){$m.ReleaseMutex()};$m.Dispose()}
`;
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
  let output = '', error = '', buffer = ''; const pending = new Map();
  child.stderr.on('data', bytes => { error += bytes.toString(); });
  const failPending = () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('MUTEX_HELPER_GONE')); } pending.clear(); };
  child.stdin.on('error', () => { error = 'MUTEX_PIPE_FAILED'; failPending(); });
  child.stdout.on('data', bytes => {
    buffer += bytes.toString(); let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
      if (!line.startsWith('{')) continue;
      try { const reply = JSON.parse(line), item = pending.get(reply.id); if (!item) continue; clearTimeout(item.timer); pending.delete(reply.id);
        if (reply.ok === true) item.resolve(); else item.reject(new Error('MUTEX_ARCHIVE_REFUSED_'+(['PARSE','FIELDS','READ','HASH','MOVE'].includes(reply.code)?reply.code:'UNKNOWN')));
      } catch { failPending(); }
    }
  });
  const exited = new Promise((res, rej) => { child.on('error', e => { failPending(); rej(e); }); child.on('exit', code => { failPending(); res(code); }); });
  try {
    await new Promise((res, rej) => {
      const timer = setTimeout(() => { child.kill(); rej(new Error('MUTEX_START_TIMEOUT')); }, 15000);
      child.on('error', () => { clearTimeout(timer); rej(new Error('MUTEX_START_FAILED')); });
      child.on('exit', () => { clearTimeout(timer); rej(new Error('RECOVERY_MUTEX_BUSY_OR_FAILED')); });
      child.stdout.on('data', bytes => { output += bytes.toString(); if (output.includes('owned')) { clearTimeout(timer); res(); } });
    });
  } catch (e) { child.stdin.end(); await exited.catch(() => {}); throw e; }
  let released;
  return {pid: child.pid, archiveLock({source, destination, allowedRoot, expectedHash}) {
    if (child.exitCode !== null || child.killed) return Promise.reject(new Error('MUTEX_HELPER_GONE'));
    return new Promise((res, rej) => {
      const id = randomUUID(), timer = setTimeout(() => { pending.delete(id); child.kill(); rej(new Error('MUTEX_ARCHIVE_TIMEOUT')); }, 15000);
      pending.set(id, {resolve: res, reject: rej, timer});
      child.stdin.write(JSON.stringify({id, op: 'archive', source, destination, allowedRoot, expectedHash}) + '\n', e => { if (e) failPending(); });
    });
  }, release() {
    if (!released) released = (async () => { if (child.exitCode === null && !child.killed) child.stdin.end('release\n'); const code = await exited; if (code !== 0 || error) throw new Error('MUTEX_RELEASE_FAILED'); })();
    return released;
  }};
}
