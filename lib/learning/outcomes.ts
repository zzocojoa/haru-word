import { type Familiarity, type RecordItem, type Session } from "./model.ts";

export function emptyRecord(
  meaning = "",
  familiarity?: Familiarity,
): RecordItem {
  return {
    meaning,
    familiarity,
    en: "unmeasured",
    ko: "unmeasured",
    sentenceStatus: "unmeasured",
    sentence: "",
    notes: "",
  };
}

export function isComplete(r: RecordItem): boolean {
  return (
    r.en === "independent" &&
    r.ko === "independent" &&
    r.sentenceStatus === "written"
  );
}

export function sessionRecordComplete(s: Session, r: RecordItem): boolean {
  if (s.kind === "monthly")
    return r.ko === "independent" && r.sentenceStatus !== "improve";
  if (s.kind === "practice" && s.practiceMode === "ko")
    return r.ko === "independent";
  if (s.kind === "practice" && s.practiceMode === "sentence")
    return r.sentenceStatus === "written";
  return isComplete(r);
}

// Measurement and success are different: a checked error is measured, a skipped
// sentence is not a completed weekly check, and monthly sentences are optional.
export function sessionRecordMeasured(s: Session, r: RecordItem): boolean {
  if (s.kind === "monthly" || s.practiceMode === "ko")
    return r.ko !== "unmeasured";
  if (s.practiceMode === "sentence") return r.sentenceStatus !== "unmeasured";
  return (
    r.en !== "unmeasured" &&
    r.ko !== "unmeasured" &&
    r.sentenceStatus !== "unmeasured"
  );
}

export function nextAction(
  r: Pick<RecordItem, "en" | "ko" | "sentenceStatus">,
  s?: Session,
): string {
  if (r.ko === "help") return "뜻→영어 추가 연습";
  if (r.en === "help") return "뜻 다시 익히기";
  if (r.sentenceStatus === "improve") return "문장 보완";
  if (s && sessionRecordComplete(s, r as RecordItem)) return "이후에도 복습";
  return r.en === "unmeasured" || r.ko === "unmeasured"
    ? "미완료 이어서"
    : r.sentenceStatus === "unmeasured"
      ? "문장 작성"
      : "주간·월간 점검";
}
