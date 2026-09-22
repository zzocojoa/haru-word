import type { SentenceFeedback } from './sentence-feedback';
export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export const MAX_DAILY_GOAL = 10;
export type Level = typeof LEVELS[number];
export type Familiarity = "known" | "uncertain" | "new";
export type FamiliarityCheck = {initial:Familiarity;answer:string;meaning:string;final?:Familiarity};
export type Result = "independent" | "help" | "unmeasured";
export type SentenceResult = "written" | "improve" | "unmeasured";
export type Stage = "warmup" | "learn" | "en" | "ko" | "sentence" | "checkpoint" | "done";
export type Kind = "daily" | "weekly" | "monthly" | "practice";
export type PracticeMode = "known" | "ko" | "sentence" | "repeat";
export type Word = {id:string;word:string;headword:string;pos:string;level:Level;page:number;personal?:boolean};
export type Content = {meaning:string;ipa?:string;expression:string;example:string;translation:string;source:string;attribution?:string;url?:string};
export type Progress = {
  senses?:Record<string,SenseProgress>;
  familiarity?: Familiarity; familiarityCheck?:FamiliarityCheck; meaning?: string; expression?:string; example?:string; translation?:string;
  en?:Result;ko?:Result;sentenceStatus?:SentenceResult;sentence?:string;notes?:string;
  studyDates?:string[];lastStudied?:string;needsReview?:boolean;personal?:Word;
  useful?:boolean;lastReviewed?:string;encounters?:{date:string;source:"reading"|"listening";text:string}[];
};
export type SenseProgress = Pick<Progress,"meaning"|"expression"|"example"|"translation"|"en"|"ko"|"sentenceStatus"|"sentence"|"notes"|"studyDates"|"lastStudied"|"lastReviewed"|"needsReview">;
export type Assessment = {ids:string[];index:number;marks:Record<string,Familiarity>;completed:boolean};
export type Settings = {level:Level;dailyGoal:number;assessments:Partial<Record<Level,Assessment>>;activeSessionId:string|null;newWordsPaused?:boolean;monthlyBatchSize?:number;reviewDay?:number};
export type RecordItem = {entryId?:string;learnedOn?:string;lastPracticedOn?:string;material?:Content;historicalMeaningUnknown?:boolean;aiFeedback?:SentenceFeedback;meaning:string;familiarity?:Familiarity;en:Result;ko:Result;sentenceStatus:SentenceResult;sentence:string;notes:string;spoken?:boolean;enAnswer?:string;koAnswer?:string;hintEn?:boolean;hintKo?:boolean;retryEn?:Result;retryKo?:Result;draft?:{answer:string;hinted:boolean;revealed:boolean;stage:"en"|"ko";retry:boolean}};
export type Session = {id:string;kind:Kind;date:string;period:string;ids:string[];wordKeys?:Record<string,string>;warmupIds:string[];warmupResults?:Record<string,Result>;warmupDraft?:{id:string;answer:string;hinted:boolean;revealed:boolean};stage:Stage;index:number;records:Record<string,RecordItem>;retry: {id:string;direction:"en"|"ko";seen?:string[]}[];retryMode:boolean;resumeAfterRetry?:{stage:Stage;index:number};batchSize?:number;batchStart?:number;reviewEnd?:number;practiceMode?:PracticeMode;elapsed:number;finished:boolean;paused:boolean;createdAt:string};
export type State = {settings:Settings;progress:Record<string,Progress>;sessions:Record<string,Session>};
export const EMPTY:State = {settings:{level:"A1",dailyGoal:3,assessments:{},activeSessionId:null},progress:{},sessions:{}};
export const RESULT_TEXT:Record<Result,string>={independent:"독립 성공",help:"도움 필요",unmeasured:"미측정"};
export const FAMILIARITY_TEXT:Record<Familiarity,string>={known:"뜻을 알아요",uncertain:"조금 헷갈려요",new:"처음 봐요"};
export const POS:Record<string,string>={"n.":"명사","v.":"동사","adj.":"형용사","adv.":"부사","prep.":"전치사","pron.":"대명사","det.":"한정사","conj.":"접속사","exclam.":"감탄사","modal v.":"조동사","auxiliary v.":"조동사","number":"수사","indefinite article":"부정관사","definite article":"정관사","infinitive marker":"부정사 표지"};

