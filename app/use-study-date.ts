"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { today } from '@/lib/learning';
import { createStudyClock } from '@/lib/study-clock';
import { requestJson } from '@/lib/client-request';

export function useStudyDate(initialServerTime:number){
 const [clock]=useState(()=>createStudyClock(initialServerTime,()=>performance.now()));
 const [snapshot,setSnapshot]=useState({date:today(new Date(initialServerTime)),ready:false,error:false,syncing:false});
 const pending=useRef<{controller:AbortController;promise:Promise<boolean>}|null>(null);
 const refresh=useCallback(()=>{
  // Focus, pageshow, online and manual retry share one deadline rather than
  // cancelling/restarting each other or allowing an older result to win.
  if(pending.current)return pending.current.promise;
  const controller=new AbortController();
  setSnapshot(previous=>({...previous,syncing:true,error:false}));
  const promise=(async()=>{
   try{
    const {response,data}=await requestJson<{serverTime:number}>('/api/study-clock',{cache:'no-store',signal:controller.signal},10_000);
    if(controller.signal.aborted||pending.current?.controller!==controller)return false;
    if(!response.ok||typeof data.serverTime!=='number')throw new Error('Invalid server time');
    clock.sync(data.serverTime);setSnapshot({date:clock.date(),ready:true,error:false,syncing:false});
    return true;
   }catch{
    if(!controller.signal.aborted&&pending.current?.controller===controller)
     setSnapshot(previous=>({...previous,ready:false,error:true,syncing:false}));
    return false;
   }finally{if(pending.current?.controller===controller)pending.current=null;}
  })();
  pending.current={controller,promise};
  return promise;
 },[clock]);
 useEffect(()=>{
  const cancel=()=>{const request=pending.current;pending.current=null;request?.controller.abort()};
  const sync=()=>{if(document.visibilityState==='visible')void refresh()};
  const wake=()=>{if(document.visibilityState==='visible'){setSnapshot(previous=>({...previous,ready:false}));sync()}};
  const visibility=()=>{
   if(document.visibilityState==='visible')wake();
   else{cancel();setSnapshot(previous=>({...previous,ready:false,syncing:false}));}
  };
  const timer=window.setInterval(()=>setSnapshot(previous=>{const date=clock.date();return previous.date===date?previous:{...previous,date}}),30_000);
  const resync=window.setInterval(sync,300_000);
  window.addEventListener('focus',wake);window.addEventListener('pageshow',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',visibility);
  sync();
  return()=>{cancel();clearInterval(timer);clearInterval(resync);window.removeEventListener('focus',wake);window.removeEventListener('pageshow',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',visibility)};
 },[clock,refresh]);
 return {...snapshot,now:clock.now,currentDate:clock.date,refresh};
}
