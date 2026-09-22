"use client";
import { useCallback,useEffect,useState } from 'react';
import { today } from '@/lib/learning';
import { createStudyClock } from '@/lib/study-clock';
import { requestJson } from '@/lib/client-request';

export function useStudyDate(initialServerTime:number){
 const [clock]=useState(()=>createStudyClock(initialServerTime,()=>performance.now()));
 const [snapshot,setSnapshot]=useState({date:today(new Date(initialServerTime)),ready:false,error:false});
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  try{
   const {response,data}=await requestJson<{serverTime:number}>('/api/study-clock',{cache:'no-store',signal},10_000);
   if(!response.ok||typeof data.serverTime!=='number')throw new Error('Invalid server time');
   clock.sync(data.serverTime);setSnapshot({date:clock.date(),ready:true,error:false});
  }catch{if(!signal?.aborted)setSnapshot(previous=>({...previous,ready:false,error:true}));}
 },[clock]);
 useEffect(()=>{
  let controller:AbortController|undefined;
  const sync=()=>{controller?.abort();controller=new AbortController();void refresh(controller.signal)};
  const wake=()=>{if(document.visibilityState==='visible'){setSnapshot(previous=>({...previous,ready:false}));sync()}};
  const timer=window.setInterval(()=>setSnapshot(previous=>{const date=clock.date();return previous.date===date?previous:{...previous,date}}),30_000);
  const resync=window.setInterval(sync,300_000);
  window.addEventListener('focus',wake);window.addEventListener('pageshow',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  sync();
  return()=>{controller?.abort();clearInterval(timer);clearInterval(resync);window.removeEventListener('focus',wake);window.removeEventListener('pageshow',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake)};
 },[clock,refresh]);
 return {...snapshot,now:clock.now,currentDate:clock.date,refresh};
}
