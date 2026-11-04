import { isExpectedResponseModel, type AiModelId } from './ai-models';
import { FEEDBACK_OUTPUT_LIMITS, FeedbackValidationError } from './provider-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
import type { FeedbackIssueCode } from './feedback-issue';

export const OPENAI_RESPONSE_BYTES = 256 * 1024;

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function openAiHttpError(status: number, body: unknown, retryHeader: string | null) {
  const error = object(object(body).error);
  const billingCodes = ['credit_balance_exhausted', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'insufficient_quota', 'billing_hard_limit_reached'];
  let code: FeedbackIssueCode;
  if (status === 429 && error.code === 'organization_usage_limit_exceeded') code = 'provider_account_limit';
  else if (status === 402 || status === 429 && billingCodes.includes(String(error.code))) code = 'provider_billing';
  else if (status === 429) code = 'provider_limit';
  else if (status === 401) code = 'provider_key_invalid';
  else if (status === 403) code = 'provider_permission';
  else if (status === 404) code = 'provider_model';
  else if ([400, 413, 422].includes(status)) code = 'provider_request';
  else if ([408, 504].includes(status)) code = 'provider_timeout';
  else code = 'provider_unavailable';
  const delay = retryHeader && /^\d+(\.\d+)?$/.test(retryHeader.trim()) ? Math.ceil(Number(retryHeader)) : 0;
  return new FeedbackError(code, status === 429 || status === 402 ? 429 : 503, { providerStatus: status,
    ...(delay > 0 && delay <= 604800 ? { retryAfterSeconds: delay } : {}) });
}

export async function readOpenAiResponse(response: Response, signal: AbortSignal) {
  if (!response.body || response.body.locked) throw new FeedbackValidationError('envelope');
  const reader = response.body.getReader();
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { onAbort = () => reject(signal.reason); });
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    signal.throwIfAborted();
    const length = response.headers.get('content-length');
    if (length && /^\d+$/.test(length) && Number(length) > OPENAI_RESPONSE_BYTES) throw new FeedbackValidationError('content_limit');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0, text = '';
    for (;;) {
      let part: ReadableStreamReadResult<Uint8Array>;
      try { part = await Promise.race([reader.read(), interrupted]); }
      catch {
        signal.throwIfAborted();
        // This is a read failure in a received response body, distinct from a
        // local locked-reader/contract TypeError. Do not include raw errors.
        throw new FeedbackError('provider_network', 503, {}, 'envelope');
      }
      signal.throwIfAborted();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > OPENAI_RESPONSE_BYTES) throw new FeedbackValidationError('content_limit');
      try { text += decoder.decode(part.value, { stream: true }); }
      catch { throw new FeedbackValidationError('content_type'); }
    }
    try { text += decoder.decode(); } catch { throw new FeedbackValidationError('content_type'); }
    return JSON.parse(text) as unknown;
  } finally {
    signal.removeEventListener('abort', onAbort);
    // Cleanup must not extend the deadline or replace the safe original error.
    void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch { /* An interrupted read may still be settling. */ }
  }
}

export function openAiOutputText(value: unknown, requested: AiModelId) {
  const body = object(value);
  const output = Array.isArray(body.output) ? body.output.map(object) : [];
  if (output.some(item => item.type === 'message' && Array.isArray(item.content)
    && item.content.some(part => object(part).type === 'refusal')))
    throw new FeedbackError('provider_blocked', 502, { providerStatus: 200 });
  if (body.status === 'incomplete') {
    const reason = object(body.incomplete_details).reason;
    throw new FeedbackError(reason === 'max_output_tokens' ? 'provider_truncated' : reason === 'content_filter' ? 'provider_blocked' : 'provider_incomplete', 502, { providerStatus: 200 });
  }
  if (['queued', 'in_progress', 'cancelled', 'failed'].includes(String(body.status)))
    throw new FeedbackError(body.status === 'failed' ? 'provider_unavailable' : 'provider_incomplete', 502, { providerStatus: 200 });
  if (body.status !== 'completed' || !Array.isArray(body.output)) throw new FeedbackValidationError('envelope');
  if (!isExpectedResponseModel(requested, body.model)) throw new FeedbackValidationError('model');
  if (output.some(item => item.type !== 'reasoning' && item.type !== 'message')) throw new FeedbackValidationError('envelope');
  const messages = output.filter(item => item.type === 'message');
  if (messages.length !== 1 || messages[0].role !== 'assistant' || messages[0].status !== 'completed' || !Array.isArray(messages[0].content))
    throw new FeedbackValidationError('envelope');
  let text = '';
  for (const raw of messages[0].content) {
    const part = object(raw);
    if (part.type !== 'output_text' || typeof part.text !== 'string') throw new FeedbackValidationError('content_type');
    text += part.text;
    if (text.length > FEEDBACK_OUTPUT_LIMITS.textCharacters) throw new FeedbackValidationError('content_limit');
  }
  if (!text) throw new FeedbackValidationError('content_type');
  return { body, text, actualModel: body.model as AiModelId };
}
