import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseRelationalEvidenceFeedback, relationalEvidenceFeedbackContract, relationalEvidenceInput,
  relationalEvidenceWordInstruction, relationalEvidenceGrammarInstruction } from '../lib/relational-evidence-feedback.ts';
import { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL, sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { parseFeedbackValidationDetail } from '../lib/feedback-validation-detail.ts';

const p = (units, fn, meaning, extra = {}) => ({ units, function: fn, meaning, ...extra });
const v = (units, kind = 'lexical') => p(units, 'verb', '행동', { kind });
const target = (span, category = 'verb', gloss = '행동') => ({ reason: 'matched', originalSpan: span, category, gloss });
const natural = (sentence, parts, subjectSpan, predicateSpan, t = target(predicateSpan)) => ({ analysis: {
  grammar: 'natural', context: { kind: 'clause', subjectSpan, predicateSpan }, target: t,
  structure: { status: 'available', translation: '주어진 문장의 뜻을 유지한다.', parts },
} });
const parse = (value, original) => parseRelationalEvidenceFeedback(JSON.stringify(value), original, FEEDBACK_MODEL);
const rejection = fn => assert.throws(fn, e => e.stage === 'structure' && !!parseFeedbackValidationDetail(e.validationDetail, { stage: e.stage, diagnostic: e.diagnostic }));
const prep = () => natural('The pilot depends on her crew.', [p(['The', 'pilot'], 'subject', '그 조종사는'), v(['depends']),
  p(['on'], 'preposition', '~에'), p(['her', 'crew.'], 'preposition-object', '그녀의 승무원들', { governorPart: 2 })], 'The pilot', 'depends');
const infinitive = () => natural('We intend to repair the gate.', [p(['We'], 'subject', '우리는'), v(['intend']),
  p(['to', 'repair', 'the', 'gate.'], 'infinitive-clause', '문을 수리하는 것', { role: 'complement', verbPart: 1,
    children: [p(['to'], 'infinitive-marker', '부정사 표지'), v(['repair'], 'nonfinite'), p(['the', 'gate.'], 'direct-object', '그 문을', { verbPart: 1 })] })], 'We', 'intend', target('repair', 'infinitive', '수리하는 것'));

test('objects bind to an explicit preposition rather than an arbitrary preceding verb or adjective', () => {
  const original = 'The pilot depends on her crew.', x = prep(), f = parse(x, original);
  assert.deepEqual(f.structure.parts.map(p => p.role), ['S', 'V', 'M', 'O']);
  assert.match(f.structure.parts[3].explanation, /on의 목적어/u); assert.ok(!f.structure.parts[3].explanation.includes('depends의 목적어'));
  x.analysis.structure.parts[3].governorPart = 1; rejection(() => parse(x, original));
  x.analysis.structure.parts[2] = p(['on'], 'preposition-object', '~에', { governorPart: 1 }); rejection(() => parse(x, original));
  x.analysis.structure.parts[1] = p(['depends'], 'complement', '의존하는'); rejection(() => parse(x, original));
});

test('a whole prepositional phrase has a modifier or complement role and cannot declare an object role', () => {
  const x = prep(), original = 'The pilot depends on her crew.';
  x.analysis.structure.parts.splice(2, 2, p(['on', 'her', 'crew.'], 'prepositional-phrase', '그녀의 승무원들에게', { role: 'complement' }));
  const f = parse(x, original); assert.equal(f.structure.parts[2].role, 'C'); assert.match(f.structure.parts[2].explanation, /전치사구/u);
  x.analysis.structure.parts[2].role = 'direct-object'; assert.throws(() => parse(x, original), e => e.stage === 'fields');
});

test('references support preposition stranding, fronted objects, passive subjects and surface-order auxiliaries', () => {
  const q = natural('Who did she speak to?', [p(['Who'], 'preposition-object', '누구에게', { governorPart: 4 }), v(['did'], 'auxiliary'),
    p(['she'], 'subject', '그녀는'), v(['speak']), p(['to?'], 'preposition', '~에게')], 'she', 'did', target('Who', 'pronoun', '누구'));
  assert.match(parse(q, 'Who did she speak to?').structure.parts[0].explanation, /to\?의 목적어/u);
  const front = natural('Which gate did they repair?', [p(['Which', 'gate'], 'direct-object', '어느 문을', { verbPart: 3 }),
    v(['did'], 'auxiliary'), p(['they'], 'subject', '그들은'), v(['repair?'])], 'they', 'did');
  assert.equal(parse(front, 'Which gate did they repair?').structure.parts[0].role, 'O');
  const passive = natural('The gate was repaired by the pilot.', [p(['The', 'gate'], 'subject', '그 문은'), v(['was'], 'auxiliary'),
    v(['repaired']), p(['by'], 'preposition', '~에 의해'), p(['the', 'pilot.'], 'preposition-object', '그 조종사', { governorPart: 3 })], 'The gate', 'was');
  assert.equal(parse(passive, 'The gate was repaired by the pilot.').structure.parts[0].role, 'S');
});

test('a whole infinitive keeps its internal object within its own scope instead of two outer objects', () => {
  const x = infinitive(), original = 'We intend to repair the gate.', f = parse(x, original);
  assert.deepEqual(f.structure.parts.map(p => p.role), ['S', 'V', 'C']); assert.equal(f.structure.parts[2].text, 'to repair the gate.');
  assert.match(f.structure.parts[2].explanation, /부정사절 전체/u); assert.ok(sentenceFeedbackSchema.safeParse(f).success);
  x.analysis.structure.parts[2].units = ['to', 'repair']; x.analysis.structure.parts[2].children.pop();
  x.analysis.structure.parts.push(p(['the', 'gate.'], 'direct-object', '그 문을', { verbPart: 1 })); rejection(() => parse(x, original));
  x.analysis.structure.parts[2] = p(['to', 'repair'], 'direct-object', '수리하는 것', { verbPart: 1 }); rejection(() => parse(x, original));
});

test('nested references are local, children cover the whole clause and finite verbs cannot masquerade as infinitives', () => {
  const original = 'We intend to carefully repair the gate.', x = infinitive(), clause = x.analysis.structure.parts[2];
  clause.units.splice(1, 0, 'carefully'); clause.children.splice(1, 0, p(['carefully'], 'modifier', '조심스럽게'));
  clause.children[3].verbPart = 2; assert.equal(parse(x, original).grammar, 'natural');
  clause.children[3].verbPart = 1; rejection(() => parse(x, original)); clause.children[3].verbPart = 2;
  clause.children[2].kind = 'lexical'; rejection(() => parse(x, original)); clause.children[2].kind = 'nonfinite';
  clause.children[0].units = ['repair']; rejection(() => parse(x, original));
});

test('subject infinitives and an explicit for-subject infinitive remain representable', () => {
  const children = [p(['To'], 'infinitive-marker', '부정사 표지'), v(['repair'], 'nonfinite'), p(['it'], 'direct-object', '그것을', { verbPart: 1 })];
  const x = natural('To repair it is difficult.', [p(['To', 'repair', 'it'], 'infinitive-clause', '그것을 수리하는 것',
    { role: 'subject', verbPart: null, children }), v(['is'], 'linking'), p(['difficult.'], 'complement', '어려운')], 'To repair it', 'is');
  assert.equal(parse(x, 'To repair it is difficult.').structure.parts[0].role, 'S');
  const y = natural('It is unusual for him to lose.', [p(['It'], 'subject', '그것은'), v(['is'], 'linking'), p(['unusual'], 'complement', '드문'),
    p(['for', 'him', 'to', 'lose.'], 'infinitive-clause', '그가 지는 것', { role: 'complement', verbPart: 1, children: [
      p(['for'], 'connector', '부정사절의 주어를 연결'), p(['him'], 'subject', '그가'), p(['to'], 'infinitive-marker', '부정사 표지'), v(['lose.'], 'nonfinite'),
    ] })], 'It', 'is'); assert.ok(sentenceFeedbackSchema.safeParse(parse(y, 'It is unusual for him to lose.')).success);
});

test('progressive verbs and genuine gerund complements remain distinct, and auxiliaries/linking verbs do not govern objects', () => {
  const prog = natural('They are quietly painting.', [p(['They'], 'subject', '그들은'), v(['are'], 'auxiliary'), p(['quietly'], 'modifier', '조용히'), v(['painting.'])], 'They', 'are');
  assert.deepEqual(parse(prog, 'They are quietly painting.').structure.parts.map(p => p.role), ['S', 'V', 'M', 'V']);
  const gerund = natural('Their hobby is painting.', [p(['Their', 'hobby'], 'subject', '그들의 취미는'), v(['is'], 'linking'), p(['painting.'], 'complement', '그림 그리기')], 'Their hobby', 'is');
  assert.equal(parse(gerund, 'Their hobby is painting.').structure.parts[2].role, 'C');
  gerund.analysis.structure.parts[2] = p(['painting.'], 'direct-object', '그림 그리기', { verbPart: 1 }); rejection(() => parse(gerund, 'Their hobby is painting.'));
  prog.analysis.structure.parts[3] = p(['painting.'], 'direct-object', '그림 그리기', { verbPart: 1 }); rejection(() => parse(prog, 'They are quietly painting.'));
});

test('original context evidence blocks invented subjects while genuine and explicit-subject imperatives remain valid', () => {
  const x = natural('eat go', [p(['I'], 'subject', '나는'), v(['eat', 'and', 'go.'])], 'I', 'eat');
  x.analysis.grammar = 'needs_work'; x.analysis.correctedSentence = 'I eat and go.'; x.analysis.changes = [{ before: 'eat go', after: 'I eat and go.', rule: 'word-order' }];
  rejection(() => parse(x, 'eat go')); x.analysis.context = { kind: 'imperative', subjectSpan: '', predicateSpan: 'eat' }; rejection(() => parse(x, 'eat go'));
  const withheld = parse({ analysis: { grammar: 'uncertain' } }, 'walk / walked / metal');
  assert.equal(withheld.meaningUsage, 'uncertain'); assert.equal(withheld.correctedSentence, ''); assert.equal(withheld.structure.status, 'unavailable');
  const command = natural('Open the gate!', [v(['Open']), p(['the', 'gate!'], 'direct-object', '그 문을', { verbPart: 0 })], '', 'Open');
  command.analysis.context.kind = 'imperative'; assert.equal(parse(command, 'Open the gate!').grammar, 'natural');
  command.analysis.structure.parts.unshift(p(['You'], 'subject', '너는')); command.analysis.structure.parts[2].verbPart = 1;
  command.analysis.context.subjectSpan = 'You'; assert.equal(parse(command, 'You Open the gate!').grammar, 'natural');
});

test('typed usage builds neutral descriptions without independently authored role or transitivity claims', () => {
  const original = 'Her parcel was a book.', x = natural(original, [p(['Her', 'parcel'], 'subject', '그녀의 소포는'), v(['was'], 'linking'),
    p(['a', 'book.'], 'complement', '책 한 권')], 'Her parcel', 'was', target('parcel', 'noun', '소포'));
  const f = parse(x, original); assert.match(f.explanation, /소포 \(명사\)/u); assert.ok(!f.explanation.includes('보어'));
  x.analysis.target.observedUse = '보어이며 그녀가 주어'; assert.throws(() => parse(x, original), e => e.stage === 'fields');
  delete x.analysis.target.observedUse;
  for (const category of ['auxiliary', 'modal', 'article', 'number']) {
    // All 15 existing lesson topics can express their observed use.
    x.analysis.target.category = category; assert.ok(sentenceFeedbackSchema.safeParse(parse(x, original)).success);
  }
});

test('context spans must be unique whole units without subject-predicate overlap', () => {
  const original = 'She had had dinner.', x = natural(original, [p(['She'], 'subject', '그녀는'),
    v(['had'], 'auxiliary'), v(['had']), p(['dinner.'], 'direct-object', '저녁을', { verbPart: 2 })], 'She', 'had had', target('dinner', 'noun', '저녁'));
  assert.ok(sentenceFeedbackSchema.safeParse(parse(x, original)).success);
  x.analysis.context.predicateSpan = 'had'; rejection(() => parse(x, original));
  x.analysis.context.predicateSpan = 'had had';
  for (const subjectSpan of ['he', 'Sh', 'She had']) { x.analysis.context.subjectSpan = subjectSpan; rejection(() => parse(x, original)); }
});

test('a unique context unit is not duplicated by its characters inside another word', () => {
  for (const [original, objectUnits] of [['He saw Henry.', ['Henry.']], ['He saw a sawfish.', ['a', 'sawfish.']]]) {
    const x = natural(original, [p(['He'], 'subject', '그는'), v(['saw']),
      p(objectUnits, 'direct-object', '대상을', { verbPart: 1 })], 'He', 'saw', target('saw', 'verb', '보았다'));
    assert.equal(parse(x, original).grammar, 'natural');
  }
});

test('every return branch validates the unchanged stored sentence length limit', () => {
  const uncertain = { analysis: { grammar: 'uncertain' } };
  assert.ok(sentenceFeedbackSchema.safeParse(parse(uncertain, 'x'.repeat(2000))).success);
  rejection(() => parse(uncertain, 'x'.repeat(2001)));
  const unavailable = length => { const original = `I go ${'x'.repeat(length - 5)}`;
    return { original, wire: { analysis: { grammar: 'needs_work', context: { kind: 'clause', subjectSpan: 'I', predicateSpan: 'go' },
      target: { reason: 'absent' }, correctedSentence: 'I work.', changes: [{ before: original.slice(2), after: 'work.', rule: 'word-order' }],
      structure: { status: 'unavailable', note: 'complex' } } } };
  };
  for (const length of [2000, 2001]) {
    const { original, wire } = unavailable(length);
    if (length === 2000) assert.ok(sentenceFeedbackSchema.safeParse(parse(wire, original)).success);
    else rejection(() => parse(wire, original));
  }
});

test('long governing verb descriptions preserve the full gloss and relation within 140 stored characters', () => {
  const governor = 'planned to patiently and very carefully examine, describe, compare, measure, weigh, and finally catalogue';
  const original = `We ${governor} the stones.`, meaning = '이'.repeat(60);
  const x = natural(original, [p(['We'], 'subject', '우리는'), v(governor.split(' ')),
    p(['the', 'stones.'], 'direct-object', meaning, { verbPart: 1 })], 'We', 'planned', target('stones', 'noun', '돌'));
  for (const fn of ['direct-object', 'indirect-object']) {
    x.analysis.structure.parts[2].function = fn;
    const f = parse(x, original), explanation = f.structure.parts[2].explanation;
    assert.ok(explanation.startsWith(`${meaning} · planned`)); assert.ok(explanation.includes('…의'));
    assert.ok(explanation.endsWith(fn === 'direct-object' ? '직접목적어' : '간접목적어'));
    assert.equal(explanation.length, 140); assert.ok(sentenceFeedbackSchema.safeParse(f).success);
  }
  // Synthetic Unicode input tests display bounds, not English correctness.
  const budget = 140 - `${meaning} · `.length - '의 직접목적어'.length;
  const unicodeGovernor = `${'g'.repeat(budget - 2)}😀 extra`, unicodeOriginal = `We ${unicodeGovernor} the stones.`;
  x.analysis.context.predicateSpan = unicodeGovernor;
  x.analysis.structure.parts[1].units = unicodeGovernor.split(' '); x.analysis.structure.parts[2].function = 'direct-object';
  const f = parse(x, unicodeOriginal), explanation = f.structure.parts[2].explanation;
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(explanation));
  assert.ok(explanation.length <= 140); assert.ok(explanation.endsWith('…의 직접목적어'));
  assert.ok(sentenceFeedbackSchema.safeParse(f).success);
});

