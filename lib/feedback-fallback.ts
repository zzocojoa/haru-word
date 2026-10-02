import { generateTutorFeedback, systemInstruction } from './gemini-feedback';
import { generateGroqFeedback } from './groq-feedback';
import { FeedbackError } from './provider-feedback-error';
import type { FeedbackIssueCode } from './feedback-issue';
import { originalSentenceWordInstruction } from './original-sentence-feedback';
import { chunkedFeedbackContract, chunkedWordInstruction } from './chunked-feedback';
import type { ProviderFeedbackContract, ProviderFeedbackInput } from './provider-feedback-contract';
import { coherentFeedbackContract, coherentFeedbackInput, coherentWordInstruction } from './coherent-feedback';

export type FeedbackProviders = { google_api?: string; groq_api?: string; groq_ai_enabled?: string; feedback_original_sentence_enabled?: string; feedback_chunked_enabled?: string; feedback_coherent_enabled?: string; signal?: AbortSignal };
export const GOOGLE_PRIMARY_TIMEOUT_MS = 12000;
// Valid uncertainty and explicit content/policy decisions are not availability failures.
const fallbackCodes = new Set<FeedbackIssueCode>(['not_configured', 'provider_limit', 'provider_minute_limit', 'provider_daily_limit',
  'provider_key_invalid', 'provider_key_blocked', 'provider_permission', 'provider_model', 'provider_precondition',
  'provider_timeout', 'provider_network', 'provider_unavailable', 'provider_truncated', 'provider_incomplete', 'provider_invalid_response']);

export async function generateFeedbackWithFallback(config: FeedbackProviders, input: ProviderFeedbackInput, instruction: string, fetcher: typeof fetch = fetch, contract?: ProviderFeedbackContract) {
  config.signal?.throwIfAborted();
  try {
    if (!config.google_api?.trim()) throw new FeedbackError('not_configured', 503);
    return await generateTutorFeedback(config.google_api, input, instruction, fetcher, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, contract);
  } catch (first) {
    config.signal?.throwIfAborted();
    if (!(first instanceof FeedbackError) || !fallbackCodes.has(first.code)) throw first;
    try {
      if (config.groq_ai_enabled === 'false') throw new FeedbackError('groq_disabled', 503);
      if (!config.groq_api?.trim()) throw new FeedbackError('groq_not_configured', 503);
      return await generateGroqFeedback(config.groq_api, input, instruction, fetcher, config.signal, contract);
    } catch (second) {
      config.signal?.throwIfAborted();
      if (!(second instanceof FeedbackError)) throw second;
      throw new FeedbackError(second.code, second.status, { ...second.issue, previous: first.issue });
    }
  }
}
export function generateSentenceFeedbackWithFallback(config: FeedbackProviders, input: { word: string; pos: string; meaning: string; sentence: string }, fetcher: typeof fetch = fetch) {
  if (config.feedback_coherent_enabled === 'true') return generateFeedbackWithFallback(config, coherentFeedbackInput(input), coherentWordInstruction, fetcher, coherentFeedbackContract);
  if (config.feedback_chunked_enabled === 'true') return generateFeedbackWithFallback(config, input, chunkedWordInstruction, fetcher, chunkedFeedbackContract);
  return generateFeedbackWithFallback(config, input, config.feedback_original_sentence_enabled === 'true' ? originalSentenceWordInstruction : systemInstruction, fetcher);
}
