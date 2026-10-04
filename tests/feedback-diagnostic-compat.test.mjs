import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { parseFeedbackValidationDetail, summarizeValidationIssues } from '../lib/feedback-validation-detail.ts';
import { FEEDBACK_DIAGNOSTICS } from '../lib/provider-feedback-contract.ts';
import { feedbackErrorBody } from '../lib/feedback-issue.ts';

const fixture = JSON.parse(readFileSync('tests/fixtures/feedback-diagnostic-compat.json', 'utf8'));
const context = detail => detail.kind === 'schema' ? { stage: 'fields', diagnostic: 'wire_fields' }
  : detail.kind === 'tokens' ? { stage: 'structure', diagnostic: 'chunk_count' }
    : { stage: detail.kind === 'evidence_judgment' ? 'judgment' : 'structure', diagnostic: 'evidence_contract' };

test('all 77 archived diagnostic objects remain readable without importing experimental generators', () => {
  assert.equal(fixture.records.length, 25);
  assert.equal(fixture.records.reduce((sum, r) => sum + r.occurrences, 0), 77);
  assert.equal(fixture.sources.reduce((sum, r) => sum + r.diagnosticRecords, 0), 77);
  for (const { stage, diagnostic, detail } of fixture.records) {
    assert.ok(FEEDBACK_DIAGNOSTICS.includes(diagnostic));
    assert.deepEqual(parseFeedbackValidationDetail(detail, { stage, diagnostic }), detail);
  }
});

test('diagnostic metadata rejects private text, unknown fields, wrong stages and invalid part indices', () => {
  for (const { detail } of fixture.records) {
    for (const extra of ['message', 'original', 'providerBody', 'unknownKey']) {
      assert.equal(parseFeedbackValidationDetail({ ...detail, [extra]: 'PRIVATE_TEXT' }, context(detail)), undefined);
    }
    assert.equal(parseFeedbackValidationDetail(detail, { ...context(detail), stage: 'envelope' }), undefined);
    assert.equal(parseFeedbackValidationDetail(detail, { ...context(detail), diagnostic: 'free_tier_region' }), undefined);
  }
  const part = { kind: 'evidence_structure', reason: 'span_order', partIndex: 0 };
  for (const partIndex of [-1, 20, 1.5, '1', null, Number.NaN, Infinity])
    assert.equal(parseFeedbackValidationDetail({ ...part, partIndex }, context(part)), undefined);
  assert.deepEqual(parseFeedbackValidationDetail({ ...part, partIndex: 19 }, context(part)), { ...part, partIndex: 19 });
  for (const detail of [
    { kind: 'evidence_judgment', reason: 'span_order' },
    { kind: 'evidence_structure', reason: 'natural_rewrite' },
    { kind: 'evidence_structure', reason: 'span_order' },
    { kind: 'evidence_structure', reason: 'span_leftover', partIndex: 1 },
    { kind: 'evidence_judgment', reason: 'PRIVATE_TEXT' },
    { kind: 'schema', issues: [{ field: 'PRIVATE_TEXT', reason: 'missing' }], truncated: false },
  ]) assert.equal(parseFeedbackValidationDetail(detail), undefined);
});

