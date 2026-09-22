"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { studyContent } from "@/lib/catalog";
import { POS,dailyReplaySources,entryIdFor,targetIdentity,type State,type Word } from "@/lib/learning";
import { DictionaryLinks,Speak } from "./ui";
import { ExpressionLine } from "./expression-line";

type Props={state:State;words:Word[];date:string;todayDate:string;busy:boolean;onClose:()=>void;onRepeat:(date:string)=>void};
export function CompletedLesson({state,words,date,todayDate,busy,onClose,onRepeat}:Props){
 const [index,setIndex]=useState(0);
 const sessions=dailyReplaySources(state,date).filter(s=>s.kind!=='daily'||s.finished).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const items=[...new Map(sessions.flatMap(s=>s.ids.map(id=>[targetIdentity(entryIdFor(s,id),s.records[id].meaning),{id:entryIdFor(s,id),record:s.records[id]}] as const))).values()];
 const item=items[index];const word=words.find(w=>w.id===item?.id);const content=word?studyContent(word.id,item?.record,state.progress[word.id]):undefined;
 const resuming=Object.values(state.sessions).some(s=>s.practiceMode==='repeat'&&s.period===date&&!s.finished);
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="completed-lesson"><DialogHeader><DialogTitle>{date===todayDate?'오늘 단어 다시 보기':date+' 단어 다시 보기'}</DialogTitle><DialogDescription>완료한 기록은 그대로 두고 뜻과 표현을 다시 살펴보세요.</DialogDescription></DialogHeader>
  {item&&word&&content?<>{sessions[0]?.kind==='practice'&&<p className="small-note">원래 일일 학습일이 변경되어, 이 다시 학습 회차에 보관된 단어를 보여 드려요.</p>}<nav className="review-word-tabs" aria-label="다시 볼 단어">{items.map((entry,i)=><button className="secondary-button" key={targetIdentity(entry.id,entry.record.meaning)} aria-pressed={index===i} onClick={()=>setIndex(i)}>{words.find(w=>w.id===entry.id)?.word}</button>)}</nav>
   <div className="completed-word" aria-live="polite" aria-atomic="true"><div className="word-stage compact"><span className="word-index">{word.personal?'개인 추가':`OXFORD ${word.level}`} · {POS[word.pos]}</span><h3 lang="en">{word.word}<Speak text={word.word}/></h3>{content.ipa&&<span className="phonetic">{content.ipa}</span>}</div>
    <p className="eyebrow">그날 공부한 뜻</p><p className="review-meaning">{item.record?.meaning||'기록된 뜻이 없어요.'}</p>
    <ExpressionLine expression={content.expression} translation={content.expressionTranslation}/>
    <div className="example-box"><div className="example-label"><BookOpen size={15}/><span>{content.source}</span></div><p lang="en">{content.example}</p><p className="translation">{content.translation}</p>{content.attribution&&<a className="source-credit" href={content.url} target="_blank" rel="noreferrer">{content.attribution}</a>}</div>
    {item.record?.sentence&&<div className="review-my-sentence"><b>그날 쓴 내 문장</b><p lang="en">{item.record.sentence}</p>{item.record.notes&&<p className="muted">보완점 · {item.record.notes}</p>}</div>}
    <DictionaryLinks word={word.word}/>{!word.personal&&<a className="source-credit" href={`/sources/oxford-source.pdf#page=${word.page}`} target="_blank" rel="noreferrer">공식 목록 {word.page}쪽 · {word.level} · {POS[word.pos]}</a>}
   </div><div className="review-card-navigation"><button className="secondary-button" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={16}/>이전</button><span>{index+1} / {items.length}</span><button className="secondary-button" disabled={index===items.length-1} onClick={()=>setIndex(i=>i+1)}>다음<ArrowRight size={16}/></button></div>
   <p className="small-note">저장된 뜻·예문·내 문장을 다시 살펴봐요. 예문이 없는 이전 기록은 같은 뜻의 단어장 풀이를 참고해요. 다시 보기만으로는 학습 결과가 바뀌지 않아요.</p>
   <button className="primary-button full" disabled={busy} onClick={()=>onRepeat(date)}><RotateCcw size={17}/>{resuming?'다시 학습 이어서':'이 단어들 다시 학습'}</button>
  </>:<p className="muted">완료한 단어 기록이 없어요.</p>}
 </DialogContent></Dialog>;
}
