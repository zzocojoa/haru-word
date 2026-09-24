import type { State } from '@/lib/learning';
import type { AnalyzedBackup, analyzeExport } from '@/lib/backup-analysis';
import BackupWorker from './backup-worker?worker';
function run<T>(task:unknown,signal?:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const worker=new BackupWorker();
  const finish=()=>{worker.terminate();signal?.removeEventListener('abort',abort);clearTimeout(timer);};
  const abort=()=>{finish();reject(new DOMException('Cancelled','AbortError'));};
  const timer=setTimeout(()=>{finish();reject(new Error('백업 확인 시간이 길어졌어요. 다시 시도해 주세요.'));},60_000);
  worker.onmessage=e=>{finish();if(e.data.ok)resolve(e.data.result);else reject(new Error(e.data.error));};
  worker.onerror=()=>{finish();reject(new Error('백업 확인 도구를 열지 못했어요. 새로고침 후 다시 시도해 주세요.'));};
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}worker.postMessage(task);
 });
}
export const inspectBackupFile=(file:File,maxBytes:number,signal?:AbortSignal)=>run<AnalyzedBackup>({kind:'import',file,maxBytes},signal);
export const inspectBackupExport=(state:State,now:number,maxBytes:number,signal?:AbortSignal)=>run<Awaited<ReturnType<typeof analyzeExport>>>({kind:'export',state,now,maxBytes},signal);
