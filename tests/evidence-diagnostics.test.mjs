import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { parseEvidenceFeedback } from '../lib/evidence-feedback.ts';
import { parseFeedbackValidationDetail } from '../lib/feedback-validation-detail.ts';
import { FEEDBACK_MODEL } from '../lib/sentence-feedback.ts';
import { feedbackErrorBody } from '../lib/feedback-issue.ts';
import { collectEvidenceComparison, validateEvidenceComparison } from '../scripts/evaluate-evidence-feedback.mjs';
import { originalComparisonFixture } from '../scripts/evaluate-original-feedback.mjs';

const original = 'They listened to music.';
const part = (text, fn, governor = '') => ({ text, function: fn, meaning: '합성 검사', governor });
const wire = (sentence = original) => ({ context: 'sufficient', meaningUsage: 'appropriate', grammar: 'natural',
  correctedSentence: sentence, target: { reason: 'matched', originalSpan: sentence.split(' ')[0], observedUse: '합성 용법' }, changes: [],
  structure: { status: 'available', translation: '합성 검사', note: 'none', parts: [part('They', 'subject'), part('listened to', 'verb'), part('music.', 'preposition-object', 'to')] } });
const withheld = () => ({ ...wire(), context: 'insufficient', meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '',
  target: { reason: 'ambiguous', originalSpan: '', observedUse: '' },
  structure: { status: 'unavailable', translation: '', parts: [], note: 'insufficient' } });
const correction = () => ({ ...wire(), grammar: 'needs_work', correctedSentence: 'They listened to songs.',
  changes: [{ before: 'music', after: 'songs', rule: 'word-order' }],
  structure: { status: 'unavailable', translation: '', parts: [], note: 'complex' } });
function reject(value, reason, sentence = original, index) {
  let failure;
  assert.throws(() => parseEvidenceFeedback(JSON.stringify(value), sentence, FEEDBACK_MODEL), e => { failure = e; return true; });
  assert.equal(failure.message, 'Invalid feedback content');
  assert.equal(failure.diagnostic, 'evidence_contract');
  const expected = { kind: failure.stage === 'judgment' ? 'evidence_judgment' : 'evidence_structure', reason,
    ...(index === undefined ? {} : { partIndex: index }) };
  assert.deepEqual(failure.validationDetail, expected);
  assert.deepEqual(parseFeedbackValidationDetail(expected, failure), expected);
  assert.doesNotMatch(JSON.stringify(failure), /합성|listened|music|SECRET/u);
  return failure;
}

test('judgment diagnostics distinguish context, original target evidence and unchanged natural grammar', () => {
  const variations = [
    [withheld, v => v.context = 'sufficient', 'context_grammar'],
    [withheld, v => v.correctedSentence = 'SECRET', 'context_withholding'],
    [wire, v => v.structure.note = 'insufficient', 'context_note'],
    [wire, v => v.meaningUsage = 'uncertain', 'target_judgment'],
    [wire, v => v.target.originalSpan = 'SECRET', 'target_span'],
    [wire, v => { v.target.reason = 'absent'; v.meaningUsage = 'needs_work'; }, 'target_absent'],
    [wire, v => v.target.observedUse = '', 'target_evidence_missing'],
    [wire, v => { v.target.reason = 'ambiguous'; v.meaningUsage = 'uncertain'; }, 'target_ambiguous_use'],
    [wire, v => v.correctedSentence += ' ', 'natural_rewrite'],
    [wire, v => v.changes = [{ before: 'music', after: 'songs', rule: 'word-order' }], 'unexpected_edits'],
  ];
  for (const [make, change, reason] of variations) { const v = make(); change(v); reject(v, reason); }
});

