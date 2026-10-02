import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseAnnotatedEvidenceFeedback, annotatedEvidenceFeedbackContract, annotatedEvidenceWordInstruction,
  annotatedEvidenceGrammarInstruction, ANNOTATED_PREPOSITION_RULE } from '../lib/annotated-evidence-feedback.ts';
import { parseTokenEvidenceFeedback, tokenEvidenceFeedbackContract, tokenEvidenceInput } from '../lib/token-evidence-feedback.ts';
import { EVIDENCE_RULES } from '../lib/evidence-feedback.ts';
import { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL, sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { parseFeedbackValidationDetail } from '../lib/feedback-validation-detail.ts';

const part = (units, fn, meaning, governor) => ({ units, function: fn, meaning, ...(governor === undefined ? {} : { governor }) });
const natural = (parts = [part(['The', 'nurse'], 'subject', '그 간호사는'), part(['is'], 'verb', '이다'), part(['kind.'], 'complement', '친절한')]) => ({ analysis: {
  grammar: 'natural', target: { reason: 'matched', originalSpan: 'kind', observedUse: '친절한' },
  structure: { status: 'available', translation: '그 간호사는 친절하다.', parts },
} });
const parse = (value, original = 'The nurse is kind.') => parseAnnotatedEvidenceFeedback(JSON.stringify(value), original, FEEDBACK_MODEL);
const correction = () => ({ analysis: { grammar: 'needs_work', target: { reason: 'matched', originalSpan: 'good', observedUse: '능숙한' },
  correctedSentence: 'She is good at chess.', changes: [{ before: 'in', after: 'at', rule: 'preposition' }],
  structure: { status: 'available', translation: '그녀는 체스를 잘한다.', parts: [part(['She'], 'subject', '그녀는'), part(['is'], 'verb', '이다'), part(['good', 'at', 'chess.'], 'complement', '체스에 능숙한')] },
} });

test('new rule note covers adjective prepositions while old evaluated compiler text is preserved', () => {
  const value = correction(), text = JSON.stringify(value), original = 'She is good in chess.';
  const old = parseTokenEvidenceFeedback(text, original, FEEDBACK_MODEL), now = parse(value, original);
  assert.ok(old.explanation.includes(EVIDENCE_RULES.preposition.text)); assert.ok(now.explanation.includes(ANNOTATED_PREPOSITION_RULE));
  assert.ok(!now.explanation.includes(EVIDENCE_RULES.preposition.text));
  assert.equal(now.correctedSentence, old.correctedSentence); assert.deepEqual(now.structure, old.structure);
  assert.equal(now.meaningUsage, old.meaningUsage); assert.equal(now.grammar, old.grammar);
  // Model-authored target prose is not globally replaced with an app rule.
  value.analysis.target.observedUse = EVIDENCE_RULES.preposition.text;
  const embedded = parse(value, original);
  assert.ok(embedded.explanation.includes(`「${EVIDENCE_RULES.preposition.text}」`));
  assert.ok(embedded.explanation.endsWith(ANNOTATED_PREPOSITION_RULE));
  const originalUnits = correction(); originalUnits.analysis.structure.parts[2].units = ['good', 'in', 'chess.'];
  assert.throws(() => parse(originalUnits, original), e => e.validationDetail?.reason === 'span_order');
});

test('available subject assertions without a verb are rejected rather than repaired into a sentence', () => {
  for (const [original, parts, target] of [
    ['Poetry', [part(['Poetry'], 'subject', '시')], 'Poetry'],
    ['apples or oranges', [part(['apples'], 'subject', '사과'), part(['or'], 'connector', '또는'), part(['oranges'], 'subject', '오렌지')], 'apples'],
  ]) {
    const value = natural(parts); value.analysis.target = { reason: 'matched', originalSpan: target, observedUse: '명사' };
    assert.equal(parseTokenEvidenceFeedback(JSON.stringify(value), original, FEEDBACK_MODEL).structure.status, 'available');
    assert.throws(() => parse(value, original), error => error.stage === 'structure'
      && !!parseFeedbackValidationDetail(error.validationDetail, { stage: error.stage, diagnostic: error.diagnostic }));
    assert.equal(parse({ analysis: { grammar: 'uncertain' } }, original).structure.status, 'unavailable');
  }
});

test('clear imperatives, explicit clauses and a quoted noun inside a clause remain valid', () => {
  assert.equal(parse(natural()).grammar, 'natural');
  const command = natural([part(['Stop!'], 'verb', '멈춰라')]); command.analysis.target = { reason: 'matched', originalSpan: 'Stop', observedUse: '명령' };
  command.analysis.structure.translation = '멈춰라!'; const feedback = parse(command, 'Stop!');
  assert.deepEqual(feedback.structure.parts.map(p => p.role), ['V']); assert.equal(feedback.correctedSentence, 'Stop!');
  const quoted = natural([part(['I'], 'subject', '나는'), part(['wrote'], 'verb', '썼다'), part(['"Poetry".'], 'direct-object', '시라는 단어를')]);
  quoted.analysis.target.originalSpan = 'wrote'; assert.equal(parse(quoted, 'I wrote "Poetry".').grammar, 'natural');
});

test('a preposition governing the next noun cannot also be the verb direct object', () => {
  const value = natural([part(['He'], 'subject', '그는'), part(['relies'], 'verb', '의지한다'),
    part(['on'], 'direct-object', '~에'), part(['us.'], 'preposition-object', '우리를', 'on')]);
  value.analysis.target.originalSpan = 'relies'; const original = 'He relies on us.';
  assert.equal(parseTokenEvidenceFeedback(JSON.stringify(value), original, FEEDBACK_MODEL).structure.parts[2].role, 'O');
  assert.throws(() => parse(value, original), e => e.validationDetail?.reason === 'structure_contract');
  value.analysis.structure.parts = [part(['He'], 'subject', '그는'), part(['relies', 'on'], 'verb', '의지한다'), part(['us.'], 'preposition-object', '우리를', 'on')];
  assert.match(parse(value, original).structure.parts[2].explanation, /on의 목적어/u);
  value.analysis.structure.parts[2].governor = 'at';
  assert.throws(() => parse(value, original), e => e.validationDetail?.reason === 'governor_mismatch');
  for (const governor of ['because of', 'because  of']) {
    const original = `We stayed ${governor} the rain.`, compound = natural([
      part(['We'], 'subject', '우리는'), part(['stayed'], 'verb', '머물렀다'),
      part(['because', 'of'], 'direct-object', '~때문에'), part(['the', 'rain.'], 'preposition-object', '비', governor),
    ]);
    compound.analysis.target = {reason:'matched', originalSpan:'stayed', observedUse:'머물렀다'};
    compound.analysis.structure.translation = '우리는 비 때문에 머물렀다.';
    assert.equal(parseTokenEvidenceFeedback(JSON.stringify(compound), original, FEEDBACK_MODEL).structure.parts[2].text, governor);
    assert.throws(() => parse(compound, original), e => e.validationDetail?.reason === 'structure_contract');
    compound.analysis.structure.parts.splice(2, 2, part(['because', 'of', 'the', 'rain.'], 'modifier', '비 때문에'));
    assert.equal(parse(compound, original).structure.parts[2].role, 'M');
  }
});

test('schema descriptions guide Korean fields without changing old schema or relaxing any selected branch', () => {
  const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'description').map(([key, child]) => [key, clean(child)])) : value;
  assert.deepEqual(clean(annotatedEvidenceFeedbackContract.schema), tokenEvidenceFeedbackContract.schema);
  assert.ok(JSON.stringify(annotatedEvidenceFeedbackContract.schema).includes('한국어'));
  assert.equal(JSON.stringify(tokenEvidenceFeedbackContract.schema).includes('description'), false);
  const descriptions = [];
  const visit = schema => { if (!schema || typeof schema !== 'object') return;
    if (schema.properties?.units) descriptions.push(schema.properties.units.description);
    Object.values(schema).forEach(value => Array.isArray(value) ? value.forEach(visit) : visit(value)); };
  visit(annotatedEvidenceFeedbackContract.schema); assert.ok(descriptions.length);
  for (const description of descriptions) { assert.match(description, /natural.*originalUnits/u); assert.match(description, /needs_work.*correctedSentence/u); }
  const bad = natural(); bad.analysis.target.observedUse = 'kind';
  assert.throws(() => parse(bad), e => e.stage === 'fields');
  bad.analysis.target.observedUse = '친절한'; bad.analysis.structure.parts[0].meaning = 'The nurse';
  assert.throws(() => parse(bad), e => e.stage === 'fields');
  const missing = natural(); missing.analysis.structure.parts[2].units = ['kind'];
  assert.throws(() => parse(missing), e => e.validationDetail?.reason === 'span_order');
});