export function today(now=new Date()):string {return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function weekStart(date:string):string {const d=new Date(date+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7); return d.toISOString().slice(0,10);}
export function periodKey(kind:Kind,date:string):string{return kind==="monthly"?date.slice(0,7):kind==="weekly"?weekStart(date):date;}
export function emptyRecord(meaning="",familiarity?:Familiarity):RecordItem{return {meaning,familiarity,en:"unmeasured",ko:"unmeasured",sentenceStatus:"unmeasured",sentence:"",notes:""};}
export function isComplete(r:RecordItem):boolean{return r.en==="independent"&&r.ko==="independent"&&r.sentenceStatus==="written";}
export function sessionRecordComplete(s:Session,r:RecordItem):boolean{
 if(s.kind==="monthly")return r.ko==="independent"&&r.sentenceStatus!=="improve";
 if(s.kind==="practice"&&s.practiceMode==="ko")return r.ko==="independent";
 if(s.kind==="practice"&&s.practiceMode==="sentence")return r.sentenceStatus==="written";
 return isComplete(r);
}
export const SENTENCE_TEXT:Record<SentenceResult,string>={written:"작성",improve:"보완 필요",unmeasured:"미측정"};
export const KIND_TEXT:Record<Kind,string>={daily:"일일 학습",weekly:"주간 점검",monthly:"월말 쓰기",practice:"보완 연습"};
export function nextAction(r:Pick<RecordItem,"en"|"ko"|"sentenceStatus">,s?:Session):string {
 if(r.ko==="help")return "뜻→영어 추가 연습";
 if(r.en==="help")return "뜻 다시 익히기";
 if(r.sentenceStatus==="improve")return "문장 보완";
 if(s&&sessionRecordComplete(s,r as RecordItem))return "이후에도 복습";
 return r.en==="unmeasured"||r.ko==="unmeasured"?"미완료 이어서":r.sentenceStatus==="unmeasured"?"문장 작성":"주간·월간 점검";
}

// Stratified sample spans the entire selected level, and is stable on resume.
export function assessmentSample(words:Word[],level:Level):string[]{const list=words.filter(w=>w.level===level&&!w.personal);const unique=[...new Map(list.map(w=>[w.headword,w])).values()]; return Array.from({length:Math.min(20,unique.length)},(_,i)=>unique[Math.floor((i+.5)*unique.length/Math.min(20,unique.length))].id);}
export function assessmentAdvice(a:Assessment,level:Level):{text:string;suggested:Level;goal?:number}{
 const counts=Object.values(a.marks).reduce((c,v)=>(c[v]++,c),{known:0,uncertain:0,new:0});
 const ix=LEVELS.indexOf(level);
 // A conservative exploration rule for this app, not a CEFR placement score.
 if(counts.known>=14)return ix<LEVELS.length-1
  ?{text:"익숙한 단어가 많아요. 다음 수준에서도 20개를 확인해 보세요.",suggested:LEVELS[ix+1]}
  :{text:"B2 표본에 익숙한 단어가 많아요. 이 목록의 최고 수준이에요. 아는 단어 후속 점검에서 영어 회상과 문장 사용도 확인해 보세요.",suggested:level};
 if(counts.new>=14)return ix
  ?{text:"처음 보는 단어가 많아요. 한 수준 아래부터 살펴보세요.",suggested:LEVELS[ix-1]}
  :{text:"한국어 설명을 활용하며 하루 1~2개로 시작해도 좋아요.",suggested:level,goal:2};
 return {text:"이 수준에서 시작해 보세요. 뜻이 불확실한 단어부터 고르고, 처음 보는 단어를 이어서 배워요.",suggested:level};
}
export function recordFamiliarity(p:Progress|undefined,familiarity:Familiarity):Progress{
 // A renewed difficulty signal reopens completed vocabulary without rewriting test results.
 // Marking a meaning as known never clears an actual recall/sentence weakness.
 return {...p,familiarity,...(familiarity!=="known"&&p?.lastStudied?{needsReview:true}:{})};
}
export function revealFamiliarity(p:Progress|undefined,initial:Familiarity,answer:string,meaning:string):Progress{
 // Keep the original, pre-reveal commitment across saves and devices.
 if(p?.familiarityCheck&&!p.familiarityCheck.final)return p;
 return {...p,familiarityCheck:{initial,answer:answer.trim(),meaning}};
}
export function confirmFamiliarity(p:Progress|undefined,final:Familiarity):Progress{
 const check=p?.familiarityCheck;
 if(!check||check.final)throw new Error("뜻을 확인한 뒤 친숙도를 확정해 주세요.");
 if(final!==check.initial&&!(check.initial==="known"&&final==="uncertain"))throw new Error("뜻을 보기 전의 판단을 기준으로 기록해 주세요.");
 return {...recordFamiliarity(p,final),familiarityCheck:{...check,final}};
}
const everyday=["arrive","busy","breakfast","work","home","food","water","time","help","need","want","buy","travel","meet","friend","family","learn","call","plan","use","important"];
export function dailyAssignedIds(state:State,date=today()):string[]{
 return [...new Set(Object.values(state.sessions).filter(s=>s.kind==="daily"&&s.date===date).flatMap(s=>s.ids.map(id=>entryIdFor(s,id))))];
}
export function pickDaily(words:Word[],state:State,date=today()):string[]{
 const progress=state.progress;const recentTargets=new Set(dailyAssignedIds(state,date));
 const remaining=Math.max(0,state.settings.dailyGoal-recentTargets.size);if(!remaining)return [];
 const seen=new Set(words.filter(w=>recentTargets.has(w.id)).map(w=>w.headword));
 const pauseNew=state.settings.newWordsPaused||Object.values(state.sessions).some(s=>s.kind==="monthly"&&!s.finished);
 const candidates=words.filter(w=>!recentTargets.has(w.id)&&(hasReviewWork(progress[w.id]) || (!pauseNew&&(w.personal||w.level===state.settings.level) && progress[w.id]?.familiarity!=="known"&&!senseProgress(progress[w.id],progress[w.id]?.meaning||"").lastStudied)));
 function priority(w:Word){const p=progress[w.id]; return hasReviewWork(p)?0:p?.familiarity==="uncertain"?1:p?.familiarity==="new"?2:3;}
 candidates.sort((a,b)=>priority(a)-priority(b)||Number(!!progress[b.id]?.useful)-Number(!!progress[a.id]?.useful)||(everyday.includes(a.word)?0:1)-(everyday.includes(b.word)?0:1)||hash(date+a.id)-hash(date+b.id));
 const out:string[]=[];for(const w of candidates){if(seen.has(w.headword))continue;out.push(w.id);seen.add(w.headword);if(out.length>=remaining)break;}return out;
}
export type LearningTarget={entryId:string;meaning:string;familiarity?:Familiarity;material?:Content;historicalMeaningUnknown?:boolean};
export function targetIdentity(entryId:string,meaning:string):string{return JSON.stringify([entryId,meaning.trim()]);}
export function entryIdFor(s:Session,id:string):string{return s.records[id]?.entryId||id;}
export function reviewTargets(state:State,kind:"weekly"|"monthly",period:string):LearningTarget[]{
 const targets=new Map<string,LearningTarget>();const represented=new Set<string>();
 for(const s of Object.values(state.sessions).filter(s=>s.kind==="daily").sort((a,b)=>a.createdAt.localeCompare(b.createdAt))){
  for(const id of s.ids){const entryId=entryIdFor(s,id),r=s.records[id];if(!r)continue;
   const learnedOn=r.learnedOn||(!r.entryId&&state.progress[entryId]?.studyDates?.includes(s.date)?s.date:undefined);
   const included=kind==="monthly"?learnedOn?.slice(0,7)===period:weekStart(s.date)===period||!!learnedOn&&weekStart(learnedOn)===period;
   if(!included)continue;
   targets.set(targetIdentity(entryId,r.meaning),{entryId,meaning:r.meaning,familiarity:r.familiarity,material:r.material});represented.add(entryId);
  }
 }
 // Older backups may have only progress dates, with no surviving original lesson.
 if(kind==="monthly")for(const [entryId,p]of Object.entries(state.progress))if(!represented.has(entryId)&&p.studyDates?.some(d=>d.slice(0,7)===period)){
  const senses=Object.values(p.senses||{}).filter(x=>x.studyDates?.some(d=>d.slice(0,7)===period));
  for(const sense of senses.length?senses:[p]){const meaning=sense.meaning||"";targets.set(targetIdentity(entryId,meaning),{entryId,meaning,familiarity:p.familiarity,historicalMeaningUnknown:!senses.length});}
 }
 return [...targets.values()].sort((a,b)=>hash(period+a.entryId)-hash(period+b.entryId)||a.meaning.localeCompare(b.meaning));
}
export function reviewIds(state:State,kind:"weekly"|"monthly",period:string):string[]{return [...new Set(reviewTargets(state,kind,period).map(t=>t.entryId))];}
export function senseProgress(p:Progress|undefined,meaning:string):SenseProgress{
 const key=meaning.trim();const saved=p?.senses?.[key];
 if(!p||p.meaning?.trim()!==key)return saved||{meaning:key};
 return {meaning:key,expression:p.expression,example:p.example,translation:p.translation,en:p.en,ko:p.ko,sentenceStatus:p.sentenceStatus,sentence:p.sentence,notes:p.notes,studyDates:saved?saved.studyDates:p.studyDates,lastStudied:saved?saved.lastStudied:p.lastStudied,lastReviewed:saved?saved.lastReviewed:p.lastReviewed,needsReview:p.needsReview};
}
export function allSenses(p:Progress|undefined):SenseProgress[]{const senses={...p?.senses};if(p?.meaning)senses[p.meaning.trim()]=senseProgress(p,p.meaning);return Object.values(senses);}
export function hasReviewWork(p:Progress|undefined):boolean{return !!p?.needsReview||allSenses(p).some(x=>x.needsReview);}
export function storeSense(p:Progress|undefined,sense:SenseProgress):Progress{
 const meaning=sense.meaning?.trim()||"";const old=p?.meaning?senseProgress(p,p.meaning):undefined;
 const senses={...p?.senses,...(old?{[p!.meaning!.trim()]:old}:{}),[meaning]:{...sense,meaning}};
 const dates=[...new Set([...(p?.studyDates||[]),...(sense.studyDates||[])])].sort();
 const result={...p,...(!p?.meaning||p.meaning.trim()===meaning?sense:{}),senses};
 return {...result,...(dates.length?{studyDates:dates,lastStudied:dates[dates.length-1]}:{}),...(sense.lastReviewed?{lastReviewed:[p?.lastReviewed||"",sense.lastReviewed].sort().pop()}:{} )};
}
export function selectSense(p:Progress|undefined,sense:SenseProgress):Progress{
 const selected:SenseProgress={expression:"",example:"",translation:"",en:"unmeasured",ko:"unmeasured",sentenceStatus:"unmeasured",sentence:"",notes:"",needsReview:false,...sense};
 const stored=storeSense(p,selected);return {...stored,...selected,studyDates:stored.studyDates,lastStudied:stored.lastStudied,lastReviewed:stored.lastReviewed};
}
export function pendingReviews(state:State):Session[]{return Object.values(state.sessions).filter(s=>(s.kind==="weekly"||s.kind==="monthly")&&!s.finished).sort((a,b)=>a.period.localeCompare(b.period)||a.createdAt.localeCompare(b.createdAt));}
export function reviewRemaining(s:Session):number{return s.ids.filter(id=>{const r=s.records[id];return !r||(s.kind==="monthly"?r.ko==="unmeasured":r.en==="unmeasured"||r.ko==="unmeasured"||r.sentenceStatus==="unmeasured");}).length;}
export function missingReviewTargets(state:State,s:Session):LearningTarget[]{
 if(s.finished||(s.kind!=="weekly"&&s.kind!=="monthly"))return [];
 const assigned=new Set(s.ids.map(id=>targetIdentity(entryIdFor(s,id),s.records[id]?.meaning||"")));
 return reviewTargets(state,s.kind,s.period).filter(t=>!assigned.has(targetIdentity(t.entryId,t.meaning))&&(t.meaning||!s.ids.some(id=>entryIdFor(s,id)===t.entryId)));
}
// Keep the current block and cursor intact. New targets start their own full
// recall sequence after that block, even if the saved cursor is in KO or sentence.
export function extendReviewSession(state:State,words:Word[],s:Session,content:(id:string)=>Content):Session{
 const missing=missingReviewTargets(state,s);if(!missing.length)return s;
 if(s.ids.length+missing.length>5000)throw new Error('점검 대상이 5,000개를 넘어요. 기존 점검을 마친 뒤 다음 회차로 나눠 주세요.');
 const records={...s.records},ids=[...s.ids],wordKeys={...s.wordKeys};
 for(const t of missing){
  const id=records[t.entryId]?"target_"+crypto.randomUUID():t.entryId;
  ids.push(id);records[id]={...emptyRecord(t.meaning||content(t.entryId).meaning,t.familiarity),entryId:t.entryId,...(t.material?{material:t.material}:{}),...(t.historicalMeaningUnknown?{historicalMeaningUnknown:true}:{})};
  wordKeys[id]=words.find(w=>w.id===t.entryId)?.word.toLowerCase()||t.entryId;
 }
 const resumeAfterRetry=s.resumeAfterRetry?.stage==="done"?{stage:"checkpoint" as Stage,index:s.ids.length}:s.resumeAfterRetry;
 return {...s,ids,records,wordKeys,reviewEnd:s.reviewEnd??s.ids.length,...(resumeAfterRetry?{resumeAfterRetry}:{})};
}
export function reviewBatchEnd(s:Session):number{
 const end=s.reviewEnd??s.ids.length;
 return s.kind==="monthly"&&s.batchSize?Math.min((s.batchStart||0)+s.batchSize,end):end;
}
export function dailyMeaning(p:Progress|undefined,fallback:string):string{return allSenses(p).filter(x=>x.needsReview).sort((a,b)=>(a.lastReviewed||"").localeCompare(b.lastReviewed||""))[0]?.meaning||p?.meaning||fallback;}
function targetRecords(targets:LearningTarget[]):{ids:string[];records:Record<string,RecordItem>}{
 const records:Record<string,RecordItem>={};
 for(const t of targets){const key=records[t.entryId]?"target_"+crypto.randomUUID():t.entryId;records[key]={...emptyRecord(t.meaning,t.familiarity),entryId:t.entryId,...(t.material?{material:t.material}:{}),...(t.historicalMeaningUnknown?{historicalMeaningUnknown:true}:{})};}
 return {ids:Object.keys(records),records};
}
function hash(v:string):number{let h=0;for(const c of v)h=(h*31+c.charCodeAt(0))>>>0;return h;}
export function practiceIds(state:State,mode:PracticeMode):string[]{if(mode==="repeat")return [];return Object.entries(state.progress).filter(([,p])=>mode==="known"?p.familiarity==="known":mode==="ko"?p.ko==="help"||allSenses(p).some(x=>x.ko==="help"):p.sentenceStatus==="improve"||allSenses(p).some(x=>x.sentenceStatus==="improve")).sort((a,b)=>(a[1].lastReviewed||"").localeCompare(b[1].lastReviewed||"")||hash(a[0])-hash(b[0])).slice(0,20).map(([id])=>id);}
export function newSession(state:State,words:Word[],content:(id:string)=>Content,kind:Kind,date=today(),period=periodKey(kind,date),practiceMode?:PracticeMode):Session|null{
 // Resume the assigned daily work before allocating another same-day session.
 if(kind==="daily"&&Object.values(state.sessions).some(s=>s.kind==="daily"&&s.date===date&&!s.finished))return null;
 const targets:LearningTarget[]=kind==="weekly"||kind==="monthly"?reviewTargets(state,kind,period):
 (kind==="daily"?pickDaily(words,state,date):practiceIds(state,practiceMode||"known")).flatMap(entryId=>{
  const p=state.progress[entryId];const choices=kind==="practice"?allSenses(p).filter(x=>practiceMode==="ko"?x.ko==="help":practiceMode==="sentence"?x.sentenceStatus==="improve":true):[];
  return (choices.length?choices.map(x=>x.meaning||content(entryId).meaning):[dailyMeaning(p,content(entryId).meaning)]).map(meaning=>({entryId,meaning,familiarity:p?.familiarity}));
 }).slice(0,kind==="practice"?20:state.settings.dailyGoal);
 if(!targets.length)return null;
 const {ids,records}=targetRecords(targets.map(t=>({...t,meaning:t.meaning||content(t.entryId).meaning})));
 const warmupIds=kind==="daily"&&!dailyAssignedIds(state,date).length?Object.entries(state.progress).filter(([,p])=>p.lastStudied).sort((a,b)=>Number(hasReviewWork(b[1]))-Number(hasReviewWork(a[1]))||(b[1].lastStudied||"").localeCompare(a[1].lastStudied||"")).slice(0,3).map(([id])=>id):[];
 return {id:crypto.randomUUID(),kind,date,period,ids,wordKeys:Object.fromEntries(ids.map(id=>[id,words.find(w=>w.id===entryIdFor({records} as Session,id))?.word.toLowerCase()||id])),warmupIds,stage:kind==="daily"?(warmupIds.length?"warmup":"learn"):kind==="monthly"||practiceMode==="ko"?"ko":practiceMode==="sentence"?"sentence":"en",index:0,records,retry:[],retryMode:false,...(kind==="monthly"?{batchSize:state.settings.monthlyBatchSize||15,batchStart:0}:{}),...(kind==="practice"?{practiceMode:practiceMode||"known"}:{}),elapsed:0,finished:false,paused:false,createdAt:new Date().toISOString()};
}
export function currentId(s:Session):string|undefined{return s.retryMode?s.retry[0]?.id:s.stage==="warmup"?s.warmupIds[s.index]:s.ids[s.index];}
// A repeat is a separate optional practice, tied to the original daily date.
// Reuse its saved cursor before creating another attempt; never reset daily records.
export function repeatDailySession(state:State,words:Word[],sourceDate:string,date=today()):Session|null{
 const sources=Object.values(state.sessions).filter(s=>s.kind==="daily"&&s.date===sourceDate);
 if(!sources.length||sources.some(s=>!s.finished))return null;
 const existing=Object.values(state.sessions).find(s=>s.kind==="practice"&&s.practiceMode==="repeat"&&s.period===sourceDate&&!s.finished);
 if(existing)return {...existing,paused:false};
 const targets=new Map<string,LearningTarget>();
 for(const s of sources.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)))for(const id of s.ids){
  const r=s.records[id];const entryId=entryIdFor(s,id);if(!r||!words.some(w=>w.id===entryId))return null;
  targets.set(targetIdentity(entryId,r.meaning),{entryId,meaning:r.meaning,familiarity:r.familiarity,material:r.material});
 }
 const {ids,records}=targetRecords([...targets.values()]);if(!ids.length)return null;
 return {id:crypto.randomUUID(),kind:"practice",practiceMode:"repeat",date,period:sourceDate,ids,
  wordKeys:Object.fromEntries(ids.map(id=>[id,words.find(w=>w.id===(records[id].entryId||id))!.word.toLowerCase()])),
  warmupIds:[],stage:"learn",index:0,records,retry:[],retryMode:false,elapsed:0,finished:false,paused:false,createdAt:new Date().toISOString()};
}
export function stepSession(s:Session):Session{
 const id=currentId(s);const wordKey=(id:string)=>s.wordKeys?.[id]||id;
 // Count distinct intervening words, not elapsed clicks or a repeat of the same word.
 const retry=(s.retryMode?s.retry.slice(1):s.retry).map(r=>({...r,seen:id&&wordKey(r.id)===wordKey(id)?[]:[...new Map([...(r.seen||[]),...(id&&["en","ko","sentence"].includes(s.stage)?[id]:[])].map(seen=>[wordKey(seen),seen])).values()]}));
 let next:Session;
 if(s.retryMode){const cursor=s.resumeAfterRetry||{stage:"done" as Stage,index:0};next={...s,...cursor,retryMode:false,resumeAfterRetry:undefined};}
 else {
  const review=s.kind==="monthly"||s.kind==="weekly";
  const start=review?(s.batchStart||0):0;
  const end=s.stage==="warmup"?s.warmupIds.length:review?reviewBatchEnd(s):s.ids.length;
  if(s.index+1<end)next={...s,index:s.index+1};
  else {
   const sequence:Stage[]=s.kind==="daily"?["warmup","learn","en","ko","sentence","done"]:s.kind==="monthly"?["ko","sentence","done"]:s.practiceMode==="repeat"?["learn","en","ko","sentence","done"]:s.practiceMode==="ko"?["ko","done"]:s.practiceMode==="sentence"?["sentence","done"]:["en","ko","sentence","done"];
   let stage=sequence[sequence.indexOf(s.stage)+1]||"done";
   if(stage==="done"&&review&&end<s.ids.length)stage="checkpoint";
   next={...s,stage,index:stage==="checkpoint"?end:stage==="done"?0:start};
  }
 }
 const due=retry.findIndex(r=>(r.seen?.length||0)>=2);
 if(due>=0){const ready=retry[due];return {...next,retry:[ready,...retry.filter((_,i)=>i!==due)],resumeAfterRetry:{stage:next.stage,index:next.index},retryMode:true,stage:ready.direction,finished:false,paused:false};}
 return {...next,retry,finished:next.stage==="done",paused:next.stage==="done"||next.stage==="checkpoint"};
}
export function continueBatch(s:Session):Session{return s.stage==="checkpoint"?{...s,batchStart:s.index,reviewEnd:s.reviewEnd&&s.index<s.reviewEnd?s.reviewEnd:undefined,stage:s.kind==="weekly"?"en":"ko",paused:false}:s;}
export function applyRecord(state:State,s:Session,id:string,patch:Partial<RecordItem>,advance=true,activityDate=today()):State{
 const wasRetry=s.retryMode;
 if(wasRetry){patch={...patch};if(patch.en){patch.retryEn=patch.en;delete patch.en;}if(patch.ko){patch.retryKo=patch.ko;delete patch.ko;}}
 const learnedNow=s.kind==="daily"&&s.stage==="learn"&&advance;
 const record={...s.records[id],...patch,...(learnedNow?{learnedOn:activityDate}:{}),...(advance?{lastPracticedOn:activityDate}:{})};
 const failed=(patch.en==="help"||patch.ko==="help")&&!wasRetry;
 const retry=failed?[...s.retry,{id,direction:patch.en?"en" as const:"ko" as const,seen:[]}]:s.retry;
 const nextSession={...s,records:{...s.records,[id]:record},retry};
 const entryId=entryIdFor(s,id);const original=state.progress[entryId];
 const p=original?.meaning?senseProgress(original,record.meaning):original||{};
 const studyDates=learnedNow?[...new Set([...(p.studyDates||[]),activityDate])]:p.studyDates;
 // Monthly writing does not overwrite an untested English-to-Korean result.
 const en=record.en==="unmeasured"?p.en:record.en, ko=record.ko==="unmeasured"?p.ko:record.ko;
 const sentenceStatus=record.sentenceStatus==="unmeasured"?p.sentenceStatus:record.sentenceStatus;
 const complete=sessionRecordComplete(s,record);
 const otherGap=s.practiceMode==="ko"?(en!=="independent"||sentenceStatus!=="written"):s.practiceMode==="sentence"?(en!=="independent"||ko!=="independent"):s.kind==="monthly"?(en==="help"||sentenceStatus==="improve"):false;
 // Optional repetition only reopens a previously learned word on measured difficulty.
 const needsReview=s.practiceMode==="repeat"?(hasMeasuredDifficulty(record)?true:complete?false:p.needsReview):!complete||otherGap;
 const updated:SenseProgress={...p,...(record.material?{expression:record.material.expression,example:record.material.example,translation:record.material.translation}:{}),meaning:record.meaning,en,ko,sentenceStatus,sentence:record.sentence||p.sentence,notes:record.notes||p.notes,studyDates,lastStudied:learnedNow?activityDate:p.lastStudied,lastReviewed:s.kind!=="daily"&&advance?activityDate:p.lastReviewed,needsReview};
 let progress=storeSense(original,updated);
 if(learnedNow){
  const assigned=s.records[id]?.meaning;
  if(assigned&&assigned!==record.meaning){
   const prior=senseProgress(progress,assigned);
   // Choosing one specific sense should not leave an unlearned reference gloss due forever.
   if(!prior.lastStudied&&(!prior.en||prior.en==="unmeasured")&&(!prior.ko||prior.ko==="unmeasured")&&(!prior.sentenceStatus||prior.sentenceStatus==="unmeasured"))progress=storeSense(progress,{...prior,needsReview:false});
  }
  progress=selectSense(progress,updated);
 }
 return {...state,progress:{...state.progress,[entryId]:progress},sessions:{...state.sessions,[s.id]:advance?stepSession(nextSession):nextSession}};
}
function hasMeasuredDifficulty(r:RecordItem):boolean{return r.en==="help"||r.ko==="help"||r.sentenceStatus==="improve";}
export function ensureCarryover(state:State,s:Session):State{const progress={...state.progress};for(const id of s.ids){const r=s.records[id];if(s.practiceMode==="repeat"?r&&hasMeasuredDifficulty(r):!r||!sessionRecordComplete(s,r)){const entryId=entryIdFor(s,id);const p=progress[entryId];progress[entryId]=storeSense(p,{...senseProgress(p,r?.meaning||p?.meaning||""),needsReview:true});}}return {...state,progress};}
export function exportLog(state:State,words:Word[]):string{const map=new Map(words.map(w=>[w.id,w]));const rows=[["학습일","종류","단어","품사","수준","학습 뜻","처음 표시","영어→뜻","뜻→영어","문장 상태","말하기","내 문장","보완점","재시도 영어→뜻","재시도 뜻→영어","다음 할 일","AI 검토 원문","AI 교정 제안","AI 설명","회차 시작일","실제 학습일","마지막 연습일"]];for(const s of Object.values(state.sessions).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))){for(const id of s.ids){const w=map.get(entryIdFor(s,id));const r=s.records[id]||emptyRecord();rows.push([r.lastPracticedOn||r.learnedOn||s.date,s.kind,w?.word||id,w?.pos||"",w?.personal?"개인 추가":w?.level||"",r.meaning,r.familiarity?FAMILIARITY_TEXT[r.familiarity]:"미표시",RESULT_TEXT[r.en],RESULT_TEXT[r.ko],SENTENCE_TEXT[r.sentenceStatus],r.spoken?"말해 봄":"미측정",r.sentence,r.notes,RESULT_TEXT[r.retryEn||"unmeasured"],RESULT_TEXT[r.retryKo||"unmeasured"],nextAction(r,s),r.aiFeedback?.original||"",r.aiFeedback?.correctedSentence||"",r.aiFeedback?.explanation||"",s.date,r.learnedOn||"기존 기록·미확인",r.lastPracticedOn||"기존 기록·미확인"]);}}return "\ufeff"+rows.map(row=>row.map(x=>'"'+(/^(?:[\s\ufeff]*[=+@\-]|[\t\r\n])/.test(x)?"'":"")+x.replaceAll('"','""')+'"').join(',')).join('\r\n');}

