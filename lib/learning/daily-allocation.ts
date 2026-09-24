import { today } from './dates.ts';
import { dailyHistory, wantsNewSingle } from './daily-history.ts';
import type { DailyOrigin, State, Word } from './model.ts';
import { allSenses, senseProgress } from './progress.ts';

const everyday = new Set(['arrive', 'busy', 'breakfast', 'work', 'home', 'food', 'water', 'time', 'help', 'need', 'want', 'buy', 'travel', 'meet', 'friend', 'family', 'learn', 'call', 'plan', 'use', 'important']);

export function dailyAssignedIds(state: State, date = today()): string[] {
  return [...new Set(Object.values(state.sessions)
    .filter(s => s.kind === 'daily' && s.date === date)
    .flatMap(s => s.ids.map(id => s.records[id]?.entryId || id)))];
}

export function countDailyOrigins(ids: readonly string[], byId: Readonly<Record<string, DailyOrigin>>) {
  const returning = ids.filter(id => byId[id] === 'returning').length;
  return { returning, newCount: ids.length - returning };
}

export function dailyOriginSummary(state: State, ids: string[], date: string, words: Word[] = []) {
  const { origin } = dailyHistory(state, date, words);
  const byId = Object.fromEntries(ids.map(id => [id, origin(id)]));
  return { byId, ...countDailyOrigins(ids, byId) };
}

function allocationQuota(goal: number, paused: boolean, singleIsNew = true) {
  const newQuota = paused ? 0 : goal === 1 ? Number(singleIsNew) : Math.ceil(goal / 2);
  return { newQuota, reviewQuota: goal - newQuota };
}

export function dailyAllocationRule(goal: number, paused = false): string {
  if (paused) return `복습만 최대 ${goal}개 배정해요.`;
  if (goal === 1) return '학습한 날을 기준으로 새 단어와 복습을 번갈아 배정해요.';
  const { newQuota, reviewQuota } = allocationQuota(goal, paused);
  return `새 단어 ${newQuota}개 · 복습 ${reviewQuota}개를 우선 배정해요.`;
}

function hash(value: string): number {
  let n = 0;
  for (const c of value) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

function rankedCandidates(words: Word[], state: State, date: string, history: ReturnType<typeof dailyHistory>) {
  const { assigned, reviewIds, lastAttempt, origin } = history;
  const candidates = words.filter(w => !assigned.has(w.id) &&
    (reviewIds.has(w.id) || (!state.settings.newWordsPaused && (w.personal || w.level === state.settings.level) &&
      state.progress[w.id]?.familiarity !== 'known' &&
      !senseProgress(state.progress[w.id], state.progress[w.id]?.meaning || '').lastStudied)))
    .map(word => {
      const p = state.progress[word.id];
      return {
        word, origin: origin(word.id), pending: Number(reviewIds.has(word.id)),
        familiarity: p?.familiarity === 'uncertain' ? 0 : p?.familiarity === 'new' ? 1 : 2,
        difficulty: [p, ...allSenses(p)].some(s => s && (s.en === 'help' || s.ko === 'help' || s.sentenceStatus === 'improve')) ? 0 : 1,
        lastAttempt: lastAttempt.get(word.id) || '',
        useful: Number(!!p?.useful), everyday: Number(everyday.has(word.word)), tie: hash(date + word.id),
      };
    });
  type Candidate = typeof candidates[number];
  // Compute sense difficulty and deterministic tie-breakers once per candidate,
  // rather than on every comparison during sorting.
  const everydayOrder = (a: Candidate, b: Candidate) => b.useful - a.useful ||
    b.everyday - a.everyday || a.tie - b.tie || a.word.id.localeCompare(b.word.id);
  const fresh = candidates.filter(c => c.origin === 'new').sort((a, b) => a.familiarity - b.familiarity || everydayOrder(a, b));
  const review = candidates.filter(c => c.origin === 'returning').sort((a, b) =>
    b.pending - a.pending || a.difficulty - b.difficulty || a.lastAttempt.localeCompare(b.lastAttempt) || everydayOrder(a, b));
  return { fresh: fresh.map(c => c.word), review: review.map(c => c.word) };
}

function selectCandidates(
  pools: ReturnType<typeof rankedCandidates>, seen: Set<string>, remaining: number,
  freshSlots: number, reviewSlots: number,
) {
  const selectedNew: string[] = [], selectedReview: string[] = [];
  const take = (pool: Word[], limit: number, output: string[]) => {
    let count = 0;
    for (const w of pool) {
      if (count >= limit || selectedNew.length + selectedReview.length >= remaining) break;
      if (seen.has(w.headword)) continue;
      output.push(w.id); seen.add(w.headword); count++;
    }
  };
  // Reserve fresh capacity before reviews; display and learning still put
  // reviews first. If a pool is short, fill from the other without duplicates.
  take(pools.fresh, freshSlots, selectedNew);
  take(pools.review, reviewSlots, selectedReview);
  take(pools.review, remaining, selectedReview);
  take(pools.fresh, remaining, selectedNew);
  return [...selectedReview, ...selectedNew];
}

export function dailyPlan(words: Word[], state: State, date = today()) {
  const history = dailyHistory(state, date, words);
  const { assigned, reviewIds, origin } = history;
  const assignedIds = [...assigned], goal = state.settings.dailyGoal;
  const quota = allocationQuota(goal, !!state.settings.newWordsPaused,
    goal === 1 && !state.settings.newWordsPaused ? wantsNewSingle(state, date, words) : true);
  const assignedOrigins = Object.fromEntries(assignedIds.map(id => [id, origin(id)]));
  const counts = countDailyOrigins(assignedIds, assignedOrigins);
  const seen = new Set(words.filter(w => assigned.has(w.id)).map(w => w.headword));
  // Top-ups use the entire day's allocation, not a new half split per round.
  const ids = selectCandidates(rankedCandidates(words, state, date, history), seen,
    Math.max(0, goal - assigned.size), Math.max(0, quota.newQuota - counts.newCount),
    Math.max(0, quota.reviewQuota - counts.returning));
  const origins = { ...assignedOrigins, ...Object.fromEntries(ids.map(id => [id, origin(id)])) };
  const allocated = new Set([...assignedIds, ...ids]);
  const pendingReviewIds = words.filter(w => reviewIds.has(w.id) && !allocated.has(w.id)).map(w => w.id);
  return { ids, assignedIds, origins, pendingReviewIds, ...quota };
}

export function pickDaily(words: Word[], state: State, date = today()): string[] {
  return dailyPlan(words, state, date).ids;
}
