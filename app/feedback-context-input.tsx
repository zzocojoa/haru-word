'use client';
import type {useFeedbackContext} from './use-feedback-context';
import {DraftRecoveryNotice} from './draft-recovery-notice';
import {FEEDBACK_CONTEXT_KINDS,FEEDBACK_CONTEXT_KIND_TEXT,type FeedbackContextKind} from '@/lib/feedback-context';
import {RecordText} from './record-text';
export function FeedbackContextInput({context,disabled=false}:{context:ReturnType<typeof useFeedbackContext>;disabled?:boolean}){
  return <details className="notes-details"><summary>AI에 전달할 문맥 추가 · 선택</summary>
    <label>문장의 형식<select disabled={disabled} value={context.kind} onChange={event=>context.setKind(event.target.value as FeedbackContextKind)}>{FEEDBACK_CONTEXT_KINDS.map(kind=><option key={kind} value={kind}>{FEEDBACK_CONTEXT_KIND_TEXT[kind]}</option>)}</select></label>
    <label>문장 상황<textarea value={context.note} onChange={event=>context.setNote(event.target.value)} maxLength={500} rows={2} disabled={disabled} placeholder="예: 질문에 대한 짧은 답변이에요. 어제 있었던 일을 말해요." /></label>
    <p className="small-note">여기에 쓴 내용은 요청 버튼을 누를 때 AI에 함께 전달해요. 보완할 점은 자동으로 전달하지 않아요. {context.note.length}/500자</p>
    <DraftRecoveryNotice input={context.persistent} labels={{sentence:'문장 상황',frame:'문장의 형식'}} format={(key,value)=>key==='frame'?FEEDBACK_CONTEXT_KIND_TEXT[(Array.isArray(value)?value[0]:'sentence') as FeedbackContextKind]??'일반 문장':undefined}/>
    {context.legacyChoices.length>0&&<details><summary>이전 버전의 문맥 확인</summary>{context.legacyChoices.map(row=><div key={row.id}>{row.record.kind==='grammar'&&<RecordText text={row.record.values.sentence} label="이전 문맥"/>}<button type="button" className="text-button" disabled={disabled||!!context.note||context.kind!=='sentence'} onClick={()=>context.importLegacy(row.id)}>빈 문맥에 가져오기</button></div>)}<p className="small-note">현재 문맥을 비운 뒤 가져올 수 있어요. 문장의 형식은 다시 선택해 주세요.</p></details>}
  </details>;
}