test('specific correction causes teach mass quantities, state aspect, modal bases and omitted infinitive markers', () => {
  const samples = [
    { original: 'She can sings.', corrected: 'She can sing.', before: 'sings', after: 'sing', rule: 'modal-base', note: '조동사 뒤', s: 'She', v: 'can',
      parts: [p(['She'], 'subject', '그녀는'), v(['can'], 'auxiliary'), v(['sing.'])] },
    { original: 'I am owning a cottage.', corrected: 'I own a cottage.', before: 'am owning', after: 'own', rule: 'state-aspect', note: '상태', s: 'I', v: 'am owning',
      parts: [p(['I'], 'subject', '나는'), v(['own']), p(['a', 'cottage.'], 'direct-object', '별장 하나를', { verbPart: 1 })] },
    { original: 'We need two advices.', corrected: 'We need two pieces of advice.', before: 'advices', after: 'pieces of advice', rule: 'uncountable-quantity', note: '불가산명사', s: 'We', v: 'need',
      parts: [p(['We'], 'subject', '우리는'), v(['need']), p(['two', 'pieces', 'of', 'advice.'], 'direct-object', '두 가지 조언을', { verbPart: 1 })] },
  ];
  for (const c of samples) {
    const x = natural(c.original, c.parts, c.s, c.v); Object.assign(x.analysis, { grammar: 'needs_work', correctedSentence: c.corrected,
      changes: [{ before: c.before, after: c.after, rule: c.rule }] });
    const f = parse(x, c.original); assert.equal(f.correctedSentence, c.corrected); assert.ok(f.explanation.includes(c.note)); assert.ok(sentenceFeedbackSchema.safeParse(f).success);
  }
  const x = infinitive(); x.analysis.context.subjectSpan = 'We'; x.analysis.context.predicateSpan = 'intend';
  x.analysis.grammar = 'needs_work'; x.analysis.correctedSentence = 'We intend to repair the gate.';
  x.analysis.changes = [{ before: 'intend repair', after: 'intend to repair', rule: 'infinitive-marker' }];
  assert.match(parse(x, 'We intend repair the gate.').explanation, /빠진 표지/u);
});

