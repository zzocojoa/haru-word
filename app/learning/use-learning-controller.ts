"use client";
import { WORDS, cardContent } from "@/lib/catalog";
import {
  assessmentSample,
  confirmFamiliarity,
  dailyAssignedIds,
  ensureCarryover,
  extendReviewSession,
  hasReviewWork,
  learningMetrics,
  needsInitialAssessment,
  newSession,
  pickDaily,
  repeatDailySession,
  revealFamiliarity,
  type Familiarity,
  type Kind,
  type Level,
  type PracticeMode,
  type Session,
} from "@/lib/learning";
import { dailyOrigins } from "@/lib/study-date-correction";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearningStore } from "../use-learning-store";
import { useStudyDate } from "../use-study-date";
import type { View } from "./types";
import { useLearningTools } from "./use-learning-tools";
import { isLearningWriteBlocked } from "@/lib/study-availability";
import { recordAvailability } from "@/lib/client-diagnostics";
export function useLearningController(initialServerTime: number) {
  const store = useLearningStore();
  const {
    state,
    save,
    loading,
    saving,
    error,
    signedIn,
    unsaved,
    conflict,
    current: currentState,
  } = store;
  const [reviewDate, setReviewDate] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [correctingSession, setCorrectingSession] = useState<string | null>(
    null,
  );
  const saveError = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error && !backupOpen)
      saveError.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [error, backupOpen]);
  const [navigation, setNavigation] = useState<{ view: View; visited: View[] }>(
    { view: "today", visited: ["today"] },
  );
  const tab = navigation.view;
  const setTab = useCallback(
    (view: View) =>
      setNavigation((previous) => ({
        view,
        visited: previous.visited.includes(view)
          ? previous.visited
          : [...previous.visited, view],
      })),
    [],
  );
  const [preparing, setPreparing] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [about, setAbout] = useState(false);
  const [settings, setSettings] = useState(false);
  const [message, setMessage] = useState("");
  const words = useMemo(
    () => [
      ...WORDS,
      ...Object.values(state.progress).flatMap((p) =>
        p.personal ? [p.personal] : [],
      ),
    ],
    [state.progress],
  );
  const clock = useStudyDate(initialServerTime);
  const date = clock.date;
  const currentStudyDate = clock.currentDate;
  const busy = isLearningWriteBlocked({ loading, saving, signedIn, unsaved, conflict, clockReady: clock.ready });
  useEffect(() => {
    recordAvailability("app", { loading, saving, signedIn, unsaved, conflict, clockReady: clock.ready, clockSyncing: clock.syncing });
  }, [loading, saving, signedIn, unsaved, conflict, clock.ready, clock.syncing]);
  const active = state.settings.activeSessionId
    ? state.sessions[state.settings.activeSessionId]
    : undefined;
  const todays = Object.values(state.sessions).filter(
    (s) => s.kind === "daily" && s.date === date,
  );
  const unfinished = todays.find((s) => !s.finished);
  const finished = todays.length > 0 && todays.every((s) => s.finished);
  const repeating = Object.values(state.sessions).find(
    (s) =>
      s.kind === "practice" &&
      s.practiceMode === "repeat" &&
      s.period === date &&
      !s.finished,
  );
  const assessment = state.settings.assessments[state.settings.level];
  const assessed = !!assessment?.completed;
  const initialAssessment = needsInitialAssessment(state);
  const assignedIds = useMemo(
    () => dailyAssignedIds(state, date),
    [state, date],
  );
  const remaining = Math.max(0, state.settings.dailyGoal - assignedIds.length);
  const suggestions = useMemo(
    () => pickDaily(words, state, date),
    [words, state, date],
  );
  const metrics = useMemo(() => learningMetrics(state), [state]);
  const carry = metrics.carry;
  // The overview represents the whole study date, including completed rounds
  // before a goal increase. Resuming still uses the original unfinished session.
  const visibleIds = assignedIds.length ? assignedIds : suggestions;
  const origins = useMemo(
    () => dailyOrigins(state, visibleIds, date),
    [state, visibleIds, date],
  );

  async function changeGoal(dailyGoal: number) {
    if (await save({ ...state, settings: { ...state.settings, dailyGoal } })) {
      if (
        finished &&
        dailyGoal > assignedIds.length &&
        showSession &&
        active?.finished
      ) {
        setShowSession(false);
        setTab("today");
      }
      setMessage("");
    }
  }
  async function changeLevel(level: Level) {
    await save({ ...state, settings: { ...state.settings, level } });
    setMessage("");
  }
  async function beginAssessment(level = state.settings.level) {
    let next = { ...state, settings: { ...state.settings, level } };
    const current = state.settings.assessments[level];
    if (!current || current.completed)
      next = {
        ...state,
        settings: {
          ...state.settings,
          level,
          assessments: {
            ...state.settings.assessments,
            [level]: {
              ids: assessmentSample(words, level),
              index: 0,
              marks: {},
              completed: false,
            },
          },
        },
      };
    if (await save(next)) {
      setAssessing(true);
      setPreparing(false);
      setShowSession(false);
      setTab("today");
    }
  }
  async function revealMeaning(
    id: string,
    initial: Familiarity,
    answer: string,
  ) {
    await save({
      ...state,
      progress: {
        ...state.progress,
        [id]: revealFamiliarity(
          state.progress[id],
          initial,
          answer,
          cardContent(id, state.progress[id]).meaning,
        ),
      },
    });
  }
  async function markFamiliarity(f: Familiarity) {
    if (!assessment) return;
    const id = assessment.ids[assessment.index];
    const a = {
      ...assessment,
      index: assessment.index + 1,
      marks: { ...assessment.marks, [id]: f },
      completed: assessment.index + 1 >= assessment.ids.length,
    };
    await save({
      ...state,
      progress: {
        ...state.progress,
        [id]: confirmFamiliarity(state.progress[id], f),
      },
      settings: {
        ...state.settings,
        assessments: {
          ...state.settings.assessments,
          [state.settings.level]: a,
        },
      },
    });
  }
  async function start(
    kind: Kind,
    period?: string,
    existing?: Session,
    practiceMode?: PracticeMode,
  ) {
    if (busy) return;
    if (kind === "daily" && !existing && clock.currentDate() !== date) {
      setMessage(
        "날짜가 바뀌었어요. 오늘 목록이 갱신된 뒤 다시 시작해 주세요.",
      );
      void clock.refresh();
      return;
    }
    if (kind === "daily" && !existing && !unfinished) {
      if (initialAssessment) {
        await beginAssessment();
        return;
      }
      if (
        suggestions.some(
          (id) =>
            !state.progress[id]?.familiarity &&
            !hasReviewWork(state.progress[id]),
        )
      ) {
        setPreparing(true);
        setAssessing(false);
        return;
      }
    }
    const current = existing || (kind === "daily" ? unfinished : undefined);
    let resumed = current;
    try {
      if (current)
        resumed = extendReviewSession(state, words, current, (id) =>
          cardContent(id, state.progress[id]),
        );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "점검을 준비하지 못했어요.",
      );
      return;
    }
    const s = resumed
      ? { ...resumed, paused: false }
      : newSession(
          state,
          words,
          (id) => cardContent(id, state.progress[id]),
          kind,
          clock.currentDate(),
          period,
          practiceMode,
        );
    if (s && !resumed) s.createdAt = new Date(clock.now()).toISOString();
    if (!s) {
      setMessage(
        "학습할 대상이 없어요. 다른 수준을 선택하거나 친숙도를 확인해 주세요.",
      );
      return;
    }
    const next = {
      ...state,
      settings: { ...state.settings, activeSessionId: s.id },
      sessions: { ...state.sessions, [s.id]: s },
    };
    if (await save(s.kind === "daily" ? ensureCarryover(next, s) : next)) {
      setShowSession(true);
      setAssessing(false);
      setPreparing(false);
      setTab("today");
      setMessage("");
    }
  }
  async function repeat(sourceDate: string) {
    if (busy) return;
    const latest = currentState.current;
    const s = repeatDailySession(
      latest,
      words,
      sourceDate,
      clock.currentDate(),
    );
    if (s && !latest.sessions[s.id])
      s.createdAt = new Date(clock.now()).toISOString();
    if (!s) {
      setMessage("일일 학습을 먼저 마친 뒤 다시 학습할 수 있어요.");
      return;
    }
    if (
      await save({
        ...latest,
        settings: { ...latest.settings, activeSessionId: s.id },
        sessions: { ...latest.sessions, [s.id]: s },
      })
    ) {
      setReviewDate(null);
      setShowSession(true);
      setAssessing(false);
      setPreparing(false);
      setTab("today");
      setMessage("");
    }
  }
  function closeSession() {
    setShowSession(false);
    setAssessing(false);
    setPreparing(false);
  }
  function restored() {
    closeSession();
    setReviewDate(null);
    setTab("log");
    setMessage("");
  }
  function openRestore() {
    if ((showSession && active && !active.finished) || assessing || preparing) {
      setTab("today");
      setMessage(
        showSession
          ? "작성 중인 답을 보관하려면 ‘오늘 종료 · 저장’을 누른 뒤 ‘학습 홈으로’ 돌아와서 백업을 가져와 주세요."
          : "친숙도 확인을 마치고 ‘여기까지 저장’으로 홈에 돌아온 뒤 백업을 가져와 주세요.",
      );
      return;
    }
    setBackupOpen(true);
  }
  useLearningTools(currentState, setTab, currentStudyDate);
  const candidate = words.find(
    (w) =>
      w.id ===
      suggestions.find(
        (id) =>
          !state.progress[id]?.familiarity &&
          !hasReviewWork(state.progress[id]),
      ),
  );
  const assessmentWord = assessment?.ids[assessment.index]
    ? words.find((w) => w.id === assessment.ids[assessment.index])
    : undefined;

  return {
    tab,
    showSession,
    active,
    assessing,
    preparing,
    unsaved,
    saving,
    loading,
    signedIn,
    setSettings,
    date,
    store,
    setTab,
    error,
    saveError,
    conflict,
    state,
    message,
    clock,
    currentState,
    words,
    save,
    busy,
    closeSession,
    setReviewDate,
    repeat,
    assessment,
    setAssessing,
    start,
    beginAssessment,
    setMessage,
    assessmentWord,
    revealMeaning,
    markFamiliarity,
    candidate,
    suggestions,
    setPreparing,
    changeLevel,
    finished,
    unfinished,
    remaining,
    assignedIds,
    carry,
    assessed,
    origins,
    todays,
    visibleIds,
    repeating,
    setCorrectingSession,
    initialAssessment,
    metrics,
    navigation,
    openRestore,
    setAbout,
    settings,
    changeGoal,
    correctingSession,
    reviewDate,
    backupOpen,
    setBackupOpen,
    restored,
    about,
  };
}
export type LearningController = ReturnType<typeof useLearningController>;
