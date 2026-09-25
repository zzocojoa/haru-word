"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Eye,Check} from 'lucide-react';
import {FAMILIARITY_TEXT,POS,type Familiarity,type FamiliarityCheck,type Word} from '@/lib/learning';
import {DictionaryLinks} from './ui';

type Props={word:Word;check?:FamiliarityCheck;busy:boolean;onReveal:(initial:Familiarity,answer:string)=>void;onConfirm:(final:Familiarity)=>void};
export function FamiliarityCard({word,check,busy,onReveal,onConfirm}:Props){
 const [answer,setAnswer]=useState('');
 const pending=check&&!check.final?check:undefined;
 const revealed=!!pending;
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus()},[word.id,revealed]);
 return <div className="familiarity-card">
  <ol className="familiarity-steps" aria-label="친숙도 확인 순서"><li aria-current={!pending?'step':undefined}>1 먼저 떠올리기</li><li aria-current={pending?'step':undefined}>2 뜻 비교·확정</li></ol>
  <div className="word-stage"><h3 ref={heading} tabIndex={-1} lang="en">{word.word}</h3><span className="muted">{POS[word.pos]} · {word.personal?'개인 추가':word.level}</span></div>
  {!pending?<>
   <label htmlFor="familiarity-answer">내가 떠올린 뜻 <span>선택 입력</span></label>
   <input id="familiarity-answer" value={answer} maxLength={2000} onChange={e=>setAnswer(e.target.value)} placeholder="비교할 수 있도록 짧게 적어 보세요" autoComplete="off"/>
   <p className="familiarity-prompt"><Eye size={16}/> 표시를 고르면 뜻을 확인해요.</p>
   <div className="familiarity-actions">{(['known','uncertain','new']as const).map((f,i)=><button key={f} disabled={busy} onClick={()=>onReveal(f,answer)}><span className="mark-symbol">{i===0?'✓✓':i===1?'✓':'?'}</span>{FAMILIARITY_TEXT[f]}</button>)}</div>
  </>:<>
   <section className="familiarity-comparison" aria-label="뜻 비교" aria-live="polite">
    <div><p className="eyebrow">확인 전 나의 생각</p><p className="precheck-mark">{FAMILIARITY_TEXT[pending.initial]}</p><p>{pending.answer||'머릿속으로 떠올렸어요 · 입력한 뜻 없음'}</p></div>
    <div className="revealed-meaning"><p className="eyebrow">{POS[word.pos]} · 한국어 참고 풀이</p><p className="reference-meaning">{pending.meaning||'등록된 풀이가 없어요. 아래 사전에서 확인해 주세요.'}</p></div>
   </section>
   <p className="small-note">같은 품사의 맞는 뜻이면 인정해요. 애매하면 사전으로 확인해요.</p>
   <DictionaryLinks word={word.word}/>
   {pending.initial==='known'?<div className="confirmation-actions"><button className="primary-button full" disabled={busy} onClick={()=>onConfirm('known')}><Check size={17}/>맞아요 · 안다로 확정</button><button className="secondary-button full" disabled={busy} onClick={()=>onConfirm('uncertain')}>불확실해요 · 헷갈림으로 확정</button></div>:<>
    <p className="notice">{pending.initial==='new'?'처음 본 단어로 기록해요.':'헷갈린 단어로 기록해 먼저 배워요.'}</p>
    <button className="primary-button full" disabled={busy} onClick={()=>onConfirm(pending.initial)}>{pending.initial==='new'?'처음으로 확정 · 다음':'헷갈림으로 확정 · 다음'}<ArrowRight size={17}/></button>
   </>}
   <p className="small-note">방금 읽은 뜻은 ‘원래 안다’로 계산하지 않아요.</p>
  </>}
 </div>;
}
