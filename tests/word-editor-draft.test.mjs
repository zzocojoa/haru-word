import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({ entryPoints: ['lib/word-editor-draft.ts', 'lib/learning-commands.ts'], outdir: 'work/word-editor-tests',
  outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { createWordEditorDraft: create, selectWordEditorDraft: select, editWordEditorDraft: edit,
  wordSenseDraft: sense, changedWordSenseKeys: changed, wordEditorDraftIssue: issue } = await import('../work/word-editor-tests/word-editor-draft.mjs');
const { editedWordDraftsProgress: apply } = await import('../work/word-editor-tests/learning-commands.mjs');
const first = () => sense({ meaning: '일하다', expression: 'work at home', expressionTranslation: '집에서 일하다', example: 'I work.', notes: '메모' });
const common = { familiarity: 'known', familiarityTouched: false, useful: true, encounters: [] };
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

test('per-sense drafts retain all text and dirty state across existing/new transitions without mutation', () => {
  const original = freeze(create('일하다', first()));
  let d = edit(original, 'expression', 'work outside');
  d = edit(d, 'expressionTranslation', '밖에서 일하다');
  d = select(d, '', sense()); d = edit(d, 'meaning', '작동하다'); d = edit(d, 'notes', '새 메모');
  d = select(d, '일하다', first());
  assert.equal(d.senses[d.selected].value.expressionTranslation, '밖에서 일하다');
  d = select(d, '', sense()); assert.equal(d.senses[''].value.meaning, '작동하다');
  assert.equal(d.senses[''].value.notes, '새 메모'); assert.deepEqual(changed(d), ['일하다', '']);
  assert.deepEqual(original.senses['일하다'].value, first());
});

test('trim-only edits retain translation, real context changes clear it, and cached special keys are safe', () => {
  let d = create('constructor', first());
  d = edit(d, 'expression', ' work at home '); assert.equal(d.senses.constructor.value.expressionTranslation, '집에서 일하다');
  d = edit(d, 'expression', 'work away'); assert.equal(d.senses.constructor.value.expressionTranslation, '');
  d = select(d, '__proto__', sense({ meaning: '다른 뜻', expression: '', expressionTranslation: '' }));
  assert.equal(d.senses.__proto__.value.meaning, '다른 뜻');
});

test('hidden incomplete or duplicate drafts block save; untouched blank drafts do not', () => {
  let d = select(create('일하다', first()), '', sense());
  assert.equal(issue(d, ['일하다']), 'empty');
  d = select(d, '일하다', first()); assert.equal(issue(d, ['일하다']), null);
  d = select(d, '', sense()); d = edit(d, 'example', 'New.'); d = select(d, '일하다', first());
  assert.equal(issue(d, ['일하다']), 'empty');
  d = select(d, '', sense()); d = edit(d, 'meaning', ' 일하다 '); d = select(d, '일하다', first());
  assert.equal(issue(d, ['일하다']), 'duplicate');
  d = select(d, '', sense()); d = edit(d, 'meaning', '다른 뜻');
  assert.equal(issue(d, Array.from({ length: 100 }, (_, i) => '뜻' + i)), 'limit');
  assert.equal(issue(d, ['일하다']), null);
});

test('one save includes all changed senses and preserves grades, dates, metadata and selected sense', () => {
  const base = freeze({ ...first(), en: 'independent', ko: 'help', sentence: 'Mine.', sentenceStatus: 'written',
    studyDates: ['2026-09-22'], lastStudied: '2026-09-22', familiarity: 'known',
    senses: { '작동하다': { meaning: '작동하다', en: 'help', ko: 'independent', studyDates: ['2026-09-23'], sentence: 'It works.' } } });
  let d = edit(create('일하다', first()), 'notes', '수정한 메모');
  d = select(d, '작동하다', sense({ meaning: '작동하다', expression: 'It works.' }));
  d = edit(d, 'expressionTranslation', '작동한다');
  d = select(d, '', sense()); d = edit(d, 'meaning', ' 새 용법 '); d = edit(d, 'expression', 'new use');
  d = select(d, '일하다', first()); freeze(d);
  const next = apply(base, d, common);
  assert.equal(next.meaning, '일하다'); assert.equal(next.notes, '수정한 메모');
  assert.equal(next.ko, 'help'); assert.equal(next.sentence, 'Mine.');
  assert.equal(next.senses['작동하다'].en, 'help'); assert.equal(next.senses['작동하다'].expressionTranslation, '작동한다');
  assert.deepEqual(next.senses['작동하다'].studyDates, ['2026-09-23']);
  assert.equal(next.senses['새 용법'].en, 'unmeasured'); assert.equal(next.senses['새 용법'].needsReview, true);
  assert.deepEqual(next.senses['새 용법'].studyDates, []); assert.equal(base.notes, '메모');
  assert.equal(next.familiarity, 'known'); assert.equal(next.useful, true);
});

test('untouched blank draft is not persisted and retry produces the same complete payload', () => {
  const base = freeze({ ...first(), en: 'independent', ko: 'independent' });
  let d = select(create('일하다', first()), '', sense()); d = select(d, '일하다', first());
  const next = apply(base, d, common);
  assert.deepEqual(Object.keys(next.senses), ['일하다']); assert.equal(next.en, 'independent');
  assert.deepEqual(apply(base, d, common), next);
});
