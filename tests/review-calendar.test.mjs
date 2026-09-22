import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, emptyRecord, reviewWeeks, reviewTargets, practiceIds } from '../lib/learning.ts';
function session(id, date, records, kind = 'daily', createdAt = date + 'T00:00:00Z') {
  return { id, kind, date, period: date, createdAt, records, ids: Object.keys(records) };
}
const record = (entryId, meaning, learnedOn, example = '') => ({ ...emptyRecord(meaning), entryId, learnedOn, material: { meaning, example } });

test('review periods preserve cross-week learning dates, historical reviews and selected empty periods', () => {
  const state = structuredClone(EMPTY);
  state.sessions = {
    a: session('a', '2026-09-20', { a: record('word', '뜻', '2026-09-21'), b: record('word2', '다른 뜻', '2026-09-21') }),
    b: session('b', '2026-09-20', { a: record('word', '뜻', '2026-09-21') }),
    weekly: session('weekly', '2026-08-31', {}, 'weekly'),
    practice: session('practice', '2020-01-01', { a: record('word', '뜻', '2020-02-01') }, 'practice'),
  };
  const before = structuredClone(state);
  assert.deepEqual(reviewWeeks(state, '2026-09-22', '2026-10-05'), ['2026-10-05', '2026-09-21', '2026-09-14', '2026-08-31']);
  assert.deepEqual(state, before);
});

test('review target optimization preserves meaning identity, latest material, allocation date and actual learning date', () => {
  const state = structuredClone(EMPTY);
  state.sessions = {
    late: session('late', '2026-09-21', { a: record('word', '도착하다', '2026-10-01', 'new') }),
    early: session('early', '2026-09-20', { a: record('word', '도착하다', '2026-09-21', 'old'), b: record('word', '결론에 이르다', '2026-09-21', 'other sense') }),
  };
  const before = structuredClone(state);
  const week = reviewTargets(state, 'weekly', '2026-09-21');
  assert.equal(week.length, 2);assert.equal(week.find(t => t.meaning === '도착하다').material.example, 'new');
  assert.equal(reviewTargets(state, 'weekly', '2026-09-14').find(t => t.meaning === '도착하다').material.example, 'old');
  assert.equal(reviewTargets(state, 'weekly', '2026-09-28')[0].material.example, 'new');
  assert.equal(reviewTargets(state, 'monthly', '2026-09').find(t => t.meaning === '도착하다').material.example, 'old');
  assert.equal(reviewTargets(state, 'monthly', '2026-10')[0].material.example, 'new');
  assert.deepEqual(state, before);
});

test('focused practice keeps oldest review first, deterministic ties and the twenty-word cap', () => {
  const state = structuredClone(EMPTY);
  for (let i = 25; i >= 0; i--) state.progress['word-' + String(i).padStart(2, '0')] = { familiarity: 'known', lastReviewed: '2026-09-22' };
  state.progress['word-25'].lastReviewed = '2026-09-01';
  const before = structuredClone(state);
  assert.deepEqual(practiceIds(state, 'known'), ['word-25', ...Array.from({length:19}, (_,i) => 'word-' + String(i).padStart(2, '0'))]);
  assert.deepEqual(state, before);
});
