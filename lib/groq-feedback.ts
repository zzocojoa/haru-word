import type { SentenceFeedback } from './sentence-feedback';
import type { ProviderFeedbackContract } from './provider-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
import type { FeedbackIssueCode } from './feedback-issue';

// Pure historical error interpretation remains available for offline ledgers.
export const GROQ_TIMEOUT_MS = 15000;
export function groqHttpError(status: number, retryHeader: string | null): FeedbackError {
  const delay = retryHeader && /^\d+(\.\d+)?$/.test(retryHeader.trim()) ? Math.ceil(Number(retryHeader)) : 0;
  const code: FeedbackIssueCode = status === 429 ? 'groq_limit' : status === 401 ? 'groq_key_invalid'
    : status === 402 ? 'groq_billing' : status === 403 ? 'groq_permission' : status === 404 ? 'groq_model'
    : [400, 413, 422].includes(status) ? 'groq_request' : status === 504 ? 'groq_timeout' : 'groq_unavailable';
  return new FeedbackError(code, status === 429 ? 429 : 503, { providerStatus: status,
    ...(delay > 0 && delay <= 604800 ? { retryAfterSeconds: delay } : {}) });
}


export const generateGroqFeedback: (key: string, input: { sentence: string; [field: string]: string }, instruction: string, fetcher?: typeof fetch, externalSignal?: AbortSignal, contract?: ProviderFeedbackContract) => Promise<SentenceFeedback> = async () => { throw new FeedbackError('disabled', 503); };