test('edit diagnostics distinguish absent, repeated, overlapping, unchanged and incomplete edit evidence', () => {
  const variations = [
    [v => v.changes = [], 'edit_missing'],
    [v => v.correctedSentence = '', 'correction_missing'],
    [v => v.changes[0].before = 'SECRET', 'edit_anchor_absent'],
    [v => v.changes[0].after = v.changes[0].before, 'edit_unchanged'],
    [v => v.correctedSentence = 'They listen to songs.', 'edit_reconstruction'],
    [v => { v.correctedSentence = original + ' '; v.changes = [{ before: 'music.', after: 'music. ', rule: 'word-order' }]; }, 'edit_no_effect'],
    [v => v.changes.push({ before: 'listened', after: 'listen', rule: 'verb-form' }), 'edit_anchor_order'],
  ];
  for (const [change, reason] of variations) { const v = correction(); change(v); reject(v, reason); }
  const repeated = correction(); repeated.target.originalSpan = 'They'; repeated.changes[0].before = 'music';
  reject(repeated, 'edit_anchor_ambiguous', 'They listened to music and played music.');
});

test('structure diagnostics separate omitted text, note/status contradictions and bounded part failures', () => {
  let v = wire(); v.structure.parts[1].text = 'SECRET'; reject(v, 'span_order', original, 1);
  v = wire(); v.structure.parts[2].text = 'music'; reject(v, 'span_leftover');
  v = wire(); v.structure.parts = []; reject(v, 'available_parts');
  v = wire(); v.structure.translation = ' '; reject(v, 'available_translation');
  v = wire(); v.structure.note = 'complex'; reject(v, 'available_note');
  v = wire(); v.structure.status = 'unavailable'; v.structure.note = 'complex'; reject(v, 'unavailable_parts');
  v.structure.parts = []; reject(v, 'unavailable_translation');
  v.structure.translation = ''; v.structure.note = 'none'; reject(v, 'unavailable_note');
  v = wire(''); v.target = { reason: 'absent', originalSpan: '', observedUse: '' }; v.meaningUsage = 'needs_work'; v.structure.parts = [];
  reject(v, 'available_sentence', '');
  for (const [governor, reason] of [['', 'governor_missing'], [' to', 'governor_whitespace'], ['on', 'governor_mismatch']]) {
    v = wire(); v.structure.parts[2].governor = governor; reject(v, reason, original, 2);
  }
  v = wire(); v.structure.parts[0].governor = 'SECRET'; reject(v, 'unexpected_governor', original, 0);
  // Artificial surfaces isolate boundaries; they are not English accuracy examples.
  for (const [sentence, prefix, object, reason] of [
    ['A toB.', 'A to', 'B.', 'governor_object_boundary'],
    ['A into B.', 'A into', 'B.', 'governor_prefix_boundary'],
    ['A to to B.', 'A to', 'to B.', 'governor_inside_object'],
  ]) {
    v = wire(sentence); v.structure.parts = [part(prefix, 'verb'), part(object, 'preposition-object', 'to')];
    reject(v, reason, sentence, 1);
  }
});

test('diagnostic parsing rejects invented text, unknown reasons, inconsistent stages and invalid indexes', () => {
  const judgment = { kind: 'evidence_judgment', reason: 'natural_rewrite' };
  const structure = { kind: 'evidence_structure', reason: 'span_order', partIndex: 19 };
  for (const [v, stage] of [[judgment, 'judgment'], [structure, 'structure']]) {
    assert.deepEqual(parseFeedbackValidationDetail(v, { stage, diagnostic: 'evidence_contract' }), v);
    for (const bad of [{ ...v, reason: 'SECRET' }, { ...v, sentence: 'SECRET' }, { ...v, message: 'SECRET' }, { ...v, path: ['SECRET'] }]) assert.equal(parseFeedbackValidationDetail(bad), undefined);
    for (const context of [{ stage: stage === 'judgment' ? 'structure' : 'judgment', diagnostic: 'evidence_contract' }, { stage, diagnostic: 'wire_fields' }, { stage, diagnostic: 'chunk_count' }]) assert.equal(parseFeedbackValidationDetail(v, context), undefined);
  }
  for (const partIndex of [-1, 20, 1.5, '1', null, undefined]) assert.equal(parseFeedbackValidationDetail({ ...structure, partIndex }), undefined);
  assert.equal(parseFeedbackValidationDetail({ ...judgment, partIndex: 0 }), undefined);
  assert.equal(parseFeedbackValidationDetail({ ...structure, reason: 'span_leftover' }), undefined);
  assert.ok(parseFeedbackValidationDetail({ kind: 'tokens', reason: 'leftover_tokens', tokenCount: 4, consumedTokens: 3 }, { stage: 'structure', diagnostic: 'chunk_count' }));
  assert.ok(parseFeedbackValidationDetail({ kind: 'schema', issues: [{ field: 'grammar', reason: 'enum' }], truncated: false }, { stage: 'fields', diagnostic: 'wire_fields' }));
});

