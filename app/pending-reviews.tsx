"use client";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { pendingReviews,KIND_TEXT,type State,type Session } from "@/lib/learning";
import { pendingReviewCounts } from '@/lib/learning-display';
import { HelpDetails } from './study-ui';

export function PendingReviews({state,busy,onResume,excludeSessionIds}:{state:State;busy:boolean;onResume:(s:Session)=>void;excludeSessionIds?:string[]}){
 const pending=useMemo(()=>pendingReviews(state).filter(s=>!excludeSessionIds?.includes(s.id)).map(session=>({session,counts:pendingReviewCounts(state,session)})),[state,excludeSessionIds]);if(!pending.length)return null;
 return <section className="pending-reviews" aria-label="이어서 할 점검"><h3>{excludeSessionIds?'다른 회차의 점검':'이어서 할 점검'}</h3>{pending.map(({session:s,counts:{total,unmeasured,added}})=>{return <article key={s.id}><div><b>{s.period} · {KIND_TEXT[s.kind]}</b><p>전체 {total}개 · 미점검 {unmeasured}개</p>{added>0&&<p className="small-note">추가 {added}개 · 기존 진행 뒤에 연결</p>}</div><button className="secondary-button" disabled={busy} onClick={()=>onResume(s)} aria-label={`${s.period} ${KIND_TEXT[s.kind]} 이어서`}>이어서 <ArrowRight size={15}/></button></article>})}<HelpDetails title="오늘 학습과는 별도예요"><p>미점검은 아직 확인하지 않은 항목이에요. 점검이 남아 있어도 다음 날 학습할 수 있어요.</p></HelpDetails></section>;
}
