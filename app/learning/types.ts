import type { Assessment, Familiarity, Kind, Level, PracticeMode, Session, State, Word, learningMetrics } from '@/lib/learning';
import type { dailyOriginSummary } from '@/lib/study-date-correction';
import type { repairMonthlyCarryover } from '@/lib/learning/monthly-carryover-repair';
import type { RefObject } from 'react';
import type { useStudyDate } from '../use-study-date';
export type View = "today" | "library" | "review" | "log";
export type SaveLearningState = (state: State) => Promise<boolean>;
export type LearningFlowNavigation = {
  setAssessing: (value: boolean) => void;
  setPreparing: (value: boolean) => void;
  setShowSession: (value: boolean) => void;
  setTab: (view: View) => void;
};

// View contracts are explicit; changing the coordinator's implementation no longer changes props.
export type LearningStatusProps = {
  loading: boolean; saving: boolean; signedIn: boolean; unsaved: boolean;
  busy: boolean; error: string; conflict: boolean;
  saveError: RefObject<HTMLDivElement | null>;
  store: { load: () => Promise<boolean>; retry: () => Promise<boolean> };
  clock: Pick<ReturnType<typeof useStudyDate>, 'ready' | 'error' | 'syncing' | 'refresh'>;
};
export type LearningCommandProps = {
  save: SaveLearningState;
  changeLevel: (level: Level) => Promise<void>;
  changeGoal: (goal: number) => Promise<void>;
  beginAssessment: (level?: Level) => Promise<void>;
  revealMeaning: (id: string, initial: Familiarity, answer: string) => Promise<void>;
  markFamiliarity: (final: Familiarity) => Promise<void>;
  start: (kind: Kind, period?: string, existing?: Session, practiceMode?: PracticeMode) => Promise<void>;
  repeat: (sourceDate: string) => Promise<void>;
  correctMonthlyCarryover: () => Promise<void>;
};
export type LearningViewProps = LearningStatusProps & LearningCommandProps & LearningFlowNavigation & {
  state: State; words: Word[]; date: string; settings: boolean;
  setSettings: (value: boolean) => void; setMessage: (message: string) => void;
  setReviewDate: (date: string | null) => void; setCorrectingSession: (id: string | null) => void;
  assessment?: Assessment; assessmentWord?: Word; candidate?: Word;
  assessed: boolean; initialAssessment: boolean; finished: boolean;
  unfinished?: Session; repeating?: Session; todays: Session[];
  remaining: number; assignedIds: string[]; visibleIds: string[]; suggestions: string[];
  origins: ReturnType<typeof dailyOriginSummary>;
  metrics: ReturnType<typeof learningMetrics>;
  monthlyRepair: ReturnType<typeof repairMonthlyCarryover>;
};
