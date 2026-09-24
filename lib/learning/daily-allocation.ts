import { today } from './dates.ts';
import type { DailyOrigin, RecordItem, State, Word } from './model.ts';
import { allSenses, hasReviewWork, senseProgress } from './progress.ts';

const everyday = new Set(['arrive', 'busy', 'breakfast', 'work', 'home', 'food', 'water', 'time', 'help', 'need', 'want', 'buy', 'travel', 'meet', 'friend', 'family', 'learn', 'call', 'plan', 'use', 'important']);

// One history pass supplies both selection and its UI explanation. A daily
// origin is captured before ensureCarryover marks newly assigned work pending.
function history(state: State, date: string, words: Word[]) {
  const earlier = new Set<string>(), assigned = new Set<string>();
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
    const dates = [...(p.studyDates || []), ...(p.lastStudied ? [p.lastStudied] : []),
      ...allSenses(p).flatMap(s => [...(s.studyDates || []), ...(s.lastStudied ? [s.lastStudied] : [])])];
    if (dates.some(d => d < date)) earlier.add(id);
    for (const d of dates) if (d < date) attempted(id, d);
    if (p.lastReviewed) attempted(id, p.lastReviewed);
  }
  const priorHeads = new Set(words.filter(w => earlier.has(w.id) ||
    (!assigned.has(w.id) && hasReviewWork(state.progress[w.id]))).map(w => w.headword));
  const heads = new Map(words.map(w => [w.id, w.headword]));
  const origin = (id: string): DailyOrigin => saved.get(id) ||
    (earlier.has(id) || priorHeads.has(heads.get(id)!) ||
      (!assigned.has(id) && hasReviewWork(state.progress[id])) ? 'returning' : 'new');
  return { assigned, lastAttempt, origin };
}

export function dailyAssignedIds(state: State, date = today()): string[] {
  return [...new Set(Object.values(state.sessions)
    .filter(s => s.kind === 'daily' && s.date === date)
    .flatMap(s => s.ids.map(id => s.records[id]?.entryId || id)))];
}

export function dailyOriginSummary(state: State, ids: string[], date: string, words: Word[] = []) {
  const { origin } = history(state, date, words);
  const byId = Object.fromEntries(ids.map(id => [id, origin(id)]));
  const returning = ids.filter(id => byId[id] === 'returning').length;
  return { byId, returning, newCount: ids.length - returning };
}

export function dailyAllocationRule(goal: number, paused = false): string {
  if (paused) return `복습만 최대 ${goal}개 배정해요.`;
  if (goal === 1) return '학습한 날을 기준으로 새 단어와 복습을 번갈아 배정해요.';
  return `새 단어 ${Math.ceil(goal / 2)}개 · 복습 ${Math.floor(goal / 2)}개를 우선 배정해요.`;
}

function wantsNewSingle(state: State, date: string, words: Word[]): boolean {
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
  const legacy = new Map<string, ReturnType<typeof history>>();
  return !latest.some(({ record, entryId, assignedOn }) => {
    if (record.dailyOrigin) return record.dailyOrigin === 'new';
    if (!legacy.has(assignedOn)) legacy.set(assignedOn, history(state, assignedOn, words));
    return legacy.get(assignedOn)!.origin(entryId) === 'new';
  });
}

function hash(value: string): number {
  let n = 0;
  for (const c of value) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

export function dailyPlan(words: Word[], state: State, date = today()) {
  const { assigned, lastAttempt, origin } = history(state, date, words);
  const goal = state.settings.dailyGoal, remaining = Math.max(0, goal - assigned.size);
  const pauseNew = !!state.settings.newWordsPaused;
  const newQuota = pauseNew ? 0 : goal === 1 ? Number(wantsNewSingle(state, date, words)) : Math.ceil(goal / 2);
  const assignedNew = [...assigned].filter(id => origin(id) === 'new').length;
  const seen = new Set(words.filter(w => assigned.has(w.id)).map(w => w.headword));
  const candidates = words.filter(w => !assigned.has(w.id) &&
    (hasReviewWork(state.progress[w.id]) || (!pauseNew && (w.personal || w.level === state.settings.level) &&
      state.progress[w.id]?.familiarity !== 'known' &&
      !senseProgress(state.progress[w.id], state.progress[w.id]?.meaning || '').lastStudied)));
  const familiarityRank = (id: string) => state.progress[id]?.familiarity === 'uncertain' ? 0 : state.progress[id]?.familiarity === 'new' ? 1 : 2;
  const difficulty = (id: string) => {
    const p = state.progress[id];
    return [p, ...allSenses(p)].some(s => s && (s.en === 'help' || s.ko === 'help' || s.sentenceStatus === 'improve')) ? 0 : 1;
  };
  const everydayOrder = (a: Word, b: Word) => Number(!!state.progress[b.id]?.useful) - Number(!!state.progress[a.id]?.useful) ||
    Number(everyday.has(b.word)) - Number(everyday.has(a.word)) || hash(date + a.id) - hash(date + b.id) || a.id.localeCompare(b.id);
  const fresh = candidates.filter(w => origin(w.id) === 'new').sort((a, b) => familiarityRank(a.id) - familiarityRank(b.id) || everydayOrder(a, b));
  const review = candidates.filter(w => origin(w.id) === 'returning').sort((a, b) =>
    Number(hasReviewWork(state.progress[b.id])) - Number(hasReviewWork(state.progress[a.id])) ||
    difficulty(a.id) - difficulty(b.id) || (lastAttempt.get(a.id) || '').localeCompare(lastAttempt.get(b.id) || '') || everydayOrder(a, b));
  const selectedNew: string[] = [], selectedReview: string[] = [];
  const take = (pool: Word[], limit: number, output: string[]) => {
    let count = 0;
    for (const w of pool) {
      if (count >= limit || selectedNew.length + selectedReview.length >= remaining) break;
      if (seen.has(w.headword)) continue;
      output.push(w.id); seen.add(w.headword); count++;
    }
  };
  // Reserve fresh capacity before reviews; the learning sequence can still put
  // reviews first. Top-ups use the entire day's allocation, not a new half split.
  take(fresh, Math.max(0, newQuota - assignedNew), selectedNew);
  take(review, Math.max(0, goal - newQuota - (assigned.size - assignedNew)), selectedReview);
  take(review, remaining, selectedReview);
  take(fresh, remaining, selectedNew);
  const ids = [...selectedReview, ...selectedNew];
  const origins = Object.fromEntries([...assigned, ...ids].map(id => [id, origin(id)]));
  const allocated = new Set([...assigned, ...ids]);
  const pendingReviewIds = words.filter(w => hasReviewWork(state.progress[w.id]) && !allocated.has(w.id)).map(w => w.id);
  return { ids, origins, pendingReviewIds, newQuota, reviewQuota: goal - newQuota };
}

export function pickDaily(words: Word[], state: State, date = today()): string[] {
  return dailyPlan(words, state, date).ids;
}
