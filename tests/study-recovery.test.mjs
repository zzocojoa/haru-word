import test from 'node:test';
import assert from 'node:assert/strict';
import { studyRecoveryState } from '../lib/study-recovery.ts';
import { restoreStudyDraft } from '../lib/study-draft.ts';

const material = { meaning: '책', expression: 'read a book', expressionTranslation: '책을 읽다', example: 'I read a book.', translation: '나는 책을 읽는다.', source: '학습용 작성 예문' };
function fixture(stage) {
  const record = { meaning: '책', material, en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: 'Old sentence.', notes: 'Old note', enAnswer: '책', hintKo: true, learnedOn: '2026-09-29' };
  const session = { id: 'session', stage, index: 1, ids: ['a', 'b'], warmupIds: ['a', 'b'], records: { a: { ...record }, b: { ...record } }, retry: [], retryMode: false, elapsed: 12, finished: false, paused: false };
  const state = { settings: { activeSessionId: session.id }, progress: { b: { meaning: '책', en: 'independent', needsReview: true } }, sessions: { [session.id]: session }, grammar: { noun: { sentence: 'Unrelated grammar draft.' } } };
  return { session, state, draft: restoreStudyDraft(session, 'b', material) };
}
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function preserved(before, after) {
  assert.equal(after.progress, before.progress);
  assert.equal(after.settings, before.settings);
  assert.equal(after.grammar, before.grammar);
  const originalRecords = before.sessions.session.records, nextRecords = after.sessions.session.records;
  const metadata = session => Object.fromEntries(Object.entries(session).filter(([key]) => !['records', 'warmupDraft'].includes(key)));
  const original = metadata(before.sessions.session), next = metadata(after.sessions.session);
  assert.deepEqual(next, original);
  assert.equal(nextRecords.a, originalRecords.a);
  for (const key of ['meaning', 'en', 'ko', 'sentenceStatus', 'enAnswer', 'hintKo', 'learnedOn']) assert.equal(nextRecords.b[key], originalRecords.b[key]);
}

test('sentence recovery preserves exact latest input, including clearing, without submitting or mutating state', () => {
  for (const sentence of ['  My new sentence.  ', '']) {
    const { session, state, draft } = fixture('sentence'); freeze(state);
    const edited = { ...draft, sentence, notes: '', spoken: true };
    const next = studyRecoveryState(state, session, edited);
    assert.deepEqual(restoreStudyDraft(next.sessions.session, 'b', material), edited);
    preserved(state, next);
    assert.equal(state.sessions.session.records.b.sentence, 'Old sentence.');
  }
});

test('learn recovery preserves every material field and blank meaning without changing the committed meaning or scores', () => {
  for (const meaning of ['  새로 쓴 뜻  ', '']) {
    const { session, state, draft } = fixture('learn'); freeze(state);
    const edited = { ...draft, meaning, expression: 'new expression', expressionTranslation: '', example: 'New example.', translation: '새 예문.' };
    const editedMaterial = Object.fromEntries(Object.keys(material).map(key => [key, edited[key] ?? material[key]]));
    const next = studyRecoveryState(state, session, edited, editedMaterial);
    const savedMaterial = next.sessions.session.records.b.material;
    assert.equal(savedMaterial.meaning, meaning);
    assert.deepEqual(restoreStudyDraft(next.sessions.session, 'b', savedMaterial), edited);
    preserved(state, next);
  }
});

test('warmup, directional recall and retries recover hints and exact answers without grading', () => {
  for (const stage of ['warmup', 'en', 'ko']) for (const retryMode of [false, true]) {
    const { session, state, draft } = fixture(stage);
    if (retryMode) { session.retryMode = true; session.retry = [{ id: 'b', direction: stage === 'ko' ? 'ko' : 'en', seen: ['a'] }]; }
    freeze(state);
    const edited = { ...draft, answer: '  아직 채점하지 않은 답  ', hint: true, revealed: true };
    const next = studyRecoveryState(state, session, edited);
    assert.deepEqual(restoreStudyDraft(next.sessions.session, 'b', material), edited);
    preserved(state, next);
  }
});

test('stale cards, changed directions, finished or missing sessions cannot receive a recovery draft', () => {
  const { session, state, draft } = fixture('sentence');
  for (const changed of [undefined, { ...session, index: 0 }, { ...session, stage: 'en' }, { ...session, stage: 'checkpoint' }, { ...session, finished: true, stage: 'done' }, { ...session, retryMode: true, retry: [{ id: 'a', direction: 'en' }] }]) {
    const latest = freeze({ ...state, sessions: changed ? { session: changed } : {} });
    assert.equal(studyRecoveryState(latest, session, draft), latest);
  }
});
