import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {build} from 'esbuild';
import {EMPTY,newSession,dailyAssignedIds,pickDaily,reviewTargets,storeSense,emptyRecord,ensureCarryover} from '../lib/learning.ts';
await build({entryPoints:['lib/study-date-correction.ts','lib/study-clock.ts','lib/backup.ts'],outdir:'work/study-date-tests',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const {correctDailyStudyDate,isCalendarDate,dailyOrigins,dailyOriginSummary}=await import('../work/study-date-tests/study-date-correction.mjs');
const {createStudyClock}=await import('../work/study-date-tests/study-clock.mjs');
const {parseBackup,makeBackup}=await import('../work/study-date-tests/backup.mjs');
const words=JSON.parse(readFileSync('data/words.json','utf8'));
const content=()=>({meaning:'one meaning',expression:'a phrase',example:'My example.',translation:'예문',source:'test'});
function fixture(date='2026-09-22'){
 const state=structuredClone(EMPTY);state.settings.dailyGoal=10;
 const session=newSession(state,words,content,'daily',date);session.stage='done';session.finished=true;session.paused=true;
 for(const id of session.ids){session.records[id]={...session.records[id],learnedOn:date,lastPracticedOn:date,en:'independent',ko:'help',sentenceStatus:'written',sentence:'Keep my sentence.',notes:'Keep my note.',retryKo:'independent'};state.progress[id]={meaning:'one meaning',studyDates:[date],lastStudied:date,lastReviewed:date,en:'independent',ko:'help',sentenceStatus:'written',needsReview:true}}
 state.sessions[session.id]=session;state.settings.activeSessionId=session.id;return {state,session};
}

test('one origin summary supplies matching counts and labels without mutating history',()=>{
 const {state,session}=fixture(); const previous=structuredClone(state);
 const fresh=words.find(w=>!session.ids.includes(w.id)).id;
 const ids=[...session.ids,fresh],summary=dailyOriginSummary(state,ids,'2026-09-23');
 assert.equal(summary.returning,10); assert.equal(summary.newCount,1);
 assert.deepEqual(session.ids.map(id=>summary.byId[id]),Array(10).fill('returning'));
 assert.equal(summary.byId[fresh],'new');
 assert.deepEqual(dailyOrigins(state,ids,'2026-09-23'),{returning:10,newCount:1});
 assert.deepEqual(state,previous);
});
test('server clock ignores device wall time and rolls over in Seoul',()=>{
 let tick=0;const clock=createStudyClock(Date.parse('2026-09-21T14:59:55Z'),()=>tick);
 assert.equal(clock.date(),'2026-09-21');tick=6000;assert.equal(clock.date(),'2026-09-22');
 clock.sync(Date.parse('2026-09-22T15:00:01Z'));assert.equal(clock.date(),'2026-09-23');
 assert.throws(()=>clock.sync(NaN));assert.throws(()=>clock.sync(Number.MAX_VALUE));assert.equal(clock.date(),'2026-09-23');
});
test('correcting the finished ten frees today without deleting or passing any work',()=>{
 const {state,session}=fixture(),before=structuredClone(state),next=correctDailyStudyDate(state,session.id,'2026-09-21','2026-09-22');
 assert.deepEqual(state,before);assert.equal(dailyAssignedIds(next,'2026-09-22').length,0);assert.equal(dailyAssignedIds(next,'2026-09-21').length,10);
 assert.equal(pickDaily(words,next,'2026-09-22').filter(id=>session.ids.includes(id)).length,5);
 assert.equal(next.sessions[session.id].createdAt,session.createdAt);assert.equal(next.sessions[session.id].finished,true);
 for(const id of session.ids){assert.deepEqual(next.sessions[session.id].records[id],{...session.records[id],learnedOn:'2026-09-21',lastPracticedOn:'2026-09-21'});assert.deepEqual(next.progress[id].studyDates,['2026-09-21']);assert.equal(next.progress[id].needsReview,true);assert.equal(next.progress[id].lastReviewed,'2026-09-22')}
 assert.deepEqual(dailyOrigins(next,session.ids,'2026-09-22'),{returning:10,newCount:0});
 assert.deepEqual(parseBackup(JSON.stringify(makeBackup(next))).state,JSON.parse(JSON.stringify(next)));
});
test('correction can be reversed and rejects future, invalid and unfinished targets',()=>{
 const {state,session}=fixture();const next=correctDailyStudyDate(state,session.id,'2026-09-21','2026-09-22');const back=correctDailyStudyDate(next,session.id,'2026-09-22','2026-09-22');
 assert.deepEqual(back.sessions[session.id],session);for(const id of session.ids)assert.deepEqual(back.progress[id].studyDates,['2026-09-22']);
 for(const d of ['2026-02-30','2026-13-01','bad','2026-09-23'])assert.throws(()=>correctDailyStudyDate(state,session.id,d,'2026-09-22'));
 session.finished=false;assert.throws(()=>correctDailyStudyDate(state,session.id,'2026-09-21','2026-09-22'));
 assert.equal(isCalendarDate('2024-02-29'),true);assert.equal(isCalendarDate('2025-02-29'),false);
});
test('cross-month correction updates cumulative learning but preserves review snapshots',()=>{
 const {state,session}=fixture('2026-10-01');const review={...structuredClone(session),id:crypto.randomUUID(),kind:'monthly',period:'2026-10',finished:false,stage:'ko'};state.sessions[review.id]=review;
 const next=correctDailyStudyDate(state,session.id,'2026-09-30','2026-10-01');assert.equal(reviewTargets(next,'monthly','2026-10').length,0);assert.equal(reviewTargets(next,'monthly','2026-09').length,10);assert.deepEqual(next.sessions[review.id],review);
});
test('another session, sense and actual study day survive a correction',()=>{
 const {state,session}=fixture(),id=session.ids[0];const other={...structuredClone(session),id:crypto.randomUUID()};state.sessions[other.id]=other;
 state.progress[id]=storeSense(state.progress[id],{meaning:'a second meaning',studyDates:['2026-09-22'],lastStudied:'2026-09-22',en:'help',needsReview:true});
 session.records[session.ids[1]].learnedOn='2026-09-23';session.records[session.ids[1]].lastPracticedOn='2026-09-23';
 const next=correctDailyStudyDate(state,session.id,'2026-09-21','2026-09-23');
 assert.deepEqual(next.sessions[other.id],other);assert.deepEqual(next.progress[id].studyDates,['2026-09-21','2026-09-22']);assert.deepEqual(next.progress[id].senses['a second meaning'],state.progress[id].senses['a second meaning']);assert.equal(next.sessions[session.id].records[session.ids[1]].learnedOn,'2026-09-23');
});
test('pending practice work is shown as carryover, not as new vocabulary',()=>{
 const state=structuredClone(EMPTY),id=words[0].id;
 state.progress[id]={needsReview:true};assert.deepEqual(dailyOrigins(state,[id,words[1].id],'2026-09-22'),{returning:1,newCount:1});
});
test('assessed practice stays returning before assignment, after assignment and reload',()=>{
 const state=structuredClone(EMPTY),date='2026-09-23',daily=newSession(state,words,content,'daily',date),[failed,written,fresh]=daily.ids;
 const practice={...structuredClone(daily),id:crypto.randomUUID(),kind:'practice',date,ids:['failed-sense',written],records:{
  'failed-sense':{...emptyRecord('one meaning'),entryId:failed,ko:'help'},
  [written]:{...emptyRecord('one meaning'),entryId:written,sentenceStatus:'written'},
 }};
 // Legacy records did not freeze allocation origins.
 for(const r of Object.values(daily.records))delete r.dailyOrigin;
 state.sessions[practice.id]=practice;state.progress[failed]={needsReview:true};
 const before=structuredClone(state),expected={returning:2,newCount:1};
 assert.deepEqual(dailyOrigins(state,[failed,written,fresh],date),expected);assert.deepEqual(state,before);
 const assigned=ensureCarryover({...state,sessions:{...state.sessions,[daily.id]:daily}},daily);
 assert.deepEqual(dailyOrigins(assigned,daily.ids,date),expected);
 assert.deepEqual(dailyOrigins(JSON.parse(JSON.stringify(assigned)),daily.ids,date),expected);
});
test('unmeasured review targets, future results and today-only daily work stay new',()=>{
 const state=structuredClone(EMPTY),date='2026-09-23',daily=newSession(state,words,content,'daily',date),[waiting,future,current]=daily.ids;
 daily.records[current]={...daily.records[current],en:'independent',learnedOn:date};
 const monthly={...structuredClone(daily),id:crypto.randomUUID(),kind:'monthly',date:'2026-09-22',ids:[waiting,future],records:{
  [waiting]:emptyRecord('one meaning'),[future]:{...emptyRecord('one meaning'),ko:'help',lastPracticedOn:'2026-09-24'},
 }};
 state.sessions={[daily.id]:daily,[monthly.id]:monthly};
 const assigned=ensureCarryover(state,daily);
 assert.deepEqual(dailyOrigins(assigned,daily.ids,date),{returning:0,newCount:3});
});
