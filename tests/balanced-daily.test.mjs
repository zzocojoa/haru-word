import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { EMPTY, newSession, ensureCarryover, applyRecord, dailyAssignedIds, reviewTargets, exportTutor } from '../lib/learning.ts';
import { dailyPlan, dailyOriginSummary } from '../lib/learning/daily-allocation.ts';

const date = '2026-09-24';
const words = Array.from({ length: 40 }, (_, i) => ({ id: `entry-${i}`, word: `word${i}`, headword: `word${i}`, level: 'A1', pos: 'n.', page: 1 }));
const content = () => ({ meaning: '뜻', expression: '', example: '', translation: '', source: 'test' });
const fresh = () => structuredClone(EMPTY);
function fixture(goal = 10) {
  const state = fresh(); state.settings.dailyGoal = goal;
  for (const w of words.slice(0, 20)) state.progress[w.id] = {
    meaning: '뜻', needsReview: true, ko: 'help', familiarity: 'known',
    studyDates: ['2026-09-21'], lastStudied: '2026-09-21',
  };
  for (const w of words.slice(20)) state.progress[w.id] = { familiarity: 'uncertain' };
  return state;
}
function finish(state, session, day) {
  const records = Object.fromEntries(Object.entries(session.records).map(([id, r]) => [id, { ...r, learnedOn: day, lastPracticedOn: day,
    en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'My sentence.', notes: 'Keep my note.' }]));
  state.sessions[session.id] = { ...session, records, finished: true, stage: 'done', paused: true };
  return state.sessions[session.id];
}
function freeze(v) { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v)) freeze(x); } return v; }

test('every goal 1–10 reserves fresh capacity and retains all unselected obligations', () => {
  for (let n = 1; n <= 10; n++) {
    const state = freeze(fixture(n)), before = structuredClone(state);
    const plan = dailyPlan(words, state, date);
    assert.equal(plan.ids.length, n);
    assert.equal(plan.ids.filter(id => plan.origins[id] === 'new').length, Math.ceil(n / 2));
    assert.equal(plan.ids.filter(id => plan.origins[id] === 'returning').length, Math.floor(n / 2));
    assert.equal(plan.pendingReviewIds.length, 20 - Math.floor(n / 2));
    assert.equal(new Set(plan.ids.map(id => words.find(w => w.id === id).headword)).size, n);
    assert.deepEqual(state, before);
  }
});

test('3 → 10 tops up the entire day to 5 fresh + 5 review without modifying the first round', () => {
  const state = fixture(3), first = finish(state, newSession(state, words, content, 'daily', date), date);
  const original = structuredClone(first);
  assert.equal(Object.values(first.records).filter(r => r.dailyOrigin === 'new').length, 2);
  state.settings.dailyGoal = 10;
  const next = newSession(state, words, content, 'daily', date);
  assert.equal(next.ids.length, 7);
  assert.equal(Object.values(next.records).filter(r => r.dailyOrigin === 'new').length, 3);
  assert.equal(Object.values(next.records).filter(r => r.dailyOrigin === 'returning').length, 4);
  state.sessions[next.id] = next;
  assert.deepEqual(dailyOriginSummary(state, dailyAssignedIds(state, date), date, words), {
    byId: Object.fromEntries([...first.ids, ...next.ids].map(id => [id, first.records[id]?.dailyOrigin || next.records[id].dailyOrigin])), returning: 5, newCount: 5,
  });
  assert.deepEqual(first, original);
  assert.equal(newSession(state, words, content, 'daily', date), null);
  state.settings.dailyGoal = 1;
  assert.deepEqual(dailyPlan(words, state, date).ids, []);
  assert.deepEqual(first, original);
});

test('multiple increases and legacy review-heavy days keep existing records and fill the missing category', () => {
  const state = fixture(3);
  for (const n of [3, 5, 10]) {
    state.settings.dailyGoal = n;
    finish(state, newSession(state, words, content, 'daily', date), date);
  }
  const summary = dailyOriginSummary(state, dailyAssignedIds(state, date), date, words);
  assert.equal(summary.newCount, 5); assert.equal(summary.returning, 5);
  const legacy = fixture(3), old = newSession(legacy, words.slice(0, 20), content, 'daily', date);
  finish(legacy, old, date);
  for (const r of Object.values(legacy.sessions[old.id].records)) delete r.dailyOrigin;
  legacy.settings.dailyGoal = 10;
  const plan = dailyPlan(words, legacy, date);
  assert.equal(plan.ids.filter(id => plan.origins[id] === 'new').length, 5);
  assert.equal(plan.ids.filter(id => plan.origins[id] === 'returning').length, 2);
});

