import fixture from '../tests/fixtures/english-accuracy.json';
import { LESSON_MAP } from './grammar/content';
import { lessonForVersion } from './grammar/content-v3';
import { grammarFeedbackInput, grammarInstruction } from './grammar/feedback';
import { systemInstruction, generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS } from './feedback-fallback';
import { structureInstruction } from './sentence-structure';
import type { LessonId } from './grammar/model';
import type { FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL } from './sentence-feedback';

export type AccuracyProvider = 'google' | 'groq';
export type AccuracyCase = { id: string; sentence: string } &
  ({ domain: 'word'; word: string; pos: string; meaning: string } | { domain: 'grammar'; lessonId: LessonId });
export const accuracyCases = fixture.cases as AccuracyCase[];
export const accuracyModels = { google: FEEDBACK_MODEL, groq: GROQ_FEEDBACK_MODEL };
export function accuracyRequest(sample: AccuracyCase) {
  return sample.domain === 'word'
    ? { input: { word: sample.word, pos: sample.pos, meaning: sample.meaning, sentence: sample.sentence }, instruction: systemInstruction }
    : { input: grammarFeedbackInput(lessonForVersion(LESSON_MAP.get(sample.lessonId)!, 3), sample.sentence), instruction: grammarInstruction };
}
export async function accuracyPromptHash(instruction: string) {
  const bytes = new TextEncoder().encode(instruction + structureInstruction);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
// Direct provider transports, production input/instructions/timeouts; no fallback,
// no retries, no learner-state writes and no application policy changes.
export async function evaluateAccuracyCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  const { input, instruction } = accuracyRequest(sample);
  const feedback = provider === 'google'
    ? await generateTutorFeedback(config.google_api!, input, instruction, fetcher, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal)
    : await generateGroqFeedback(config.groq_api!, input, instruction, fetcher, config.signal);
  return { feedback, promptHash: await accuracyPromptHash(instruction) };
}
