"use client";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { pendingReviews,reviewRemaining,missingReviewTargets,KIND_TEXT,type State,type Session } from "@/lib/learning";

export function PendingReviews({state,busy,onResume}:{state:State;busy:boolean;onResume:(s:Session)=>void}){
 const pending=useMemo(()=>pendingReviews(state).map(session=>({session,added:missingReviewTargets(state,session).length})),[state]);if(!pending.length)return null;
 return <section className="pending-reviews" aria-label="이어서 할 점검"><h3>이어서 할 점검</h3><p className="small-note">오늘 학습을 마쳐도 주간·월말 점검은 별도로 남을 수 있어요. 미점검은 해당 기간 목록에서 아직 확인하지 않은 항목 수예요.</p>{pending.map(({session:s,added})=>{return <article key={s.id}><div><b>{s.period} · {KIND_TEXT[s.kind]}</b><p>전체 {s.ids.length+added}개 · 미점검 {reviewRemaining(s)+added}개</p>{added>0&&<p className="small-note">새로 추가된 {added}개 포함 · 이어서 누르면 기존 진행 뒤에 연결해요.</p>}</div><button className="secondary-button" disabled={busy} onClick={()=>onResume(s)} aria-label={`${s.period} ${KIND_TEXT[s.kind]} 이어서`}>이어서 <ArrowRight size={15}/></button></article>})}</section>;
}
