"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY, type State } from "@/lib/learning";
export function useLearningStore(){
 const [state,setState]=useState<State>(structuredClone(EMPTY));const current=useRef(state);const persisted=useRef(state);const revision=useRef(0);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");const [conflict,setConflict]=useState(false);const [signedIn,setSignedIn]=useState(false);const lock=useRef(false);const [unsaved,setUnsaved]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const response=await fetch('/api/state',{cache:'no-store'});if(response.status===401){setSignedIn(false);return;}const data=await response.json() as {revision:number;state:State;error?:string};if(!response.ok)throw new Error(data.error||"기록을 불러오지 못했습니다.");revision.current=data.revision;persisted.current=data.state;current.current=data.state;setState(data.state);setSignedIn(true);setUnsaved(false);setConflict(false);}catch(e){setError(e instanceof Error?e.message:"불러오기 실패");}finally{setLoading(false);}},[]);
 // Load and subscribe to the external account state on mount.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!unsaved)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[unsaved]);
 const save=useCallback(async(next:State)=>{
  if(lock.current)return false;if(!signedIn){setError("로그인 후 학습 기록을 저장할 수 있어요.");return false;}
  lock.current=true;setSaving(true);setError("");current.current=next;setState(next);setUnsaved(true);
  const base=persisted.current;
  const progress=Object.fromEntries(Object.entries(next.progress).filter(([id,v])=>JSON.stringify(base.progress[id])!==JSON.stringify(v)));
  const sessions=Object.fromEntries(Object.entries(next.sessions).filter(([id,v])=>JSON.stringify(base.sessions[id])!==JSON.stringify(v)));
  const settings=JSON.stringify(base.settings)!==JSON.stringify(next.settings)?next.settings:undefined;
  try{const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:revision.current,settings,progress,sessions})});const data=await response.json() as {revision:number;state:State;error?:string};if(!response.ok){setConflict(response.status===409);throw new Error(data.error||"저장하지 못했습니다.");}revision.current=data.revision;persisted.current=next;setUnsaved(false);setConflict(false);return true;}catch(e){setError(e instanceof Error?e.message:"저장 실패");return false;}finally{lock.current=false;setSaving(false);}
 },[signedIn]);
 return {state,current,loading,saving,error,conflict,signedIn,unsaved,save,load,retry:()=>save(current.current)};
}
