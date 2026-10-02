import plan from '../data/evaluations/relational-evidence-plan.json';
import { accuracyCases, accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { freeAccuracyRequest } from './free-feedback-evaluation';
import { parseEvidenceAccuracyFeedback } from './evidence-feedback-evaluation';
import { relationalEvidenceFeedbackContract, relationalEvidenceWordInstruction, relationalEvidenceGrammarInstruction, relationalEvidenceInput } from './relational-evidence-feedback';
import { tokenEvidenceQuotaHeaders, TokenEvidenceEvaluationError, type TokenEvidenceQuota } from './token-evidence-evaluation';
export { parseTokenEvidenceQuota, tokenEvidenceQuotaHeaders, TokenEvidenceEvaluationError } from './token-evidence-evaluation';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback, GROQ_TIMEOUT_MS } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FEEDBACK_OUTPUT_LIMITS } from './provider-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
export { accuracyModels };
export { FEEDBACK_ISSUES, FEEDBACK_VALIDATION_STAGES } from './original-feedback-evaluation';
export { FEEDBACK_DIAGNOSTICS } from './provider-feedback-contract';
export { parseFeedbackValidationDetail } from './feedback-validation-detail';
export const RELATIONAL_EVIDENCE_COMPARISON = 'relational-evidence-v1' as const;
export const relationalEvidencePlan = plan;
export const relationalEvidenceCases = plan.caseIds.map(id => {
  const sample = accuracyCases.find(sample => sample.id === id);
  if (!sample) throw new Error('Invalid fixed evaluation case');
  return sample;
});
export const allowedRelationalEvidenceCase = (id: string) => plan.caseIds.includes(id);
export const relationalEvidenceSchedule = () => relationalEvidenceCases.flatMap(sample => (['google', 'groq'] as const).map(provider => ({ caseId: sample.id, provider })));
export const parseRelationalEvidenceAccuracyFeedback = parseEvidenceAccuracyFeedback;
export function relationalEvidenceRequest(sample: AccuracyCase) {
  return { input: relationalEvidenceInput(freeAccuracyRequest(sample).input),
    instruction: sample.domain === 'word' ? relationalEvidenceWordInstruction : relationalEvidenceGrammarInstruction };
}
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
export async function relationalEvidenceHashes(sample: AccuracyCase) {
  const request = relationalEvidenceRequest(sample), promptHash = await hash(request.instruction + relationalEvidenceFeedbackContract.instruction);
  return { promptHash, requestHash: await hash(JSON.stringify({ comparison: RELATIONAL_EVIDENCE_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'relational-evidence-v1-unit-context-local-refs-stored-schema', display: 'unicode-governor-excerpt-v1', surfaceUnits: 'apostrophe-suffix-v1', schema: relationalEvidenceFeedbackContract.schema,
    limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS }, quota: 'bounded-header-numbers-v1' })) };
}

// One direct call, with the same current transports; no fallback or retries.
// Safe quota is retained on HTTP errors as well as successful synthetic results.
export async function evaluateRelationalEvidenceCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  if (!allowedRelationalEvidenceCase(sample.id)) throw new Error('Invalid fixed evaluation case');
  const { input, instruction } = relationalEvidenceRequest(sample); let quota: TokenEvidenceQuota = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args); quota = tokenEvidenceQuotaHeaders(response.headers); return response;
  };
  try {
    const feedback = provider === 'google'
      ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, relationalEvidenceFeedbackContract)
      : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, relationalEvidenceFeedbackContract);
    return { feedback, quota, ...await relationalEvidenceHashes(sample) };
  } catch (error) {
    if (error instanceof FeedbackError) throw new TokenEvidenceEvaluationError(error, quota);
    throw error;
  }
}
