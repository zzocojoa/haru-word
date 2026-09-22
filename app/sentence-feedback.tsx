"use client";
import {useEffect,useRef,useState} from 'react';
import {Loader2,Sparkles} from 'lucide-react';
import {GRAMMAR_TEXT,MEANING_USAGE_TEXT,sentenceFeedbackSchema,type SentenceFeedback} from '@/lib/sentence-feedback';
import {requestJson,RequestTimeoutError,REQUEST_TIMEOUT_MS} from '@/lib/client-request';

export function FeedbackDetail({feedback}:{feedback:SentenceFeedback}){
 return <div className="ai-feedback-result">
  <div className="feedback-assessments"><span>{MEANING_USAGE_TEXT[feedback.meaningUsage]}</span><span>{GRAMMAR_TEXT[feedback.grammar]}</span></div>
  <p className="small-note">검토한 원문</p><p lang="en">{feedback.original}</p>
  {feedback.correctedSentence&&<><p className="small-note">AI 교정 제안</p><p className="corrected-sentence" lang="en">{feedback.correctedSentence}</p></>}
  <p>{feedback.explanation}</p>
  <p className="small-note">Google Gemini · AI 참고 의견 · 최종 기록은 직접 확인해 주세요.</p>
 </div>;
}

type Props={sessionId:string;entryId:string;sentence:string;feedback?:SentenceFeedback;busy:boolean;onPending:(value:boolean)=>void;onFeedback:(feedback:SentenceFeedback)=>Promise<boolean>;onUse:(sentence:string)=>void};
export function SentenceFeedbackPanel({sessionId,entryId,sentence,feedback,busy,onPending,onFeedback,onUse}:Props){
 const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const request=useRef<AbortController|null>(null);const lock=useRef(false);
 useEffect(()=>()=>{request.current?.abort()},[]);
 async function check(){
  if(lock.current||busy||!sentence.trim())return;
  lock.current=true;setPending(true);onPending(true);setError('');
  const controller=new AbortController();request.current=controller;
  try{
   const {response,data}=await requestJson<{error?:unknown;feedback?:unknown}>('/api/sentence-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,entryId,sentence:sentence.trim()}),signal:controller.signal},REQUEST_TIMEOUT_MS.feedback);
   if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'AI 응답을 받지 못했어요. 자기 점검으로 계속해 주세요.');
   const parsed=sentenceFeedbackSchema.safeParse(data.feedback);
   if(!parsed.success)throw new Error('AI 교정 형식을 확인하지 못했어요. 자기 점검으로 계속해 주세요.');
   const result=parsed.data;
   if(controller.signal.aborted)return;
   if(result.original!==sentence.trim())throw new Error('다른 문장의 교정 결과입니다. 다시 확인해 주세요.');
   // The shared save banner owns persistence errors and clears them after retry.
   await onFeedback(result);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof RequestTimeoutError?'AI 응답이 늦어 기다림을 끝냈어요. 문장은 그대로 남아 있으니 자기 점검으로 계속해 주세요. 요청은 사용량에 포함될 수 있어요.':e instanceof Error&&!(e instanceof SyntaxError)&&!(e instanceof TypeError)?e.message:'AI 응답을 확인하지 못했어요. 자기 점검으로 계속해 주세요.')}
  finally{lock.current=false;if(!controller.signal.aborted){setPending(false);onPending(false)}}
 }
 const unchanged=feedback?.original===sentence.trim();
 return <section className="ai-feedback-panel" aria-label="AI 문장 점검">
  <div className="ai-feedback-heading"><h3><Sparkles size={17}/> AI 문장 점검</h3><span className="small-note">선택</span></div>
  <p className="small-note">버튼을 누르면 이 문장과 목표 단어·뜻을 Google에 보내요. 무료 API의 입력·응답은 Google의 서비스 개선에 사용될 수 있어요. 개인정보는 빼고 작성해 주세요.</p>
  <button type="button" className="secondary-button" disabled={busy||pending||!sentence.trim()||unchanged} onClick={check}>{pending?<><Loader2 size={16} className="spin"/>문장을 확인하고 있어요</>:unchanged?'이 문장의 교정 결과가 있어요':'AI로 문장 점검'}</button>
  <p className="small-note">앱 자체 횟수 제한 없이 사용해요. Google의 실제 한도에 도달하거나 오류가 있으면 자기 점검으로 계속할 수 있어요.</p>
  {error&&<p role="alert" className="notice">{error}</p>}
  {feedback&&<div aria-live="polite">
   {!unchanged&&<p className="notice">문장이 바뀌었어요. 아래 결과는 수정 전 원문에 대한 의견입니다.</p>}
   <FeedbackDetail feedback={feedback}/>
   {feedback.correctedSentence&&feedback.correctedSentence!==sentence.trim()&&<button className="text-button" disabled={busy||pending} onClick={()=>onUse(feedback.correctedSentence)}>교정 제안을 내 문장에 적용</button>}
  </div>}
 </section>;
}
