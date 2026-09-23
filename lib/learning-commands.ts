import { applyRecord, ensureCarryover, entryIdFor, recordFamiliarity, selectSense, senseProgress, storeSense, stepSession,
  type Content, type Familiarity, type Progress, type Result, type SenseProgress, type Session, type State } from './learning.ts';
import { withAnswerDraft, type StudyDraft } from './study-draft';
import type { ExpressionDraft } from './expression';

export type WordEdit = ExpressionDraft & {
  example: string; translation: string; notes: string; newSense: boolean;
  familiarity?: Familiarity; familiarityTouched: boolean; useful: boolean;
  encounters: NonNullable<Progress['encounters']>;
};
export function editedWordProgress(base: Progress, selected: SenseProgress | undefined, edit: WordEdit): Progress {
  const edited = selectSense(base, {
    ...selected, meaning: edit.meaning.trim(), expression: edit.expression,
    expressionTranslation: edit.expressionTranslation, example: edit.example,
    translation: edit.translation, notes: edit.notes,
    ...(edit.newSense ? { en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', studyDates: [] as string[], needsReview: true } as const : {}),
  });
  return { ...edited,
    ...(edit.familiarityTouched && edit.familiarity ? recordFamiliarity(edited, edit.familiarity) : {}),
    familiarity: edit.familiarity, useful: edit.useful, encounters: edit.encounters,
  };
}

export function applyWarmupResult(state: State, session: Session, id: string, result: Result, hinted: boolean): State {
  const grade = hinted && result === 'independent' ? 'help' : result;
  const entryId = entryIdFor(session, id);
  return { ...state,
    progress: grade === 'help' ? { ...state.progress, [entryId]: { ...state.progress[entryId], needsReview: true } } : state.progress,
    sessions: { ...state.sessions, [session.id]: stepSession({ ...session, warmupDraft: undefined,
      warmupResults: { ...session.warmupResults, [id]: grade } }) },
  };
}

export function pausedStudyState(state: State, session: Session, id: string | undefined,
  draft: StudyDraft, material: Content | undefined, activityDate: string, materialUpdate?: Partial<Content>): State {
  let next = { ...state, sessions: { ...state.sessions, [session.id]: { ...session, paused: true } } };
  if (id && session.stage === 'learn' && material) {
    next.sessions[session.id] = { ...next.sessions[session.id], records: { ...session.records,
      [id]: { ...session.records[id], meaning: draft.meaning.trim(), material } } };
    if (materialUpdate && Object.keys(materialUpdate).length) {
      const entryId = entryIdFor(session, id), original = state.progress[entryId];
      next = { ...next, progress: { ...next.progress, [entryId]: storeSense(original,
        { ...senseProgress(original, material.meaning), ...materialUpdate, meaning: material.meaning }) } };
    }
  }
  if (id && session.stage === 'sentence') {
    next = applyRecord(next, next.sessions[session.id], id,
      { sentence: draft.sentence, notes: draft.notes, spoken: draft.spoken }, false, activityDate);
  }
  if (id) next = { ...next, sessions: { ...next.sessions,
    [session.id]: withAnswerDraft(next.sessions[session.id], id, draft) } };
  return ensureCarryover(next, next.sessions[session.id]);
}
