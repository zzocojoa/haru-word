"use client";
import { studyContent } from "@/lib/catalog";
import {
  applyRecord,
  continueBatch,
  currentId,
  ensureCarryover,
  entryIdFor,
  sessionRecordComplete,
  stepSession,
  type Result,
  type SentenceResult,
  type Session,
  type State,
} from "@/lib/learning";
import type { SentenceFeedback } from "@/lib/sentence-feedback";
import { useEffect, useRef, useState } from "react";
import type { StudySessionProps } from "./types";
import { useActivityTimer } from "./use-activity-timer";
export function useStudySessionController({
  date,
  activityDate,
  currentState,
  state,
  session: s,
  words,
  save,
  busy: storeBusy,
  saved,
  visible,
  onClose,
  onReview,
  onRepeat,
}: StudySessionProps) {
  const [aiPending, setAiPending] = useState(false);
  const busy = storeBusy || aiPending;
  const id = currentId(s);
  const entryId = id ? entryIdFor(s, id) : undefined;
  const word = words.find((w) => w.id === entryId);
  const p = entryId ? state.progress[entryId] : undefined;
  const content = entryId
    ? studyContent(
        entryId,
        s.stage === "warmup" ? undefined : s.records[id!],
        p,
      )
    : undefined;
  const [meaning, setMeaning] = useState("");
  const [expression, setExpression] = useState("");
  const [example, setExample] = useState("");
  const [translation, setTranslation] = useState("");
  const [answer, setAnswer] = useState("");
  const [sentence, setSentence] = useState("");
  const [notes, setNotes] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);

  const focus = useRef<HTMLHeadingElement>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [spoken, setSpoken] = useState(false);
  // Reset local drafts only when the question changes; saves within a question must not erase typing.
  useEffect(() => {
    const c = entryId
      ? studyContent(
          entryId,
          s.stage === "warmup" ? undefined : s.records[id!],
          state.progress[entryId],
        )
      : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeaning(c?.meaning || "");
    setExpression(c?.expression || "");
    setExample(c?.example || "");
    setTranslation(c?.translation || "");
    const draft = s.records[id || ""]?.draft;
    const matching = draft?.stage === s.stage && draft?.retry === s.retryMode;
    setAnswer(
      s.stage === "warmup" && s.warmupDraft && s.warmupDraft.id === id
        ? s.warmupDraft.answer
        : matching
          ? draft.answer
          : "",
    );
    setSentence(s.records[id || ""]?.sentence || "");
    setNotes(s.records[id || ""]?.notes || "");
    setSpoken(!!s.records[id || ""]?.spoken);
    setAiPending(false);
    setRevealed(
      s.stage === "warmup" && s.warmupDraft && s.warmupDraft.id === id
        ? s.warmupDraft.revealed
        : matching
          ? draft.revealed
          : false,
    );
    setHint(
      s.stage === "warmup" && s.warmupDraft && s.warmupDraft.id === id
        ? s.warmupDraft.hinted
        : matching
          ? draft.hinted
          : false,
    );
    focus.current?.focus();
    // Snapshot the saved draft only on a question transition, not on each save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, s.stage, s.retryMode]);

  const { seconds, paused, boutStart, setPaused, setBoutStart } =
    useActivityTimer(s, showSummary, visible);

  useEffect(() => {
    const dirty =
      answer ||
      sentence ||
      notes ||
      (s.stage === "learn" &&
        (meaning !== content?.meaning ||
          expression !== content?.expression ||
          example !== content?.example ||
          translation !== content?.translation));
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [
    answer,
    sentence,
    notes,
    s.stage,
    meaning,
    expression,
    example,
    translation,
    content,
  ]);
  function timed(): Session {
    return { ...s, elapsed: seconds, paused };
  }
  async function commit(next: State) {
    const ns = next.sessions[s.id];
    if (ns?.finished) {
      next = ensureCarryover(next, ns);
      setPaused(true);
    }
    await save(next);
  }

  function material() {
    const edited =
      example !== content?.example || translation !== content?.translation;
    return {
      ...content!,
      meaning: meaning.trim(),
      expression,
      example,
      translation,
      ...(edited
        ? {
            source: word?.personal ? "개인 추가 예문" : "내가 수정한 예문",
            attribution: undefined,
            url: undefined,
          }
        : {}),
    };
  }
  async function learn() {
    if (!id || !meaning.trim()) return;
    await commit(
      applyRecord(
        state,
        timed(),
        id,
        { meaning: meaning.trim(), material: material() },
        true,
        activityDate(),
      ),
    );
  }
  async function revealAnswer(needsHint = false) {
    if (!id || busy) return;
    const hinted = hint || needsHint || !answer.trim();
    setHint(hinted);
    setRevealed(true);
    const session = timed();
    await save({
      ...state,
      sessions: {
        ...state.sessions,
        [s.id]: {
          ...session,
          records: {
            ...s.records,
            [id]: {
              ...s.records[id],
              draft: {
                answer,
                hinted,
                revealed: true,
                stage: s.stage === "en" ? "en" : "ko",
                retry: s.retryMode,
              },
            },
          },
        },
      },
    });
  }
  async function recall(result: Result) {
    if (!id) return;
    const direction = s.stage === "en" ? "en" : "ko";
    await commit(
      applyRecord(
        state,
        timed(),
        id,
        {
          [direction]: hint && result === "independent" ? "help" : result,
          ...(!s.retryMode
            ? {
                [direction === "en" ? "enAnswer" : "koAnswer"]: answer,
                [direction === "en" ? "hintEn" : "hintKo"]: hint,
              }
            : {}),
          draft: undefined,
        },
        true,
        activityDate(),
      ),
    );
  }
  async function warmup(result: Result) {
    if (!id) return;
    result = hint && result === "independent" ? "help" : result;
    await commit({
      ...state,
      progress:
        result === "help"
          ? { ...state.progress, [entryId!]: { ...p, needsReview: true } }
          : state.progress,
      sessions: {
        ...state.sessions,
        [s.id]: stepSession({
          ...timed(),
          warmupDraft: undefined,
          warmupResults: { ...s.warmupResults, [id]: result },
        }),
      },
    });
  }
  async function storeFeedback(feedback: SentenceFeedback) {
    if (!id) return false;
    const latest = currentState.current;
    const session = latest.sessions[s.id];
    if (
      !session ||
      session.finished ||
      session.stage !== "sentence" ||
      currentId(session) !== id
    )
      return false;
    return save({
      ...latest,
      sessions: {
        ...latest.sessions,
        [s.id]: {
          ...session,
          elapsed: Math.max(session.elapsed, seconds),
          records: {
            ...session.records,
            [id]: {
              ...session.records[id],
              sentence: feedback.original,
              notes,
              spoken,
              aiFeedback: feedback,
            },
          },
        },
      },
    });
  }
  async function sentenceDone(result: SentenceResult) {
    if (!id) return;
    await commit(
      applyRecord(
        state,
        timed(),
        id,
        {
          sentenceStatus: result,
          sentence: sentence.trim(),
          notes: notes.trim(),
          spoken,
        },
        true,
        activityDate(),
      ),
    );
  }
  async function revealWarmup() {
    if (!id) return;
    const hinted = !answer.trim();
    setHint(hinted);
    setRevealed(true);
    await save({
      ...state,
      sessions: {
        ...state.sessions,
        [s.id]: {
          ...timed(),
          warmupDraft: { id, answer, hinted, revealed: true },
        },
      },
    });
  }
  async function resume() {
    setBoutStart(seconds);
    setPaused(false);
    setShowSummary(false);
    await save({
      ...state,
      sessions: {
        ...state.sessions,
        [s.id]: { ...continueBatch(s), elapsed: seconds, paused: false },
      },
    });
  }
  async function pauseAndExit() {
    let next = {
      ...state,
      sessions: { ...state.sessions, [s.id]: { ...timed(), paused: true } },
    };
    if (id && s.stage === "learn")
      next.sessions[s.id] = {
        ...next.sessions[s.id],
        records: {
          ...s.records,
          [id]: {
            ...s.records[id],
            meaning: meaning.trim(),
            material: material(),
          },
        },
      };
    if (id && s.stage === "warmup")
      next.sessions[s.id].warmupDraft = { id, answer, hinted: hint, revealed };
    if (id && s.stage === "sentence")
      next = applyRecord(
        next,
        next.sessions[s.id],
        id,
        { sentence, notes, spoken },
        false,
        activityDate(),
      );
    if (id && (s.stage === "en" || s.stage === "ko")) {
      next.sessions[s.id].records = {
        ...next.sessions[s.id].records,
        [id]: {
          ...next.sessions[s.id].records[id],
          draft: {
            answer,
            hinted: hint,
            revealed,
            stage: s.stage,
            retry: s.retryMode,
          },
        },
      };
    }
    next = ensureCarryover(next, next.sessions[s.id]);
    setPaused(true);
    if (await save(next)) setShowSummary(true);
  }
  async function toggleClock() {
    const value = !paused;
    setPaused(value);
    await save({
      ...state,
      sessions: {
        ...state.sessions,
        [s.id]: { ...s, elapsed: seconds, paused: value },
      },
    });
  }
  const total = s.ids.length;
  const completed = Object.values(s.records).filter((r) =>
    sessionRecordComplete(s, r),
  ).length;

  return {
    s,
    showSummary,
    saved,
    date,
    total,
    completed,
    seconds,
    words,
    onClose,
    onReview,
    busy,
    onRepeat,
    resume,
    state,
    pauseAndExit,
    word,
    content,
    boutStart,
    paused,
    toggleClock,
    focus,
    id,
    answer,
    revealed,
    setAnswer,
    hint,
    warmup,
    revealWarmup,
    meaning,
    setMeaning,
    example,
    translation,
    expression,
    setExpression,
    setExample,
    setTranslation,
    learn,
    revealAnswer,
    recall,
    aiPending,
    sentence,
    setSentence,
    spoken,
    setSpoken,
    notes,
    setNotes,
    storeBusy,
    setAiPending,
    storeFeedback,
    sentenceDone,
  };
}
export type StudySessionController = ReturnType<
  typeof useStudySessionController
>;
