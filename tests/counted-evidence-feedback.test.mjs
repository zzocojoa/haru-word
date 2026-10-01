import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { parseCountedEvidenceFeedback, countedEvidenceUnits, countedEvidenceFeedbackContract, countedEvidenceWordInstruction, countedEvidenceGrammarInstruction } from '../lib/counted-evidence-feedback.ts';
import { EVIDENCE_FUNCTIONS } from '../lib/evidence-feedback.ts';
import { sentenceFeedbackSchema, FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL } from '../lib/sentence-feedback.ts';
const part = (unitCount, fn, meaning = '합성 어휘 뜻', governor) => ({ unitCount, function: fn, meaning, ...(governor !== undefined ? { governor } : {}) });
const natural = (parts = [part(1, 'subject'), part(1, 'verb'), part(1, 'modifier'), part(1, 'verb')]) => ({ analysis: {
  grammar: 'natural', target: { reason: 'matched', originalSpan: 'writing', observedUse: '쓰고 있다' },
  structure: { status: 'available', translation: '나는 지금 쓰고 있어요.', parts },
} });
const parse = (v, original = 'I am now writing.') => parseCountedEvidenceFeedback(JSON.stringify(v), original, FEEDBACK_MODEL);
const clone = v => structuredClone(v);

test('counted compilation preserves every original token, Unicode, punctuation and whitespace without copied spans', () => {
  for (const original of ['I am now writing.', '  I\tam\nnow  writing.  ', 'I am now writing…', 'I am now writing😀.']) {
    const result = parse(natural(), original);
    assert.equal(result.correctedSentence, original);
    assert.deepEqual(result.structure.parts.map(p => p.role), ['S', 'V', 'M', 'V']);
    assert.equal(result.structure.parts.at(-1).text, original.trim().split(/\s+/u).at(-1));
    assert.equal(sentenceFeedbackSchema.safeParse(result).success, true);
    assert.equal(result.correctedSentence.isWellFormed(), true);
  }
  const sentence = 'I see the  blue\tbird .', v = natural([part(1, 'subject'), part(1, 'verb'), part(4, 'direct-object')]);
  v.analysis.target.originalSpan = 'see';
  assert.equal(parse(v, sentence).structure.parts[2].text, 'the  blue\tbird .');
  for (const counts of [[1, 1, 1], [1, 1, 3]]) {
    const bad = natural(counts.map(n => part(n, 'verb')));
    assert.throws(() => parse(bad), e => e.stage === 'structure' && e.diagnostic === 'chunk_count');
  }
  for (const count of [0, -1, 1.5, '1', 2001]) { const bad = natural(); bad.analysis.structure.parts[0].unitCount = count; assert.throws(() => parse(bad)); }
});

test('contraction units represent separate subject and auxiliary roles while preserving exact spelling and quotes', () => {
  for (const [sentence, texts] of [
    ["I'm writing.", ['I', "'m", 'writing.']], ['You’re ready.', ['You', '’re', 'ready.']],
    ["I've finished.", ['I', "'ve", 'finished.']], ["That's nice.", ['That', "'s", 'nice.']],
    ['“I’m ready!”', ['“I', '’m', 'ready!”']], ["I'D'VE finished.", ['I', "'D", "'VE", 'finished.']],
  ]) {
    const units = countedEvidenceUnits(sentence); assert.deepEqual(units.map(u => u.text), texts);
    for (const unit of units) assert.equal(sentence.slice(unit.index, unit.index + unit.text.length), unit.text);
    const v = natural([part(1, 'subject'), part(texts.length - 2, 'verb'), part(1, sentence.includes('nice') || sentence.includes('ready') ? 'complement' : 'verb')]);
    v.analysis.target.originalSpan = sentence.includes('You') ? 'You' : sentence.includes('That') ? 'That' : 'I';
    const result = parse(v, sentence); assert.equal(result.correctedSentence, sentence);
    assert.deepEqual(result.structure.parts.map(p => p.text), [texts[0], texts.slice(1, -1).join(''), texts.at(-1)]);
    assert.deepEqual(result.structure.parts.slice(0, 2).map(p => p.role), ['S', 'V']);
    const oldCounts = natural([part(1, 'subject'), part(1, 'verb')]); oldCounts.analysis.target = v.analysis.target;
    assert.throws(() => parse(oldCounts, sentence), e => e.stage === 'structure');
  }
});

