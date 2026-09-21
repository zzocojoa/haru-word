import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMPTY,dailyAssignedIds,pickDaily,newSession,reviewIds,repeatDailySession} from '../lib/learning.ts';
const words=JSON.parse(readFileSync(new URL('../data/words.json',import.meta.url)));
const date='2026-09-21';
const content=()=>({meaning:'학습 뜻',expression:'',example:'',translation:'',source:'test'});
function fixture(){
 const state=structuredClone(EMPTY);const first=newSession(state,words,content,'daily',date);
 first.finished=true;first.stage='done';first.paused=true;
 for(const id of first.ids){first.records[id]={...first.records[id],learnedOn:date,en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Original sentence.',notes:'Original note.'};state.progress[id]={familiarity:'known',meaning:'학습 뜻',lastStudied:date,studyDates:[date]};}
 state.sessions[first.id]=first;return {state,first};
}
test('raising three to ten allocates only seven new targets and preserves the original records',()=>{
 const {state,first}=fixture(),original=structuredClone(first);state.settings.dailyGoal=10;
 const extra=newSession(state,words,content,'daily',date);
 assert.equal(extra.ids.length,7);assert.ok(extra.ids.every(id=>!first.ids.includes(id)));
 assert.deepEqual(extra.warmupIds,[]);
 assert.ok(Object.values(extra.records).every(r=>r.en==='unmeasured'&&r.ko==='unmeasured'&&r.sentenceStatus==='unmeasured'));
 state.sessions[extra.id]=extra;assert.deepEqual(state.sessions[first.id],original);
 assert.equal(dailyAssignedIds(state,date).length,10);assert.deepEqual(pickDaily(words,state,date),[]);assert.equal(newSession(state,words,content,'daily',date),null);
 assert.equal(reviewIds(state,'weekly',date).length,10);assert.equal(reviewIds(state,'monthly','2026-09').length,3);
 extra.finished=true;extra.stage='done';assert.equal(repeatDailySession(state,words,date,date).ids.length,10);
});
test('multiple increases fill only the remaining daily budget and tomorrow gets its own budget',()=>{
 const {state}=fixture();state.settings.dailyGoal=5;const second=newSession(state,words,content,'daily',date);assert.equal(second.ids.length,2);second.finished=true;state.sessions[second.id]=second;
 state.settings.dailyGoal=10;const third=newSession(state,words,content,'daily',date);assert.equal(third.ids.length,5);third.finished=true;state.sessions[third.id]=third;
 assert.equal(dailyAssignedIds(state,date).length,10);assert.equal(newSession(state,words,content,'daily',date),null);
 assert.equal(newSession(state,words,content,'daily','2026-09-22').ids.length,10);
});
test('a lower goal never removes assigned words; an unfinished daily must be resumed first',()=>{
 const {state,first}=fixture();state.settings.dailyGoal=1;assert.deepEqual(pickDaily(words,state,date),[]);assert.equal(newSession(state,words,content,'daily',date),null);assert.equal(first.ids.length,3);
 first.finished=false;state.settings.dailyGoal=10;assert.equal(newSession(state,words,content,'daily',date),null);
});
test('same headword in another part of speech is excluded across today’s sessions',()=>{
 const {state,first}=fixture();const noun=words.find(w=>w.word==='book'&&w.pos==='n.'),verb=words.find(w=>w.word==='book'&&w.pos==='v.');
 first.ids=[noun.id];first.records={[noun.id]:{meaning:'책',en:'independent',ko:'independent',sentenceStatus:'written',sentence:'A book.',notes:''}};state.settings.dailyGoal=10;
 state.progress[verb.id]={needsReview:true};assert.ok(!pickDaily(words,state,date).includes(verb.id));
});
test('new-word pause and candidate shortages cannot fabricate the remainder',()=>{
 const {state,first}=fixture();state.settings.dailyGoal=10;state.settings.newWordsPaused=true;assert.deepEqual(pickDaily(words,state,date),[]);
 const carry=words.find(w=>!first.ids.includes(w.id));state.progress[carry.id]={needsReview:true};assert.deepEqual(pickDaily(words,state,date),[carry.id]);
 assert.equal(newSession(state,words,content,'daily',date).ids.length,1);
});
