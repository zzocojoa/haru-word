import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { blindAttempt } from '../scripts/evaluate-english-accuracy.mjs';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { parseFeedbackValidationDetail } from '../lib/feedback-validation-detail.ts';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const report = read('data/evaluations/english-accuracy-2026-10-02-counted.json'), plan = read('data/evaluations/counted-evidence-plan.json');
const cases = read('tests/fixtures/english-accuracy.json').cases, baseline = read('data/evaluations/english-accuracy-2026-10-01-chunked-free.json');
const dims = ['meaning', 'grammar', 'correction', 'structure'], count = (a, fn) => a.filter(fn).length;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('counted cohort preserves frozen 675 calls and accounts for the bounded additional cohort', () => {
  assert.equal(report.comparison, 'counted-evidence-v1'); assert.equal(report.sourceCommit, 'f93772e727fd984550f1b81c9518d74e8ad9cf21');
  assert.equal(report.previousCalls, 675); assert.equal(report.approvedCalls, 120); assert.equal(report.maximumTotalCalls, 795);
  assert.equal(report.totalCalls, 675 + report.calls); assert.ok(report.calls <= 120); assert.equal(report.retries, 0); assert.equal(report.fallback, false);
  assert.equal(report.freeTierConfirmation, 'human-user'); assert.equal(report.billingConsoleInspected, false);
  assert.equal(report.fixtureHash, baseline.fixtureHash); assert.equal(report.fixtureContentHash, plan.fixtureContentHash);
  assert.equal(report.previousLedgerHash, plan.combinedParentHash); assert.deepEqual(report.parentLedgerHashes, plan.parentLedgerHashes); assert.deepEqual(report.referenceHashes, plan.references);
  assert.equal(report.rows.length, 120); assert.equal(new Set(report.rows.map(r => r.provider + ':' + r.caseId)).size, 120);
  assert.equal(count(report.rows, r => r.status !== 'not_attempted'), report.calls);
  for (const p of ['google', 'groq']) assert.deepEqual(report.rows.filter(r => r.provider === p).map(r => r.caseId).sort(), cases.map(c => c.id).sort());
  for (const h of [report.ledgerHash, report.blindHash, report.adjudicationHash, report.planHash, ...report.parentLedgerHashes]) assert.match(h, /^[a-f0-9]{64}$/);
  const blind = report.rows.filter(r => r.label).sort((a, b) => a.label.localeCompare(b.label)).map(r => { const b = blindAttempt(r); b.label = r.label; delete b.number; return b; });
  assert.equal(hash(blind), report.blindHash);
});
test('counted result judgments preserve original-language invariants and keep rejection unavailable', () => {
  const allowed = new Set(['caseId', 'provider', 'model', 'status', 'number', 'httpStatus', 'providerStatus', 'code', 'validationStage', 'diagnostic', 'validationDetail',
    'label', 'promptHash', 'requestHash', 'feedback', 'designatedCritical', 'dimensions', 'overall', 'criticalErrors', 'reason']);
  for (const r of report.rows) {
    assert.ok(Object.keys(r).every(k => allowed.has(k))); const c = cases.find(c => c.id === r.caseId);
    assert.ok(c && r.reason.trim()); assert.equal(r.designatedCritical, Object.values(c.expected.critical).some(Boolean)); assert.equal(r.model, report.models[r.provider]);
    assert.equal(r.promptHash, report.profiles[r.caseId].promptHash); assert.equal(r.requestHash, report.profiles[r.caseId].requestHash);
    assert.ok(r.criticalErrors.every(k => c.expected.critical[k])); if (r.criticalErrors.length) assert.equal(r.overall, 'fail');
    if (r.status === 'response') {
      assert.equal(r.httpStatus, 200); assert.ok(sentenceFeedbackSchema.safeParse(r.feedback).success); assert.equal(r.feedback.original, c.sentence); assert.equal(r.feedback.model, r.model);
      assert.ok(r.feedback.structure); assert.ok(dims.every(d => ['pass', 'fail'].includes(r.dimensions[d]))); assert.equal(r.overall, dims.some(d => r.dimensions[d] === 'fail') ? 'fail' : 'pass');
      for (const [f, d] of [['meaningUsage', 'meaning'], ['grammar', 'grammar']]) if (!c.expected[f].includes(r.feedback[f])) assert.equal(r.dimensions[d], 'fail');
      if (r.feedback.grammar === 'natural') assert.equal(r.feedback.correctedSentence, c.sentence);
      if (r.feedback.grammar === 'uncertain') { assert.equal(r.feedback.meaningUsage, 'uncertain'); assert.equal(r.feedback.correctedSentence, ''); assert.equal(r.feedback.structure.status, 'unavailable'); }
      if (c.expected.critical.approveBadGrammar && r.feedback.grammar === 'natural') assert.ok(r.criticalErrors.includes('approveBadGrammar'));
    } else {
      assert.ok(['failure', 'started', 'not_attempted'].includes(r.status)); assert.equal(r.feedback, undefined); assert.equal(r.overall, 'unavailable'); assert.equal(r.criticalErrors.length, 0);
      assert.ok(dims.every(d => r.dimensions[d] === 'unavailable'));
      if (r.validationDetail) assert.ok(parseFeedbackValidationDetail(r.validationDetail, { stage: r.validationStage, diagnostic: r.diagnostic }));
    }
  }
});
test('counted publication gates use full denominators and treat unassessed critical cases as failure', () => {
  for (const p of ['google', 'groq']) {
    const a = report.rows.filter(r => r.provider === p), s = report.summaries[p], comparisons = report.comparisons.filter(c => c.provider === p);
    assert.equal(s.planned, 60); assert.equal(s.attempts, count(a, r => r.status !== 'not_attempted')); assert.equal(s.validResponses, count(a, r => r.status === 'response'));
    for (const [key, value] of [['overallPass', 'pass'], ['languageFail', 'fail'], ['unavailable', 'unavailable']]) assert.equal(s[key], count(a, r => r.overall === value));
    assert.equal(s.outputRejected, count(a, r => ['provider_invalid_response', 'groq_invalid_response'].includes(r.code)));
    assert.equal(s.baselinePass, baseline.summaries[p].overallPass); assert.equal(s.newRegressions, count(comparisons, c => c.regressedDimensions.length));
    assert.equal(s.priorPassNowUnavailable, count(comparisons, c => c.baseline === 'pass' && c.candidate === 'unavailable'));
    for (const d of dims) for (const v of ['pass', 'fail', 'unavailable']) assert.equal(s.dimensions[d][v], count(a, r => r.dimensions[d] === v));
    assert.equal(s.critical.planned, 32); assert.equal(s.critical.available, count(a, r => r.designatedCritical && r.status === 'response')); assert.equal(s.critical.unavailable, 32 - s.critical.available);
    assert.equal(s.critical.failedCases, count(a, r => r.criticalErrors.length)); for (const k of Object.keys(s.critical.errors)) assert.equal(s.critical.errors[k], count(a, r => r.criticalErrors.includes(k)));
    assert.deepEqual(s.checks, { atLeast54: s.overallPass >= 54, noDesignatedCriticalErrors: s.critical.failedCases === 0, allDesignatedCriticalAssessable: s.critical.unavailable === 0,
      noDecreaseFromBaseline: s.overallPass >= s.baselinePass, noNewRegressions: s.newRegressions === 0 }); assert.equal(s.gatePassed, Object.values(s.checks).every(Boolean));
  }
  assert.equal(report.checks.bothProviderGates, Object.values(report.summaries).every(s => s.gatePassed));
  assert.equal(report.checks.all17HistoricalFailuresResolved, report.historicalSummary.observed_resolved === 17);
  assert.equal(report.checks.all17CandidateCasesPass, report.historical.every(h => h.candidateOverall === 'pass'));
  assert.equal(report.checks.noObservedDimensionRegressions, report.comparisons.every(c => !c.regressedDimensions.length));
  assert.equal(report.publication.gatePassed, Object.values(report.checks).every(Boolean)); assert.ok(!report.publication.promptPublished || report.publication.gatePassed);
});
test('counted historical failures and regression claims recompute against the frozen original cohort', () => {
  assert.equal(report.historical.length, 17);
  for (const h of report.historical) {
    const old = baseline.rows.find(r => r.label === h.historicalLabel), now = report.rows.find(r => r.caseId === h.caseId && r.provider === h.provider);
    assert.equal(old.caseId, h.caseId); assert.equal(old.provider, h.provider); assert.equal(old.overall, 'fail');
    assert.deepEqual(h.failedDimensions, dims.filter(d => old.dimensions[d] === 'fail'));
    assert.deepEqual(h.unresolvedDimensions, now.status === 'response' ? h.failedDimensions.filter(d => now.dimensions[d] !== 'pass') : h.failedDimensions);
    assert.equal(h.candidateOverall, now.overall); assert.equal(h.outcome, now.status !== 'response' ? 'unavailable' : h.unresolvedDimensions.length ? 'still_failed' : 'observed_resolved');
  }
  for (const k of ['observed_resolved', 'still_failed', 'unavailable']) assert.equal(report.historicalSummary[k], count(report.historical, h => h.outcome === k));
  for (const c of report.comparisons) {
    const old = baseline.rows.find(r => r.caseId === c.caseId && r.provider === c.provider), now = report.rows.find(r => r.caseId === c.caseId && r.provider === c.provider);
    assert.equal(c.baseline, old.overall); assert.equal(c.candidate, now.overall); assert.equal(c.assessable, old.status === 'response' && now.status === 'response');
    assert.deepEqual(c.regressedDimensions, c.assessable ? dims.filter(d => old.dimensions[d] === 'pass' && now.dimensions[d] === 'fail') : []);
  }
});
test('counted evaluation expires and removes temporary credentials while preserving v3 and audience', () => {
  const c = report.temporaryEndpoint;
  assert.equal(c.keysRemoved, true); for (const p of [c.expiredProbe, c.finalProbe]) { assert.equal(p.status, 404); assert.equal(p.code, 'evaluation_disabled'); assert.equal(p.providerCalls, 0); }
  assert.equal(c.providerCallsForCleanup, 0); assert.equal(c.finalEnvironment.grammarV3, 'true'); assert.equal(c.finalEnvironment.evaluationKeys, 0);
  assert.equal(c.finalSite.access_mode, 'public'); assert.equal(c.finalSite.policy_revision, 4);
  assert.equal(c.originalEnvironmentUnchanged, true); assert.equal(c.fullAccessPolicyUnchanged, true); assert.equal(c.sourceVersionUnchanged, true);
  assert.equal(c.finalEnvironment.candidateEnabled, false); assert.equal(c.sourceCommit, report.sourceCommit);
  for(const d of [c.expiredDeployment,c.finalDeployment]) { assert.equal(d.status,'succeeded'); assert.equal(d.version_id,c.versionId); }
  assert.equal(report.unattempted,120-report.calls); assert.equal(report.authorization.humanAuthorization,'additional-120-free-counted-calls');
  assert.equal(report.review.providerAndModelHiddenUntilAdjudication, true); assert.ok(report.review.checkedReferences.length);
  assert.match(report.review.referenceAccess, /403.*official indexed text/);
  assert.equal(report.validationPolicy, 'counted-evidence-v1+original-judgment-v1'); assert.equal(report.publication.plannedCasesPerProvider, 60); assert.equal(report.publication.complete120Collection, report.calls === 120);
});

