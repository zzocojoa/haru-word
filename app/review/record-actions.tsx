"use client";
import { lazy,Suspense,useRef,useState } from 'react';
import { Download, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { exportLog, exportTutor, type State, type Word } from '@/lib/learning';
import { download } from '../ui';
const BackupExportDialog=lazy(()=>import('../backup-export-dialog'));

export function RecordActions({state,words,date,now,busy,onRestoreOpen}:{state:State;words:Word[];date:string;now:()=>number;busy:boolean;onRestoreOpen:()=>void}) {
  const openingRestore=useRef(false);
  const [exportOpen,setExportOpen]=useState(false);
  return <><DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><button className="secondary-button" data-backup-trigger><MoreHorizontal size={18}/>기록 관리</button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="record-menu" onCloseAutoFocus={event=>{if(openingRestore.current){event.preventDefault();openingRestore.current=false;}}}>
      <DropdownMenuItem onSelect={()=>download('haru-words-'+date+'.csv',exportLog(state,words),'text/csv;charset=utf-8')}><Download size={16}/>CSV 받기</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>{openingRestore.current=true;setExportOpen(true);}}>전체 백업</DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={()=>{openingRestore.current=true;onRestoreOpen();}}>백업 가져오기</DropdownMenuItem>
      <DropdownMenuSeparator/>
      <DropdownMenuItem onSelect={()=>download('tutor-handoff-'+date+'.txt',exportTutor(state,words),'text/plain;charset=utf-8')}>튜터 프롬프트·최근 기록 받기</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>{exportOpen&&<Suspense fallback={<p role="status">백업 도구를 여는 중이에요.</p>}><BackupExportDialog state={state} date={date} now={now} onClose={()=>setExportOpen(false)}/></Suspense>}</>;
}