test('apostrophe splitting does not assign a meaning and possessive phrases can remain whole', () => {
  const sentence = 'The cat’s toy fell.', v = natural([part(4, 'subject'), part(1, 'verb')]); v.analysis.target.originalSpan = 'toy';
  assert.deepEqual(countedEvidenceUnits(sentence).map(u => u.text), ['The', 'cat', '’s', 'toy', 'fell.']);
  assert.deepEqual(parse(v, sentence).structure.parts.map(p => [p.text, p.role]), [['The cat’s toy', 'S'], ['fell.', 'V']]);
  for (const sentence of ["We don't agree.", 'We can’t go.', "Meet at o'clock.", 'See x@y.test.', 'A😀B stays.']) {
    assert.deepEqual(countedEvidenceUnits(sentence).map(u => u.text), sentence.split(/\s+/u));
  }
  // Fixed units cannot express every punctuation-boundary analysis; do not relabel to force a pass.
  const joined = natural(); joined.analysis.target.originalSpan = 'I'; joined.analysis.structure = { status: 'unavailable', note: 'complex' };
  assert.equal(parse(joined, 'I’m,ready.').structure.status, 'unavailable');
});

test('a single target reason determines usage while natural grammar cannot rewrite the original', () => {
  for (const [target, expected] of [
    [{ reason: 'matched', originalSpan: 'writing', observedUse: '쓰고 있다' }, 'appropriate'],
    [{ reason: 'different-sense', originalSpan: 'writing', observedUse: '작성하는 뜻' }, 'needs_work'],
    [{ reason: 'different-function', originalSpan: 'writing', observedUse: '동사 기능' }, 'needs_work'],
    [{ reason: 'absent' }, 'needs_work'], [{ reason: 'ambiguous', originalSpan: 'writing' }, 'uncertain'],
  ]) {
    const v = natural(); v.analysis.target = target; const result = parse(v);
    assert.equal(result.meaningUsage, expected); assert.equal(result.grammar, 'natural'); assert.equal(result.correctedSentence, 'I am now writing.');
  }
  for (const mutate of [v => v.analysis.correctedSentence = 'I am now eating.', v => v.analysis.meaningUsage = 'needs_work',
    v => v.analysis.context = 'insufficient', v => v.analysis.target.originalSpan = 'eating', v => v.analysis.target.observedUse = '',
    v => v.analysis.target = { reason: 'absent', originalSpan: '' }, v => v.analysis.target = { reason: 'ambiguous', originalSpan: '', observedUse: 'invented' }]) {
    const v = natural(); mutate(v); assert.throws(() => parse(v));
  }
});

test('uncertainty compiles complete withholding and rejects partial analyses or corrections', () => {
  const v = { analysis: { grammar: 'uncertain' } }, result = parse(v, 'writing tomorrow');
  assert.equal(result.meaningUsage, 'uncertain'); assert.equal(result.grammar, 'uncertain'); assert.equal(result.correctedSentence, '');
  assert.equal(result.structure.status, 'unavailable'); assert.equal(result.structure.translation, ''); assert.deepEqual(result.structure.parts, []);
  for (const [key, value] of Object.entries({ target: natural().analysis.target, correctedSentence: 'I am writing.', changes: [], structure: natural().analysis.structure })) {
    const bad = clone(v); bad.analysis[key] = value; assert.throws(() => parse(bad));
  }
  const unavailable = natural(); unavailable.analysis.structure = { status: 'unavailable', note: 'ambiguous' };
  assert.equal(parse(unavailable).grammar, 'natural');
  for (const mutate of [v => v.analysis.structure.note = 'insufficient', v => v.analysis.structure.translation = '', v => v.analysis.structure.parts = []]) {
    const bad = clone(unavailable); mutate(bad); assert.throws(() => parse(bad));
  }
});

