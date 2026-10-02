import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import ts from 'typescript';
import { tokenEvidenceInput, parseTokenEvidenceFeedback, tokenEvidenceFeedbackContract, tokenEvidenceWordInstruction, tokenEvidenceGrammarInstruction } from '../lib/token-evidence-feedback.ts';
import { countedEvidenceUnits, parseCountedEvidenceFeedback } from '../lib/counted-evidence-feedback.ts';
import { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL, sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';

const part = (units, fn, meaning = '검사용 한국어 뜻', governor) => ({units, function: fn, meaning, ...(governor !== undefined ? {governor} : {})});
const natural = (parts = [part(['I'], 'subject', '나는'), part(['walk'], 'verb', '걷다'), part(['every', 'morning.'], 'modifier', '매일 아침')]) => ({analysis: {
  grammar: 'natural', target: {reason: 'matched', originalSpan: 'walk', observedUse: '걷다'},
  structure: {status: 'available', translation: '나는 매일 아침 걷는다.', parts},
}});
const parse = (value, sentence = 'I walk every morning.') => parseTokenEvidenceFeedback(JSON.stringify(value), sentence, FEEDBACK_MODEL);
const clone = value => structuredClone(value);

test('literal unit grouping preserves exact source text and computes counts without model arithmetic', () => {
  for (const sentence of ['I walk every morning.', '  I\twalk\nevery  morning.  ']) {
    const result = parse(natural(), sentence);
    assert.equal(result.correctedSentence, sentence);
    assert.deepEqual(result.structure.parts.map(p => [p.text, p.role]), [['I', 'S'], ['walk', 'V'], [sentence.slice(sentence.indexOf('every')).trimEnd(), 'M']]);
    assert.equal(sentenceFeedbackSchema.safeParse(result).success, true);
    for (const key of ['analysis', 'target', 'originalUnits', 'unitCount', 'units']) assert.equal(Object.hasOwn(result, key), false);
  }
  const input = {sentence: 'I walk every morning.', word: 'walk', originalUnits: ['invented']};
  assert.deepEqual(tokenEvidenceInput(input).originalUnits, ['I', 'walk', 'every', 'morning.']);
  assert.deepEqual(input.originalUnits, ['invented']);
  assert.deepEqual(tokenEvidenceInput({...input, originalUnits:'untrusted'}).originalUnits, ['I', 'walk', 'every', 'morning.']);
  const old = natural(); old.analysis.structure.parts = old.analysis.structure.parts.map(p => ({function: p.function, meaning: p.meaning, unitCount: 1}));
  assert.throws(() => parseCountedEvidenceFeedback(JSON.stringify(old), input.sentence, FEEDBACK_MODEL), e => e.validationDetail?.reason === 'leftover_tokens');
  // Correct authored grouping is a compiler test; it is not a newly generated model response.
  assert.equal(parse(natural()).structure.parts[2].text, 'every morning.');
});

test('omissions, reordering, extra words and punctuation changes fail without repairing a response', () => {
  for (const mutate of [v => v.analysis.structure.parts.pop(), v => v.analysis.structure.parts.reverse(),
    v => v.analysis.structure.parts[1].units = ['walk', 'walk'], v => v.analysis.structure.parts[2].units = ['every', 'morning'],
    v => v.analysis.structure.parts[0].units = ['i'], v => v.analysis.structure.parts[2].units.push('invented'),
    v => v.analysis.structure.parts[2].units = ['every morning.']]) {
    const bad = natural(); mutate(bad); assert.throws(() => parse(bad), e => e.stage === 'structure');
  }
  const repeated = natural([part(['I'], 'subject'), part(['see'], 'verb'), part(['a', 'cat', 'and', 'a', 'dog.'], 'direct-object')]);
  repeated.analysis.target.originalSpan = 'see';
  assert.equal(parse(repeated, 'I see a cat and a dog.').structure.parts[2].text, 'a cat and a dog.');
  repeated.analysis.structure.parts[2].units = ['a', 'cat', 'and', 'dog.'];
  assert.throws(() => parse(repeated, 'I see a cat and a dog.'), e => e.validationDetail?.reason === 'span_order');
});

test('contractions, possession, whitespace and Unicode use the same immutable lexical boundaries', () => {
  for (const sentence of ["I'm ready.", '“I’m ready…”', "I'D'VE finished😀."]) {
    const units = countedEvidenceUnits(sentence).map(u => u.text), v = natural([
      part([units[0]], 'subject'), part(units.slice(1, -1), 'verb'), part([units.at(-1)], sentence.includes('ready') ? 'complement' : 'verb'),
    ]);
    v.analysis.target.originalSpan = 'I';
    assert.deepEqual(tokenEvidenceInput({sentence}).originalUnits, units);
    const result = parse(v, sentence); assert.equal(result.correctedSentence, sentence);
    assert.equal(result.structure.parts.at(-1).text, units.at(-1));
    assert.equal(result.correctedSentence.isWellFormed(), true);
  }
  const sentence = 'The cat’s toy fell.', v = natural([part(['The', 'cat', '’s', 'toy'], 'subject'), part(['fell.'], 'verb')]);
  v.analysis.target.originalSpan = 'toy';
  assert.equal(parse(v, sentence).structure.parts[0].text, 'The cat’s toy');
  assert.deepEqual(tokenEvidenceInput({sentence: "We don't agree."}).originalUnits, ['We', "don't", 'agree.']);
  const correctedSentence = "My sister-in-law's son is here.", original = correctedSentence.replace(' is ', ' are ');
  const correction = {analysis: {grammar: 'needs_work', target: {reason: 'matched', originalSpan: 'son', observedUse: '아들'}, correctedSentence,
    changes: [{before: 'are', after: 'is', rule: 'agreement'}], structure: {status: 'available', translation: '내 인척의 아들이 여기 있다.',
      parts: [part(['My', "sister-in-law's", 'son'], 'subject'), part(['is'], 'verb'), part(['here.'], 'modifier')]}}};
  assert.equal(parse(correction, original).correctedSentence, correctedSentence);
  correction.analysis.structure.parts[0].units = ['My', 'sister-in-law', "'s", 'son'];
  assert.throws(() => parse(correction, original), e => e.validationDetail?.reason === 'span_order');
  assert.deepEqual(tokenEvidenceInput({sentence: "The 3's shape changed."}).originalUnits, ['The', "3's", 'shape', 'changed.']);
  assert.match(tokenEvidenceFeedbackContract.instruction, /entire base word consists of letters or combining marks/u);
});

test('the observed English-only gloss shape is rejected even when translation and roles are otherwise correct', () => {
  for (const [sentence, parts, target] of [
    ['I read books every evening.', [part(['I'], 'subject', 'I'), part(['read'], 'verb', 'read'), part(['books'], 'direct-object', 'books'), part(['every', 'evening.'], 'modifier', 'every evening')], 'read'],
    ['I transferred the money yesterday.', [part(['I'], 'subject', 'I'), part(['transferred'], 'verb', 'transferred'), part(['the', 'money'], 'direct-object', 'the money'), part(['yesterday.'], 'modifier', 'yesterday')], 'transferred'],
  ]) {
    const v = natural(parts); v.analysis.target.originalSpan = target;
    assert.throws(() => parse(v, sentence), e => e.stage === 'fields' && e.diagnostic === 'wire_fields');
    v.analysis.structure.parts = parts.map(p => ({...p, meaning: '검사용 한국어 뜻'}));
    assert.equal(parse(v, sentence).grammar, 'natural');
  }
  for (const mutate of [v => v.analysis.target.observedUse = 'walk', v => v.analysis.structure.translation = 'I walk every morning.',
    v => v.analysis.structure.parts[0].meaning = '123', v => v.analysis.structure.parts[0].meaning = '😀']) {
    const v = natural(); mutate(v); assert.throws(() => parse(v), e => e.stage === 'fields');
  }
  const mixed = natural(); mixed.analysis.structure.parts[0].meaning = 'I는 나'; assert.equal(parse(mixed).grammar, 'natural');
  mixed.analysis.structure.parts[0].meaning = '나는'.normalize('NFD'); assert.equal(parse(mixed).grammar, 'natural');
});

test('literal correction anchors and preposition governance remain strict on the corrected sentence', () => {
  const v = {analysis: {grammar: 'needs_work', target: {reason: 'matched', originalSpan: 'bird', observedUse: '새'}, correctedSentence: 'We saw three birds.',
    changes: [{before: 'bird', after: 'birds', rule: 'noun-number'}], structure: {status: 'available', translation: '우리는 새 세 마리를 봤다.',
      parts: [part(['We'], 'subject'), part(['saw'], 'verb'), part(['three', 'birds.'], 'direct-object')]}}};
  assert.equal(parse(v, 'We saw three bird.').correctedSentence, 'We saw three birds.');
  for (const mutate of [x => x.analysis.target.originalSpan = 'birds', x => x.analysis.changes = [],
    x => x.analysis.structure.parts[2].units[1] = 'bird.', x => x.analysis.changes[0].after = 'four birds']) {
    const bad = clone(v); mutate(bad); assert.throws(() => parse(bad, 'We saw three bird.'));
  }
  const prep = natural([part(['They'], 'subject'), part(['listened', 'to'], 'verb'), part(['music.'], 'preposition-object', '음악', 'to')]);
  prep.analysis.target.originalSpan = 'listened';
  assert.match(parse(prep, 'They listened to music.').structure.parts[2].explanation, /to의 목적어/u);
  prep.analysis.structure.parts[2].governor = 'on'; assert.throws(() => parse(prep, 'They listened to music.'), e => e.validationDetail?.reason === 'governor_mismatch');
});

test('uncertainty and target mismatch preserve original judgment contracts without extra fields', () => {
  const result = parse({analysis: {grammar: 'uncertain'}}, 'walk tomorrow');
  assert.equal(result.meaningUsage, 'uncertain'); assert.equal(result.grammar, 'uncertain'); assert.equal(result.correctedSentence, '');
  assert.equal(result.structure.status, 'unavailable'); assert.deepEqual(result.structure.parts, []);
  const v = natural(); v.analysis.target = {reason: 'different-function', originalSpan: 'walk', observedUse: '동사 기능'};
  assert.equal(parse(v).meaningUsage, 'needs_work'); assert.equal(parse(v).correctedSentence, 'I walk every morning.');
  for (const mutate of [x => x.analysis.correctedSentence = 'I run every morning.', x => x.analysis.structure.parts[0].unitCount = 1,
    x => x.analysis.structure.parts[0].governor = '', x => x.analysis.context = 'insufficient']) {
    const bad = natural(); mutate(bad); assert.throws(() => parse(bad));
  }
  const unavailable = natural(); unavailable.analysis.structure = {status: 'unavailable', note: 'complex'};
  assert.equal(parse(unavailable).structure.status, 'unavailable');
});

test('bounded closed schemas expose no raw rejected values and preserve semantic limitations', () => {
  const walk = schema => { if (schema.type === 'object') { assert.equal(schema.additionalProperties, false); assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort()); Object.values(schema.properties).forEach(walk); }
    if (schema.type === 'array') walk(schema.items); if (schema.anyOf) schema.anyOf.forEach(walk); };
  walk(tokenEvidenceFeedbackContract.schema);
  assert.equal(JSON.stringify(tokenEvidenceFeedbackContract.schema).includes('unitCount'), false);
  const secret = 'private-output-marker', bad = natural(); bad.analysis.structure.parts[0].units = [{[secret]:secret}];
  assert.throws(() => parse(bad), e => e.stage === 'fields' && !JSON.stringify(e).includes(secret) && e.message === 'Invalid feedback content');
  for (const units of [[], [''], Array(2001).fill('I')]) { const bad = natural(); bad.analysis.structure.parts[0].units = units; assert.throws(() => parse(bad), e => e.stage === 'fields'); }
  assert.throws(() => parseTokenEvidenceFeedback('x'.repeat(30001), '', FEEDBACK_MODEL), e => e.stage === 'content_limit');
  const wrong = natural([part(['I','walk','every','morning.'], 'direct-object', '완전히 틀린 한국어 뜻')]);
  assert.equal(parse(wrong).structure.parts[0].role, 'O'); // Presence/binding is not semantic certification.
  const hash = file => createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g,'\n')).digest('hex');
  assert.equal(hash('data/evaluations/english-accuracy-2026-10-01-evidence.json'), 'a7066e726f538aa47aa123c9e8ba1abf087d0c1e1cafb7fb525a30503d426980');
});