test('literal bindings, strict fields, reference limits and safe diagnostics are preserved', () => {
  const original = 'The pilot depends on her crew.', x = prep();
  x.analysis.structure.parts[3].governorPart = 20; assert.throws(() => parse(x, original), e => e.stage === 'fields' && !!parseFeedbackValidationDetail(e.validationDetail));
  x.analysis.structure.parts[3].governorPart = 2; x.analysis.structure.parts[0].units.reverse(); rejection(() => parse(x, original));
  const bad = prep(); bad.analysis.target.gloss = 'depends'; assert.throws(() => parse(bad, original), e => e.stage === 'fields');
  assert.throws(() => parseRelationalEvidenceFeedback('{', original, FEEDBACK_MODEL), e => e.stage === 'json_syntax');
  assert.throws(() => parseRelationalEvidenceFeedback('x'.repeat(30001), original, FEEDBACK_MODEL), e => e.stage === 'content_limit');
  const unknown = prep(); unknown.analysis.structure.parts[0]['private-learner-text'] = 'private-learner-text';
  assert.throws(() => parse(unknown, original), e => !JSON.stringify(e.validationDetail).includes('private-learner-text'));
});

test('typed relations still do not certify an arbitrary lexical gloss or falsely declared part of speech', () => {
  const x = prep(); x.analysis.target.gloss = '완전히 다른 뜻';
  assert.equal(parse(x, 'The pilot depends on her crew.').grammar, 'natural');
  // Correct types/literal references cannot prove a model's English assertions.
  x.analysis.structure.parts[1] = p(['depends'], 'preposition', '틀린 전치사 주장');
  x.analysis.structure.parts[2] = v(['on']); x.analysis.structure.parts[3].governorPart = 1;
  assert.equal(parse(x, 'The pilot depends on her crew.').structure.parts[3].role, 'O');
});

