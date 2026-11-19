import type { FamiliarityCheck, Level, Settings, State } from './model.ts';

export function firstTestAssessmentEntry(settings: Settings) {
  const assessment = settings.assessments[settings.level];
  if (assessment?.ids.length === 20 && assessment.index === 0 &&
      !assessment.completed && Object.keys(assessment.marks).length === 0) {
    return assessment.ids[0];
  }
}

export function isTestFamiliarityReveal(check: FamiliarityCheck | undefined) {
  return check?.initial === 'new' && check.answer === '' && check.final === undefined;
}

// Reconcile the acknowledged cleanup without replacing other in-memory drafts.
export function removeTestFamiliarityDraft(state: State, level: Level, entryId: string): State {
  const assessments = { ...state.settings.assessments };
  delete assessments[level];
  const progress = { ...state.progress };
  const word = { ...progress[entryId] };
  delete word.familiarityCheck;
  if (Object.keys(word).length) progress[entryId] = word;
  else delete progress[entryId];
  return { ...state, settings: { ...state.settings, assessments }, progress };
}
