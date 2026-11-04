import { recordFeedbackAttempt } from '@/db/feedback';
import { withFeedbackRequest, type FeedbackRequestScope } from '@/db/feedback-requests';
import type { ReceiptRequest } from '@/lib/feedback-receipt';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import type { LessonId } from '@/lib/grammar/model';
import { today } from '@/lib/learning';
import { supportsAiContract } from '@/lib/ai-contract';
import { legacyFeedback, supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { feedbackSafetyIssue } from '@/lib/feedback-safety';
import { feedbackErrorBody } from '@/lib/feedback-issue';
import { feedbackProvider } from '@/lib/sentence-feedback';
import { json } from './http';

type Options = {
  db: D1Database;
  userId: string;
  request: Request;
  receipt: ReceiptRequest;
  scope: FeedbackRequestScope;
  started: number;
  contextFingerprint: string;
  contextNote?: string;
  grammar?: { lessonId: LessonId; contentVersion: number };
};

// Domain-specific saved-input/model/version checks and fingerprint construction
// stay in the routes. Only this claimed callback may count and call a provider.
export function executeFeedbackRequest(options: Options, generate: () => Promise<SentenceFeedback>) {
  const { db, userId, request, receipt, scope, started, contextFingerprint, contextNote, grammar } = options;
  const event = scope.domain === 'word' ? 'sentence_feedback' : 'grammar_feedback';
  return withFeedbackRequest(db, userId, receipt, scope, async () => {
    await recordFeedbackAttempt(db, userId, today(), Date.now());
    const generated = await generate();
    const feedback = supportsAiContract(request, 3)
      ? { ...generated, contextFingerprint, ...(contextNote ? { contextNote } : {}) } : generated;
    const safetyIssue = feedbackSafetyIssue(feedback);
    if (safetyIssue) {
      console.warn(JSON.stringify({ event: event + '_withheld', code: 'analysis_conflict', reason: safetyIssue,
        ...(grammar ? { contentVersion: grammar.contentVersion } : {}) }));
      return json(feedbackErrorBody('analysis_conflict'), 422);
    }
    console.info(JSON.stringify({ event: event + '_succeeded', model: feedback.model, provider: feedbackProvider(feedback),
      ...(grammar ? { lessonId: grammar.lessonId, contentVersion: grammar.contentVersion } : {}), durationMs: Date.now() - started }));
    return json({ feedback: supportsFeedbackStructure(request) ? feedback : legacyFeedback(feedback) });
  });
}