test('all historical token profile hashes and actual result snapshots stay unchanged by candidate options', async () => {
  mkdirSync(resolve('work'), { recursive: true });
  const directory = mkdtempSync(resolve('work/annotated-profile-')), output = resolve(directory, 'profile.mjs');
  await build({ entryPoints: ['lib/token-evidence-evaluation.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { tokenEvidenceCases, tokenEvidenceHashes } = await import(pathToFileURL(output).href);
  const result = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-02-token.json', 'utf8'));
  for (const sample of tokenEvidenceCases) {
    const hashes = await tokenEvidenceHashes(sample);
    assert.equal(hashes.promptHash, result.profiles[sample.id].promptHash); assert.equal(hashes.requestHash, result.profiles[sample.id].requestHash);
  }
  assert.ok(annotatedEvidenceFeedbackContract.instruction.includes(ANNOTATED_PREPOSITION_RULE));
  assert.ok(!annotatedEvidenceFeedbackContract.instruction.includes(EVIDENCE_RULES.preposition.text));
  assert.match(annotatedEvidenceGrammarInstruction, /identifiable intended grammatical function/u);
});

test('descriptions and local contradiction guards do not certify arbitrary role or Korean meaning accuracy', () => {
  const wrong = natural([part(['The', 'nurse', 'is', 'kind.'], 'direct-object', '완전히 틀린 뜻')]);
  // No model judgment is relabeled. Semantic evaluation remains necessary.
  assert.equal(parse(wrong).structure.parts[0].role, 'O');
  const unavailable = natural(); unavailable.analysis.structure = { status: 'unavailable', note: 'complex' };
  assert.equal(parse(unavailable).grammar, 'natural'); assert.equal(parse(unavailable).structure.status, 'unavailable');
});

test('existing direct transports serialize the new descriptions and parse it with one offline mock call each', async () => {
  mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/annotated-evidence-')), output = resolve(directory, 'transport.mjs');
  await build({ stdin: { contents: "export {generateTutorFeedback} from './lib/gemini-feedback'; export {generateGroqFeedback} from './lib/groq-feedback';", resolveDir: process.cwd() },
    outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { generateTutorFeedback, generateGroqFeedback } = await import(pathToFileURL(output).href);
  for (const provider of ['google', 'groq']) {
    const calls = [], fetcher = async (_url, options) => {
      calls.push(JSON.parse(options.body)); const content = JSON.stringify(natural());
      return new Response(JSON.stringify(provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: content }] } }] }
        : { model: GROQ_FEEDBACK_MODEL, choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
    };
    const input = tokenEvidenceInput({ sentence: 'The nurse is kind.' });
    const feedback = provider === 'google' ? await generateTutorFeedback('synthetic', input, annotatedEvidenceWordInstruction, fetcher, 30000, undefined, annotatedEvidenceFeedbackContract)
      : await generateGroqFeedback('synthetic', input, annotatedEvidenceGrammarInstruction, fetcher, undefined, annotatedEvidenceFeedbackContract);
    assert.equal(calls.length, 1); assert.ok(sentenceFeedbackSchema.safeParse(feedback).success);
    assert.deepEqual(provider === 'google' ? calls[0].generationConfig.responseJsonSchema : calls[0].response_format.json_schema.schema, annotatedEvidenceFeedbackContract.schema);
  }
});
