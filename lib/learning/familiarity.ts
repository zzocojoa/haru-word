import {
  type Assessment,
  type Familiarity,
  type Level,
  LEVELS,
  type Progress,
  type State,
  type Word,
} from "./model.ts";
import { hasReviewWork } from "./progress.ts";

// Stratified sample spans the entire selected level, and is stable on resume.
export function assessmentSample(words: Word[], level: Level): string[] {
  const list = words.filter((w) => w.level === level && !w.personal);
  const unique = [...new Map(list.map((w) => [w.headword, w])).values()];
  return Array.from(
    { length: Math.min(20, unique.length) },
    (_, i) =>
      unique[
        Math.floor(((i + 0.5) * unique.length) / Math.min(20, unique.length))
      ].id,
  );
}

export function assessmentAdvice(
  a: Assessment,
  level: Level,
): { text: string; suggested: Level; goal?: number } {
  const counts = Object.values(a.marks).reduce((c, v) => (c[v]++, c), {
    known: 0,
    uncertain: 0,
    new: 0,
  });
  const ix = LEVELS.indexOf(level);
  // A conservative exploration rule for this app, not a CEFR placement score.
  if (counts.known >= 14)
    return ix < LEVELS.length - 1
      ? {
          text: "익숙한 단어가 많아요. 다음 수준에서도 20개를 확인해 보세요.",
          suggested: LEVELS[ix + 1],
        }
      : {
          text: "B2 표본에 익숙한 단어가 많아요. 이 목록의 최고 수준이에요. 아는 단어 후속 점검에서 영어 회상과 문장 사용도 확인해 보세요.",
          suggested: level,
        };
  if (counts.new >= 14)
    return ix
      ? {
          text: "처음 보는 단어가 많아요. 한 수준 아래부터 살펴보세요.",
          suggested: LEVELS[ix - 1],
        }
      : {
          text: "한국어 설명을 활용하며 하루 1~2개로 시작해도 좋아요.",
          suggested: level,
          goal: 2,
        };
  return {
    text: "이 수준에서 시작해 보세요. 뜻이 불확실한 단어부터 고르고, 처음 보는 단어를 이어서 배워요.",
    suggested: level,
  };
}

export function recordFamiliarity(
  p: Progress | undefined,
  familiarity: Familiarity,
): Progress {
  // A renewed difficulty signal reopens completed vocabulary without rewriting test results.
  // Marking a meaning as known never clears an actual recall/sentence weakness.
  return {
    ...p,
    familiarity,
    ...(familiarity !== "known" && p?.lastStudied ? { needsReview: true } : {}),
  };
}

export function revealFamiliarity(
  p: Progress | undefined,
  initial: Familiarity,
  answer: string,
  meaning: string,
): Progress {
  // Keep the original, pre-reveal commitment across saves and devices.
  if (p?.familiarityCheck && !p.familiarityCheck.final) return p;
  return {
    ...p,
    familiarityCheck: { initial, answer: answer.trim(), meaning },
  };
}

export function confirmFamiliarity(
  p: Progress | undefined,
  final: Familiarity,
): Progress {
  const check = p?.familiarityCheck;
  if (!check || check.final)
    throw new Error("뜻을 확인한 뒤 친숙도를 골라 주세요.");
  if (
    final !== check.initial &&
    !(check.initial === "known" && final === "uncertain")
  )
    throw new Error("뜻을 보기 전에 얼마나 알고 있었는지 골라 주세요.");
  return {
    ...recordFamiliarity(p, final),
    familiarityCheck: { ...check, final },
  };
}

export function needsInitialAssessment(state: State): boolean {
  return (
    !state.settings.assessments[state.settings.level]?.completed &&
    !Object.values(state.progress).some(
      (p) => p.lastStudied || hasReviewWork(p),
    )
  );
}
