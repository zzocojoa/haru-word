import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { blindAttempt } from '../scripts/evaluate-english-accuracy.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const report = read('data/evaluations/english-accuracy-2026-10-01-original-first.json');
const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8');
const samples = new Map(JSON.parse(fixtureText).cases.map(c => [c.id, c]));
const baseline = read('data/evaluations/english-accuracy-2026-09-30.json');
const previous = read('data/evaluations/english-accuracy-2026-09-30-round-2.json');
const dimensions = ['meaning', 'grammar', 'correction', 'structure'];
const criticalKeys = ['approveBadGrammar', 'reverseMeaning', 'swapRoles'];
const count = (rows, predicate) => rows.filter(predicate).length;

test('persisted pilot covers the frozen 60 cases once per provider within the approved budget', () => {
  assert.equal(createHash('sha256').update(fixtureText.replace(/\r\n/g, '\n')).digest('hex'), report.fixtureContentHash);
  assert.equal(report.fixtureHash, baseline.fixtureHash);
  assert.equal(report.previousLedgerHash, '0e6a30364b116d5eae393c298738211a3773a78336923369546c628fd9e91aa6');
  assert.equal(report.sourceCommit, 'd02d7a95dbdfbd392e113ac10e10d073f6103f47');
  assert.equal(report.comparison, 'original-first');
  assert.deepEqual([report.calls, report.previousCalls, report.totalCalls, report.maxCalls, report.retries, report.fallback], [120, 240, 360, 360, 0, false]);
  assert.equal(report.rows.length, 120);
  assert.equal(new Set(report.rows.map(r => r.label)).size, 120);
  assert.equal(new Set(report.rows.map(r => `${r.provider}:${r.caseId}`)).size, 120);
  const blinded = [...report.rows].sort((a, b) => a.label.localeCompare(b.label)).map(row => {
    const projected = blindAttempt(row); projected.label = row.label; delete projected.number; return projected;
  });
  assert.equal(createHash('sha256').update(JSON.stringify(blinded)).digest('hex'), report.blindHash);
  assert.deepEqual(Object.keys(report.requestHashes).sort(), [...samples.keys()].sort());
  for (const hash of [report.ledgerHash, report.blindHash, ...Object.values(report.promptHashes), ...Object.values(report.requestHashes)]) assert.match(hash, /^[a-f0-9]{64}$/);
  for (const provider of ['google', 'groq']) assert.deepEqual(report.rows.filter(r => r.provider === provider).map(r => r.caseId).sort(), [...samples.keys()].sort());
});

test('language judgments are attached only to valid authored feedback; failures contain safe metadata', () => {
  const allowedKeys = new Set(['label', 'caseId', 'dimensions', 'overall', 'criticalErrors', 'reason', 'provider', 'model', 'status', 'httpStatus', 'providerStatus', 'code', 'validationStage', 'designatedCritical', 'feedback']);
  const failureCodes = new Set(['provider_invalid_response', 'provider_unavailable', 'provider_precondition', 'groq_request', 'groq_invalid_response']);
  for (const row of report.rows) {
    for (const key of Object.keys(row)) assert.ok(allowedKeys.has(key), `Unexpected row field: ${key}`);
    const sample = samples.get(row.caseId);
    assert.ok(sample && row.reason.trim());
    assert.equal(row.model, report.summaries[row.provider].model);
    assert.equal(row.designatedCritical, Object.values(sample.expected.critical).some(Boolean));
    assert.ok(row.criticalErrors.every(key => criticalKeys.includes(key) && sample.expected.critical[key]));
    if (row.criticalErrors.length) assert.equal(row.overall, 'fail');
    if (row.status === 'response') {
      assert.equal(row.httpStatus, 200);
      assert.equal(row.feedback.original, sample.sentence);
      assert.equal(row.feedback.model, row.model);
      assert.ok(sentenceFeedbackSchema.safeParse(row.feedback).success);
      assert.ok(dimensions.every(d => ['pass', 'fail'].includes(row.dimensions[d])));
      assert.equal(row.overall, dimensions.some(d => row.dimensions[d] === 'fail') ? 'fail' : 'pass');
      for (const [field, dimension] of [['meaningUsage', 'meaning'], ['grammar', 'grammar']]) if (!sample.expected[field].includes(row.feedback[field])) assert.equal(row.dimensions[dimension], 'fail');
      if (sample.expected.critical.approveBadGrammar && row.feedback.grammar === 'natural') assert.ok(row.criticalErrors.includes('approveBadGrammar'));
    } else {
      assert.equal(row.status, 'failure');
      assert.equal(row.feedback, undefined);
      assert.ok(failureCodes.has(row.code));
      assert.ok(row.validationStage === undefined || ['fields', 'structure', 'judgment'].includes(row.validationStage));
      assert.deepEqual(dimensions.map(d => row.dimensions[d]), Array(4).fill('unavailable'));
      assert.equal(row.overall, 'unavailable');
      assert.deepEqual(row.criticalErrors, []);
    }
  }
});

