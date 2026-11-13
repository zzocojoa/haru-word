import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEWED_IRREGULAR_FORMS, REVIEWED_IRREGULAR_NOUN_FORMS, sameInflectedWord, auxiliaryWordForm } from '../lib/feedback-word-forms.ts';
import { correctionConflict, parseJudgmentFeedback } from '../lib/judgment-feedback-contract.ts';

test('reviewed irregular families allow minimal base-form repairs in either direction', () => {
  for (const group of REVIEWED_IRREGULAR_FORMS) {
    const [base,...forms] = group.split(' ');
    for (const form of forms) {
      assert.ok(sameInflectedWord(base,form),`${base}/${form}`);
      assert.ok(sameInflectedWord(form,base),`${form}/${base}`);
    }
  }
  for (const [from,to] of [['lent','lend'],['paid','pay'],['said','say'],['chose','choose'],['drove','drive'],['began','begin']]) {
    assert.equal(correctionConflict(`They didn't ${from} it.`,`They didn't ${to} it.`),undefined);
  }
});

test('ambiguous spelling retains each direct family without merging distinct roots', () => {
  for (const pair of [['lay','laid'],['lay','lain'],['found','founded'],['found','find']]) assert.ok(sameInflectedWord(...pair));
  for (const pair of [['laid','lain'],['founded','find'],['lend','borrow']]) assert.equal(sameInflectedWord(...pair),false);
});

test('irregular noun plurals pass the real correction parser without weakening content or quantity guards', () => {
  for (const pair of REVIEWED_IRREGULAR_NOUN_FORMS) {
    const [singular, plural] = pair.split(' ');
    assert.equal(sameInflectedWord(singular, plural), true, pair);
    assert.equal(sameInflectedWord(plural, singular), true, pair);
    assert.equal(correctionConflict(`Two ${singular} is waiting.`, `Two ${plural} are waiting.`), undefined, pair);
  }
  const original='Two child is waiting.',correctedSentence='Two children are waiting.';
  const wire={meaningUsage:'needs_work',grammar:'needs_work',correctedSentence,targetReason:'합성 명사 복수형 판단',grammarReason:'합성 복수형과 수 일치 보완',correctionReason:'합성 교정',contextNeeded:'none'};
  assert.equal(parseJudgmentFeedback(JSON.stringify(wire),original,'gpt-6.1-sol').correctedSentence,correctedSentence);
  for(const pair of [['child','people'],['man','women'],['children','childed'],['mice','mouseing']])assert.equal(sameInflectedWord(...pair),false,pair.join('/'));
  assert.ok(correctionConflict(original,'Three children are waiting.'));
  assert.ok(correctionConflict('A child is waiting.','A woman is waiting.'));
  assert.ok(correctionConflict('The children did not leave.','The children left.'));
});

test('the strict provider parser accepts lending repair while retaining meaning guards', () => {
  const original="They didn't lent us any tools.",correctedSentence="They didn't lend us any tools.";
  const wire={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence,targetReason:'lend의 뜻이 분명해요.',grammarReason:'did 뒤에는 동사원형을 써요.',correctionReason:'lent를 lend로 바꿨어요.',contextNeeded:'none'};
  assert.equal(parseJudgmentFeedback(JSON.stringify(wire),original,'gpt-6.1-sol').correctedSentence,correctedSentence);
  assert.equal(correctionConflict(original,"They didn't borrow us any tools."),'content_change');
  assert.equal(correctionConflict('They lent us tools.','We lent them tools.'),'participants');
  assert.equal(correctionConflict('They can lend tools.','They must lend tools.'),'time_or_focus');
  assert.equal(correctionConflict('They were ready.','They are ready.'),'time_or_focus');
  assert.equal(correctionConflict('They are do the work.','They are doing the work.'),undefined);
});

test('auxiliary filtering uses exact forms and never drops similar content words', () => {
  for (const word of ['do','doing','have','having','be','been']) assert.ok(auxiliaryWordForm(word));
  for (const word of ['bed','bes','dodo','doeskin','haves','behave']) assert.equal(auxiliaryWordForm(word),false,word);
  assert.equal(correctionConflict('They bed the plants.','They do the plants.'),'content_change');
  assert.equal(correctionConflict('They have a bed.','They have a chair.'),'content_change');
});