test('the closed nonrecursive wire uses required properties on every JSON object and mock direct transports parse it', async () => {
  const visit = node => { if (!node || typeof node !== 'object') return;
    if (node.type === 'object') { assert.equal(node.additionalProperties, false); assert.deepEqual(node.required.sort(), Object.keys(node.properties).sort()); }
    for (const v of Object.values(node)) { if (Array.isArray(v)) v.forEach(visit); else visit(v); }
  }; visit(structuredClone(relationalEvidenceFeedbackContract.schema));
  mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/relational-')), output = resolve(directory, 'providers.mjs');
  await build({ stdin: { contents: "export {generateTutorFeedback} from './lib/gemini-feedback'; export {generateGroqFeedback} from './lib/groq-feedback';", resolveDir: process.cwd() },
    outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { generateTutorFeedback, generateGroqFeedback } = await import(pathToFileURL(output).href);
  for (const provider of ['google', 'groq']) {
    let calls = 0; const fetcher = async (_url, options) => { calls++;
      const body = JSON.parse(options.body); assert.deepEqual(provider === 'google' ? body.generationConfig.responseJsonSchema : body.response_format.json_schema.schema, relationalEvidenceFeedbackContract.schema);
      const content = JSON.stringify(prep()); return new Response(JSON.stringify(provider === 'google'
        ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: content }] } }] }
        : { model: GROQ_FEEDBACK_MODEL, choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
    };
    const input = relationalEvidenceInput({ sentence: 'The pilot depends on her crew.' });
    const f = provider === 'google' ? await generateTutorFeedback('synthetic', input, relationalEvidenceWordInstruction, fetcher, 30000, undefined, relationalEvidenceFeedbackContract)
      : await generateGroqFeedback('synthetic', input, relationalEvidenceGrammarInstruction, fetcher, undefined, relationalEvidenceFeedbackContract);
    assert.equal(calls, 1); assert.ok(sentenceFeedbackSchema.safeParse(f).success);
  }
});

test('all frozen annotated request hashes retain the exact actual evaluated profiles', async () => {
  const directory = mkdtempSync(resolve('work/relational-profile-')), output = resolve(directory, 'old.mjs');
  await build({ entryPoints: ['lib/annotated-evidence-evaluation.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { annotatedEvidenceCases, annotatedEvidenceHashes } = await import(pathToFileURL(output).href);
  const old = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-02-annotated.json', 'utf8'));
  for (const c of annotatedEvidenceCases) { const hashes = await annotatedEvidenceHashes(c);
    assert.equal(hashes.promptHash, old.profiles[c.id].promptHash); assert.equal(hashes.requestHash, old.profiles[c.id].requestHash);
  }
});
