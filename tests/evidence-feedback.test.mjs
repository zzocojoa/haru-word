import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseEvidenceFeedback, evidenceFeedbackContract, EVIDENCE_RULES } from '../lib/evidence-feedback.ts';
import { parseProviderFeedback } from '../lib/provider-feedback-contract.ts';
import { sentenceFeedbackSchema, FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL } from '../lib/sentence-feedback.ts';

const part = (text, fn, meaning, governor = '') => ({ text, function: fn, meaning, governor });
const wire = (sentence = 'I am now writing.') => ({ context: 'sufficient', meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: sentence, changes: [],
  target: { reason: 'matched', originalSpan: sentence.split(/\s/u)[0], observedUse: '작성한 목표의 용법' },
  structure: { status: 'available', translation: '나는 지금 쓰고 있어요.', parts: [part('I', 'subject', '나는'), part('am', 'verb', '현재형 보조동사'), part('now', 'modifier', '지금'), part('writing.', 'verb', '쓰고 있다')], note: 'none' } });
const parse = v => parseEvidenceFeedback(typeof v === 'string' ? v : JSON.stringify(v), 'I am now writing.', FEEDBACK_MODEL);
const rejected = (v, stage) => assert.throws(() => parse(v), e => e.stage === stage && e.message === 'Invalid feedback content' && !Object.hasOwn(e, 'value'));
const clone = v => structuredClone(v);

test('actual partial-uncertain failure is reproduced in the shared parser and rejected by the experimental contract', () => {
  const r = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-01-root-cause.json', 'utf8')).rows.find(r => r.label === 'B042');
  const v = { ...r.feedback }; delete v.original; delete v.model; delete v.createdAt;
  assert.equal(parseProviderFeedback(JSON.stringify(v), r.feedback.original, r.feedback.model).meaningUsage, 'appropriate');
  // This is an OFFLINE projection, not a new provider result or an English score.
  const candidate = { context: 'insufficient', meaningUsage: r.feedback.meaningUsage, grammar: r.feedback.grammar, correctedSentence: '', changes: [],
    target: { reason: 'ambiguous', originalSpan: '', observedUse: '' },
    structure: { status: 'unavailable', translation: '', parts: [], note: 'insufficient' } };
  assert.throws(() => parseEvidenceFeedback(JSON.stringify(candidate), r.feedback.original, r.feedback.model), e => e.stage === 'judgment');
  candidate.meaningUsage = 'uncertain';
  const a = parseEvidenceFeedback(JSON.stringify(candidate), r.feedback.original, r.feedback.model);
  assert.equal(a.meaningUsage, 'uncertain'); assert.equal(a.grammar, 'uncertain'); assert.equal(a.correctedSentence, ''); assert.equal(a.structure.status, 'unavailable');
  for (const field of ['context', 'target', 'changes']) assert.equal(a[field], undefined);
});

test('joint insufficiency preserves withholding while target-only uncertainty and clear imperatives remain possible', () => {
  const insufficient = { ...wire(), context: 'insufficient', meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '',
    target: { reason: 'ambiguous', originalSpan: '', observedUse: '' },
    structure: { status: 'unavailable', translation: '', parts: [], note: 'insufficient' } };
  assert.equal(parse(insufficient).grammar, 'uncertain');
  for (const mutate of [v => v.context = 'sufficient', v => v.meaningUsage = 'appropriate', v => v.correctedSentence = 'I am now writing.', v => v.structure.translation = '내용 추가', v => v.structure.parts = wire().structure.parts]) {
    const v = clone(insufficient); mutate(v); assert.throws(() => parse(v));
  }
  const uncertainMeaning = wire(); uncertainMeaning.meaningUsage = 'uncertain'; uncertainMeaning.target = { reason: 'ambiguous', originalSpan: 'writing', observedUse: '' };
  assert.equal(parse(uncertainMeaning).grammar, 'natural');
  const imperative = wire('Wait!'); imperative.structure = { status: 'available', translation: '기다리세요!', parts: [part('Wait!', 'verb', '기다리세요')], note: 'none' };
  const result = parseEvidenceFeedback(JSON.stringify(imperative), 'Wait!', FEEDBACK_MODEL);
  assert.equal(result.correctedSentence, 'Wait!'); assert.deepEqual(result.structure.parts.map(p => p.role), ['V']);
});

