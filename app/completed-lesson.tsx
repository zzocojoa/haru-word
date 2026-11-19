"use client";
import {HaruParagraph,HaruHeading} from './haru-content';
import {HaruIconButton,HaruButton,HaruSelector} from './haru-controls';

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { studyContent } from "@/lib/catalog";
import { POS,dailyReplaySources,entryIdFor,targetIdentity,type State,type Word } from "@/lib/learning";
import { DictionaryLinks } from "./ui";
import { WordPronunciation } from './word-pronunciation';
import { ExpressionLine } from "./expression-line";
import { GrammarTermsHelp, PartOfSpeechLabel } from './grammar-terms';
import { RecordText } from './record-text';
export type CompletedLessonProps={state:State;words:Word[];date:string;todayDate:string;busy:boolean;onClose:()=>void;onRepeat:(date:string)=>void};
export function CompletedLesson({state,words,date,busy,onRepeat}:CompletedLessonProps){
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
 return <>
  {!!items.length&&<nav className="replay-controls" aria-label="다시 볼 단어 이동">
   <HaruIconButton label="이전" icon={<ArrowLeft size={18}/>} className="haru-migrated haru-native-action icon-button" aria-label="이전" disabled={currentIndex===0} onClick={()=>{setIndex(currentIndex-1);if(currentIndex===1)selector.current?.focus();}}></HaruIconButton>
   <HaruSelector label="다시 볼 단어 선택" isLabelHidden ref={selector} containerClassName="haru-replay-selector" controlClassName="replay-selector" value={String(currentIndex)} onChange={value=>setIndex(Number(value))}
    renderValue={()=>currentIndex+1+' / '+items.length+' · '+(word?.word??'')}
    options={items.map((entry,i)=>{const candidate=wordById.get(entry.id);return {value:String(i),label:(i+1)+'. '+(candidate?.word??'')+' · '+(candidate?POS[candidate.pos]:'')+' · '+(entry.record.meaning||'뜻 미기록')};})} />
   <HaruIconButton label="다음" icon={<ArrowRight size={18}/>} className="haru-migrated haru-native-action icon-button" aria-label="다음" disabled={currentIndex===items.length-1} onClick={()=>{setIndex(currentIndex+1);if(currentIndex===items.length-2)selector.current?.focus();}}></HaruIconButton>
   <span role="status" className="sr-only">{currentIndex+1} / {items.length} · {word?.word} · {word?POS[word.pos]:''} · {item?.record.meaning}</span>
  </nav>}
  <div ref={scrollBody} className="dialog-scroll">
  {item&&word&&content?<>{sessions[0]?.kind==='practice'&&<HaruParagraph className="small-note">원래 일일 학습일이 변경되어, 이 다시 학습 회차에 보관된 단어를 보여 드려요.</HaruParagraph>}
   <div className="completed-word"><div className="word-stage compact"><span className="word-index">{word.personal?'개인 추가':`OXFORD ${word.level}`} · <PartOfSpeechLabel pos={word.pos}/></span><HaruHeading level={3} lang="en">{word.word}</HaruHeading><WordPronunciation word={word} meaning={item.record.meaning}/></div>
    <GrammarTermsHelp pos={word.pos}/>
    <HaruParagraph className="eyebrow">그날 공부한 뜻</HaruParagraph><div className="review-meaning"><RecordText text={item.record?.meaning||'기록된 뜻이 없어요.'} label="저장한 뜻" /></div>
    <ExpressionLine expression={content.expression} translation={content.expressionTranslation}/>
    <div className="example-box"><div className="example-label"><BookOpen size={15}/><span>{content.source}</span></div><HaruParagraph lang="en">{content.example}</HaruParagraph><HaruParagraph className="translation">{content.translation}</HaruParagraph>{content.attribution&&<a className="source-credit" href={content.url} target="_blank" rel="noreferrer">{content.attribution}</a>}</div>
    {(item.record.sentence||item.record.notes)&&<div className="review-my-sentence">{item.record.sentence&&<><b>그날 쓴 내 문장</b><div><RecordText text={item.record.sentence} label="내 문장" lang="en" /></div></>}{item.record.notes&&<div className="muted">보완점 · <RecordText text={item.record.notes} label="보완점" /></div>}</div>}
    <DictionaryLinks word={word.word}/>{!word.personal&&<a className="source-credit" href={`/sources/oxford-source.pdf#page=${word.page}`} target="_blank" rel="noreferrer">공식 목록 {word.page}쪽 · {word.level} · {POS[word.pos]}</a>}
   </div><HaruParagraph className="small-note">예문이 없는 이전 기록은 같은 뜻의 단어장 풀이를 참고해요.</HaruParagraph>

  </>:<HaruParagraph className="muted">완료한 단어 기록이 없어요.</HaruParagraph>}
 </div>{item&&word&&content&&<div className="dialog-actions"><HaruButton label={[(resuming?'다시 학습 이어서':'이 단어들 다시 학습')].join('')} variant="primary" icon={<RotateCcw size={17}/>} className="haru-migrated primary-button full" disabled={busy} onClick={()=>onRepeat(date)}>{resuming?'다시 학습 이어서':'이 단어들 다시 학습'}</HaruButton></div>}
 </>;
}
