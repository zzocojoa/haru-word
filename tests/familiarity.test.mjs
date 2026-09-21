import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMPTY,LEVELS,assessmentSample,assessmentAdvice,recordFamiliarity,pickDaily,practiceIds} from '../lib/learning.ts';
const words=JSON.parse(readFileSync(new URL('../data/words.json',import.meta.url)));
const find=(word,pos='n.')=>words.find(w=>w.word===word&&w.pos===pos);
const assessment=(level,known,unfamiliar)=>{const ids=assessmentSample(words,level);return {ids,index:20,completed:true,marks:Object.fromEntries(ids.map((id,i)=>[id,i<known?'known':i<known+unfamiliar?'new':'uncertain']))};};

test('20-word samples cover the selected level and never include personal additions',()=>{
 for(const level of LEVELS){const list=words.filter(w=>w.level===level);const sample=assessmentSample([...words,{id:'personal_test',headword:'custom',word:'custom',level,personal:true}],level);assert.equal(sample.length,20);assert.equal(new Set(sample.map(id=>words.find(w=>w.id===id).headword)).size,20);assert.ok(sample.every(id=>list.some(w=>w.id===id)));const indexes=sample.map(id=>list.findIndex(w=>w.id===id));assert.ok(indexes[0]<list.length*.05);assert.ok(indexes.at(-1)>list.length*.9);assert.deepEqual(sample,assessmentSample(words,level));}
});
test('14 of 20, not 13, offers adjacent-level exploration without changing settings',()=>{
 for(const level of LEVELS.slice(0,-1)){assert.equal(assessmentAdvice(assessment(level,14,0),level).suggested,LEVELS[LEVELS.indexOf(level)+1]);assert.equal(assessmentAdvice(assessment(level,13,0),level).suggested,level);}
 for(const level of LEVELS.slice(1)){assert.equal(assessmentAdvice(assessment(level,0,14),level).suggested,LEVELS[LEVELS.indexOf(level)-1]);assert.equal(assessmentAdvice(assessment(level,0,13),level).suggested,level);}
 assert.equal(EMPTY.settings.level,'A1');
});
test('A1 difficulty offers a smaller goal and B2 known words do not claim mixed familiarity',()=>{
 assert.equal(assessmentAdvice(assessment('A1',0,20),'A1').goal,2);assert.equal(assessmentAdvice(assessment('A1',0,20),'A1').suggested,'A1');
 const top=assessmentAdvice(assessment('B2',20,0),'B2');assert.equal(top.suggested,'B2');assert.match(top.text,/최고 수준/);assert.doesNotMatch(top.text,/섞여|C1/);
 const uncertain=assessmentAdvice(assessment('A1',0,0),'A1');assert.doesNotMatch(uncertain.text,/아는 단어와/);
});
test('new familiarity marks do not fabricate recall, sentence, or study results',()=>{
 for(const familiarity of ['known','uncertain','new']){assert.deepEqual(recordFamiliarity(undefined,familiarity),{familiarity});}
});
test('renewed uncertainty reopens learned words while preserving measured results',()=>{
 for(const mark of ['uncertain','new']){const before={familiarity:'known',lastStudied:'2026-09-20',studyDates:['2026-09-20'],en:'independent',ko:'independent',sentenceStatus:'written',sentence:'An apple.',notes:'saved note',needsReview:false};const after=recordFamiliarity(before,mark);assert.deepEqual(after,{...before,familiarity:mark,needsReview:true});assert.equal(before.needsReview,false);const state=structuredClone(EMPTY);const word=find('apple');state.progress[word.id]=after;assert.ok(pickDaily(words,state,'2026-09-21').includes(word.id));assert.equal(recordFamiliarity({...before,familiarity:mark},mark).needsReview,true);}
});
test('known marks never erase an unfinished recall or grammar task',()=>{
 const before={familiarity:'uncertain',lastStudied:'2026-09-20',en:'independent',ko:'help',sentenceStatus:'improve',needsReview:true};const after=recordFamiliarity(before,'known');assert.deepEqual(after,{...before,familiarity:'known'});
});
test('classification drives uncertain-before-new selection and known follow-up independently',()=>{
 const state=structuredClone(EMPTY);const a=find('apple'),b=find('book'),c=find('cat');state.progress[a.id]=recordFamiliarity(undefined,'known');state.progress[b.id]=recordFamiliarity(undefined,'new');state.progress[c.id]=recordFamiliarity(undefined,'uncertain');const picked=pickDaily(words,state,'2026-09-21');assert.deepEqual(picked.slice(0,2),[c.id,b.id]);assert.ok(!picked.includes(a.id));assert.deepEqual(practiceIds(state,'known'),[a.id]);assert.equal(state.progress[find('book','v.').id],undefined);
});