test('literal spans cover the actual sentence and generated functions cannot contradict their compiled role labels', () => {
  const result = parse(wire()); assert.deepEqual(result.structure.parts.map(p => [p.text, p.role]), [['I', 'S'], ['am', 'V'], ['now', 'M'], ['writing.', 'V']]);
  assert.match(result.structure.parts[2].explanation, /지금.*수식어/u);
  for (const mutate of [v => v.structure.parts[1].text = 'now', v => v.structure.parts.pop(), v => v.structure.parts.reverse(), v => v.structure.parts[3].text = 'writing', v => v.structure.parts[1].meaning = '', v => v.structure.parts[1].wordCount = 1, v => v.structure.parts[1].explanation = '다른 역할 설명']) {
    const v = wire(); mutate(v); assert.throws(() => parse(v));
  }
  assert.equal(sentenceFeedbackSchema.safeParse(result).success, true);
});

test('preposition objects require a separate preceding governor and preserve grouped verbs or modifiers', () => {
  const original = 'They listened to music.', v = wire(original);
  v.structure = { status: 'available', translation: '그들은 음악을 들었어요.', note: 'none', parts: [part('They', 'subject', '그들은'), part('listened to', 'verb', '들었다'), part('music.', 'preposition-object', '음악', 'to')] };
  const parseHere = x => parseEvidenceFeedback(JSON.stringify(x), original, FEEDBACK_MODEL);
  assert.match(parseHere(v).structure.parts[2].explanation, /to의 목적어/u);
  const flat = clone(v); flat.structure.parts = [part('They', 'subject', '그들은'), part('listened', 'verb', '들었다'), part('to music.', 'modifier', '음악을')];
  assert.equal(parseHere(flat).structure.parts[2].role, 'M');
  const wholePP = clone(flat); wholePP.structure.parts[2].function = 'preposition-object'; wholePP.structure.parts[2].governor = 'to';
  assert.throws(() => parseHere(wholePP), e => e.stage === 'structure');
  for (const governor of ['', 'on', ' to', 'to ']) { const bad = clone(v); bad.structure.parts[2].governor = governor; assert.throws(() => parseHere(bad), e => e.stage === 'structure'); }
  const stray = clone(v); stray.structure.parts[0].governor = 'to'; assert.throws(() => parseHere(stray), e => e.stage === 'structure');
});

test('preposition boundaries come from the source sentence, never artificial spaces between chunks', () => {
  const original = 'We walked into town.', v = wire(original);
  v.structure = { status: 'available', translation: '우리는 마을 안으로 걸어갔어요.', note: 'none', parts: [part('We', 'subject', '우리는'), part('walked', 'verb', '걸어갔다'), part('in', 'modifier', '안으로'), part('to', 'connector', '연결'), part('town.', 'preposition-object', '마을', 'to')] };
  const parseHere = x => parseEvidenceFeedback(JSON.stringify(x), original, FEEDBACK_MODEL);
  assert.throws(() => parseHere(v), e => e.stage === 'structure');
  v.structure.parts = [part('We', 'subject', '우리는'), part('walked into', 'verb', '안으로 걸어갔다'), part('town.', 'preposition-object', '마을', 'into')];
  assert.match(parseHere(v).structure.parts[2].explanation, /into의 목적어/u);
  v.structure.parts = [part('We', 'subject', '우리는'), part('walked', 'verb', '걸어갔다'), part('into town.', 'modifier', '마을 안으로')];
  assert.equal(parseHere(v).structure.parts[2].role, 'M');
  const together = wire('They live together.');
  together.structure = { status: 'available', translation: '그들은 함께 살아요.', note: 'none', parts: [part('They', 'subject', '그들은'), part('live', 'verb', '산다'), part('to', 'modifier', '함께'), part('gether.', 'preposition-object', '나머지', 'to')] };
  assert.throws(() => parseEvidenceFeedback(JSON.stringify(together), 'They live together.', FEEDBACK_MODEL), e => e.stage === 'structure');
  together.structure.parts = [part('They', 'subject', '그들은'), part('live', 'verb', '산다'), part('together.', 'modifier', '함께')];
  assert.equal(parseEvidenceFeedback(JSON.stringify(together), 'They live together.', FEEDBACK_MODEL).structure.parts[2].role, 'M');
});

