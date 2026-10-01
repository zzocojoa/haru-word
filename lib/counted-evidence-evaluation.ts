import plan from '../data/evaluations/counted-evidence-plan.json';
import { accuracyCases, accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { freeAccuracyRequest } from './free-feedback-evaluation';
import { parseEvidenceAccuracyFeedback } from './evidence-feedback-evaluation';
import { countedEvidenceFeedbackContract, countedEvidenceWordInstruction, countedEvidenceGrammarInstruction } from './counted-evidence-feedback';
import { EVIDENCE_RULES } from './evidence-feedback';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS } from './provider-feedback-contract';
export { accuracyCases, accuracyModels };
export { FEEDBACK_ISSUES, FEEDBACK_VALIDATION_STAGES } from './original-feedback-evaluation';
export { FEEDBACK_DIAGNOSTICS } from './provider-feedback-contract';
export { parseFeedbackValidationDetail } from './feedback-validation-detail';
export const COUNTED_EVIDENCE_COMPARISON = 'counted-evidence-v1' as const;
export const countedEvidencePlan = plan;
// Evaluation only: preserve the production learner prompts and activation flags.
export function countedEvidenceRequest(sample: AccuracyCase) {
  return { input: freeAccuracyRequest(sample).input,
    instruction: sample.domain === 'word' ? countedEvidenceWordInstruction : countedEvidenceGrammarInstruction };
}
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
export async function countedEvidenceHashes(sample: AccuracyCase) {
  const request = countedEvidenceRequest(sample), promptHash = await hash(request.instruction + countedEvidenceFeedbackContract.instruction);
  return { promptHash, requestHash: await hash(JSON.stringify({ comparison: COUNTED_EVIDENCE_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'counted-evidence-v1', surfaceUnits: 'apostrophe-suffix-v1', schema: countedEvidenceFeedbackContract.schema,
    rules: EVIDENCE_RULES, limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS } })) };
}
export const countedEvidenceSchedule = () => accuracyCases.flatMap(sample => (['google', 'groq'] as const).map(provider => ({ caseId: sample.id, provider })));
export const parseCountedEvidenceAccuracyFeedback = parseEvidenceAccuracyFeedback;
export async function evaluateCountedEvidenceCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  const { input, instruction } = countedEvidenceRequest(sample), quota: { remainingTokens?: number; resetTokensSeconds?: number } = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args), remaining = response.headers.get('x-ratelimit-remaining-tokens'), reset = response.headers.get('x-ratelimit-reset-tokens');
    if (remaining && /^\d{1,9}$/.test(remaining)) quota.remainingTokens = Number(remaining);
    if (reset && /^\d+(?:\.\d+)?s$/.test(reset)) { const seconds = Number(reset.slice(0, -1)); if (seconds > 0 && seconds <= 86400) quota.resetTokensSeconds = Math.ceil(seconds); }
    return response;
  };
  const feedback = provider === 'google'
    ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, countedEvidenceFeedbackContract)
    : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, countedEvidenceFeedbackContract);
  return { feedback, quota, ...await countedEvidenceHashes(sample) };
}
