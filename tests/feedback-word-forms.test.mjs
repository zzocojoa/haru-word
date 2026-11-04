import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEWED_IRREGULAR_FORMS, sameInflectedWord, auxiliaryWordForm } from '../lib/feedback-word-forms.ts';
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
