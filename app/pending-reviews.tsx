"use client";
import { ArrowRight } from "lucide-react";
import { pendingReviews,reviewRemaining,KIND_TEXT,type State,type Session } from "@/lib/learning";

export function PendingReviews({state,busy,onResume}:{state:State;busy:boolean;onResume:(s:Session)=>void}){
 const pending=pendingReviews(state);if(!pending.length)return null;
 return <section className="pending-reviews" aria-label="이어서 할 점검"><h3>이어서 할 점검</h3><p className="small-note">지난 기간의 점검도 여기서 계속할 수 있어요.</p>{pending.map(s=><article key={s.id}><div><b>{s.period} · {KIND_TEXT[s.kind]}</b><p>전체 {s.ids.length}개 · 미점검 {reviewRemaining(s)}개</p></div><button className="secondary-button" disabled={busy} onClick={()=>onResume(s)} aria-label={`${s.period} ${KIND_TEXT[s.kind]} 이어서`}>이어서 <ArrowRight size={15}/></button></article>)}</section>;
}
