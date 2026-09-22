import { today } from './learning';

// Calendar time comes from the server; elapsed time uses a monotonic clock.
export function createStudyClock(initialServerTime:number,monotonic:()=>number){
 let serverTime=initialServerTime,receivedAt=monotonic();
 const now=()=>serverTime+Math.max(0,monotonic()-receivedAt);
 return {now,date:()=>today(new Date(now())),sync(value:number){
  if(!Number.isFinite(value)||value<0||!Number.isFinite(new Date(value).getTime()))throw new Error('서버 시간을 확인하지 못했어요.');
  serverTime=value;receivedAt=monotonic();
 }};
}
