import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMPTY,newSession,applyRecord,reviewTargets,selectSense,senseProgress,pickDaily,entryIdFor,ensureCarryover,hasReviewWork,pendingReviews,reviewRemaining,exportLog} from '../lib/learning.ts';
const words=JSON.parse(readFileSync('data/words.json','utf8'));
const work=words.find(w=>w.word==='work'&&w.pos==='v.');
const material={meaning:'일하다',expression:'work at home',example:'I work at home.',translation:'나는 집에서 일한다.',source:'학습용 작성 예문'};
const fresh=()=>structuredClone(EMPTY);
function learn(state,date,meaning='일하다'){
 const content={...material,meaning};let s=newSession(state,[work],()=>content,'daily',date);s={...s,stage:'learn'};
 return applyRecord(state,s,work.id,{meaning,material:content},true,date);
}
test('cross-month resumption uses actual learning date and keeps the original assignment date',()=>{
 let state=fresh();const s=newSession(state,[work],()=>material,'daily','2026-08-31');
 state=applyRecord(state,s,work.id,{material},true,'2026-09-21');const r=state.sessions[s.id].records[work.id];
 assert.equal(state.sessions[s.id].date,'2026-08-31');assert.equal(r.learnedOn,'2026-09-21');assert.deepEqual(state.progress[work.id].studyDates,['2026-09-21']);
 assert.equal(reviewTargets(state,'monthly','2026-08').length,0);assert.equal(reviewTargets(state,'monthly','2026-09').length,1);
 assert.equal(reviewTargets(state,'weekly','2026-08-31').length,1);assert.equal(reviewTargets(state,'weekly','2026-09-21').length,1);
 assert.match(exportLog(state,words),/실제 학습일/);
});
test('editing the selected sense cannot alter a past monthly cue or material',()=>{
 let state=learn(fresh(),'2026-08-31');state.progress[work.id]=selectSense(state.progress[work.id],{meaning:'작동하다',needsReview:true});
 const s=newSession(state,words,()=>material,'monthly','2026-09-21','2026-08');assert.equal(s.records[work.id].meaning,'일하다');assert.deepEqual(s.records[work.id].material,material);
 state=applyRecord(state,s,work.id,{ko:'help'},true,'2026-09-21');assert.equal(state.progress[work.id].meaning,'작동하다');assert.equal(state.progress[work.id].ko,'unmeasured');assert.equal(senseProgress(state.progress[work.id],'일하다').ko,'help');
});
test('two senses learned in one month are independent review targets and survive serialization',()=>{
 let state=learn(fresh(),'2026-09-01');state.progress[work.id]=selectSense(state.progress[work.id],{meaning:'작동하다',needsReview:true});
 // Clear old carryover so the newly selected sense is the daily target.
 state.progress[work.id].senses['일하다'].needsReview=false;
 state=learn(state,'2026-09-02','작동하다');state=JSON.parse(JSON.stringify(state));
 const s=newSession(state,words,()=>material,'monthly','2026-09-30');assert.equal(s.ids.length,2);assert.ok(s.ids.every(id=>entryIdFor(s,id)===work.id));assert.deepEqual(new Set(Object.values(s.records).map(r=>r.meaning)),new Set(['일하다','작동하다']));
 assert.equal(s.wordKeys[s.ids[0]],s.wordKeys[s.ids[1]]);
});
test('new senses start unmeasured while switching back restores their own scores and dates',()=>{
 const old={meaning:'일하다',en:'independent',ko:'help',sentenceStatus:'written',sentence:'I work.',studyDates:['2026-08-31'],lastStudied:'2026-08-31'};
 let p=selectSense(old,{meaning:'작동하다'});assert.equal(p.en,'unmeasured');assert.equal(p.sentence,'');assert.equal(senseProgress(p,'작동하다').lastStudied,undefined);assert.equal(senseProgress(p,'작동하다').studyDates,undefined);
 p=selectSense(p,senseProgress(p,'일하다'));assert.equal(p.en,'independent');assert.equal(p.ko,'help');assert.equal(p.sentence,'I work.');assert.deepEqual(senseProgress(p,'일하다').studyDates,['2026-08-31']);
});
test('unlearned new target of a previously learned word is absent from monthly review',()=>{
 let state=learn(fresh(),'2026-09-21');state.progress[work.id]=selectSense(state.progress[work.id],{meaning:'작동하다',needsReview:true});state.progress[work.id].senses['일하다'].needsReview=false;
 // A second same-day assignment is allowed here only to test population construction.
 const s={...newSession(fresh(),[work],()=>({...material,meaning:'작동하다'}),'daily','2026-09-21')};state.sessions[s.id]=s;
 assert.deepEqual(reviewTargets(state,'monthly','2026-09').map(t=>t.meaning),['일하다']);
});
test('legacy dates remain usable and missing historical senses are clearly flagged',()=>{
 const state=fresh();state.progress[work.id]={meaning:'현재 뜻',studyDates:['2026-08-31']};
 assert.equal(reviewTargets(state,'monthly','2026-08')[0].historicalMeaningUnknown,true);
});
test('old pending reviews remain discoverable and unmeasured words are counted',()=>{
 let state=learn(fresh(),'2026-08-31');const s=newSession(state,words,()=>material,'monthly','2026-09-01','2026-08');state.sessions[s.id]={...s,paused:true};
 assert.equal(pendingReviews(state)[0].period,'2026-08');assert.equal(reviewRemaining(s),1);
 state=applyRecord(state,s,work.id,{ko:'help'},true,'2026-09-21');assert.equal(reviewRemaining(state.sessions[s.id]),0);state=ensureCarryover(state,state.sessions[s.id]);assert.equal(hasReviewWork(state.progress[work.id]),true);
});
test('personal words are daily candidates at every level without outranking carryover',()=>{
 const personal={id:'personal_'+crypto.randomUUID(),word:'commute',headword:'commute',pos:'n.',level:'A1',personal:true,page:0};
 for(const level of ['A1','A2','B1','B2']){const state=fresh();state.settings.level=level;state.progress[personal.id]={personal,meaning:'통근',familiarity:'new'};state.progress[work.id]={needsReview:true};assert.deepEqual(pickDaily([work,personal],state,'2026-09-21'),[work.id,personal.id]);}
});

test('choosing one precise daily sense releases the unlearned reference gloss',()=>{
 let state=fresh();const s=newSession(state,[work],()=>material,'daily','2026-09-21');state=ensureCarryover(state,s);
 state=applyRecord(state,s,work.id,{meaning:'직장에서 일하다'},true,'2026-09-21');assert.equal(state.progress[work.id].meaning,'직장에서 일하다');assert.equal(senseProgress(state.progress[work.id],'일하다').needsReview,false);assert.equal(senseProgress(state.progress[work.id],'직장에서 일하다').needsReview,true);
});
