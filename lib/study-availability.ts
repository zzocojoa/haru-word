export type LearningWriteStatus = {
  loading: boolean;
  saving: boolean;
  signedIn: boolean;
  unsaved: boolean;
  conflict: boolean;
  clockReady: boolean;
};

// Keep independent reasons available to tests without exposing them in the product UI.
export function learningWriteBlocks(status: LearningWriteStatus) {
  return {
    loading: status.loading,
    saving: status.saving,
    signedOut: !status.signedIn,
    unsaved: status.unsaved,
    conflict: status.conflict,
    clockUnavailable: !status.clockReady,
  };
}

export function isLearningWriteBlocked(status: LearningWriteStatus): boolean {
  return Object.values(learningWriteBlocks(status)).some(Boolean);
}

export function independentRecallBlocks(busy: boolean, hint: boolean, answer: string) {
  return { busy, hinted: hint, emptyAnswer: !answer.trim() };
}

export function canGradeIndependently(busy: boolean, hint: boolean, answer: string): boolean {
  return !Object.values(independentRecallBlocks(busy, hint, answer)).some(Boolean);
}
