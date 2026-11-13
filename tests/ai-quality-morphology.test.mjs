import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {correctionConflict,parseJudgmentFeedback} from '../lib/judgment-feedback-contract.ts';
import {PRODUCTIVE_MANNER_ADJECTIVES} from '../lib/feedback-manner-adjectives.ts';

test('productive manner index has curriculum adjective provenance, not arbitrary suffix guesses',()=>{
 const words=JSON.parse(readFileSync('data/words.json','utf8'));
 const expected=[...new Set(words.filter(w=>w.pos==='adj.'&&/^[a-z]+(?:ful|less)$/.test(w.word)).map(w=>w.word))].sort();assert.deepEqual([...PRODUCTIVE_MANNER_ADJECTIVES],expected);assert.ok(expected.includes('helpful')&&expected.includes('successful')&&expected.includes('careless'));
});

test('curriculum-backed productive manner families pass the actual guard and parser in both spelling directions',()=>{
 for(const adjective of PRODUCTIVE_MANNER_ADJECTIVES){
  const original=`They performed the task ${adjective}.`,correctedSentence=`They performed the task ${adjective}ly.`;
  assert.equal(correctionConflict(original,correctedSentence),undefined,adjective);assert.equal(correctionConflict(correctedSentence,original),undefined,adjective+' reverse');
  const f=parseJudgmentFeedback(JSON.stringify({meaningUsage:'needs_work',grammar:'needs_work',correctedSentence,targetReason:'합성 목표 의견',grammarReason:'합성 문법 의견',correctionReason:'합성 방식 부사 보완',contextNeeded:'none'}),original,'gpt-6.1-sol',{sentence:original});assert.equal(f.correctedSentence,correctedSentence);
 }
});

test('productive family support retains adverse semantic controls and does not authorize noun or lexical suffix substitutions',()=>{
 for(const [a,b]of [['hard','hardly'],['late','lately'],['high','highly'],['near','nearly'],['spoonful','spoonfully'],['basketful','basketfully'],['friend','friendly'],['helpful','helpfullyish'],['helpful','harmfully']])assert.equal(correctionConflict(`They worked ${a}.`,`They worked ${b}.`),'content_change',a+'/'+b);
 const original='He did not carry two boxes helpful yesterday.';
 for(const [correction,reason]of [['He did carry two boxes helpfully yesterday.','negation'],['He did not carry three boxes helpfully yesterday.','quantity'],['She did not carry two boxes helpfully yesterday.','participants'],['He did not carry two boxes helpfully tomorrow.','time_or_focus'],['He did not carry two boxes helpfully yesterday?','speech_act'],['He did not carry two bags helpfully yesterday.','content_change']])assert.equal(correctionConflict(original,correction),reason);
});

test('reviewed manner and progressive repairs preserve the rest of the clause', () => {
  for (const [original, correctedSentence] of [
    ['The cyclist rode reckless down the lane.', 'The cyclist rode recklessly down the lane.'],
    ['The water drained harmless into the basin.', 'The water drained harmlessly into the basin.'],
    ['The technician is checks the pressure gauge while the supervisor records the results.',
      'The technician is checking the pressure gauge while the supervisor records the results.'],
    ['She is closes the gate.', 'She is closing the gate.'],
    ['She is plans a visit.', 'She is planning a visit.'],
    ['She was checks the cabinet.', 'She was checking the cabinet.'],
  ]) {
    assert.equal(correctionConflict(original, correctedSentence), undefined, original);
    const feedback = parseJudgmentFeedback(JSON.stringify({
      meaningUsage: 'needs_work', grammar: 'needs_work', correctedSentence,
      targetReason: '합성 목표 의견', grammarReason: '합성 문법 의견', correctionReason: '합성 교정 이유', contextNeeded: 'none',
    }), original, 'gpt-6.1-sol', { sentence: original });
    assert.equal(feedback.correctedSentence, correctedSentence);
  }
});

test('the reviewed repairs cannot replace a fact, quote or verb root', () => {
  for (const [original, correction, reason] of [
    ['She is checks two gauges.', 'She is checking three gauges.', 'quantity'],
    ['She is not checks the gauge.', 'She is checking the gauge.', 'negation'],
    ['She is checks the gauge.', 'He is checking the gauge.', 'participants'],
    ['She is checks the gauge.', 'She was checking the gauge.', 'time_or_focus'],
    ['She is checks the gauge.', 'She is checking the cabinet.', 'content_change'],
    ['She is taps the gauge.', 'She is taping the gauge.', 'content_change'],
    ['She is checks the gauge.', 'She is checkking the gauge.', 'content_change'],
    ['She wrote “he drove reckless”.', 'She wrote “he drove recklessly”.', 'content_change'],
    ['She is reckless.', 'She is recklessly.', 'content_change'],
  ]) assert.equal(correctionConflict(original, correction), reason, correction);
});
