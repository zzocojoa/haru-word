// Compatibility entrypoint. Internal modules import their direct dependencies.
export {
  LEVELS,
  MAX_DAILY_GOAL,
  type Level,
  type Familiarity,
  type FamiliarityCheck,
  type Result,
  type SentenceResult,
  type Stage,
  type Kind,
  type PracticeMode,
  type Word,
  type Content,
  type Progress,
  type SenseProgress,
  type Assessment,
  type Settings,
  type RecordItem,
  type Session,
  type State,
  EMPTY,
  RESULT_TEXT,
  FAMILIARITY_TEXT,
  POS,
  SENTENCE_TEXT,
  KIND_TEXT,
  type LearningTarget,
} from "./learning/model.ts";
export { today, weekStart, periodKey } from "./learning/dates.ts";
export {
  emptyRecord,
  isComplete,
  sessionRecordComplete,
  sessionRecordMeasured,
  nextAction,
} from "./learning/outcomes.ts";
export {
  assessmentSample,
  assessmentAdvice,
  recordFamiliarity,
  revealFamiliarity,
  confirmFamiliarity,
  needsInitialAssessment,
} from "./learning/familiarity.ts";
export {
  senseProgress,
  allSenses,
  hasReviewWork,
  learningMetrics,
  storeSense,
  selectSense,
  dailyMeaning,
} from "./learning/progress.ts";
export {
  dailyAssignedIds,
  pickDaily,
  targetIdentity,
  entryIdFor,
  reviewTargets,
  reviewWeeks,
  reviewIds,
  pendingReviews,
  reviewRemaining,
  missingReviewTargets,
  practiceIds,
  practiceTargets,
} from "./learning/targets.ts";
export {
  reviewBatchEnd,
  currentId,
  stepSession,
  continueBatch,
} from "./learning/session-flow.ts";
export {
  extendReviewSession,
  newSession,
  dailyReplaySources,
  repeatDailySession,
} from "./learning/sessions.ts";
export { applyRecord, ensureCarryover } from "./learning/recording.ts";
export { exportLog, exportTutor } from "./learning/exports.ts";
