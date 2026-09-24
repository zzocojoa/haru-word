import { dailyOriginSummary } from './learning/daily-allocation';
export { dailyOriginSummary } from './learning/daily-allocation';
import { entryIdFor,senseProgress,type State,type Session } from './learning';

import { isCalendarDate } from './calendar-date';
export { isCalendarDate } from './calendar-date';

// An explicit correction, never an automatic inference from a device clock.
// Saved review/practice snapshots and all assessment results remain untouched.
export function correctDailyStudyDate(state:State,sessionId:string,date:string,currentDate:string):State{
 const source=state.sessions[sessionId];
 if(!source||source.kind!=='daily'||!source.finished)throw new Error('종료한 일일 학습만 날짜를 수정할 수 있어요.');
 if(!isCalendarDate(date)||date>currentDate)throw new Error('오늘까지의 올바른 학습일을 선택해 주세요.');
 if(date===source.date)return state;
 const oldDate=source.date;
 const records=Object.fromEntries(Object.entries(source.records).map(([id,r])=>[id,{...r,...(r.learnedOn===oldDate?{learnedOn:date}:{}),...(r.lastPracticedOn===oldDate?{lastPracticedOn:date}:{})}]));
 const session:Session={...source,date,period:date,records};
 const sessions={...state.sessions,[sessionId]:session};
 const progress={...state.progress};
 const affected=new Map<string,Set<string>>();
 for(const [id,r]of Object.entries(source.records))if(r.learnedOn===oldDate){
  const entryId=entryIdFor(source,id),meanings=affected.get(entryId)||new Set<string>();meanings.add(r.meaning.trim());affected.set(entryId,meanings);
 }
 const hasOtherDate=(entryId:string,meaning?:string)=>Object.values(sessions).some(s=>s.kind==='daily'&&s.id!==sessionId&&Object.entries(s.records).some(([id,r])=>entryIdFor(s,id)===entryId&&(meaning===undefined||r.meaning.trim()===meaning)&&(r.learnedOn===oldDate||!r.learnedOn&&s.date===oldDate)));
 for(const [entryId,meanings]of affected){
  const p=state.progress[entryId];if(!p)continue;
  const senses={...p.senses};
  for(const meaning of meanings){
   const sense=senseProgress(p,meaning);
   const studyDates=[...new Set([...(sense.studyDates||[]).filter(d=>d!==oldDate||hasOtherDate(entryId,meaning)),date])].sort();
   senses[meaning]={...sense,studyDates,lastStudied:studyDates.at(-1)};
  }
  const keepOld=hasOtherDate(entryId)||Object.values(senses).some(s=>s.studyDates?.includes(oldDate));
  const studyDates=[...new Set([...(p.studyDates||[]).filter(d=>d!==oldDate||keepOld),...Object.values(senses).flatMap(s=>s.studyDates||[])])].sort();
  progress[entryId]={...p,senses,studyDates,lastStudied:studyDates.at(-1)};
 }
 return {...state,sessions,progress};
}

export function previousDate(date:string){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}

// Compatibility for callers that only need counts.
export function dailyOrigins(state:State,ids:string[],date:string){
 const {returning,newCount}=dailyOriginSummary(state,ids,date);
 return {returning,newCount};
}
