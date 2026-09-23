import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolveCardContent, withExpressionTranslation } from '../lib/content.ts';
import { editExpression, expressionDraft } from '../lib/expression.ts';
import { restoreStudyDraft, studyMaterial, hasStudyDraftInput } from '../lib/study-draft.ts';
import { EMPTY, newSession, applyRecord, senseProgress, selectSense, repeatDailySession } from '../lib/learning.ts';

mkdirSync('work/expression-tests', { recursive: true });
for (const name of ['catalog', 'validation', 'backup']) {
  await build({ entryPoints: [`lib/${name}.ts`], outfile: `work/expression-tests/${name}.mjs`, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
}
const { WORDS, studyContent } = await import('../work/expression-tests/catalog.mjs');
const { saveSchema, progressSchema } = await import('../work/expression-tests/validation.mjs');
const { makeBackup, parseBackup } = await import('../work/expression-tests/backup.mjs');
const base = { meaning: '도착하다', expression: 'arrive home', expressionTranslation: '집에 도착하다', example: 'I arrive home at seven.', translation: '나는 일곱 시에 집에 도착한다.', source: '학습용 작성 예문' };
const word = WORDS.find(w => w.word === 'arrive' && w.pos === 'v.');
const legacy = () => { const { expressionTranslation, ...rest } = base; return rest; };

test('phrase editing clears changed contexts atomically, preserves whitespace edits and never mutates its input', () => {
  const draft = Object.freeze({ ...expressionDraft(base), answer: 'keep my answer' });
  for (const [field, value] of [['meaning', '다다르다'], ['expression', 'arrive at school']]) {
    const next = editExpression(draft, field, value);
    assert.deepEqual(next, { ...draft, [field]: value, expressionTranslation: '' });
    assert.equal(draft.expressionTranslation, base.expressionTranslation);
  }
  for (const field of ['meaning', 'expression']) {
    assert.equal(editExpression(draft, field, ` ${draft[field]} `).expressionTranslation, base.expressionTranslation);
    assert.equal(editExpression(draft, field, draft[field]), draft);
    assert.equal(editExpression(draft, field, '').expressionTranslation, '');
  }
  assert.deepEqual(editExpression(draft, 'expressionTranslation', '집으로 도착하다'), { ...draft, expressionTranslation: '집으로 도착하다' });
  assert.equal(editExpression(draft, 'expressionTranslation', '').expressionTranslation, '');
});

test('phrase initialization restores all context fields together and preserves explicit blank glosses', () => {
  assert.deepEqual(expressionDraft(), { meaning: '', expression: '', expressionTranslation: '' });
  assert.equal(expressionDraft(legacy()).expressionTranslation, '');
  assert.deepEqual(expressionDraft({ ...base, expressionTranslation: '' }), { meaning: base.meaning, expression: base.expression, expressionTranslation: '' });
  assert.deepEqual(expressionDraft(base), { meaning: base.meaning, expression: base.expression, expressionTranslation: base.expressionTranslation });
});

test('matching glosses respect candidate order, explicit blank and no-op identity', () => {
  const old = Object.freeze(legacy());
  const wrong = { ...base, meaning: '다른 뜻', expressionTranslation: '무관한 해석' };
  const preferred = { ...base, expressionTranslation: '저장된 해석' };
  assert.equal(withExpressionTranslation(old, undefined, wrong, preferred, base).expressionTranslation, '저장된 해석');
  assert.equal(withExpressionTranslation(old, { ...preferred, expressionTranslation: '' }, base).expressionTranslation, '');
  assert.equal(withExpressionTranslation(old, { ...preferred, expression: 'ARRIVE HOME' }), old);
  assert.equal(withExpressionTranslation(base, preferred), base);
  assert.equal(resolveCardContent(base), base);
});

test('material, progress and sense schemas keep strictness, requiredness and the same optional gloss boundary', () => {
  const s = newSession(structuredClone(EMPTY), [word], () => base, 'daily', '2026-09-23');
  s.records[word.id].material = { ...base };
  const payload = { revision: 0, progress: { [word.id]: { ...base, senses: { [base.meaning]: { expressionTranslation: '' } } } }, sessions: { [s.id]: s } };
  // source is material-only, not a progress field.
  delete payload.progress[word.id].source;
  const targets = [p => p.progress[word.id], p => p.progress[word.id].senses[base.meaning], p => p.sessions[s.id].records[word.id].material];
  for (const target of targets) {
    for (const value of [undefined, '', '가'.repeat(2000)]) {
      const copy = structuredClone(payload); target(copy).expressionTranslation = value;
      assert.equal(saveSchema.safeParse(copy).success, true);
    }
    for (const value of [null, 7, '가'.repeat(2001)]) {
      const copy = structuredClone(payload); target(copy).expressionTranslation = value;
      assert.equal(saveSchema.safeParse(copy).success, false);
    }
    const unknown = structuredClone(payload); target(unknown).unexpected = 'reject';
    assert.equal(saveSchema.safeParse(unknown).success, false);
  }
  for (const field of ['meaning', 'expression', 'example', 'translation', 'source']) {
    const copy = structuredClone(payload); delete copy.sessions[s.id].records[word.id].material[field];
    assert.equal(saveSchema.safeParse(copy).success, false, field);
  }
  assert.equal(progressSchema.safeParse({ senses: { '선택한 뜻': {} } }).success, true);
});

test('all 3809 authored phrase glosses are bound to their exact catalog phrase and sense', () => {
  const glosses = JSON.parse(readFileSync('data/expression-translations.json', 'utf8'));
  const catalog = JSON.parse(readFileSync('data/content.json', 'utf8'));
  assert.equal(Object.keys(glosses).length, 3809);
  for (const [id, gloss] of Object.entries(glosses)) {
    assert.equal(gloss.meaning, catalog[id].meaning, id);
    assert.equal(gloss.expression, catalog[id].expression, id);
    assert.equal(gloss.expressionTranslation, catalog[id].expressionTranslation, id);
    assert.match(gloss.expressionTranslation, /[가-힣]/, id);
    assert.ok(gloss.expressionTranslation.length <= 2000, id);
  }
  const find = (term, pos) => glosses[WORDS.find(w => w.word === term && w.pos === pos).id].expressionTranslation;
  assert.equal(find('arrive', 'v.'), '집에 도착하다');
  assert.equal(find('busy', 'adj.'), '바쁘다');
  assert.equal(find('breakfast', 'n.'), '아침을 먹다');
  assert.equal(find('camp', 'n.'), '여름 캠프');
  assert.equal(find('camp', 'v.'), '호숫가에서 야영하다');
});

test('legacy phrase glosses inherit only an exact expression and sense; explicit blank is preserved', () => {
  assert.equal(resolveCardContent(base).expressionTranslation, base.expressionTranslation);
  assert.equal(resolveCardContent(base, { meaning: ' 도착하다 ', expression: ' arrive home ' }).expressionTranslation, base.expressionTranslation);
  for (const change of [{ expression: 'arrive at school' }, { expression: '' }, { meaning: '성공하다' }]) {
    assert.equal(resolveCardContent(base, change).expressionTranslation, undefined);
  }
  assert.equal(resolveCardContent(base, { expressionTranslation: '' }).expressionTranslation, '');
  assert.equal(resolveCardContent(base, { expression: 'arrive at school', expressionTranslation: '학교에 도착하다' }).expressionTranslation, '학교에 도착하다');
});

test('backfilling is read-only and preserves historical examples and explicit custom translations', () => {
  const old = Object.freeze(legacy());
  const next = withExpressionTranslation(old, base);
  assert.deepEqual(next, base); assert.equal(old.expressionTranslation, undefined);
  assert.equal(withExpressionTranslation(old, { ...base, meaning: '성공하다' }), old);
  assert.equal(withExpressionTranslation({ ...old, expressionTranslation: '' }, base).expressionTranslation, '');
  const record = { meaning: base.meaning, material: old, en: 'independent', ko: 'help', sentenceStatus: 'improve', sentence: 'Mine.', notes: 'Keep.' };
  const p = { ...base, expressionTranslation: '집으로 도착하다' };
  const result = studyContent(word.id, record, p);
  assert.equal(result.expressionTranslation, p.expressionTranslation);
  assert.equal(result.example, old.example); assert.equal(result.translation, old.translation);
  assert.equal(record.material, old); assert.equal(record.ko, 'help');
  assert.equal(studyContent(word.id, { ...record, meaning: '다른 뜻' }, p), old);
});

test('phrase translations survive learning, per-sense projection, repetition, API validation and backup', () => {
  const state = structuredClone(EMPTY); state.settings.dailyGoal = 1;
  const s = newSession(state, [word], () => base, 'daily', '2026-09-23');
  state.sessions[s.id] = s;
  const draft = restoreStudyDraft(s, word.id, base);
  assert.equal(draft.expressionTranslation, base.expressionTranslation);
  assert.equal(hasStudyDraftInput(draft, 'learn', base), false);
  assert.equal(hasStudyDraftInput({ ...draft, expressionTranslation: '수정한 해석' }, 'learn', base), true);
  const material = studyMaterial(draft, base, false);
  const next = applyRecord(state, s, word.id, { meaning: draft.meaning, material }, true, '2026-09-23');
  assert.equal(senseProgress(next.progress[word.id], base.meaning).expressionTranslation, base.expressionTranslation);
  const different = selectSense(next.progress[word.id], { meaning: '성공하다', expression: 'arrive at success', expressionTranslation: '성공에 이르다' });
  assert.equal(senseProgress(different, base.meaning).expressionTranslation, base.expressionTranslation);
  assert.equal(senseProgress(different, '성공하다').expressionTranslation, '성공에 이르다');
  const payload = { revision: 0, settings: next.settings, progress: next.progress, sessions: next.sessions };
  assert.equal(saveSchema.safeParse(payload).success, true);
  const restored = parseBackup(JSON.stringify(makeBackup(next))).state;
  assert.equal(restored.sessions[s.id].records[word.id].material.expressionTranslation, base.expressionTranslation);
  assert.equal(restored.progress[word.id].expressionTranslation, base.expressionTranslation);
  Object.assign(restored.sessions[s.id], { stage: 'done', finished: true, paused: true });
  const repeat = repeatDailySession(restored, [word], '2026-09-23');
  assert.equal(repeat.records[word.id].material.expressionTranslation, base.expressionTranslation);
  const old = structuredClone(payload);
  delete old.sessions[s.id].records[word.id].material.expressionTranslation;
  delete old.progress[word.id].expressionTranslation;
  for (const sense of Object.values(old.progress[word.id].senses)) delete sense.expressionTranslation;
  assert.equal(saveSchema.safeParse(old).success, true);
  assert.equal(parseBackup(JSON.stringify(makeBackup({ settings: old.settings, sessions: old.sessions, progress: old.progress }))).state.progress[word.id].expressionTranslation, undefined);
  payload.progress[word.id].expressionTranslation = '가'.repeat(2001);
  assert.equal(saveSchema.safeParse(payload).success, false);
});
