'use client';
import {useId} from 'react';
import type {useFeedbackContext} from './use-feedback-context';
import {DraftRecoveryNotice} from './draft-recovery-notice';
import {FEEDBACK_CONTEXT_KINDS,FEEDBACK_CONTEXT_KIND_TEXT,type FeedbackContextKind} from '@/lib/feedback-context';
import {RecordText} from './record-text';
export function FeedbackContextInput({context,disabled=false,wordIntent=false}:{context:ReturnType<typeof useFeedbackContext>;disabled?:boolean;wordIntent?:boolean}){
  const id=useId(),label=wordIntent?'의도한 한국어 문장':'문장 상황';
  const note=<>
    <label htmlFor={id}>{label}</label>
    <textarea id={id} lang={wordIntent?'ko':undefined} required={wordIntent} aria-describedby={id+'-help'} value={context.note} onChange={event=>context.setNote(event.target.value)} maxLength={500} rows={2} disabled={disabled} placeholder={wordIntent?'예: 사람이 물 위에 걸어가고 있어.':'예: 질문에 대한 짧은 답변이에요. 어제 있었던 일을 말해요.'} />
    <p id={id+'-help'} className="small-note">{wordIntent?'먼저 말하고 싶은 뜻을 한국어로 쓰고, 아래 칸에 영어로 써 주세요. AI 검사 때 두 문장을 함께 전달해요.':'여기에 쓴 내용은 요청 버튼을 누를 때 AI에 함께 전달해요. 보완할 점은 자동으로 전달하지 않아요.'} {context.note.length}/500자</p>
    <DraftRecoveryNotice input={context.persistent} labels={{sentence:label,frame:'문장의 형식'}} format={(key,value)=>key==='frame'?FEEDBACK_CONTEXT_KIND_TEXT[(Array.isArray(value)?value[0]:'sentence') as FeedbackContextKind]??'일반 문장':undefined}/>
  </>;
  return <>
    {wordIntent&&<div className="korean-intent-input">{note}</div>}
    <details className="notes-details"><summary>{wordIntent?'문장의 형식 · 선택':'AI에 전달할 문맥 추가 · 선택'}</summary>
    <label>문장의 형식<select disabled={disabled} value={context.kind} onChange={event=>context.setKind(event.target.value as FeedbackContextKind)}>{FEEDBACK_CONTEXT_KINDS.map(kind=><option key={kind} value={kind}>{FEEDBACK_CONTEXT_KIND_TEXT[kind]}</option>)}</select></label>
    {!wordIntent&&note}
    {context.legacyChoices.length>0&&<details><summary>이전 버전의 문맥 확인</summary>{context.legacyChoices.map(row=><div key={row.id}>{row.record.kind==='grammar'&&<RecordText text={row.record.values.sentence} label="이전 문맥"/>}<button type="button" className="text-button" disabled={disabled||!!context.note||context.kind!=='sentence'} onClick={()=>context.importLegacy(row.id)}>빈 문맥에 가져오기</button></div>)}<p className="small-note">현재 문맥을 비운 뒤 가져올 수 있어요. 문장의 형식은 다시 선택해 주세요.</p></details>}
  </details></>;
}
