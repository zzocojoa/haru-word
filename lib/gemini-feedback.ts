import type { SentenceFeedback } from './sentence-feedback';
import { FeedbackError } from './provider-feedback-error';
import type { ProviderFeedbackContract } from './provider-feedback-contract';
export { FeedbackError } from './provider-feedback-error';
export { responseJsonSchema } from './provider-feedback-contract';
export { legacySystemInstruction as systemInstruction } from './feedback-prompts';

// Retained call signatures fail closed even if old keys/flags are restored.
const retired = async (): Promise<SentenceFeedback> => { throw new FeedbackError('disabled', 503); };
export const generateSentenceFeedback: (key: string, input: { word: string; pos: string; meaning: string; sentence: string }, fetcher?: typeof fetch) => Promise<SentenceFeedback> = retired;
export const generateTutorFeedback: (key: string, input: { sentence: string; [field: string]: string }, instruction: string, fetcher?: typeof fetch, timeoutMs?: number, externalSignal?: AbortSignal, contract?: ProviderFeedbackContract) => Promise<SentenceFeedback> = retired;