test('preposition governance remains exact, outside its object and only on that function branch', () => {
  const sentence = 'They listened to music.', v = natural([part(1, 'subject'), part(2, 'verb'), part(1, 'preposition-object', '음악', 'to')]);
  v.analysis.target.originalSpan = 'listened';
  assert.match(parse(v, sentence).structure.parts[2].explanation, /to의 목적어/u);
  for (const mutate of [x => delete x.analysis.structure.parts[2].governor, x => x.analysis.structure.parts[2].governor = 'on',
    x => x.analysis.structure.parts[2].governor = ' to', x => x.analysis.structure.parts[0].governor = '',
    x => x.analysis.structure.parts[0].governor = 'to', x => x.analysis.structure.parts[1].unitCount = 1]) {
    const bad = clone(v); mutate(bad); assert.throws(() => parse(bad, sentence));
  }
  const whole = natural([part(1, 'subject'), part(1, 'verb'), part(2, 'modifier', '음악을')]); whole.analysis.target.originalSpan = 'listened';
  assert.equal(parse(whole, sentence).structure.parts[2].role, 'M');
  whole.analysis.structure.parts[2] = part(2, 'preposition-object', '음악을', 'to'); assert.throws(() => parse(whole, sentence));
  const prefix = natural([part(1, 'subject'), part(2, 'verb'), part(1, 'preposition-object', '마을', 'to')]); prefix.analysis.target.originalSpan = 'walked';
  assert.throws(() => parse(prefix, 'We walked into town.'), e => e.stage === 'structure');
});

test('literal edits still reconstruct the correction and target evidence comes from the original', () => {
  const original = 'We saw three bird.', v = { analysis: { grammar: 'needs_work', target: { reason: 'matched', originalSpan: 'bird', observedUse: '새' },
    correctedSentence: 'We saw three birds.', changes: [{ before: 'bird', after: 'birds', rule: 'noun-number' }],
    structure: { status: 'available', translation: '우리는 새 세 마리를 봤어요.', parts: [part(1, 'subject'), part(1, 'verb'), part(2, 'direct-object')] } } };
  const result = parse(v, original); assert.equal(result.correctedSentence, v.analysis.correctedSentence); assert.match(result.explanation, /bird.*birds/u);
  for (const mutate of [x => x.analysis.changes = [], x => x.analysis.target.originalSpan = 'birds', x => x.analysis.correctedSentence = 'They saw three birds.',
    x => x.analysis.changes[0].before = 'missing', x => x.analysis.changes[0].after = 'bird', x => x.analysis.changes[0].rule = 'invented']) {
    const bad = clone(v); mutate(bad); assert.throws(() => parse(bad, original));
  }
  assert.throws(() => parse(v, 'A bird saw a bird.'), e => e.stage === 'judgment');
});

test('questions, passive subjects and imperatives compile authored functions without inserting subjects', () => {
  for (const [sentence, parts, roles] of [
    ['Are you ready?', [part(1, 'verb'), part(1, 'subject'), part(1, 'complement')], ['V', 'S', 'C']],
    ['The door was closed.', [part(2, 'subject'), part(2, 'verb')], ['S', 'V']],
    ['Wait!', [part(1, 'verb')], ['V']],
  ]) {
    const v = natural(parts); v.analysis.target.originalSpan = sentence.split(' ')[0];
    assert.deepEqual(parse(v, sentence).structure.parts.map(p => p.role), roles);
  }
  // Wrong but internally consistent labels still pass. This is not semantic certification.
  const badEnglish = natural([part(4, 'direct-object')]); assert.equal(parse(badEnglish).structure.parts[0].role, 'O');
  const list = natural([part(2, 'subject')]); list.analysis.target.originalSpan = 'writing';
  assert.equal(parse(list, 'writing tomorrow').grammar, 'natural');
});

test('closed conditional schemas match local fields, preserve stored contracts and expose no raw failure values', () => {
  const functions = new Set();
  const walk = schema => {
    if (schema.type === 'object') { assert.equal(schema.additionalProperties, false); assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort()); Object.values(schema.properties).forEach(walk); }
    if (schema.type === 'array') walk(schema.items);
    if (schema.anyOf) schema.anyOf.forEach(walk);
    if (schema.properties?.function) schema.properties.function.enum.forEach(v => functions.add(v));
  };
  walk(countedEvidenceFeedbackContract.schema); assert.deepEqual([...functions].sort(), [...EVIDENCE_FUNCTIONS].sort());
  for (const key of ['analysis', 'target', 'changes', 'context', 'unitCount', 'governor']) assert.equal(Object.hasOwn(parse(natural()), key), false);
  const secret = 'private-output-marker', bad = natural(); bad.analysis[secret] = secret;
  assert.throws(() => parse(bad), e => e.stage === 'fields' && !JSON.stringify(e).includes(secret) && e.message === 'Invalid feedback content');
  for (const [value, stage] of [[null, 'content_type'], ['{', 'json_syntax'], ['x'.repeat(30001), 'content_limit']]) assert.throws(() => parseCountedEvidenceFeedback(value, 'synthetic', FEEDBACK_MODEL), e => e.stage === stage);
  assert.match(countedEvidenceWordInstruction, /sense and part of speech/u); assert.match(countedEvidenceGrammarInstruction, /grammatical function/u);
});

