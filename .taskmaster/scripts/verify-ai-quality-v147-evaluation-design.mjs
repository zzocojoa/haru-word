import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const manifest=await read(resolve(HERE,'.taskmaster/docs/ai-quality-v147-manifest.json'));
const SOURCE=manifest.baseline.sourceRoot,ROOT=manifest.baseline.existingDashboardRoot;
const path=manifest.evaluationPreparationFile,d=await read(resolve(SOURCE,path));

function validate(value){
 assert.equal(value.planId,manifest.planId);assert.equal(value.pilotOnly,true);assert.equal(value.releaseEligible,false);assert.equal(value.paidApprovalUsd,0);assert.equal(value.newPaidCalls,0);assert.equal(value.freshCaseTextsAuthored,0);assert.equal(value.candidateFrozenForFreshAuthoring,false);
 assert.equal(value.slots.length,60);assert.equal(new Set(value.slots.map(s=>s.id)).size,60);assert.equal(value.lessonIds.length,15);assert.equal(new Set(value.lessonIds).size,15);
 const totals={normal:0,needsCorrection:0,insufficientContext:0};
 for(const domain of ['word','grammar']){
  const slots=value.slots.filter(s=>s.domain===domain);assert.equal(slots.length,30);
  for(const key of Object.keys(totals)){const count=slots.filter(s=>s.grammarStratum===key).length;assert.equal(count,value.crossTable[domain][key]);totals[key]+=count;}
 }
 assert.deepEqual(totals,{normal:20,needsCorrection:25,insufficientContext:15});
 for(const lesson of value.lessonIds)assert.equal(value.slots.filter(s=>s.lessonId===lesson&&s.domain==='grammar').length,2,lesson);
 for(const slot of value.slots){assert.equal(slot.status,'reserved-not-authored');assert.deepEqual(Object.keys(slot).sort(),(slot.domain==='word'?['id','domain','grammarStratum','status']:['id','domain','grammarStratum','status','lessonId']).sort());}
 assert.equal(value.historyCoverage.length,30);assert.deepEqual(value.historyCoverage.map(h=>h.historyId),Array.from({length:30},(_,i)=>'H'+String(i+1).padStart(2,'0')));
 for(const h of value.historyCoverage){assert.ok(['english-corpus-and-contract-controls','local-harness-methodology-or-operational-gate'].includes(h.validationChannel));assert.ok(h.taskIds.length>0);for(const id of h.taskIds)assert.ok(manifest.tasks.some(t=>Number(t.id)===Number(id)));}
 assert.equal(value.duplicateReview.completedFreshReviews,0);for(const key of ['development','calibration','pilot','confirmatory'])assert.ok(value.corpusSeparation[key].length>20);
 assert.equal(value.independence.currentLevel,'same-author design only; no independent reviewer');assert.ok(value.duplicateReview.requiredManual.length>=3);assert.ok(value.changeControl.length>=4);
}
validate(d);console.log('PASS sixty reserved slots:30/30,20/25/15 and actual15 lessons each2; no new case text or release/paid claim');
assert.equal(await sha(resolve(SOURCE,path)),await sha(resolve(ROOT,path)));
for(const row of d.developerExposureInventory)assert.equal(await sha(resolve(SOURCE,row.path)),row.sha256,row.path);
const curriculum=await readFile(resolve(SOURCE,'lib/grammar/content.ts'),'utf8');assert.deepEqual([...curriculum.matchAll(/\bid: '([^']+)'/g)].slice(0,15).map(m=>m[1]),d.lessonIds);
console.log('PASS source/root preparation and exposed-source fingerprints agree; history30 linked to actual tasks');
for(const [name,mutate]of [['wrong marginal',v=>{v.crossTable.word.normal--;}],['lesson lost',v=>{v.slots.find(s=>s.domain==='grammar').lessonId='missing';}],['premature text',v=>{v.slots[0].sentence='Synthetic premature input.';}],['paid claim',v=>{v.paidApprovalUsd=5;}]]){
 const changed=structuredClone(d);mutate(changed);assert.throws(()=>validate(changed),undefined,name);
}
console.log('PASS negative controls reject broken allocation,missing lesson,premature input and unapproved budget');
console.log(JSON.stringify({passed:true,groups:3,negativeControls:4,slots:60,freshTexts:0,paidCalls:0,independentReview:false,scope:'T12 design only; actual corpus/gold/judge/confirmatory/learner evidence remains required'}));
