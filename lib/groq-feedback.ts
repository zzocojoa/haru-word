import { GROQ_FEEDBACK_MODEL, type SentenceFeedback } from './sentence-feedback';
import { FEEDBACK_OUTPUT_LIMITS, parseProviderFeedback, responseJsonSchema } from './provider-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
import type { FeedbackIssueCode } from './feedback-issue';
import { structureInstruction } from './sentence-structure';

export const GROQ_TIMEOUT_MS = 15000;
export function groqHttpError(status: number, retryHeader: string | null): FeedbackError {
  const delay = retryHeader && /^\d+(\.\d+)?$/.test(retryHeader.trim()) ? Math.ceil(Number(retryHeader)) : 0;
  const code: FeedbackIssueCode = status === 429 ? 'groq_limit' : status === 401 ? 'groq_key_invalid'
    : status === 402 ? 'groq_billing' : status === 403 ? 'groq_permission' : status === 404 ? 'groq_model'
    : [400, 413, 422].includes(status) ? 'groq_request' : status === 504 ? 'groq_timeout' : 'groq_unavailable';
  return new FeedbackError(code, status === 429 ? 429 : 503, { providerStatus: status,
    ...(delay > 0 && delay <= 604800 ? { retryAfterSeconds: delay } : {}) });
}

export async function generateGroqFeedback(key: string, input: { sentence: string; [field: string]: string }, instruction: string, fetcher: typeof fetch = fetch, externalSignal?: AbortSignal): Promise<SentenceFeedback> {
  const deadline = AbortSignal.timeout(GROQ_TIMEOUT_MS);
  const signal = externalSignal ? AbortSignal.any([deadline, externalSignal]) : deadline;
  let response: Response;
  try {
    response = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal,
      body: JSON.stringify({ model: GROQ_FEEDBACK_MODEL, service_tier: 'on_demand', reasoning_effort: 'low', include_reasoning: false,
        max_completion_tokens: FEEDBACK_OUTPUT_LIMITS.tokens, stream: false,
        messages: [{ role: 'system', content: instruction + structureInstruction }, { role: 'user', content: JSON.stringify(input) }],
        response_format: { type: 'json_schema', json_schema: { name: 'sentence_feedback', strict: true, schema: responseJsonSchema } },
      }),
    });
  } catch {
    if (externalSignal?.aborted) throw externalSignal.reason;
    throw new FeedbackError(deadline.aborted ? 'groq_timeout' : 'groq_network', 503);
  }
  if (!response.ok) {
    // Status and Retry-After suffice; never read or log the provider's raw error text.
    await response.body?.cancel().catch(() => { /* Cleanup failure must not hide the received HTTP status. */ });
    throw groqHttpError(response.status, response.headers.get('retry-after'));
  }
  let body: { model?: unknown; choices?: { finish_reason?: unknown; message?: { content?: unknown; refusal?: unknown } }[] } | null;
  try { body = await response.json(); }
  catch (error) {
    if (externalSignal?.aborted) throw externalSignal.reason;
    throw new FeedbackError(deadline.aborted ? 'groq_timeout' : error instanceof TypeError ? 'groq_network' : 'groq_invalid_response', 502, { providerStatus: response.status });
  }
  if (externalSignal?.aborted) throw externalSignal.reason;
  const candidate = Array.isArray(body?.choices) ? body.choices[0] : undefined;
  if (candidate?.finish_reason === 'content_filter' || candidate?.message?.refusal) throw new FeedbackError('groq_blocked', 502, { providerStatus: 200 });
  if (candidate?.finish_reason === 'length') throw new FeedbackError('groq_truncated', 502, { providerStatus: 200 });
  if (candidate?.finish_reason !== 'stop') throw new FeedbackError('groq_incomplete', 502, { providerStatus: 200 });
  try {
    const text = candidate?.message?.content;
    if (body?.model !== GROQ_FEEDBACK_MODEL) throw new Error('Invalid response');
    return parseProviderFeedback(text, input.sentence, GROQ_FEEDBACK_MODEL);
  } catch { throw new FeedbackError('groq_invalid_response', 502, { providerStatus: 200 }); }
}
