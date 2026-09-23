"use client";
import { cardContent } from '@/lib/catalog';
import { assessmentSample, confirmFamiliarity, needsInitialAssessment, revealFamiliarity, type Familiarity, type State, type Word } from '@/lib/learning';
import type { LearningFlowNavigation, SaveLearningState } from './types';

type FamiliarityFlowInput = LearningFlowNavigation & { state: State; words: Word[]; save: SaveLearningState };
export function useFamiliarityFlow({ state, words, save, setAssessing, setPreparing, setShowSession, setTab }: FamiliarityFlowInput) {
  const assessment = state.settings.assessments[state.settings.level];
  const assessed = !!assessment?.completed;
  const initialAssessment = needsInitialAssessment(state);
  const assessmentWord = words.find(word => word.id === assessment?.ids[assessment.index]);
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
  return { assessment, assessed, initialAssessment, assessmentWord, beginAssessment, revealMeaning, markFamiliarity };
}
