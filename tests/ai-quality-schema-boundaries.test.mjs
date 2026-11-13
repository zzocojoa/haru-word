import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJudgmentFeedback,judgmentJsonSchema,JUDGMENT_LIMITS} from '../lib/judgment-feedback-contract.ts';

const original='They is here.',correctedSentence='They are here.';
const wire={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence,targetReason:'합성 목표',grammarReason:'합성 문법',correctionReason:'합성 보완',contextNeeded:'none'};
const parse=value=>parseJudgmentFeedback(JSON.stringify(value),original,'gpt-6.1-sol',{sentence:original});

test('raw reason upper bounds agree with the generation schema before whitespace normalization',()=>{
 for(const field of ['targetReason','grammarReason','correctionReason']){
  const max=JUDGMENT_LIMITS[field],pattern=new RegExp(judgmentJsonSchema.properties[field].pattern);
  const exact='x'.repeat(max-2)+' \n';assert.equal(exact.length,max);assert.ok(pattern.test(exact));
  assert.equal(parse({...wire,[field]:exact}).correctedSentence,correctedSentence);
  for(const overflow of [exact+' ', ' '+exact, '\n'+exact+'\n']){
   assert.equal(pattern.test(overflow),false);
   assert.throws(()=>parse({...wire,[field]:overflow}),e=>e.stage==='fields',field+' raw overflow');
  }
 }
});

test('normalization preserves meaningful reasons but never turns an empty reason into an accepted judgment',()=>{
 for(const field of ['targetReason','grammarReason','correctionReason']){
  assert.equal(parse({...wire,[field]:' \t합성 근거\n '}).correctedSentence,correctedSentence);
  if(field==='correctionReason')assert.throws(()=>parse({...wire,[field]:' \t\n '}),e=>e.judgmentReason==='missing_correction_reason');
  else assert.throws(()=>parse({...wire,[field]:' \t\n '}),e=>e.stage==='fields');
 }
});
