import { analyzeBackup, analyzeExport } from '@/lib/backup-analysis';
import type { State } from '@/lib/learning';
type Task={kind:'import';file:File;maxBytes:number}|{kind:'export';state:State;now:number;maxBytes:number};
self.onmessage=async(event:MessageEvent<Task>)=>{
 try{
  const task=event.data;
  if(task.kind==='import'&&task.file.size>task.maxBytes)throw new Error(`백업 파일은 ${task.maxBytes/1_000_000} MB까지 복원할 수 있어요.`);
  const result=task.kind==='import'?await analyzeBackup(await task.file.text(),task.maxBytes):await analyzeExport(task.state,task.now,task.maxBytes);
  self.postMessage({ok:true,result});
 }catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:'백업 파일을 확인하지 못했어요.'});}
};
