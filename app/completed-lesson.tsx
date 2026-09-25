"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { studyContent } from "@/lib/catalog";
import { POS,dailyReplaySources,entryIdFor,targetIdentity,type State,type Word } from "@/lib/learning";
import { DictionaryLinks,Speak } from "./ui";
import { ExpressionLine } from "./expression-line";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props={state:State;words:Word[];date:string;todayDate:string;busy:boolean;onClose:()=>void;onRepeat:(date:string)=>void};
export function CompletedLesson({state,words,date,todayDate,busy,onClose,onRepeat}:Props){
 const [index,setIndex]=useState(0);
 const scrollBody=useRef<HTMLDivElement>(null);
 const selector=useRef<HTMLButtonElement>(null);
 const wordById=useMemo(()=>new Map(words.map(word=>[word.id,word])),[words]);
 const sessions=dailyReplaySources(state,date).filter(s=>s.kind!=='daily'||s.finished).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const items=[...new Map(sessions.flatMap(s=>s.ids.map(id=>[targetIdentity(entryIdFor(s,id),s.records[id].meaning),{id:entryIdFor(s,id),record:s.records[id]}] as const))).values()];
 const currentIndex=Math.min(index,Math.max(0,items.length-1));
 const item=items[currentIndex];const word=wordById.get(item?.id);const content=word?studyContent(word.id,item?.record,state.progress[word.id]):undefined;
 useLayoutEffect(()=>{ if(scrollBody.current)scrollBody.current.scrollTop=0; },[currentIndex,date]);
 const resuming=Object.values(state.sessions).some(s=>s.practiceMode==='repeat'&&s.period===date&&!s.finished);
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="completed-lesson framed-dialog"><DialogHeader><DialogTitle>{date===todayDate?'오늘 단어 다시 보기':date+' 단어 다시 보기'}</DialogTitle><DialogDescription>저장된 뜻·표현을 확인해요. 성적은 바뀌지 않아요.</DialogDescription></DialogHeader>
  {!!items.length&&<nav className="replay-controls" aria-label="다시 볼 단어 이동">
   <button className="icon-button" aria-label="이전" disabled={currentIndex===0} onClick={()=>{setIndex(currentIndex-1);if(currentIndex===1)selector.current?.focus();}}><ArrowLeft size={18}/></button>
   <Select value={String(currentIndex)} onValueChange={value=>setIndex(Number(value))}><SelectTrigger ref={selector} aria-label="다시 볼 단어 선택"><SelectValue>{currentIndex+1} / {items.length} · {word?.word}</SelectValue></SelectTrigger><SelectContent className="replay-options" position="popper">{items.map((entry,i)=>{const candidate=wordById.get(entry.id);return <SelectItem value={String(i)} key={targetIdentity(entry.id,entry.record.meaning)}>{i+1}. {candidate?.word} · {candidate?POS[candidate.pos]:''} · {entry.record.meaning||'뜻 미기록'}</SelectItem>;})}</SelectContent></Select>
   <button className="icon-button" aria-label="다음" disabled={currentIndex===items.length-1} onClick={()=>{setIndex(currentIndex+1);if(currentIndex===items.length-2)selector.current?.focus();}}><ArrowRight size={18}/></button>
   <span role="status" className="sr-only">{currentIndex+1} / {items.length} · {word?.word} · {word?POS[word.pos]:''} · {item?.record.meaning}</span>
  </nav>}
  <div ref={scrollBody} className="dialog-scroll">
  {item&&word&&content?<>{sessions[0]?.kind==='practice'&&<p className="small-note">원래 일일 학습일이 변경되어, 이 다시 학습 회차에 보관된 단어를 보여 드려요.</p>}
   <div className="completed-word"><div className="word-stage compact"><span className="word-index">{word.personal?'개인 추가':`OXFORD ${word.level}`} · {POS[word.pos]}</span><h3 lang="en">{word.word}<Speak text={word.word}/></h3>{content.ipa&&<span className="phonetic">{content.ipa}</span>}</div>
    <p className="eyebrow">그날 공부한 뜻</p><p className="review-meaning">{item.record?.meaning||'기록된 뜻이 없어요.'}</p>
    <ExpressionLine expression={content.expression} translation={content.expressionTranslation}/>
    <div className="example-box"><div className="example-label"><BookOpen size={15}/><span>{content.source}</span></div><p lang="en">{content.example}</p><p className="translation">{content.translation}</p>{content.attribution&&<a className="source-credit" href={content.url} target="_blank" rel="noreferrer">{content.attribution}</a>}</div>
    {(item.record.sentence||item.record.notes)&&<div className="review-my-sentence">{item.record.sentence&&<><b>그날 쓴 내 문장</b><p lang="en">{item.record.sentence}</p></>}{item.record.notes&&<p className="muted">보완점 · {item.record.notes}</p>}</div>}
    <DictionaryLinks word={word.word}/>{!word.personal&&<a className="source-credit" href={`/sources/oxford-source.pdf#page=${word.page}`} target="_blank" rel="noreferrer">공식 목록 {word.page}쪽 · {word.level} · {POS[word.pos]}</a>}
   </div><p className="small-note">예문이 없는 이전 기록은 같은 뜻의 단어장 풀이를 참고해요.</p>

  </>:<p className="muted">완료한 단어 기록이 없어요.</p>}
 </div>{item&&word&&content&&<div className="dialog-actions"><button className="primary-button full" disabled={busy} onClick={()=>onRepeat(date)}><RotateCcw size={17}/>{resuming?'다시 학습 이어서':'이 단어들 다시 학습'}</button></div>}
 </DialogContent></Dialog>;
}
