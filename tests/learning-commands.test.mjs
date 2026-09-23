import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { EMPTY, newSession, ensureCarryover } from '../lib/learning.ts';
import { readFileSync } from 'node:fs';
await build({entryPoints:['lib/learning-commands.ts','lib/study-draft.ts'],outdir:'work/command-tests',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const { editedWordProgress, applyWarmupResult, pausedStudyState } = await import('../work/command-tests/learning-commands.mjs');
const { restoreStudyDraft } = await import('../work/command-tests/study-draft.mjs');
const words=JSON.parse(readFileSync('data/words.json'));
const content={meaning:'뜻',expression:'phrase',expressionTranslation:'표현',example:'An example.',translation:'예문',source:'test'};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze)}return value};
function fixture(){let state=structuredClone(EMPTY);const session=newSession(state,words,()=>content,'daily','2026-09-23');state=ensureCarryover({...state,sessions:{[session.id]:session}},session);return {state,session}}
test('word edits preserve existing grades and separate a new sense without mutating the source',()=>{
 const base=freeze({meaning:'뜻',en:'independent',ko:'help',sentenceStatus:'written',sentence:'Mine.',studyDates:['2026-09-22'],lastStudied:'2026-09-22'});
 const edit={...content,notes:'메모',newSense:false,familiarity:'known',familiarityTouched:false,useful:true,encounters:[]};
 const same=editedWordProgress(base,base,edit);assert.equal(same.ko,'help');assert.equal(same.sentence,'Mine.');
 const added=editedWordProgress(base,undefined,{...edit,meaning:'다른 뜻',newSense:true});
 assert.equal(added.ko,'unmeasured');assert.equal(added.senses['뜻'].ko,'help');assert.equal(added.senses['다른 뜻'].needsReview,true);
 assert.equal(base.meaning,'뜻');
});
test('hinted warmup remains help and does not overwrite learned grades',()=>{
 const {state,session}=fixture(),id=session.ids[0];state.progress[id]={meaning:'뜻',en:'independent',ko:'independent'};
 const s={...session,stage:'warmup',warmupIds:[id],warmupDraft:{id,answer:'draft',hinted:true,revealed:true}};
 state.sessions[s.id]=s;freeze(state);
 const next=applyWarmupResult(state,s,id,'independent',true);
 assert.equal(next.sessions[s.id].warmupResults[id],'help');assert.equal(next.sessions[s.id].warmupDraft,undefined);
 assert.equal(next.progress[id].needsReview,true);assert.equal(next.progress[id].ko,'independent');
 assert.equal(state.sessions[s.id].stage,'warmup');
});
test('pause preserves drafts and does not measure unanswered dimensions',()=>{
 for(const stage of ['learn','en','ko','sentence']){
  const {state,session}=fixture(),id=session.ids[0],s={...session,stage,elapsed:31};state.sessions[s.id]=s;
  const draft={...restoreStudyDraft(s,id,content),answer:'my draft',sentence:'My sentence.',notes:'my notes',spoken:true};freeze(state);
  const next=pausedStudyState(state,s,id,draft,content,'2026-09-23'),saved=next.sessions[s.id];
  assert.equal(saved.paused,true);assert.equal(saved.index,s.index);assert.equal(saved.elapsed,31);
  assert.equal(saved.records[id].en,'unmeasured');assert.equal(saved.records[id].sentenceStatus,'unmeasured');
  if(['en','ko'].includes(stage))assert.equal(saved.records[id].draft.answer,'my draft');
  if(stage==='sentence')assert.equal(saved.records[id].sentence,'My sentence.');
  assert.equal(state.sessions[s.id].paused,false);
 }
});
