"use client";
import {Loader2,Sparkles} from 'lucide-react';
import {GRAMMAR_TEXT,MEANING_USAGE_TEXT,type SentenceFeedback} from '@/lib/sentence-feedback';
import {useSentenceFeedback} from './study/use-sentence-feedback';
import {FeedbackIssueNotice} from './feedback-issue-notice';
import {AiUseNotice} from './ai-use-notice';
import {FeedbackAttribution} from './feedback-attribution';

export function FeedbackDetail({feedback}:{feedback:SentenceFeedback}){
 return <div className="ai-feedback-result">
  <div className="feedback-assessments"><span>{MEANING_USAGE_TEXT[feedback.meaningUsage]}</span><span>{GRAMMAR_TEXT[feedback.grammar]}</span></div>
  <p className="small-note">검토한 원문</p><p lang="en">{feedback.original}</p>
  {feedback.correctedSentence&&<><p className="small-note">AI 교정 제안</p><p className="corrected-sentence" lang="en">{feedback.correctedSentence}</p></>}
  <p>{feedback.explanation}</p>
  <FeedbackAttribution feedback={feedback}/>
 </div>;
}

type Props={sessionId:string;entryId:string;sentence:string;feedback?:SentenceFeedback;busy:boolean;onPending:(value:boolean)=>void;onFeedback:(feedback:SentenceFeedback)=>Promise<boolean>;onUse:(sentence:string)=>void};
export function SentenceFeedbackPanel({sessionId,entryId,sentence,feedback,busy,onPending,onFeedback,onUse}:Props){
 const {pending,error,check}=useSentenceFeedback({sessionId,entryId,sentence,busy,onPending,onFeedback});
 const unchanged=feedback?.original===sentence.trim();
 return <section className="ai-feedback-panel" aria-label="AI 문장 점검">
  <div className="ai-feedback-heading"><h3><Sparkles size={17}/> AI 문장 점검</h3><span className="small-note">선택</span></div>
  <AiUseNotice />
  <button type="button" className="secondary-button" disabled={busy||pending||!sentence.trim()||unchanged} onClick={check}>{pending?<><Loader2 size={16} className="spin"/>문장을 확인하고 있어요</>:unchanged?'이 문장의 교정 결과가 있어요':'AI로 문장 점검'}</button>
  <FeedbackIssueNotice issue={error}/>
  {feedback&&<div aria-live="polite">
   {!unchanged&&<p className="notice">수정 전 문장의 교정 결과예요.</p>}
   <FeedbackDetail feedback={feedback}/>
   {feedback.correctedSentence&&feedback.correctedSentence!==sentence.trim()&&<button className="text-button" disabled={busy||pending} onClick={()=>onUse(feedback.correctedSentence)}>교정 제안을 내 문장에 적용</button>}
  </div>}
 </section>;
}
