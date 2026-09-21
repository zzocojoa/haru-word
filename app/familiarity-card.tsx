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
  <div className="word-stage"><h3 ref={heading} tabIndex={-1} lang="en">{word.word}</h3><span className="muted">{POS[word.pos]} · {word.level}</span></div>
  {!pending?<>
   <p className="muted">이 품사에서 어떤 뜻인가요? 아직 뜻은 숨겨 두었어요.</p>
   <label htmlFor="familiarity-answer">내가 떠올린 뜻 <span>선택 · 머릿속으로 떠올려도 좋아요</span></label>
   <input id="familiarity-answer" value={answer} maxLength={2000} onChange={e=>setAnswer(e.target.value)} placeholder="비교할 수 있도록 짧게 적어 보세요" autoComplete="off"/>
   <p className="familiarity-prompt"><Eye size={16}/> 확인 전 생각을 고르면 뜻이 열려요.</p>
   <div className="familiarity-actions">{(['known','uncertain','new']as const).map((f,i)=><button key={f} disabled={busy} onClick={()=>onReveal(f,answer)}><span className="mark-symbol">{i===0?'✓✓':i===1?'✓':'?'}</span>{FAMILIARITY_TEXT[f]}</button>)}</div>
  </>:<>
   <section className="familiarity-comparison" aria-label="뜻 비교" aria-live="polite">
    <div><p className="eyebrow">확인 전 나의 생각</p><p className="precheck-mark">{FAMILIARITY_TEXT[pending.initial]}</p><p>{pending.answer||'머릿속으로 떠올렸어요 · 입력한 뜻 없음'}</p></div>
    <div className="revealed-meaning"><p className="eyebrow">{POS[word.pos]} · 한국어 참고 풀이</p><p className="reference-meaning">{pending.meaning||'등록된 풀이가 없어요. 아래 사전에서 확인해 주세요.'}</p></div>
   </section>
   <p className="small-note">표현이 달라도 같은 품사의 유효한 뜻이면 인정해요. 풀이가 애매하면 사전으로 확인하고 ‘헷갈림’으로 남겨도 좋아요.</p>
   <DictionaryLinks word={word.word}/>
   {pending.initial==='known'?<div className="confirmation-actions"><button className="primary-button full" disabled={busy} onClick={()=>onConfirm('known')}><Check size={17}/>생각한 뜻이 맞아요 · 안다로 확정</button><button className="secondary-button full" disabled={busy} onClick={()=>onConfirm('uncertain')}>다른 뜻이었거나 불확실해요 · 헷갈림으로 확정</button></div>:<>
    <p className="notice">{pending.initial==='new'?'방금 뜻을 처음 확인했어요. 처음 보는 단어로 기록하고 학습에서 다시 만나요.':'뜻을 보기 전에는 불확실했어요. 헷갈리는 단어로 기록하여 먼저 배워요.'}</p>
    <button className="primary-button full" disabled={busy} onClick={()=>onConfirm(pending.initial)}>{pending.initial==='new'?'처음으로 확정 · 다음':'헷갈림으로 확정 · 다음'}<ArrowRight size={17}/></button>
   </>}
   <p className="small-note">뜻을 읽은 직후의 기억은 ‘원래 안다’로 계산하지 않아요. 확정해야 다음 단어로 넘어갑니다.</p>
  </>}
 </div>;
}
