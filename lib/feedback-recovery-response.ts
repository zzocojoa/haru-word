import { sentenceFeedbackSchema, type SentenceFeedback } from './sentence-feedback.ts';
import { issueFromResponse, type FeedbackIssue } from './feedback-issue.ts';
import { receiptMetadataSchema } from './feedback-receipt.ts';
import { feedbackMatchesRequest } from './feedback-context.ts';

export type FeedbackRecoveryResponse = { response: Response; data: unknown };
type Expected = { requestId: string; sentence: string; expectedModelId: string; expectedContextFingerprint?: string };
type Result = { ok: true; feedback: SentenceFeedback } | { ok: false; issue: FeedbackIssue; terminal: boolean };

// Pure response policy. A terminal result acknowledges this attempt, never
// authorizes a replacement POST. Ambiguous success keeps the UUID pending.
export function readFeedbackRecoveryResponse(result: FeedbackRecoveryResponse, expected: Expected, lookup: boolean): Result {
  const body = (result.data && typeof result.data === 'object' ? result.data : {}) as Record<string, unknown>;
  const metadata = receiptMetadataSchema.safeParse(body.receipt);
  const invalid = (): Result => ({ ok: false, issue: { code: 'invalid_response' }, terminal: false });
  if (metadata.success && metadata.data.requestId !== expected.requestId) return invalid();
  if (metadata.success && metadata.data.state === 'pending') return { ok: false, issue: { code: 'receipt_pending' }, terminal: false };
  if (result.response.ok && (!metadata.success || metadata.data.state !== 'completed')) return invalid();
  if (!result.response.ok || !metadata.success || metadata.data.state !== 'completed') {
    return { ok: false, issue: issueFromResponse(body, result.response.status),
      terminal: metadata.success && (['failed','expired','invalidated'].includes(metadata.data.state) || lookup && metadata.data.state === 'unknown') };
  }
  const parsed = sentenceFeedbackSchema.safeParse(body.feedback);
  if (!parsed.success || parsed.data.provider !== 'openai'
    || !feedbackMatchesRequest(parsed.data, expected.sentence, expected.expectedModelId, expected.expectedContextFingerprint)) return invalid();
  return { ok: true, feedback: parsed.data };
}
