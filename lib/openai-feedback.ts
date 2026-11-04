import type { SentenceFeedback } from './sentence-feedback';
import { sentenceFeedbackSchema } from './sentence-feedback';
import { aiModel, AI_PROMPT_VERSION, AI_REASONING_EFFORT, AI_VALIDATION_VERSION, isAiModelEnabled, isExpectedResponseModel, type AiModelId } from './ai-models';
import { defaultFeedbackContract, FEEDBACK_OUTPUT_LIMITS, FeedbackValidationError, type ProviderFeedbackContract } from './provider-feedback-contract';
import { judgmentFeedbackContract } from './judgment-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
import type { FeedbackIssueCode } from './feedback-issue';

export const OPENAI_FEEDBACK_TIMEOUT_MS = 28_000;
export const OPENAI_RESPONSE_BYTES = 256 * 1024;
export type OpenAiFeedbackConfig = { apiKey?: string; modelId: string; allowedModels?: string; signal?: AbortSignal };
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

async function boundedResponse(response: Response, signal: AbortSignal) {
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

function outputText(value: unknown, requested: AiModelId) {
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
const tokenCount = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 100_000_000 ? Number(value) : undefined;

type Profile = { contract: ProviderFeedbackContract; promptVersion: string; validationVersion: string };
async function generateFeedback(config: OpenAiFeedbackConfig, input: { sentence: string; [field: string]: string }, instruction: string, profile: Profile, fetcher: typeof fetch): Promise<SentenceFeedback> {
  config.signal?.throwIfAborted();
  const model = aiModel(config.modelId);
  if (!model || !isAiModelEnabled(model.id, config.allowedModels)) throw new FeedbackError('model_unavailable', 503);
  if (!config.apiKey?.trim()) throw new FeedbackError('not_configured', 503);
  const started = Date.now(), deadline = AbortSignal.timeout(OPENAI_FEEDBACK_TIMEOUT_MS);
  const signal = config.signal ? AbortSignal.any([config.signal, deadline]) : deadline;
  try {
    let response: Response;
    try { response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: model.id, instructions: instruction + profile.contract.instruction,
        input: [{ role: 'user', content: JSON.stringify(input) }],
        text: { format: { type: 'json_schema', name: profile.contract === defaultFeedbackContract ? 'study_feedback' : 'study_judgment', strict: true, schema: profile.contract.schema } },
        reasoning: { effort: AI_REASONING_EFFORT }, max_output_tokens: FEEDBACK_OUTPUT_LIMITS.tokens,
        store: false, stream: false, service_tier: 'default',
      }),
    }); } catch {
      if (config.signal?.aborted) throw config.signal.reason;
      throw new FeedbackError(deadline.aborted ? 'provider_timeout' : 'provider_network', 503);
    }
    signal.throwIfAborted();
    if (!response.ok) {
      let body: unknown;
      try { body = await boundedResponse(response, signal); } catch { signal.throwIfAborted(); }
      throw openAiHttpError(response.status, body, response.headers.get('retry-after'));
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      void response.body?.cancel().catch(() => {});
      throw new FeedbackValidationError('content_type');
    }
    const { body, text, actualModel } = outputText(await boundedResponse(response, signal), model.id);
    // Keep the v142 generation contract available while the candidate remains off.
    let wire: unknown;
    try { wire = JSON.parse(text); } catch { throw new FeedbackValidationError('json_syntax'); }
    if (profile.contract === defaultFeedbackContract && !Object.hasOwn(object(wire), 'structure')) throw new FeedbackValidationError('fields');
    const feedback = sentenceFeedbackSchema.parse({ ...profile.contract.parse(text, input.sentence, actualModel,input),
      provider: 'openai', requestedModel: model.id, promptVersion: profile.promptVersion, validationVersion: profile.validationVersion });
    signal.throwIfAborted();
    const usage = object(body.usage), details = object(usage.output_tokens_details);
    const requestId = response.headers.get('x-request-id');
    console.info(JSON.stringify({ event: 'openai_feedback_completed', provider: 'OpenAI', model: actualModel,
      requestedModel: model.id, promptVersion: profile.promptVersion, validationVersion: profile.validationVersion,
      durationMs: Date.now() - started, inputTokens: tokenCount(usage.input_tokens), outputTokens: tokenCount(usage.output_tokens),
      reasoningTokens: tokenCount(details.reasoning_tokens), ...(requestId && /^req_[A-Za-z0-9_-]{1,128}$/.test(requestId) ? { requestId } : {}) }));
    return feedback;
  } catch (error) {
    if (config.signal?.aborted) throw config.signal.reason;
    if (deadline.aborted) throw new FeedbackError('provider_timeout', 503);
    if (error instanceof FeedbackError) throw error;
    // Only fetch rejection and an actual response-body read failure classify as
    // network errors. A local post-response TypeError is an envelope failure.
    throw new FeedbackError('provider_invalid_response', 502, { providerStatus: 200 }, error instanceof FeedbackValidationError ? error.stage : 'envelope',undefined,undefined,error instanceof FeedbackValidationError?error.judgmentReason:undefined);
  }
}

export function generateOpenAiFeedback(config: OpenAiFeedbackConfig, input: { sentence: string; [field: string]: string }, instruction: string, fetcher: typeof fetch = fetch) {
  return generateFeedback(config, input, instruction, { contract: judgmentFeedbackContract, promptVersion: AI_PROMPT_VERSION, validationVersion: AI_VALIDATION_VERSION }, fetcher);
}

export function generateStructuredOpenAiFeedback(config: OpenAiFeedbackConfig, input: { sentence: string; [field: string]: string }, instruction: string, fetcher: typeof fetch = fetch) {
  return generateFeedback(config, input, instruction, { contract: defaultFeedbackContract, promptVersion: 'reference-v1', validationVersion: 'structured-v1' }, fetcher);
}
