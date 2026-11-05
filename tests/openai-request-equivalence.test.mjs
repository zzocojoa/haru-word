import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const out = 'work/openai-request-equivalence/runtime.mjs';
await build({ stdin: { contents: `
  export * from './lib/openai-feedback';
  export {systemInstruction,legacySystemInstruction} from './lib/feedback-prompts';
  export {generateGrammarFeedback} from './lib/grammar/feedback';
  export {LESSON_MAP} from './lib/grammar/content';
  export {lessonForVersion} from './lib/grammar/content-v4';
  export {wordFeedbackInput} from './lib/feedback-context';
`, resolveDir: process.cwd(), loader: 'ts' }, outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const runtime = await import(pathToFileURL(process.cwd() + '/' + out));
const baseline = JSON.parse(readFileSync('tests/fixtures/openai-request-equivalence.json', 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Frozen on the clean 7d7c368 source before refactoring. No network or API key.
// Hash the serialized body too: key order, prompts and whitespace are contracts.
// The sole intentional transport change is error -> manual with explicit 3xx
// rejection for workerd. Retain the original fixture and normalize only that
// option after independently asserting the new policy.
test('120 synthetic word/grammar generation cases equal the pre-refactor requests and parsed results', async t => {
  t.mock.method(console, 'info', () => {});
  const actual = {};
  const sentence = ' \tI am writing.\n';
  for (const modelId of ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra']) {
    for (const judgmentEnabled of [false, true]) {
      for (const contextKind of ['sentence', 'reply', 'title', 'command']) {
        for (const domain of ['word', 1, 2, 3, 4]) {
          const key = [modelId, judgmentEnabled ? 'v5' : 'v1', contextKind, domain].join('/');
          const config = { apiKey: 'SYNTHETIC_OFFLINE', modelId, allowedModels: modelId, judgmentEnabled, contextKind, contextNote: '합성 문맥' };
          let calls = 0, request;
          const fetcher = async (url, init) => {
            calls++;
            assert.equal(init.redirect, 'manual');
            request = { url, method: init.method, redirect: 'error', headers: init.headers, body: init.body };
            const body = JSON.parse(init.body), input = JSON.parse(body.input[0].content);
            const wire = judgmentEnabled
              ? { meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: input.sentence, targetReason: '합성 목표', grammarReason: '합성 문법', correctionReason: '', contextNeeded: 'none' }
              : { meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: input.sentence, explanation: '합성 의견', structure: { status: 'unavailable', translation: '', parts: [], note: '합성' } };
            return Response.json({ status: 'completed', model: modelId, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(wire) }] }] });
          };
          const feedback = domain === 'word'
            ? await (judgmentEnabled ? runtime.generateOpenAiFeedback : runtime.generateStructuredOpenAiFeedback)(config,
              judgmentEnabled ? runtime.wordFeedbackInput({ word: 'write', pos: 'v.' }, '쓰다', sentence, config.contextNote, 'write', contextKind)
                : { word: 'write', pos: 'v.', meaning: '쓰다', sentence: sentence.trim() },
              judgmentEnabled ? runtime.systemInstruction : runtime.legacySystemInstruction, fetcher)
            : await runtime.generateGrammarFeedback(config, runtime.lessonForVersion(runtime.LESSON_MAP.get('pronoun'), domain), sentence, fetcher);
          const { createdAt, ...stable } = feedback;
          if (judgmentEnabled) {
            assert.equal(stable.validationVersion, 'judgment-v6');
            // The v6 local guards intentionally change provenance. Keep the
            // frozen baseline and compare every other output/request byte.
            stable.validationVersion = 'judgment-v5';
          }
          assert.ok(Number.isFinite(Date.parse(createdAt)));
          assert.equal(calls, 1, key);
          actual[key] = { request: hash(request), result: hash(stable) };
        }
      }
    }
  }
  assert.equal(Object.keys(actual).length, 120);
  assert.equal(baseline.sourceCommit, '7d7c368fbd9c7398712600e5bfae2f1fd1c2ad05');
  assert.deepEqual(actual, baseline.cases);
});