test('every published count and gate follows the row judgments without excluding unavailable cases', () => {
  for (const provider of ['google', 'groq']) {
    const rows = report.rows.filter(r => r.provider === provider), summary = report.summaries[provider];
    assert.equal(summary.attempts, 60);
    for (const [field, predicate] of [['validResponses', r => r.status === 'response'], ['unavailable', r => r.overall === 'unavailable'], ['overallPass', r => r.overall === 'pass'], ['languageFail', r => r.overall === 'fail']]) assert.equal(summary[field], count(rows, predicate));
    for (const d of dimensions) for (const status of ['pass', 'fail', 'unavailable']) assert.equal(summary.dimensions[d][status], count(rows, r => r.dimensions[d] === status));
    for (const [field, key] of [['failures', 'code'], ['validationStages', 'validationStage']]) {
      const histogram = {};
      for (const row of rows.filter(r => r.status !== 'response')) histogram[row[key] ?? 'unclassified'] = (histogram[row[key] ?? 'unclassified'] ?? 0) + 1;
      assert.deepEqual(summary[field], histogram);
    }
    assert.equal(summary.baselinePass, baseline.summaries[provider].overallPass);
    assert.equal(summary.previousCandidatePass, previous.summaries[provider].overallPass);
    assert.equal(summary.passDifference, summary.overallPass - summary.baselinePass);
    const critical = rows.filter(r => r.designatedCritical);
    assert.equal(summary.critical.designated, critical.length);
    assert.equal(critical.length, 32);
    assert.equal(summary.critical.available, count(critical, r => r.status === 'response'));
    assert.equal(summary.critical.unavailable, count(critical, r => r.status !== 'response'));
    assert.equal(summary.critical.failedCases, count(rows, r => r.criticalErrors.length > 0));
    for (const key of criticalKeys) assert.equal(summary.critical.errors[key], count(rows, r => r.criticalErrors.includes(key)));
    assert.deepEqual(summary.checks, { atLeast54: summary.overallPass >= 54, noDesignatedCriticalErrors: summary.critical.failedCases === 0, allDesignatedCriticalAssessable: summary.critical.unavailable === 0, noDecreaseFromBaseline: summary.passDifference >= 0 });
    assert.equal(summary.gatePassed, Object.values(summary.checks).every(Boolean));
  }
  assert.equal(report.publication.gatePassed, Object.values(report.summaries).every(s => s.gatePassed));
  assert.equal(report.publication.gatePassed, false);
  assert.equal(report.publication.promptPublished, false);
});

test('completed evaluation records endpoint closure and keeps the candidate off', () => {
  const endpoint = report.temporaryEndpoint;
  assert.equal(endpoint.expiredEnvironmentRevision, 21);
  assert.equal(endpoint.removedEnvironmentRevision, 22);
  assert.equal(endpoint.expiredTokenProbe.includedPreviousEvaluationToken, true);
  for (const probe of [endpoint.expiredTokenProbe, endpoint.finalProbe]) assert.deepEqual([probe.status, probe.code], [404, 'evaluation_disabled']);
  assert.equal(endpoint.finalProbe.includedEvaluationToken, false);
  assert.equal(endpoint.providerCallsFromCleanup, 0);
  assert.equal(endpoint.candidateEnabled, false);
  assert.equal(endpoint.v3Enabled, true);
  assert.equal(endpoint.finalKeys.length, 7);
  assert.ok(!endpoint.finalKeys.some(k => ['english_accuracy_token', 'english_accuracy_expires', 'feedback_original_sentence_enabled'].includes(k)));
});
