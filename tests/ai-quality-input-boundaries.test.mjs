import test from 'node:test';
import assert from 'node:assert/strict';
import {insufficientInput} from '../lib/judgment-input.ts';
import {parseJudgmentFeedback} from '../lib/judgment-feedback-contract.ts';

// Public synthetic development cases. These test app decisions for a fixed wire;
// they do not measure a model, an unseen holdout or a real learner's writing.
const wire = (sentence, overrides={}) => ({meaningUsage:'appropriate',grammar:'natural',correctedSentence:sentence,targetReason:'검사용 목표 판단',grammarReason:'검사용 문법 판단',correctionReason:'',contextNeeded:'none',...overrides});
const parse = (sentence, overrides={}) => parseJudgmentFeedback(JSON.stringify(wire(sentence,overrides)),sentence,'gpt-6.1-sol',{sentence});

test('productive go/come/help + bare-verb imperatives are not independently forced into verb-list deferral',()=>{
 for(const sentence of ['Go read.','Go eat!','Go help.','Come sit.','Come look!','Come listen.','Help write.','Help read!','Help cook.','Give help.','Give help','Enjoy sleep.','Enjoy sleep','I asked.','Wait here.','Take care.']){
  assert.equal(insufficientInput(sentence),undefined,sentence);
  const feedback=parse(sentence);assert.equal(feedback.grammar,'natural',sentence);assert.equal(feedback.correctedSentence,sentence);assert.equal(feedback.meaningUsage,'appropriate');
 }
});

test('a possible bare-verb construction does not overwrite uncertain or corrective model judgments',()=>{
 const sentence='Come look.';
 const uncertain=parse(sentence,{meaningUsage:'uncertain',grammar:'uncertain',correctedSentence:'',contextNeeded:'message'});
 assert.equal(uncertain.grammar,'uncertain');assert.match(uncertain.explanation,/추가 문맥:/);
 const correction=parse('Go read',{grammar:'needs_work',correctedSentence:'Go read.',correctionReason:'문장 마침 표시'});
 assert.equal(correction.grammar,'needs_work');assert.equal(correction.correctedSentence,'Go read.');
});

test('explicitly listed fragments retain independent deferral without inferring POS from a verb dictionary',()=>{
 for(const sentence of ['eat / go','read / write','sit / stand','Go / read','Come / sit']){
  assert.equal(insufficientInput(sentence),'word_list',sentence);
  const feedback=parse(sentence);assert.equal(feedback.grammar,'uncertain');assert.equal(feedback.correctedSentence,'');
 }
 for(const sentence of ['Music','Exactly six...','Although the broth','Under the chair'])assert.ok(insufficientInput(sentence));
});

test('undelimited verb strings retain a model abstention without a blanket app POS decision',()=>{
 for(const sentence of ['eat go','read write','sit stand']){
  assert.equal(insufficientInput(sentence),undefined);
  const f=parse(sentence,{meaningUsage:'uncertain',grammar:'uncertain',correctedSentence:'',contextNeeded:'message'});assert.equal(f.grammar,'uncertain');assert.equal(f.correctedSentence,'');assert.match(f.explanation,/추가 문맥:/);
 }
});

test('removing the unsound verb-list inference does not permit invented participants or content in a correction',()=>{
 for(const [original,correctedSentence]of [['eat go','I eat and go.'],['Give help.','I give help.'],['Enjoy sleep.','Enjoy music.']])assert.throws(()=>parse(original,{grammar:'needs_work',correctedSentence,correctionReason:'합성 잘못된 교정'}),e=>['participants','content_change'].includes(e.judgmentReason));
});
