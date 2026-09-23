"use client";
import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import type { Content, Progress, Session } from '@/lib/learning';
import { editExpression, expressionDraft } from '@/lib/expression';
import { hasStudyDraftInput, restoreStudyDraft, studyQuestionKey, type StudyDraft } from '@/lib/study-draft';

export function useStudyDraft(session: Session, id: string | undefined, content?: Content, progress?: Progress) {
  const question = studyQuestionKey(session, id);
  const [snapshot, setSnapshot] = useState(() => ({
    question, generation: 0, draft: restoreStudyDraft(session, id, content), aiPending: false, materialBaseline: content, openedProgress: progress,
  }));
  let active = snapshot;
  if (snapshot.question !== question) {
    // Adjust only this component's state before children commit. An effect would
    // first publish the old answer/reveal state under the new question heading.
    active = { question, generation: snapshot.generation + 1, draft: restoreStudyDraft(session, id, content), aiPending: false, materialBaseline: content, openedProgress: progress };
    setSnapshot(active);
  }
  const generation = active.generation;
  const setField = useCallback(<K extends keyof StudyDraft>(field: K, value: SetStateAction<StudyDraft[K]>) => {
    setSnapshot(previous => {
      if (previous.question !== question || previous.generation !== generation) return previous;
      const next = typeof value === 'function' ? value(previous.draft[field]) : value;
      const draft = (field === 'expression' || field === 'meaning' || field === 'expressionTranslation')
        && typeof next === 'string'
        ? editExpression(previous.draft, field, next)
        : { ...previous.draft, [field]: next };
      return draft === previous.draft ? previous : { ...previous, draft };
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
    materialBaseline: active.materialBaseline, openedProgress: active.openedProgress,
    replaceMaterial: (material: Content, latest?: Progress) => setSnapshot(previous =>
      previous.question !== question || previous.generation !== generation ? previous : {
        ...previous, materialBaseline: material, openedProgress: latest,
        draft: { ...previous.draft, ...expressionDraft(material), example: material.example, translation: material.translation },
      }),
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