test('target evidence distinguishes absence, another sense and another function using the original', () => {
  const outputs = [];
  for (const [reason, observedUse, pattern] of [
    ['absent', '', /원문에 드러나지/u],
    ['different-sense', '글을 쓰는 뜻', /선택한 뜻과 다르게/u],
    ['different-function', '현재 진행형의 동사', /선택한 기능과 다르게/u],
  ]) {
    const v = wire(); v.meaningUsage = 'needs_work'; v.target = { reason, originalSpan: reason === 'absent' ? '' : 'writing', observedUse };
    const a = parse(v); assert.match(a.explanation, pattern); assert.equal(a.correctedSentence, 'I am now writing.'); outputs.push(a.explanation);
  }
  assert.equal(new Set(outputs).size, 3);
  for (const mutate of [v => v.target.originalSpan = 'eating', v => v.target.originalSpan = '', v => v.target.observedUse = ' ', v => v.target.reason = 'absent', v => v.meaningUsage = 'needs_work', v => v.target.reason = 'ambiguous', v => v.target.rule = 'verb-form']) {
    const v = wire(); mutate(v); assert.throws(() => parse(v));
  }
  const original = 'We saw three bird.', v = wire('We saw three birds.'); v.grammar = 'needs_work'; v.changes = [{ before: 'bird', after: 'birds', rule: 'noun-number' }];
  v.target.originalSpan = 'birds'; v.structure = { status: 'unavailable', translation: '', parts: [], note: 'complex' };
  assert.throws(() => parseEvidenceFeedback(JSON.stringify(v), original, FEEDBACK_MODEL), e => e.stage === 'judgment');
  v.target.originalSpan = 'bird'; assert.equal(parseEvidenceFeedback(JSON.stringify(v), original, FEEDBACK_MODEL).correctedSentence, 'We saw three birds.');
});

test('correction evidence reconstructs all changes exactly and only reviewed rule text reaches the grammar explanation', () => {
  const original = 'We saw three bird.', v = wire('We saw three birds.'); v.grammar = 'needs_work';
  v.changes = [{ before: 'bird', after: 'birds', rule: 'noun-number' }];
  v.structure = { status: 'available', translation: '우리는 새 세 마리를 봤어요.', parts: [part('We', 'subject', '우리는'), part('saw', 'verb', '보았다'), part('three birds.', 'direct-object', '새 세 마리를')], note: 'none' };
  const parseHere = x => parseEvidenceFeedback(JSON.stringify(x), original, FEEDBACK_MODEL);
  const result = parseHere(v); assert.match(result.explanation, /「bird」 → 「birds」/u); assert.match(result.explanation, /불규칙형과 단복수가 같은/u);
  assert.ok(result.explanation.includes(EVIDENCE_RULES['noun-number'].text));
  for (const mutate of [x => x.changes = [], x => x.changes[0].before = 'missing', x => x.changes[0].after = 'bird', x => x.changes[0].rule = 'always-add-s', x => x.correctedSentence = 'They saw three birds.', x => x.explanation = '수량 명사는 항상 복수형이에요.', x => x.changes[0].explanation = '반드시 -s만 붙여요.']) {
    const bad = clone(v); mutate(bad); assert.throws(() => parseHere(bad));
  }
  const repeated = clone(v); repeated.changes = [{ before: 'bird', after: 'birds', rule: 'noun-number' }];
  assert.throws(() => parseEvidenceFeedback(JSON.stringify(repeated), 'A bird saw a bird.', FEEDBACK_MODEL), e => e.stage === 'judgment');
  // Model selection can still be wrong. This compiler does not prove semantics.
  const semanticallyBad = clone(v); semanticallyBad.changes[0].rule = 'article';
  assert.match(parseHere(semanticallyBad).explanation, /관사는/u);
});

