import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {build} from 'esbuild';
import {EMPTY,newSession,dailyAssignedIds,pickDaily,reviewTargets,storeSense} from '../lib/learning.ts';
await build({entryPoints:['lib/study-date-correction.ts','lib/study-clock.ts','lib/backup.ts'],outdir:'work/study-date-tests',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const {correctDailyStudyDate,isCalendarDate,dailyOrigins}=await import('../work/study-date-tests/study-date-correction.mjs');
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
test('server clock ignores device wall time and rolls over in Seoul',()=>{
 let tick=0;const clock=createStudyClock(Date.parse('2026-09-21T14:59:55Z'),()=>tick);
 assert.equal(clock.date(),'2026-09-21');tick=6000;assert.equal(clock.date(),'2026-09-22');
 clock.sync(Date.parse('2026-09-22T15:00:01Z'));assert.equal(clock.date(),'2026-09-23');
 assert.throws(()=>clock.sync(NaN));assert.throws(()=>clock.sync(Number.MAX_VALUE));assert.equal(clock.date(),'2026-09-23');
});
test('correcting the finished ten frees today without deleting or passing any work',()=>{
 const {state,session}=fixture(),before=structuredClone(state),next=correctDailyStudyDate(state,session.id,'2026-09-21','2026-09-22');
 assert.deepEqual(state,before);assert.equal(dailyAssignedIds(next,'2026-09-22').length,0);assert.equal(dailyAssignedIds(next,'2026-09-21').length,10);
 assert.deepEqual(new Set(pickDaily(words,next,'2026-09-22')),new Set(session.ids));
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
