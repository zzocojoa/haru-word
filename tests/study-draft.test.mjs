import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreStudyDraft, studyQuestionKey, studyMaterial, withAnswerDraft, hasStudyDraftInput } from '../lib/study-draft.ts';
import { canGradeIndependently, independentRecallBlocks, isLearningWriteBlocked, learningWriteBlocks } from '../lib/study-availability.ts';

const content = { meaning: '뜻', expression: 'my expression', example: 'Example.', translation: '예문.', source: '학습용 작성 예문', attribution: 'original', url: 'https://example.test/' };
const record = { meaning: '뜻', en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: 'My sentence.', notes: '메모', spoken: true };
const session = (stage = 'en') => ({ id: 'session', ids: ['a', 'b'], index: 0, stage, retryMode: false, records: { a: { ...record }, b: { ...record } } });
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

test('question identity separates sessions, targets, directions and retry mode but ignores saves and timers', () => {
  const s = session(), key = studyQuestionKey(s, 'a');
  for (const [other, id] of [[{ ...s, id: 'other' }, 'a'], [s, 'b'], [{ ...s, stage: 'ko' }, 'a'], [{ ...s, retryMode: true }, 'a']]) assert.notEqual(studyQuestionKey(other, id), key);
  assert.equal(studyQuestionKey({ ...s, elapsed: 25, paused: true, records: structuredClone(s.records) }, 'a'), key);
});

test('initial drafts copy materials and sentence notes without inventing a recall answer or result', () => {
  const s = freeze(session()), before = structuredClone(s), draft = restoreStudyDraft(s, 'a', content);
  assert.deepEqual(draft, { meaning: '뜻', expression: 'my expression', expressionTranslation: '', example: 'Example.', translation: '예문.', answer: '', hint: false, revealed: false, sentence: 'My sentence.', notes: '메모', spoken: true });
  assert.deepEqual(s, before);
  const absent = restoreStudyDraft(s, undefined);
  assert.equal(absent.meaning, ''); assert.equal(absent.answer, ''); assert.equal(absent.revealed, false);
});

test('recall restores only the matching target, direction and retry snapshot', () => {
  const s = session(); s.records.a.draft = { answer: '저장한 답', hinted: true, revealed: true, stage: 'en', retry: false };
  assert.equal(restoreStudyDraft(s, 'a', content).answer, '저장한 답');
  for (const [other, id] of [[s, 'b'], [{ ...s, stage: 'ko' }, 'a'], [{ ...s, retryMode: true }, 'a']]) {
    const d = restoreStudyDraft(other, id, content); assert.equal(d.answer, ''); assert.equal(d.hint, false); assert.equal(d.revealed, false);
  }
});

test('warmup only restores its current word and cannot take the normal recall snapshot', () => {
  const s = session('warmup'); s.warmupDraft = { id: 'a', answer: '복습 답', hinted: true, revealed: true };
  s.records.a.draft = { answer: '회상 답', hinted: false, revealed: false, stage: 'en', retry: false };
  assert.equal(restoreStudyDraft(s, 'a', content).answer, '복습 답');
  assert.equal(restoreStudyDraft(s, 'b', content).answer, '');
  assert.equal(restoreStudyDraft({ ...s, stage: 'en' }, 'a', content).answer, '회상 답');
});

test('answer snapshots round-trip for warmup, both recall directions and delayed retries without grading', () => {
  for (const stage of ['warmup', 'en', 'ko']) for (const retryMode of [false, true]) {
    const s = freeze({ ...session(stage), retryMode }), before = structuredClone(s);
    const d = { ...restoreStudyDraft(s, 'a', content), answer: '  직접 쓴 답  ', hint: true, revealed: true };
    const next = withAnswerDraft(s, 'a', d);
    assert.deepEqual(restoreStudyDraft(next, 'a', content), d);
    assert.deepEqual(s, before); assert.equal(next.index, s.index); assert.equal(next.stage, s.stage);
    assert.equal(next.records.b, s.records.b);
    for (const field of ['en', 'ko', 'sentenceStatus', 'sentence', 'notes']) assert.equal(next.records.a[field], s.records.a[field]);
    if (stage === 'warmup') assert.equal(next.records, s.records);
  }
});

test('non-recall stages do not allocate or overwrite an answer snapshot', () => {
  for (const stage of ['learn', 'sentence', 'checkpoint', 'done']) {
    const s = freeze(session(stage)); assert.equal(withAnswerDraft(s, 'a', restoreStudyDraft(s, 'a', content)), s);
  }
});

test('material provenance changes only for an edited example or translation', () => {
  const d = restoreStudyDraft(session('learn'), 'a', content);
  const same = studyMaterial({ ...d, meaning: '  뜻  ', expression: 'new expression' }, content, false);
  assert.equal(same.meaning, '뜻'); assert.equal(same.url, content.url); assert.equal(same.attribution, content.attribution);
  for (const personal of [false, true]) {
    const edited = studyMaterial({ ...d, example: 'Changed.' }, content, personal);
    assert.equal(edited.source, personal ? '개인 추가 예문' : '내가 수정한 예문');
    assert.equal(edited.url, undefined); assert.equal(edited.attribution, undefined);
  }
});

test('leave warnings retain existing input and material-change conditions', () => {
  const d = { ...restoreStudyDraft(session(), 'a', content), sentence: '', notes: '' };
  assert.equal(hasStudyDraftInput(d, 'en', content), false);
  for (const field of ['answer', 'sentence', 'notes']) assert.equal(hasStudyDraftInput({ ...d, [field]: 'draft' }, 'en', content), true);
  assert.equal(hasStudyDraftInput({ ...d, meaning: 'edited' }, 'learn', content), true);
  assert.equal(hasStudyDraftInput({ ...d, meaning: 'edited' }, 'en', content), false);
});

test('all write-block combinations preserve the existing predicate, including authentication and clock readiness', () => {
  for (let mask = 0; mask < 64; mask++) {
    const [loading, saving, signedIn, unsaved, conflict, clockReady] = Array.from({ length: 6 }, (_, i) => !!(mask & (1 << i)));
    const status = { loading, saving, signedIn, unsaved, conflict, clockReady };
    assert.equal(isLearningWriteBlocked(status), loading || saving || !signedIn || unsaved || conflict || !clockReady);
    assert.deepEqual(learningWriteBlocks(status), { loading, saving, signedOut: !signedIn, unsaved, conflict, clockUnavailable: !clockReady });
  }
});

test('independent grading requires an answer without hints and no store or AI lock', () => {
  for (const storeBusy of [false, true]) for (const aiPending of [false, true]) for (const hint of [false, true]) for (const answer of ['', ' \n ', 'my answer']) {
    const busy = storeBusy || aiPending;
    assert.equal(canGradeIndependently(busy, hint, answer), !busy && !hint && !!answer.trim());
    assert.deepEqual(independentRecallBlocks(busy, hint, answer), { busy, hinted: hint, emptyAnswer: !answer.trim() });
  }
});
