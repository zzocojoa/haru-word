'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonId } from '@/lib/grammar/model';
import { sentenceFeedbackSchema } from '@/lib/sentence-feedback';
import { requestJson, REQUEST_TIMEOUT_MS } from '@/lib/client-request';
import { clientFeedbackIssue } from '@/lib/client-feedback-error';
import { FeedbackIssueError, issueFromResponse, type FeedbackIssue } from '@/lib/feedback-issue';
import type { useGrammarDraft } from './use-grammar-draft';

type FeedbackInput = Pick<ReturnType<typeof useGrammarDraft>, 'latest' | 'change' | 'flush'> & {
  lessonId: LessonId;
  canSave: boolean;
};

export function useGrammarFeedback({ lessonId, canSave, latest, change, flush }: FeedbackInput) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FeedbackIssue | null>(null);
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
    setError(null);
  }, []);

  async function check() {
    if (locked.current || !canSave || !latest.current.sentence.trim()) return;
    locked.current = true;
    setPending(true);
    setError(null);
    const id = ++generation.current;
    const sentence = latest.current.sentence;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => id === generation.current && latest.current.sentence === sentence;
    try {
      if (!await flush()) throw new FeedbackIssueError({ code: 'save_required' });
      if (!isCurrent()) return;
      const result = await requestJson<{ feedback?: unknown; error?: string }>('/api/grammar-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, sentence }), signal: controller.signal,
      }, REQUEST_TIMEOUT_MS.feedback);
      if (!isCurrent()) return;
      if (!result.response.ok) throw new FeedbackIssueError(issueFromResponse(result.data, result.response.status));
      const parsed = sentenceFeedbackSchema.safeParse(result.data?.feedback);
      if (!parsed.success) throw new FeedbackIssueError({ code: 'invalid_response' });
      const feedback = parsed.data;
      if (feedback.original !== sentence) throw new FeedbackIssueError({ code: 'stale_input' });
      change(progress => ({ ...progress, feedback }));
    } catch (cause) {
      if (id === generation.current && !controller.signal.aborted) {
        setError(clientFeedbackIssue(cause));
      }
    } finally {
      if (id === generation.current) { locked.current = false; setPending(false); }
    }
  }
  return { pending, error, check, invalidate };
}
