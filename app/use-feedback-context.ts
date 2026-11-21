'use client';
import {useEffect,useState} from 'react';
import {feedbackContextFingerprint,FEEDBACK_CONTEXT_KINDS,type FeedbackInput,type FeedbackContextKind} from '@/lib/feedback-context';
import {usePersistentInput} from './use-persistent-input';
import {useLocalDrafts} from './local-draft-context';

// A separate, explicit AI note. Reuse the bounded owner/epoch-aware draft store;
// ordinary learning notes are never copied here or sent to the provider.
export function useFeedbackContext(domain:'word'|'grammar',targetKey:string,input:FeedbackInput,modelId:string){
  // Legacy situation notes remain in storage under their original keys.
  const key=JSON.stringify([domain==='word'?'ai-word-intent-v1':'ai-context-v4',domain,targetKey]);
  const {store}=useLocalDrafts();
  const [draft,setDraft]=useState<{key:string;note:string;kind:FeedbackContextKind;edited:boolean}>({key,note:'',kind:'sentence',edited:false});
  let {note,kind}=draft;
  if(draft.key!==key){note='';kind='sentence';setDraft({key,note,kind,edited:false});}
  const update=(value:string,nextKind:FeedbackContextKind)=>{
    // Persist an explicit empty choice as well; deleting its row would allow an
    // older tab's note to become the only draft and hydrate after a reload.
    if(value===''&&nextKind==='sentence')store?.write(key,{kind:'grammar',base:{sentence:''},values:{sentence:''}});
    setDraft({key,note:value.slice(0,500),kind:nextKind,edited:true});
  };
  const setNote=(value:string)=>update(value,kind),setKind=(value:FeedbackContextKind)=>update(note,value);
  // Use existing bounded frame storage under a new question key. Older tabs can
  // keep/clear these records without silently rewriting an unknown intent field.
  const persistent=usePersistentInput({kind:'grammar',question:key,base:{sentence:''},values:{sentence:note,...(kind!=='sentence'?{frame:[kind]}:{})},saved:false,edited:draft.key===key&&draft.edited,onRestore:values=>update(values.sentence,FEEDBACK_CONTEXT_KINDS.includes(values.frame?.[0] as FeedbackContextKind)?values.frame![0] as FeedbackContextKind:'sentence')});
  const reviewedInput={...input,...(note.trim()?{contextNote:note.trim()}: {}),...(kind!=='sentence'?{contextKind:kind}: {}),...(domain==='word'&&note.trim()?{contextRole:'intended_korean'}:{})};
  const identity=JSON.stringify([domain,targetKey,reviewedInput,modelId]);
  const [resolved,setResolved]=useState<{identity:string;fingerprint:string}|null>(null);
  useEffect(()=>{
    let current=true;
    void feedbackContextFingerprint(domain,targetKey,JSON.parse(identity)[2],modelId).then(fingerprint=>{if(current)setResolved({identity,fingerprint});}).catch(()=>{if(current)setResolved(null);});
    return()=>{current=false;};
  },[domain,targetKey,modelId,identity]);
  return {note,setNote,kind,setKind,persistent,fingerprint:resolved?.identity===identity?resolved.fingerprint:undefined};
}
