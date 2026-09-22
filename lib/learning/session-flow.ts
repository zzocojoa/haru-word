import { type Session, type Stage } from "./model.ts";

export function reviewBatchEnd(s: Session): number {
  const end = s.reviewEnd ?? s.ids.length;
  return s.kind === "monthly" && s.batchSize
    ? Math.min((s.batchStart || 0) + s.batchSize, end)
    : end;
}

export function currentId(s: Session): string | undefined {
  return s.retryMode
    ? s.retry[0]?.id
    : s.stage === "warmup"
      ? s.warmupIds[s.index]
      : s.ids[s.index];
}

export function stepSession(s: Session): Session {
  const id = currentId(s);
  const wordKey = (id: string) => s.wordKeys?.[id] || id;
  // Count distinct intervening words, not elapsed clicks or a repeat of the same word.
  const retry = (s.retryMode ? s.retry.slice(1) : s.retry).map((r) => ({
    ...r,
    seen:
      id && wordKey(r.id) === wordKey(id)
        ? []
        : [
            ...new Map(
              [
                ...(r.seen || []),
                ...(id && ["en", "ko", "sentence"].includes(s.stage)
                  ? [id]
                  : []),
              ].map((seen) => [wordKey(seen), seen]),
            ).values(),
          ],
  }));
  let next: Session;
  if (s.retryMode) {
    const cursor = s.resumeAfterRetry || { stage: "done" as Stage, index: 0 };
    next = { ...s, ...cursor, retryMode: false, resumeAfterRetry: undefined };
  } else {
    const review = s.kind === "monthly" || s.kind === "weekly";
    const start = review ? s.batchStart || 0 : 0;
    const end =
      s.stage === "warmup"
        ? s.warmupIds.length
        : review
          ? reviewBatchEnd(s)
          : s.ids.length;
    if (s.index + 1 < end) next = { ...s, index: s.index + 1 };
    else {
      const sequence: Stage[] =
        s.kind === "daily"
          ? ["warmup", "learn", "en", "ko", "sentence", "done"]
          : s.kind === "monthly"
            ? ["ko", "sentence", "done"]
            : s.practiceMode === "repeat"
              ? ["learn", "en", "ko", "sentence", "done"]
              : s.practiceMode === "ko"
                ? ["ko", "done"]
                : s.practiceMode === "sentence"
                  ? ["sentence", "done"]
                  : ["en", "ko", "sentence", "done"];
      let stage = sequence[sequence.indexOf(s.stage) + 1] || "done";
      if (stage === "done" && review && end < s.ids.length)
        stage = "checkpoint";
      next = {
        ...s,
        stage,
        index: stage === "checkpoint" ? end : stage === "done" ? 0 : start,
      };
    }
  }
  const due = retry.findIndex((r) => (r.seen?.length || 0) >= 2);
  if (due >= 0) {
    const ready = retry[due];
    return {
      ...next,
      retry: [ready, ...retry.filter((_, i) => i !== due)],
      resumeAfterRetry: { stage: next.stage, index: next.index },
      retryMode: true,
      stage: ready.direction,
      finished: false,
      paused: false,
    };
  }
  return {
    ...next,
    retry,
    finished: next.stage === "done",
    paused: next.stage === "done" || next.stage === "checkpoint",
  };
}

export function continueBatch(s: Session): Session {
  return s.stage === "checkpoint"
    ? {
        ...s,
        batchStart: s.index,
        reviewEnd:
          s.reviewEnd && s.index < s.reviewEnd ? s.reviewEnd : undefined,
        stage: s.kind === "weekly" ? "en" : "ko",
        paused: false,
      }
    : s;
}
