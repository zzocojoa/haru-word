import plan from '../data/evaluations/token-evidence-plan.json';
import { accuracyCases, accuracyModels, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { freeAccuracyRequest } from './free-feedback-evaluation';
import { parseEvidenceAccuracyFeedback } from './evidence-feedback-evaluation';
import { tokenEvidenceInput, tokenEvidenceFeedbackContract, tokenEvidenceWordInstruction, tokenEvidenceGrammarInstruction } from './token-evidence-feedback';
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
export const TOKEN_EVIDENCE_COMPARISON = 'token-evidence-v1' as const;
export const tokenEvidencePlan = plan;
export const tokenEvidenceCases = plan.caseIds.map(id => {
  const sample = accuracyCases.find(sample => sample.id === id);
  if (!sample) throw new Error('Invalid fixed evaluation case');
  return sample;
});
export const allowedTokenEvidenceCase = (id: string) => plan.caseIds.includes(id);
export const tokenEvidenceSchedule = () => tokenEvidenceCases.flatMap(sample => (['google', 'groq'] as const).map(provider => ({ caseId: sample.id, provider })));
export const parseTokenEvidenceAccuracyFeedback = parseEvidenceAccuracyFeedback;
export function tokenEvidenceRequest(sample: AccuracyCase) {
  return { input: tokenEvidenceInput(freeAccuracyRequest(sample).input),
    instruction: sample.domain === 'word' ? tokenEvidenceWordInstruction : tokenEvidenceGrammarInstruction };
}
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
export async function tokenEvidenceHashes(sample: AccuracyCase) {
  const request = tokenEvidenceRequest(sample), promptHash = await hash(request.instruction + tokenEvidenceFeedbackContract.instruction);
  return { promptHash, requestHash: await hash(JSON.stringify({ comparison: TOKEN_EVIDENCE_COMPARISON, input: request.input, promptHash,
    models: accuracyModels, validation: 'token-evidence-v1-exact-units-hangul-presence', surfaceUnits: 'apostrophe-suffix-v1', schema: tokenEvidenceFeedbackContract.schema,
    rules: EVIDENCE_RULES, limits: FEEDBACK_OUTPUT_LIMITS, timeouts: { google: GOOGLE_PRIMARY_TIMEOUT_MS, groq: GROQ_TIMEOUT_MS }, quota: 'bounded-header-numbers-v1' })) };
}

// Token headers describe TPM; request headers describe RPD. Neither proves TPD
// remaining or the exact threshold that caused a429. No header text is retained.
export type TokenEvidenceQuota = { remainingTokens?: number; resetTokensSeconds?: number; remainingRequests?: number; resetRequestsSeconds?: number };
const quotaFields = ['remainingTokens', 'resetTokensSeconds', 'remainingRequests', 'resetRequestsSeconds'] as const;
export function parseTokenEvidenceQuota(value: unknown): TokenEvidenceQuota | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(k => !quotaFields.includes(k as typeof quotaFields[number]))) return;
  const result: TokenEvidenceQuota = {};
  for (const key of quotaFields) if (raw[key] !== undefined) {
    const number = raw[key];
    if (typeof number !== 'number' || !Number.isInteger(number) || number < (key.startsWith('reset') ? 1 : 0) || number > (key.startsWith('reset') ? 604800 : 1_000_000_000)) return;
    result[key] = number;
  }
  return result;
}
export function tokenEvidenceQuotaHeaders(headers: Headers): TokenEvidenceQuota {
  const quota: TokenEvidenceQuota = {};
  for (const [key, header] of [['remainingTokens', 'x-ratelimit-remaining-tokens'], ['remainingRequests', 'x-ratelimit-remaining-requests']] as const) {
    const value = headers.get(header);
    if (value && /^\d{1,10}$/.test(value) && Number(value) <= 1_000_000_000) quota[key] = Number(value);
  }
  for (const [key, header] of [['resetTokensSeconds', 'x-ratelimit-reset-tokens'], ['resetRequestsSeconds', 'x-ratelimit-reset-requests']] as const) {
    const value = headers.get(header);
    if (!value || value.length > 64) continue;
    // Groq documents durations such as2m59.56s, not just a seconds suffix.
    const duration = /^(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value);
    if (!duration || !duration.slice(1).some(v => v !== undefined)) continue;
    const seconds = Math.ceil(duration.slice(1).reduce((sum, part, i) => sum + Number(part ?? 0) * [86400, 3600, 60, 1][i], 0));
    if (seconds > 0 && seconds <= 604800) quota[key] = seconds;
  }
  return quota;
}
export class TokenEvidenceEvaluationError extends FeedbackError {
  readonly quota: TokenEvidenceQuota;
  constructor(error: FeedbackError, quota: TokenEvidenceQuota) {
    super(error.code, error.status, {
      ...(error.issue.providerStatus !== undefined ? { providerStatus: error.issue.providerStatus } : {}),
      ...(error.issue.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.issue.retryAfterSeconds } : {}),
    }, error.validationStage, error.diagnostic, error.validationDetail);
    this.quota = { ...quota };
  }
}
// One direct call, with the same current transports; no fallback or retries.
// Safe quota is retained on HTTP errors as well as successful synthetic results.
export async function evaluateTokenEvidenceCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  if (!allowedTokenEvidenceCase(sample.id)) throw new Error('Invalid fixed evaluation case');
  const { input, instruction } = tokenEvidenceRequest(sample); let quota: TokenEvidenceQuota = {};
  const measuredFetch: typeof fetch = async (...args) => {
    const response = await fetcher(...args); quota = tokenEvidenceQuotaHeaders(response.headers); return response;
  };
  try {
    const feedback = provider === 'google'
      ? await generateTutorFeedback(config.google_api!, input, instruction, measuredFetch, GOOGLE_PRIMARY_TIMEOUT_MS, config.signal, tokenEvidenceFeedbackContract)
      : await generateGroqFeedback(config.groq_api!, input, instruction, measuredFetch, config.signal, tokenEvidenceFeedbackContract);
    return { feedback, quota, ...await tokenEvidenceHashes(sample) };
  } catch (error) {
    if (error instanceof FeedbackError) throw new TokenEvidenceEvaluationError(error, quota);
    throw error;
  }
}
