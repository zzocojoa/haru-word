"use client";
import { useEffect, useRef, useState } from 'react';
import { sentenceFeedbackSchema, type SentenceFeedback } from '@/lib/sentence-feedback';
import { clientFeedbackIssue } from '@/lib/client-feedback-error';
import { FeedbackIssueError, issueFromResponse, type FeedbackIssue } from '@/lib/feedback-issue';
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
  const [error, setError] = useState<FeedbackIssue | null>(null);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function check() {
    if (lock.current || busy || !sentence.trim()) return;
    lock.current = true;
    setPending(true);
    onPending(true);
    setError(null);
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await requestSentenceFeedback({ sessionId, entryId, sentence: sentence.trim() }, controller.signal);
      if (!result.ok) throw new FeedbackIssueError(issueFromResponse(result.data, result.response.status));
      const parsed = sentenceFeedbackSchema.safeParse(result.data?.feedback);
      if (!parsed.success) throw new FeedbackIssueError({ code: 'invalid_response' });
      if (controller.signal.aborted) return;
      if (parsed.data.original !== sentence.trim()) throw new FeedbackIssueError({ code: 'stale_input' });
      // The shared save banner owns persistence errors and clears them after retry.
      await onFeedback(parsed.data);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(clientFeedbackIssue(e));
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