mkdirSync(resolve('work'), { recursive: true });
const directory = mkdtempSync(resolve('work/evidence-diagnostics-tests-'));
async function bundle(entry, name) {
  const file = resolve(directory, name + '.mjs');
  await build({ entryPoints: [entry], outfile: file, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'mock-env', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const env=globalThis.__evidenceDiagnosticsEnv;', loader: 'js' }));
  } }] });
  return import(pathToFileURL(file).href);
}
globalThis.__evidenceDiagnosticsEnv = {};
const api = await bundle('app/api/english-accuracy-evaluation/route.ts', 'route'), helper = await bundle('lib/evidence-feedback-evaluation.ts', 'helper');
const envelope = (v, provider) => provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(v) }] } }] }
  : { model: helper.accuracyModels.groq, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(v) } }] };

test('both mocked transports preserve bounded reasons through the fixed-case API and learner bodies omit diagnostics', async () => {
  const env = globalThis.__evidenceDiagnosticsEnv, originalFetch = globalThis.fetch; let calls = 0;
  const request = provider => new Request('https://study.test/api/english-accuracy-evaluation', { method: 'POST', headers: {
    Origin: 'https://study.test', 'Content-Type': 'application/json', 'X-English-Accuracy-Token': 'f'.repeat(64) },
    body: JSON.stringify({ caseId: 'word-08', provider, comparison: 'evidence-v1' }) });
  try {
    Object.assign(env, { english_accuracy_token: 'f'.repeat(64), english_accuracy_expires: new Date(Date.now() + 60000).toISOString(), english_accuracy_profile: 'evidence-v1', google_api: 'mock', groq_api: 'mock' });
    for (const provider of ['google', 'groq']) {
      // word-08's input is fixed by the server; this fabricated answer contradicts its original target.
      const invalid = wire('Her present was a book.'); invalid.target.originalSpan = 'SECRET';
      globalThis.fetch = async () => { calls++; return Response.json(envelope(invalid, provider)); };
      const response = await api.POST(request(provider)), result = await response.json();
      assert.equal(response.status, 502); assert.equal(result.providerStatus, 200);
      assert.equal(result.validationStage, 'judgment'); assert.equal(result.diagnostic, 'evidence_contract');
      assert.deepEqual(result.validationDetail, { kind: 'evidence_judgment', reason: 'target_span' });
      assert.doesNotMatch(JSON.stringify(result), /SECRET|listened|music/);
      const learner = feedbackErrorBody(result.code, { providerStatus: 200 });
      assert.equal(learner.validationDetail, undefined); assert.equal(learner.diagnostic, undefined);
    }
    delete env.english_accuracy_token;
    assert.equal((await api.POST(request('google'))).status, 404); assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; for (const k of Object.keys(env)) delete env[k]; }
});

