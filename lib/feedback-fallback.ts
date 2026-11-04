import { FeedbackError } from './provider-feedback-error';
import type { SentenceFeedback } from './sentence-feedback';
import type { ProviderFeedbackContract } from './provider-feedback-contract';

// Legacy metadata is retained for frozen ledgers, never for a new request.
export type FeedbackProviders = { google_api?: string; groq_api?: string; groq_ai_enabled?: string; feedback_original_sentence_enabled?: string; feedback_chunked_enabled?: string; signal?: AbortSignal };
export const GOOGLE_PRIMARY_TIMEOUT_MS = 12000;
const retired = async (): Promise<SentenceFeedback> => { throw new FeedbackError('disabled', 503); };
export const generateFeedbackWithFallback: (config: FeedbackProviders, input: { sentence: string; [field: string]: string }, instruction: string, fetcher?: typeof fetch, contract?: ProviderFeedbackContract) => Promise<SentenceFeedback> = retired;
export const generateSentenceFeedbackWithFallback: (config: FeedbackProviders, input: { word: string; pos: string; meaning: string; sentence: string }, fetcher?: typeof fetch) => Promise<SentenceFeedback> = retired;
