import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCorrection, canConfirmCorrection, canUndoCorrection } from '../lib/feedback-correction.ts';
import { sentenceFeedbackPresentation } from '../lib/sentence-feedback-presentation.ts';
const feedback = { original: 'She sing well.', correctedSentence: 'She sings well.', meaningUsage: 'appropriate', grammar: 'needs_work', explanation: '합성 설명',
  model: 'gpt-6.1-sol', provider: 'openai', requestedModel: 'gpt-6.1-sol', promptVersion: 'reference-v2', validationVersion: 'judgment-v2', createdAt: '2026-11-03T00:00:00.000Z' };

test('a comparison preserves the current unsaved input separately from the older AI sentence', () => {
  const current = 'My newly edited sentence.', before = JSON.stringify(feedback), comparison = compareCorrection(current, feedback);
  assert.equal(comparison.before, current); assert.equal(comparison.after, feedback.correctedSentence);
  assert.notEqual(comparison.before, feedback.original); assert.equal(canConfirmCorrection(current, feedback, comparison), true);
  assert.equal(JSON.stringify(feedback), before);
});

test('any edit after opening comparison invalidates its explicit confirmation', () => {
  const current = 'My newer draft.', comparison = compareCorrection(current, feedback);
  for (const changed of [current + ' ', '', 'A completely different sentence.']) assert.equal(canConfirmCorrection(changed, feedback, comparison), false);
  const refreshed = compareCorrection('A completely different sentence.', feedback);
  assert.equal(canConfirmCorrection('A completely different sentence.', feedback, refreshed), true);
});

test('a later model response cannot reuse confirmation of an older proposal', () => {
  const current = 'My newer draft.', comparison = compareCorrection(current, feedback);
  for (const changed of [{ ...feedback, correctedSentence: 'Another proposal.' }, { ...feedback, original: current },
    { ...feedback, createdAt: '2026-11-03T00:00:01.000Z' }, { ...feedback, model: 'gpt-6-astra' }, { ...feedback, validationVersion: 'judgment-v3' }]) {
    assert.equal(canConfirmCorrection(current, changed, comparison), false);
  }
});

test('undo restores only the last applied text and cannot overwrite edits made afterwards', () => {
  const undo = { before: 'The unsaved draft before applying.', after: feedback.correctedSentence };
  assert.equal(canUndoCorrection(feedback.correctedSentence, undo), true);
  assert.equal(canUndoCorrection('New edit after applying.', undo), false); assert.equal(canUndoCorrection('', undo), false);
  assert.equal(undo.before, 'The unsaved draft before applying.');
});

test('same-sentence recheck stays explicit and enabled for normal, uncertain and historical results', () => {
  for (const grammar of ['natural', 'needs_work', 'uncertain']) for (const model of ['gpt-6.1-sol', 'gemini-3.1-flash-lite', 'unrecognized-historical-model']) {
    const f = { ...feedback, model, grammar, ...(grammar === 'uncertain' ? { correctedSentence: '' } : {}) };
    const view = sentenceFeedbackPresentation({ sentence: f.original, feedback: f, busy: false, pending: false });
    assert.equal(view.action, 'retryAnalysis'); assert.equal(view.disabled, false); assert.match(view.label, /다시 요청/);
  }
});

test('busy, pending and empty input keep all recheck buttons disabled without changing stored feedback', () => {
  const before = JSON.stringify(feedback);
  for (const input of [{sentence:feedback.original,busy:true,pending:false},{sentence:feedback.original,busy:false,pending:true},{sentence:'  ',busy:false,pending:false}]) {
    assert.equal(sentenceFeedbackPresentation({...input,feedback}).disabled,true);
  }
  assert.equal(JSON.stringify(feedback),before);
});
