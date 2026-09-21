import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY,emptyRecord,repeatDailySession,applyRecord,ensureCarryover,currentId,reviewIds,pickDaily} from '../lib/learning.ts';
const date='2026-09-21';
const words=['apple','book','cat'].map((word,i)=>({id:`a1-${word}-n`,word,headword:word,pos:'n.',level:'A1',page:1}));
function fixture(){
 const state=structuredClone(EMPTY);const id=crypto.randomUUID();
 const source={id,kind:'daily',date,period:date,ids:words.map(w=>w.id),wordKeys:Object.fromEntries(words.map(w=>[w.id,w.word])),warmupIds:[],stage:'done',index:0,retry:[],retryMode:false,elapsed:900,paused:true,finished:true,createdAt:date+'T00:00:00.000Z',records:{}};
 for(const w of words){source.records[w.id]={...emptyRecord('원래 뜻 '+w.word,'uncertain'),en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Original sentence.',notes:'Original note.',hintEn:false,retryKo:'independent'};state.progress[w.id]={meaning:'단어장에서 나중에 바꾼 뜻',familiarity:'known',en:'independent',ko:'independent',sentenceStatus:'written',needsReview:false,studyDates:[date],lastStudied:date};}
 state.sessions[id]=source;return {state,source};
}
test('repeat uses the completed daily targets and senses with fresh measurements',()=>{
 const {state,source}=fixture();const before=structuredClone(state);state.settings.level='B2';state.settings.dailyGoal=1;
 const s=repeatDailySession(state,words,date,date);assert.equal(s.kind,'practice');assert.equal(s.practiceMode,'repeat');assert.equal(s.stage,'learn');assert.equal(s.period,date);assert.notEqual(s.id,source.id);assert.deepEqual(s.ids,source.ids);
 for(const id of s.ids)assert.deepEqual(s.records[id],emptyRecord(source.records[id].meaning,source.records[id].familiarity));
 assert.equal(s.elapsed,0);assert.deepEqual(s.retry,[]);assert.deepEqual(state.sessions,before.sessions);assert.deepEqual(state.progress,before.progress);
});
test('resume after serialization keeps cursor, drafts and session ID even on another day',()=>{
 const {state}=fixture();const s=repeatDailySession(state,words,date,date);s.stage='ko';s.index=1;s.paused=true;s.elapsed=72;s.records[s.ids[1]].draft={answer:'bo',hinted:false,revealed:false,stage:'ko',retry:false};state.sessions[s.id]=s;
 const restored=repeatDailySession(JSON.parse(JSON.stringify(state)),words,date,'2026-09-22');assert.deepEqual(restored,{...s,paused:false});
});
test('full repeat follows learn, both recall directions, sentence and keeps the original daily record',()=>{
 let {state,source}=fixture();const original=structuredClone(source);let s=repeatDailySession(state,words,date,'2026-10-01');const stages=[];
 while(!s.finished){stages.push(s.stage);const id=currentId(s);const patch=s.stage==='learn'?{meaning:s.records[id].meaning}:s.stage==='sentence'?{sentenceStatus:'written',sentence:'New practice sentence.'}:{[s.stage]:'independent'};state=applyRecord(state,s,id,patch);s=state.sessions[s.id];}
 assert.deepEqual(stages,['learn','learn','learn','en','en','en','ko','ko','ko','sentence','sentence','sentence']);assert.deepEqual(state.sessions[source.id],original);
 for(const id of s.ids){assert.deepEqual(state.progress[id].studyDates,[date]);assert.equal(state.progress[id].lastStudied,date);assert.equal(state.progress[id].needsReview,false);assert.equal(state.progress[id].familiarity,'known');}
 assert.deepEqual(reviewIds(state,'monthly','2026-10'),[]);assert.equal(Object.values(state.sessions).filter(x=>x.kind==='daily').length,1);assert.deepEqual(pickDaily(words,state,date),[]);
});
test('viewing, pausing and skipping optional repeat do not turn previously passed words into carryover',()=>{
 let {state}=fixture();let s=repeatDailySession(state,words,date,date);const before=structuredClone(state.progress);state=ensureCarryover(state,s);assert.deepEqual(state.progress,before);
 while(!s.finished){const id=currentId(s);state=applyRecord(state,s,id,s.stage==='learn'?{meaning:s.records[id].meaning}:s.stage==='sentence'?{sentenceStatus:'unmeasured'}:{[s.stage]:'unmeasured'});s=state.sessions[s.id];state=ensureCarryover(state,s);assert.ok(s.ids.every(id=>!state.progress[id].needsReview));}
 for(const id of s.ids){assert.equal(state.progress[id].en,'independent');assert.equal(state.progress[id].ko,'independent');assert.equal(s.records[id].en,'unmeasured');assert.equal(s.records[id].ko,'unmeasured');}
});
test('actual recall or sentence difficulty carries forward without changing familiarity or original grades',()=>{
 for(const patch of [{ko:'help'},{sentenceStatus:'improve',sentence:'A draft.'}]){let {state,source}=fixture();const original=structuredClone(source);const s=repeatDailySession(state,words,date,date);const id=s.ids[0];state=applyRecord(state,s,id,patch,false);state=ensureCarryover(state,state.sessions[s.id]);assert.equal(state.progress[id].needsReview,true);assert.equal(state.progress[id].familiarity,'known');assert.equal(state.progress[s.ids[1]].needsReview,false);assert.deepEqual(state.sessions[source.id],original);}
});
test('completed repeat remains immutable and a later repeat starts blank again',()=>{
 const {state,source}=fixture();const s={...repeatDailySession(state,words,date,date),stage:'done',finished:true};s.records[s.ids[0]].en='help';state.sessions[s.id]=s;const original=structuredClone(s);const next=repeatDailySession(state,words,date,date);assert.notEqual(next.id,s.id);assert.equal(next.records[next.ids[0]].en,'unmeasured');assert.deepEqual(state.sessions[s.id],original);assert.equal(Object.values(state.sessions).filter(x=>x.kind==='daily').length,1);assert.ok(state.sessions[source.id].finished);
});
test('all completed daily records from the source date are included without duplicate entries',()=>{
 const {state,source}=fixture();const duplicate={...structuredClone(source),id:crypto.randomUUID(),ids:[source.ids[0]],createdAt:date+'T01:00:00.000Z'};duplicate.records={[source.ids[0]]:{...source.records[source.ids[0]],meaning:'최근에 학습한 뜻'}};state.sessions[duplicate.id]=duplicate;const s=repeatDailySession(state,words,date,date);assert.equal(s.ids.length,3);assert.equal(s.records[source.ids[0]].meaning,'최근에 학습한 뜻');
});
test('unfinished, missing or unresolvable daily studies cannot be replayed as complete',()=>{
 const {state,source}=fixture();assert.equal(repeatDailySession(state,words,'2026-09-20'),null);assert.equal(repeatDailySession(state,[],date),null);source.finished=false;assert.equal(repeatDailySession(state,words,date),null);
});