test('direct transports compile the candidate with one mock call independently of the evaluation API', async () => {
  mkdirSync(resolve('work'), {recursive:true}); const dir = mkdtempSync(resolve('work/token-evidence-')), output = resolve(dir,'transport.mjs');
  await build({stdin:{contents:"export { generateTutorFeedback } from './lib/gemini-feedback'; export { generateGroqFeedback } from './lib/groq-feedback';", resolveDir:process.cwd()}, outfile:output, bundle:true, platform:'node', format:'esm', logLevel:'silent'});
  const {generateTutorFeedback, generateGroqFeedback} = await import(pathToFileURL(output).href);
  for (const provider of ['google','groq']) {
    const calls=[], fetcher = async (url, options) => { calls.push(JSON.parse(options.body)); const content=JSON.stringify(natural());
      return new Response(JSON.stringify(provider==='google' ? {candidates:[{finishReason:'STOP',content:{parts:[{text:content}]}}]}
        : {model:GROQ_FEEDBACK_MODEL,choices:[{finish_reason:'stop',message:{content}}]}), {status:200}); };
    const input = tokenEvidenceInput({sentence:'I walk every morning.'});
    const feedback = provider==='google' ? await generateTutorFeedback('synthetic',input,tokenEvidenceWordInstruction,fetcher,30000,undefined,tokenEvidenceFeedbackContract)
      : await generateGroqFeedback('synthetic',input,tokenEvidenceGrammarInstruction,fetcher,undefined,tokenEvidenceFeedbackContract);
    assert.equal(calls.length,1); assert.equal(feedback.grammar,'natural');
    assert.deepEqual(provider==='google' ? calls[0].generationConfig.responseJsonSchema : calls[0].response_format.json_schema.schema, tokenEvidenceFeedbackContract.schema);
    assert.equal(sentenceFeedbackSchema.safeParse(feedback).success,true);
  }
});

