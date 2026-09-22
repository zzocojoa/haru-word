import type { Content, RecordItem, Session } from './learning';

export type StudyDraft = {
  meaning: string;
  expression: string;
  expressionTranslation: string;
  example: string;
  translation: string;
  answer: string;
  sentence: string;
  notes: string;
  spoken: boolean;
  revealed: boolean;
  hint: boolean;
};

export function studyQuestionKey(session: Session, id: string | undefined): string {
  return JSON.stringify([session.id, id ?? null, session.stage, session.retryMode]);
}

export function restoreStudyDraft(session: Session, id: string | undefined, content?: Content): StudyDraft {
  const record = session.records[id ?? ''];
  const recall = record?.draft;
  const matching = recall?.stage === session.stage && recall?.retry === session.retryMode;
  const remembered = session.stage === 'warmup' && session.warmupDraft?.id === id
    ? session.warmupDraft : matching ? recall : undefined;
  return {
    meaning: content?.meaning || '',
    expression: content?.expression || '',
    expressionTranslation: content?.expressionTranslation || '',
    example: content?.example || '',
    translation: content?.translation || '',
    answer: remembered?.answer || '',
    sentence: record?.sentence || '',
    notes: record?.notes || '',
    spoken: !!record?.spoken,
    revealed: !!remembered?.revealed,
    hint: !!remembered?.hinted,
  };
}

export function studyMaterial(draft: StudyDraft, content: Content, personal: boolean): Content {
  const edited = draft.example !== content.example || draft.translation !== content.translation;
  return {
    ...content,
    meaning: draft.meaning.trim(),
    expression: draft.expression,
    expressionTranslation: draft.expressionTranslation,
    example: draft.example,
    translation: draft.translation,
    ...(edited ? { source: personal ? '개인 추가 예문' : '내가 수정한 예문', attribution: undefined, url: undefined } : {}),
  };
}

export function recallDraft(draft: StudyDraft, stage: 'en' | 'ko', retry: boolean): NonNullable<RecordItem['draft']> {
  return { answer: draft.answer, hinted: draft.hint, revealed: draft.revealed, stage, retry };
}

export function warmupDraft(draft: StudyDraft, id: string): NonNullable<Session['warmupDraft']> {
  return { id, answer: draft.answer, hinted: draft.hint, revealed: draft.revealed };
}

// Save an answer snapshot without grading, advancing, or changing proficiency.
export function withAnswerDraft(session: Session, id: string, draft: StudyDraft): Session {
  if (session.stage === 'warmup') return { ...session, warmupDraft: warmupDraft(draft, id) };
  if (session.stage !== 'en' && session.stage !== 'ko') return session;
  return {
    ...session,
    records: { ...session.records, [id]: { ...session.records[id], draft: recallDraft(draft, session.stage, session.retryMode) } },
  };
}

export function hasStudyDraftInput(draft: StudyDraft, stage: Session['stage'], content?: Content): boolean {
  return !!(draft.answer || draft.sentence || draft.notes || (stage === 'learn' && (
    draft.meaning !== content?.meaning || draft.expression !== content?.expression ||
    draft.expressionTranslation !== (content?.expressionTranslation || '') ||
    draft.example !== content?.example || draft.translation !== content?.translation
  )));
}