test('natural and uncertain judgments cannot smuggle corrections, prose or unavailable analyses into a pass', () => {
  const natural = wire(); natural.meaningUsage = 'needs_work'; natural.target = { reason: 'absent', originalSpan: '', observedUse: '' }; assert.equal(parse(natural).correctedSentence, 'I am now writing.');
  for (const mutate of [v => v.correctedSentence = 'I am now eating.', v => v.changes = [{ before: 'writing.', after: 'eating.', rule: 'verb-form' }], v => v.structure.status = 'unavailable', v => v.structure.note = 'complex']) {
    const v = wire(); mutate(v); assert.throws(() => parse(v));
  }
  rejected('{', 'json_syntax'); assert.throws(() => parseEvidenceFeedback(null, 'synthetic', FEEDBACK_MODEL), e => e.stage === 'content_type');
  rejected('x'.repeat(30001), 'content_limit'); const extra = wire(); extra.diagnostic = 'private-value'; rejected(extra, 'fields');
});

test('natural corrections retain outer and interior whitespace exactly without changing the saved parser', () => {
  for (const [original, correction] of [['I am now writing.', ' I am now writing. '], [' I am now writing. ', 'I am now writing.'], ['I am now writing.', 'I am  now writing.']]) {
    const v = wire(original); v.target.originalSpan = 'writing'; v.correctedSentence = correction;
    assert.throws(() => parseEvidenceFeedback(JSON.stringify(v), original, FEEDBACK_MODEL), e => e.stage === 'judgment');
  }
  const a = parse(wire()); const old = { meaningUsage: a.meaningUsage, grammar: a.grammar, correctedSentence: ' I am now writing. ', explanation: a.explanation, structure: a.structure };
  assert.equal(parseProviderFeedback(JSON.stringify(old), a.original, FEEDBACK_MODEL).correctedSentence, old.correctedSentence);
  const exact = wire(' I am now writing. '); exact.target.originalSpan = 'writing';
  assert.equal(parseEvidenceFeedback(JSON.stringify(exact), exact.correctedSentence, FEEDBACK_MODEL).correctedSentence, exact.correctedSentence);
});

test('edit summaries show a late change in a long unique anchor and retain complete Unicode characters', () => {
  const original = 'Yesterday I walked through the quiet neighborhood and buy a book.', corrected = original.replace('buy', 'bought'), v = wire(corrected);
  v.grammar = 'needs_work'; v.changes = [{ before: original, after: corrected, rule: 'verb-form' }];
  v.structure = { status: 'unavailable', translation: '', parts: [], note: 'complex' };
  const result = parseEvidenceFeedback(JSON.stringify(v), original, FEEDBACK_MODEL);
  assert.match(result.explanation, /buy/u); assert.match(result.explanation, /bought/u);
  // Non-language input isolates excerpt safety; it is not an English test case.
  const before = 'A' + '😀'.repeat(25), after = 'B' + '😀'.repeat(25), unicode = wire(after);
  unicode.target.originalSpan = 'A'; unicode.grammar = 'needs_work'; unicode.changes = [{ before, after, rule: 'verb-form' }]; unicode.structure = v.structure;
  const excerpt = parseEvidenceFeedback(JSON.stringify(unicode), before, FEEDBACK_MODEL).explanation;
  assert.equal(excerpt.isWellFormed(), true); assert.match(excerpt, /「A/u); assert.match(excerpt, /「B/u);
});

test('all permitted changes and rule notes fit the persisted explanation limit at maximum Unicode bounds', () => {
  const rules = Object.keys(EVIDENCE_RULES);
  // Distinct anchors, lengthy changed spans and astral code points stress bounds.
  const changes = Array.from({ length: 20 }, (_, i) => ({ before: String.fromCharCode(65 + i) + '😀'.repeat(9) + '😁'.repeat(25) + '😀'.repeat(9),
    after: String.fromCharCode(65 + i) + '😀'.repeat(9) + '😂'.repeat(25) + '😀'.repeat(9), rule: rules[i % rules.length] }));
  const original = changes.map(c => c.before).join(' '), corrected = changes.map(c => c.after).join(' '), v = wire(corrected);
  v.target = { reason: 'different-function', originalSpan: original.slice(1, 161), observedUse: '😀'.repeat(60) }; v.meaningUsage = 'needs_work'; v.grammar = 'needs_work'; v.changes = changes;
  assert.equal(original.length, 1759); assert.equal(v.target.originalSpan.length, 160); assert.equal(v.target.originalSpan.isWellFormed(), true);
  v.structure = { status: 'unavailable', translation: '', parts: [], note: 'complex' };
  const result = parseEvidenceFeedback(JSON.stringify(v), original, FEEDBACK_MODEL);
  assert.ok(result.explanation.length <= 1500); assert.equal(result.explanation.isWellFormed(), true);
  for (const rule of rules) assert.ok(result.explanation.includes(EVIDENCE_RULES[rule].text));
  assert.equal(result.correctedSentence, corrected); assert.match(result.explanation, /그 밖의 변경/u);
  const tooMany = clone(v); tooMany.changes.push(changes[0]); assert.throws(() => parseEvidenceFeedback(JSON.stringify(tooMany), original, FEEDBACK_MODEL), e => e.stage === 'fields');
});

