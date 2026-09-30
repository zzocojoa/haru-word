import type { Content, Session, State } from './learning/model.ts';
import { currentId } from './learning/session-flow.ts';
import { studyQuestionKey, withAnswerDraft, type StudyDraft } from './study-draft.ts';

// Recovery records are drafts, not submissions. Keep grades, dates, retry queues,
// progress and the cursor exactly as they were in the optimistic store snapshot.
export function studyRecoveryState(state: State, opened: Session, draft: StudyDraft, material?: Content): State {
  const session = state.sessions[opened.id];
  const id = currentId(opened);
  if (!session || !id || session.finished || session.stage === 'checkpoint' || session.stage === 'done'
    || studyQuestionKey(session, currentId(session)) !== studyQuestionKey(opened, id)) return state;
  let next = withAnswerDraft(session, id, draft);
  if (session.stage === 'learn' && material) {
    // Keep the committed meaning identity. studyContent already supports a
    // material draft whose meaning differs; promotion belongs to learn().
    next = { ...session, records: { ...session.records, [id]: {
      ...session.records[id], material: { ...material, meaning: draft.meaning },
    } } };
  } else if (session.stage === 'sentence') {
    next = { ...session, records: { ...session.records, [id]: {
      ...session.records[id], sentence: draft.sentence, notes: draft.notes, spoken: draft.spoken,
    } } };
  }
  return next === session ? state : { ...state, sessions: { ...state.sessions, [session.id]: next } };
}
