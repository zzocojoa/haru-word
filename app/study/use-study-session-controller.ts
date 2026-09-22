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
import { useStudyDraft } from "./use-study-draft";
import { studyMaterial, withAnswerDraft } from "@/lib/study-draft";
import { recordAvailability } from "@/lib/client-diagnostics";
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
  const {
    question, draft, aiPending, setAiPending,
    setMeaning, setExpression, setExpressionTranslation, setExample, setTranslation, setAnswer,
    setSentence, setNotes, setSpoken, setRevealed, setHint,
  } = useStudyDraft(s, id, content);
  const { meaning, expression, expressionTranslation, example, translation, answer, sentence, notes, spoken, revealed, hint } = draft;
  const busy = storeBusy || aiPending;
  const answerPresent = !!answer.trim();
  useEffect(() => {
    if (visible) recordAvailability("lesson", { storeBusy, aiPending, answerPresent, hinted: hint, revealed }, s.stage);
  }, [visible, storeBusy, aiPending, answerPresent, hint, revealed, s.stage]);
  const focus = useRef<HTMLHeadingElement>(null);
  const [showSummary, setShowSummary] = useState(false);
  useEffect(() => { focus.current?.focus(); }, [question]);

  const { seconds, paused, boutStart, setPaused, setBoutStart } =
    useActivityTimer(s, showSummary, visible);

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
    return studyMaterial(draft, content!, !!word?.personal);
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
    await save({
      ...state,
      sessions: {
        ...state.sessions,
        [s.id]: withAnswerDraft(timed(), id, { ...draft, hint: hinted, revealed: true }),
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
        [s.id]: withAnswerDraft(timed(), id, { ...draft, hint: hinted, revealed: true }),
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
    if (id && s.stage === "sentence")
      next = applyRecord(
        next,
        next.sessions[s.id],
        id,
        { sentence, notes, spoken },
        false,
        activityDate(),
      );
    if (id) {
      next = {
        ...next,
        sessions: {
          ...next.sessions,
          [s.id]: withAnswerDraft(next.sessions[s.id], id, draft),
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
    expressionTranslation,
    setExpression,
    setExpressionTranslation,
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