test('existing Google and Groq transports compile the conditional wire with one mocked call and no fallback', async () => {
  mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/counted-evidence-')), output = resolve(directory, 'transport.mjs');
  await build({ stdin: { contents: "export { generateTutorFeedback } from './lib/gemini-feedback'; export { generateGroqFeedback } from './lib/groq-feedback';", resolveDir: process.cwd() }, outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { generateTutorFeedback, generateGroqFeedback } = await import(pathToFileURL(output).href);
  for (const provider of ['google', 'groq']) {
    const calls = [], fetcher = async (url, options) => {
      calls.push(JSON.parse(options.body)); const content = JSON.stringify(natural());
      return new Response(JSON.stringify(provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: content }] } }] }
        : { model: GROQ_FEEDBACK_MODEL, choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
    };
    const feedback = provider === 'google' ? await generateTutorFeedback('synthetic', { sentence: 'I am now writing.' }, countedEvidenceWordInstruction, fetcher, 30000, undefined, countedEvidenceFeedbackContract)
      : await generateGroqFeedback('synthetic', { sentence: 'I am now writing.' }, countedEvidenceWordInstruction, fetcher, undefined, countedEvidenceFeedbackContract);
    assert.equal(calls.length, 1); assert.equal(feedback.grammar, 'natural');
    assert.deepEqual(provider === 'google' ? calls[0].generationConfig.responseJsonSchema : calls[0].response_format.json_schema.schema, countedEvidenceFeedbackContract.schema);
    assert.equal(sentenceFeedbackSchema.safeParse(feedback).success, true);
  }
});

test('actual diagnostic report preserves the fixed twenty rows, historical references, branch counts and closure without English scores', () => {
  const r = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-01-diagnostics.json', 'utf8'));
  const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  assert.equal(hash(r.attempts), r.attemptsHash); assert.equal(r.attemptsHash, 'a407fe0ae283da2b1a3f845b4c3ab675f74ba710cc50c67a33c311065226af1c');
  assert.equal(r.englishScore, null); assert.equal(r.consumedCalls, 20); assert.equal(r.cumulativeCalls, 675); assert.equal(r.completed, true);
  assert.deepEqual(r.attempts.map(a => a.number), Array.from({ length: 20 }, (_, i) => 656 + i));
  for (const provider of ['google', 'groq']) {
    const rows = r.attempts.filter(a => a.provider === provider), actual = r.byProvider[provider], reasons = {};
    for (const row of rows) { if (row.validationDetail) reasons[row.validationDetail.reason] = (reasons[row.validationDetail.reason] ?? 0) + 1; }
    assert.equal(rows.length, 10); assert.equal(actual.calls, 10); assert.deepEqual(reasons, actual.reasons);
    assert.equal(actual.validResponses, rows.filter(a => a.status === 'valid_response').length); assert.equal(actual.outputRejections, rows.filter(a => a.providerStatus === 200).length);
    assert.equal(actual.upstreamHttpFailures, 0);
  }
  assert.equal(r.byProvider.google.validResponses + r.byProvider.groq.validResponses, 3);
  for (const a of r.attempts) { assert.equal(a.feedback, undefined); assert.equal(a.englishJudgment, undefined); assert.equal(a.sentence, undefined); }
  for (const p of [r.closure.expired, r.closure.final]) { assert.equal(p.status, 404); assert.equal(p.disabled, true); assert.equal(p.actualProviderCalls, 0); }
  assert.equal(r.closure.native.temporaryKeys, 0); assert.equal(r.closure.native.policyUnchanged, true); assert.equal(r.closure.native.originalEnvironmentUnchanged, true);
  // New code and diagnostics do not rewrite the earlier language assessment or requests.
  const old = readFileSync('data/evaluations/english-accuracy-2026-10-01-evidence.json', 'utf8').replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(old).digest('hex'), 'a7066e726f538aa47aa123c9e8ba1abf087d0c1e1cafb7fb525a30503d426980');
});
