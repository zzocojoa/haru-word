import type { DailyOrigin, RecordItem, State, Word } from './model.ts';
import { allSenses, hasReviewWork } from './progress.ts';

// Daily origins are captured before ensureCarryover marks new assignments pending.
// Legacy records still need evidence from earlier rounds, senses and headwords.
export function dailyHistory(state: State, date: string, words: Word[]) {
  const earlier = new Set<string>(), assigned = new Set<string>(), reviewIds = new Set<string>();
  const saved = new Map<string, DailyOrigin>(), lastAttempt = new Map<string, string>();
  const attempted = (id: string, day: string) => {
    if (day && day <= date && day > (lastAttempt.get(id) || '')) lastAttempt.set(id, day);
  };
  for (const s of Object.values(state.sessions)) {
    for (const key of s.ids) {
      const r = s.records[key], id = r?.entryId || key;
      if (s.kind === 'daily') {
        if (s.date < date) { earlier.add(id); attempted(id, s.date); }
        if (s.date === date) {
          assigned.add(id);
          if (r?.dailyOrigin && !saved.has(id)) saved.set(id, r.dailyOrigin);
        }
      } else if (r && (r.lastPracticedOn || s.date) <= date &&
        (r.en !== 'unmeasured' || r.ko !== 'unmeasured' || r.sentenceStatus !== 'unmeasured')) {
        earlier.add(id);
        attempted(id, r.lastPracticedOn || s.date);
      }
    }
  }
  for (const [id, p] of Object.entries(state.progress)) {
    if (hasReviewWork(p)) reviewIds.add(id);
    const dates = [...(p.studyDates || []), ...(p.lastStudied ? [p.lastStudied] : []),
      ...allSenses(p).flatMap(s => [...(s.studyDates || []), ...(s.lastStudied ? [s.lastStudied] : [])])];
    if (dates.some(d => d < date)) earlier.add(id);
    for (const d of dates) if (d < date) attempted(id, d);
    if (p.lastReviewed) attempted(id, p.lastReviewed);
  }
  const priorHeads = new Set(words.filter(w => earlier.has(w.id) ||
    (!assigned.has(w.id) && reviewIds.has(w.id))).map(w => w.headword));
  const heads = new Map(words.map(w => [w.id, w.headword]));
  const origin = (id: string): DailyOrigin => saved.get(id) ||
    (earlier.has(id) || priorHeads.has(heads.get(id)!) ||
      (!assigned.has(id) && reviewIds.has(id)) ? 'returning' : 'new');
  return { assigned, reviewIds, lastAttempt, origin };
}

export function wantsNewSingle(state: State, date: string, words: Word[]): boolean {
  // Page views and skipped calendar days do not advance the alternation. Only
  // daily rounds with actual learning/answers count; periodic checks are separate.
  let previousDate = '';
  let latest: { record: RecordItem; entryId: string; assignedOn: string }[] = [];
  for (const s of Object.values(state.sessions)) {
    if (s.kind !== 'daily') continue;
    for (const id of s.ids) {
      const r = s.records[id];
      if (!r || !(r.learnedOn || r.lastPracticedOn || r.en !== 'unmeasured' || r.ko !== 'unmeasured' || r.sentenceStatus !== 'unmeasured')) continue;
      const day = r.lastPracticedOn || r.learnedOn || s.date;
      if (day >= date || day < previousDate) continue;
      if (day > previousDate) { previousDate = day; latest = []; }
      latest.push({ record: r, entryId: r.entryId || id, assignedOn: s.date });
    }
  }
  if (!latest.length) return true;
  const legacy = new Map<string, ReturnType<typeof dailyHistory>>();
  return !latest.some(({ record, entryId, assignedOn }) => {
    if (record.dailyOrigin) return record.dailyOrigin === 'new';
    if (!legacy.has(assignedOn)) legacy.set(assignedOn, dailyHistory(state, assignedOn, words));
    return legacy.get(assignedOn)!.origin(entryId) === 'new';
  });
}
