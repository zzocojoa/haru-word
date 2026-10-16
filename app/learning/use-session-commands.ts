"use client";
import { cardMeaning } from '@/lib/catalog-basics';
import { resumeMonthlyWriting } from '@/lib/learning/session-flow';
import { ensureCarryover, extendReviewSession, hasReviewWork, needsInitialAssessment, newSession, pickDaily, repeatDailySession, type Kind, type Level, type PracticeMode, type Session, type State, type Word } from '@/lib/learning';
import type { RefObject } from 'react';
import type { useStudyDate } from '../use-study-date';
import type { LearningFlowNavigation, SaveLearningState } from './types';

type SessionCommandInput = LearningFlowNavigation & {
  words: Word[]; currentState: RefObject<State>; save: SaveLearningState;
  clock: ReturnType<typeof useStudyDate>; date: string; busy: boolean;
  prepareTransition: () => Promise<boolean>;
  beginAssessment: (level?: Level) => Promise<void>;
  setMessage: (message: string) => void; setReviewDate: (date: string | null) => void;
};
export function useSessionCommands({ words, currentState, save, clock, date, busy,
  prepareTransition, beginAssessment, setMessage, setReviewDate,
  setPreparing, setAssessing, setShowSession, setTab }: SessionCommandInput) {
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
    if (kind === 'daily' && !existing && needsInitialAssessment(currentState.current)
      && !Object.values(currentState.current.sessions).some(s => s.kind === 'daily' && s.date === date && !s.finished)) {
      await beginAssessment();
      return;
    }
    if (!await prepareTransition()) return;
    const state = currentState.current;
    const unfinished = Object.values(state.sessions).find(s => s.kind === 'daily' && s.date === date && !s.finished);
    const suggestions = pickDaily(words, state, date);
    if (kind === "daily" && !existing && !unfinished) {
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
    const current = (existing && state.sessions[existing.id]) || (kind === "daily" ? unfinished : undefined);
    let resumed = current;
    try {
      if (current)
        resumed = extendReviewSession(state, words, resumeMonthlyWriting(current), (id) =>
          ({ meaning: cardMeaning(id, state.progress[id]) }),
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
          (id) => ({ meaning: cardMeaning(id, state.progress[id]) }),
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
    if (!await prepareTransition()) return;
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
  return { start, repeat };
}