test('missing candidates cross-fill without duplicates; pause never fills from fresh words', () => {
  for (const pool of [words.slice(0, 20), words.slice(20), [...words.slice(0, 2), ...words.slice(20)], [...words.slice(0, 20), ...words.slice(20, 22)]]) {
    const state = fixture(), plan = dailyPlan(pool, state, date);
    assert.equal(plan.ids.length, 10); assert.equal(new Set(plan.ids).size, 10);
  }
  const state = fixture(); state.settings.newWordsPaused = true;
  assert.ok(dailyPlan(words, state, date).ids.every(id => state.progress[id].needsReview));
  assert.deepEqual(dailyPlan(words.slice(20), state, date).ids, []);
  assert.equal(dailyPlan(words.slice(0, 2), state, date).ids.length, 2);
  assert.equal(dailyPlan(words.slice(20, 22), fixture(), date).ids.length, 2);
});

test('one-word alternation follows real daily learning across skipped days and reloads', () => {
  const state = fixture(1);
  assert.equal(dailyPlan(words, state, date).newQuota, 1);
  const first = newSession(state, words, content, 'daily', date);
  state.sessions[first.id] = first;
  // An unmeasured allocation is not a completed learning day.
  assert.equal(dailyPlan(words, state, '2026-09-25').newQuota, 1);
  finish(state, first, date);
  const before = structuredClone(state);
  for (const d of ['2026-09-25', '2026-09-28', '2026-10-05']) {
    const plan = dailyPlan(words, JSON.parse(JSON.stringify(state)), d);
    assert.equal(plan.newQuota, 0); assert.equal(plan.origins[plan.ids[0]], 'returning');
  }
  assert.deepEqual(state, before);
  const second = newSession(state, words, content, 'daily', '2026-10-05');
  finish(state, second, '2026-10-05');
  assert.equal(dailyPlan(words, state, '2026-10-12').newQuota, 1);
});

test('one-word shortage follows actual allocation, while practice and monthly sessions never advance the day', () => {
  const state = fixture(1);
  const first = newSession(state, words.slice(0, 20), content, 'daily', date);
  assert.equal(first.records[first.ids[0]].dailyOrigin, 'returning');
  finish(state, first, date);
  for (const kind of ['practice', 'monthly']) {
    const copy = { ...structuredClone(state.sessions[first.id]), id: crypto.randomUUID(), kind, date: '2026-09-25' };
    Object.values(copy.records).forEach(r => { r.dailyOrigin = 'new'; });
    state.sessions[copy.id] = copy;
  }
  assert.equal(dailyPlan(words, state, '2026-09-26').newQuota, 1);
});

test('late completion uses the actual learning date, not the old round start date', () => {
  const state = fixture(1);
  const first = newSession(state, words, content, 'daily', '2026-09-21');
  finish(state, first, '2026-09-23');
  const review = newSession(state, words.slice(0, 20), content, 'daily', '2026-09-22');
  finish(state, review, '2026-09-22');
  // The latest activity was fresh learning on the 23rd, despite its older round.
  assert.equal(dailyPlan(words, state, '2026-09-24').newQuota, 0);
  // Future answers must not advance an earlier day's rotation.
  assert.equal(dailyPlan(words, state, '2026-09-23').newQuota, 1);
});

test('origin snapshots survive carryover, grading, later practice and reload without changing quotas', () => {
  let state = fixture(3);
  const session = newSession(state, words, content, 'daily', date), before = structuredClone(session);
  state.sessions[session.id] = session;
  state = ensureCarryover(state, session);
  for (const id of session.ids) state = applyRecord(state, state.sessions[session.id], id, { ko: 'help' }, false, date);
  const practice = { ...structuredClone(state.sessions[session.id]), id: crypto.randomUUID(), kind: 'practice' };
  state.sessions[practice.id] = practice;
  for (const current of [state, JSON.parse(JSON.stringify(state))]) {
    const summary = dailyOriginSummary(current, session.ids, date, words);
    assert.equal(summary.newCount, 2); assert.equal(summary.returning, 1);
    assert.deepEqual(Object.values(current.sessions[session.id].records).map(r => r.dailyOrigin), Object.values(before.records).map(r => r.dailyOrigin));
  }
});

test('flag-only returning origins stay returning after allocation even without historical scores', () => {
  let state = fresh(); state.progress[words[0].id] = { needsReview: true };
  const session = newSession(state, words, content, 'daily', date);
  assert.equal(session.records[words[0].id].dailyOrigin, 'returning');
  state.sessions[session.id] = session; state = ensureCarryover(state, session);
  assert.equal(dailyOriginSummary(state, session.ids, date).returning, 1);
});

