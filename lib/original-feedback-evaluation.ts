import { accuracyModels, accuracyPromptHash, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { LESSON_MAP } from './grammar/content';
import { lessonForVersion } from './grammar/content-v3';
import { originalSentenceGrammarInput, originalSentenceGrammarInstruction, originalSentenceWordInstruction } from './original-sentence-feedback';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS, parseProviderFeedback, responseJsonSchema } from './provider-feedback-contract';
import { sentenceFeedbackSchema } from './sentence-feedback';
export { FEEDBACK_VALIDATION_STAGES } from './provider-feedback-contract';
export { FEEDBACK_ISSUES } from './feedback-issue';
export { accuracyCases, accuracyModels } from './english-accuracy';

export const ORIGINAL_FEEDBACK_COMPARISON = 'original-first' as const;
export function parseOriginalAccuracyFeedback(value: unknown) {
  const parsed = sentenceFeedbackSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const f = parsed.data;
  try { parseProviderFeedback(JSON.stringify({ meaningUsage: f.meaningUsage, grammar: f.grammar, correctedSentence: f.correctedSentence,
    explanation: f.explanation, structure: f.structure }), f.original, f.model); }
  catch { return undefined; }
  return parsed.data;
}
export function originalAccuracyRequest(sample: AccuracyCase) {
  return sample.domain === 'word'
    ? { input: { word: sample.word, pos: sample.pos, meaning: sample.meaning, sentence: sample.sentence }, instruction: originalSentenceWordInstruction }
    : { input: originalSentenceGrammarInput(lessonForVersion(LESSON_MAP.get(sample.lessonId)!, 3), sample.sentence), instruction: originalSentenceGrammarInstruction };
}
export async function originalAccuracyHashes(sample: AccuracyCase) {
  const request = originalAccuracyRequest(sample), promptHash = await accuracyPromptHash(request.instruction);
  // Include changed context and output policy, not just the instruction hash.
  const bytes = new TextEncoder().encode(JSON.stringify({ comparison: ORIGINAL_FEEDBACK_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'original-judgment-v1', limits: FEEDBACK_OUTPUT_LIMITS, schema: responseJsonSchema,
    timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS } }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { promptHash, requestHash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
}
// Uses the same activated production builders and direct transports. Never
// calls the fallback wrapper or reads/writes a learner document.
export async function evaluateOriginalAccuracyCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  const { input, instruction } = originalAccuracyRequest(sample);
  const feedback = provider === 'google'
    ? await generateTutorFeedback(config.google_api!, input, instruction, fetcher, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal)
    : await generateGroqFeedback(config.groq_api!, input, instruction, fetcher, config.signal);
  return { feedback, ...await originalAccuracyHashes(sample) };
}
