'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import type {SentenceFeedback} from '@/lib/sentence-feedback';
import {draftFingerprint,type DraftChoice,type DraftPayload,type WordDraftValues,type GrammarDraftValues} from '@/lib/local-learning-drafts';
import {useLocalDrafts} from './local-draft-context';
type Values=WordDraftValues|GrammarDraftValues;
const rowPayload=(row:DraftChoice)=>row.record.kind==='request'?draftFingerprint(row.record.values):draftFingerprint({kind:row.record.kind,base:row.record.base,values:row.record.values,...(row.record.lastFeedback?{lastFeedback:row.record.lastFeedback}:{})});
function distinctRows(rows:DraftChoice[]){const seen=new Set<string>();return rows.filter(row=>{const key=rowPayload(row);if(seen.has(key))return false;seen.add(key);return true;});}
type Options=({kind:'word';base:WordDraftValues;values:WordDraftValues;onRestore:(values:WordDraftValues)=>void}
  |{kind:'grammar';base:GrammarDraftValues;values:GrammarDraftValues;onRestore:(values:GrammarDraftValues)=>void})
  &{question:string;saved:boolean;edited:boolean;feedback?:SentenceFeedback;enabled?:boolean};
function restoreInput(options:Options,row:DraftChoice){
  if(row.record.kind!=='request'&&draftFingerprint(options.values)===draftFingerprint(row.record.values))return true;
  if(options.kind==='word'&&row.record.kind==='word')options.onRestore(row.record.values);
  else if(options.kind==='grammar'&&row.record.kind==='grammar')options.onRestore(row.record.values);
  else return false;
  return true;
}
export function usePersistentInput(options:Options){
  const {store,state}=useLocalDrafts(),key=options.kind+':'+options.question;
  const fresh=()=>({key,attempted:false,base:options.base as Values,observed:draftFingerprint(options.feedback),lastFeedback:options.feedback,
    restored:false,undo:null as {before:Values;applied:string}|null,source:null as DraftChoice|null,cleared:state.cleared,clearedInput:null as string|null});
  const [snapshot,setSnapshot]=useState(fresh);
  const attemptedKey=useRef<string|null>(null);
  let active=snapshot;
  if(active.key!==key){active=fresh();setSnapshot(active);}
  if(active.cleared!==state.cleared){active={...active,cleared:state.cleared,attempted:true,source:null,restored:false,undo:null,lastFeedback:options.feedback,clearedInput:draftFingerprint(options.values)};setSnapshot(active);}
  if(active.clearedInput!==null&&active.clearedInput!==draftFingerprint(options.values)){active={...active,clearedInput:null};setSnapshot(active);}
  const observed=draftFingerprint(options.feedback);
  if(active.observed!==observed){active={...active,observed,lastFeedback:options.feedback??active.lastFeedback};setSnapshot(active);}
  const valuesFingerprint=draftFingerprint(options.values),serverFingerprint=draftFingerprint(options.base);
  const lastFeedback=active.lastFeedback;
  const payloadFingerprint=draftFingerprint({kind:options.kind,base:options.saved&&valuesFingerprint===serverFingerprint?options.base:active.base,values:options.values,...(lastFeedback?{lastFeedback}:{})});
  const choices=options.enabled!==false?distinctRows(store?.list(options.question,options.kind)??[]).filter(row=>rowPayload(row)!==payloadFingerprint):[];
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
      const rows=distinctRows(store.list(question,kind)),only=rows.length===1?rows[0]:null;
      const needsRestore=only&&only.record.kind!=='request'&&(draftFingerprint(only.record.values)!==serverFingerprint
        ||only.record.lastFeedback&&draftFingerprint(only.record.lastFeedback)!==observed);
      if(only&&only.record.kind!=='request'&&needsRestore&&!options.edited&&draftFingerprint(only.record.base)===serverFingerprint){
        if(restoreInput(options,only))setSnapshot(previous=>({...previous,attempted:true,source:only,restored:true,lastFeedback:only.record.kind==='request'?previous.lastFeedback:only.record.lastFeedback??previous.lastFeedback,
          undo:draftFingerprint(options.values)===draftFingerprint(only.record.kind==='request'?null:only.record.values)?null:{before:options.values,applied:draftFingerprint(only.record.kind==='request'?null:only.record.values)}}));
      }else setSnapshot(previous=>({...previous,attempted:true}));
    });
    return()=>{current=false;};
  },[store,ready,available,enabled,key,question,kind,serverFingerprint,observed,options]);
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
  function choose(id:string,current:string,candidate:string){
    const row=store?.read(id);
    if(!row||row.record.question!==options.question||row.record.kind!==options.kind||draftFingerprint(options.values)!==current||draftFingerprint(row.record)!==candidate)return false;
    if(!restoreInput(options,row))return false;
    const value=row.record.values,retained=row.record.lastFeedback;
    setSnapshot(previous=>({...previous,source:row,restored:true,lastFeedback:retained??previous.lastFeedback,
      undo:draftFingerprint(options.values)===draftFingerprint(value)?null:{before:options.values,applied:draftFingerprint(value)}}));return true;
  }
  function undo(){
    if(!active.undo||draftFingerprint(options.values)!==active.undo.applied)return;
    if(options.kind==='word')options.onRestore(active.undo.before as WordDraftValues);else options.onRestore(active.undo.before as GrammarDraftValues);
    setSnapshot(previous=>({...previous,restored:false,undo:null,source:null}));
  }
  return {lastFeedback,recovery:{choices,current:options.values,restored:active.restored,hasUndo:!!active.undo,canUndo:!!active.undo&&valuesFingerprint===active.undo.applied,undo,choose,
    discard:(row:DraftChoice)=>store?.remove(row.id,row.record)},storage:{...state,enabled:!!store?.owner,retry:()=>store?.retry()}};
}
export type InputRecovery=ReturnType<typeof usePersistentInput>;
