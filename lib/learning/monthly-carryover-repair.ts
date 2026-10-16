import type { Content, RecordItem, Session, State, Word } from './model.ts';
import { allSenses, dailyMeaning, storeSense } from './progress.ts';
import { emptyRecord, isComplete, sessionRecordComplete } from './outcomes.ts';
import { dailyAssignedIds, entryIdFor, targetIdentity } from './targets.ts';
import { dailyPlan } from './daily-allocation.ts';
import { ensureCarryover } from './recording.ts';

// Only allocation placeholders are replaceable. Even an empty saved draft or
// edited material is evidence of interaction, so preserve it conservatively.
function untouched(r: RecordItem): boolean {
  return r.en === 'unmeasured' && r.ko === 'unmeasured' && r.sentenceStatus === 'unmeasured'
    && !r.sentence && !r.notes && !r.learnedOn && !r.lastPracticedOn
    && r.material === undefined && r.draft === undefined && r.aiFeedback === undefined
    && r.enAnswer === undefined && r.koAnswer === undefined && r.spoken === undefined
    && r.hintEn === undefined && r.hintKo === undefined
    && r.retryEn === undefined && r.retryKo === undefined;
}

function replaceable(s: Session, id: string): boolean {
  return !s.finished && (s.stage === 'warmup' || (s.stage === 'learn' && s.ids.indexOf(id) >= s.index))
    && !s.retryMode && !s.resumeAfterRetry && !s.retry.length
    && !!s.records[id] && untouched(s.records[id]);
}

export type MonthlyCarryoverRepair = {
  state: State;
  cleared: number;
  replacements: { from: string; to: string }[];
  unavailable: number;
};

// A bounded, explicit repair of legacy flags and the first unfinished daily
// round. No record with learner input, past session, score or monthly cursor is
// rewritten. Unknown legacy evidence is deliberately left alone.
export function repairMonthlyCarryover(
  state: State, words: Word[], content: (id: string) => Pick<Content, 'meaning'>, date: string,
): MonthlyCarryoverRepair {
  const sessions = Object.values(state.sessions);
  const monthlyWaiting = new Map<string, string>();
  const completedOn = new Map<string, string>();
  for (const s of sessions) {
    for (const id of s.ids) {
      const r = s.records[id];
      if (!r) continue;
      const key = targetIdentity(entryIdFor(s, id), r.meaning);
      if (s.kind === 'monthly' && !s.finished && r.ko === 'unmeasured') {
        const previous = monthlyWaiting.get(key);
        if (!previous || s.createdAt < previous) monthlyWaiting.set(key, s.createdAt);
      }
      if (s.kind === 'daily' && isComplete(r)) {
        const learned = r.lastPracticedOn || r.learnedOn || s.date;
        if (learned <= date && learned > (completedOn.get(key) || '')) completedOn.set(key, learned);
      }
    }
  }
  const eligible = new Set<string>();
  for (const [id, p] of Object.entries(state.progress)) {
    // A renewed familiarity signal is a legitimate obligation, even while old
    // recall scores still say independent. Its timestamp is unknown; retain it.
    if (p.familiarity !== 'known') continue;
    for (const sense of allSenses(p)) {
      const key = targetIdentity(id, sense.meaning || '');
      if (monthlyWaiting.has(key) && completedOn.has(key)
        && sense.en === 'independent' && sense.ko === 'independent' && sense.sentenceStatus === 'written')
        eligible.add(key);
    }
  }
  for (const s of sessions) {
    for (const [id, result] of Object.entries(s.warmupResults || {})) {
      if (result !== 'help') continue;
      for (const sense of allSenses(state.progress[id])) {
        const key = targetIdentity(id, sense.meaning || '');
        if (s.date >= (completedOn.get(key) || '')) eligible.delete(key);
      }
    }
  }
  // A new daily attempt with input is a real obligation even if progress still
  // contains the previous successful scores. Do not erase that newer work.
  for (const s of sessions) {
    if (s.kind !== 'daily' && s.kind !== 'weekly') continue;
    for (const id of s.ids) {
      const r = s.records[id];
      if (!r || sessionRecordComplete(s, r)) continue;
      const key = targetIdentity(entryIdFor(s, id), r.meaning);
      if (!eligible.has(key)) continue;
      const activityDate = r.lastPracticedOn || r.learnedOn || s.date;
      if (activityDate < completedOn.get(key)!) continue;
      if (s.kind === 'weekly' || !replaceable(s, id) || s.createdAt < monthlyWaiting.get(key)!)
        eligible.delete(key);
    }
  }
  let next = state, cleared = 0;
  for (const [id, p] of Object.entries(state.progress)) {
    let updated = p;
    for (const sense of allSenses(p)) {
      if (sense.needsReview && eligible.has(targetIdentity(id, sense.meaning || ''))) {
        updated = storeSense(updated, { ...sense, needsReview: false });
        cleared++;
      }
    }
    if (updated !== p) next = { ...next, progress: { ...next.progress, [id]: updated } };
  }
  const current = sessions.find(s => s.kind === 'daily' && s.date === date && !s.finished);
  const candidates = current?.ids.filter(id => {
    const r = current.records[id], key = targetIdentity(entryIdFor(current, id), r?.meaning || '');
    return eligible.has(key) && completedOn.get(key)! < date && replaceable(current, id)
      && current.createdAt >= monthlyWaiting.get(key)!;
  }) || [];
  const replacements: MonthlyCarryoverRepair['replacements'] = [];
  if (current && candidates.length) {
    const removed = new Set(candidates);
    const retained = { ...current, ids: current.ids.filter(id => !removed.has(id)) };
    const planning: State = {
      ...next,
      settings: { ...next.settings, dailyGoal: Math.max(next.settings.dailyGoal, dailyAssignedIds(state, date).length) },
      sessions: { ...next.sessions, [current.id]: retained },
    };
    // Do not replace one false carryover with another spelling/part of speech
    // of the removed word. Never enlarge an existing round during this repair.
    const removedEntries = new Set(candidates.map(id => entryIdFor(current, id)));
    const removedHeads = new Set(words.filter(w => removedEntries.has(w.id)).map(w => w.headword));
    const plan = dailyPlan(words.filter(w => !removedHeads.has(w.headword)), planning, date);
    const available = plan.ids.slice(0, candidates.length);
    const ids = [...current.ids], records = { ...current.records }, wordKeys = { ...current.wordKeys };
    for (let i = 0; i < available.length; i++) {
      const from = candidates[i], to = available[i];
      ids[ids.indexOf(from)] = to;
      delete records[from]; delete wordKeys[from];
      records[to] = { ...emptyRecord(dailyMeaning(next.progress[to], content(to).meaning), next.progress[to]?.familiarity), entryId: to, dailyOrigin: plan.origins[to] };
      wordKeys[to] = words.find(w => w.id === to)!.word.toLowerCase();
      replacements.push({ from: entryIdFor(current, from), to });
    }
    if (replacements.length) {
      const repaired = { ...current, ids, records, wordKeys };
      next = { ...next, sessions: { ...next.sessions, [current.id]: repaired } };
      next = ensureCarryover(next, { ...repaired, ids: replacements.map(r => r.to) });
    }
  }
  return { state: next, cleared, replacements, unavailable: candidates.length - replacements.length };
}
