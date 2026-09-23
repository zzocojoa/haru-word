import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, emptyRecord, ensureCarryover, applyRecord, pickDaily, senseProgress } from '../lib/learning.ts';
import { repairMonthlyCarryover } from '../lib/learning/monthly-carryover-repair.ts';

const date = '2026-09-23', prior = '2026-09-22';
const words = Array.from({ length: 8 }, (_, i) => ({ id: `entry-${i}`, word: `word${i}`, headword: `word${i}`, pos: 'n.', level: 'A1', page: 1 }));
const content = id => ({ meaning: `뜻 ${id}`, expression: '', example: '', translation: '', source: 'test' });
const record = id => ({ ...emptyRecord(content(id).meaning, 'known'), entryId: id });
const passed = id => ({ ...record(id), en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'Saved sentence.', notes: 'Saved notes.', learnedOn: prior });
function session(id, kind, ids, patch = {}) {
  return { id, kind, date: kind === 'monthly' ? prior : date, period: kind === 'monthly' ? '2026-09' : date,
    ids, records: Object.fromEntries(ids.map(id => [id, record(id)])), warmupIds: [], stage: kind === 'monthly' ? 'ko' : 'learn', index: 0,
    retry: [], retryMode: false, elapsed: 123, paused: true, finished: false, createdAt: (kind === 'monthly' ? prior : date) + 'T01:00:00Z', ...patch };
}
function fixture() {
  const state = structuredClone(EMPTY), ids = words.slice(0, 3).map(w => w.id);
  state.sessions.before = session('before', 'daily', ids, { date: prior, period: prior, stage: 'done', finished: true, createdAt: prior + 'T02:00:00Z', records: Object.fromEntries(ids.map(id => [id, passed(id)])) });
  state.sessions.monthly = session('monthly', 'monthly', ids);
  state.sessions.current = session('current', 'daily', ids);
  for (const id of ids) state.progress[id] = { meaning: content(id).meaning, en: 'independent', ko: 'independent', sentenceStatus: 'written',
    sentence: 'Saved sentence.', notes: 'Saved notes.', familiarity: 'known', studyDates: [prior], lastStudied: prior, needsReview: true };
  for (const w of words.slice(3)) state.progress[w.id] = { familiarity: 'uncertain' };
  return state;
}
const repair = state => repairMonthlyCarryover(state, words, content, date);

test('renewed familiarity and recent warmup help are never erased by legacy repair', () => {
  for (const familiarity of ['uncertain', 'new', undefined]) {
    const state = fixture(), id = words[0].id; state.progress[id].familiarity = familiarity;
    const next = repair(state).state;
    assert.equal(next.progress[id].needsReview, true);
    assert.ok(next.sessions.current.ids.includes(id));
  }
  for (const day of [prior, date]) {
    const state = fixture(), id = words[0].id;
    state.sessions.warmup = session('warmup', 'daily', [words[4].id], { date: day, warmupIds: [id], warmupResults: { [id]: 'help' } });
    assert.equal(repair(state).state.progress[id].needsReview, true);
  }
  const state = fixture(), id = words[0].id;
  state.sessions.oldWarmup = session('oldWarmup', 'daily', [words[4].id], { date: '2026-09-20', warmupIds: [id], warmupResults: { [id]: 'help' } });
  assert.equal(repair(state).state.progress[id].needsReview, false);
});

test('pausing untested monthly writing never turns mastered vocabulary into daily carryover', () => {
  let state = fixture(); delete state.sessions.current;
  for (const p of Object.values(state.progress)) p.needsReview = false;
  const before = structuredClone(state), selected = pickDaily(words, state, date);
  state = ensureCarryover(state, state.sessions.monthly);
  assert.deepEqual(state, before);
  assert.deepEqual(pickDaily(words, state, date), selected);
  assert.ok(selected.every(id => !state.sessions.monthly.ids.includes(id)));
  assert.ok(Object.values(state.sessions.monthly.records).every(r => r.ko === 'unmeasured'));
});

test('actual monthly help and sentence improvement still become daily priorities', () => {
  for (const patch of [{ ko: 'help' }, { sentenceStatus: 'improve', sentence: 'Draft.' }]) {
    let state = fixture(); delete state.sessions.current;
    const s = state.sessions.monthly, id = s.ids[0];
    state = applyRecord(state, s, id, patch, false, date);
    state = ensureCarryover(state, state.sessions.monthly);
    assert.equal(state.progress[id].needsReview, true);
    assert.equal(repair(state).state.progress[id].needsReview, true);
    assert.equal(pickDaily(words, repair(state).state, date)[0], id);
  }
});

test('legacy completed words are replaced only in today placeholders; scores, past sessions and monthly progress survive', () => {
  const state = fixture(), before = structuredClone(state), result = repair(state);
  assert.equal(result.cleared, 3); assert.equal(result.replacements.length, 3); assert.equal(result.unavailable, 0);
  const current = result.state.sessions.current;
  assert.equal(current.ids.length, 3); assert.ok(current.ids.every(id => !before.sessions.current.ids.includes(id)));
  assert.equal(current.id, before.sessions.current.id); assert.equal(current.date, date);
  assert.equal(current.index, 0); assert.equal(current.elapsed, 123);
  assert.deepEqual(result.state.sessions.monthly, before.sessions.monthly);
  assert.deepEqual(result.state.sessions.before, before.sessions.before);
  for (const id of before.sessions.current.ids) {
    const p = result.state.progress[id];
    for (const field of ['en', 'ko', 'sentenceStatus', 'sentence', 'notes', 'lastStudied', 'studyDates', 'familiarity'])
      assert.deepEqual(p[field], before.progress[id][field]);
    assert.equal(p.needsReview, false);
  }
  assert.ok(Object.values(current.records).every(r => r.en === 'unmeasured' && r.ko === 'unmeasured' && r.sentenceStatus === 'unmeasured'));
  assert.deepEqual(state, before);
  const again = repair(JSON.parse(JSON.stringify(result.state)));
  assert.equal(again.cleared, 0); assert.deepEqual(again.replacements, []);
  assert.deepEqual(again.state, JSON.parse(JSON.stringify(result.state)));
});