test('counted observed provider stops preserve all unassessed cases and safe failure branches', () => {
  assert.equal(report.calls, 26); assert.equal(report.totalCalls, 701); assert.equal(report.unattempted, 94);
  assert.deepEqual(report.providerStops, { google: 'provider_precondition', groq: 'groq_limit' });
  assert.equal(report.publication.complete120Collection, false); assert.equal(report.publication.gatePassed, false);
  assert.equal(report.historicalSummary.unavailable, 17); assert.equal(report.historicalSummary.observed_resolved, 0);
  assert.equal(count(report.rows, r => r.status === 'response'), 14);
  assert.equal(count(report.rows, r => r.overall === 'pass'), 12);
  assert.equal(count(report.rows, r => r.overall === 'fail'), 2);
  assert.deepEqual(report.rows.filter(r => r.overall === 'fail').map(r => [r.provider, r.caseId, r.dimensions.structure]),
    [['groq', 'word-02', 'fail'], ['groq', 'word-15', 'fail']]);
  const failures = report.rows.filter(r => r.status === 'failure');
  assert.equal(failures.filter(r => r.providerStatus === 200).length, 10);
  assert.equal(failures.filter(r => r.validationDetail?.reason === 'leftover_tokens').length, 6);
  assert.equal(failures.filter(r => r.validationDetail?.reason === 'part_exceeds_tokens').length, 3);
  assert.equal(failures.filter(r => r.validationDetail?.reason === 'governor_mismatch').length, 1);
  assert.ok(failures.some(r => r.provider === 'google' && r.providerStatus === 400 && r.code === 'provider_precondition'));
  assert.ok(failures.some(r => r.provider === 'groq' && r.providerStatus === 429 && r.code === 'groq_limit'));
  assert.ok(report.rows.filter(r => r.status !== 'not_attempted').every(r => r.caseId.startsWith('word-') && Number(r.caseId.slice(5)) <= 19));
  assert.equal(report.summaries.google.critical.unavailable, 32); assert.equal(report.summaries.groq.critical.unavailable, 30);
});
