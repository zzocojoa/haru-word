import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {CURRICULUM_INPUTS_V1,loadCurriculumSnapshotV1,collectCurriculumExposureV1,lookupCurriculumExposureV1,curriculumCapacityProjectionV1} from './build-ai-quality-v147-curriculum-exposure-v1.mjs';
import {normalizedExposureSentenceV1,exposureMatchesV1} from './ai-quality-v147-exposure-v1.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),OUT=resolve(process.env.QA_OUTPUT_DIR),sha=x=>createHash('sha256').update(x).digest('hex'),read=f=>JSON.parse(readFileSync(f,'utf8')),rows=[];
mkdirSync(OUT,{recursive:false});const dataFile=resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/curriculum-exposure-audit-v1.json'),oldFile=resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/public-exposure-inventory-v2.json'),data=read(dataFile),old=read(oldFile),oldSha=sha(readFileSync(oldFile)),snapshot=await loadCurriculumSnapshotV1();
const save=(name,value)=>{writeFileSync(resolve(OUT,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});rows.push(name);};
test('actualcompilerloads onlyfiveauthored modules anddeterministicallyextracts4editions/1265records/255surfaces',()=>{
 assert.deepEqual(collectCurriculumExposureV1(snapshot),data);assert.equal(data.recordCount,1265);assert.equal(data.uniqueSurfaces,255);assert.deepEqual(Object.keys(data.sourceBindings),[...CURRICULUM_INPUTS_V1].sort());
 for(const [f,h]of Object.entries(data.sourceBindings))assert.equal(sha(readFileSync(resolve(SOURCE,f))),h);
 const c=spawnSync(process.execPath,[resolve(SOURCE,'.taskmaster/scripts/build-ai-quality-v147-curriculum-exposure-v1.mjs'),'--check'],{encoding:'utf8',windowsHide:true});assert.equal(c.status,0,c.stdout+c.stderr);
 writeFileSync(resolve(OUT,'compiled-curriculum.mjs'),snapshot.bundle,{flag:'wx'});writeFileSync(resolve(OUT,'compiler-metafile.json'),JSON.stringify(snapshot.metafile,null,2)+'\n',{flag:'wx'});assert.equal(sha(snapshot.bundle),data.compiler.bundleSha256);
 save('counts-and-source-binding',{records:1265,surfaces:255,sourceFiles:5,editions:4,editionRecordCounts:[1,2,3,4].map(v=>data.records.filter(r=>r.origin.edition===v).length),bundleSha256:data.compiler.bundleSha256,check:{status:c.status,stdout:c.stdout}});
});
test('everyrecord resolvesbacktotheactualexported field orindependently enumerated frame;allorigins retained',()=>{
 let fields=0,frames=0;const frozen=JSON.stringify(snapshot.editions);
 for(const row of data.records){const o=row.origin,e=snapshot.editions.find(x=>x.version===o.edition),lesson=e.lessons.find(l=>l.id===o.lessonId),p=e.practice?.[o.lessonId];let expected;
  if(o.projection==='lesson'){const m=/^examples\[(\d+)\]\[0\]$/.exec(o.locator);expected=m?lesson.examples[Number(m[1])][0]:lesson.stem;fields++;}
  else if(o.projection==='practice'){const m=/^reading\[(\d+)\]\.en$/.exec(o.locator);assert.ok(m);expected=p.reading[Number(m[1])].en;fields++;}
  else if(o.projection==='practice.frame'){expected=snapshot.frameSentence(p.frame,o.values);const slotIndexes=o.values.map((value,i)=>p.frame.slots[i].options.indexOf(value));assert.ok(slotIndexes.every(i=>i>=0));const index=slotIndexes.reduce((index,value,i)=>index*p.frame.slots[i].options.length+value,0);assert.equal(o.locator,`combinations[${index}]`);frames++;}
  else{let qs;if(o.projection==='lesson.questions')qs=lesson.questions;else if(o.projection==='lesson.review')qs=lesson.review;else if(o.projection==='practice.observation')qs=[p.observation];else if(o.projection==='practice.questions')qs=p.questions;else if(o.projection==='practice.reviews.a')qs=p.reviews.a;else{assert.equal(o.projection,'practice.reviews.b');qs=p.reviews.b;}const m=/^\[(\d+)\]\.(context|answer|alternatives)(?:\[(\d+)\])?$/.exec(o.locator);assert.ok(m);const q=qs[Number(m[1])];expected=m[2]==='alternatives'?q.alternatives[Number(m[3])]:q[m[2]];assert.ok(m[2]==='context'||q.kind==='order');fields++;}
  assert.equal(row.input.sentence,expected);assert.deepEqual(Object.keys(row.input),['sentence']);
 }
 assert.equal(fields+frames,1265);assert.equal(frames,183);assert.equal(data.emptyContexts.length,300);assert.equal(JSON.stringify(snapshot.editions),frozen);
 const represented=data.surfaces.flatMap(s=>s.recordIds);assert.equal(represented.length,1265);assert.equal(new Set(represented).size,1265);assert.equal(new Set(data.records.map(r=>r.id)).size,1265);
 save('record-provenance',{all1265RecordsMatched:true,ordinaryFields:fields,generatedFrames:frames,emptyContextsRecorded:300,allSourceRecordIdsRetained:true,snapshotsUnchanged:true});
});
test('currentreviewunitexportcovers everyrenderedexample/reading/frame inlatestcurriculum;legacyversions preserved',()=>{
 let checked=0;for(const unit of snapshot.reviewUnits){let text;if(/:4:(example|frame):/.test(unit.id))text=unit.content.sentence;else if(/:4:reading:/.test(unit.id))text=unit.content.en;else continue;const matches=lookupCurriculumExposureV1(data,{sentence:text});assert.ok(matches.some(r=>r.origin.edition===4),unit.id);checked++;}
 const frameCounts=data.frameCounts;assert.deepEqual([2,3,4].map(v=>frameCounts[v+':indefinite-article']),[6,6,3]);
 const pronoun=version=>data.records.find(r=>r.origin.edition===version&&r.origin.lessonId==='pronoun'&&r.origin.projection==='practice'&&r.origin.locator==='reading[1].en').input.sentence;
 assert.equal(pronoun(2),pronoun(3));assert.notEqual(pronoun(3),pronoun(4));assert.ok(pronoun(3).includes('with the bags'));assert.ok(pronoun(4).includes('carry the bags'));
 const oldArticle=data.records.filter(r=>r.origin.edition===2&&r.origin.lessonId==='indefinite-article'&&r.origin.projection==='practice.frame');assert.ok(oldArticle.some(r=>r.input.sentence.includes('a umbrella')));assert.ok(oldArticle.some(r=>r.input.sentence.includes('an bag')));
 save('actual-review-unit-and-version-contrast',{currentRenderedUnitsChecked:checked,articleFramesEachEdition:[6,6,3],oldAndNewPronounReadingsBothRetained:true,historicIncorrectFramesPreservedAsExposureNotEnglishTruth:true});
});
test('newcurriculuminputs missedbycurrentboundedinventory arefoundbyofflinelookup;normalizationandtamperguards hold',()=>{
 const existing=new Set(old.inventory.entries.map(e=>normalizedExposureSentenceV1(e.input.sentence))),newSurfaces=data.surfaces.filter(s=>!existing.has(normalizedExposureSentenceV1(s.representativeInput.sentence)));assert.equal(newSurfaces.length,253);
 let missed=0;for(const surface of newSurfaces){const input=surface.representativeInput;assert.equal(exposureMatchesV1({input},{familyId:'family-000000000000000000000000'},old.inventory).length,0);assert.ok(lookupCurriculumExposureV1(data,input).length>0);missed++;}
 const first=newSurfaces[0].representativeInput.sentence;assert.ok(lookupCurriculumExposureV1(data,{sentence:'  '+first.toUpperCase().replaceAll(' ','   ')+'  '}).length>0);assert.deepEqual(lookupCurriculumExposureV1(data,{sentence:'This synthetic sentinel has never belonged to the selected curriculum 93671.'}),[]);
 const tamper=structuredClone(data);tamper.records[0].input.sentence+='changed';assert.throws(()=>lookupCurriculumExposureV1(tamper,{sentence:first}),/catalogue hash/);assert.throws(()=>curriculumCapacityProjectionV1(tamper,old.inventory),/catalogue hash/);assert.throws(()=>lookupCurriculumExposureV1(data,{sentence:''}));
 assert.equal(sha(readFileSync(oldFile)),oldSha);save('bounded-miss-offline-detection',{newSurfaces:253,oldBoundedInventoryMisses:missed,offlineLookupFindsAll:253,liveExecutorChanged:false,currentInventoryUnchanged:true,exactMatchOnlyNotFamilyCertification:true});
});
test('wholeanddeduplicatedcurriculumprojectionbothreallyhitexisting64KiBguard;nocapchangeortrim',()=>{
 const capacity=curriculumCapacityProjectionV1(data,old.inventory);assert.equal(capacity.combinedUniqueSurfaces,426);assert.deepEqual(capacity.fullSourceRecords,{entries:1472,bytes:397341,limitBytes:65536,accepted:false,error:'EX1_INVENTORY_BYTES',removedToFit:0});assert.deepEqual(capacity.exactSurfaceDeduplicated,{entries:460,bytes:125343,limitBytes:65536,accepted:false,error:'EX1_INVENTORY_BYTES',removedToFit:0});assert.equal(capacity.corpusTrimmedToFit,false);assert.equal(capacity.currentLimitsChanged,false);assert.equal(capacity.liveReady,false);save('capacity-held',capacity);
});
test('importboundaryandunsupportedstructuresholdbeforeuse;coverageandEnglishqualityremainexplicitlyincomplete',async()=>{
 const variants=[];for(const variant of ['unexpected-local-import','external-import']){const root=resolve(OUT,variant);mkdirSync(root);for(const f of CURRICULUM_INPUTS_V1){const dest=resolve(root,f);mkdirSync(dirname(dest),{recursive:true});copyFileSync(resolve(SOURCE,f),dest);}const file=resolve(root,'lib/grammar/content-v4.ts');if(variant==='unexpected-local-import'){writeFileSync(resolve(root,'lib/grammar/new-audit-boundary.ts'),'export const marker=1;');writeFileSync(file,readFileSync(file,'utf8')+"\nimport {marker} from './new-audit-boundary'; console.log(marker);\n");}else writeFileSync(file,readFileSync(file,'utf8')+"\nimport fs from 'node:fs'; console.log(typeof fs.readFileSync);\n");await assert.rejects(()=>loadCurriculumSnapshotV1(root),variant==='external-import'?/External runtime import/:/import boundary/);variants.push({variant,heldBeforeDynamicImport:true});}
 const fake={...snapshot,editions:structuredClone(snapshot.editions)};fake.editions[0].lessons[0].questions[0].kind='unsupported';assert.throws(()=>collectCurriculumExposureV1(fake));
 for(const flag of ['completeCurriculumExposure','completeProjectExposure','independentFamiliesCertified','actualEnglishQualityMeasured','liveDispatchAuthorized','currentBoundedWireInventoryReplaced'])assert.equal(data[flag],false);
 for(const key of ['actualProviderCalls','actualCountApiCalls','actualKeyReads'])assert.equal(data[key],0);assert.equal(data.completeForSelectedFields,true);assert.equal(data.remaining.length,4);
 save('boundaries-and-claims',{variants,unknownQuestionKindHeld:true,completeForSelectedFields:true,completeCurriculumExposure:false,completeProjectExposure:false,independentFamiliesCertified:false,actualEnglishQualityMeasured:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,liveExecutorChanged:false});
});
test.after(()=>writeFileSync(resolve(OUT,'curriculum-results.json'),JSON.stringify({passed:rows.length===6,groups:6,rows,records:1265,surfaces:255,newSurfaces:253,combinedUniqueSurfaces:426,completeCurriculumExposure:false,completeProjectExposure:false,actualEnglishQualityMeasured:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,liveExecutorChanged:false},null,2)+'\n'));