test('a different part of speech of a previously studied headword does not consume a fresh slot', () => {
  const state = fresh(); state.settings.dailyGoal = 2;
  const noun = words[0], verb = { ...words[1], headword: noun.headword, pos: 'v.' };
  state.progress[noun.id] = { meaning: '뜻', lastStudied: '2026-09-21', studyDates: ['2026-09-21'], familiarity: 'known' };
  const plan = dailyPlan([noun, verb, words[20]], state, date);
  assert.deepEqual(plan.ids, [verb.id, words[20].id]);
  assert.equal(plan.origins[verb.id], 'returning'); assert.equal(plan.origins[words[20].id], 'new');
});

test('a pending headword cannot use a second part of speech to consume a fresh slot', () => {
  const state = fresh(); state.settings.dailyGoal = 2;
  const noun = words[0], verb = { ...words[1], headword: noun.headword, pos: 'v.' };
  state.progress[noun.id] = { needsReview: true };
  const plan = dailyPlan([noun, verb, words[20]], state, date);
  assert.deepEqual(plan.ids, [noun.id, words[20].id]);
  assert.equal(plan.origins[noun.id], 'returning');
});

test('within review slots, difficulty precedes generic pending and older attempts precede recent attempts', () => {
  const state = fixture(2);
  for (const w of words.slice(0, 20)) state.progress[w.id].ko = 'independent';
  state.progress[words[2].id].ko = 'help'; state.progress[words[2].id].lastReviewed = '2026-09-23';
  state.progress[words[5].id].sentenceStatus = 'improve';
  assert.equal(dailyPlan(words, state, date).ids[0], words[5].id);
  state.progress[words[5].id].lastReviewed = date;
  assert.equal(dailyPlan(words, state, date).ids[0], words[2].id);
});

test('unmeasured monthly targets do not become daily review obligations or block fresh allocation', () => {
  const state = fresh(); state.settings.dailyGoal = 10;
  const daily = newSession(state, words, content, 'daily', '2026-09-21');
  const monthly = { ...daily, id: crypto.randomUUID(), kind: 'monthly', period: '2026-09', stage: 'ko' };
  state.sessions[monthly.id] = monthly;
  const before = structuredClone(state), plan = dailyPlan(words, state, date);
  assert.equal(plan.ids.length, 10); assert.ok(plan.ids.every(id => plan.origins[id] === 'new'));
  assert.deepEqual(plan.pendingReviewIds, []); assert.deepEqual(state, before);
});

test('new origins are optional, constrained and survive real API/backup schemas', async () => {
  await build({ entryPoints: ['lib/backup.ts', 'lib/validation.ts'], outdir: 'work/balanced-contracts', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  const { makeBackup, parseBackup } = await import('../work/balanced-contracts/backup.mjs');
  const { saveSchema } = await import('../work/balanced-contracts/validation.mjs');
  const catalog = JSON.parse(readFileSync('data/words.json', 'utf8')), state = fresh();
  const session = newSession(state, catalog, content, 'daily', date); state.sessions[session.id] = session;
  const roundtrip = () => parseBackup(JSON.stringify(makeBackup(state))).state;
  assert.deepEqual(roundtrip(), JSON.parse(JSON.stringify(state)));
  assert.equal(saveSchema.safeParse({ revision: 0, progress: {}, sessions: state.sessions }).success, true);
  session.records[session.ids[0]].dailyOrigin = 'invalid';
  assert.throws(roundtrip);
  assert.equal(saveSchema.safeParse({ revision: 0, progress: {}, sessions: state.sessions }).success, false);
  Object.values(session.records).forEach(r => delete r.dailyOrigin);
  assert.deepEqual(roundtrip(), JSON.parse(JSON.stringify(state)));
  assert.equal(reviewTargets(state, 'weekly', '2026-09-21').length, 3);
  assert.equal(reviewTargets(state, 'monthly', '2026-09').length, 0);
});

test('exported tutor rules honor the goal and the explicit pause without contradictory fresh filling', () => {
  const state = fixture(5);
  assert.match(exportTutor(state, words), /새 단어 3개 · 복습 2개/);
  state.settings.newWordsPaused = true;
  const exported = exportTutor(state, words);
  assert.match(exported, /복습만 최대 5개/);
  assert.doesNotMatch(exported, /한쪽이 부족하면 다른 쪽으로 채우세요/);
});
