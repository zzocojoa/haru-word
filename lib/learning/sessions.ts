import { periodKey, today } from "./dates.ts";
import {
  type Content,
  type Kind,
  type LearningTarget,
  type PracticeMode,
  type RecordItem,
  type Session,
  type Stage,
  type State,
  type Word,
} from "./model.ts";
import { emptyRecord } from "./outcomes.ts";
import { dailyMeaning, hasReviewWork } from "./progress.ts";
import {
  dailyAssignedIds,
  entryIdFor,
  missingReviewTargets,
  pickDaily,
  practiceTargets,
  reviewTargets,
  targetIdentity,
} from "./targets.ts";

// Keep the current block and cursor intact. New targets start their own full
// recall sequence after that block, even if the saved cursor is in KO or sentence.
export function extendReviewSession(
  state: State,
  words: Word[],
  s: Session,
  content: (id: string) => Content,
): Session {
  const missing = missingReviewTargets(state, s);
  if (!missing.length) return s;
  if (s.ids.length + missing.length > 5000)
    throw new Error(
      "점검 대상이 5,000개를 넘어요. 기존 점검을 마친 뒤 다음 회차로 나눠 주세요.",
    );
  const records = { ...s.records },
    ids = [...s.ids],
    wordKeys = { ...s.wordKeys };
  for (const t of missing) {
    const id = records[t.entryId] ? "target_" + crypto.randomUUID() : t.entryId;
    ids.push(id);
    records[id] = {
      ...emptyRecord(t.meaning || content(t.entryId).meaning, t.familiarity),
      entryId: t.entryId,
      ...(t.material ? { material: t.material } : {}),
      ...(t.historicalMeaningUnknown ? { historicalMeaningUnknown: true } : {}),
    };
    wordKeys[id] =
      words.find((w) => w.id === t.entryId)?.word.toLowerCase() || t.entryId;
  }
  const resumeAfterRetry =
    s.resumeAfterRetry?.stage === "done"
      ? { stage: "checkpoint" as Stage, index: s.ids.length }
      : s.resumeAfterRetry;
  return {
    ...s,
    ids,
    records,
    wordKeys,
    reviewEnd: s.reviewEnd ?? s.ids.length,
    ...(resumeAfterRetry ? { resumeAfterRetry } : {}),
  };
}

function targetRecords(targets: LearningTarget[]): {
  ids: string[];
  records: Record<string, RecordItem>;
} {
  const records: Record<string, RecordItem> = {};
  for (const t of targets) {
    const key = records[t.entryId]
      ? "target_" + crypto.randomUUID()
      : t.entryId;
    records[key] = {
      ...emptyRecord(t.meaning, t.familiarity),
      entryId: t.entryId,
      ...(t.material ? { material: t.material } : {}),
      ...(t.historicalMeaningUnknown ? { historicalMeaningUnknown: true } : {}),
    };
  }
  return { ids: Object.keys(records), records };
}

