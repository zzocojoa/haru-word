import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { LocalLearningDrafts } from '../lib/local-learning-drafts.ts';
import { runRecoverableFeedback, feedbackRequestKey } from '../lib/recoverable-feedback.ts';

mkdirSync('work/grammar-whitespace-tests', { recursive: true });
await build({ stdin: { contents: "export {generateGrammarFeedback} from './lib/grammar/feedback';export {LESSON_MAP} from './lib/grammar/content';", resolveDir: process.cwd(), loader: 'ts' }, outfile: 'work/grammar-whitespace-tests/runtime.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { generateGrammarFeedback, LESSON_MAP } = await import('../work/grammar-whitespace-tests/runtime.mjs');
const model = 'gpt-6.1-sol';
const lesson = LESSON_MAP.get('pronoun');
function setup() {
  const data = new Map();
  const storage = { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const store = new LocalLearningDrafts('synthetic-owner', crypto.randomUUID(), () => storage);
  store.connect();
  return store;
}
async function generated(sentence, judgmentEnabled) {
  let requests = 0;
  const feedback = await generateGrammarFeedback({ apiKey: 'SYNTHETIC_OFFLINE', modelId: model, allowedModels: model, judgmentEnabled }, lesson, sentence, async (url, init) => {
    requests++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const input = JSON.parse(JSON.parse(init.body).input[0].content);
    assert.equal(input.sentence, judgmentEnabled ? sentence.trim() : sentence);
    const wire = judgmentEnabled
      ? { meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: input.sentence, targetReason: '목표를 사용했어요.', grammarReason: '자연스러운 문장이에요.', correctionReason: '', contextNeeded: 'none' }
      : { meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: input.sentence, explanation: '자연스러운 문장이에요.', structure: { status: 'unavailable', translation: '', parts: [], note: '분석하지 않았어요.' } };
    return Response.json({ status: 'completed', model, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(wire) }] }] });
  });
  assert.equal(requests, 1);
  return feedback;
}
const input = sentence => ({ domain: 'grammar', targetKey: 'synthetic-whitespace', sentence, expectedModelId: model });
const result = (requestId, feedback) => ({ response: Response.json({}), data: { feedback, receipt: { requestId, state: 'completed', persisted: true } } });

for (const judgmentEnabled of [true, false]) {
  test(`grammar ${judgmentEnabled ? 'v5' : 'structured-v1'} accepts its original representation and preserves the saved raw draft`, async () => {
    for (const sentence of [' I am happy. ', '\tI am happy.\n']) {
      const store = setup(), request = input(sentence), feedback = await generated(sentence, judgmentEnabled);
      const value = await runRecoverableFeedback(store, request, { send: async meta => result(meta.requestId, feedback), lookup: async () => { throw Error('Unexpected lookup'); } }, new AbortController().signal);
      assert.equal(value.feedback.original, judgmentEnabled ? sentence.trim() : sentence);
      assert.equal(request.sentence, sentence);
      const row = store.list(feedbackRequestKey('grammar', request.targetKey), 'request')[0].record.values;
      assert.equal(row.sentence, sentence);
      assert.equal(row.state, 'recovered');
    }
  });
}

test('a whitespace grammar draft recovers a lost response by one lookup without sending again', async () => {
  const sentence = ' I am happy. ', request = input(sentence), store = setup();
  const feedback = await generated(sentence, true);
  let sends = 0, lookups = 0, requestId;
  const io = { send: async meta => { sends++; requestId = meta.requestId; throw new TypeError('Synthetic response loss'); }, lookup: async id => { lookups++; assert.equal(id, requestId); return result(id, feedback); } };
  await assert.rejects(runRecoverableFeedback(store, request, io, new AbortController().signal));
  const recovered = await runRecoverableFeedback(store, request, io, new AbortController().signal);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.feedback.original, sentence.trim());
  assert.equal(sends, 1);
  assert.equal(lookups, 1);
});

test('whitespace normalization cannot accept a different sentence or an internally rewritten original', async () => {
  const sentence = ' I am happy. ', feedback = await generated(sentence, true);
  for (const original of ['I  am happy.', 'I am sad.', 'i am happy.', 'I am happy!']) {
    const store = setup();
    let sends = 0;
    await assert.rejects(runRecoverableFeedback(store, input(sentence), { send: async meta => { sends++; return result(meta.requestId, { ...feedback, original }); }, lookup: async () => { throw Error('Unexpected lookup'); } }, new AbortController().signal), error => error.issue?.code === 'invalid_response');
    assert.equal(sends, 1);
    assert.equal(store.list()[0].record.values.state, 'pending');
  }
});
