import test from 'node:test';
import assert from 'node:assert/strict';
import { groupJournalSessions, journalSessionLabel } from '../lib/learning-journal.ts';

const session = (id, date, kind, createdAt, extra = {}) => Object.freeze({
  id, date, kind, createdAt, records: Object.freeze({}), ids: Object.freeze([]), ...extra,
});

test('journal groups all attempts by saved date, including corrected dates, without changing sessions', () => {
  const first = session('first', '2026-09-22', 'daily', '2026-09-22T00:00:00Z');
  const topup = session('topup', '2026-09-22', 'daily', '2026-09-22T01:00:00Z');
  const repeat = session('repeat', '2026-09-22', 'practice', '2026-09-22T02:00:00Z', { practiceMode: 'repeat' });
  const corrected = session('corrected', '2026-09-21', 'daily', '2026-09-23T00:00:00Z');
  const input = Object.freeze([topup, corrected, first, repeat]);
  const result = groupJournalSessions(input);
  assert.deepEqual(result.map(day => day.date), ['2026-09-22', '2026-09-21']);
  assert.deepEqual(result[0].sessions, [{ session: repeat, number: 3 }, { session: topup, number: 2 }, { session: first, number: 1 }]);
  assert.equal(result[0].sessions[2].session, first);
  assert.equal(result[1].sessions[0].session, corrected);
  assert.deepEqual(input.map(s => s.id), ['topup', 'corrected', 'first', 'repeat']);
});

test('kind filtering preserves attempt numbers and does not leave empty days', () => {
  const input = [
    session('1', '2026-09-22', 'daily', '2026-09-22T00:00:00Z'),
    session('2', '2026-09-22', 'practice', '2026-09-22T01:00:00Z'),
    session('3', '2026-09-22', 'daily', '2026-09-22T02:00:00Z'),
    session('4', '2026-09-21', 'weekly', '2026-09-21T00:00:00Z'),
  ];
  const filtered = groupJournalSessions(input, 'daily');
  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].sessions.map(s => s.number), [3, 1]);
  assert.deepEqual(groupJournalSessions(input, 'monthly'), []);
  assert.deepEqual(groupJournalSessions([]), []);
});

test('date pagination never splits a busy day; tied timestamps have deterministic numbering', () => {
  const input = Array.from({ length: 14 }, (_, i) => session(String(i).padStart(2, '0'), '2026-09-22', 'daily', '2026-09-22T00:00:00Z'));
  input.push(session('old', '2026-09-21', 'daily', '2026-09-21T00:00:00Z'));
  const page = groupJournalSessions(input).slice(0, 1);
  assert.equal(page.length, 1);
  assert.equal(page[0].sessions.length, 14);
  assert.deepEqual(page[0].sessions.map(s => s.session.id), [...input.slice(0, 14)].reverse().map(s => s.id));
  assert.equal(page[0].sessions[0].number, 14);
});

test('practice labels identify the recorded practice mode without inventing extra daily sessions', () => {
  const labels = { repeat: '다시 학습', ko: '뜻→영어 연습', sentence: '문장 보완', known: '아는 단어 점검' };
  for (const [practiceMode, label] of Object.entries(labels)) assert.equal(journalSessionLabel({ kind: 'practice', practiceMode }), label);
  assert.equal(journalSessionLabel({ kind: 'daily' }), '일일 학습');
});
