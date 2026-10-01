import { accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { originalSentenceGrammarInput } from './original-sentence-feedback';
import { LESSON_MAP } from './grammar/content';
import { lessonForVersion } from './grammar/content-v3';
import { chunkedFeedbackContract, chunkedWordInstruction, chunkedGrammarInstruction } from './chunked-feedback';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS } from './provider-feedback-contract';
export { accuracyCases, accuracyModels, FEEDBACK_ISSUES, FEEDBACK_VALIDATION_STAGES, parseOriginalAccuracyFeedback } from './original-feedback-evaluation';
export { FEEDBACK_DIAGNOSTICS } from './provider-feedback-contract';
export { parseFeedbackValidationDetail } from './feedback-validation-detail';
export const FREE_FEEDBACK_COMPARISON = 'chunked-free-v1' as const;
export function freeAccuracyRequest(sample: AccuracyCase) {
  return sample.domain === 'word'
    ? { input: { word: sample.word, pos: sample.pos, meaning: sample.meaning, sentence: sample.sentence }, instruction: chunkedWordInstruction }
    : { input: originalSentenceGrammarInput(lessonForVersion(LESSON_MAP.get(sample.lessonId)!, 3), sample.sentence), instruction: chunkedGrammarInstruction };
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function freeAccuracyHashes(sample: AccuracyCase) {
  const request = freeAccuracyRequest(sample), promptHash = await hash(request.instruction + chunkedFeedbackContract.instruction);
  const requestHash = await hash(JSON.stringify({ comparison: FREE_FEEDBACK_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'chunk-count-v1+original-judgment-v1', schema: chunkedFeedbackContract.schema,
    limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS } }));
  return { promptHash, requestHash };
}
export async function evaluateFreeAccuracyCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  const { input, instruction } = freeAccuracyRequest(sample);
  const quota: { remainingTokens?: number; resetTokensSeconds?: number } = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args);
    const remaining = response.headers.get('x-ratelimit-remaining-tokens');
    const reset = response.headers.get('x-ratelimit-reset-tokens');
    if (remaining && /^\d{1,9}$/.test(remaining)) quota.remainingTokens = Number(remaining);
    if (reset && /^\d+(?:\.\d+)?s$/.test(reset)) {
      const seconds = Number(reset.slice(0, -1));
      if (seconds > 0 && seconds <= 86400) quota.resetTokensSeconds = Math.ceil(seconds);
    }
    return response;
  };
  const feedback = provider === 'google'
    ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, chunkedFeedbackContract)
    : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, chunkedFeedbackContract);
  return { feedback, quota, ...await freeAccuracyHashes(sample) };
}
