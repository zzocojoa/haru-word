import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { EMPTY, newSession, applyRecord, currentId, continueBatch, pendingReviews, reviewRemaining, extendReviewSession } from '../lib/learning.ts';
import { resumeMonthlyWriting } from '../lib/learning/session-flow.ts';
await build({ entryPoints: ['lib/backup.ts'], outfile: 'work/monthly-resume/backup.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { parseBackup, makeBackup } = await import('../work/monthly-resume/backup.mjs');
const words = JSON.parse(readFileSync('data/words.json')), contents = JSON.parse(readFileSync('data/content.json'));
const date = '2026-09-23';
function fixture(count) {
  const state = structuredClone(EMPTY);
  for (const w of words.slice(0, count)) state.progress[w.id] = { meaning: contents[w.id].meaning, studyDates: [date] };
  const s = newSession(state, words, id => contents[id], 'monthly', date);
  state.sessions[s.id] = s; state.settings.activeSessionId = s.id;
  return { state, s };
}
function roundTrip(state, s) { return parseBackup(JSON.stringify(makeBackup({ ...state, sessions: { ...state.sessions, [s.id]: s } }))).state.sessions[s.id]; }

test('skipped writing remains resumable and only unmeasured targets repeat after reload', () => {
  let { state, s } = fixture(3); const [a, b, c] = s.ids, original = [...s.ids];
  const submit = patch => { state = applyRecord(state, s, currentId(s), patch, true, date); s = roundTrip(state, state.sessions[s.id]); };
  submit({ ko: 'independent', koAnswer: 'saved answer' }); submit({ ko: 'unmeasured' }); submit({ ko: 'help' });
  for (let i = 0; i < 3; i++) submit({ sentenceStatus: 'unmeasured' });
  assert.equal(s.finished, false); assert.equal(s.stage, 'checkpoint');
  assert.deepEqual(s.ids, [a, c, b]); assert.equal(reviewRemaining(s), 1);
  state.sessions[s.id] = s; assert.equal(pendingReviews(state)[0].id, s.id);
  s = continueBatch(s); assert.equal(currentId(s), b);
  submit({ ko: 'independent' }); submit({ sentenceStatus: 'unmeasured' });
  // Any due retry is an actual help record, never a fabricated assessment.
  for (let i = 0; !s.finished && i < 10; i++) submit({ ko: 'independent' });
  assert.equal(s.finished, true); assert.equal(reviewRemaining(s), 0);
  assert.equal(s.records[a].koAnswer, 'saved answer'); assert.equal(s.records[c].ko, 'help');
  assert.deepEqual(new Set(s.ids), new Set(original));
});

test('all-skipped and legacy finished rounds reopen without changing scores or record data', () => {
  const { state, s } = fixture(2), finished = { ...s, finished: true, stage: 'done' };
  const reopened = resumeMonthlyWriting(finished);
  assert.equal(reopened.stage, 'checkpoint'); assert.equal(reopened.index, 0);
  assert.deepEqual(reopened.records, finished.records); assert.deepEqual(finished.ids, reopened.ids);
  roundTrip(state, reopened); assert.equal(finished.finished, true);
  state.sessions[s.id] = finished; assert.equal(pendingReviews(state).length, 1);
  for (const r of Object.values(finished.records)) r.ko = 'independent';
  assert.equal(resumeMonthlyWriting(finished), finished); assert.equal(pendingReviews(state).length, 0);
});

test('pending writing retains the cursor when later daily learning extends its population', () => {
  const { state, s } = fixture(2), [a, b] = s.ids;
  s.records[a].ko = 'independent';
  const pending = resumeMonthlyWriting({ ...s, stage: 'done', finished: true });
  state.progress[words[2].id] = { meaning: contents[words[2].id].meaning, studyDates: [date] };
  const extended = extendReviewSession(state, words, pending, id => contents[id]);
  assert.equal(extended.index, 1); assert.equal(currentId(continueBatch(extended)), b);
  assert.equal(extended.records[a].ko, 'independent'); assert.equal(extended.ids.length, 3);
  roundTrip(state, extended);
});
