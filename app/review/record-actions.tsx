"use client";
import { useRef } from 'react';
import { Download, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { exportLog, exportTutor, type State, type Word } from '@/lib/learning';
import { download } from '../ui';

export function RecordActions({state,words,date,now,busy,onRestoreOpen}:{state:State;words:Word[];date:string;now:()=>number;busy:boolean;onRestoreOpen:()=>void}) {
  const openingRestore=useRef(false);
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><button className="secondary-button" data-backup-trigger><MoreHorizontal size={18}/>기록 관리</button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="record-menu" onCloseAutoFocus={event=>{if(openingRestore.current){event.preventDefault();openingRestore.current=false;}}}>
      <DropdownMenuItem onSelect={()=>download('haru-words-'+date+'.csv',exportLog(state,words),'text/csv;charset=utf-8')}><Download size={16}/>CSV 받기</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>download('haru-words-backup-'+date+'.json',JSON.stringify({format:'haru-words-v1',exportedAt:new Date(now()).toISOString(),state},null,2))}>전체 백업</DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={()=>{openingRestore.current=true;onRestoreOpen();}}>백업 가져오기</DropdownMenuItem>
      <DropdownMenuSeparator/>
      <DropdownMenuItem onSelect={()=>download('tutor-handoff-'+date+'.txt',exportTutor(state,words),'text/plain;charset=utf-8')}>튜터 프롬프트·최근 기록 받기</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
