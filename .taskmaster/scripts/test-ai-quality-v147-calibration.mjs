import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {DIMENSIONS,CRITICAL,JUDGES,digest,validateGrade,summarizeCalibration,makeReviewPacket,combineReviews} from './ai-quality-v147-calibration.mjs';
const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const data=await read(resolve(HERE,'.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json'));
const witnesses=data.witnesses;
const records=()=>JUDGES.flatMap(judgeId=>witnesses.map(w=>({judgeId,witnessId:w.id,state:'graded',grade:structuredClone(w.expectedGrade)})));
const rows=()=>witnesses.map(w=>({id:'candidate/gpt-6.1-sol/'+w.id,input:w.input,feedback:w.feedback,rawGrade:structuredClone(w.expectedGrade)}));

test('frozen 4/4/4 witnesses distinguish actual parser outputs, hypothetical faults and unavailability',async()=>{
 assert.equal(data.publicDevelopmentOnly,true);assert.equal(data.freshHoldout,false);assert.equal(data.actualModelJudgeMeasured,false);assert.equal(data.newPaidCalls,0);
 assert.deepEqual(Object.fromEntries(['normal','clear_error','ambiguous'].map(k=>[k,witnesses.filter(w=>w.group===k).length])),{normal:4,clear_error:4,ambiguous:4});
 assert.equal(data.thresholds.maxPlannedCalls,36);
 const m=await read(resolve(HERE,'.taskmaster/docs/ai-quality-v147-manifest.json')),source=m.baseline.sourceRoot;
 await build({stdin:{contents:"export {parseJudgmentFeedback} from './lib/judgment-feedback-contract';",resolveDir:source,loader:'ts'},outfile:resolve(source,'work/ai-quality-calibration-check/runtime.mjs'),bundle:true,format:'esm',platform:'node',logLevel:'silent'});
 const {parseJudgmentFeedback}=await import(pathToFileURL(resolve(source,'work/ai-quality-calibration-check/runtime.mjs')));
 for(const w of witnesses){validateGrade(w.expectedGrade);
  if(w.materialKind==='current-parser-public-development'){
   const f=parseJudgmentFeedback(JSON.stringify(w.wire),w.input.sentence,'gpt-6.1-sol',w.input);
   assert.deepEqual(Object.fromEntries(['original','meaningUsage','grammar','correctedSentence','explanation'].map(k=>[k,f[k]])),w.feedback,w.id);
  }else if(w.materialKind==='current-parser-rejection-public-development'){
   assert.throws(()=>parseJudgmentFeedback(JSON.stringify(w.wire),w.input.sentence,'gpt-6.1-sol',w.input),e=>e.judgmentReason===w.expectedRejection);
   assert.equal(w.feedback,null);for(const d of DIMENSIONS)assert.equal(w.expectedGrade[d],'unavailable');assert.ok(CRITICAL.every(k=>!w.expectedGrade.criticalErrors[k]));
  }else assert.equal(w.materialKind,'hypothetical-visible-fault-not-product-reproduction');
 }
});

test('36 fabricated reference grades prove accounting only, with no model performance certification',()=>{
 const result=summarizeCalibration(witnesses,records());assert.equal(result.thresholdArithmeticSatisfied,true);assert.equal(result.modelCalibrationMeasured,false);assert.equal(result.independentEnglishCertification,false);
 for(const j of result.judges){assert.equal(j.denominator,12);assert.equal(j.matches,12);assert.equal(j.complete,true);assert.equal(j.thresholdMet,true);}
});

test('one noncritical disagreement may meet 11/12; a required critical miss cannot',()=>{
 const ordinary=records(),one=ordinary.find(r=>r.judgeId===JUDGES[0]&&r.witnessId==='N01');one.grade.explanation='fail';
 const tolerated=summarizeCalibration(witnesses,ordinary);assert.equal(tolerated.judges[0].matches,11);assert.equal(tolerated.thresholdArithmeticSatisfied,true);
 const critical=records(),bad=critical.find(r=>r.judgeId===JUDGES[0]&&r.witnessId==='F02');bad.grade.criticalErrors.reverseMeaning=false;
 const rejected=summarizeCalibration(witnesses,critical);assert.equal(rejected.judges[0].matches,11);assert.equal(rejected.judges[0].criticalMisses.reverseMeaning,1);assert.equal(rejected.thresholdArithmeticSatisfied,false);
});

test('missing or failed collection remains a fixed12 denominator and cannot be replaced by duplicate or unknown slots',()=>{
 for(const kind of ['missing','failed']){const input=records(),i=input.findIndex(r=>r.judgeId===JUDGES[0]&&r.witnessId==='N01');if(kind==='missing')input.splice(i,1);else input[i]={...input[i],state:'failed',grade:null};
  const result=summarizeCalibration(witnesses,input);assert.equal(result.judges[0].matches,11);assert.equal(result.judges[0].denominator,12);assert.equal(result.thresholdArithmeticSatisfied,false);
 }
 const duplicate=records();duplicate.push(duplicate[0]);assert.throws(()=>summarizeCalibration(witnesses,duplicate),/duplicate grade slot/);
 const unknown=records();unknown[0].judgeId='another-model';assert.throws(()=>summarizeCalibration(witnesses,unknown));
});