test('collector persists only matching safe detail and terminal recovery cannot call a provider', async () => {
  const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'), profiles = {};
  for (const sample of helper.accuracyCases) profiles[sample.id] = { domain: sample.domain, ...await helper.evidenceAccuracyHashes(sample) };
  const previous = Array.from({ length: 540 }, (_, i) => ({ number: i + 1, status: 'failure' }));
  const reference = JSON.parse(readFileSync(helper.evidencePlan.references[0].path, 'utf8'));
  const expected = { ...originalComparisonFixture(fixtureText, reference.fixtureHash), previousHash: hash(previous),
    planHash: hash(helper.evidencePlan), referenceHashes: helper.evidencePlan.references, sourceCommit: 'a'.repeat(40), profiles, models: helper.accuracyModels, schedule: helper.evidenceSchedule() };
  const ledger = { comparison: 'evidence-v1', maximumCalls: 120, freeTierConfirmation: 'human-user', ...structuredClone(expected), providerStops: {}, attempts: [] };
  const helpers = { cases: helper.accuracyCases, parseFeedback: helper.parseEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail,
    safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
  const context = { previous, ledger, expected, helpers, config: { origin: 'https://study.test', evaluationToken: 'mock' } };
  const detail = { kind: 'evidence_structure', reason: 'span_order', partIndex: 2 }; let calls = 0;
  await collectEvidenceComparison(context, { save: () => {}, pause: async () => {}, fetcher: async (_url, init) => {
    const { provider } = JSON.parse(init.body); calls++;
    return Response.json({ code: provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response', validationStage: 'structure', diagnostic: 'evidence_contract',
      validationDetail: calls === 1 ? { ...detail, message: 'SECRET' } : calls === 2 ? { ...detail, reason: 'natural_rewrite' } : detail }, { status: 502 });
  } });
  assert.equal(calls, 120); assert.equal(ledger.attempts[0].validationDetail, undefined); assert.equal(ledger.attempts[1].validationDetail, undefined);
  assert.deepEqual(ledger.attempts[2].validationDetail, detail); assert.doesNotMatch(JSON.stringify(ledger), /SECRET/);
  validateEvidenceComparison(previous, ledger, expected, helpers);
  await collectEvidenceComparison(context, { save: () => { throw Error('no save'); }, fetcher: async () => { throw Error('no HTTP'); } });
  ledger.attempts[2].validationDetail.partIndex = 20;
  await assert.rejects(collectEvidenceComparison(context, { fetcher: async () => { throw Error('no HTTP'); } }), /Invalid safe validation detail/);
});

test('context contrast pairs expose the semantic boundary of mechanical validation without changing scores', () => {
  // These are contract probes, not generated model answers or a performance score.
  const complete = 'The weather is warm.', v = wire(complete);
  v.structure.parts = [part('The weather', 'subject'), part('is', 'verb'), part('warm.', 'complement')];
  assert.equal(parseEvidenceFeedback(JSON.stringify(v), complete, FEEDBACK_MODEL).grammar, 'natural');
  // A self-consistent wrong model decision also passes; diagnostic enums cannot judge English intent.
  assert.equal(parseEvidenceFeedback(JSON.stringify(withheld()), complete, FEEDBACK_MODEL).grammar, 'uncertain');
  for (const list of ['weather or climate', 'arrive leave']) assert.equal(parseEvidenceFeedback(JSON.stringify(withheld()), list, FEEDBACK_MODEL).grammar, 'uncertain');
  const imperative = wire('Wait!'); imperative.structure.parts = [part('Wait!', 'verb')];
  assert.equal(parseEvidenceFeedback(JSON.stringify(imperative), 'Wait!', FEEDBACK_MODEL).grammar, 'natural');
  const ambiguousTarget = structuredClone(v); ambiguousTarget.meaningUsage = 'uncertain'; ambiguousTarget.target = { reason: 'ambiguous', originalSpan: 'weather', observedUse: '' };
  assert.equal(parseEvidenceFeedback(JSON.stringify(ambiguousTarget), complete, FEEDBACK_MODEL).grammar, 'natural');
  const listApproved = wire('weather or climate'); listApproved.structure.parts = [part('weather', 'subject'), part('or', 'connector'), part('climate', 'subject')];
  assert.equal(parseEvidenceFeedback(JSON.stringify(listApproved), 'weather or climate', FEEDBACK_MODEL).grammar, 'natural');
  assert.ok(helper.accuracyCases.every(sample => Object.hasOwn(sample, 'sentence')));
});
