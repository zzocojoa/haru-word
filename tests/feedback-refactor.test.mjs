import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { sentenceFeedbackPresentation } from '../lib/sentence-feedback-presentation.ts';
import { parseProviderFeedback, responseJsonSchema } from '../lib/provider-feedback-contract.ts';
import fixture from './fixtures/sentence-structure.cjs';

const { feedback, original } = fixture;
const content = { ...feedback };
for (const key of ['original', 'model', 'createdAt']) delete content[key];
const legacy = { ...feedback }; delete legacy.structure;
const unavailable = { ...feedback, structure: { status: 'unavailable', translation: '', parts: [], note: '문맥 확인이 필요해요.' } };
const present = (result, sentence = original, overrides = {}) => sentenceFeedbackPresentation({ sentence, feedback: result, busy: false, pending: false, ...overrides });

test('daily feedback separates retryable structure from a complete or stale result', () => {
  for (const [result, action, label, disabled] of [
    [undefined, 'ready', 'AI로 문장 점검', false],
    [legacy, 'upgradeStructure', '문장 구조 포함해 다시 점검', false],
    [unavailable, 'retryStructure', '문장 구조 다시 점검', false],
    [feedback, 'reviewed', '이 문장의 교정 결과가 있어요', true],
  ]) {
    const view = present(result);
    assert.equal(view.action, action); assert.equal(view.label, label); assert.equal(view.disabled, disabled);
    assert.equal(view.unchanged, !!result);
    if (result) {
      assert.equal(present(result, ' \n' + original + '  ').action, action);
      assert.deepEqual(present(result, 'A different sentence.'), {
        action: 'ready', label: 'AI로 문장 점검', disabled: false, unchanged: false, canApply: true,
      });
    }
  }
});

test('empty drafts, in-flight requests and blocked saves never enable another request', () => {
  for (const result of [undefined, legacy, unavailable, feedback]) {
    for (const sentence of ['', ' \n ', original, 'Changed sentence.']) {
      assert.equal(present(result, sentence, { busy: true }).disabled, true);
      const pending = present(result, sentence, { pending: true });
      assert.equal(pending.disabled, true); assert.equal(pending.action, 'checking');
      assert.equal(pending.label, '문장을 확인하고 있어요');
    }
    assert.equal(present(result, ' \n ').disabled, true);
  }
});

test('suggestion applicability preserves whitespace and never changes the saved result', () => {
  const copy = structuredClone(feedback);
  assert.equal(present(undefined).canApply, false);
  assert.equal(present({ ...feedback, correctedSentence: '' }).canApply, false);
  assert.equal(present(feedback, ' \n' + feedback.correctedSentence + ' ').canApply, false);
  assert.equal(present(feedback).canApply, true);
  assert.deepEqual(feedback, copy);
});

test('shared parser preserves legacy content and unavailable results with server-owned metadata', () => {
  for (const model of ['gemini-3.1-flash-lite', 'openai/gpt-oss-120b']) {
    for (const result of [feedback, legacy, unavailable]) {
      const payload = { ...result };
      for (const key of ['original', 'model', 'createdAt']) delete payload[key];
      const parsed = parseProviderFeedback(JSON.stringify(payload), result.original, model);
      const { createdAt, ...rest } = parsed;
      assert.deepEqual(rest, { ...payload, original: result.original, model });
      assert.ok(Number.isFinite(Date.parse(createdAt)));
    }
  }
  for (const metadata of [{ model: 'spoofed' }, { original: 'spoofed' }, { createdAt: '2000-01-01T00:00:00Z' }]) {
    assert.throws(() => parseProviderFeedback(JSON.stringify({ ...content, ...metadata }), original, feedback.model));
  }
});

test('provider text limit is inclusive and malformed, extra and mismatched structure is rejected', () => {
  const text = JSON.stringify(content);
  assert.ok(parseProviderFeedback(text.padEnd(30000, ' '), original, feedback.model));
  for (const value of [text.padEnd(30001, ' '), null, {}, '', 'not-json', '[]', 'null',
    JSON.stringify({ ...content, unknown: true }),
    JSON.stringify({ ...content, correctedSentence: 'Unrelated words.' }),
    JSON.stringify({ ...content, structure: { ...content.structure, parts: [] } }),
  ]) assert.throws(() => parseProviderFeedback(value, original, feedback.model));
});

await build({ entryPoints: ['lib/gemini-feedback.ts', 'lib/groq-feedback.ts'], outdir: 'work/feedback-refactor-tests', bundle: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { generateSentenceFeedback, responseJsonSchema: legacySchema } = await import('../work/feedback-refactor-tests/gemini-feedback.mjs');
const { generateGroqFeedback } = await import('../work/feedback-refactor-tests/groq-feedback.mjs');

test('both adapters keep the exact output contract, token budget and provider-specific parsing failures', async () => {
  const input = { word: 'trip', pos: 'n.', meaning: '여행', sentence: original };
  const sent = [];
  const mock = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return url.includes('googleapis')
      ? Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(content) }] } }] })
      : Response.json({ model: 'openai/gpt-oss-120b', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] });
  };
  assert.deepEqual((await generateSentenceFeedback('synthetic', input, mock)).structure, feedback.structure);
  assert.deepEqual((await generateGroqFeedback('synthetic', input, 'trusted', mock)).structure, feedback.structure);
  assert.equal(sent[0].generationConfig.maxOutputTokens, 4096);
  assert.equal(sent[1].max_completion_tokens, 4096);
  assert.deepEqual(sent[0].generationConfig.responseJsonSchema, sent[1].response_format.json_schema.schema);
  assert.deepEqual(legacySchema, responseJsonSchema);
  assert.deepEqual(responseJsonSchema.required, ['meaningUsage', 'grammar', 'correctedSentence', 'explanation', 'structure']);
  assert.deepEqual(responseJsonSchema.properties.structure.properties.parts.items.properties.role.enum, ['S', 'V', 'O', 'C', 'M', 'X']);
  for (const text of ['PRIVATE-invalid-json', JSON.stringify({ ...content, structure: { ...content.structure, parts: [] } }), JSON.stringify(content).padEnd(30001, ' ')]) {
    await assert.rejects(generateSentenceFeedback('synthetic', input, async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] })), error => {
      assert.equal(error.code, 'provider_invalid_response'); assert.doesNotMatch(error.message, /PRIVATE/); return true;
    });
    await assert.rejects(generateGroqFeedback('synthetic', input, 'trusted', async () => Response.json({ model: 'openai/gpt-oss-120b', choices: [{ finish_reason: 'stop', message: { content: text } }] })), error => {
      assert.equal(error.code, 'groq_invalid_response'); assert.doesNotMatch(error.message, /PRIVATE/); return true;
    });
  }
});

test('read-only feedback cannot pull in request/store code, and Groq does not import Google transport', async () => {
  for (const [entry, forbidden] of [
    ['app/feedback-detail.tsx', /(?:use-sentence-feedback|learning-api|client-request|(?:gemini|groq)-feedback|^db\/)/],
    ['lib/groq-feedback.ts', /gemini-feedback/],
    ['lib/sentence-feedback-presentation.ts', /(?:zod|react|learning-api|client-request|^db\/)/],
  ]) {
    const result = await build({ entryPoints: [entry], bundle: true, write: false, metafile: true, platform: 'browser', jsx: 'automatic', logLevel: 'silent' });
    for (const dependency of Object.keys(result.metafile.inputs)) assert.doesNotMatch(dependency, forbidden, `${entry} -> ${dependency}`);
  }
});
