import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMPTY,emptyRecord,newSession,applyRecord,ensureCarryover,selectSense,senseProgress,learningMetrics,needsInitialAssessment,sessionRecordMeasured,reviewRemaining,reviewTargets,repeatDailySession,dailyReplaySources,practiceTargets,hasReviewWork} from '../lib/learning.ts';
const words=JSON.parse(readFileSync('data/words.json')),w=words.find(w=>w.word==='work'&&w.pos==='v.');
const date='2026-09-22',content={meaning:'일하다',expression:'work at home',example:'I work at home.',translation:'나는 집에서 일한다.',source:'학습용 작성 예문'};
const good={meaning:content.meaning,en:'independent',ko:'independent',sentenceStatus:'written',sentence:'A newer sentence.',notes:'New note.',needsReview:false,studyDates:[date],lastStudied:date};
const fresh=()=>structuredClone(EMPTY);
function session(kind='practice',mode='known'){
 const state=fresh();state.progress[w.id]={...good,familiarity:'known'};
 // Legacy monthly targets are intentionally supported.
 const s=kind==='practice'?newSession(state,words,()=>content,kind,date,undefined,mode):newSession({...state,progress:{}},[w],()=>content,'daily',date);
 if(kind!=='practice')s.kind=kind;
 state.sessions[s.id]=s;return {state,s,id:s.ids[0]};
}