test('even empty saved drafts, material edits and hints are never replaced', () => {
  const patches = [{ draft: { answer: '', hinted: false, revealed: false, stage: 'en', retry: false } },
    { material: content(words[0].id) }, { enAnswer: '' }, { koAnswer: 'my answer' }, { sentence: 'My sentence.' },
    { notes: 'My note' }, { spoken: false }, { hintEn: false }, { hintKo: true }, { retryEn: 'independent' },
    { learnedOn: date }, { lastPracticedOn: date }, { en: 'help' }, { sentenceStatus: 'improve' }];
  for (const patch of patches) {
    const state = fixture(), id = words[0].id;
    Object.assign(state.sessions.current.records[id], patch);
    const before = structuredClone(state), result = repair(state);
    assert.ok(result.state.sessions.current.ids.includes(id), JSON.stringify(patch));
    assert.deepEqual(result.state.sessions.current.records[id], before.sessions.current.records[id]);
    assert.deepEqual(result.state.progress[id], before.progress[id]);
    assert.equal(result.replacements.length, 2);
  }
});

test('completed rounds, advanced stages, retries and older rounds keep their targets', () => {
  for (const patch of [{ finished: true }, { stage: 'en' }, { stage: 'sentence' }, { retryMode: true },
    { retry: [{ id: words[0].id, direction: 'en' }] }, { date: prior, period: prior }]) {
    const state = fixture(); Object.assign(state.sessions.current, patch);
    const result = repair(state);
    assert.deepEqual(result.state.sessions.current, state.sessions.current);
    assert.deepEqual(result.replacements, []);
  }
});

test('replacement preserves warmup input and the current cursor, and retains new study already started', () => {
  const state = fixture(), s = state.sessions.current, id = s.ids[0];
  s.index = 1; s.records[id] = { ...record(id), learnedOn: date, material: content(id) };
  s.warmupIds = [id]; s.warmupResults = { [id]: 'independent' };
  s.warmupDraft = { id, answer: 'saved warmup', hinted: false, revealed: false };
  const result = repair(state), next = result.state.sessions.current;
  assert.equal(next.index, 1); assert.equal(next.ids[0], id); assert.deepEqual(next.records[id], s.records[id]);
  assert.deepEqual(next.warmupIds, s.warmupIds); assert.deepEqual(next.warmupResults, s.warmupResults); assert.deepEqual(next.warmupDraft, s.warmupDraft);
  assert.equal(result.replacements.length, 2);
});

test('missing completion evidence, different meanings, later unfinished weekly work and real gaps are not cleared', () => {
  for (const change of [s => { delete s.sessions.before; }, s => { s.sessions.monthly.records[words[0].id].meaning = 'different'; },
    s => { s.progress[words[0].id].ko = 'help'; }, s => { s.progress[words[0].id].sentenceStatus = 'improve'; },
    s => { s.sessions.weekly = session('weekly', 'weekly', [words[0].id]); }]) {
    const state = fixture(); change(state); const id = words[0].id, result = repair(state);
    assert.equal(result.state.progress[id].needsReview, true);
    assert.ok(result.state.sessions.current.ids.includes(id));
  }
});

test('cleanup is sense-specific and does not change active material or unrelated weaknesses', () => {
  const state = fixture(), id = words[0].id, old = state.progress[id];
  state.progress[id] = { ...old, meaning: 'different meaning', ko: 'help', senses: { [old.meaning]: old } };
  const result = repair(state);
  assert.equal(result.state.progress[id].meaning, 'different meaning');
  assert.equal(result.state.progress[id].ko, 'help'); assert.equal(result.state.progress[id].needsReview, true);
  assert.equal(senseProgress(result.state.progress[id], old.meaning).needsReview, false);
});

test('manual pause and pool shortage do not delete targets or fabricate available words', () => {
  const state = fixture(); state.settings.newWordsPaused = true;
  let result = repair(state);
  assert.equal(result.replacements.length, 0); assert.equal(result.unavailable, 3);
  assert.deepEqual(result.state.sessions.current, state.sessions.current);
  state.settings.newWordsPaused = false;
  result = repairMonthlyCarryover(state, words.slice(0, 4), content, date);
  assert.equal(result.replacements.length, 1); assert.equal(result.unavailable, 2); assert.equal(result.state.sessions.current.ids.length, 3);
});

test('lowering the goal preserves the already allocated size; unmarked replacements remain unmarked', () => {
  const state = fixture(); state.settings.dailyGoal = 1;
  for (const w of words.slice(3)) delete state.progress[w.id];
  const result = repair(state);
  assert.equal(result.state.settings.dailyGoal, 1); assert.equal(result.state.sessions.current.ids.length, 3);
  assert.equal(result.replacements.length, 3);
  for (const id of result.state.sessions.current.ids) assert.equal(result.state.sessions.current.records[id].familiarity, undefined);
});
