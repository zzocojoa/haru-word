"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from './haru-content';
import {HaruButton} from './haru-controls';

import { useId, useMemo } from "react";
import { useVocabularyState } from './learning/use-vocabulary-state';
import { ArrowRight } from "lucide-react";
import { pendingReviews,KIND_TEXT,type State,type Session } from "@/lib/learning";
import { pendingReviewCounts, reviewSessionLabels } from '@/lib/learning-display';

export function PendingReviews({state,busy,onResume,excludeSessionIds}:{state:State;busy:boolean;onResume:(s:Session)=>void;excludeSessionIds?:string[]}){
 const prefix=useId();
 const vocabulary=useVocabularyState(state);
 const allPending=useMemo(()=>pendingReviews(vocabulary).map(session=>({session,counts:pendingReviewCounts(vocabulary,session)})),[vocabulary]);
 const pending=allPending.filter(({session})=>!excludeSessionIds?.includes(session.id));
 const hasPending=pending.length>0;
 // Keep every hook mounted, and include finished sessions when numbering reviews.
 const labels=useMemo(()=>hasPending?reviewSessionLabels(state.sessions):null,[hasPending,state.sessions]);
 if(!labels)return null;
 return <HaruPanel role="region" className="pending-reviews" aria-label="이어서 할 점검"><HaruHeading level={3}>{excludeSessionIds?'다른 회차의 점검':'이어서 할 점검'}</HaruHeading><HaruParagraph className="small-note">오늘 학습과 별도 · 다음 날 학습을 막지 않아요.</HaruParagraph>{pending.map(({session:s,counts:{total,unmeasured,added}})=>{
  const label=labels.get(s.id)!;
  return <article key={s.id}><div><b>{s.period} · {KIND_TEXT[s.kind]}</b><HaruParagraph id={`${prefix}-${s.id}`} className="review-session-label">{label.number}회차 · {label.started} 시작{label.latest ? ' · 최신 회차' : ''}</HaruParagraph><HaruParagraph>전체 {total}개 · 미점검 {unmeasured}개</HaruParagraph>{added>0&&<HaruParagraph className="small-note">추가 {added}개 · 기존 진행 뒤에 연결</HaruParagraph>}</div><HaruButton label={`${s.period} ${KIND_TEXT[s.kind]} 이어서`} variant="secondary" endContent={<ArrowRight size={15}/>} className="haru-migrated secondary-button" disabled={busy} onClick={()=>onResume(s)} aria-describedby={`${prefix}-${s.id}`} aria-label={`${s.period} ${KIND_TEXT[s.kind]} 이어서`}>이어서 </HaruButton></article>})}</HaruPanel>;
}