test('schema diagnostics normalize only trusted paths and never copy unknown names or messages', () => {
  const cases = [
    [[], 'root'], [['analysis'], 'analysis'],
    [['target', 'originalSpan'], 'target.originalSpan'],
    [['structure', 'parts', 2, 'governor'], 'structure.parts[].governor'],
    [['changes', 0, 'before'], 'changes[].before'],
    [['analysis', 'changes', 2, 'after'], 'analysis.changes[].after'],
    [['analysis', 'structure', 'parts', 1, 'unitCount'], 'analysis.structure.parts[].unitCount'],
    [['analysis', 'structure', 'parts', 1, 'units', 2], 'analysis.structure.parts[].units[]'],
    [['analysis', 'PRIVATE.path'], 'other'], [['analysis', 'parts[]'], 'other'],
    [['analysis.structure.parts[].units[]'], 'other'],
    [['structure', 'parts', '0', 'role'], 'other'],
    [['analysis', 'structure', 'parts', -1, 'units', 0], 'other'],
    [['analysis', 'structure', 'parts', 0.5, 'units', 0], 'other'],
    [['changes', Infinity, 'before'], 'other'],
  ];
  for (const [path, field] of cases) {
    const result = summarizeValidationIssues([{ path, code: 'invalid_type', expected: 'string', received: 'undefined', message: 'PRIVATE_TEXT' }]);
    assert.deepEqual(result, { kind: 'schema', issues: [{ field, reason: 'missing' }], truncated: false });
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  }
  const discriminator = summarizeValidationIssues([{ path: ['analysis', 'grammar'], code: 'invalid_union_discriminator', options: ['PRIVATE'], message: 'PRIVATE' }]);
  assert.equal(discriminator.issues[0].reason, 'enum');
  const capped = summarizeValidationIssues(Array.from({ length: 9 }, () => ({ path: ['PRIVATE'], code: 'custom', message: 'PRIVATE' })));
  assert.equal(capped.issues.length, 8); assert.equal(capped.truncated, true);
});

test('learning API error projection still excludes evaluation diagnostics and provider text', () => {
  for (const { detail } of fixture.records) {
    const error = feedbackErrorBody('provider_invalid_response', { providerStatus: 200, ...context(detail), validationDetail: detail, providerBody: 'PRIVATE' });
    assert.deepEqual(Object.keys(error).sort(), ['code', 'error', 'providerStatus']);
    assert.equal(error.code, 'provider_invalid_response'); assert.equal(error.providerStatus, 200);
    assert.doesNotMatch(JSON.stringify(error), /PRIVATE|validationDetail|diagnostic/);
  }
});

globalThis.diagnosticCompatEnv = {};
await build({ entryPoints: ['app/api/english-accuracy-evaluation/route.ts'], outfile: 'work/diagnostic-compat-tests/route.mjs',
  bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', plugins: [{ name: 'synthetic-env', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export const env=globalThis.diagnosticCompatEnv', loader: 'js' }));
  } }],
});
const { POST } = await import('../work/diagnostic-compat-tests/route.mjs');
test('archived diagnostics do not enable evaluation requests or new experimental profiles', async () => {
  const originalFetch = globalThis.fetch, token = 'd'.repeat(64); let calls = 0;
  const request = (comparison, variant) => new Request('https://study.test/api/english-accuracy-evaluation', { method: 'POST', headers: {
    Origin: 'https://study.test', 'Content-Type': 'application/json', 'X-English-Accuracy-Token': token,
  }, body: JSON.stringify({ caseId: 'word-32', provider: 'google', comparison, ...(variant ? { variant } : {}) }) });
  try {
    globalThis.fetch = async () => { calls++; throw Error('Provider execution is forbidden in compatibility tests'); };
    assert.equal((await POST(request('coherent-feedback-v1'))).status, 404);
    Object.assign(globalThis.diagnosticCompatEnv, { english_accuracy_token: token, english_accuracy_expires: new Date(Date.now() - 1000).toISOString(), google_api: 'test-only' });
    assert.equal((await POST(request('coherent-feedback-v1'))).status, 404);
    globalThis.diagnosticCompatEnv.english_accuracy_expires = new Date(Date.now() + 60000).toISOString();
    for (const [comparison, variant] of [
      ['root-cause-v1', 'control'], ['coherent-feedback-v1'], ['evidence-v1'], ['counted-evidence-v1'],
      ['token-evidence-v1'], ['annotated-evidence-v1'], ['relational-evidence-v1'],
      ['reasoning-pilot-v1', 'current'], ['reasoning-pilot-v1', 'high'],
    ]) {
      globalThis.diagnosticCompatEnv.english_accuracy_profile = comparison;
      const response = await POST(request(comparison, variant));
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { code: 'evaluation_invalid_request' });
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(globalThis.diagnosticCompatEnv)) delete globalThis.diagnosticCompatEnv[key];
  }
});