test('opening and pausing optional known practice does not demote untested known words',()=>{
 const {state,s}=session();const before=structuredClone(state.progress);
 assert.deepEqual(ensureCarryover(state,s).progress,before);
 s.paused=true;assert.deepEqual(ensureCarryover(state,s).progress,before);
});
test('partial independent known practice does not erase previous mastery',()=>{
 let {state,s,id}=session();state=applyRecord(state,s,id,{en:'independent'},true,date);
 assert.equal(hasReviewWork(state.progress[w.id]),false);assert.equal(state.sessions[s.id].records[id].ko,'unmeasured');
});
test('saving an old draft does not replay old scores, sentences, notes or lesson material',()=>{
 let {state,s,id}=session();s.stage='sentence';s.records[id]={...s.records[id],en:'help',ko:'help',sentenceStatus:'improve',sentence:'Old.',notes:'Old note',material:{...content,example:'Old example.'}};
 state.progress[w.id]={...state.progress[w.id],example:'New library example.'};
 state=applyRecord(state,s,id,{sentence:'Draft only',notes:'Draft note'},false,date);
 assert.equal(state.progress[w.id].en,'independent');assert.equal(state.progress[w.id].ko,'independent');assert.equal(state.progress[w.id].sentence,'A newer sentence.');assert.equal(state.progress[w.id].notes,'New note.');assert.equal(state.progress[w.id].example,'New library example.');assert.equal(hasReviewWork(state.progress[w.id]),false);
 assert.equal(state.sessions[s.id].records[id].sentence,'Draft only');
});
test('a new sentence result never replays obsolete recall scores from that session',()=>{
 let {state,s,id}=session();s.stage='sentence';s.records[id]={...s.records[id],en:'help',ko:'help'};
 state=applyRecord(state,s,id,{sentenceStatus:'written',sentence:'New final.',notes:''},true,date);
 assert.equal(state.progress[w.id].en,'independent');assert.equal(state.progress[w.id].ko,'independent');assert.equal(state.progress[w.id].notes,'');assert.equal(state.sessions[s.id].records[id].en,'help');assert.equal(hasReviewWork(state.progress[w.id]),false);
});
test('new difficulties still reopen the correct sense without changing familiarity',()=>{
 let {state,s,id}=session();state=applyRecord(state,s,id,{ko:'help'},true,date);
 assert.equal(state.progress[w.id].ko,'help');assert.equal(hasReviewWork(state.progress[w.id]),true);assert.equal(state.progress[w.id].familiarity,'known');
});
test('finishing an old fully measured review cannot reintroduce a corrected weakness',()=>{
 const {state,s,id}=session('weekly');s.finished=true;s.records[id]={...s.records[id],en:'help',ko:'independent',sentenceStatus:'written'};
 assert.equal(hasReviewWork(ensureCarryover(state,s).progress[w.id]),false);
});
test('unmeasured required review work remains pending and cannot silently pass',()=>{
 const {state,s,id}=session('weekly');s.finished=true;
 const next=ensureCarryover(state,s);assert.equal(hasReviewWork(next.progress[w.id]),true);assert.equal(s.records[id].en,'unmeasured');
});
test('weekly count includes sentence measurement while monthly sentence stays optional',()=>{
 const {s,id}=session('weekly');s.records[id]={...s.records[id],en:'independent',ko:'help'};
 assert.equal(sessionRecordMeasured(s,s.records[id]),false);assert.equal(reviewRemaining(s),1);
 s.records[id].sentenceStatus='improve';assert.equal(sessionRecordMeasured(s,s.records[id]),true);assert.equal(reviewRemaining(s),0);
 s.kind='monthly';s.records[id].sentenceStatus='unmeasured';assert.equal(sessionRecordMeasured(s,s.records[id]),true);
});
test('statistics cover every sense once and are invariant when the selected sense changes',()=>{
 const state=fresh();state.progress[w.id]=selectSense(good,{meaning:'작동하다',en:'help',ko:'unmeasured'});
 const before=learningMetrics(state);assert.equal(before.measured,3);assert.equal(before.successes,2);
 state.progress[w.id]=selectSense(state.progress[w.id],senseProgress(state.progress[w.id],'일하다'));
 assert.deepEqual(learningMetrics(state),before);
});
test('personal learned words are separate from the official catalogue denominator',()=>{
 const state=fresh();state.progress[w.id]=good;state.progress.personal={...good,personal:{...w,personal:true}};
 assert.equal(learningMetrics(state).officialLearned,1);assert.equal(learningMetrics(state).personalLearned,1);assert.equal(learningMetrics(state).learned,2);
});
test('initial assessment is required only for a new learner, never blocks returning carryover',()=>{
 const state=fresh();assert.equal(needsInitialAssessment(state),true);
 state.progress[w.id]={needsReview:true};assert.equal(needsInitialAssessment(state),false);
 state.progress[w.id]={...good};state.settings.assessments.A1={ids:[w.id],index:0,marks:{},completed:false};assert.equal(needsInitialAssessment(state),false);
});
test('monthly population includes a legacy second sense even when a daily record represents the first',()=>{
 const {state,s,id}=session('daily');s.records[id]={...s.records[id],learnedOn:date};
 state.progress[w.id]=selectSense(good,{...good,meaning:'작동하다'});
 const targets=reviewTargets(state,'monthly',date.slice(0,7));assert.deepEqual(new Set(targets.map(t=>t.meaning)),new Set(['일하다','작동하다']));
});
test('date correction cannot strand a repeat snapshot or its next repetition',()=>{
 const {state,s,id}=session('daily');s.finished=true;s.stage='done';s.records[id]={...s.records[id],...good};
 const repeat=repeatDailySession(state,[w],date,date);repeat.finished=true;repeat.stage='done';state.sessions[repeat.id]=repeat;
 s.date='2026-09-21';s.period=s.date;
 assert.equal(dailyReplaySources(state,date)[0].id,repeat.id);const next=repeatDailySession(state,[w],date,'2026-09-23');assert.ok(next);assert.equal(next.records[id].meaning,repeat.records[id].meaning);
 repeat.finished=false;repeat.stage='ko';assert.equal(repeatDailySession(state,[w],date,'2026-09-23').id,repeat.id);
});
test('optional monthly sentence skip preserves the last measured sentence and its note',()=>{
 let {state,s,id}=session('monthly');s.stage='sentence';s.records[id].ko='independent';
 state=applyRecord(state,s,id,{sentenceStatus:'unmeasured',sentence:'',notes:''},true,date);
 assert.equal(state.progress[w.id].sentence,'A newer sentence.');assert.equal(state.progress[w.id].notes,'New note.');
});

test('focused practice badge and assigned session both count senses, not only spellings',()=>{
 const state=fresh();state.progress[w.id]=selectSense({...good,familiarity:'known'},{...good,meaning:'작동하다'});
 assert.equal(practiceTargets(state,'known',()=>content).length,2);assert.equal(newSession(state,words,()=>content,'practice',date,undefined,'known').ids.length,2);
});
