import plan from '../data/evaluations/accuracy-cause-plan.json';
import { freeAccuracyRequest } from './free-feedback-evaluation';
import { chunkedFeedbackContract } from './chunked-feedback';
import { causeInstructions, type CauseVariant } from './accuracy-cause-candidate';
import { accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS } from './provider-feedback-contract';
export { accuracyCases, accuracyModels, parseOriginalAccuracyFeedback, FEEDBACK_ISSUES, FEEDBACK_VALIDATION_STAGES,
  FEEDBACK_DIAGNOSTICS, parseFeedbackValidationDetail } from './free-feedback-evaluation';
export { CAUSE_FAMILIES } from './accuracy-cause-candidate';
export const ROOT_CAUSE_COMPARISON = 'root-cause-v1' as const;
export const rootCausePlan = plan;
export function allowedCauseVariant(caseId: string, variant: CauseVariant) {
  const entry = plan.cases.find(c => c.caseId === caseId);
  return !!entry && (variant === 'control' || variant === entry.family);
}
export function causeAccuracyRequest(sample: AccuracyCase, variant: CauseVariant) {
  if (!allowedCauseVariant(sample.id, variant)) throw Error('Invalid registered cause pair.');
  const base = freeAccuracyRequest(sample);
  return { input: base.input, instruction: base.instruction + (variant === 'control' ? '' : causeInstructions[variant]) };
}
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
export async function causeAccuracyHashes(sample: AccuracyCase, variant: CauseVariant) {
  const request = causeAccuracyRequest(sample, variant), promptHash = await hash(request.instruction + chunkedFeedbackContract.instruction);
  const requestHash = await hash(JSON.stringify({ comparison: ROOT_CAUSE_COMPARISON, variant, input: request.input, promptHash,
    models: accuracyModels, validation: 'chunk-count-v1+original-judgment-v1', schema: chunkedFeedbackContract.schema,
    limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS } }));
  return { promptHash, requestHash };
}
// Counterbalance AB/BA in adjacent pairs; retain provider order and pacing.
export function causeSchedule() {
  return plan.cases.flatMap((entry, index) => (['google', 'groq'] as const).flatMap((provider, p) => {
    const variants = (index + p) % 2 ? [entry.family, 'control'] : ['control', entry.family];
    return variants.map(variant => ({ caseId: entry.caseId, family: entry.family, variant: variant as CauseVariant, provider }));
  }));
}
export async function evaluateCauseAccuracyCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, variant: CauseVariant, fetcher: typeof fetch = fetch) {
  const { input, instruction } = causeAccuracyRequest(sample, variant), quota: { remainingTokens?: number; resetTokensSeconds?: number } = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args), remaining = response.headers.get('x-ratelimit-remaining-tokens'), reset = response.headers.get('x-ratelimit-reset-tokens');
    if (remaining && /^\d{1,9}$/.test(remaining)) quota.remainingTokens = Number(remaining);
    if (reset && /^\d+(?:\.\d+)?s$/.test(reset)) { const seconds = Number(reset.slice(0, -1)); if (seconds > 0 && seconds <= 86400) quota.resetTokensSeconds = Math.ceil(seconds); }
    return response;
  };
  const feedback = provider === 'google'
    ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, chunkedFeedbackContract)
    : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, chunkedFeedbackContract);
  return { feedback, quota, ...await causeAccuracyHashes(sample, variant) };
}
