'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonId } from '@/lib/grammar/model';
import { sentenceFeedbackSchema } from '@/lib/sentence-feedback';
import { requestJson, REQUEST_TIMEOUT_MS } from '@/lib/client-request';
import type { useGrammarDraft } from './use-grammar-draft';

type FeedbackInput = Pick<ReturnType<typeof useGrammarDraft>, 'latest' | 'change' | 'flush'> & {
  lessonId: LessonId;
  canSave: boolean;
};

export function useGrammarFeedback({ lessonId, canSave, latest, change, flush }: FeedbackInput) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);

  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  // Hidden tabs stay mounted. The caller must invalidate on every navigation,
  // as well as on sentence edits; unmount cleanup alone is insufficient.
  const invalidate = useCallback(() => {
    generation.current++;
    request.current?.abort();
    locked.current = false;
    setPending(false);
    setError('');
  }, []);

  async function check() {
    if (locked.current || !canSave || !latest.current.sentence.trim()) return;
    locked.current = true;
    setPending(true);
    setError('');
    const id = ++generation.current;
    const sentence = latest.current.sentence;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => id === generation.current && latest.current.sentence === sentence;
    try {
      if (!await flush()) throw new Error('현재 문장을 먼저 저장해 주세요.');
      if (!isCurrent()) return;
      const result = await requestJson<{ feedback?: unknown; error?: string }>('/api/grammar-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, sentence }), signal: controller.signal,
      }, REQUEST_TIMEOUT_MS.feedback);
      if (!isCurrent()) return;
      if (!result.response.ok) throw new Error(result.data.error || 'AI 점검을 마치지 못했어요.');
      const feedback = sentenceFeedbackSchema.parse(result.data.feedback);
      if (feedback.original !== sentence) throw new Error('현재 문장의 점검 결과인지 확인하지 못했어요.');
      change(progress => ({ ...progress, feedback }));
    } catch (cause) {
      if (id === generation.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'AI 점검을 마치지 못했어요.');
      }
    } finally {
      if (id === generation.current) { locked.current = false; setPending(false); }
    }
  }
  return { pending, error, check, invalidate };
}