export function exportTutor(state:State,words:Word[]):string {
 const latest=Object.values(state.sessions).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
 const snapshot={...state,sessions:latest?{[latest.id]:latest}:{}};
 return `한국어로 짧게 설명하는 성인 기초 영어 어휘 튜터로 진행해 주세요.
학습 목록: American Oxford 3000 by CEFR level. 공식 단어·품사·수준은 함께 제공한 목록에서 확인하세요. 확인할 자료가 없으면 목록을 요청하고 공식 단어라고 추측하지 마세요.
선택 수준: ${state.settings.level} (정식 CEFR 판정 아님). 하루 목표: 이월 포함 ${state.settings.dailyGoal}개, 약 15분.
친숙도 미확인 시 목록 여러 부분의 20개를 한 개씩 보여 주고 ✓✓ 안다 / ✓ 불확실 / ? 처음으로 확인하세요. 미완료 → ✓ → ? 순으로 고르세요.
한 단어의 뜻 하나·품사·유용한 표현·짧은 예문과 해석·사전 링크를 제공하세요. 직접 만든 예문은 ‘학습용 작성 예문’으로 표시하세요.
영어→한국어, 한국어→영어, 문장을 한 문제씩 진행하고, 정답을 숨긴 채 답을 기다리세요. 다른 유효한 정답도 인정하세요.
도움을 받은 답과 독립 성공을 구분하고 다른 단어 2~3개 뒤 재시도하세요. 문법 오류만 있으면 ‘문장 보완’이며 친숙도를 낮추지 마세요.
주간은 그 주 목표 전체, 월말은 그달 학습 전체를 확인하세요. 누락을 통과로 처리하지 말고 미측정으로 남기세요.
‘오늘 종료’ 요청 시 학습일 | 단어·품사·뜻 | 처음 표시 | 영어→뜻 | 뜻→영어 | 내 문장·보완점 | 다음 할 일을 출력하세요. 실제 타이머 없이 경과 시간을 측정했다고 말하지 마세요.
이 파일은 자동 저장·알림·외부 AI 연결을 설정하지 않습니다. 아래 기록만 사용하고 과거 성적을 추측하지 마세요.

공식 목록 파일: 사이트의 /sources/learning-data.json (아래 해당 단어 정보와 별도로 함께 제공할 수 있습니다.)
마지막 회차의 단어 정보:
${JSON.stringify(words.filter(w=>latest?.ids.some(id=>entryIdFor(latest,id)===w.id)),null,2)}

마지막 학습 기록:
${exportLog(snapshot,words)}`;
}
