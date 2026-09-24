"use client";
import { WORDS, cardContent } from "@/lib/catalog";
import {
  hasReviewWork,
  learningMetrics,
  type Level,
} from "@/lib/learning";
import { countDailyOrigins, dailyPlan } from "@/lib/learning/daily-allocation";
import { repairMonthlyCarryover } from "@/lib/learning/monthly-carryover-repair";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearningStore } from "../use-learning-store";
import { useStudyDate } from "../use-study-date";
import type { View } from "./types";
import { useFamiliarityFlow } from "./use-familiarity-flow";
import { useSessionCommands } from "./use-session-commands";
import { useLearningTools } from "./use-learning-tools";
import { isLearningWriteBlocked } from "@/lib/study-availability";
import { recordAvailability } from "@/lib/client-diagnostics";
import { useStudyTransition } from './use-study-transition';
import { useLearningMessage } from './use-learning-message';
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
  const { message, messageId, setMessage, dismissMessage } = useLearningMessage();
  useEffect(() => {
    if (error && !backupOpen)
      saveError.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [error, backupOpen]);
  const [navigation, setNavigation] = useState<{ view: View; visited: View[] }>(
    { view: "today", visited: ["today"] },
  );
  const tab = navigation.view;
  const setTab = useCallback(
    (view: View) => {
      setMessage('');
      setNavigation((previous) => ({
        view,
        visited: previous.visited.includes(view)
          ? previous.visited
          : [...previous.visited, view],
      }));
    },
    [setMessage],
  );
  const [preparing, setPreparing] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [about, setAbout] = useState(false);
  const [settings, setSettings] = useState(false);
  const { register: registerLeave, prepare: flushStudy } = useStudyTransition();
  const prepareTransition = useCallback(async () => {
    const ready = await flushStudy();
    if (!ready) {
      setTab('today');
      setMessage('작성 중인 학습을 먼저 확인해 주세요. 저장이나 AI 교정이 끝나고 자료 충돌이 해결되면 다른 회차로 이동할 수 있어요.');
    }
    return ready;
  }, [flushStudy, setTab, setMessage]);
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
  const { assessment, assessed, initialAssessment, assessmentWord, beginAssessment, revealMeaning, markFamiliarity } = useFamiliarityFlow({ state, currentState, prepareTransition, words, save, setAssessing, setPreparing, setShowSession, setTab });
  const allocation = useMemo(
    () => dailyPlan(words, state, date),
    [words, state, date],
  );
  const suggestions = allocation.ids;
  const assignedIds = allocation.assignedIds;
  const remaining = Math.max(0, state.settings.dailyGoal - assignedIds.length);
  const metrics = useMemo(() => learningMetrics(state), [state]);
  const carry = metrics.carry;
  // The overview represents the whole study date, including completed rounds
  // before a goal increase. Resuming still uses the original unfinished session.
  const visibleIds = assignedIds.length ? assignedIds : suggestions;
  const origins = { byId: allocation.origins, ...countDailyOrigins(visibleIds, allocation.origins) };
  const pendingReviewIds = allocation.pendingReviewIds;
  const monthlyRepair = useMemo(() => repairMonthlyCarryover(
    state, words, id => cardContent(id, state.progress[id]), date,
  ), [state, words, date]);

  async function correctMonthlyCarryover() {
    if (busy || showSession || currentStudyDate() !== date) return;
    const latest = currentState.current;
    const repair = repairMonthlyCarryover(latest, words, id => cardContent(id, latest.progress[id]), date);
    if (repair.state === latest) return;
    if (await save(repair.state)) {
      setMessage(`복습 표시 ${repair.cleared}건을 바로잡고, 아직 입력하지 않은 오늘 단어 ${repair.replacements.length}개를 다시 배정했어요. 기존 성적과 월말 점검은 보존했어요.`);
    }
  }

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
  const { start, repeat } = useSessionCommands({ words, currentState, save, clock, date, busy,
    prepareTransition, beginAssessment, setMessage, setReviewDate,
    setPreparing, setAssessing, setShowSession, setTab });
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
    messageId,
    dismissMessage,
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
    pendingReviewIds,
    todays,
    visibleIds,
    repeating,
    setCorrectingSession: async (id: string | null) => {
      if (!id || (!busy && await prepareTransition())) setCorrectingSession(id);
    },
    registerLeave,
    initialAssessment,
    metrics,
    monthlyRepair,
    correctMonthlyCarryover,
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
