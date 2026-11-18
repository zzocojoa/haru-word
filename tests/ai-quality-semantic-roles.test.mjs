import test from 'node:test';
import assert from 'node:assert/strict';
import {correctionConflict,parseJudgmentFeedback} from '../lib/judgment-feedback-contract.ts';

test('simple who questions cannot exchange the unknown actor and the known participant',()=>{
 for(const [a,b]of [['Who likes him?','Who does he like?'],['Who helped her?','Who did she help?'],['Who saw me?','Who did I see?']]){
  assert.equal(correctionConflict(a,b),'participants');assert.equal(correctionConflict(b,a),'participants');
 }
});

test('who/whom case repair with the same role or literal tail is not a speech-act change',()=>{
 for(const [original,correctedSentence]of [['Whom called you?','Who called you?'],['Whom was waiting near the station?','Who was waiting near the station?'],['Whom she saw?','Who did she see?']]){
  assert.equal(correctionConflict(original,correctedSentence),undefined);
  const f=parseJudgmentFeedback(JSON.stringify({meaningUsage:'needs_work',grammar:'needs_work',correctedSentence,targetReason:'합성 목표 의견',grammarReason:'합성 문법 의견',correctionReason:'합성 대명사 보완',contextNeeded:'none'}),original,'gpt-6.1-sol',{sentence:original});assert.equal(f.correctedSentence,correctedSentence);
 }
 assert.equal(correctionConflict('Whom called you?','Where did you call?'),'speech_act');
});

test('new semantic contrasts remain symmetric while equivalent minimal agreement/inflection fixes pass',()=>{
 for(const [a,b,reason]of [['The pilot carries two red bags and three blue bags.','The pilot carries three red bags and two blue bags.','quantity'],['The air is -7 degrees.','The air is 7 degrees.','quantity'],['He cannot leave today.','He must leave today.','negation'],['They may leave today.','They must leave today.','time_or_focus'],['He likes tea but does not like coffee.','He does not like tea but likes coffee.','negation'],['She is ready.','Is she ready?','speech_act']]){assert.equal(correctionConflict(a,b),reason);assert.equal(correctionConflict(b,a),reason);}
 for(const [a,b]of [['The two actors was not ready yesterday.','The two actors were not ready yesterday.'],['Did she lent him two tools?','Did she lend him two tools?'],['What she buy yesterday?','What did she buy yesterday?'],['He do not own three cups.','He does not own three cups.']])assert.equal(correctionConflict(a,b),undefined);
});
