import test from 'node:test';
import assert from 'node:assert/strict';
import { todayWordStatuses, RECORD_STATUS_DISPLAY } from '../lib/today-status.ts';
import { EMPTY, dailyAssignedIds, emptyRecord, ensureCarryover, pickDaily } from '../lib/learning.ts';

const date = '2026-09-23';
const material = { meaning: '도착하다', expression: 'arrive home', example: '', translation: '', source: 'test' };
const word = { id: 'arrive-v', word: 'arrive', headword: 'arrive', pos: 'v.', level: 'A1', page: 1 };
const record = (patch = {}) => ({ ...emptyRecord(material.meaning), material, ...patch });
const passed = () => record({ en: 'independent', ko: 'independent', sentenceStatus: 'written', learnedOn: date });
const session = (patch = {}) => ({ id: 'daily', kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], stage: 'learn', index: 0,
  records: { [word.id]: record() }, retry: [], retryMode: false, elapsed: 0, finished: false, paused: true, createdAt: date + 'T00:00:00Z', ...patch });
const fresh = () => structuredClone(EMPTY);
const status = (state, current) => todayWordStatuses(state, [word.id], date, current)[word.id];
const labels = value => value.notices.map(n => n.label);
const monthly = (patch = {}) => session({ id: 'monthly', kind: 'monthly', period: '2026-09', stage: 'ko', ...patch });

test('recorded help is complete for recording, even while the session and remediation stay open', () => {
  const state=fresh(), r=record({en:'help',ko:'independent',sentenceStatus:'improve'});
  state.sessions.daily=session({records:{[word.id]:r}});
  state.progress[word.id]={...r,needsReview:true};
  const before=structuredClone(state);
  assert.equal(status(state).recordStatus,'recorded');
  assert.deepEqual(labels(status(state)),['재학습 필요','문장 보완 필요']);
  assert.equal(state.sessions.daily.finished,false);
  assert.deepEqual(RECORD_STATUS_DISPLAY.recorded,{label:'학습 기록함',tone:'success'});
  assert.deepEqual(state,before);
});

test('starting a new daily session is shown as today in progress, never historical carryover', () => {
  let state = fresh(); const s = session(); state.sessions[s.id] = s;
  state = ensureCarryover(state, s);
  assert.equal(state.progress[word.id].needsReview, true);
  assert.deepEqual(status(state), { recordStatus: 'in-progress', notices: [] });
});

test('today completion and an unmeasured monthly check coexist without implying failure', () => {
  const state = fresh(); const s = session({ finished: true, stage: 'done', records: { [word.id]: passed() } });
  state.sessions = { daily: s, monthly: monthly() };
  state.progress[word.id] = { ...passed(), needsReview: true };
  assert.deepEqual(status(state), { recordStatus: 'recorded', notices: [{ label: '월말 점검 대기', warning: false }] });
});

test('actual recall and sentence gaps stay distinct from pending checks and preserve today completion', () => {
  const state = fresh(); state.sessions.daily = session({ records: { [word.id]: passed() } });
  state.progress[word.id] = { ...passed(), en: 'help', sentenceStatus: 'improve' };
  const value = status(state);
  assert.equal(value.recordStatus, 'recorded');
  assert.deepEqual(value.notices, [{ label: '재학습 필요', warning: true }, { label: '문장 보완 필요', warning: true }]);
});

test('skipping a required sentence ends the session without labelling an unmeasured record complete', () => {
  const state = fresh(); const r = { ...passed(), sentenceStatus: 'unmeasured' };
  state.sessions.daily = session({ finished: true, records: { [word.id]: r } });
  state.progress[word.id] = { ...r, needsReview: true };
  assert.deepEqual(status(state), { recordStatus: 'session-ended', notices: [{ label: '미완료 연습 남음', warning: false }] });
});

test('pending checks follow each kind measurement rule and include newly added period targets', () => {
  const state = fresh(); state.sessions.daily = session({ finished: true, records: { [word.id]: passed() } });
  state.progress[word.id] = { ...passed() };
  state.sessions.monthly = monthly({ ids: [], records: {} });
  assert.deepEqual(labels(status(state)), ['월말 점검 대기']);
  state.sessions.monthly = monthly({ records: { [word.id]: record({ ko: 'independent' }) } });
  state.sessions.weekly = session({ id: 'weekly', kind: 'weekly', period: '2026-09-21', records: { [word.id]: record({ en: 'independent', ko: 'independent' }) } });
  assert.deepEqual(labels(status(state)), ['주간 점검 대기']);
  state.sessions.weekly.finished = true;
  assert.deepEqual(labels(status(state)), []);
});

