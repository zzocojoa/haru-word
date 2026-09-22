import { type Progress, type SenseProgress, type State } from "./model.ts";

export function senseProgress(
  p: Progress | undefined,
  meaning: string,
): SenseProgress {
  const key = meaning.trim();
  const saved = p?.senses?.[key];
  if (!p || p.meaning?.trim() !== key) return saved || { meaning: key };
  return {
    meaning: key,
    expression: p.expression,
    example: p.example,
    translation: p.translation,
    en: p.en,
    ko: p.ko,
    sentenceStatus: p.sentenceStatus,
    sentence: p.sentence,
    notes: p.notes,
    studyDates: saved ? saved.studyDates : p.studyDates,
    lastStudied: saved ? saved.lastStudied : p.lastStudied,
    lastReviewed: saved ? saved.lastReviewed : p.lastReviewed,
    needsReview: p.needsReview,
  };
}

export function allSenses(p: Progress | undefined): SenseProgress[] {
  const senses = { ...p?.senses };
  if (p?.meaning) senses[p.meaning.trim()] = senseProgress(p, p.meaning);
  return Object.values(senses);
}

export function hasReviewWork(p: Progress | undefined): boolean {
  return !!p?.needsReview || allSenses(p).some((x) => x.needsReview);
}

export function learningMetrics(state: State) {
  const progress = Object.values(state.progress);
  const measured = progress
    .flatMap((p) => {
      const senses = allSenses(p);
      return (senses.length ? senses : [p]).flatMap((x) => [x.en, x.ko]);
    })
    .filter((r) => r && r !== "unmeasured");
  return {
    learned: progress.filter((p) => p.lastStudied).length,
    officialLearned: progress.filter((p) => p.lastStudied && !p.personal)
      .length,
    personalLearned: progress.filter((p) => p.lastStudied && p.personal).length,
    carry: progress.filter(hasReviewWork).length,
    measured: measured.length,
    successes: measured.filter((r) => r === "independent").length,
  };
}

export function storeSense(
  p: Progress | undefined,
  sense: SenseProgress,
): Progress {
  const meaning = sense.meaning?.trim() || "";
  const old = p?.meaning ? senseProgress(p, p.meaning) : undefined;
  const senses = {
    ...p?.senses,
    ...(old ? { [p!.meaning!.trim()]: old } : {}),
    [meaning]: { ...sense, meaning },
  };
  const dates = [
    ...new Set([...(p?.studyDates || []), ...(sense.studyDates || [])]),
  ].sort();
  const result = {
    ...p,
    ...(!p?.meaning || p.meaning.trim() === meaning ? sense : {}),
    senses,
  };
  return {
    ...result,
    ...(dates.length
      ? { studyDates: dates, lastStudied: dates[dates.length - 1] }
      : {}),
    ...(sense.lastReviewed
      ? {
          lastReviewed: [p?.lastReviewed || "", sense.lastReviewed]
            .sort()
            .pop(),
        }
      : {}),
  };
}

export function selectSense(
  p: Progress | undefined,
  sense: SenseProgress,
): Progress {
  const selected: SenseProgress = {
    expression: "",
    example: "",
    translation: "",
    en: "unmeasured",
    ko: "unmeasured",
    sentenceStatus: "unmeasured",
    sentence: "",
    notes: "",
    needsReview: false,
    ...sense,
  };
  const stored = storeSense(p, selected);
  return {
    ...stored,
    ...selected,
    studyDates: stored.studyDates,
    lastStudied: stored.lastStudied,
    lastReviewed: stored.lastReviewed,
  };
}

export function dailyMeaning(
  p: Progress | undefined,
  fallback: string,
): string {
  return (
    allSenses(p)
      .filter((x) => x.needsReview)
      .sort((a, b) =>
        (a.lastReviewed || "").localeCompare(b.lastReviewed || ""),
      )[0]?.meaning ||
    p?.meaning ||
    fallback
  );
}
