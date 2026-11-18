// Offline authored curriculum audit. No learner data, API, or live readiness grant.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build,version as esbuildVersion} from 'esbuild';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {normalizedExposureSentenceV1,validateExposureInventoryV1} from './ai-quality-v147-exposure-v1.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const CURRICULUM_INPUTS_V1=Object.freeze(['lib/grammar/content.ts','lib/grammar/content-v2.ts','lib/grammar/content-v3.ts','lib/grammar/content-v4.ts','lib/grammar/wrong-choice-reasons.ts']);
const ENTRY=`import {GRAMMAR_LESSONS} from './lib/grammar/content';
import * as v2 from './lib/grammar/content-v2';
import * as v3 from './lib/grammar/content-v3';
import * as v4 from './lib/grammar/content-v4';
export const editions=[1,2,3,4].map(version=>({version,lessons:GRAMMAR_LESSONS.map(lesson=>structuredClone(version===1?lesson:v4.lessonForVersion(lesson,version))),practice:version===1?null:Object.fromEntries(GRAMMAR_LESSONS.map(lesson=>[lesson.id,structuredClone(v4.practiceForVersion(lesson.id,version))]))}));
export const frameSentence=v2.frameSentence;
export const reviewUnits=v4.grammarReviewUnits();
export const v3PracticeCount=Object.keys(v3.PRACTICE_LESSONS_V3).length;`;
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function loadCurriculumSnapshotV1(sourceRoot=SOURCE){
 const result=await build({absWorkingDir:sourceRoot,stdin:{contents:ENTRY,resolveDir:sourceRoot,sourcefile:'curriculum-exposure-entry.mjs',loader:'js'},bundle:true,write:false,format:'esm',platform:'node',target:'node22',metafile:true,logLevel:'silent'});
 const inputs=Object.keys(result.metafile.inputs).filter(f=>f!=='curriculum-exposure-entry.mjs').sort();assert.deepEqual(inputs,[...CURRICULUM_INPUTS_V1].sort(),'Curriculum import boundary changed;explicit audit required.');
 assert.ok(Object.values(result.metafile.outputs).every(o=>o.imports.length===0),'External runtime import requires explicit audit.');
 const bundle=result.outputFiles[0].text,mod=await import('data:text/javascript;base64,'+Buffer.from(bundle).toString('base64'));
 return {editions:mod.editions,frameSentence:mod.frameSentence,reviewUnits:mod.reviewUnits,bundle,metafile:result.metafile,esbuildVersion,bundleSha256:sha(bundle),virtualEntrySha256:sha(ENTRY),sourceBindings:Object.fromEntries(inputs.map(f=>[f,sha(readFileSync(resolve(sourceRoot,f)))]))};
}
export function collectCurriculumExposureV1(snapshot){
 const records=[],emptyContexts=[],frameCounts={};
 function add(edition,lessonId,projection,locator,sentence,extra={}){
  assert.equal(typeof sentence,'string');assert.ok(sentence.length>0&&sentence.length<=2000&&sentence.isWellFormed());
  const origin={edition,lessonId,projection,locator,...extra};records.push({id:'curriculum-'+digest(origin).slice(0,24),origin,input:{sentence}});
 }
 function questions(edition,lessonId,projection,qs){
  assert.ok(Array.isArray(qs));qs.forEach((q,i)=>{
   assert.ok(['choice','order'].includes(q.kind));assert.equal(typeof q.context,'string');
   if(q.context)add(edition,lessonId,projection,`[${i}].context`,q.context,{questionKind:q.kind});else emptyContexts.push({edition,lessonId,projection,locator:`[${i}].context`,questionKind:q.kind});
   if(q.kind==='order'){
    add(edition,lessonId,projection,`[${i}].answer`,q.answer,{questionKind:q.kind,material:'public-order-solution-not-evaluation-grade'});
    assert.ok(q.alternatives===undefined||Array.isArray(q.alternatives));(q.alternatives??[]).forEach((text,j)=>add(edition,lessonId,projection,`[${i}].alternatives[${j}]`,text,{questionKind:q.kind,material:'public-order-alternative-not-evaluation-grade'}));
   }
  });
 }
 assert.deepEqual(snapshot.editions.map(e=>e.version),[1,2,3,4]);
 for(const edition of snapshot.editions){
  assert.equal(edition.lessons.length,15);assert.equal(new Set(edition.lessons.map(l=>l.id)).size,15);
  for(const lesson of edition.lessons){
   const {version}=edition;assert.equal(lesson.examples.length,2);
   lesson.examples.forEach((tuple,i)=>{assert.equal(tuple.length,3);add(version,lesson.id,'lesson',`examples[${i}][0]`,tuple[0]);});
   add(version,lesson.id,'lesson','stem',lesson.stem);questions(version,lesson.id,'lesson.questions',lesson.questions);questions(version,lesson.id,'lesson.review',lesson.review);
   if(version===1){assert.equal(edition.practice,null);continue;}
   const p=edition.practice[lesson.id];assert.ok(p);assert.equal(p.reading.length,2);
   p.reading.forEach((line,i)=>add(version,lesson.id,'practice',`reading[${i}].en`,line.en));
   questions(version,lesson.id,'practice.observation',[p.observation]);questions(version,lesson.id,'practice.questions',p.questions);questions(version,lesson.id,'practice.reviews.a',p.reviews.a);questions(version,lesson.id,'practice.reviews.b',p.reviews.b);
   assert.ok(p.frame.parts.length>0&&p.frame.slots.length>0);let combinations=[[]];
   for(const slot of p.frame.slots){assert.ok(slot.options.length>0);combinations=combinations.flatMap(values=>slot.options.map(value=>[...values,value]));assert.ok(combinations.length<=1000,'Explicit audit required for expanded frame space.');}
   frameCounts[`${version}:${lesson.id}`]=combinations.length;
   combinations.forEach((values,i)=>add(version,lesson.id,'practice.frame',`combinations[${i}]`,snapshot.frameSentence(p.frame,values),{values}));
  }
 }
 assert.equal(new Set(records.map(r=>r.id)).size,records.length);
 const surfaceMap=new Map();for(const record of records){const key=normalizedExposureSentenceV1(record.input.sentence),item=surfaceMap.get(key)??{normalizedSha256:sha(key),representativeInput:record.input,recordIds:[]};item.recordIds.push(record.id);surfaceMap.set(key,item);}
 const basis={schemaVersion:1,kind:'authored-curriculum-exposure-audit-v1',scope:'Selected public sentence fields andallgenerated frame combinations forauthored editions1-4;not allEnglish substrings/choices/notes orwholeproject exposure.',sourceBindings:snapshot.sourceBindings,compiler:{esbuildVersion:snapshot.esbuildVersion,bundleSha256:snapshot.bundleSha256,virtualEntrySha256:snapshot.virtualEntrySha256},records,surfaces:[...surfaceMap.values()],emptyContexts,frameCounts,
  recordCount:records.length,uniqueSurfaces:surfaceMap.size,completeForSelectedFields:true,completeCurriculumExposure:false,completeProjectExposure:false,independentFamiliesCertified:false,actualEnglishQualityMeasured:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,
  remaining:['Inline English examples inbilingual descriptions/explanations/notes','Choice distractors,ordering fragments andotherpartial strings','Test programs,fixture generators andotherarchived evaluations','Structural-family relations andactual source context;not Englishtruth certification'],
  liveDispatchAuthorized:false,currentBoundedWireInventoryReplaced:false};
 return {...basis,hash:digest(basis)};
}
export function lookupCurriculumExposureV1(catalogue,input){
 const {hash,...basis}=catalogue;assert.equal(digest(basis),hash,'Curriculum catalogue hash changed');assert.equal(catalogue.kind,'authored-curriculum-exposure-audit-v1');assert.equal(typeof input.sentence,'string');assert.ok(input.sentence.length>0&&input.sentence.length<=2000&&input.sentence.isWellFormed());
 const key=normalizedExposureSentenceV1(input.sentence);return catalogue.records.filter(r=>normalizedExposureSentenceV1(r.input.sentence)===key);
}
export function curriculumCapacityProjectionV1(catalogue,current){
 const {hash,...catalogueBasis}=catalogue;assert.equal(digest(catalogueBasis),hash,'Curriculum catalogue hash changed');
 validateExposureInventoryV1(current);const existing=new Set(current.entries.map(e=>normalizedExposureSentenceV1(e.input.sentence))),seen=new Set(existing),unique=[],all=[];
 for(const r of catalogue.records){const key=normalizedExposureSentenceV1(r.input.sentence);const item={id:'exposure-'+digest({curriculum:r.id}).slice(0,24),domain:'grammar',targetKey:r.origin.lessonId,familyId:'family-'+digest({unreviewedCurriculum:r.id}).slice(0,24),familyBrief:'Public family relation unaudited.',input:{sentence:r.input.sentence,contextKind:'sentence',contextNote:''}};all.push(item);if(!seen.has(key)){seen.add(key);unique.push(item);}}
 function projection(items){const {hash,...old}=current;void hash;const basis={...old,entries:[...current.entries,...items],provenanceHash:digest({current:current.hash,curriculum:catalogue.hash,projection:'capacity-only-not-ready'})},full={...basis,hash:digest(basis)};let error=null;try{validateExposureInventoryV1(full);}catch(e){error=e.message;}return {entries:full.entries.length,bytes:Buffer.byteLength(JSON.stringify(full)),limitBytes:65536,accepted:error===null,error,removedToFit:0};}
 return {schemaVersion:1,curriculumHash:catalogue.hash,currentInventoryHash:current.hash,currentEntries:current.entries.length,currentUniqueSurfaces:existing.size,curriculumRecords:catalogue.records.length,curriculumUniqueSurfaces:catalogue.surfaces.length,newUniqueSurfaces:seen.size-existing.size,combinedUniqueSurfaces:seen.size,fullSourceRecords:projection(all),exactSurfaceDeduplicated:projection(unique),allStructuresUnaudited:true,currentLimitsChanged:false,corpusTrimmedToFit:false,liveReady:false,actualInputTokensMeasured:false,actualProviderCalls:0};
}
export async function buildCurriculumExposureV1(sourceRoot=SOURCE){return collectCurriculumExposureV1(await loadCurriculumSnapshotV1(sourceRoot));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const value=await buildCurriculumExposureV1(),file=resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/curriculum-exposure-audit-v1.json');
 if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),value);else if(!process.argv.includes('--preview'))writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const current=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/public-exposure-inventory-v2.json'),'utf8')).inventory;
 console.log(JSON.stringify({records:value.recordCount,uniqueSurfaces:value.uniqueSurfaces,capacity:curriculumCapacityProjectionV1(value,current),actualProviderCalls:0}));
}
