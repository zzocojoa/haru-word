import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import {EMPTY,emptyRecord,newSession,extendReviewSession,missingReviewTargets,currentId,stepSession,continueBatch,applyRecord,reviewTargets,weekStart} from '../lib/learning.ts';
const words=JSON.parse(readFileSync('data/words.json','utf8')),contents=JSON.parse(readFileSync('data/content.json','utf8'));
const content=id=>contents[id],date='2026-09-22';
mkdirSync('work/review-extension',{recursive:true});
await build({entryPoints:['lib/backup.ts'],outfile:'work/review-extension/backup.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const {parseBackup,makeBackup}=await import('../work/review-extension/backup.mjs');
function addDaily(state,entries,day=date,learned=true){
 const id=crypto.randomUUID();const ids=entries.map(w=>w.id);
 state.sessions[id]={id,kind:'daily',date:day,period:day,ids,warmupIds:[],stage:learned?'done':'learn',index:0,records:Object.fromEntries(ids.map(id=>[id,{...emptyRecord(content(id).meaning),entryId:id,material:content(id),...(learned?{learnedOn:day,en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Saved original.'}:{})}])),retry:[],retryMode:false,elapsed:0,finished:learned,paused:true,createdAt:day+'T00:00:00Z'};
 return state.sessions[id];
}
function fixture(kind='weekly'){
 const state=structuredClone(EMPTY);addDaily(state,words.slice(0,3));
 const session=newSession(state,words,content,kind,date);state.sessions[session.id]=session;
 return {state,session};
}
function roundTrip(state,s){state.sessions[s.id]=s;return parseBackup(JSON.stringify(makeBackup(state))).state.sessions[s.id]}

test('goal changes alone do not invent review targets; weekly allocation and monthly learning use their own criteria',()=>{
 for(const kind of ['weekly','monthly']){
  const {state,session}=fixture(kind);state.settings.dailyGoal=10;
  assert.equal(missingReviewTargets(state,session).length,0);
  const extra=addDaily(state,words.slice(3,10),date,false);
  assert.equal(missingReviewTargets(state,session).length,kind==='weekly'?7:0);
  for(const record of Object.values(extra.records))record.learnedOn=date;
  assert.equal(missingReviewTargets(state,session).length,7);
  const extended=extendReviewSession(state,words,session,content);
  assert.equal(extended.ids.length,10);state.settings.dailyGoal=1;
  assert.equal(extendReviewSession(state,words,extended,content).ids.length,10);
  assert.equal(extended.index,session.index);assert.equal(extended.stage,session.stage);
  assert.deepEqual(extended.ids.slice(0,3),session.ids);
  for(const id of session.ids)assert.deepEqual(extended.records[id],session.records[id]);
 }
});

test('every saved stage resumes its original cursor then tests every added target without skipping or regrading old stages',()=>{
 for(const kind of ['weekly','monthly'])for(const stage of kind==='weekly'?['en','ko','sentence']:['ko','sentence']){
  const {state,session}=fixture(kind);session.stage=stage;session.index=1;session.elapsed=123;
  // A saved cursor after KO implies those prior answers were actually recorded.
  if(kind==='monthly') for(const id of stage==='sentence'?session.ids:session.ids.slice(0,session.index)) session.records[id].ko='independent';
  const current=session.ids[1];session.records[current]={...session.records[current],notes:'keep this',draft:{answer:'saved answer',hinted:true,revealed:true,stage:stage==='ko'?'ko':'en',retry:false}};
  addDaily(state,words.slice(3,10));let s=extendReviewSession(state,words,session,content);
  assert.equal(currentId(s),current);assert.equal(s.elapsed,123);assert.deepEqual(s.records[current],session.records[current]);
  const added=s.ids.slice(3),visits=[];let steps=0;
  while(!s.finished){assert.ok(steps++<100);s=roundTrip(state,s);if(s.stage==='checkpoint'){s=continueBatch(s);continue;}visits.push([currentId(s),s.stage]);if(s.stage==='ko')s.records[currentId(s)].ko='independent';s=stepSession(s)}
  roundTrip(state,s);
  for(const id of added)assert.deepEqual(visits.filter(([target])=>target===id).map(([,stage])=>stage),kind==='weekly'?['en','ko','sentence']:['ko','sentence']);
  assert.equal(visits.some(([id,step])=>id===current&&step==='en'&&stage!=='en'),false);
 }
});

test('a retry whose saved return was done reaches the added block instead of finishing early',()=>{
 for(const kind of ['weekly','monthly']){
  const {state,session}=fixture(kind);const id=session.ids[0];
  const retry={...session,stage:'ko',retryMode:true,retry:[{id,direction:'ko',seen:[]}],resumeAfterRetry:{stage:'done',index:0}};
  addDaily(state,words.slice(3,10));const expanded=extendReviewSession(state,words,retry,content);
  assert.deepEqual(expanded.resumeAfterRetry,{stage:'checkpoint',index:3});
  const next=stepSession(expanded);assert.equal(next.finished,false);assert.equal(next.stage,'checkpoint');
  const resumed=continueBatch(next);assert.equal(resumed.index,3);assert.equal(resumed.stage,kind==='weekly'?'en':'ko');
 }
});

test('repeated extensions are idempotent, preserve meaning-specific snapshots and do not alter finished or unrelated periods',()=>{
 const {state,session}=fixture();const original=JSON.stringify(session);
 addDaily(state,words.slice(3,6));const first=extendReviewSession(state,words,session,content);
 addDaily(state,words.slice(6,10));const second=extendReviewSession(state,words,first,content);
 assert.equal(second.reviewEnd,3);assert.equal(second.ids.length,10);assert.equal(extendReviewSession(state,words,second,content),second);
 const other=addDaily(state,[words[0]]);other.records[words[0].id].meaning='같은 단어의 다른 학습 뜻';
 const third=extendReviewSession(state,words,second,content);assert.equal(third.ids.length,11);
 const addedId=third.ids.at(-1);assert.notEqual(addedId,words[0].id);assert.equal(third.records[addedId].entryId,words[0].id);
 assert.equal(JSON.stringify(session),original);
 addDaily(state,words.slice(20,23),'2026-10-22');assert.equal(missingReviewTargets(state,third).length,0);
 const done={...session,finished:true,stage:'done'};assert.equal(extendReviewSession(state,words,done,content),done);
 assert.equal(weekStart(date),session.period);roundTrip(state,third);
});

test('monthly batch boundaries preserve an unfinished partial block before new writing targets',()=>{
 const {state,session}=fixture('monthly');state.settings.monthlyBatchSize=1;
 for(const id of session.ids)session.records[id].ko='independent';
 let s={...session,stage:'sentence',index:2,batchSize:15};addDaily(state,words.slice(3,10));s=extendReviewSession(state,words,s,content);
 assert.equal(s.batchSize,15);s=stepSession(s);assert.equal(s.stage,'checkpoint');assert.equal(s.index,3);
 s=continueBatch(roundTrip(state,s));assert.equal(s.stage,'ko');assert.equal(s.batchStart,3);assert.equal(s.reviewEnd,undefined);
 addDaily(state,words.slice(10,13));s=extendReviewSession(state,words,s,content);assert.equal(s.reviewEnd,10);
 const checked=[];while(!s.finished){s=roundTrip(state,s);if(s.stage==='checkpoint'){s=continueBatch(s);continue;}if(s.stage==='ko')checked.push(currentId(s));state.sessions[s.id]=s;const next=applyRecord(state,s,currentId(s),s.stage==='ko'?{ko:'independent'}:{sentenceStatus:'unmeasured'},true,date);s=next.sessions[s.id];}
 assert.equal(checked.length,10);assert.equal(new Set(checked).size,10);roundTrip(state,s);
});

test('legacy unknown meanings do not create duplicate review entries on resume',()=>{
 const state=structuredClone(EMPTY);state.progress[words[0].id]={studyDates:[date]};
 const session=newSession(state,words,content,'monthly',date);assert.ok(session.records[session.ids[0]].meaning);
 assert.equal(missingReviewTargets(state,session).length,0);
 assert.equal(extendReviewSession(state,words,session,content),session);
});
