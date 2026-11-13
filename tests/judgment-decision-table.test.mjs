import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {build} from 'esbuild';
mkdirSync('work/decision-table-tests',{recursive:true});
await build({stdin:{contents:"export {parseJudgmentFeedback,correctionConflict,judgmentJsonSchema} from './lib/judgment-feedback-contract';export {insufficientInput} from './lib/judgment-input';export {CLARIFICATION_KINDS,clarificationQuestion,JUDGMENT_DECISION_INSTRUCTION} from './lib/judgment-policy';export {generateGrammarFeedback,grammarFeedbackInput} from './lib/grammar/feedback';export {GRAMMAR_LESSONS} from './lib/grammar/content';export {lessonForVersion} from './lib/grammar/content-v4';",loader:'ts',resolveDir:process.cwd()},outfile:'work/decision-table-tests/runtime.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const r=await import('../work/decision-table-tests/runtime.mjs');
const matrix=JSON.parse(readFileSync('tests/fixtures/judgment-decision-matrix.json','utf8'));
const wire=(c,correction)=>({meaningUsage:c.expected.meaningUsage,grammar:c.expected.grammar,correctedSentence:correction??(c.expected.grammar==='natural'?c.sentence:c.expected.corrections[0]??''),targetReason:'합성 목표 상태 검사',grammarReason:'합성 원문 상태 검사',correctionReason:c.expected.grammar==='needs_work'?'기준의 최소 교정을 전달합니다.':'',contextNeeded:c.expected.clarification});
const parse=(c,w=wire(c))=>r.parseJudgmentFeedback(JSON.stringify(w),c.sentence,'gpt-6.1-sol',{sentence:c.sentence,...(c.contextKind!=='sentence'?{contextKind:c.contextKind}:{}),...(c.contextNote?{contextNote:c.contextNote}:{})});

test('all105 exposed development decisions and their declared minimal alternatives fit the actual wire/state contract, not a model accuracy test',()=>{
 assert.equal(matrix.rows.length,15);assert.equal(matrix.modelQualityMeasured,false);
 assert.equal(new Set(matrix.rows.map(x=>x.lessonId)).size,15);let cases=0;
 for(const row of matrix.rows){assert.deepEqual(row.cases.map(c=>c.category),matrix.categories);
  for(const c of row.cases){cases++;for(const correction of c.expected.corrections.length?c.expected.corrections:[undefined]){
   const f=parse(c,wire(c,correction));assert.equal(f.meaningUsage,c.expected.meaningUsage,row.lessonId+'/'+c.category);assert.equal(f.grammar,c.expected.grammar);
   assert.equal(f.correctedSentence,correction??(c.expected.grammar==='natural'?c.sentence:''));
   if(c.expected.clarification!=='none')assert.match(f.explanation,/추가 문맥:/);
  }}
 }assert.equal(cases,105);
});

test('bounded default fragments withhold confident model labels while explicit replies and complete clauses stay available',()=>{
 const base=matrix.rows[0].cases[0];
 for(const sentence of ['Although the broth','Because the storm','If the parcel','Under the chair','Behind the curtain']){
  const c={...base,sentence,contextKind:'sentence'},f=parse(c,wire({...c,expected:{...base.expected,meaningUsage:'appropriate',grammar:'natural',clarification:'none'}},sentence));
  assert.equal(f.meaningUsage,'uncertain');assert.equal(f.grammar,'uncertain');assert.equal(f.correctedSentence,'');
 }
 for(const sentence of ['Although the soup cooled, we waited.','We stood behind the chair.','Open the gate.','Near the gate.'])assert.equal(r.insufficientInput(sentence),undefined,sentence);
 assert.equal(r.insufficientInput('Under the chair','reply'),undefined);
 assert.equal(r.insufficientInput('Although the broth','title'),undefined);
 assert.equal(r.insufficientInput('Although the broth','command'),undefined);
});

test('clarification is a reviewed enum, including a specific temporal question, never free model instructions',()=>{
 assert.deepEqual(r.judgmentJsonSchema.properties.contextNeeded.enum,r.CLARIFICATION_KINDS);
 const c=matrix.rows.find(x=>x.lessonId==='modal').cases.find(c=>c.category==='interpretation_control'),f=parse(c);
 assert.equal(f.meaningUsage,'needs_work');assert.equal(f.grammar,'uncertain');assert.match(f.explanation,/이미 일어난.*앞으로 일어날/);assert.doesNotMatch(f.explanation,/짧은 답변·제목/);
 assert.throws(()=>parse(c,{...wire(c),contextNeeded:'none'}),e=>e.judgmentReason==='missing_context_question');
 assert.throws(()=>parse(c,{...wire(c),contextNeeded:'PRIVATE_FREE_QUESTION'}),e=>e.stage==='fields');
 assert.throws(()=>parse(c,{...wire(c),grammar:'needs_work',correctedSentence:'You might bring a torch.',correctionReason:'보완'}),e=>e.judgmentReason==='unexpected_context_question');
 assert.match(r.clarificationQuestion('message','reply'),/선택한 표현 형식/);
 assert.match(r.clarificationQuestion('relationship'),/앞뒤 내용/);
});

test('equivalent duplicate-contrast repairs are permitted without allowing a cause/contrast or content substitution',()=>{
 const a='Although it rained, but we walked.';
 for(const b of ['Although it rained, we walked.','It rained, but we walked.'])assert.equal(r.correctionConflict(a,b),undefined);
 for(const b of ['Because it rained, we walked.','It rained, but we slept.','It never rained, but we walked.'])assert.ok(r.correctionConflict(a,b),b);
});

test('all15 lessons x4versions x3models receive the same ordered policy and typed question schema through the real adapter',async()=>{
 const prior=console.info;console.info=()=>{};let requests=0;
 try{for(const lesson of r.GRAMMAR_LESSONS)for(const version of [1,2,3,4])for(const modelId of ['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra']){
  const c=matrix.rows.find(x=>x.lessonId===lesson.id).cases[0],selected=r.lessonForVersion(lesson,version);
  const f=await r.generateGrammarFeedback({apiKey:'SYNTHETIC_ONLY',modelId,allowedModels:modelId,judgmentEnabled:true},selected,c.sentence,async(_url,init)=>{
   requests++;const b=JSON.parse(init.body),input=JSON.parse(b.input[0].content);assert.ok(b.instructions.includes(r.JUDGMENT_DECISION_INSTRUCTION));assert.ok(input.targetCriterion.length>50);
   assert.equal(input.target,selected.title);assert.deepEqual(b.text.format.schema.properties.contextNeeded.enum,r.CLARIFICATION_KINDS);assert.equal(b.store,false);
   return Response.json({status:'completed',model:modelId,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(wire(c))}]}]});
  });assert.equal(f.promptVersion,'reference-v13');assert.equal(f.validationVersion,'judgment-v10');
 }}finally{console.info=prior;}assert.equal(requests,180);
});
