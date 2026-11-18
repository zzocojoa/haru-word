import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJudgmentFeedback,judgmentJsonSchema} from '../lib/judgment-feedback-contract.ts';
import {clarificationQuestion} from '../lib/judgment-policy.ts';

const wire=(sentence,extra={})=>({meaningUsage:'needs_work',grammar:'uncertain',correctedSentence:'',targetReason:'합성 목표 형태 오류',grammarReason:'합성 문맥 미확정',correctionReason:'',contextNeeded:'quantity',...extra});
const parse=(sentence,extra={},contextNote='',contextKind='sentence')=>parseJudgmentFeedback(JSON.stringify(wire(sentence,extra)),sentence,'gpt-6.1-sol',{sentence,contextKind,...(contextNote?{contextNote}:{})});

test('explicitly withheld repairs for incomplete messages use the existing safe feedback shape', () => {
  for (const [sentence, contextNeeded] of [['Several faded postcards', 'message'], ['Even though the greenhouse had closed', 'relationship']]) {
    const result = parse(sentence, { meaningUsage: 'appropriate', grammar: 'needs_work', contextNeeded });
    assert.deepEqual([result.meaningUsage, result.grammar, result.correctedSentence], ['appropriate', 'needs_work', '']);
    assert.match(result.explanation, /교정문을 보류/);
    assert.ok(result.explanation.includes(clarificationQuestion(contextNeeded)));
  }
});

test('a known form issue can withhold the repair without losing the verified explanation', () => {
  for (const [sentence, contextNeeded, rule] of [
    ['She might brought the card.', 'time', /조동사 바로 뒤/],
    ['Those book belongs to Min.', 'quantity', /복수형/],
  ]) {
    const result = parse(sentence, { grammar: 'needs_work', contextNeeded });
    assert.deepEqual([result.meaningUsage, result.grammar, result.correctedSentence], ['needs_work', 'needs_work', '']);
    assert.match(result.explanation, rule);
    assert.ok(result.explanation.includes(clarificationQuestion(contextNeeded)));
  }
});

test('withheld repair requires a context request and an empty correction reason', () => {
  for (const [sentence, fields, contextKind] of [
    ['The postcard is on the desk.', { contextNeeded: 'none' }],
    ['Several faded postcards', { contextNeeded: 'message', correctionReason: '합성 교정 이유' }],
  ]) assert.throws(() => parse(sentence, { grammar: 'needs_work', ...fields }, '', contextKind),
    { judgmentReason: 'needs_work_missing_correction' });
});

test('contradictory number clues can request quantity specifically while preserving known target errors and withholding correction',()=>{
 assert.ok(judgmentJsonSchema.properties.contextNeeded.enum.includes('quantity'));
 for(const sentence of ['Those car belongs to Mia.','These box is empty.']){
  const f=parse(sentence);assert.equal(f.meaningUsage,'needs_work');assert.equal(f.grammar,'uncertain');assert.equal(f.correctedSentence,'');assert.match(f.explanation,/하나.*여러/);assert.doesNotMatch(f.explanation,/짧은 답변·제목/);
 }
 assert.match(clarificationQuestion('quantity'),/의도한 수량/);
});

test('explicit singular/plural context can carry either justified minimal correction without a forced quantity question',()=>{
 const sentence='Those car belongs to Mia.';
 for(const [contextNote,correctedSentence]of [['차 한 대를 말해요.','That car belongs to Mia.'],['차 여러 대를 말해요.','Those cars belong to Mia.']]){
  const f=parse(sentence,{grammar:'needs_work',correctedSentence,correctionReason:'합성 수 일치 보완',contextNeeded:'none'},contextNote);assert.equal(f.correctedSentence,correctedSentence);assert.doesNotMatch(f.explanation,/추가 문맥:/);
 }
});

test('unresolved correction context cannot emit a chosen correction',()=>{
 const sentence='Those car belongs to Mia.';
 for(const contextNeeded of ['quantity','time','message','relationship'])assert.throws(()=>parse(sentence,{grammar:'needs_work',correctedSentence:'Those cars belong to Mia.',correctionReason:'합성 보완',contextNeeded}),e=>e.judgmentReason==='unexpected_context_question');
 assert.throws(()=>parse(sentence,{correctedSentence:'Those cars belong to Mia.'}),e=>e.judgmentReason==='uncertain_nonempty_correction');
});

test('original grammar and repair context stay independent for every context kind',()=>{
 const original='The ferry will leave soon, but the date on the notice has not been filled in.';
 for(const contextNeeded of ['message','time','quantity','target_meaning','relationship']){
  for(const meaningUsage of ['appropriate','needs_work','uncertain']){
   const f=parse(original,{meaningUsage,grammar:'natural',correctedSentence:original,contextNeeded});
   assert.equal(f.grammar,'natural');assert.equal(f.correctedSentence,original);
   assert.ok(f.explanation.includes(clarificationQuestion(contextNeeded)));
  }
  const held=parse('She sing well.',{grammar:'needs_work',contextNeeded});
  assert.equal(held.grammar,'needs_work');assert.equal(held.correctedSentence,'');
  assert.match(held.explanation,/교정문을 보류/);
  assert.doesNotMatch(held.explanation,/독립 문장으로는 미완성|아래의 원문과 교정문/);
 }
});