test('review packets omit model,phase,raw grades,provider metadata and unknown input fields; only partial blinding is claimed',()=>{
 const input=rows();for(const row of input){row.modelId='SYNTHETIC_HIDDEN_MODEL';row.phase='SYNTHETIC_HIDDEN_PHASE';row.input={...row.input,privateInternal:'SYNTHETIC_HIDDEN_PRIVATE'};if(row.feedback)row.feedback={...row.feedback,requestedModel:'SYNTHETIC_HIDDEN_MODEL',requestId:'SYNTHETIC_HIDDEN_PROVIDER'};}
 const {packet,mapping}=makeReviewPacket(input,Buffer.alloc(32,9));assert.equal(packet.independent,false);assert.equal(packet.reviewKind,'same-author-partially-blinded');assert.equal(mapping.rowsHash,digest(input));
 assert.doesNotMatch(JSON.stringify(packet),/SYNTHETIC_HIDDEN|rawGrade|criticalErrors|gpt-6|candidate\//);
 assert.deepEqual(packet.entries.map(e=>e.blindId),packet.entries.map(e=>e.blindId).sort());
 for(const e of packet.entries)assert.equal(e.evidenceHash,digest({input:e.input,available:e.available,feedback:e.feedback}));
 const different=makeReviewPacket(input,Buffer.alloc(32,10));assert.notDeepEqual(packet.entries.map(e=>e.blindId),different.packet.entries.map(e=>e.blindId));
});

test('raw grades,review and adjudication remain separate; missing or unresolved decisions hold the result',()=>{
 const input=rows(),before=digest(input),{mapping}=makeReviewPacket(input,Buffer.alloc(32,11));
 const reviews=mapping.entries.map(m=>({blindId:m.blindId,evidenceHash:m.evidenceHash,reviewerId:'same-author-test',grade:structuredClone(input.find(r=>r.id===m.rowId).rawGrade),reasonCodes:['confirmed']}));
 reviews[0].grade.explanation='fail';const noDecision=combineReviews(input,mapping,reviews,[]);assert.equal(noDecision.held,true);assert.equal(noDecision.entries[0].adjudicatedGrade,null);
 const decisions=reviews.map(review=>({blindId:review.blindId,reviewHash:digest(review),reviewerId:'same-author-test',decision:'confirm_review'}));
 const complete=combineReviews(input,mapping,reviews,decisions);assert.equal(complete.held,false);assert.equal(complete.rawGradesOverwritten,false);assert.equal(complete.independentReviewVerified,false);assert.equal(complete.entries[0].reviewGrade.explanation,'fail');assert.notEqual(complete.entries[0].rawGrade.explanation,'fail');assert.equal(digest(input),before);
 decisions[0].decision='unresolved';assert.equal(combineReviews(input,mapping,reviews,decisions).held,true);
});

test('stale evidence,changed raw data,forged mappings and duplicate reviews cannot silently adjust a grade',()=>{
 const input=rows(),{mapping}=makeReviewPacket(input,Buffer.alloc(32,12)),m=mapping.entries[0],review={blindId:m.blindId,evidenceHash:m.evidenceHash,reviewerId:'same-author-test',grade:structuredClone(input[0].rawGrade),reasonCodes:['confirmed']};
 assert.throws(()=>combineReviews(input,mapping,[{...review,evidenceHash:'stale'}],[]),/stale review evidence/);
 assert.throws(()=>combineReviews(input,mapping,[review,review],[]),/duplicate review/);
 const changed=structuredClone(input);changed[0].rawGrade.explanation='fail';assert.throws(()=>combineReviews(changed,mapping,[],[]),/raw observations changed/);
 const forged=structuredClone(mapping);forged.entries[0].evidenceHash='wrong';assert.throws(()=>combineReviews(input,forged,[],[]),/mapping evidence changed/);
 assert.throws(()=>combineReviews(input,mapping,[review],[{blindId:m.blindId,reviewHash:'stale',reviewerId:'same-author-test',decision:'confirm_raw'}]),/stale adjudication/);
});

test('grade schema rejects extra private fields and invalid critical or dimension values',()=>{
 const original=structuredClone(witnesses[0].expectedGrade);
 for(const mutate of [g=>{g.privateInput='SYNTHETIC_PRIVATE';},g=>{g.criticalErrors.swapRoles='yes';},g=>{g.grammar='probably';},g=>{delete g.meaning;}]){const g=structuredClone(original);mutate(g);assert.throws(()=>validateGrade(g));}
});

test('validation errors never attach untrusted field names or mismatched private sentences',()=>{
 const bad={...structuredClone(witnesses[0].expectedGrade),SYNTHETIC_PRIVATE_FIELD_NAME:'hidden'};
 const safe=e=>!JSON.stringify({message:e.message,...e}).includes('SYNTHETIC_PRIVATE');
 assert.throws(()=>validateGrade(bad),safe);
 const input=rows();input[0].feedback={...input[0].feedback,original:'SYNTHETIC_PRIVATE_WRONG_SENTENCE'};
 assert.throws(()=>makeReviewPacket(input,Buffer.alloc(32,9)),safe);
});