test('review needs never leak from a different sense or overwrite a newer successful result', () => {
  const state = fresh(); state.sessions.daily = session({ records: { [word.id]: passed() } });
  state.sessions.monthly = monthly({ period: '2026-08', records: { [word.id]: record({ meaning: '다른 뜻' }) } });
  state.progress[word.id] = { meaning: '다른 뜻', en: 'help', needsReview: true,
    senses: { [material.meaning]: { ...passed(), needsReview: false } } };
  assert.deepEqual(status(state), { recordStatus: 'recorded', notices: [] });
});

test('earlier unmeasured daily work is identifiable, but unexplained legacy flags are not called errors', () => {
  const state = fresh(); const yesterday = '2026-09-22';
  state.sessions.daily = session({ date: yesterday, period: yesterday });
  state.progress[word.id] = { meaning: material.meaning, needsReview: true };
  assert.deepEqual(labels(status(state)), ['이전 학습 미완료']);
  state.sessions = {};
  assert.deepEqual(status(state), { recordStatus: null, notices: [{ label: '복습 예정', warning: false }] });
});

test('the displayed unfinished session takes precedence over a later completed session', () => {
  const state = fresh(); const current = session(); state.sessions.daily = current;
  state.sessions.later = session({ id: 'later', finished: true, createdAt: date + 'T01:00:00Z', records: { [word.id]: passed() } });
  assert.equal(status(state, current).recordStatus, 'in-progress');
});

test('status rendering is read-only and leaves assignment ordering, records and results unchanged', () => {
  const state = fresh(); state.progress[word.id] = { familiarity: 'uncertain' };
  const before = structuredClone(state), candidates = pickDaily([word], state, date);
  assert.deepEqual(labels(status(state)), ['헷갈리는 단어']);
  assert.deepEqual(state, before);
  assert.deepEqual(pickDaily([word], state, date), candidates);
  state.progress[word.id].familiarity = 'new';
  assert.deepEqual(labels(status(state)), ['처음 보는 단어']);
});

test('all same-day rounds count together while other dates and periodic checks stay separate', () => {
  const state = fresh(), extraId = 'busy-adj';
  state.sessions.first = session({ id: 'first', finished: true, records: { [word.id]: passed() } });
  const second = session({ id: 'second', ids: [extraId], records: { [extraId]: record() } });
  state.sessions.second = second;
  state.sessions.yesterday = session({ id: 'yesterday', date: '2026-09-22', ids: ['old'], records: { old: passed() } });
  state.sessions.monthly = monthly({ ids: ['old'], records: { old: record() } });
  const before = structuredClone(state), ids = dailyAssignedIds(state, date);
  assert.deepEqual(ids, [word.id, extraId]);
  const statuses = todayWordStatuses(state, ids, date, second);
  assert.equal(statuses[word.id].recordStatus, 'recorded');
  assert.equal(statuses[extraId].recordStatus, 'in-progress');
  assert.deepEqual(dailyAssignedIds(state, '2026-09-24'), []);
  assert.equal(todayWordStatuses(state, [word.id], '2026-09-24')[word.id].recordStatus, null);
  assert.deepEqual(state, before);
});

test('pending monthly checks leave new-word budgets open at both goal bounds and preserve saved sessions', () => {
  const pool = Array.from({ length: 11 }, (_, i) => ({ ...word, id: 'entry-' + i, headword: 'word-' + i }));
  const state = fresh();
  state.progress[pool[0].id] = { meaning: material.meaning, needsReview: true, ko: 'help' };
  state.sessions.monthly = monthly();
  for (const goal of [1, 10]) {
    state.settings.dailyGoal = goal;
    const before = structuredClone(state), chosen = pickDaily(pool, state, date);
    assert.equal(chosen.length, goal);
    if (goal > 1) assert.equal(chosen[0], pool[0].id); else assert.ok(!chosen.includes(pool[0].id));
    assert.equal(new Set(chosen).size, goal);
    assert.deepEqual(state, before);
  }
  state.settings.newWordsPaused = true;
  assert.deepEqual(pickDaily(pool, state, date), [pool[0].id]);
});
