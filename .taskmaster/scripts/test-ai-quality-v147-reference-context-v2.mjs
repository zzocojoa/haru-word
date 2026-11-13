import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileBilingualReferencesV2,inspectBilingualItemV2} from './ai-quality-v147-bilingual-reference-v2.mjs';
import {inspectBilingualItemV1} from './ai-quality-v147-bilingual-reference-v1.mjs';
import {inspectBlindReferenceV3,compareBlindReferencesV3} from './ai-quality-v147-blind-reference-inspection-v3.mjs';
import {inspectBlindReferenceV2} from './ai-quality-v147-blind-reference-inspection-v2.mjs';
import {loadJointCohortContextV1} from './ai-quality-v147-joint-cohort-draft-v1.mjs';

const here=fileURLToPath(new URL('../..',import.meta.url));
const root=JSON.parse(readFileSync(resolve(here,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot;
const read=f=>JSON.parse(readFileSync(resolve(root,f),'utf8'));
const language=read('outputs/ai-quality-v147-implementation-20261106/phase203/language-plan.json');
const template=language.requests.find(r=>r.domain==='grammar');
const baseWire={meaningUsage:'appropriate',grammar:'natural',contextNeeded:'none',edits:[],rationale:'합성 계약 확인',itemId:'synthetic-reference-context'};
function slot(assignment,wire,sources=[],reviewer='gpt-6.1-sol'){
 const body=JSON.parse(template.requestRaw);body.model=reviewer;
 body.input=[{role:'user',content:JSON.stringify({assignment,sources})}];body.text.format.schema=structuredClone(template.privateItemSchema);
 body.text.format.schema.properties.itemId.enum=[wire.itemId];
 return{caseId:'synthetic-reference-context',reviewer,sourceIds:sources.map(s=>s.id),requestRaw:JSON.stringify(body)};
}
function grammar(assignment,wire,sources=[]){
 const response={sourceCoverage:'insufficient',sourcesUsed:[],...wire};
 return inspectBlindReferenceV3(slot(assignment,response,sources),response);
}

test('word compilation uses the new context rule without changing any captured learner input or granting dispatch',()=>{
 const bank=read('outputs/ai-quality-v147-implementation-20261106/phase204/staged-candidate-draft.json');
 const capture=read('outputs/ai-quality-v147-implementation-20261106/phase204/combined-application-bodies.json');
 const plan=compileBilingualReferencesV2({proposal:{cases:bank.cases,qualifiedReferences:0,mainDispatchAuthorized:false},capture});
 assert.equal(plan.protocol,'ai-quality-v147-bilingual-reference-v2');assert.equal(plan.requests.length,3);
 assert.equal(plan.referencesQualified,0);assert.equal(plan.scopeApproved,false);assert.equal(plan.mainDispatchAuthorized,false);
 for(const r of plan.requests){const b=JSON.parse(r.requestRaw),items=JSON.parse(b.input[0].content).items;assert.equal(items.length,20);
  assert.match(b.instructions,/Context needed to select a correction is independent/);
  assert.doesNotMatch(b.instructions,/Time\/quantity questions require grammar uncertain/);
  for(const item of items){const binding=r.privateBindings.find(x=>x.itemId===item.itemId),captured=capture.records.find(x=>x.profile==='candidate'&&x.caseId===binding.caseId&&x.model===r.model);assert.deepEqual(item.assignment,JSON.parse(JSON.parse(captured.requestRaw).input[0].content));}
 }
});

test('both encodings preserve known grammar judgments while asking any required context kind',()=>{
 for(const contextNeeded of ['message','time','quantity','target_meaning','relationship'])for(const meaningUsage of ['appropriate','needs_work','uncertain']){
  const assignment={sentence:'The ferry will leave soon.'},wire={...baseWire,contextNeeded,meaningUsage};
  for(const inspect of [inspectBilingualItemV2,grammar]){
   assert.equal(inspect(assignment,wire).correction,assignment.sentence);
   const error={sentence:'She sing well.'},held=inspect(error,{...wire,grammar:'needs_work'});
   assert.equal(held.grammar,'needs_work');assert.equal(held.correction,'');
  }
 }
});

test('unresolved repairs, unsupported natural rewrites and invalid edit spans remain rejected',()=>{
 const a={sentence:'She sing well.'},edit={before:'sing',after:'sings'};
 for(const inspect of [inspectBilingualItemV2,grammar]){
  for(const contextNeeded of ['message','time','quantity','relationship'])assert.throws(()=>inspect(a,{...baseWire,grammar:'needs_work',contextNeeded,edits:[edit]}));
  assert.throws(()=>inspect(a,{...baseWire,grammar:'needs_work'}));
  assert.throws(()=>inspect(a,{...baseWire,grammar:'uncertain',contextNeeded:'time',edits:[edit]}));
  assert.throws(()=>inspect(a,{...baseWire,grammar:'natural',edits:[edit]}));
  assert.throws(()=>inspect(a,{...baseWire,grammar:'needs_work',edits:[{before:'sing',after:'sing'}]}));
  assert.throws(()=>inspect({sentence:'go go'},{...baseWire,grammar:'needs_work',edits:[{before:'go',after:'goes'}]}));
  assert.throws(()=>inspect(a,{...baseWire,grammar:'needs_work',edits:[{before:'She sing',after:'She sings'},{before:'sing well',after:'sings well'}]}));
  assert.equal(inspect(a,{...baseWire,meaningUsage:'uncertain',grammar:'needs_work',contextNeeded:'target_meaning',edits:[edit]}).correction,'She sings well.');
 }
 const intent={sentence:'The kite drifted under the bridge.',contextRole:'intended_korean',contextNote:'연이 다리 위를 지나갔어요.'};
 assert.equal(inspectBilingualItemV2(intent,{...baseWire,edits:[{before:'under',after:'over'}]}).correction,'The kite drifted over the bridge.');
});

test('grammar source membership, source sufficiency and independent-review holds are preserved',()=>{
 const a={sentence:'Birds fly.'},sources=[{id:'synthetic-source',excerpt:'Synthetic contract fixture, not English qualification.'}];
 for(const fields of [{sourceCoverage:'sufficient',sourcesUsed:[]},{sourceCoverage:'sufficient',sourcesUsed:['foreign']},{sourceCoverage:'sufficient',sourcesUsed:['synthetic-source','synthetic-source']}])assert.throws(()=>grammar(a,{...baseWire,...fields},sources));
 const response={...baseWire,contextNeeded:'time',sourceCoverage:'insufficient',sourcesUsed:[]};
 const left=slot(a,response,sources),right=slot(a,response,sources,'gpt-6.1-terra');
 assert.equal(compareBlindReferencesV3(left,right,[response,response]),'held-source');
 assert.equal(compareBlindReferencesV3(left,right,[response,null]),'held-missing');
 assert.throws(()=>compareBlindReferencesV3(left,left,[response,response]));
});

test('the two actual product responses fit both prospective encodings without relabeling or an English-quality claim',()=>{
 const plan=read('outputs/ai-quality-v147-implementation-20261106/phase210/app-plan.json');
 for(const[index,r]of plan.requests.entries()){
  const response=read('outputs/ai-quality-v147-implementation-20261106/phase210/live/model-'+index+'-response.json');
  const raw=JSON.parse(response.output.find(x=>x.type==='message').content.find(x=>x.type==='output_text').text);
  const wire={...baseWire,meaningUsage:raw.meaningUsage,grammar:raw.grammar,contextNeeded:raw.contextNeeded};
  for(const inspect of [inspectBilingualItemV2,grammar]){const value=inspect(r.assignment,wire);assert.equal(value.grammar,raw.grammar);assert.equal(value.meaningUsage,raw.meaningUsage);assert.equal(value.correction,raw.correctedSentence);}
 }
});

test('seven previously supported proposals decode prospectively while the original five accepted encodings and frozen evidence stay unchanged',()=>{
 const selected=read('outputs/ai-quality-v147-implementation-20261106/phase208/adjudicated-reference-proposals.json').proposals;
 const current=read('outputs/ai-quality-v147-implementation-20261106/phase206/reference-candidates-final.json');
 let oldAccepted=0,newAccepted=0;
 for(const p of selected){const c=current.cases.find(c=>c.caseId===p.caseId),vote=c.languageEvidence.rawVotes[p.variant],input=JSON.parse(JSON.parse(c.parentBinding.parentRequestRaw).input[0].content);
  if(c.domain==='word'){try{inspectBilingualItemV1(input,vote.response);oldAccepted++;}catch{/* Historical encoding hold. */}inspectBilingualItemV2(input,vote.response);}
  else{const s=slot(input,vote.response,c.sourcePack.sources,vote.reviewer);try{inspectBlindReferenceV2(s,vote.response);oldAccepted++;}catch{/* Historical encoding hold. */}inspectBlindReferenceV3(s,vote.response);}
  assert.equal(p.acceptedAsFormalReference,false);newAccepted++;
 }
 assert.equal(oldAccepted,5);assert.equal(newAccepted,7);loadJointCohortContextV1();
});
