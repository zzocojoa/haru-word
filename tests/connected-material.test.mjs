import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { EMPTY, newSession, applyRecord, senseProgress } from '../lib/learning.ts';
await build({ entryPoints: ['lib/study-material-edit.ts', 'lib/learning-commands.ts'], outdir: 'work/connected-material', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { studyMaterialEdit } = await import('../work/connected-material/study-material-edit.mjs');
const { pausedStudyState } = await import('../work/connected-material/learning-commands.mjs');
const material = { meaning: '일하다', expression: 'work with Tom', expressionTranslation: '톰과 일하다', example: 'I work.', translation: '나는 일한다.', source: 'test' };
const word = { id: 'work', word: 'work', headword: 'work', pos: 'v.', level: 'A1', page: 1 };
const original = { ...material, en: 'independent', ko: 'help', sentenceStatus: 'written', studyDates: ['2026-09-21'], sentence: 'Saved sentence.' };

test('unchanged lesson snapshots preserve newer library material and grades', () => {
  const latest = { ...original, expression: 'work at home', expressionTranslation: '집에서 일하다' };
  const edit = studyMaterialEdit(material, material, original, latest);
  assert.deepEqual(edit, { patch: {}, conflicts: [] });
  const state = { ...structuredClone(EMPTY), progress: { work: latest } };
  const s = newSession(state, [word], () => material, 'daily', '2026-09-23');
  const next = applyRecord(state, s, word.id, { material, meaning: material.meaning }, true, '2026-09-23', edit.patch);
  assert.equal(next.progress.work.expression, latest.expression);
  assert.equal(next.progress.work.expressionTranslation, latest.expressionTranslation);
  assert.equal(next.progress.work.ko, 'help');
  assert.deepEqual(next.sessions[s.id].records.work.material, material);
});

test('first study seeds absent material but never pairs an old gloss with a new library expression', () => {
  const edit = studyMaterialEdit(material, material, undefined, undefined);
  assert.equal(edit.patch.expression, material.expression);
  assert.equal(edit.patch.expressionTranslation, material.expressionTranslation);
  const partial = studyMaterialEdit(material, material, undefined, { meaning: material.meaning, expression: 'work abroad' });
  assert.equal(Object.hasOwn(partial.patch, 'expressionTranslation'), false);
  assert.equal(Object.hasOwn(partial.patch, 'expression'), false);
  assert.equal(partial.patch.example, material.example);
});

test('edits merge unrelated fields and reject simultaneous changes to contextual pairs', () => {
  const changed = { ...material, expressionTranslation: '' };
  assert.deepEqual(studyMaterialEdit(changed, material, original, { ...original, notes: 'new' }).patch, { expressionTranslation: '' });
  assert.equal(studyMaterialEdit(changed, material, original, { ...original, expression: 'work abroad' }).conflicts.length, 2);
  assert.equal(studyMaterialEdit({ ...material, example: 'We work.' }, material, original, { ...original, translation: 'new translation' }).conflicts.length, 2);
  assert.deepEqual(studyMaterialEdit(changed, material, original, { ...original, expressionTranslation: '' }).conflicts, []);
});

test('pausing deliberate material edits persists them without recording an assessment', () => {
  const state = { ...structuredClone(EMPTY), progress: { work: original } };
  const s = newSession(state, [word], () => material, 'daily', '2026-09-23');
  const edited = { ...material, expression: 'work here', expressionTranslation: '여기서 일하다' };
  const update = studyMaterialEdit(edited, material, original, original);
  const draft = { ...edited, sentence: '', notes: '', answer: '', spoken: false, hint: false, revealed: false };
  const before = structuredClone(state);
  const next = pausedStudyState(state, s, word.id, draft, edited, '2026-09-23', update.patch);
  assert.equal(senseProgress(next.progress.work, material.meaning).expression, edited.expression);
  assert.deepEqual(next.progress.work.studyDates, original.studyDates);
  assert.equal(next.progress.work.ko, original.ko);
  assert.equal(next.sessions[s.id].records.work.learnedOn, undefined);
  assert.deepEqual(next.sessions[s.id].records.work.material, edited);
  assert.deepEqual(state, before);
});
