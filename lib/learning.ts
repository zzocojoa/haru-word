export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type Level = typeof LEVELS[number];
export type Familiarity = "known" | "uncertain" | "new";
export type Result = "independent" | "help" | "unmeasured";
export type SentenceResult = "written" | "improve" | "unmeasured";
export type Stage = "warmup" | "learn" | "en" | "ko" | "sentence" | "done";
export type Kind = "daily" | "weekly" | "monthly";
export type Word = {id:string;word:string;headword:string;pos:string;level:Level;page:number;personal?:boolean};
export type Content = {meaning:string;ipa?:string;expression:string;example:string;translation:string;source:string;attribution?:string;url?:string};
export type Progress = {
  familiarity?: Familiarity; meaning?: string; expression?:string; example?:string; translation?:string;
  en?:Result;ko?:Result;sentenceStatus?:SentenceResult;sentence?:string;notes?:string;
  studyDates?:string[];lastStudied?:string;needsReview?:boolean;personal?:Word;
};
export type Assessment = {ids:string[];index:number;marks:Record<string,Familiarity>;completed:boolean};
export type Settings = {level:Level;dailyGoal:number;assessments:Partial<Record<Level,Assessment>>;activeSessionId:string|null};
export type RecordItem = {meaning:string;familiarity?:Familiarity;en:Result;ko:Result;sentenceStatus:SentenceResult;sentence:string;notes:string;enAnswer?:string;koAnswer?:string;hintEn?:boolean;hintKo?:boolean;retryEn?:Result;retryKo?:Result;draft?:{answer:string;hinted:boolean;revealed:boolean;stage:"en"|"ko";retry:boolean}};
export type Session = {id:string;kind:Kind;date:string;period:string;ids:string[];warmupIds:string[];warmupResults?:Record<string,Result>;stage:Stage;index:number;records:Record<string,RecordItem>;retry: {id:string;direction:"en"|"ko"}[];retryMode:boolean;elapsed:number;finished:boolean;paused:boolean;createdAt:string};
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
export function sessionRecordComplete(s:Session,r:RecordItem):boolean{return s.kind==="monthly"?r.ko==="independent"&&r.sentenceStatus==="written":isComplete(r);}
export function nextAction(r:Pick<RecordItem,"en"|"ko"|"sentenceStatus">):string {return r.en==="help"||r.ko==="help"?"재학습":r.en==="unmeasured"||r.ko==="unmeasured"?"미완료 이어서":r.sentenceStatus==="improve"?"문장 보완":r.sentenceStatus==="unmeasured"?"문장 작성":"주간·월간 점검";}

