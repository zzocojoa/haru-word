import { today } from "./dates.ts";
import {
  type RecordItem,
  type SenseProgress,
  type Session,
  type State,
} from "./model.ts";
import { sessionRecordComplete, sessionRecordMeasured } from "./outcomes.ts";
import { selectSense, senseProgress, storeSense } from "./progress.ts";
import { stepSession } from "./session-flow.ts";
import { entryIdFor } from "./targets.ts";

export function applyRecord(
  state: State,
  s: Session,
  id: string,
  patch: Partial<RecordItem>,
  advance = true,
  activityDate = today(),
): State {
  const wasRetry = s.retryMode;
  if (wasRetry) {
    patch = { ...patch };
    if (patch.en) {
      patch.retryEn = patch.en;
      delete patch.en;
    }
    if (patch.ko) {
      patch.retryKo = patch.ko;
      delete patch.ko;
    }
  }
  const learnedNow = s.kind === "daily" && s.stage === "learn" && advance;
  const record = {
    ...s.records[id],
    ...patch,
    ...(learnedNow ? { learnedOn: activityDate } : {}),
    ...(advance ? { lastPracticedOn: activityDate } : {}),
  };
  const failed = (patch.en === "help" || patch.ko === "help") && !wasRetry;
  const retry = failed
    ? [
        ...s.retry,
        {
          id,
          direction: patch.en ? ("en" as const) : ("ko" as const),
          seen: [],
        },
      ]
    : s.retry;
  const nextSession = { ...s, records: { ...s.records, [id]: record }, retry };
  const entryId = entryIdFor(s, id);
  const original = state.progress[entryId];
  const p = original?.meaning
    ? senseProgress(original, record.meaning)
    : original || {};
  const studyDates = learnedNow
    ? [...new Set([...(p.studyDates || []), activityDate])]
    : p.studyDates;
  // Only the newly assessed dimension changes current progress. Replaying an old
  // record while saving a draft must not restore its obsolete scores or material.
  const en =
    patch.en && patch.en !== "unmeasured"
      ? patch.en
      : (p.en ?? (wasRetry ? record.en : undefined));
  const ko =
    patch.ko && patch.ko !== "unmeasured"
      ? patch.ko
      : (p.ko ?? (wasRetry ? record.ko : undefined));
  const sentenceStatus =
    patch.sentenceStatus && patch.sentenceStatus !== "unmeasured"
      ? patch.sentenceStatus
      : p.sentenceStatus;
  const assessed =
    (!!patch.en && patch.en !== "unmeasured") ||
    (!!patch.ko && patch.ko !== "unmeasured") ||
    (!!patch.sentenceStatus && patch.sentenceStatus !== "unmeasured");
  const complete = sessionRecordComplete(
    s,
    s.kind === "daily"
      ? record
      : {
          ...record,
          en: en || "unmeasured",
          ko: ko || "unmeasured",
          sentenceStatus: sentenceStatus || "unmeasured",
        },
  );
  const otherGap =
    s.practiceMode === "ko"
      ? en !== "independent" || sentenceStatus !== "written"
      : s.practiceMode === "sentence"
        ? en !== "independent" || ko !== "independent"
        : s.kind === "monthly"
          ? en === "help" || sentenceStatus === "improve"
          : false;
  const difficulty =
    en === "help" || ko === "help" || sentenceStatus === "improve";
  const needsReview = difficulty
    ? true
    : assessed && complete && !otherGap
      ? false
      : learnedNow
        ? true
        : p.needsReview;
  const updated: SenseProgress = {
    ...p,
    ...(patch.material
      ? {
          expression: patch.material.expression,
          expressionTranslation: patch.material.expressionTranslation,
          example: patch.material.example,
          translation: patch.material.translation,
        }
      : {}),
    meaning: record.meaning,
    en,
    ko,
    sentenceStatus,
    sentence:
      patch.sentenceStatus && patch.sentenceStatus !== "unmeasured"
        ? (patch.sentence ?? p.sentence)
        : p.sentence,
    notes:
      patch.sentenceStatus && patch.sentenceStatus !== "unmeasured"
        ? (patch.notes ?? p.notes)
        : p.notes,
    studyDates,
    lastStudied: learnedNow ? activityDate : p.lastStudied,
    lastReviewed:
      s.kind !== "daily" && assessed ? activityDate : p.lastReviewed,
    needsReview,
  };
  let progress = storeSense(original, updated);
  if (learnedNow) {
    const assigned = s.records[id]?.meaning;
    if (assigned && assigned !== record.meaning) {
      const prior = senseProgress(progress, assigned);
      // Choosing one specific sense should not leave an unlearned reference gloss due forever.
      if (
        !prior.lastStudied &&
        (!prior.en || prior.en === "unmeasured") &&
        (!prior.ko || prior.ko === "unmeasured") &&
        (!prior.sentenceStatus || prior.sentenceStatus === "unmeasured")
      )
        progress = storeSense(progress, { ...prior, needsReview: false });
    }
    progress = selectSense(progress, updated);
  }
  return {
    ...state,
    progress: { ...state.progress, [entryId]: progress },
    sessions: {
      ...state.sessions,
      [s.id]: advance ? stepSession(nextSession) : nextSession,
    },
  };
}

export function ensureCarryover(state: State, s: Session): State {
  // Optional practice does not create an obligation merely by opening/pausing it.
  // Actual difficulties are already applied by applyRecord to the assessed sense.
  if (s.kind === "practice") return state;
  const progress = { ...state.progress };
  for (const id of s.ids) {
    const r = s.records[id];
    if (r && sessionRecordComplete(s, r)) continue;
    const entryId = entryIdFor(s, id),
      p = progress[entryId],
      sense = senseProgress(p, r?.meaning || p?.meaning || "");
    // Historical errors must not undo a newer successful practice. Unmeasured
    // required work still carries forward without being counted as a failed test.
    if (
      r &&
      sessionRecordMeasured(s, r) &&
      sense.en === "independent" &&
      sense.ko === "independent" &&
      sense.sentenceStatus === "written"
    )
      continue;
    progress[entryId] = storeSense(p, { ...sense, needsReview: true });
  }
  return { ...state, progress };
}
