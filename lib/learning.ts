export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type Level = typeof LEVELS[number];
export type Familiarity = "known" | "uncertain" | "new";
export type Result = "independent" | "help" | "unmeasured";
export type SentenceResult = "written" | "improve" | "unmeasured";
export type Stage = "warmup" | "learn" | "en" | "ko" | "sentence" | "checkpoint" | "done";
export type Kind = "daily" | "weekly" | "monthly" | "practice";
export type PracticeMode = "known" | "ko" | "sentence";
export type Word = {id:string;word:string;headword:string;pos:string;level:Level;page:number;personal?:boolean};
export type Content = {meaning:string;ipa?:string;expression:string;example:string;translation:string;source:string;attribution?:string;url?:string};
export type Progress = {
  familiarity?: Familiarity; meaning?: string; expression?:string; example?:string; translation?:string;
  en?:Result;ko?:Result;sentenceStatus?:SentenceResult;sentence?:string;notes?:string;
  studyDates?:string[];lastStudied?:string;needsReview?:boolean;personal?:Word;
  useful?:boolean;lastReviewed?:string;encounters?:{date:string;source:"reading"|"listening";text:string}[];
};
export type Assessment = {ids:string[];index:number;marks:Record<string,Familiarity>;completed:boolean};
export type Settings = {level:Level;dailyGoal:number;assessments:Partial<Record<Level,Assessment>>;activeSessionId:string|null;newWordsPaused?:boolean;monthlyBatchSize?:number;reviewDay?:number};
export type RecordItem = {meaning:string;familiarity?:Familiarity;en:Result;ko:Result;sentenceStatus:SentenceResult;sentence:string;notes:string;spoken?:boolean;enAnswer?:string;koAnswer?:string;hintEn?:boolean;hintKo?:boolean;retryEn?:Result;retryKo?:Result;draft?:{answer:string;hinted:boolean;revealed:boolean;stage:"en"|"ko";retry:boolean}};
export type Session = {id:string;kind:Kind;date:string;period:string;ids:string[];wordKeys?:Record<string,string>;warmupIds:string[];warmupResults?:Record<string,Result>;warmupDraft?:{id:string;answer:string;hinted:boolean;revealed:boolean};stage:Stage;index:number;records:Record<string,RecordItem>;retry: {id:string;direction:"en"|"ko";seen?:string[]}[];retryMode:boolean;resumeAfterRetry?:{stage:Stage;index:number};batchSize?:number;batchStart?:number;practiceMode?:PracticeMode;elapsed:number;finished:boolean;paused:boolean;createdAt:string};
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
export function assessmentAdvice(a:Assessment,level:Level):{text:string;suggested:Level;goal?:number}{const counts=Object.values(a.marks).reduce((c,v)=>(c[v]++,c),{known:0,uncertain:0,new:0});const ix=LEVELS.indexOf(level);if(counts.known>=14&&ix<3)return {text:"익숙한 단어가 많아요. 다음 수준에서도 20개를 확인해 보세요.",suggested:LEVELS[ix+1]};if(counts.new>=14)return ix?{text:"처음 보는 단어가 많아요. 한 수준 아래부터 살펴보세요.",suggested:LEVELS[ix-1]}:{text:"한국어 설명을 활용하며 하루 1~2개로 시작해도 좋아요.",suggested:level,goal:2};return {text:"아는 단어와 헷갈리는 단어가 섞여 있어요. 이 수준에서 시작해 보세요.",suggested:level};}
const everyday=["arrive","busy","breakfast","work","home","food","water","time","help","need","want","buy","travel","meet","friend","family","learn","call","plan","use","important"];
export function pickDaily(words:Word[],state:State,date=today()):string[]{
 const progress=state.progress; const recentTargets=new Set(Object.values(state.sessions).filter(s=>s.kind==="daily"&&s.date===date).flatMap(s=>s.ids));
 const pauseNew=state.settings.newWordsPaused||Object.values(state.sessions).some(s=>s.kind==="monthly"&&!s.finished);
 const candidates=words.filter(w=>!recentTargets.has(w.id)&&(progress[w.id]?.needsReview || (!pauseNew&&w.level===state.settings.level && progress[w.id]?.familiarity!=="known"&&!progress[w.id]?.lastStudied)));
 function priority(w:Word){const p=progress[w.id]; return p?.needsReview?0:p?.familiarity==="uncertain"?1:p?.familiarity==="new"?2:3;}
 candidates.sort((a,b)=>priority(a)-priority(b)||Number(!!progress[b.id]?.useful)-Number(!!progress[a.id]?.useful)||(everyday.includes(a.word)?0:1)-(everyday.includes(b.word)?0:1)||hash(date+a.id)-hash(date+b.id));
 const out:string[]=[]; const seen=new Set<string>(); for(const w of candidates){if(seen.has(w.headword))continue;out.push(w.id);seen.add(w.headword);if(out.length>=state.settings.dailyGoal)break;}return out;
}
export function reviewIds(state:State,kind:"weekly"|"monthly",period:string):string[]{
 const ids=new Set<string>(); if(kind==="monthly"){for(const [id,p]of Object.entries(state.progress))if(p.studyDates?.some(date=>date.slice(0,7)===period))ids.add(id);}else for(const s of Object.values(state.sessions)){if(s.kind==="daily"&&weekStart(s.date)===period)s.ids.forEach(id=>ids.add(id));}
 // A deterministic interleave avoids alphabetic cueing and resumes without reshuffling.
 return [...ids].sort((a,b)=>hash(period+a)-hash(period+b));
}
function hash(v:string):number{let h=0;for(const c of v)h=(h*31+c.charCodeAt(0))>>>0;return h;}
export function practiceIds(state:State,mode:PracticeMode):string[]{return Object.entries(state.progress).filter(([,p])=>mode==="known"?p.familiarity==="known":mode==="ko"?p.ko==="help":p.sentenceStatus==="improve").sort((a,b)=>(a[1].lastReviewed||"").localeCompare(b[1].lastReviewed||"")||hash(a[0])-hash(b[0])).slice(0,20).map(([id])=>id);}
export function newSession(state:State,words:Word[],content:(id:string)=>Content,kind:Kind,date=today(),period=periodKey(kind,date),practiceMode?:PracticeMode):Session|null{
 const ids=kind==="daily"?pickDaily(words,state,date):kind==="practice"?practiceIds(state,practiceMode||"known"):reviewIds(state,kind,period); if(!ids.length)return null;
 const warmupIds=kind==="daily"?Object.entries(state.progress).filter(([,p])=>p.lastStudied).sort((a,b)=>Number(!!b[1].needsReview)-Number(!!a[1].needsReview)||(b[1].lastStudied||"").localeCompare(a[1].lastStudied||"")).slice(0,3).map(([id])=>id):[];
 const records=Object.fromEntries(ids.map(id=>[id,emptyRecord(state.progress[id]?.meaning||content(id).meaning,state.progress[id]?.familiarity)]));
 return {id:crypto.randomUUID(),kind,date,period,ids,wordKeys:Object.fromEntries(ids.map(id=>[id,words.find(w=>w.id===id)?.word.toLowerCase()||id])),warmupIds,stage:kind==="daily"?(warmupIds.length?"warmup":"learn"):kind==="monthly"||practiceMode==="ko"?"ko":practiceMode==="sentence"?"sentence":"en",index:0,records,retry:[],retryMode:false,...(kind==="monthly"?{batchSize:state.settings.monthlyBatchSize||15,batchStart:0}:{}),...(kind==="practice"?{practiceMode:practiceMode||"known"}:{}),elapsed:0,finished:false,paused:false,createdAt:new Date().toISOString()};
}
export function currentId(s:Session):string|undefined{return s.retryMode?s.retry[0]?.id:s.stage==="warmup"?s.warmupIds[s.index]:s.ids[s.index];}
export function stepSession(s:Session):Session{
 const id=currentId(s);const wordKey=(id:string)=>s.wordKeys?.[id]||id;
 // Count distinct intervening words, not elapsed clicks or a repeat of the same word.
 const retry=(s.retryMode?s.retry.slice(1):s.retry).map(r=>({...r,seen:id&&wordKey(r.id)===wordKey(id)?[]:[...new Map([...(r.seen||[]),...(id&&["en","ko","sentence"].includes(s.stage)?[id]:[])].map(seen=>[wordKey(seen),seen])).values()]}));
 let next:Session;
 if(s.retryMode){const cursor=s.resumeAfterRetry||{stage:"done" as Stage,index:0};next={...s,...cursor,retryMode:false,resumeAfterRetry:undefined};}
 else {
  const start=s.kind==="monthly"?(s.batchStart||0):0;
  const end=s.stage==="warmup"?s.warmupIds.length:s.kind==="monthly"&&s.batchSize?Math.min(start+s.batchSize,s.ids.length):s.ids.length;
  if(s.index+1<end)next={...s,index:s.index+1};
  else {
   const sequence:Stage[]=s.kind==="daily"?["warmup","learn","en","ko","sentence","done"]:s.kind==="monthly"?["ko","sentence","done"]:s.practiceMode==="ko"?["ko","done"]:s.practiceMode==="sentence"?["sentence","done"]:["en","ko","sentence","done"];
   let stage=sequence[sequence.indexOf(s.stage)+1]||"done";
   if(stage==="done"&&s.kind==="monthly"&&end<s.ids.length)stage="checkpoint";
   next={...s,stage,index:stage==="checkpoint"?end:stage==="done"?0:start};
  }
 }
 const due=retry.findIndex(r=>(r.seen?.length||0)>=2);
 if(due>=0){const ready=retry[due];return {...next,retry:[ready,...retry.filter((_,i)=>i!==due)],resumeAfterRetry:{stage:next.stage,index:next.index},retryMode:true,stage:ready.direction,finished:false,paused:false};}
 return {...next,retry,finished:next.stage==="done",paused:next.stage==="done"||next.stage==="checkpoint"};
}
export function continueBatch(s:Session):Session{return s.stage==="checkpoint"?{...s,batchStart:s.index,stage:"ko",paused:false}:s;}
export function applyRecord(state:State,s:Session,id:string,patch:Partial<RecordItem>,advance=true):State{
 const wasRetry=s.retryMode;
 if(wasRetry){patch={...patch};if(patch.en){patch.retryEn=patch.en;delete patch.en;}if(patch.ko){patch.retryKo=patch.ko;delete patch.ko;}}
 const record={...s.records[id],...patch};
 const failed=(patch.en==="help"||patch.ko==="help")&&!wasRetry;
 const retry=failed?[...s.retry,{id,direction:patch.en?"en" as const:"ko" as const,seen:[]}]:s.retry;
 const nextSession={...s,records:{...s.records,[id]:record},retry};
 const p=state.progress[id]||{};
 const learnedNow=s.kind==="daily"&&s.stage==="learn"&&advance;
 const studyDates=learnedNow?[...new Set([...(p.studyDates||[]),s.date])]:p.studyDates;
 // Monthly writing does not overwrite an untested English-to-Korean result.
 const en=record.en==="unmeasured"?p.en:record.en, ko=record.ko==="unmeasured"?p.ko:record.ko;
 const sentenceStatus=record.sentenceStatus==="unmeasured"?p.sentenceStatus:record.sentenceStatus;
 const complete=sessionRecordComplete(s,record);
 const otherGap=s.practiceMode==="ko"?(en!=="independent"||sentenceStatus!=="written"):s.practiceMode==="sentence"?(en!=="independent"||ko!=="independent"):s.kind==="monthly"?(en==="help"||sentenceStatus==="improve"):false;
 const updated:Progress={...p,meaning:record.meaning,en,ko,sentenceStatus,sentence:record.sentence||p.sentence,notes:record.notes||p.notes,studyDates,lastStudied:learnedNow?s.date:p.lastStudied,lastReviewed:s.kind!=="daily"&&advance?s.date:p.lastReviewed,needsReview:!complete||otherGap};
 return {...state,progress:{...state.progress,[id]:updated},sessions:{...state.sessions,[s.id]:advance?stepSession(nextSession):nextSession}};
}
export function ensureCarryover(state:State,s:Session):State{const progress={...state.progress};for(const id of s.ids){const r=s.records[id];if(!r||!sessionRecordComplete(s,r)){progress[id]={...progress[id],needsReview:true};}}return {...state,progress};}
export function exportLog(state:State,words:Word[]):string{const map=new Map(words.map(w=>[w.id,w]));const rows=[["학습일","종류","단어","품사","수준","학습 뜻","처음 표시","영어→뜻","뜻→영어","문장 상태","말하기","내 문장","보완점","재시도 영어→뜻","재시도 뜻→영어","다음 할 일"]];for(const s of Object.values(state.sessions).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))){for(const id of s.ids){const w=map.get(id);const r=s.records[id]||emptyRecord();rows.push([s.date,s.kind,w?.word||id,w?.pos||"",w?.level||"",r.meaning,r.familiarity?FAMILIARITY_TEXT[r.familiarity]:"미표시",RESULT_TEXT[r.en],RESULT_TEXT[r.ko],SENTENCE_TEXT[r.sentenceStatus],r.spoken?"말해 봄":"미측정",r.sentence,r.notes,RESULT_TEXT[r.retryEn||"unmeasured"],RESULT_TEXT[r.retryKo||"unmeasured"],nextAction(r,s)]);}}return "\ufeff"+rows.map(row=>row.map(x=>'"'+(/^[=+@\-]/.test(x)?"'":"")+x.replaceAll('"','""')+'"').join(',')).join('\r\n');}

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
${JSON.stringify(words.filter(w=>latest?.ids.includes(w.id)),null,2)}

마지막 학습 기록:
${exportLog(snapshot,words)}`;
}
