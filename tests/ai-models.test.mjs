import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_MODELS, AI_REASONING_EFFORT, DEFAULT_AI_MODEL, enabledAiModels, isAiModelEnabled, isExpectedResponseModel, selectedAiModel } from '../lib/ai-models.ts';

test('generation defaults do not mutate legacy or inactive saved selections', () => {
  const settings = { level: 'A1' };
  assert.equal(selectedAiModel(settings), DEFAULT_AI_MODEL);
  assert.deepEqual(settings, { level: 'A1' });
  assert.equal(selectedAiModel({ aiModelId: 'retired-model-v1' }), 'retired-model-v1');
  assert.deepEqual(enabledAiModels(undefined), []);
});
test('deployment allowlist accepts only exact verified catalog IDs without fallback', () => {
  assert.deepEqual(enabledAiModels('gpt-6.1-terra,arbitrary,gpt-6-astra-2026,gpt-6.1-terra'), ['gpt-6.1-terra']);
  assert.equal(isAiModelEnabled(DEFAULT_AI_MODEL, 'gpt-6.1-terra'), false);
  assert.equal(isAiModelEnabled('gpt-6-astra', 'gpt-6-astra'), true);
  for (const model of AI_MODELS) {
    assert.equal(isExpectedResponseModel(model.id, model.id), true);
    assert.equal(isExpectedResponseModel(model.id, model.id + '-unexpected'), false);
    assert.equal(isExpectedResponseModel(model.id, null), false);
  }
  assert.equal(AI_REASONING_EFFORT, 'low');
});
