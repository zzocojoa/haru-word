import test from 'node:test';import assert from 'node:assert/strict';
import {sessionCounts, pendingReviewCounts, reviewSessionLabels} from '../lib/learning-display.ts';
import {emptyRecord, EMPTY, pickDaily} from '../lib/learning.ts';
const record=(patch={})=>({...emptyRecord('뜻'),...patch});

test('review labels distinguish same-period sessions, retain finished ordinals and use Korean start dates', () => {
 const make=(id,createdAt,patch={})=>({id,kind:'monthly',period:'2026-09',date:'2026-09-25',createdAt,...patch});
 const sessions={b:make('b','2026-09-24T16:00:00Z'),a:make('a','2026-09-23T01:00:00Z',{finished:true}),w:make('w','2026-09-25T00:00:00Z',{kind:'weekly'}),o:make('o','2026-08-25T00:00:00Z',{period:'2026-08'})};
 const before=structuredClone(sessions),labels=reviewSessionLabels(sessions);
 assert.deepEqual(labels.get('a'),{number:1,latest:false,started:'2026-09-23'});
 assert.deepEqual(labels.get('b'),{number:2,latest:true,started:'2026-09-25'});
 assert.equal(labels.get('w').number,1);assert.equal(labels.get('o').number,1);
 assert.deepEqual(sessions,before);
});

test('equal timestamps have deterministic review labels regardless of record insertion order', () => {
 const a={id:'a',kind:'monthly',period:'2026-09',date:'2026-09-25',createdAt:'2026-09-25T00:00:00Z'},b={...a,id:'b'};
 assert.deepEqual(reviewSessionLabels({b,a}),reviewSessionLabels({a,b}));
});
test('recorded errors, independent success and unmeasured remain distinct without mutation',()=>{
 const s={kind:'daily',ids:['success','help','skip','missing'],records:{success:record({en:'independent',ko:'independent',sentenceStatus:'written'}),help:record({en:'independent',ko:'help',sentenceStatus:'improve'}),skip:record({en:'independent',ko:'independent'})}};
 const before=structuredClone(s);assert.deepEqual(sessionCounts(s),{total:4,recorded:2,successful:1,needsHelp:1,unmeasured:2});assert.deepEqual(s,before);
});
test('monthly optional sentences and directional practice use the existing completion contract',()=>{
 const s={kind:'monthly',ids:['a','b'],records:{a:record({ko:'independent'}),b:record({ko:'help'})}};
 assert.deepEqual(sessionCounts(s),{total:2,recorded:2,successful:1,needsHelp:1,unmeasured:0});
 assert.equal(sessionCounts({...s,kind:'practice',practiceMode:'ko'}).successful,1);
 assert.equal(sessionCounts({...s,kind:'practice',practiceMode:'sentence'}).recorded,0);
});

test('pending counts include new meanings once without mutating queues, grades or daily allocation', () => {
 const state=structuredClone(EMPTY), date='2026-09-23';
 const daily={id:'daily',kind:'daily',date,period:date,createdAt:date+'T00:00:00Z',ids:['a','b'],records:{a:{...record(),entryId:'same',meaning:'첫 뜻',learnedOn:date},b:{...record(),entryId:'same',meaning:'다른 뜻',learnedOn:date}}};
 const monthly={id:'monthly',kind:'monthly',period:'2026-09',finished:false,ids:['a','help','missing'],records:{a:{...record({ko:'independent'}),entryId:'same',meaning:'첫 뜻'},help:record({ko:'help'})}};
 state.sessions={daily,monthly};
 const pool=[{id:'new',word:'new',headword:'new',pos:'adj.',level:'A1',page:1}];
 const before=structuredClone(state), choices=pickDaily(pool,state,date);
 assert.deepEqual(pendingReviewCounts(state,monthly),{total:4,unmeasured:2,added:1});
 assert.deepEqual(pendingReviewCounts(state,{...monthly,kind:'weekly',period:'2026-09-21'}),{total:4,unmeasured:4,added:1});
 assert.deepEqual(pendingReviewCounts(state,{...monthly,finished:true}),{total:3,unmeasured:1,added:0});
 assert.deepEqual(state,before);assert.deepEqual(pickDaily(pool,state,date),choices);
});
