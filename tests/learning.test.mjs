import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMPTY,assessmentSample,pickDaily,reviewIds,newSession,applyRecord,ensureCarryover,stepSession,continueBatch,practiceIds,sessionRecordComplete,nextAction,weekStart,today,exportLog} from '../lib/learning.ts';
const words=JSON.parse(readFileSync(new URL('../data/words.json',import.meta.url)));
const find=(word,pos='n.')=>words.find(w=>w.word===word&&w.pos===pos);
const content=()=>({meaning:'오늘의 뜻',expression:'',example:'',translation:'',source:'test'});
const fresh=()=>structuredClone(EMPTY);
test('all 3000 PDF headwords and every part of speech are retained',()=>{const report=JSON.parse(readFileSync(new URL('../data/source-audit.json',import.meta.url)));assert.equal(new Set(words.map(w=>w.headword)).size,3000);assert.equal(words.length,3809);assert.equal(new Set(words.map(w=>w.id)).size,words.length);assert.equal(report.sourceRows,3308);assert.ok(find('wish','v.'));assert.ok(find('wish','n.'));assert.equal(find('exit','v.').level,'B2');});
test('assessment spans the selected level and contains 20 distinct headwords',()=>{for(const l of ['A1','A2','B1','B2']){const ids=assessmentSample(words,l);assert.equal(ids.length,20);assert.equal(new Set(ids).size,20);assert.ok(ids.every(id=>words.find(w=>w.id===id).level===l));}});
test('daily priority is carryover, uncertain, unfamiliar and excludes known',()=>{const s=fresh();const a=find('abandon','v.'),b=find('apple'),c=find('cat'),d=find('arrive','v.');s.progress[a.id]={needsReview:true};s.progress[b.id]={familiarity:'uncertain'};s.progress[c.id]={familiarity:'new'};s.progress[d.id]={familiarity:'known'};assert.deepEqual(pickDaily(words,s,'2026-09-21'),[a.id,b.id,c.id]);s.settings.dailyGoal=1;assert.deepEqual(pickDaily(words,s,'2026-09-21'),[a.id]);});
test('same spelling different POS has independent progress',()=>{let s=fresh();const noun=find('book'),verb=find('book','v.');const session=newSession(s,[noun],content,'daily','2026-09-21');s=applyRecord(s,session,noun.id,{en:'independent'},false);assert.equal(s.progress[noun.id].en,'independent');assert.equal(s.progress[verb.id],undefined);});
test('week starts Monday across month/year and Korean date boundaries',()=>{assert.equal(weekStart('2026-09-27'),'2026-09-21');assert.equal(weekStart('2026-01-01'),'2025-12-29');assert.equal(today(new Date('2026-09-20T15:00:00Z')),'2026-09-21');});
test('weekly includes every target, monthly includes only actually studied words',()=>{const s=fresh();const a=find('apple'),b=find('book');const x=newSession(s,[a,b],content,'daily','2026-09-21');s.sessions[x.id]=x;s.progress[a.id]={studyDates:['2026-09-21'],lastStudied:'2026-09-21'};assert.deepEqual(new Set(reviewIds(s,'weekly','2026-09-21')),new Set([a.id,b.id]));assert.deepEqual(reviewIds(s,'monthly','2026-09'),[a.id]);});
test('unmeasured and unfinished items cannot silently pass',()=>{let s=fresh();const x=newSession(s,words,content,'daily','2026-09-21');s.sessions[x.id]=x;s=ensureCarryover(s,x);assert.ok(x.ids.every(id=>s.progress[id].needsReview));assert.ok(Object.values(x.records).every(r=>r.en==='unmeasured'&&r.ko==='unmeasured'));});
test('grammar improvement does not change word familiarity',()=>{let s=fresh();const a=find('apple');s.progress[a.id]={familiarity:'known'};const x={...newSession(fresh(),[a],content,'daily','2026-09-21'),stage:'sentence'};s=applyRecord(s,x,a.id,{en:'independent',ko:'independent',sentence:'I eat apple.',sentenceStatus:'improve'},false);assert.equal(s.progress[a.id].familiarity,'known');assert.equal(s.progress[a.id].en,'independent');assert.equal(s.progress[a.id].needsReview,true);});
test('monthly does not overwrite an untested direction',()=>{let s=fresh();const a=find('apple');s.progress[a.id]={studyDates:['2026-09-21'],en:'independent',ko:'independent',sentenceStatus:'written'};const x=newSession(s,[a],content,'monthly','2026-09-30','2026-09');s=applyRecord(s,x,a.id,{ko:'independent',sentenceStatus:'written',sentence:'I ate an apple.'},false);assert.equal(s.progress[a.id].en,'independent');s=ensureCarryover(s,s.sessions[x.id]);assert.equal(s.progress[a.id].needsReview,false);});
test('CSV escapes quotes and spreadsheet formula injection',()=>{const s=fresh();const x=newSession(s,words,content,'daily','2026-09-21');x.records[x.ids[0]].sentence='=1+1';s.sessions[x.id]=x;const csv=exportLog(s,words);assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.startsWith('\ufeff'));});
test('delayed retry preserves first help result and review priority',()=>{let s=fresh();let x=newSession(s,words,content,'daily','2026-09-21');const id=x.ids[0];x={...x,stage:'ko',retryMode:true,retry:[{id,direction:'ko'}],records:{...x.records,[id]:{...x.records[id],en:'independent',ko:'help',sentenceStatus:'written',hintKo:true}}};s=applyRecord(s,x,id,{ko:'independent'},true);assert.equal(s.sessions[x.id].records[id].ko,'help');assert.equal(s.sessions[x.id].records[id].retryKo,'independent');assert.equal(s.progress[id].needsReview,true);});
test('assignments carry forward without falsely counting as learned',()=>{let s=fresh();const x=newSession(s,words,content,'daily','2026-09-21');s.sessions[x.id]=x;s=ensureCarryover(s,x);assert.deepEqual(new Set(pickDaily(words,s,'2026-09-22')),new Set(x.ids));assert.deepEqual(reviewIds(s,'monthly','2026-09'),[]);});
test('all learning entries have complete content and valid source attribution',()=>{const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url)));for(const w of words){for(const field of ['meaning','expression','example','translation','source'])assert.ok(c[w.id]?.[field]?.trim(),w.headword+' '+field);if(c[w.id].source==='Tatoeba 참고 예문'){assert.match(c[w.id].url,/^https:\/\/tatoeba.org\/en\/sentences\/show\/\d+$/);assert.ok(c[w.id].attribution);}else assert.equal(c[w.id].attribution,undefined);}assert.equal(c[words.find(w=>w.headword==='bank (money)').id].meaning,'은행');assert.equal(c[words.find(w=>w.headword==='May').id].meaning,'5월');});

