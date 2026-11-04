import type { SentenceFeedback } from './sentence-feedback';
import { sentenceFeedbackSchema } from './sentence-feedback';
import { aiModel, AI_PROMPT_VERSION, AI_REASONING_EFFORT, AI_VALIDATION_VERSION, isAiModelEnabled } from './ai-models';
import { defaultFeedbackContract, FEEDBACK_OUTPUT_LIMITS, FeedbackValidationError, type ProviderFeedbackContract } from './provider-feedback-contract';
import { judgmentFeedbackContract } from './judgment-feedback-contract';
import { FeedbackError } from './provider-feedback-error';
import { readOpenAiResponse, openAiOutputText, openAiHttpError } from './openai-response';
export { OPENAI_RESPONSE_BYTES, openAiHttpError } from './openai-response';

export const OPENAI_FEEDBACK_TIMEOUT_MS = 28_000;
export type OpenAiFeedbackConfig = { apiKey?: string; modelId: string; allowedModels?: string; signal?: AbortSignal };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

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
      try { body = await readOpenAiResponse(response, signal); } catch { signal.throwIfAborted(); }
      throw openAiHttpError(response.status, body, response.headers.get('retry-after'));
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      void response.body?.cancel().catch(() => {});
      throw new FeedbackValidationError('content_type');
    }
    const { body, text, actualModel } = openAiOutputText(await readOpenAiResponse(response, signal), model.id);
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
