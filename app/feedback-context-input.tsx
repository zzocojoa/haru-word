'use client';
import {useCallback,useId,useLayoutEffect,useMemo,useRef,type ChangeEvent} from 'react';
import {HaruTextArea,HaruSelector,HaruButton} from './haru-controls';
import type {useFeedbackContext} from './use-feedback-context';
import {DraftRecoveryNotice} from './draft-recovery-notice';
import {FEEDBACK_CONTEXT_KINDS,FEEDBACK_CONTEXT_KIND_TEXT,type FeedbackContextKind} from '@/lib/feedback-context';
import {RecordText} from './record-text';
const FORMAT_OPTIONS=FEEDBACK_CONTEXT_KINDS.map(value=>({value,label:FEEDBACK_CONTEXT_KIND_TEXT[value]}));
export function FeedbackContextInput({context,disabled=false,wordIntent=false}:{context:ReturnType<typeof useFeedbackContext>;disabled?:boolean;wordIntent?:boolean}){
  const id=useId(),label=wordIntent?'의도한 한국어 문장':'문장 상황';
  // Cached controls still dispatch to the current committed owner/target and note.
  const setters=useRef({note:context.setNote,kind:context.setKind});
  useLayoutEffect(()=>{setters.current={note:context.setNote,kind:context.setKind};},[context.setNote,context.setKind]);
  const changeNote=useCallback((event:ChangeEvent<HTMLTextAreaElement>)=>setters.current.note(event.target.value),[]);
  const changeKind=useCallback((value:string)=>setters.current.kind(value as FeedbackContextKind),[]);
  const noteField=useMemo(()=><HaruTextArea label={label} id={id} lang={wordIntent?'ko':undefined} required={wordIntent} aria-describedby={id+'-help'} value={context.note} onChange={changeNote} maxLength={500} rows={2} disabled={disabled} placeholder={wordIntent?'예: 사람이 물 위에 걸어가고 있어.':'예: 질문에 대한 짧은 답변이에요. 어제 있었던 일을 말해요.'} />,[label,id,wordIntent,context.note,disabled,changeNote]);
  const kindField=useMemo(()=><HaruSelector label="문장의 형식" disabled={disabled} value={context.kind} onChange={changeKind} options={FORMAT_OPTIONS}/>,[disabled,context.kind,changeKind]);
  const note=<>
    {noteField}
    <p id={id+'-help'} className="small-note">{wordIntent?'한국어로 먼저 쓰고, 오늘 단어를 넣어 영어로 써 보세요.':'여기에 쓴 내용은 요청 버튼을 누를 때 AI에 함께 전달해요. 보완할 점은 자동으로 전달하지 않아요.'} {context.note.length}/500자</p>
    <DraftRecoveryNotice input={context.persistent} labels={{sentence:label,frame:'문장의 형식'}} format={(key,value)=>key==='frame'?FEEDBACK_CONTEXT_KIND_TEXT[(Array.isArray(value)?value[0]:'sentence') as FeedbackContextKind]??'일반 문장':undefined}/>
  </>;
  return <>
    {wordIntent&&<div className="korean-intent-input">{note}</div>}
    <details className="notes-details"><summary>{wordIntent?'문장의 형식 · 선택':'AI에 전달할 문맥 추가 · 선택'}</summary>
    {kindField}
    {!wordIntent&&note}
    {context.legacyChoices.length>0&&<details><summary>이전 버전의 문맥 확인</summary>{wordIntent&&<p className="small-note">이전 메모는 문장 상황만 담고 있을 수 있어요. 말하고 싶은 뜻을 담은 한국어 문장인지 확인한 뒤 가져와 수정해 주세요. 자동으로 AI에 전달하지 않아요.</p>}{context.legacyChoices.map(row=><div key={row.id}>{row.record.kind==='grammar'&&<RecordText text={row.record.values.sentence} label="이전 문맥"/>}<HaruButton variant="ghost" disabled={disabled||!!context.note||context.kind!=='sentence'} onClick={()=>context.importLegacy(row.id)} label={wordIntent?'한국어 의도로 확인해 가져오기':'빈 문맥에 가져오기'}/></div>)}<p className="small-note">현재 문맥을 비운 뒤 가져올 수 있어요. 문장의 형식은 다시 선택해 주세요.</p></details>}
  </details></>;
}
