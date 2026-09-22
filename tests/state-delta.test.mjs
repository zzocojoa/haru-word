import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMPTY,newSession,applyRecord,ensureCarryover } from '../lib/learning.ts';
import { stateDelta } from '../lib/state-delta.ts';

const words=JSON.parse(readFileSync(new URL('../data/words.json',import.meta.url)));
const material=()=>({meaning:'오늘의 뜻',expression:'',example:'',translation:'',source:'test'});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze)}return value}
function merge(base,delta){return {settings:delta.settings??base.settings,progress:{...base.progress,...delta.progress},sessions:{...base.sessions,...delta.sessions}}}

test('goal-only saves and equivalent cloned backups preserve all history',()=>{
 const base=structuredClone(EMPTY);const session=newSession(base,words,material,'daily','2026-09-21');
 base.sessions[session.id]=session;freeze(base);
 const next={...base,settings:{...base.settings,dailyGoal:10}};
 const delta=stateDelta(base,next);
 assert.deepEqual(delta,{settings:next.settings,progress:{},sessions:{}});
 assert.deepEqual(merge(base,delta),next);
 assert.deepEqual(stateDelta(base,structuredClone(base)),{settings:undefined,progress:{},sessions:{}});
});

test('learning, carryover, and failed-save retry deltas reconstruct the complete next state',()=>{
 const base=structuredClone(EMPTY);const session=newSession(base,words,material,'daily','2026-09-21');
 base.sessions[session.id]=session;freeze(base);
 const learned=applyRecord(base,session,session.ids[0],{meaning:'선택한 뜻'},true,'2026-09-21');
 const paused=ensureCarryover(learned,{...learned.sessions[session.id],paused:true});
 // A failed save does not advance the persisted base. Retry must include both changes.
 const delta=stateDelta(base,paused);
 assert.deepEqual(merge(base,delta),paused);
 assert.equal(Object.keys(delta.sessions).length,1);
 assert.equal(delta.progress[session.ids[0]].meaning,'선택한 뜻');
 assert.ok(delta.progress[session.ids[1]].needsReview);
 assert.deepEqual(stateDelta(paused,paused),{settings:undefined,progress:{},sessions:{}});
});
