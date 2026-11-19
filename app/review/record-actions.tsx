"use client";
import {HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { lazy,Suspense,useRef } from 'react';
import { useNavigationState } from '../navigation';
import { HaruIcon } from '@/components/icons/haru-icon';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { exportLog, exportTutor, type State, type Word } from '@/lib/learning';
import { download } from '../ui';
const BackupExportDialog=lazy(()=>import('../backup-export-dialog'));

export function RecordActions({state,words,date,now,busy,onRestoreOpen}:{state:State;words:Word[];date:string;now:()=>number;busy:boolean;onRestoreOpen:()=>void}) {
  const pendingDialog=useRef<(()=>void)|null>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const [exportOpen,setExportOpen]=useNavigationState('log.export',false);
  return <><DropdownMenu modal={false} onOpenChange={value=>{if(value)pendingDialog.current=null;}}>
    <DropdownMenuTrigger asChild><HaruButton ref={trigger} label={["기록 관리"].join('')} variant="secondary" icon={<HaruIcon name="more-horizontal" size={18}/>} className="haru-migrated secondary-button" data-backup-trigger>기록 관리</HaruButton></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="record-menu" onEscapeKeyDown={()=>{pendingDialog.current=null;}} onCloseAutoFocus={event=>{
      const openDialog=pendingDialog.current;pendingDialog.current=null;
      if(!openDialog)return;
      // Finish removing the menu's dismissal layer before opening a native modal.
      event.preventDefault();
      if(trigger.current?.isConnected&&trigger.current.getClientRects().length&&!trigger.current.closest('[inert],[hidden]'))openDialog();
    }}>
      <DropdownMenuItem onSelect={()=>download('haru-words-'+date+'.csv',exportLog(state,words),'text/csv;charset=utf-8')}><HaruIcon name="download" size={16}/>학습 기록 CSV 받기</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>{pendingDialog.current=()=>setExportOpen(true);}}><HaruIcon name="backup-archive" size={16}/>전체 백업</DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={()=>{pendingDialog.current=onRestoreOpen;}}><HaruIcon name="restore-file" size={16}/>백업으로 복원</DropdownMenuItem>
      <DropdownMenuSeparator/>
      <DropdownMenuItem onSelect={()=>download('tutor-handoff-'+date+'.txt',exportTutor(state,words),'text/plain;charset=utf-8')}><HaruIcon name="tutor-export" size={16}/>AI 튜터용 안내·최근 기록 받기</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>{exportOpen&&<Suspense fallback={<HaruParagraph role="status">백업 도구를 여는 중이에요.</HaruParagraph>}><BackupExportDialog state={state} date={date} now={now} onClose={()=>setExportOpen(false)}/></Suspense>}</>;
}
