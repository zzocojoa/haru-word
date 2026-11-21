'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import type {SentenceFeedback} from '@/lib/sentence-feedback';
import {draftFingerprint,type DraftChoice,type DraftPayload,type WordDraftValues,type GrammarDraftValues} from '@/lib/local-learning-drafts';
import {useLocalDrafts} from './local-draft-context';
type Values=WordDraftValues|GrammarDraftValues;
const rowPayload=(row:DraftChoice)=>row.record.kind==='request'?draftFingerprint(row.record.values):draftFingerprint({kind:row.record.kind,base:row.record.base,values:row.record.values,...(row.record.lastFeedback?{lastFeedback:row.record.lastFeedback}:{})});
function distinctRows(rows:DraftChoice[]){const seen=new Set<string>();return rows.filter(row=>{const key=rowPayload(row);if(seen.has(key))return false;seen.add(key);return true;});}
type Options=({kind:'word';base:WordDraftValues;values:WordDraftValues;onRestore:(values:WordDraftValues)=>WordDraftValues|void}
  |{kind:'grammar';base:GrammarDraftValues;values:GrammarDraftValues;onRestore:(values:GrammarDraftValues)=>GrammarDraftValues|void})
  &{question:string;saved:boolean;edited:boolean;feedback?:SentenceFeedback;enabled?:boolean};
function restoreInput(options:Options,row:DraftChoice){
  if(row.record.kind!=='request'&&draftFingerprint(options.values)===draftFingerprint(row.record.values))return options.values;
  if(options.kind==='word'&&row.record.kind==='word')return options.onRestore(row.record.values)??row.record.values;
  if(options.kind==='grammar'&&row.record.kind==='grammar')return options.onRestore(row.record.values)??row.record.values;
  return false;
}
export function usePersistentInput(options:Options){
  const {store,state}=useLocalDrafts(),key=options.kind+':'+options.question;
  const fresh=()=>({key,base:options.base as Values,observed:draftFingerprint(options.feedback),lastFeedback:options.feedback,
    restored:false,source:null as DraftChoice|null,cleared:state.cleared,clearedInput:null as string|null});
  const [snapshot,setSnapshot]=useState(fresh);
  const attemptedKey=useRef<string|null>(null);
  let active=snapshot;
  if(active.key!==key){active=fresh();setSnapshot(active);}
  if(active.cleared!==state.cleared){active={...active,cleared:state.cleared,source:null,restored:false,lastFeedback:options.feedback,clearedInput:draftFingerprint(options.values)};setSnapshot(active);}
  if(active.clearedInput!==null&&active.clearedInput!==draftFingerprint(options.values)){active={...active,clearedInput:null};setSnapshot(active);}
  const observed=draftFingerprint(options.feedback);
  if(active.observed!==observed){active={...active,observed,lastFeedback:options.feedback??active.lastFeedback};setSnapshot(active);}
  const valuesFingerprint=draftFingerprint(options.values),serverFingerprint=draftFingerprint(options.base);
  const lastFeedback=active.lastFeedback;
  const payloadFingerprint=draftFingerprint({kind:options.kind,base:options.saved&&valuesFingerprint===serverFingerprint?options.base:active.base,values:options.values,...(lastFeedback?{lastFeedback}:{})});
  const ready=state.ready,available=state.available,ownerActive=state.active,cleared=state.cleared;
  const {kind,question,saved,enabled}=options;
  const initialBaseFingerprint=draftFingerprint(active.base),feedbackFingerprint=draftFingerprint(lastFeedback),source=active.source,restored=active.restored,clearedInput=active.clearedInput;
  useLayoutEffect(()=>{
    if(!store||!ready||!available||enabled===false||attemptedKey.current===key)return;
    // A later commit, edit or unmount cancels hydration before it can alter the
    // form. Only this external callback updates form state, never render itself.
    let current=true;
    queueMicrotask(()=>{
      if(!current||attemptedKey.current===key)return;
      attemptedKey.current=key;
      if(options.edited||valuesFingerprint!==serverFingerprint||!store.refresh())return;
      const rows=distinctRows(store.list(question,kind)),only=rows.length===1?rows[0]:null;
      const needsRestore=only&&only.record.kind!=='request'&&(draftFingerprint(only.record.values)!==serverFingerprint
        ||only.record.lastFeedback&&draftFingerprint(only.record.lastFeedback)!==observed);
      if(only&&only.record.kind!=='request'&&needsRestore&&draftFingerprint(only.record.base)===serverFingerprint){
        const applied=restoreInput(options,only);
        const retained=only.record.lastFeedback;
        if(applied)setSnapshot(previous=>({...previous,source:only,restored:true,lastFeedback:retained??previous.lastFeedback}));
      }
    });
    return()=>{current=false;};
  },[store,ready,available,enabled,key,question,kind,serverFingerprint,valuesFingerprint,observed,options]);
  useLayoutEffect(()=>{
    if(!store||!ready||!available||!ownerActive||enabled===false||clearedInput===valuesFingerprint)return;
    const feedbackMatches=feedbackFingerprint==='null'||feedbackFingerprint===observed;
    if(saved&&valuesFingerprint===serverFingerprint&&feedbackMatches){
      for(const row of store.list(question,kind))if(row.record.kind!=='request'&&draftFingerprint(row.record.values)===serverFingerprint
        &&(!row.record.lastFeedback||draftFingerprint(row.record.lastFeedback)===observed))store.remove(row.id,row.record);
      return;
    }
    if(valuesFingerprint!==initialBaseFingerprint||restored||!feedbackMatches){
      // Only a page that explicitly closed may hand off its row. A crashed or
      // still-open tab retains its variant; identical copies are one choice.
      if(store.write(question,JSON.parse(payloadFingerprint) as DraftPayload)&&source&&source.record.instanceId!==store.instanceId&&!store.isInstanceActive(source.record.instanceId))store.remove(source.id,source.record);
    }
  },[store,ready,available,ownerActive,cleared,clearedInput,key,payloadFingerprint,saved,enabled,serverFingerprint,valuesFingerprint,initialBaseFingerprint,feedbackFingerprint,observed,question,kind,source,restored]);
  function captureAcknowledgement(){
    const rows=store?.refresh()?store.list(question,kind).filter(row=>row.record.kind!=='request'&&row.record.instanceId===store.instanceId
      &&draftFingerprint(row.record.values)===valuesFingerprint):[];
    // The response may arrive after this question has unmounted. Compare the
    // exact captured row again; newer edits and other page instances survive.
    return (ok:boolean)=>{if(ok)for(const row of rows)store?.remove(row.id,row.record);};
  }
  return {lastFeedback,captureAcknowledgement,storage:{...state,enabled:!!store?.owner,retry:()=>store?.retry()}};
}
export type InputRecovery=ReturnType<typeof usePersistentInput>;
