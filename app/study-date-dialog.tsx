'use client';
import { useState } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { correctDailyStudyDate,isCalendarDate,previousDate } from '@/lib/study-date-correction';
import type { State } from '@/lib/learning';

type Props={state:State;sessionId:string;date:string;saving:boolean;conflict:boolean;save:(next:State)=>Promise<boolean>;onClose:()=>void;onSaved:(date:string)=>void};
export function StudyDateDialog({state,sessionId,date,saving,conflict,save,onClose,onSaved}:Props){
 const [baseline]=useState(state);const source=baseline.sessions[sessionId];
 const [chosen,setChosen]=useState(source.date===date?previousDate(date):source.date);
 const [error,setError]=useState('');const [pending,setPending]=useState<State|null>(null);
 const stale=state!==baseline&&state!==pending;
 async function submit(){
  if(stale||saving||conflict)return;
  try{const next=pending||correctDailyStudyDate(baseline,sessionId,chosen,date);setPending(next);
   if(await save(next)){onSaved(chosen);onClose()}else setError('날짜를 저장하지 못했어요. 입력을 유지하고 있으니 다시 시도해 주세요.');
  }catch(e){setError(e instanceof Error?e.message:'학습일을 확인해 주세요.')}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose()}}><DialogContent className="study-date-dialog" onInteractOutside={event=>{if(saving)event.preventDefault()}} onEscapeKeyDown={event=>{if(saving)event.preventDefault()}}><DialogHeader><DialogTitle>실제 학습일 바로잡기</DialogTitle><DialogDescription>이 회차를 공부한 날짜로 수정해요. 단어·답변·성적·AI 의견은 그대로 보관합니다.</DialogDescription></DialogHeader><p>현재 기록: <b>{source.date}</b> · {source.ids.length}개</p><label htmlFor="correct-study-date">실제로 공부한 날</label><input id="correct-study-date" type="date" max={date} value={chosen} disabled={saving||!!pending} onChange={e=>setChosen(e.target.value)}/><p className="small-note">{source.date} → {chosen||'날짜 선택'}<br/>오늘 목표와 주간·월간 학습 목록에 반영해요. 이미 진행한 점검의 답과 순서는 보존합니다.</p><p className="small-note">오늘 목표가 다시 열려도 보완할 단어는 우선 이월돼요. 날짜 수정이 새 단어만 배정한다는 뜻은 아니에요.</p>{(error||stale||conflict)&&<p role="alert" className="notice">{conflict?'다른 기기에서 기록이 바뀌었어요. 닫은 뒤 최신 기록을 불러와 주세요.':stale?'기록이 바뀌었어요. 창을 닫고 다시 열어 주세요.':error}</p>}<div className="button-row"><button className="primary-button" disabled={saving||stale||conflict||!isCalendarDate(chosen)||chosen>date||chosen===source.date} onClick={submit}>{saving?'저장 중':pending?'날짜 저장 다시 시도':'학습일 수정하기'}</button><button className="secondary-button" disabled={saving} onClick={onClose}>닫기</button></div></DialogContent></Dialog>;
}
