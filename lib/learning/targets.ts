import { weekStart } from "./dates.ts";
import {
  type Content,
  type LearningTarget,
  type PracticeMode,
  type Session,
  type State,
} from "./model.ts";
import { sessionRecordMeasured } from "./outcomes.ts";
import { resumeMonthlyWriting } from './session-flow.ts';
import {
  allSenses,
  dailyMeaning,
} from "./progress.ts";

export { dailyAssignedIds, pickDaily } from "./daily-allocation.ts";

export function targetIdentity(entryId: string, meaning: string): string {
  return JSON.stringify([entryId, meaning.trim()]);
}

export function entryIdFor(s: Session, id: string): string {
  return s.records[id]?.entryId || id;
}

export function reviewWeeks(state: Pick<State, "sessions">, date: string, selected = weekStart(date)): string[] {
  const weeks = new Set([selected, weekStart(date)]);
  const dates = new Set<string>();
  for (const session of Object.values(state.sessions)) {
    if (session.kind === "weekly") weeks.add(session.period);
    if (session.kind !== "daily") continue;
    dates.add(session.date);
    for (const record of Object.values(session.records))
      if (record.learnedOn) dates.add(record.learnedOn);
  }
  // A date can occur in many records and repeat sessions. Convert it once.
  for (const day of dates) weeks.add(weekStart(day));
  return [...weeks].sort().reverse();
}

export function reviewTargets(
  state: State,
  kind: "weekly" | "monthly",
  period: string,
): LearningTarget[] {
  const targets = new Map<string, LearningTarget>();
  const represented = new Set<string>();
  const weeks = new Map<string, string>();
  const weekOf = (date: string) => {
    let week = weeks.get(date);
    if (week === undefined) { week = weekStart(date); weeks.set(date, week); }
    return week;
  };
  for (const s of Object.values(state.sessions)
    .filter((s) => s.kind === "daily")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const sessionInWeek = kind === "weekly" && weekOf(s.date) === period;
    for (const id of s.ids) {
      const entryId = entryIdFor(s, id),
        r = s.records[id];
      if (!r) continue;
      const learnedOn =
        r.learnedOn ||
        (!r.entryId && state.progress[entryId]?.studyDates?.includes(s.date)
          ? s.date
          : undefined);
      const included =
        kind === "monthly"
          ? learnedOn?.slice(0, 7) === period
          : sessionInWeek || (!!learnedOn && weekOf(learnedOn) === period);
      if (!included) continue;
      targets.set(targetIdentity(entryId, r.meaning), {
        entryId,
        meaning: r.meaning,
        familiarity: r.familiarity,
        material: r.material,
      });
      represented.add(entryId);
    }
  }
  // Older backups may have only progress dates, with no surviving original lesson.
  if (kind === "monthly")
    for (const [entryId, p] of Object.entries(state.progress))
      if (p.studyDates?.some((d) => d.slice(0, 7) === period)) {
        const senses = Object.values(p.senses || {}).filter((x) =>
          x.studyDates?.some((d) => d.slice(0, 7) === period),
        );
        for (const sense of senses.length
          ? senses
          : represented.has(entryId)
            ? []
            : [p]) {
          const meaning = sense.meaning || "",
            key = targetIdentity(entryId, meaning);
          if (!targets.has(key))
            targets.set(key, {
              entryId,
              meaning,
              familiarity: p.familiarity,
              historicalMeaningUnknown: !senses.length,
            });
        }
      }
  return [...targets.values()].sort(
    (a, b) =>
      hash(period + a.entryId) - hash(period + b.entryId) ||
      a.meaning.localeCompare(b.meaning),
  );
}

export function reviewIds(
  state: State,
  kind: "weekly" | "monthly",
  period: string,
): string[] {
  return [...new Set(reviewTargets(state, kind, period).map((t) => t.entryId))];
}

export function pendingReviews(state: State): Session[] {
  return Object.values(state.sessions)
    .map(resumeMonthlyWriting)
    .filter((s) => (s.kind === "weekly" || s.kind === "monthly") && !s.finished)
    .sort(
      (a, b) =>
        a.period.localeCompare(b.period) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export function reviewRemaining(s: Session): number {
  return s.ids.filter(
    (id) => !s.records[id] || !sessionRecordMeasured(s, s.records[id]),
  ).length;
}

export function missingReviewTargets(
  state: State,
  s: Session,
): LearningTarget[] {
  if (s.finished || (s.kind !== "weekly" && s.kind !== "monthly")) return [];
  const assigned = new Set(
    s.ids.map((id) =>
      targetIdentity(entryIdFor(s, id), s.records[id]?.meaning || ""),
    ),
  );
  return reviewTargets(state, s.kind, s.period).filter(
    (t) =>
      !assigned.has(targetIdentity(t.entryId, t.meaning)) &&
      (t.meaning || !s.ids.some((id) => entryIdFor(s, id) === t.entryId)),
  );
}

function hash(v: string): number {
  let h = 0;
  for (const c of v) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function practiceIds(state: State, mode: PracticeMode): string[] {
  if (mode === "repeat") return [];
  return Object.entries(state.progress)
    .filter(([, p]) =>
      mode === "known"
        ? p.familiarity === "known"
        : mode === "ko"
          ? p.ko === "help" || allSenses(p).some((x) => x.ko === "help")
          : p.sentenceStatus === "improve" ||
            allSenses(p).some((x) => x.sentenceStatus === "improve"),
    )
    .map(([id, progress]) => ({ id, lastReviewed: progress.lastReviewed || "", order: hash(id) }))
    .sort(
      (a, b) =>
        a.lastReviewed.localeCompare(b.lastReviewed) || a.order - b.order,
    )
    .slice(0, 20)
    .map(({ id }) => id);
}

export function practiceTargets(
  state: State,
  mode: PracticeMode,
  content: (id: string) => Pick<Content, 'meaning'>,
): LearningTarget[] {
  return practiceIds(state, mode)
    .flatMap((entryId) => {
      const p = state.progress[entryId],
        choices = allSenses(p).filter((x) =>
          mode === "ko"
            ? x.ko === "help"
            : mode === "sentence"
              ? x.sentenceStatus === "improve"
              : true,
        );
      return (
        choices.length
          ? choices.map((x) => x.meaning || content(entryId).meaning)
          : [dailyMeaning(p, content(entryId).meaning)]
      ).map((meaning) => ({ entryId, meaning, familiarity: p?.familiarity }));
    })
    .slice(0, 20);
}
