"use client";
import { useEffect, useRef, useState } from 'react';
import { sentenceFeedbackSchema, type SentenceFeedback } from '@/lib/sentence-feedback';
import { RequestTimeoutError } from '@/lib/client-request';
import { requestSentenceFeedback } from '@/lib/learning-api';

type Options = {
  sessionId: string;
  entryId: string;
  sentence: string;
  busy: boolean;
  onPending: (value: boolean) => void;
  onFeedback: (feedback: SentenceFeedback) => Promise<boolean>;
};

export function useSentenceFeedback({ sessionId, entryId, sentence, busy, onPending, onFeedback }: Options) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function check() {
    if (lock.current || busy || !sentence.trim()) return;
    lock.current = true;
    setPending(true);
    onPending(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await requestSentenceFeedback({ sessionId, entryId, sentence: sentence.trim() }, controller.signal);
      if (!result.ok) throw new Error(typeof result.data.error === 'string' ? result.data.error : 'AI 응답을 받지 못했어요. 자기 점검으로 계속해 주세요.');
      const parsed = sentenceFeedbackSchema.safeParse(result.data.feedback);
      if (!parsed.success) throw new Error('AI 교정 형식을 확인하지 못했어요. 자기 점검으로 계속해 주세요.');
      if (controller.signal.aborted) return;
      if (parsed.data.original !== sentence.trim()) throw new Error('다른 문장의 교정 결과입니다. 다시 확인해 주세요.');
      // The shared save banner owns persistence errors and clears them after retry.
      await onFeedback(parsed.data);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof RequestTimeoutError
          ? 'AI 응답이 늦어 기다림을 끝냈어요. 문장은 그대로 남아 있으니 자기 점검으로 계속해 주세요. 요청은 사용량에 포함될 수 있어요.'
          : e instanceof Error && !(e instanceof SyntaxError) && !(e instanceof TypeError)
            ? e.message : 'AI 응답을 확인하지 못했어요. 자기 점검으로 계속해 주세요.');
      }
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) {
        setPending(false);
        onPending(false);
      }
    }
  }

  return { pending, error, check };
}