export function newSession(
  state: State,
  words: Word[],
  content: (id: string) => Content,
  kind: Kind,
  date = today(),
  period = periodKey(kind, date),
  practiceMode?: PracticeMode,
): Session | null {
  // Resume the assigned daily work before allocating another same-day session.
  if (
    kind === "daily" &&
    Object.values(state.sessions).some(
      (s) => s.kind === "daily" && s.date === date && !s.finished,
    )
  )
    return null;
  const targets: LearningTarget[] =
    kind === "weekly" || kind === "monthly"
      ? reviewTargets(state, kind, period)
      : kind === "practice"
        ? practiceTargets(state, practiceMode || "known", content)
        : pickDaily(words, state, date).map((entryId) => ({
            entryId,
            meaning: dailyMeaning(
              state.progress[entryId],
              content(entryId).meaning,
            ),
            familiarity: state.progress[entryId]?.familiarity,
          }));
  if (!targets.length) return null;
  const { ids, records } = targetRecords(
    targets.map((t) => ({
      ...t,
      meaning: t.meaning || content(t.entryId).meaning,
    })),
  );
  const warmupIds =
    kind === "daily" && !dailyAssignedIds(state, date).length
      ? Object.entries(state.progress)
          .filter(([, p]) => p.lastStudied)
          .sort(
            (a, b) =>
              Number(hasReviewWork(b[1])) - Number(hasReviewWork(a[1])) ||
              (b[1].lastStudied || "").localeCompare(a[1].lastStudied || ""),
          )
          .slice(0, 3)
          .map(([id]) => id)
      : [];
  return {
    id: crypto.randomUUID(),
    kind,
    date,
    period,
    ids,
    wordKeys: Object.fromEntries(
      ids.map((id) => [
        id,
        words
          .find((w) => w.id === entryIdFor({ records } as Session, id))
          ?.word.toLowerCase() || id,
      ]),
    ),
    warmupIds,
    stage:
      kind === "daily"
        ? warmupIds.length
          ? "warmup"
          : "learn"
        : kind === "monthly" || practiceMode === "ko"
          ? "ko"
          : practiceMode === "sentence"
            ? "sentence"
            : "en",
    index: 0,
    records,
    retry: [],
    retryMode: false,
    ...(kind === "monthly"
      ? { batchSize: state.settings.monthlyBatchSize || 15, batchStart: 0 }
      : {}),
    ...(kind === "practice" ? { practiceMode: practiceMode || "known" } : {}),
    elapsed: 0,
    finished: false,
    paused: false,
    createdAt: new Date().toISOString(),
  };
}

export function dailyReplaySources(state: State, date: string): Session[] {
  const daily = Object.values(state.sessions).filter(
    (s) => s.kind === "daily" && s.date === date,
  );
  if (daily.length) return daily;
  // A date correction may move the original lesson. Its saved repeat remains a
  // valid snapshot; keep its cards and further practice reachable from history.
  return Object.values(state.sessions)
    .filter(
      (s) =>
        s.kind === "practice" &&
        s.practiceMode === "repeat" &&
        s.period === date,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1);
}

// A repeat is a separate optional practice, tied to the original daily date.
// Reuse its saved cursor before creating another attempt; never reset daily records.
export function repeatDailySession(
  state: State,
  words: Word[],
  sourceDate: string,
  date = today(),
): Session | null {
  const sources = dailyReplaySources(state, sourceDate);
  if (!sources.length || sources.some((s) => s.kind === "daily" && !s.finished))
    return null;
  const existing = Object.values(state.sessions).find(
    (s) =>
      s.kind === "practice" &&
      s.practiceMode === "repeat" &&
      s.period === sourceDate &&
      !s.finished,
  );
  if (existing) return { ...existing, paused: false };
  const targets = new Map<string, LearningTarget>();
  for (const s of sources.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  ))
    for (const id of s.ids) {
      const r = s.records[id];
      const entryId = entryIdFor(s, id);
      if (!r || !words.some((w) => w.id === entryId)) return null;
      targets.set(targetIdentity(entryId, r.meaning), {
        entryId,
        meaning: r.meaning,
        familiarity: r.familiarity,
        material: r.material,
      });
    }
  const { ids, records } = targetRecords([...targets.values()]);
  if (!ids.length) return null;
  return {
    id: crypto.randomUUID(),
    kind: "practice",
    practiceMode: "repeat",
    date,
    period: sourceDate,
    ids,
    wordKeys: Object.fromEntries(
      ids.map((id) => [
        id,
        words
          .find((w) => w.id === (records[id].entryId || id))!
          .word.toLowerCase(),
      ]),
    ),
    warmupIds: [],
    stage: "learn",
    index: 0,
    records,
    retry: [],
    retryMode: false,
    elapsed: 0,
    finished: false,
    paused: false,
    createdAt: new Date().toISOString(),
  };
}
