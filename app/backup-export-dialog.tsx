'use client';
import { useEffect,useState } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { restoreCapabilities } from '@/lib/restore-client';
import { serializeBackup } from '@/lib/backup-format';
import type { State } from '@/lib/learning';
import { inspectBackupExport } from './backup-worker-client';
import { download } from './ui';
type Result={state:State;raw:string;bytes:number;error:string};
export default function BackupExportDialog({state,date,now,onClose}:{state:State;date:string;now:()=>number;onClose:()=>void}){
 const [result,setResult]=useState<Result|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{
   try{
    const caps=await restoreCapabilities();
    const result=await inspectBackupExport(state,now(),caps.maxBytes,controller.signal);
    if(!controller.signal.aborted)setResult({...result,state});
   }catch{
    if(controller.signal.aborted)return;
    const raw=serializeBackup(state,new Date(now()));
    setResult({state,raw,bytes:new TextEncoder().encode(raw).byteLength,error:'복원 가능 여부를 확인하지 못했어요. 원본 보관용으로 내려받을 수 있어요.'});
   }
  })();return()=>controller.abort();
 },[state,now]);
 const ready=result?.state===state?result:null;
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="framed-dialog" onCloseAutoFocus={e=>{e.preventDefault();document.querySelector<HTMLButtonElement>('[data-backup-trigger]')?.focus();}}><DialogHeader><DialogTitle>전체 백업</DialogTitle><DialogDescription>학습 기록·설정을 JSON 파일로 보관해요.</DialogDescription></DialogHeader>
 <div className="dialog-scroll">{ready?<><p>단어 기록 {Object.keys(state.progress).length.toLocaleString()}개 · 회차 {Object.keys(state.sessions).length.toLocaleString()}개</p><p>파일 크기 {(ready.bytes/1_000_000).toFixed(2)} MB</p><p role={ready.error?'alert':'status'} className={ready.error?'backup-error':'small-note'}>{ready.error||'현재 앱에서 복원 가능한 백업이에요.'}</p></>:<p role="status">파일 크기·복원 가능 여부 확인 중</p>}</div>
 <div className="dialog-actions"><button className="primary-button full" disabled={!ready} onClick={()=>{if(ready){download('haru-words-backup-'+date+'.json',ready.raw);onClose();}}}>{ready?.error?'원본 보관용 다운로드':'백업 파일 다운로드'}</button></div>
 </DialogContent></Dialog>;
}
