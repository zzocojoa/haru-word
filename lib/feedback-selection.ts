import type { SentenceFeedback } from './sentence-feedback.ts';
import { feedbackMatchesContext } from './feedback-context.ts';

export function latestFeedback(...values: (SentenceFeedback | undefined)[]): SentenceFeedback | undefined {
  return values.filter((f): f is SentenceFeedback => !!f).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// Prefer current identity before timestamps; a future-dated historical backup
// must not hide a matching result. Historical fallback remains display-only.
export function currentFeedback(values: (SentenceFeedback | undefined)[], sentence: string, modelId: string, fingerprint?: string) {
  const matching = values.filter((f): f is SentenceFeedback => !!f && feedbackMatchesContext(f, sentence, modelId, fingerprint));
  return latestFeedback(...(matching.length ? matching : values));
}
