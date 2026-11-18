import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFullSentenceReferenceV1 as project} from './ai-quality-v147-full-sentence-projection-v1.mjs';
const wire=correction=>({meaningUsage:'needs_work',grammar:'needs_work',contextNeeded:'none',correction,sourceCoverage:'sufficient',sourcesUsed:['test'],rationale:'Synthetic structural fixture.'});
function reconstruct(original,edits){let text=original;for(const e of edits){const i=text.indexOf(e.before);assert(i>=0&&text.indexOf(e.before,i+1)<0);text=text.slice(0,i)+e.after+text.slice(i+e.before.length);}return text;}
test('explicit complete correction disambiguates a short substring inside other words',()=>{
 const original='Pack tea or rice before the workers arrive.',corrected='Pack tea and rice before the workers arrive.';
 assert(original.indexOf('or')!==original.lastIndexOf('or'));
 const p=project({sentence:original},wire(corrected));assert.equal(reconstruct(original,p.canonical.edits),corrected);
 assert.equal(p.proof.exactReconstruction,true);assert.equal(p.proof.englishMeaningOrCorrectnessVerified,false);
});
test('an explicit within-word change is preserved even when a matching whole word exists elsewhere',()=>{
 const original='A coral stone or shell.',corrected='A canal stone or shell.';
 const p=project({sentence:original},wire(corrected));assert.equal(reconstruct(original,p.canonical.edits),corrected);
 assert(p.canonical.edits[0].before!=='or');
});
test('insertions, deletions and Unicode use exact character reconstruction',()=>{
 for(const [original,corrected]of [['They left.','They had left.'],['They had left.','They left.'],['A 😀 badge.','A 😃 badge.']]){
  const p=project({sentence:original},wire(corrected));assert.equal(reconstruct(original,p.canonical.edits),corrected);
  assert(p.canonical.edits.every(e=>e.before.isWellFormed()&&e.after.isWellFormed()));
 }
});
test('unchanged and withheld results do not create edits or fabricate a completion',()=>{
 const sentence='A test sentence.';assert.deepEqual(project({sentence},{...wire(sentence),grammar:'natural'}).canonical.edits,[]);
 assert.deepEqual(project({sentence},{...wire(''),grammar:'uncertain',contextNeeded:'message'}).canonical.edits,[]);
 assert.throws(()=>project({sentence},{...wire('An invented completion.'),contextNeeded:'message'}),/forced completion/);
});
test('projection retains the frozen180-character span limit rather than truncating provider text',()=>{
 assert.throws(()=>project({sentence:'A'.repeat(200)},wire('B'.repeat(200))),/span limit/);
});
