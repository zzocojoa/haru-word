"use client";
import { useSyncExternalStore } from "react";
import { today } from "@/lib/learning";

function subscribe(onChange:()=>void){
 const timer=window.setInterval(onChange,30_000);
 window.addEventListener('focus',onChange);
 document.addEventListener('visibilitychange',onChange);
 return ()=>{window.clearInterval(timer);window.removeEventListener('focus',onChange);document.removeEventListener('visibilitychange',onChange)};
}

// Recompute the Korean calendar date after midnight or waking a suspended tab.
// A stable string snapshot prevents renders when the day has not changed.
export function useStudyDate(initialDate:string){return useSyncExternalStore(subscribe,today,()=>initialDate)}