test('edit evidence rejects overlap, changed order and additional unreported corrections', () => {
  const original = 'We see a bird.', corrected = 'We saw two birds.', v = wire(corrected); v.grammar = 'needs_work';
  v.changes = [{ before: 'see', after: 'saw', rule: 'verb-form' }, { before: 'a bird', after: 'two birds', rule: 'noun-number' }];
  v.structure = { status: 'unavailable', translation: '', parts: [], note: 'complex' };
  const parseHere = x => parseEvidenceFeedback(JSON.stringify(x), original, FEEDBACK_MODEL);
  assert.equal(parseHere(v).correctedSentence, corrected);
  for (const mutate of [x => x.changes.reverse(), x => x.changes.pop(), x => x.changes[1].before = 'see a bird', x => x.correctedSentence = 'They saw two birds.']) {
    const bad = clone(v); mutate(bad); assert.throws(() => parseHere(bad), e => e.stage === 'judgment');
  }
});

test('schema uses required closed objects and enums, without changing the shared saved feedback contract', () => {
  const walk = schema => {
    if (schema.type === 'object') { assert.equal(schema.additionalProperties, false); assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort()); Object.values(schema.properties).forEach(walk); }
    if (schema.type === 'array') walk(schema.items);
    assert.equal(schema.minLength, undefined); // Provider support was not verified; local limits still apply.
  };
  walk(evidenceFeedbackContract.schema);
  const s = JSON.stringify(evidenceFeedbackContract.schema);
  assert.ok(!s.includes('wordCount') && !s.includes('explanation'));
  for (const field of ['context', 'target', 'changes']) assert.ok(!Object.hasOwn(parse(wire()), field));
});

test('both existing transports can use the new contract in a single mocked request without fallback or actual AI', async () => {
  mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/evidence-transport-')), output = resolve(directory, 'transport.mjs');
  await build({ stdin: { contents: "export { generateTutorFeedback } from './lib/gemini-feedback'; export { generateGroqFeedback } from './lib/groq-feedback';", resolveDir: process.cwd() }, outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { generateTutorFeedback, generateGroqFeedback } = await import(pathToFileURL(output).href);
  for (const provider of ['google', 'groq']) {
    const calls = [];
    const fetcher = async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      const content = JSON.stringify(wire());
      return new Response(JSON.stringify(provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: content }] } }] } : { model: GROQ_FEEDBACK_MODEL, choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
    };
    const result = provider === 'google'
      ? await generateTutorFeedback('synthetic', { sentence: 'I am now writing.' }, 'synthetic instruction', fetcher, 30000, undefined, evidenceFeedbackContract)
      : await generateGroqFeedback('synthetic', { sentence: 'I am now writing.' }, 'synthetic instruction', fetcher, undefined, evidenceFeedbackContract);
    assert.equal(calls.length, 1); assert.equal(result.grammar, 'natural'); assert.equal(result.model, provider === 'google' ? FEEDBACK_MODEL : GROQ_FEEDBACK_MODEL);
    const schema = provider === 'google' ? calls[0].body.generationConfig.responseJsonSchema : calls[0].body.response_format.json_schema.schema;
    assert.deepEqual(schema, evidenceFeedbackContract.schema);
    assert.equal(sentenceFeedbackSchema.safeParse(result).success, true);
  }
});