test('TypeScript accepts literal-unit inputs in both transports and rejects incompatible field types', () => {
  // Compile a virtual call site; no emitted files, provider calls or type casts.
  const filename = resolve('token-evidence-type-check.ts');
  const contents = `import {tokenEvidenceInput, tokenEvidenceFeedbackContract} from './lib/token-evidence-feedback';
import {generateTutorFeedback} from './lib/gemini-feedback';
import {generateGroqFeedback} from './lib/groq-feedback';
const input = tokenEvidenceInput({sentence:'I walk every morning.', word:'walk'});
void generateTutorFeedback('synthetic', input, '', undefined, 30000, undefined, tokenEvidenceFeedbackContract);
void generateGroqFeedback('synthetic', input, '', undefined, undefined, tokenEvidenceFeedbackContract);
const overwritten = tokenEvidenceInput({sentence:'I walk.', originalUnits:'untrusted'});
const units: string[] = overwritten.originalUnits;
void units;
// @ts-expect-error An overwritten string field is an array, never a string API.
overwritten.originalUnits.toUpperCase();
// @ts-expect-error The old string type must not survive the override.
const oldUnits: string = overwritten.originalUnits;
void oldUnits;
// @ts-expect-error Non-study-data numeric fields must remain rejected.
void generateTutorFeedback('synthetic', {sentence:'', invalid:1}, '');
// @ts-expect-error The original sentence must remain a string.
void generateGroqFeedback('synthetic', {sentence:[]}, '');
// @ts-expect-error The input builder accepts only transport-compatible study fields.
void tokenEvidenceInput({sentence:'', invalid:1});`;
  const config = ts.readConfigFile(resolve('tsconfig.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const options = {...ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options, incremental:false, noEmit:true};
  const host = ts.createCompilerHost(options), readSource = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, ...rest) => resolve(file) === filename
    ? ts.createSourceFile(file, contents, languageVersion, true) : readSource(file, languageVersion, ...rest);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
  assert.deepEqual(diagnostics.map(d => `${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`), []);
});
