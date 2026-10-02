import { accuracyCases, accuracyModels, accuracyRequest, accuracyPromptHash, evaluateAccuracyCase, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import type { FeedbackProviders } from './feedback-fallback';
import { FeedbackError } from './provider-feedback-error';
import { TokenEvidenceEvaluationError, tokenEvidenceQuotaHeaders, type TokenEvidenceQuota } from './token-evidence-evaluation';
import type { GroqHttpDiagnostic } from './groq-http-diagnostics';

export const REASONING_PILOT_COMPARISON = 'reasoning-pilot-v1' as const;
export const reasoningPilotCaseIds = ['grammar-45', 'word-32', 'grammar-55', 'grammar-46', 'grammar-48'] as const;
export const allowedReasoningPilotCase = (id: string) => reasoningPilotCaseIds.some(value => value === id);
export const reasoningPilotCases = reasoningPilotCaseIds.map(id => accuracyCases.find(sample => sample.id === id)!);
export { accuracyModels };
export { sentenceFeedbackSchema } from './sentence-feedback';
export { FEEDBACK_ISSUES } from './original-feedback-evaluation';
export type ReasoningVariant = 'current' | 'high';
export function reasoningPilotSchedule() {
  return reasoningPilotCases.flatMap((sample, index) => (['google', 'groq'] as const).flatMap(provider =>
    (index % 2 ? ['high', 'current'] as const : ['current', 'high'] as const).map(variant => ({ caseId: sample.id, provider, variant }))));
}
export type ReasoningEvidence = { requestHash: string; quota: TokenEvidenceQuota; usage: Record<string, number>; finish?: string; httpError?: GroqHttpDiagnostic };
export class ReasoningPilotError extends TokenEvidenceEvaluationError {
  readonly evidence: ReasoningEvidence;
  constructor(error: FeedbackError, evidence: ReasoningEvidence) {
    super(error, evidence.quota); this.evidence = evidence;
  }
}
const hash = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), b => b.toString(16).padStart(2, '0')).join('');
export function usageEvidence(value: unknown, provider: AccuracyProvider) {
  const result: Record<string, number> = {};
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  const fields = provider === 'google'
    ? [['inputTokens', raw.promptTokenCount], ['outputTokens', raw.candidatesTokenCount], ['reasoningTokens', raw.thoughtsTokenCount], ['totalTokens', raw.totalTokenCount]]
    : [['inputTokens', raw.prompt_tokens], ['outputTokens', raw.completion_tokens], ['reasoningTokens', (raw.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens], ['totalTokens', raw.total_tokens]];
  for (const [field, number] of fields) if (typeof field === 'string' && typeof number === 'number' && Number.isInteger(number) && number >= 0 && number <= 1_000_000_000) result[field] = number;
  return result;
}
// Isolated synthetic evaluation: reuse the operating request, parser, model,
// limits and timeouts. Only this fetch adapter changes reasoning. Learner
// transports and their defaults are never changed.
export async function evaluateReasoningPilotCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, variant: ReasoningVariant, fetcher: typeof fetch = fetch) {
  if (!allowedReasoningPilotCase(sample.id) || !['current', 'high'].includes(variant)) throw new Error('Invalid fixed reasoning case');
  const evidence: ReasoningEvidence = { requestHash: '', quota: {}, usage: {} };
  const measuredFetch: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    if (variant === 'high') {
      if (provider === 'google') body.generationConfig.thinkingConfig = { thinkingLevel: 'HIGH' };
      else body.reasoning_effort = 'high';
    }
    evidence.requestHash = await hash({ url: String(url), body }); // Headers/keys are excluded.
    const response = await fetcher(url, { ...init, body: JSON.stringify(body) });
    evidence.quota = tokenEvidenceQuotaHeaders(response.headers);
    // Retain only bounded numeric usage and allowlisted finish codes, never
    // provider error text, private headers or reasoning traces.
    if (response.ok) try {
      const value = await response.clone().json() as { usageMetadata?: unknown; usage?: unknown; candidates?: { finishReason?: string }[]; choices?: { finish_reason?: string }[] };
      evidence.usage = usageEvidence(provider === 'google' ? value.usageMetadata : value.usage, provider);
      const finish = provider === 'google' ? value.candidates?.[0]?.finishReason : value.choices?.[0]?.finish_reason;
      if (typeof finish === 'string' && ['STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER', 'stop', 'length', 'content_filter'].includes(finish)) evidence.finish = finish;
    } catch { /* The operating parser reports invalid envelopes. */ }
    return response;
  };
  try { return { ...await evaluateAccuracyCase(config, provider, sample, measuredFetch, 1), ...evidence }; }
  catch (error) { if (error instanceof FeedbackError) throw new ReasoningPilotError(error, evidence); throw error; }
}
// Compute the exact wire hash using a local fake response. No provider HTTP.
export async function reasoningPilotProfile(sample: AccuracyCase, provider: AccuracyProvider, variant: ReasoningVariant) {
  try { await evaluateReasoningPilotCase({ google_api: 'synthetic', groq_api: 'synthetic' }, provider, sample, variant, async () => new Response('{}', { status: 400 })); }
  catch (error) { if (error instanceof ReasoningPilotError && error.evidence.requestHash) return { requestHash: error.evidence.requestHash, promptHash: await accuracyPromptHash(accuracyRequest(sample).instruction) }; throw error; }
  throw new Error('Missing synthetic wire evidence');
}
