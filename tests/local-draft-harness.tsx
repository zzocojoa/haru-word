// Synthetic data only. The QA server simulates failed writes and AI receipts.
import React,{useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EMPTY,emptyRecord,type Session,type State} from '../lib/learning';
import {newLessonProgress} from '../lib/grammar/practice';
import {updateGrammarSentence,type GrammarProgress} from '../lib/grammar/model';
import {GRAMMAR_LESSONS} from '../lib/grammar/content';
import {LocalDraftProvider,useLocalDrafts} from '../app/local-draft-context';
import {LocalDraftSettings} from '../app/local-draft-settings';
import {DraftRecoveryNotice} from '../app/draft-recovery-notice';
import {useStudyDraft} from '../app/study/use-study-draft';
import {useGrammarDraft} from '../app/grammar/use-grammar-draft';
import {useGrammarFeedback} from '../app/grammar/use-grammar-feedback';
import {GrammarWriting} from '../app/grammar/grammar-writing';
import {SentenceFeedbackPanel} from '../app/sentence-feedback';
import {AiRequestProvider} from '../app/ai-request-context';
import type {SentenceFeedback} from '../lib/sentence-feedback';
import {latestFeedback} from '../lib/recoverable-feedback';
const params=new URLSearchParams(location.search),mode=params.get('mode')??'word',initial=params.get('sentence')??'Saved synthetic sentence.';
const stage=params.get('stage')==='en'?'en':'sentence',requests=params.get('requests')==='1';
const date='2026-11-03',createdAt=date+'T00:00:00.000Z';
const seed:SentenceFeedback={original:'Saved synthetic sentence.',correctedSentence:'A prior synthetic proposal.',meaningUsage:'appropriate',grammar:'needs_work',explanation:'합성 과거 의견',model:'gpt-6.1-sol',provider:'openai',requestedModel:'gpt-6.1-sol',promptVersion:'reference-v1',validationVersion:'structured-v1',createdAt};
const session=():Session=>({id:'a1111111-1111-4111-8111-111111111111',kind:'daily',date,period:date,createdAt,ids:['synthetic'],warmupIds:[],stage,index:0,retry:[],retryMode:false,elapsed:0,finished:false,paused:false,
 records:{synthetic:{...emptyRecord('합성 뜻'),sentence:initial,en:'independent',enAnswer:'First synthetic answer.',ko:'help',koAnswer:'First second answer.',aiFeedback:seed}}});
const grammar=():GrammarProgress=>({...newLessonProgress('auxiliary',createdAt,4),stage:5,sentence:initial,
 observation:{first:'First observation.',latest:'First observation.',attempts:1,helped:false},answers:Object.fromEntries(['q1','q2','q3'].map(k=>[k,{first:'First '+k,latest:'Latest '+k,attempts:2,helped:true}])),feedback:initial===seed.original?seed:undefined});
declare global{interface Window{draftHarness:{switchOwner:(id:string)=>void;snapshot:()=>unknown;clear:()=>void;invalidate:()=>void}}}
window.draftHarness={switchOwner:()=>{},snapshot:()=>null,clear:()=>{},invalidate:()=>{}};
function Controls({snapshot}:{snapshot:unknown}){
 const {store,state}=useLocalDrafts();
 useLayoutEffect(()=>{window.draftHarness.snapshot=()=>({source:snapshot,storage:store?.getSnapshot()??state,ownerMarker:localStorage.getItem('haru-words:local-input-owner:v1'),rows:store?.list()});window.draftHarness.clear=()=>{store?.clear();};window.draftHarness.invalidate=()=>{store?.invalidate();};},[snapshot,store,state]);
 return <output aria-label="보관 항목 수">{state.count}</output>;
}
function Word(){
 const [server,setServer]=useState(session),[saved,setSaved]=useState(false);
 const draft=useStudyDraft(server,'synthetic',undefined,undefined,saved);
 return <><label>내 문장<textarea value={draft.draft.sentence} onChange={e=>{setSaved(false);draft.setSentence(e.target.value);}}/></label>
 <label>작성 중 답<input value={draft.draft.answer} onChange={e=>draft.setAnswer(e.target.value)}/></label>
 <label><input type="checkbox" checked={draft.draft.hint} onChange={e=>draft.setHint(e.target.checked)}/>도움 사용 표시</label>
 <DraftRecoveryNotice input={draft.persistent}/>
 <SentenceFeedbackPanel sessionId={server.id} entryId="synthetic" target={{word:'synthetic',pos:'adj.',meaning:'합성의',expression:'synthetic'}} sentence={draft.draft.sentence} feedback={draft.persistent.lastFeedback} busy={false} onPending={draft.setAiPending}
  onFeedback={async feedback=>{setServer(s=>({...s,records:{...s.records,synthetic:{...s.records.synthetic,sentence:draft.draft.sentence,aiFeedback:feedback}}}));setSaved(true);return true;}} onUse={draft.setSentence}/>
 <button onClick={()=>{setServer(s=>({...s,records:{...s.records,synthetic:{...s.records.synthetic,sentence:draft.draft.sentence}}}));setSaved(true);}}>저장 완료로 확인</button>
 <Controls snapshot={{mode,server,values:draft.draft}}/></>;
}
function Grammar(){
 const root=useRef<State>({...structuredClone(EMPTY),grammar:{auxiliary:grammar()}});
 const draft=useGrammarDraft('auxiliary',{currentState:root,save:async()=>false,stage:(_id,p)=>{root.current={...root.current,grammar:{auxiliary:p}};},canSave:false,saved:false,registerLeave:()=>()=>{}},true,4);
 const ai=useGrammarFeedback({lessonId:'auxiliary',contentVersion:4,latest:draft.latest,change:draft.change,flush:requests?async()=>true:draft.flush,canSave:requests});
 const changeSentence=(value:string)=>{ai.invalidate();draft.change(p=>updateGrammarSentence(p,value));};
 return <><DraftRecoveryNotice input={draft.persistent}/><GrammarWriting lesson={GRAMMAR_LESSONS.find(l=>l.id==='auxiliary')!} progress={draft.draft} retainedFeedback={latestFeedback(draft.persistent.lastFeedback,ai.retainedFeedback)}
  canSave={true} aiPending={ai.pending} recoveryPending={ai.recoveryPending} aiError={ai.error} onAi={ai.check} onSentence={changeSentence} onCheck={()=>{}} onChecks={()=>{}} onFrame={()=>{}} onExplain={()=>{}} onComplete={()=>{}}/>
 <Controls snapshot={{mode,progress:draft.draft}}/></>;
}
function Harness(){
 const [owner,setOwner]=useState(params.get('owner')??'synthetic-owner');
 useLayoutEffect(()=>{window.draftHarness.switchOwner=setOwner;},[]);
 return <LocalDraftProvider ownerId={owner}><AiRequestProvider modelId="gpt-6.1-sol"><main><h1>합성 초안 검사</h1>{mode==='grammar'?<Grammar/>:<Word/>}<LocalDraftSettings busy={false}/></main></AiRequestProvider></LocalDraftProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
