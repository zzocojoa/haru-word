"use client";
import { useEffect, useRef, useState } from 'react';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { clientFeedbackIssue } from '@/lib/client-feedback-error';
import { FeedbackIssueError, type FeedbackIssue } from '@/lib/feedback-issue';
import { requestSentenceFeedback } from '@/lib/learning-api';
import { useAiRequests } from '../ai-request-context';
import {useFeedbackRecovery} from '../use-feedback-recovery';
import type {FeedbackContextRequest} from '@/lib/feedback-context';

type Options = {
  sessionId: string;
  entryId: string;
  sentence: string;
  busy: boolean;
  onPending: (value: boolean) => void;
  onFeedback: (feedback: SentenceFeedback) => Promise<boolean>;
  context?:FeedbackContextRequest;
};

export function useSentenceFeedback({ sessionId, entryId, sentence, busy, onPending, onFeedback,context={} }: Options) {
  const { modelId, beginRequest } = useAiRequests();
  const recovery=useFeedbackRecovery('word',JSON.stringify([sessionId,entryId]),{sentence,modelId,fingerprint:context.expectedContextFingerprint});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FeedbackIssue | null>(null);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function check() {
    if (lock.current || busy || !sentence.trim()) return;
    lock.current = true;
    const expectedModelId = modelId;
    const releaseRequest = beginRequest();
    setPending(true);
    onPending(true);
    setError(null);
    const controller = new AbortController();
    request.current = controller;
    try {
      const {feedback}=await recovery.run(sentence.trim(),expectedModelId,metadata=>requestSentenceFeedback({sessionId,entryId,sentence:sentence.trim(),expectedModelId,...context,...metadata},controller.signal),controller.signal,context);
      if (controller.signal.aborted) return;
      if (feedback.original !== sentence.trim()||feedback.requestedModel!==expectedModelId||context.expectedContextFingerprint&&feedback.contextFingerprint!==context.expectedContextFingerprint) throw new FeedbackIssueError({ code: 'stale_input' });
      // The shared save banner owns persistence errors and clears them after retry.
      await onFeedback(feedback);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(clientFeedbackIssue(e));
      }
    } finally {
      releaseRequest();
      lock.current = false;
      if (!controller.signal.aborted) {
        setPending(false);
        onPending(false);
      }
    }
  }

  return { pending, error, check,retainedFeedback:recovery.retainedFeedback,recoveryPending:recovery.hasPending };
}
