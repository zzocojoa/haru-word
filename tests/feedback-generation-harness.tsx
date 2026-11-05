import React,{useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useGrammarFeedback} from '../app/grammar/use-grammar-feedback';
import type {GrammarProgress} from '../lib/grammar/model';
import type {SentenceFeedback} from '../lib/sentence-feedback';

const sentence='I like coffee and books.',fingerprint='a'.repeat(64);
let finish:()=>void=()=>{},sent=0;
window.fetch=async(_url,init)=>{
 const input=JSON.parse(String(init?.body));sent++;
 await new Promise<void>(ok=>{finish=ok;});
 return Response.json({feedback:{original:sentence,correctedSentence:sentence,meaningUsage:'appropriate',grammar:'natural',explanation:'합성 응답',createdAt:'2026-11-05T00:00:00.000Z',provider:'openai',model:'gpt-6.1-sol',requestedModel:'gpt-6.1-sol',promptVersion:'reference-v5',validationVersion:'judgment-v6',contextFingerprint:fingerprint},receipt:{requestId:input.requestId,state:'completed',persisted:true}});
};
declare global{interface Window{feedbackGenerationQa:{sent:()=>number;finish:()=>void;invalidate:()=>void}}}
function Harness(){
 const latest=useRef<GrammarProgress>({stage:5,answers:{},sentence,updatedAt:'2026-11-05T00:00:00.000Z'});
 const [feedback,setFeedback]=useState<SentenceFeedback>();
 const api=useGrammarFeedback({lessonId:'noun',canSave:true,latest,flush:async()=>true,change:update=>{latest.current=update(latest.current);setFeedback(latest.current.feedback);},context:{expectedContextFingerprint:fingerprint}});
 useLayoutEffect(()=>{window.feedbackGenerationQa={sent:()=>sent,finish:()=>finish(),invalidate:api.invalidate};});
 return <main data-saved={feedback?'1':'0'} data-pending={String(api.pending)} data-error={api.error?.code??''}><button onClick={()=>void api.check()}>정상 요청</button></main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
