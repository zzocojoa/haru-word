'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonId } from '@/lib/grammar/model';
import { FEEDBACK_STRUCTURE_HEADERS } from '@/lib/feedback-compatibility';
import { GRAMMAR_CLIENT_HEADERS } from '@/lib/grammar/compatibility';
import { requestJson, REQUEST_TIMEOUT_MS } from '@/lib/client-request';
import { clientFeedbackIssue } from '@/lib/client-feedback-error';
import { FeedbackIssueError, type FeedbackIssue } from '@/lib/feedback-issue';
import type { useGrammarDraft } from './use-grammar-draft';
import { AI_CONTRACT_HEADERS } from '@/lib/ai-contract';
import { useAiRequests } from '../ai-request-context';
import {useFeedbackRecovery} from '../use-feedback-recovery';
import {feedbackOriginalMatches,type FeedbackContextRequest} from '@/lib/feedback-context';

type FeedbackInput = Pick<ReturnType<typeof useGrammarDraft>, 'latest' | 'change' | 'flush'> & {
  lessonId: LessonId;
  canSave: boolean;
  contentVersion?:number;
  context?:FeedbackContextRequest;
};

export function useGrammarFeedback({ lessonId, canSave,contentVersion, latest, change, flush,context={} }: FeedbackInput) {
  const { modelId, beginRequest } = useAiRequests();
  const recovery=useFeedbackRecovery('grammar',JSON.stringify([lessonId,contentVersion??1]),{sentence:latest.current.sentence,modelId,fingerprint:context.expectedContextFingerprint});
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
    const expectedModelId = modelId;
    const releaseRequest = beginRequest();
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
      const {feedback} = await recovery.run(sentence,expectedModelId,metadata=>requestJson('/api/grammar-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...FEEDBACK_STRUCTURE_HEADERS, ...GRAMMAR_CLIENT_HEADERS, ...AI_CONTRACT_HEADERS },
        body: JSON.stringify({ lessonId, sentence, expectedModelId,...context,...metadata }), signal: controller.signal,
      }, REQUEST_TIMEOUT_MS.feedback),controller.signal,context);
      if (!isCurrent()) return;
      if (!feedbackOriginalMatches(feedback.original,sentence)||feedback.requestedModel!==expectedModelId||context.expectedContextFingerprint&&feedback.contextFingerprint!==context.expectedContextFingerprint) throw new FeedbackIssueError({ code: 'stale_input' });
      change(progress => ({ ...progress, feedback }));
    } catch (cause) {
      if (id === generation.current && !controller.signal.aborted) {
        setError(clientFeedbackIssue(cause));
      }
    } finally {
      releaseRequest();
      if (id === generation.current) { locked.current = false; setPending(false); }
    }
  }
  return { pending, error, check, invalidate,retainedFeedback:recovery.retainedFeedback,recoveryPending:recovery.hasPending };
}
