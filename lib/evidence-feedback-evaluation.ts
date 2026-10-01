import plan from '../data/evaluations/evidence-feedback-plan.json';
import { accuracyCases, accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { freeAccuracyRequest } from './free-feedback-evaluation';
import { parseOriginalAccuracyFeedback } from './original-feedback-evaluation';
import { evidenceFeedbackContract, EVIDENCE_RULES } from './evidence-feedback';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS } from './provider-feedback-contract';
export { accuracyCases, accuracyModels };
export { FEEDBACK_ISSUES, FEEDBACK_VALIDATION_STAGES } from './original-feedback-evaluation';
export { FEEDBACK_DIAGNOSTICS } from './provider-feedback-contract';
export { parseFeedbackValidationDetail } from './feedback-validation-detail';
export const EVIDENCE_FEEDBACK_COMPARISON = 'evidence-v1' as const;
export const evidencePlan = plan;
// Evaluation only: no learner route or activation flag imports this module.
export function evidenceAccuracyRequest(sample: AccuracyCase) {
  return freeAccuracyRequest(sample);
}
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
export async function evidenceAccuracyHashes(sample: AccuracyCase) {
  const request = evidenceAccuracyRequest(sample), promptHash = await hash(request.instruction + evidenceFeedbackContract.instruction);
  const requestHash = await hash(JSON.stringify({ comparison: EVIDENCE_FEEDBACK_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'evidence-v1', schema: evidenceFeedbackContract.schema, rules: EVIDENCE_RULES,
    limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS } }));
  return { promptHash, requestHash };
}
export function evidenceSchedule() {
  return accuracyCases.flatMap(sample => (['google', 'groq'] as const).map(provider => ({ caseId: sample.id, provider })));
}
// Recovery/HTTP validation includes the candidate's persisted judgment invariants.
export function parseEvidenceAccuracyFeedback(value: unknown) {
  const f = parseOriginalAccuracyFeedback(value);
  if (!f?.structure || (f.grammar === 'natural' && f.correctedSentence !== f.original)
      || (f.grammar === 'needs_work' && (!f.correctedSentence.trim() || f.correctedSentence.trim() === f.original.trim()))
      || (f.grammar === 'uncertain' && (f.meaningUsage !== 'uncertain' || f.correctedSentence || f.structure?.status !== 'unavailable'))) return undefined;
  return f;
}
export async function evaluateEvidenceAccuracyCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  const { input, instruction } = evidenceAccuracyRequest(sample), quota: { remainingTokens?: number; resetTokensSeconds?: number } = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args), remaining = response.headers.get('x-ratelimit-remaining-tokens'), reset = response.headers.get('x-ratelimit-reset-tokens');
    if (remaining && /^\d{1,9}$/.test(remaining)) quota.remainingTokens = Number(remaining);
    if (reset && /^\d+(?:\.\d+)?s$/.test(reset)) { const seconds = Number(reset.slice(0, -1)); if (seconds > 0 && seconds <= 86400) quota.resetTokensSeconds = Math.ceil(seconds); }
    return response;
  };
  const feedback = provider === 'google'
    ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, evidenceFeedbackContract)
    : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, evidenceFeedbackContract);
  return { feedback, quota, ...await evidenceAccuracyHashes(sample) };
}
