import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileBilingualReferencesV2} from './ai-quality-v147-bilingual-reference-v2.mjs';
import {compileContextLanguageV1,inspectContextLanguageV1} from './ai-quality-v147-context-language-v1.mjs';
import {contextReviewInstruction} from './ai-quality-v147-blind-reference-inspection-v3.mjs';

const source=fileURLToPath(new URL('../..',import.meta.url)),root=JSON.parse(readFileSync(resolve(source,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot;
const read=f=>JSON.parse(readFileSync(resolve(root,f),'utf8'));
const bank=read('outputs/ai-quality-v147-implementation-20261106/phase204/staged-candidate-draft.json');
const capture=read('outputs/ai-quality-v147-implementation-20261106/phase204/combined-application-bodies.json');
const inputs={priorPlan:read('outputs/ai-quality-v147-implementation-20261106/phase203/language-plan.json'),parents:read('outputs/ai-quality-v147-implementation-20261106/phase204/reference-parent-bindings.json'),wordPolicyPlan:compileBilingualReferencesV2({proposal:{cases:bank.cases,qualifiedReferences:0,mainDispatchAuthorized:false},capture})};
const plan=compileContextLanguageV1(inputs);
function answers(){return plan.requests.map(r=>({key:r.key,payloadRaw:JSON.stringify({items:r.bindings.map(b=>({itemId:b.itemId,meaningUsage:'appropriate',grammar:'natural',contextNeeded:'time',edits:[],rationale:'Synthetic context contract only; not an English verdict.',...(r.domain==='grammar'?{sourceCoverage:'insufficient',sourcesUsed:[]}:{})}))})}));}

test('current changed inputs, sources, blind roles and new instructions are connected without reusing old request IDs',()=>{
 assert.equal(plan.caseCount,31);assert.equal(plan.judgmentSlots,62);assert.equal(plan.requests.length,4);assert.equal(plan.changedInputCaseIds.length,2);
 assert.equal(plan.referencesQualified,0);assert.equal(plan.mainDispatchAuthorized,false);assert.equal(plan.budgetVerified,false);
 for(const r of plan.requests){const body=JSON.parse(r.requestRaw),data=JSON.parse(body.input[0].content);assert.equal(data.items.length,r.bindings.length);
  assert.equal(r.dispatchEligible,false);assert(!body.instructions.includes('The user payload is losslessly packed'));
  if(r.domain==='grammar')assert(body.instructions.includes(contextReviewInstruction));else assert.match(body.instructions,/Context needed to select a correction is independent/);
  for(const item of data.items){const b=r.bindings.find(b=>b.itemId===item.itemId),parent=inputs.parents.cases.find(c=>c.caseId===b.caseId);assert.deepEqual(item.assignment,parent.input);
   const prior=inputs.priorPlan.requests.find(p=>p.key===r.key),oldBinding=prior.bindings.find(x=>x.caseId===b.caseId);assert.notEqual(item.itemId,oldBinding.itemId);
   if(r.domain==='grammar')assert.deepEqual(item.sources,prior.privateItems.find(i=>i.itemId===oldBinding.itemId).sources);
  }
 }
});

test('all 62 synthetic known-grammar context responses decode without automatic qualification',()=>{
 const result=inspectContextLanguageV1(plan,answers());assert.equal(result.rawSlots,62);assert.equal(result.availableVotes,62);assert.equal(result.referencesQualified,0);assert.equal(result.englishTruthCertified,false);
 assert(result.votes.every(v=>v.parsed.grammar==='natural'&&v.parsed.contextNeeded==='time'));
});

test('missing, duplicated or outside opaque response IDs preserve unavailable seats',()=>{
 for(const transform of [rows=>rows.filter(r=>r.key!==plan.requests[0].key),rows=>[...rows,structuredClone(rows[0])],rows=>{const p=JSON.parse(rows[0].payloadRaw);p.items[0].itemId=p.items[1].itemId;rows[0].payloadRaw=JSON.stringify(p);return rows;},rows=>{const p=JSON.parse(rows[0].payloadRaw);p.items[0].itemId='unassigned-id';rows[0].payloadRaw=JSON.stringify(p);return rows;}]){
  const result=inspectContextLanguageV1(plan,transform(answers()));assert.equal(result.availableVotes,62-plan.requests[0].bindings.length);assert.equal(result.rawSlots,62);assert.equal(result.referencesQualified,0);
 }
});

test('changed parent meaning or request hashes fail before a new request can be prepared',()=>{
 const parents=structuredClone(inputs.parents);parents.cases.find(c=>c.domain==='word').input.contextNote+=' Different meaning.';
 assert.throws(()=>compileContextLanguageV1({...inputs,parents}));
 const priorPlan=structuredClone(inputs.priorPlan);priorPlan.requests[0].requestRaw+=' ';assert.throws(()=>compileContextLanguageV1({...inputs,priorPlan}));
});