test('retry interrupts only after two distinct other words and returns to the correct cursor',()=>{
 let state=fresh();let x={...newSession(state,words,content,'daily','2026-09-21'),stage:'en'};const [a,b,c]=x.ids;
 state=applyRecord(state,x,a,{en:'help'});x=state.sessions[x.id];assert.equal(x.retryMode,false);assert.equal(x.ids[x.index],b);
 state=applyRecord(state,x,b,{en:'independent'});x=state.sessions[x.id];assert.equal(x.retryMode,false);
 state=applyRecord(state,x,c,{en:'independent'});x=state.sessions[x.id];assert.equal(x.retryMode,true);assert.equal(x.retry[0].id,a);assert.deepEqual(x.retry[0].seen,[b,c]);
 state=applyRecord(state,x,a,{en:'independent'});x=state.sessions[x.id];assert.equal(x.stage,'ko');assert.equal(x.index,0);assert.equal(x.retryMode,false);assert.equal(x.records[a].en,'help');assert.equal(x.records[a].retryEn,'independent');
});
test('one and two word days defer rather than fabricate an immediate independent retry',()=>{
 for(const goal of [1,2]){let state=fresh();state.settings.dailyGoal=goal;let x=newSession(state,words,content,'daily','2026-09-21');
 while(!x.finished){const id=x.ids[x.index];const patch=x.stage==='learn'?{meaning:'뜻'}:x.stage==='sentence'?{sentenceStatus:'written',sentence:'My sentence.'}:{[x.stage]:'help'};state=applyRecord(state,x,id,patch);x=state.sessions[x.id];assert.equal(x.retryMode,false);}
 assert.equal(x.retry.length,goal*2);assert.ok(x.ids.every(id=>state.progress[id].needsReview));assert.deepEqual(new Set(pickDaily(words,state,'2026-09-22')),new Set(x.ids));}
});
test('same-word exposure resets the interval for its other pending direction',()=>{
 const state=fresh();let x=newSession(state,words,content,'daily','2026-09-21');const [a,b,c]=x.ids;
 x={...x,stage:'en',retryMode:true,retry:[{id:a,direction:'en',seen:[b,c]},{id:a,direction:'ko',seen:[b,c]}],resumeAfterRetry:{stage:'sentence',index:0}};
 x=stepSession(x);assert.equal(x.retryMode,false);assert.equal(x.stage,'sentence');assert.deepEqual(x.retry[0].seen,[]);
});
test('monthly review completes real batches and keeps all untouched words unmeasured',()=>{
 let state=fresh();const items=words.slice(0,21);state.progress=Object.fromEntries(items.map(w=>[w.id,{studyDates:['2026-09-21'],en:'independent',ko:'independent',sentenceStatus:'written'}]));
 let x=newSession(state,items,content,'monthly','2026-09-30');const order=[...x.ids];
 for(let i=0;i<15;i++){state=applyRecord(state,x,x.ids[x.index],{ko:'independent'});x=state.sessions[x.id];}assert.equal(x.stage,'sentence');assert.equal(x.index,0);
 for(let i=0;i<15;i++){state=applyRecord(state,x,x.ids[x.index],{sentenceStatus:'unmeasured'});x=state.sessions[x.id];}
 assert.equal(x.stage,'checkpoint');assert.equal(x.index,15);assert.equal(x.finished,false);assert.equal(x.paused,true);assert.equal(Object.values(x.records).filter(r=>r.ko==='unmeasured').length,6);
 x=continueBatch(JSON.parse(JSON.stringify(x)));assert.deepEqual(x.ids,order);assert.equal(x.stage,'ko');assert.equal(x.index,15);assert.equal(x.batchStart,15);
 for(let i=0;i<6;i++){state=applyRecord(state,x,x.ids[x.index],{ko:'independent'});x=state.sessions[x.id];}
 for(let i=0;i<6;i++){state=applyRecord(state,x,x.ids[x.index],{sentenceStatus:'unmeasured'});x=state.sessions[x.id];}
 assert.equal(x.finished,true);assert.ok(Object.values(x.records).every(r=>sessionRecordComplete(x,r)));assert.ok(Object.values(x.records).every(r=>r.en==='unmeasured'&&r.sentenceStatus==='unmeasured'));
});
test('unmeasured monthly writing is incomplete; optional sentence is not a false failure',()=>{
 const state=fresh();const a=find('apple');state.progress[a.id]={studyDates:['2026-09-21']};const x=newSession(state,words,content,'monthly','2026-09-30');
 assert.equal(sessionRecordComplete(x,x.records[a.id]),false);const r={...x.records[a.id],ko:'independent'};assert.equal(sessionRecordComplete(x,r),true);assert.equal(nextAction(r,x),'이후에도 복습');assert.equal(sessionRecordComplete(x,{...r,sentenceStatus:'improve'}),false);
});
test('warmup prioritizes unfinished words even when assigned in today targets',()=>{
 const state=fresh();const [a,b,c,d]=words.filter(w=>w.level==='A1').slice(0,4);state.progress=Object.fromEntries([a,b,c,d].map((w,i)=>[w.id,{lastStudied:'2026-09-'+(10+i),needsReview:i===0}]));const x=newSession(state,words,content,'daily','2026-09-21');assert.equal(x.warmupIds[0],a.id);assert.ok(x.ids.includes(a.id));
});
test('paused new words and unfinished monthly reviews do not add fresh words',()=>{
 const state=fresh();state.settings.newWordsPaused=true;assert.deepEqual(pickDaily(words,state,'2026-09-21'),[]);const a=find('apple');state.progress[a.id]={needsReview:true,studyDates:['2026-09-21']};assert.deepEqual(pickDaily(words,state,'2026-09-21'),[a.id]);state.settings.newWordsPaused=false;const x=newSession(state,words,content,'monthly','2026-09-30');state.sessions[x.id]=x;assert.deepEqual(pickDaily(words,state,'2026-09-22'),[a.id]);
});
test('personal useful priority does not override carryover or familiarity',()=>{
 const state=fresh();const a=find('apple'),b=find('cat'),c=find('water');state.progress[a.id]={familiarity:'uncertain',useful:true};state.progress[b.id]={needsReview:true};state.progress[c.id]={familiarity:'new',useful:true};assert.deepEqual(pickDaily(words,state,'2026-09-21'),[b.id,a.id,c.id]);
});
test('known and focused practice keeps familiarity and unrelated weaknesses',()=>{
 let state=fresh();const a=find('apple');state.progress[a.id]={familiarity:'known',en:'help',ko:'help',sentenceStatus:'improve',needsReview:true};assert.deepEqual(practiceIds(state,'known'),[a.id]);
 let x=newSession(state,words,content,'practice','2026-09-21',undefined,'ko');state=applyRecord(state,x,a.id,{ko:'independent'});assert.equal(state.progress[a.id].en,'help');assert.equal(state.progress[a.id].needsReview,true);assert.equal(state.progress[a.id].familiarity,'known');assert.equal(state.progress[a.id].studyDates,undefined);
 x=newSession(state,words,content,'practice','2026-09-21',undefined,'sentence');state=applyRecord(state,x,a.id,{sentence:'An apple.',sentenceStatus:'written'});assert.equal(state.progress[a.id].en,'help');assert.equal(state.progress[a.id].needsReview,true);
});
test('saving a draft never registers an unlearned word in the monthly population',()=>{
 let state=fresh();const x=newSession(state,words,content,'daily','2026-09-21');const id=x.ids[0];state=applyRecord(state,x,id,{meaning:'draft'},false);assert.deepEqual(reviewIds(state,'monthly','2026-09'),[]);state=applyRecord(state,x,id,{meaning:'confirmed'},true);assert.deepEqual(reviewIds(state,'monthly','2026-09'),[id]);
});
test('legacy sessions without batch or interval fields continue without losing records',()=>{
 const state=fresh();const a=find('apple');state.progress[a.id]={studyDates:['2026-09-21']};let x=newSession(state,words,content,'monthly','2026-09-30');delete x.batchSize;delete x.batchStart;x=stepSession(x);assert.equal(x.stage,'sentence');x=stepSession(x);assert.equal(x.finished,true);assert.equal(x.records[a.id].ko,'unmeasured');
});
test('different parts of speech of one spelling are not two intervening words',()=>{
 const state=fresh();const a=find('apple'),noun=find('book'),verb=find('book','v.');let x=newSession(state,[a,noun,verb],content,'daily','2026-09-21');
 x={...x,kind:'weekly',ids:[a.id,noun.id,verb.id],wordKeys:{[a.id]:'apple',[noun.id]:'book',[verb.id]:'book'},stage:'en',index:1,retry:[{id:a.id,direction:'en',seen:[]}]};
 x=stepSession(x);assert.equal(x.retryMode,false);x=stepSession(x);assert.equal(x.retryMode,false);assert.equal(x.retry[0].seen.length,1);
});
