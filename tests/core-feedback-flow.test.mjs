import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJudgmentFeedback } from '../lib/judgment-feedback-contract.ts';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';

const wire = overrides => ({ meaningUsage: 'appropriate', grammar: 'needs_work', correctedSentence: '',
  targetReason: '검증용 목표 판단', grammarReason: '검증용 미완성 판단', correctionReason: '', contextNeeded: 'message', ...overrides });
const parse = (sentence, overrides = {}, contextKind = 'sentence') => parseJudgmentFeedback(
  JSON.stringify(wire(overrides)), sentence, 'gpt-6.1-sol', { sentence, contextKind });

test('known incompleteness does not erase an independent target judgment or invent a correction', () => {
  for (const sentence of [
    'Unusually slowly near the landing',
    'Every spare gasket in the drawer',
    'Since the inspector had locked the storage cabinet before the volunteers reached the hall',
    'While the staff were checking the receipts from the weekend sale in the back office',
  ]) {
    const feedback = parse(sentence);
    assert.deepEqual([feedback.meaningUsage, feedback.grammar, feedback.correctedSentence], ['appropriate', 'needs_work', '']);
    assert.match(feedback.explanation, /문법에 보완이 필요.*교정문을 보류/);
    assert.match(feedback.explanation, /추가 문맥:/);
    assert.doesNotMatch(feedback.explanation, /아래의 원문과 교정문을 비교/);
    assert.deepEqual(sentenceFeedbackSchema.parse(JSON.parse(JSON.stringify(feedback))), feedback);
  }
  assert.equal(parse('Every spare gaskets in the drawer', { meaningUsage: 'needs_work' }).meaningUsage, 'needs_work');
  assert.equal(parse('Several faded postcards', { meaningUsage: 'uncertain' }).meaningUsage, 'uncertain');
});

test('a single complete correction and an unchanged grammatical original still use the ordinary contract', () => {
  const original = 'Two luggage block aisle.';
  const correctedSentence = 'Two items of luggage block the aisle.';
  assert.equal(parse(original, { correctedSentence, correctionReason: '검증용 문법 보완', contextNeeded: 'none' }).correctedSentence, correctedSentence);
  assert.equal(parse('Every spare gasket is in the drawer.', {
    grammar: 'natural', correctedSentence: 'Every spare gasket is in the drawer.', contextNeeded: 'none',
  }).grammar, 'natural');
});

test('target uncertainty and explicit expression forms preserve grammar judgments and independent repair choices', () => {
  const held = parse('They is ready.', { contextNeeded: 'target_meaning', meaningUsage: 'uncertain' });
  assert.equal(held.grammar, 'needs_work');
  assert.equal(held.correctedSentence, '');
  assert.match(held.explanation, /추가 문맥:/);
  assert.equal(parse('They is ready.', { contextNeeded: 'target_meaning', meaningUsage: 'uncertain',
    correctedSentence: 'They are ready.', correctionReason: '검증용 수 일치 보완' }).correctedSentence, 'They are ready.');
  assert.throws(() => parse('They is ready.', { contextNeeded: 'none' }),
    error => error.judgmentReason === 'needs_work_missing_correction');
  for (const contextKind of ['reply', 'title', 'command']) {
    const withheld = parse('Several faded postcards', {}, contextKind);
    assert.equal(withheld.grammar, 'needs_work');
    assert.equal(withheld.correctedSentence, '');
    assert.match(withheld.explanation, /선택한 표현 형식/);
    const original = 'Several faded postcards';
    assert.equal(parse(original, { grammar: 'natural', correctedSentence: original, contextNeeded: 'none' }, contextKind).grammar, 'natural');
  }
});
