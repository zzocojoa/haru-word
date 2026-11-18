// Isolated synthetic interaction harness: provider and account traffic never leave this page.
import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SentenceFeedbackPanel } from '../app/sentence-feedback';
import { GrammarWriting } from '../app/grammar/grammar-writing';
import { AiRequestProvider } from '../app/ai-request-context';
import { GRAMMAR_LESSONS } from '../lib/grammar/content';
import type { SentenceFeedback } from '../lib/sentence-feedback';
import {LocalDraftProvider,useLocalDrafts} from '../app/local-draft-context';
import {feedbackContextFingerprint,wordFeedbackInput} from '../lib/feedback-context';
import {grammarFeedbackInput} from '../lib/grammar/feedback-input';
import {parseJudgmentFeedback} from '../lib/judgment-feedback-contract';
import {FeedbackDetail} from '../app/feedback-detail';
import {AI_PROMPT_VERSION,AI_VALIDATION_VERSION} from '../lib/ai-models';

const seed: SentenceFeedback = { original:'She sing well.',correctedSentence:'She sings well.',meaningUsage:'appropriate',grammar:'needs_work',explanation:'합성 교정 설명',
 model:'gpt-6.1-sol',provider:'openai',requestedModel:'gpt-6.1-sol',promptVersion:AI_PROMPT_VERSION,validationVersion:AI_VALIDATION_VERSION,contextNote:'그녀는 노래를 잘해.',createdAt:'2026-11-03T00:00:00.000Z' };
let wordFingerprint='',grammarFingerprint='';
type Mode='word'|'grammar'|'reference';
type Controls={reset:(mode:Mode,sentence?:string,uncertain?:boolean)=>void;showReference:(version:4|5,kind:'time'|'relationship')=>void;setSentence:(value:string)=>void;changeProposal:()=>void;setBusy:(value:boolean)=>void;setDelay:(value:boolean)=>void;finish:()=>void;requests:()=>number};
declare global { interface Window { correctionHarness: Controls } }
let requestCount=0,delay=false,finishPending:(()=>void)|null=null;
window.fetch=async(_url,init)=>{
 if(init?.method!=='POST')return Response.json({});
 requestCount++;const input=JSON.parse(String(init.body));
 if(delay)await new Promise<void>(resolve=>{finishPending=resolve;});
 return Response.json({feedback:{...seed,contextFingerprint:input.expectedContextFingerprint,original:input.sentence,correctedSentence:'',meaningUsage:'uncertain',grammar:'uncertain',explanation:'합성 보류 응답',createdAt:new Date().toISOString()},receipt:{requestId:input.requestId,state:'completed',persisted:true}});
};
function ConfirmedSyntheticOwner(){
 const {store}=useLocalDrafts();
 // This isolated fixture has a fixed synthetic identity and no account API.
 // Built account confirmation is covered separately; keep the real guard.
 useLayoutEffect(()=>{store?.connect();store?.confirmOwner();},[store]);
 return null;
}
function Harness(){
 const [mode,setMode]=useState<Mode>('word'),[epoch,setEpoch]=useState(0),[sentence,setSentence]=useState(seed.original);
 const [feedback,setFeedback]=useState<SentenceFeedback|undefined>(seed),[busy,setBusy]=useState(false),[pending,setPending]=useState(false);
 useLayoutEffect(()=>{window.correctionHarness={
  reset:(nextMode,value=seed.original,uncertain=false)=>{setMode(nextMode);setEpoch(n=>n+1);setSentence(value);setFeedback({...seed,contextFingerprint:nextMode==='word'?wordFingerprint:grammarFingerprint,...(uncertain?{grammar:'uncertain',meaningUsage:'uncertain',correctedSentence:''}:{})});setBusy(false);setPending(false);requestCount=0;delay=false;finishPending=null;},
  showReference:(version,kind)=>{
   const original=kind==='time'?'You might brought a torch.':'Although the broth';
   const content=version===5?parseJudgmentFeedback(JSON.stringify({meaningUsage:kind==='time'?'needs_work':'uncertain',grammar:'uncertain',correctedSentence:'',targetReason:'합성 목표 검사',grammarReason:'합성 문맥 검사',correctionReason:'',contextNeeded:kind}),original,'gpt-6.1-sol')
    :{...seed,original,meaningUsage:'uncertain' as const,grammar:'uncertain' as const,correctedSentence:'',explanation:'보관된 v4 합성 설명과 질문을 유지합니다.'};
   setMode('reference');setEpoch(n=>n+1);setFeedback({...content,promptVersion:'reference-v'+version,validationVersion:'judgment-v'+version});
  },
  setSentence,changeProposal:()=>setFeedback({...seed,correctedSentence:'She sings a song.',createdAt:'2026-11-03T00:00:01.000Z'}),setBusy,
  setDelay:value=>{delay=value;},finish:()=>{finishPending?.();finishPending=null;},requests:()=>requestCount,
 };},[]);
 const answer={first:'synthetic first',latest:'synthetic latest',attempts:1,helped:false};
 const changeGrammar=(value:string)=>{setSentence(value);setFeedback(undefined);};
 return <LocalDraftProvider ownerId={'correction-harness-'+epoch}><ConfirmedSyntheticOwner/><AiRequestProvider modelId="gpt-6.1-sol"><main key={epoch} data-harness-epoch={epoch}>
  {mode==='word'?<><label>내 문장<textarea value={sentence} onChange={e=>setSentence(e.target.value)} /></label>
   <SentenceFeedbackPanel sessionId="a1111111-1111-4111-8111-111111111111" entryId="synthetic-entry" target={{word:'sing',pos:'v.',meaning:'노래하다',expression:'sing'}} sentence={sentence} feedback={feedback} busy={busy} onPending={setPending} onFeedback={async value=>{setFeedback(value);return true;}} onUse={setSentence} /></>
   :mode==='reference'?feedback&&<FeedbackDetail feedback={feedback} grammarTarget />:<GrammarWriting lesson={GRAMMAR_LESSONS.find(l=>l.id==='auxiliary')!} currentModelId="gpt-6.1-sol" contextFingerprint={sentence===seed.original?grammarFingerprint:undefined} progress={{stage:5,sentence,feedback,answers:{q1:answer,q2:answer,q3:answer},updatedAt:seed.createdAt}}
     canSave={!busy} aiPending={pending} aiError={null} onAi={()=>{requestCount++;}} onSentence={changeGrammar} onCheck={()=>{}} onChecks={()=>{}} onFrame={()=>{}} onExplain={()=>{}} onComplete={()=>{}} />}
 </main></AiRequestProvider></LocalDraftProvider>;
}
async function start(){
 wordFingerprint=await feedbackContextFingerprint('word',JSON.stringify(['a1111111-1111-4111-8111-111111111111','synthetic-entry']),wordFeedbackInput({word:'sing',pos:'v.'},'노래하다',seed.original,seed.contextNote,'sing','sentence','intended_korean'),'gpt-6.1-sol');
 grammarFingerprint=await feedbackContextFingerprint('grammar',JSON.stringify(['auxiliary',1]),grammarFeedbackInput(GRAMMAR_LESSONS.find(l=>l.id==='auxiliary')!,seed.original),'gpt-6.1-sol');
 seed.contextFingerprint=wordFingerprint;
 createRoot(document.getElementById('root')!).render(<Harness />);
}
void start();
