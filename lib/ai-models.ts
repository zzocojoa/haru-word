// Generation allowlist. Historical readers must use the separate bounded ID schema.
export const AI_MODELS = [
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', inputUsdPerMillion: 2, outputUsdPerMillion: 10 },
  { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
  { id: 'gpt-6-astra', label: 'GPT-6 Astra', inputUsdPerMillion: 10, outputUsdPerMillion: 50 },
] as const;
export type AiModelId = (typeof AI_MODELS)[number]['id'];
export const DEFAULT_AI_MODEL: AiModelId = 'gpt-6.1-sol';
export const AI_MODEL_PRICE_DATE = '2026-11-03';
export const AI_REASONING_EFFORT = 'low' as const;
export const AI_PROMPT_VERSION = 'reference-v5';
export const AI_VALIDATION_VERSION = 'judgment-v5';

export function aiModel(id: string) { return AI_MODELS.find(model => model.id === id); }
export function selectedAiModel(settings: { aiModelId?: string }) { return settings.aiModelId ?? DEFAULT_AI_MODEL; }
// Only explicitly verified deployment entries may generate. Empty is fail-closed.
// Unknown IDs, suffixes, aliases, and arbitrary strings never enter the allowlist.
export function enabledAiModels(value: string | undefined): readonly AiModelId[] {
  const enabled = new Set((value ?? '').split(',').map(id => id.trim()));
  return AI_MODELS.filter(model => enabled.has(model.id)).map(model => model.id);
}
export function isAiModelEnabled(id: string, value: string | undefined) {
  return enabledAiModels(value).some(enabled => enabled === id);
}
export function isExpectedResponseModel(requested: AiModelId, actual: unknown): actual is AiModelId {
  // Current official snapshots equal these exact IDs; never infer a prefix match.
  return actual === requested;
}
