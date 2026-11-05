import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { parseJudgmentFeedback, correctionConflict, judgmentJsonSchema } from '../lib/judgment-feedback-contract.ts';
import { FeedbackValidationError } from '../lib/provider-feedback-contract.ts';
import { feedbackSafetyIssue } from '../lib/feedback-safety.ts';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';

mkdirSync('work/judgment-feedback-tests', { recursive: true });
await build({ entryPoints: ['lib/openai-feedback.ts'], outfile: 'work/judgment-feedback-tests/adapter.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { generateOpenAiFeedback, generateStructuredOpenAiFeedback } = await import('../work/judgment-feedback-tests/adapter.mjs');
const natural = 'She sings well.';
const wire = (changes = {}) => ({ meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: natural,
  targetReason: '목표 표현을 알맞게 사용했어요.', grammarReason: '주어와 동사의 형태가 맞아요.', correctionReason: '', contextNeeded:'none', ...changes });
const parse = (original = natural, changes = {}) => parseJudgmentFeedback(JSON.stringify(wire(changes)), original, 'gpt-6.1-sol');
const bad = fn => assert.throws(fn, error => error instanceof FeedbackValidationError && error.stage === 'judgment');
const modern = (sentence, explanation) => ({ original: sentence, correctedSentence: sentence, meaningUsage: 'appropriate', grammar: 'natural', explanation,
  provider: 'openai', model: 'gpt-6.1-sol', requestedModel: 'gpt-6.1-sol', promptVersion: 'reference-v2', validationVersion: 'judgment-v2', createdAt: '2026-11-03T00:00:00.000Z' });

test('judgment-only wire has separate visible reasons and no structure, while storage uses the compatible four fields', () => {
  assert.equal(judgmentJsonSchema.additionalProperties, false); assert.equal('structure' in judgmentJsonSchema.properties, false);
  const result = parse(); assert.equal(Object.hasOwn(result, 'structure'), false); assert.equal(Object.hasOwn(result, 'targetReason'), false);
  assert.match(result.explanation, /목표:.*\n문법:/); assert.equal(sentenceFeedbackSchema.safeParse(result).success, true);
  assert.throws(() => parse(natural, { structure: { status: 'unavailable' } }), error => error.stage === 'fields');
});

test('a grammatical original is preserved even when the target is absent or in a different sense', () => {
  assert.equal(parse(natural, { meaningUsage: 'needs_work', targetReason: '요청한 목표 단어가 없어요.' }).correctedSentence, natural);
  bad(() => parse(natural, { meaningUsage: 'needs_work', correctedSentence: 'She sings a song well.', correctionReason: '목표 단어를 추가했어요.' }));
  bad(() => parse(natural, { correctedSentence: '' }));
});

test('uncertainty asks for specific context without inventing a sentence, and ordinary pronouns stay valid', () => {
  const result = parse('A blue notebook', { meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', targetReason: '목표 용법을 판단할 문장이 부족해요.',
    grammarReason: '완전한 문장인지 확인하기 어려워요.', contextNeeded:'message' });
  assert.equal(result.correctedSentence, ''); assert.match(result.explanation, /추가 문맥:/);
  bad(() => parse('A blue notebook', { grammar: 'uncertain', correctedSentence: 'I have a blue notebook.', correctionReason: '동사를 넣었어요.', contextNeeded:'message' }));
  bad(() => parse(natural, { grammar: 'uncertain', correctedSentence: '' }));
  bad(() => parse(natural, { contextNeeded:'message' }));
  assert.equal(parse().grammar, 'natural');
  assert.equal(parse(natural, { meaningUsage: 'uncertain', contextNeeded:'target_meaning' }).correctedSentence, natural);
});

test('a needs-work correction must change the original and give its reason; unknown intent can withhold it', () => {
  const corrected = { grammar: 'needs_work', correctedSentence: natural, correctionReason: '3인칭 단수 주어에 맞춰 sings로 바꿨어요.' };
  assert.equal(parse('She sing well.', corrected).correctedSentence, natural);
  bad(() => parse(natural, { grammar: 'needs_work', correctionReason: '' }));
  bad(() => parse('She sing well.', { ...corrected, correctionReason: '' }));
  bad(() => parse('She sing well.', { meaningUsage: 'uncertain', grammar: 'needs_work', correctedSentence: '', contextNeeded:'target_meaning' }));
  assert.equal(parse('She sing well.', { ...corrected, meaningUsage:'uncertain', contextNeeded:'target_meaning' }).correctedSentence,natural);
});

test('bounded correction guards reject changes to negation, quantities, time/focus and transfer participants', () => {
  for (const [original, corrected, reason] of [
    ['She do not sing.', 'She sings.', 'negation'], ['He give her two books.', 'He gives her three books.', 'quantity'],
    ['I go there yesterday.', 'I went there tomorrow.', 'time_or_focus'], ['I almost lose it.', 'I lost it.', 'time_or_focus'],
    ['He give her a book.', 'She gives him a book.', 'participants'], ['Mina give Tom a book.', 'Tom gives Mina a book.', 'participants'],
  ]) {
    assert.equal(correctionConflict(original, corrected), reason);
    bad(() => parse(original, { grammar: 'needs_work', correctedSentence: corrected, correctionReason: '합성 교정 이유' }));
  }
  for (const [original, corrected] of [['She don’t have two books.', "She doesn't have two books."], ['He give she two books.', 'He gives her two books.'], ['I go there yesterday.', 'I went there yesterday.']]) {
    assert.equal(correctionConflict(original, corrected), undefined);
    assert.equal(parse(original, { grammar: 'needs_work', correctedSentence: corrected, correctionReason: '형태만 고쳤어요.' }).correctedSentence, corrected);
  }
});

test('visible progressive and arrive explanations remain guarded without generated structure', () => {
  for (const [sentence, explanation, reason] of [
    ['I am writing.', 'writing은 보어입니다.', 'progressive_role'], ['She is not sleeping.', 'sleeping의 역할은 목적어입니다.', 'progressive_role'],
    ['They were still playing.', 'playing is a complement.', 'progressive_role'],
    ['They arrived at the station.', 'at the station은 동사의 직접목적어예요.', 'preposition_object'],
    ['They arrived in my car.', '전치사구 전체가 목적어예요.', 'preposition_object'],
  ]) assert.equal(feedbackSafetyIssue(modern(sentence, explanation)), reason, explanation);
});

test('correct explanations, preposition-internal objects, adjectives, gerunds and quoted phrases are not rewritten or withheld', () => {
  for (const [sentence, explanation] of [
    ['I am writing.', 'writing은 목적어가 아니라 be동사와 함께 동사구를 이룹니다.'],
    ['I am writing.', 'writing is not an object.'], ['They arrived at the station.', 'at the station은 직접목적어가 아닙니다.'],
    ['They arrived at the station.', 'the station은 전치사 at의 목적어예요.'],
    ['My hobby is reading.', 'reading은 동명사 보어예요.'], ['We are teaching staff.', 'teaching staff는 보어예요.'],
    ['He is trying.', 'trying은 형용사 보어로도 쓰여요.'], ['We discussed "at the station".', '인용한 at the station은 목적어예요.'],
  ]) {
    const f = modern(sentence, explanation), before = JSON.stringify(f); assert.equal(feedbackSafetyIssue(f), undefined, explanation); assert.equal(JSON.stringify(f), before);
  }
});

test('v142 and legacy structures remain readable and retain their existing safety protection', () => {
  const frozen = JSON.parse(readFileSync('tests/fixtures/feedback-safety-replay.json', 'utf8'));
  for (const row of frozen.rows) {
    const before = JSON.stringify(row.feedback); assert.equal(sentenceFeedbackSchema.safeParse(row.feedback).success, true);
    if (['grammar-45', 'word-32'].includes(row.caseId)) assert.ok(feedbackSafetyIssue(row.feedback));
    assert.equal(JSON.stringify(row.feedback), before);
  }
  const old = modern('I am writing.', 'writing은 보어예요.'); old.validationVersion = 'structured-v1'; old.promptVersion = 'reference-v1';
  assert.equal(feedbackSafetyIssue(old), undefined);
});

test('new transport uses one strict request per model and adds exact v3 provenance without a structure requirement', async t => {
  t.mock.method(console, 'info', () => {});
  for (const modelId of ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-astra']) {
    let calls = 0;
    const result = await generateOpenAiFeedback({ apiKey: 'SYNTHETIC_ONLY', modelId, allowedModels: modelId }, { sentence: natural, word: 'sing', pos: 'v.', meaning: '노래하다' }, 'Trusted tutor. ', async (_url, init) => {
      calls++; const body = JSON.parse(init.body); assert.equal(body.model, modelId); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 4096);
      assert.deepEqual(body.text.format.schema, judgmentJsonSchema); assert.equal(body.text.format.name, 'study_judgment'); assert.equal(body.text.format.strict, true);
      assert.deepEqual(body.reasoning, { effort: 'low' }); assert.equal(body.service_tier, 'default'); assert.equal(body.tools, undefined);
      return Response.json({ status: 'completed', model: modelId, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(wire()) }] }] });
    });
    assert.equal(calls, 1); assert.equal(result.validationVersion, 'judgment-v6'); assert.equal(result.promptVersion, 'reference-v5');
    assert.equal(result.requestedModel, modelId); assert.equal(result.structure, undefined); assert.equal(result.original, natural);
  }
});

test('new and v142 transports reject one another’s wire contract instead of falling back', async () => {
  const config = { apiKey: 'SYNTHETIC_ONLY', modelId: 'gpt-6.1-sol', allowedModels: 'gpt-6.1-sol' };
  const old = { meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: natural, explanation: '기존 설명', structure: { status: 'unavailable', translation: '', parts: [], note: '합성' } };
  for (const [generate, content] of [[generateOpenAiFeedback, old], [generateStructuredOpenAiFeedback, wire()]]) {
    let calls = 0; await assert.rejects(generate(config, { sentence: natural }, 'trusted', async () => {
      calls++; return Response.json({ status: 'completed', model: config.modelId, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(content) }] }] });
    }), error => error.code === 'provider_invalid_response'); assert.equal(calls, 1);
  }
});
