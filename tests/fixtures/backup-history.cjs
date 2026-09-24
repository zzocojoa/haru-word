// Synthetic completed records: no real learner data or committed large JSON.
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const words = JSON.parse(readFileSync('data/words.json', 'utf8'));
const content = JSON.parse(readFileSync('data/content.json', 'utf8'));
function emptyState() {
  return { settings: { level: 'A1', dailyGoal: 10, assessments: {}, activeSessionId: null }, progress: {}, sessions: {} };
}
function history(days = 730, goal = 10) {
  const state = emptyState(); state.settings.dailyGoal = goal;
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse('2026-09-24T12:00:00Z') - (days - i) * 86400000).toISOString().slice(0, 10);
    const id = randomUUID(), ids = Array.from({ length: goal }, (_, j) => words[(i * goal + j) % words.length].id), records = {};
    for (const wid of ids) {
      const c = content[wid], previous = state.progress[wid];
      records[wid] = { entryId: wid, meaning: c.meaning, material: c, familiarity: 'known', en: 'independent', ko: 'independent',
        sentenceStatus: 'written', sentence: c.example, notes: '', learnedOn: date };
      state.progress[wid] = { meaning: c.meaning, familiarity: 'known', en: 'independent', ko: 'independent', sentenceStatus: 'written',
        studyDates: [...(previous?.studyDates || []), date], lastStudied: date };
    }
    state.sessions[id] = { id, kind: 'daily', date, period: date, ids, records, warmupIds: [], stage: 'done', index: 0,
      retry: [], retryMode: false, elapsed: 900, finished: true, paused: true, createdAt: date + 'T12:00:00.000Z' };
  }
  return state;
}
function oversizedState() {
  return { ...emptyState(), progress: Object.fromEntries(words.slice(0, 1500).map(w => [w.id, { notes: '가'.repeat(1900) }])) };
}
module.exports = { emptyState, history, oversizedState };
