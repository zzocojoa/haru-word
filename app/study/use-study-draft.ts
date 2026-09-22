"use client";
import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import type { Content, Session } from '@/lib/learning';
import { hasStudyDraftInput, restoreStudyDraft, studyQuestionKey, type StudyDraft } from '@/lib/study-draft';

export function useStudyDraft(session: Session, id: string | undefined, content?: Content) {
  const question = studyQuestionKey(session, id);
  const [snapshot, setSnapshot] = useState(() => ({
    question, generation: 0, draft: restoreStudyDraft(session, id, content), aiPending: false,
  }));
  let active = snapshot;
  if (snapshot.question !== question) {
    // Adjust only this component's state before children commit. An effect would
    // first publish the old answer/reveal state under the new question heading.
    active = { question, generation: snapshot.generation + 1, draft: restoreStudyDraft(session, id, content), aiPending: false };
    setSnapshot(active);
  }
  const generation = active.generation;
  const setField = useCallback(<K extends keyof StudyDraft>(field: K, value: SetStateAction<StudyDraft[K]>) => {
    setSnapshot(previous => {
      if (previous.question !== question || previous.generation !== generation) return previous;
      const next = typeof value === 'function' ? value(previous.draft[field]) : value;
      const changedPhrase = (field === 'expression' || field === 'meaning')
        && String(next).trim() !== String(previous.draft[field]).trim();
      return { ...previous, draft: { ...previous.draft, [field]: next,
        ...(changedPhrase ? { expressionTranslation: '' } : {}),
      } };
    });
  }, [question, generation]);
  const setAiPending = useCallback((value: SetStateAction<boolean>) => {
    setSnapshot(previous => previous.question === question && previous.generation === generation
      ? { ...previous, aiPending: typeof value === 'function' ? value(previous.aiPending) : value } : previous);
  }, [question, generation]);

  const dirty = hasStudyDraftInput(active.draft, session.stage, content);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return {
    question, draft: active.draft, aiPending: active.aiPending, setAiPending,
    setMeaning: (value: SetStateAction<string>) => setField('meaning', value),
    setExpression: (value: SetStateAction<string>) => setField('expression', value),
    setExpressionTranslation: (value: SetStateAction<string>) => setField('expressionTranslation', value),
    setExample: (value: SetStateAction<string>) => setField('example', value),
    setTranslation: (value: SetStateAction<string>) => setField('translation', value),
    setAnswer: (value: SetStateAction<string>) => setField('answer', value),
    setSentence: (value: SetStateAction<string>) => setField('sentence', value),
    setNotes: (value: SetStateAction<string>) => setField('notes', value),
    setSpoken: (value: SetStateAction<boolean>) => setField('spoken', value),
    setRevealed: (value: SetStateAction<boolean>) => setField('revealed', value),
    setHint: (value: SetStateAction<boolean>) => setField('hint', value),
  };
}
