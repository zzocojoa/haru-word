import plan from '../data/evaluations/annotated-evidence-plan.json';
import { accuracyCases, accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { freeAccuracyRequest } from './free-feedback-evaluation';
import { parseEvidenceAccuracyFeedback } from './evidence-feedback-evaluation';
import { tokenEvidenceInput } from './token-evidence-feedback';
import { annotatedEvidenceFeedbackContract, annotatedEvidenceWordInstruction, annotatedEvidenceGrammarInstruction, ANNOTATED_PREPOSITION_RULE } from './annotated-evidence-feedback';
import { tokenEvidenceQuotaHeaders, TokenEvidenceEvaluationError, type TokenEvidenceQuota } from './token-evidence-evaluation';
export { parseTokenEvidenceQuota, tokenEvidenceQuotaHeaders, TokenEvidenceEvaluationError } from './token-evidence-evaluation';
import { EVIDENCE_RULES } from './evidence-feedback';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS } from './provider-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
export { accuracyModels };
export { FEEDBACK_ISSUES, FEEDBACK_VALIDATION_STAGES } from './original-feedback-evaluation';
export { FEEDBACK_DIAGNOSTICS } from './provider-feedback-contract';
export { parseFeedbackValidationDetail } from './feedback-validation-detail';
export const ANNOTATED_EVIDENCE_COMPARISON = 'annotated-evidence-v1' as const;
export const annotatedEvidencePlan = plan;
export const annotatedEvidenceCases = plan.caseIds.map(id => {
  const sample = accuracyCases.find(sample => sample.id === id);
  if (!sample) throw new Error('Invalid fixed evaluation case');
  return sample;
});
export const allowedAnnotatedEvidenceCase = (id: string) => plan.caseIds.includes(id);
export const annotatedEvidenceSchedule = () => annotatedEvidenceCases.flatMap(sample => (['google', 'groq'] as const).map(provider => ({ caseId: sample.id, provider })));
export const parseAnnotatedEvidenceAccuracyFeedback = parseEvidenceAccuracyFeedback;
export function annotatedEvidenceRequest(sample: AccuracyCase) {
  return { input: tokenEvidenceInput(freeAccuracyRequest(sample).input),
    instruction: sample.domain === 'word' ? annotatedEvidenceWordInstruction : annotatedEvidenceGrammarInstruction };
}
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
export async function annotatedEvidenceHashes(sample: AccuracyCase) {
  const request = annotatedEvidenceRequest(sample), promptHash = await hash(request.instruction + annotatedEvidenceFeedbackContract.instruction);
  return { promptHash, requestHash: await hash(JSON.stringify({ comparison: ANNOTATED_EVIDENCE_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'annotated-evidence-v1-exact-units-hangul-presence-flat-contradictions', surfaceUnits: 'apostrophe-suffix-v1', schema: annotatedEvidenceFeedbackContract.schema,
    rules: { ...EVIDENCE_RULES, preposition: { ...EVIDENCE_RULES.preposition, text: ANNOTATED_PREPOSITION_RULE } }, limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS }, quota: 'bounded-header-numbers-v1' })) };
}

// One direct call, with the same current transports; no fallback or retries.
// Safe quota is retained on HTTP errors as well as successful synthetic results.
export async function evaluateAnnotatedEvidenceCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  if (!allowedAnnotatedEvidenceCase(sample.id)) throw new Error('Invalid fixed evaluation case');
  const { input, instruction } = annotatedEvidenceRequest(sample); let quota: TokenEvidenceQuota = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args); quota = tokenEvidenceQuotaHeaders(response.headers); return response;
  };
  try {
    const feedback = provider === 'google'
      ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, annotatedEvidenceFeedbackContract)
      : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, annotatedEvidenceFeedbackContract);
    return { feedback, quota, ...await annotatedEvidenceHashes(sample) };
  } catch (error) {
    if (error instanceof FeedbackError) throw new TokenEvidenceEvaluationError(error, quota);
    throw error;
  }
}