// Stratified sample spans the entire selected level, and is stable on resume.
export function assessmentSample(words:Word[],level:Level):string[]{const list=words.filter(w=>w.level===level&&!w.personal);const unique=[...new Map(list.map(w=>[w.headword,w])).values()]; return Array.from({length:Math.min(20,unique.length)},(_,i)=>unique[Math.floor((i+.5)*unique.length/Math.min(20,unique.length))].id);}
export function assessmentAdvice(a:Assessment,level:Level):{text:string;suggested:Level;goal?:number}{const counts=Object.values(a.marks).reduce((c,v)=>(c[v]++,c),{known:0,uncertain:0,new:0});const ix=LEVELS.indexOf(level);if(counts.known>=14&&ix<3)return {text:"익숙한 단어가 많아요. 다음 수준에서도 20개를 확인해 보세요.",suggested:LEVELS[ix+1]};if(counts.new>=14)return ix?{text:"처음 보는 단어가 많아요. 한 수준 아래부터 살펴보세요.",suggested:LEVELS[ix-1]}:{text:"한국어 설명을 활용하며 하루 1~2개로 시작해도 좋아요.",suggested:level,goal:2};return {text:"아는 단어와 헷갈리는 단어가 섞여 있어요. 이 수준에서 시작해 보세요.",suggested:level};}
const everyday=["arrive","busy","breakfast","work","home","food","water","time","help","need","want","buy","travel","meet","friend","family","learn","call","plan","use","important"];
export function pickDaily(words:Word[],state:State,date=today()):string[]{
 const progress=state.progress; const recentTargets=new Set(Object.values(state.sessions).filter(s=>s.kind==="daily"&&s.date===date).flatMap(s=>s.ids));
 const candidates=words.filter(w=>!recentTargets.has(w.id)&&(progress[w.id]?.needsReview || (w.level===state.settings.level && progress[w.id]?.familiarity!=="known"&&!progress[w.id]?.lastStudied)));
 function priority(w:Word){const p=progress[w.id]; return p?.needsReview?0:p?.familiarity==="uncertain"?1:p?.familiarity==="new"?2:3;}
 candidates.sort((a,b)=>priority(a)-priority(b)||(everyday.includes(a.word)?everyday.indexOf(a.word):999)-(everyday.includes(b.word)?everyday.indexOf(b.word):999)||a.word.localeCompare(b.word)||a.id.localeCompare(b.id));
 const out:string[]=[]; const seen=new Set<string>(); for(const w of candidates){if(seen.has(w.headword))continue;out.push(w.id);seen.add(w.headword);if(out.length>=state.settings.dailyGoal)break;}return out;
}
export function reviewIds(state:State,kind:"weekly"|"monthly",period:string):string[]{
 const ids=new Set<string>(); if(kind==="monthly"){for(const [id,p]of Object.entries(state.progress))if(p.studyDates?.some(date=>date.slice(0,7)===period))ids.add(id);}else for(const s of Object.values(state.sessions)){if(s.kind==="daily"&&weekStart(s.date)===period)s.ids.forEach(id=>ids.add(id));}
 // A deterministic interleave avoids alphabetic cueing and resumes without reshuffling.
 return [...ids].sort((a,b)=>hash(period+a)-hash(period+b));
}
function hash(v:string):number{let h=0;for(const c of v)h=(h*31+c.charCodeAt(0))>>>0;return h;}
export function newSession(state:State,words:Word[],content:(id:string)=>Content,kind:Kind,date=today(),period=periodKey(kind,date)):Session|null{
 const ids=kind==="daily"?pickDaily(words,state,date):reviewIds(state,kind,period); if(!ids.length)return null;
 const warmupIds=kind==="daily"?Object.entries(state.progress).filter(([id,p])=>p.lastStudied&&!ids.includes(id)).sort((a,b)=>(b[1].lastStudied||"").localeCompare(a[1].lastStudied||"")).slice(0,3).map(([id])=>id):[];
 const records=Object.fromEntries(ids.map(id=>[id,emptyRecord(state.progress[id]?.meaning||content(id).meaning,state.progress[id]?.familiarity)]));
 return {id:crypto.randomUUID(),kind,date,period,ids,warmupIds,stage:kind==="daily"?(warmupIds.length?"warmup":"learn"):kind==="monthly"?"ko":"en",index:0,records,retry:[],retryMode:false,elapsed:0,finished:false,paused:false,createdAt:new Date().toISOString()};
}
export function currentId(s:Session):string|undefined{return s.retryMode?s.retry[0]?.id:s.stage==="warmup"?s.warmupIds[s.index]:s.ids[s.index];}
export function stepSession(s:Session):Session{
 if(s.retryMode){const retry=s.retry.slice(1);return {...s,retry,retryMode:retry.length>0,stage:retry.length?retry[0].direction:"done",index:0,finished:!retry.length,paused:!retry.length};}
 const count=s.stage==="warmup"?s.warmupIds.length:s.ids.length;
 if(s.index+1<count)return {...s,index:s.index+1};
 const sequence:Stage[]=s.kind==="daily"?["warmup","learn","en","ko","sentence","done"]:s.kind==="weekly"?["en","ko","sentence","done"]:["ko","sentence","done"];
 const stage=sequence[sequence.indexOf(s.stage)+1]||"done";
 if(stage==="done"&&s.retry.length&&s.ids.length>=3)return {...s,stage:s.retry[0].direction,retryMode:true,index:0};
 return {...s,stage,index:0,finished:stage==="done",paused:stage==="done"};
}
export function applyRecord(state:State,s:Session,id:string,patch:Partial<RecordItem>,advance=true):State{
 const wasRetry=s.retryMode;
 if(wasRetry){patch={...patch};if(patch.en){patch.retryEn=patch.en;delete patch.en;}if(patch.ko){patch.retryKo=patch.ko;delete patch.ko;}}
 const record={...s.records[id],...patch};
 const failed=(patch.en==="help"||patch.ko==="help")&&!wasRetry;
 const retry=failed?[...s.retry,{id,direction:patch.en?"en" as const:"ko" as const}]:s.retry;
 const nextSession={...s,records:{...s.records,[id]:record},retry};
 const p=state.progress[id]||{};
 const studyDates=s.kind==="daily"?[...new Set([...(p.studyDates||[]),s.date])]:p.studyDates;
 // Monthly writing does not overwrite an untested English-to-Korean result.
 const en=record.en==="unmeasured"?p.en:record.en, ko=record.ko==="unmeasured"?p.ko:record.ko;
 const sentenceStatus=record.sentenceStatus==="unmeasured"?p.sentenceStatus:record.sentenceStatus;
 const updated:Progress={...p,meaning:record.meaning,en,ko,sentenceStatus,sentence:record.sentence||p.sentence,notes:record.notes||p.notes,studyDates,lastStudied:s.kind==="daily"?s.date:p.lastStudied,needsReview:!sessionRecordComplete(s,record)};
 return {...state,progress:{...state.progress,[id]:updated},sessions:{...state.sessions,[s.id]:advance?stepSession(nextSession):nextSession}};
}
export function ensureCarryover(state:State,s:Session):State{const progress={...state.progress};for(const id of s.ids){const r=s.records[id];if(!r||!sessionRecordComplete(s,r)){progress[id]={...progress[id],needsReview:true};}}return {...state,progress};}
export function exportLog(state:State,words:Word[]):string{const map=new Map(words.map(w=>[w.id,w]));const rows=[["학습일","종류","단어","품사","수준","학습 뜻","처음 표시","영어→뜻","뜻→영어","내 문장","보완점","재시도 영어→뜻","재시도 뜻→영어","다음 할 일"]];for(const s of Object.values(state.sessions).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))){for(const id of s.ids){const w=map.get(id);const r=s.records[id]||emptyRecord();rows.push([s.date,s.kind,w?.word||id,w?.pos||"",w?.level||"",r.meaning,r.familiarity?FAMILIARITY_TEXT[r.familiarity]:"미표시",RESULT_TEXT[r.en],RESULT_TEXT[r.ko],r.sentence,r.notes,RESULT_TEXT[r.retryEn||"unmeasured"],RESULT_TEXT[r.retryKo||"unmeasured"],nextAction(r)]);}}return "\ufeff"+rows.map(row=>row.map(x=>'"'+(/^[=+@\-]/.test(x)?"'":"")+x.replaceAll('"','""')+'"').join(',')).join('\r\n');}
