import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { blindAttempt } from '../scripts/evaluate-english-accuracy.mjs';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { parseFeedbackValidationDetail } from '../lib/feedback-validation-detail.ts';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const report = read('data/evaluations/english-accuracy-2026-10-02-annotated.json'), plan = read('data/evaluations/annotated-evidence-plan.json');
const cases = read('tests/fixtures/english-accuracy.json').cases, baseline = read('data/evaluations/english-accuracy-2026-10-01-chunked-free.json');
const dims = ['meaning', 'grammar', 'correction', 'structure'], count = (a, fn) => a.filter(fn).length;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('annotated full cohort preserves frozen735 calls and accounts for separately approved120', () => {
  assert.equal(report.comparison, 'annotated-evidence-v1'); assert.equal(report.sourceCommit, 'e687fe757db9133cd8a02f1bfc32fe8e8b7602c4');
  assert.equal(report.previousCalls, 735); assert.equal(report.approvedCalls, 120); assert.equal(report.maximumTotalCalls, 855);
  assert.equal(report.totalCalls, 735 + report.calls); assert.ok(report.calls <= 120); assert.equal(report.retries, 0); assert.equal(report.fallback, false);
  assert.equal(report.freeTierConfirmation, 'human-user'); assert.equal(report.billingConsoleInspected, false);
  assert.equal(report.fixtureHash, baseline.fixtureHash); assert.equal(report.fixtureContentHash, plan.fixtureContentHash);
  assert.equal(report.previousLedgerHash, plan.combinedParentHash); assert.deepEqual(report.parentLedgerHashes, plan.parentLedgerHashes); assert.deepEqual(report.referenceHashes, plan.references);
  assert.equal(report.rows.length, 120); assert.equal(new Set(report.rows.map(r => r.provider + ':' + r.caseId)).size, 120);
  assert.equal(count(report.rows, r => r.status !== 'not_attempted'), report.calls);
  for (const p of ['google', 'groq']) assert.deepEqual(report.rows.filter(r => r.provider === p).map(r => r.caseId).sort(), [...plan.caseIds].sort());
  for (const h of [report.ledgerHash, report.blindHash, report.adjudicationHash, report.planHash, ...report.parentLedgerHashes]) assert.match(h, /^[a-f0-9]{64}$/);
  // Digests sealed after collection and before provider mapping was restored.
  assert.equal(report.ledgerHash, '1abaeae9d26c31873ba23f4de31be01065db9c0937e69f30a763a3a008759eb4');
  assert.equal(report.blindHash, '1eb6d31c5095eed7c2be3429e419633b9e7fd1e4dc773b9ceb7800e9279a4517');
  assert.equal(report.adjudicationHash, '3b3f82b2bd8bbbec89c185ff10a70a0c606150fc91efa654f06f81a7d8db0721');
  const blind = report.rows.filter(r => r.label).sort((a, b) => a.label.localeCompare(b.label)).map(r => { const b = blindAttempt(r); b.label = r.label; delete b.number; return b; });
  assert.equal(hash(blind), report.blindHash);
  assert.equal(hash(report.adjudication), report.adjudicationHash);
  assert.equal(report.adjudication.blindHash, report.blindHash);
  assert.equal(report.adjudication.comparison, report.comparison);
  for (const k of ['reviewedAt', 'reviewer', 'rubric', 'checkedReferences', 'referenceAccess']) assert.deepEqual(report.adjudication[k], report.review[k]);
  const labeled = report.rows.filter(r => r.label).sort((a, b) => a.label.localeCompare(b.label));
  assert.deepEqual(report.adjudication.rows.map(r => r.label), labeled.map(r => r.label));
  for (const j of report.adjudication.rows) {
    assert.deepEqual(Object.keys(j).sort(), ['label', 'caseId', 'dimensions', 'overall', 'criticalErrors', 'reason'].sort());
    const r = labeled.find(r => r.label === j.label);
    for (const k of ['caseId', 'dimensions', 'overall', 'criticalErrors', 'reason']) assert.deepEqual(j[k], r[k]);
  }
});
test('annotated result judgments preserve original-language invariants and keep rejection unavailable', () => {
  const allowed = new Set(['caseId', 'provider', 'model', 'status', 'number', 'httpStatus', 'providerStatus', 'code', 'validationStage', 'diagnostic', 'validationDetail',
    'label', 'promptHash', 'requestHash', 'feedback', 'designatedCritical', 'dimensions', 'overall', 'criticalErrors', 'reason', 'quota', 'retryAfterSeconds']);
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
test('annotated publication gates use full denominators and treat unassessed critical cases as failure', () => {
  for (const p of ['google', 'groq']) {
    const a = report.rows.filter(r => r.provider === p), s = report.summaries[p], comparisons = report.comparisons.filter(c => c.provider === p);
    assert.equal(s.planned, 60); assert.equal(s.fullPublicationPlanned, 60); assert.equal(s.attempts, count(a, r => r.status !== 'not_attempted')); assert.equal(s.validResponses, count(a, r => r.status === 'response'));
    assert.equal(s.fullPublicationUnavailable, 60 - s.validResponses);
    for (const [key, value] of [['overallPass', 'pass'], ['languageFail', 'fail'], ['unavailable', 'unavailable']]) assert.equal(s[key], count(a, r => r.overall === value));
    assert.equal(s.outputRejected, count(a, r => ['provider_invalid_response', 'groq_invalid_response'].includes(r.code)));
    assert.equal(s.baselinePass, baseline.summaries[p].overallPass); assert.equal(s.newRegressions, count(comparisons, c => c.regressedDimensions.length));
    assert.equal(s.priorPassNowUnavailable, count(comparisons, c => c.baseline === 'pass' && c.candidate === 'unavailable'));
    for (const d of dims) for (const v of ['pass', 'fail', 'unavailable']) assert.equal(s.dimensions[d][v], count(a, r => r.dimensions[d] === v));
    const selectedCritical = a.filter(r => r.designatedCritical).length, fullCritical = cases.filter(c => Object.values(c.expected.critical).some(Boolean)).length;
    assert.equal(s.critical.planned, selectedCritical); assert.equal(s.critical.fullPublicationPlanned, fullCritical);
    assert.equal(s.critical.available, count(a, r => r.designatedCritical && r.status === 'response')); assert.equal(s.critical.unavailable, selectedCritical - s.critical.available);
    assert.equal(s.critical.fullPublicationUnavailable, fullCritical - s.critical.available);
    assert.equal(s.critical.failedCases, count(a, r => r.criticalErrors.length)); for (const k of Object.keys(s.critical.errors)) assert.equal(s.critical.errors[k], count(a, r => r.criticalErrors.includes(k)));
    assert.deepEqual(s.checks, { completeFixedCohort: s.attempts === 60, atLeast54: s.overallPass >= 54, noDesignatedCriticalErrors: s.critical.failedCases === 0, allDesignatedCriticalAssessable: s.critical.fullPublicationUnavailable === 0,
      noDecreaseFromBaseline: s.overallPass >= s.baselinePass, noNewRegressions: s.newRegressions === 0 }); assert.equal(s.gatePassed, Object.values(s.checks).every(Boolean));
  }
  assert.equal(report.checks.bothProviderGates, Object.values(report.summaries).every(s => s.gatePassed));
  assert.equal(report.checks.all17HistoricalFailuresResolved, report.historicalSummary.observed_resolved === 17);
  assert.equal(report.checks.all17CandidateCasesPass, report.historical.every(h => h.candidateOverall === 'pass'));
  assert.equal(report.checks.noObservedDimensionRegressions, report.comparisons.every(c => !c.regressedDimensions.length));
  assert.equal(report.publication.gatePassed, false); assert.equal(report.publication.fullCohortRequired, true);
  assert.ok(!report.publication.promptPublished); assert.equal(report.checks.bothProviderGates, false);
});
test('annotated historical failures and regression claims recompute against the frozen original cohort', () => {
  assert.equal(report.historical.length, 17);
  assert.deepEqual(report.historical.map(h => h.historicalLabel).sort(), baseline.rows.filter(r => r.overall === 'fail').map(r => r.label).sort());
  assert.equal(new Set(report.historical.map(h => h.historicalLabel)).size, 17);
  assert.equal(report.comparisons.length, 120);
  assert.equal(new Set(report.comparisons.map(r => r.provider + ':' + r.caseId)).size, 120);
  assert.deepEqual(report.comparisons.map(r => r.provider + ':' + r.caseId).sort(), report.rows.map(r => r.provider + ':' + r.caseId).sort());
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
    assert.equal(c.baselineLabel, old.label); assert.equal(c.candidateLabel, now.label);
    assert.deepEqual(c.regressedDimensions, c.assessable ? dims.filter(d => old.dimensions[d] === 'pass' && now.dimensions[d] === 'fail') : []);
  }
});

test('annotated collection separates output rejection, provider HTTP failure and terminal unattempted rows', () => {
  assert.equal(report.calls, 71); assert.equal(report.totalCalls, 806); assert.equal(report.unattempted, 49);
  assert.equal(count(report.rows, r => r.status === 'response'), 56);
  assert.equal(count(report.rows, r => r.overall === 'pass'), 45);
  assert.equal(count(report.rows, r => r.overall === 'fail'), 11);
  assert.equal(count(report.rows, r => r.status === 'failure'), 15);
  assert.deepEqual(report.providerStops, { groq: 'groq_request' });
  for (const p of ['google', 'groq']) {
    const a = report.rows.filter(r => r.provider === p), s = report.summaries[p];
    const rejected = a.filter(r => ['provider_invalid_response', 'groq_invalid_response'].includes(r.code));
    const http = a.filter(r => r.status === 'failure' && r.providerStatus >= 400);
    assert.equal(s.httpFailures, http.length);
    assert.equal(s.attempts, s.validResponses + s.outputRejected + s.httpFailures);
    assert.ok(rejected.every(r => r.httpStatus === 502 && r.providerStatus === 200 && r.overall === 'unavailable'));
    assert.ok(http.every(r => r.overall === 'unavailable' && !r.feedback && !r.validationDetail));
  }
  assert.equal(report.summaries.google.outputRejected, 9); assert.equal(report.summaries.groq.outputRejected, 4);
  const groqFailure = report.rows.find(r => r.code === 'groq_request');
  assert.equal(groqFailure.providerStatus, 400); assert.equal(groqFailure.httpStatus, 503);
  const googleFailure = report.rows.find(r => r.code === 'provider_unavailable');
  assert.equal(googleFailure.providerStatus, 503); assert.equal(googleFailure.httpStatus, 503);
  assert.ok(report.rows.filter(r => r.status === 'not_attempted').every(r => r.provider === 'groq'));
});
test('annotated evaluation expires and removes temporary credentials while preserving v3 and audience', () => {
  const c = report.temporaryEndpoint;
  assert.equal(c.keysRemoved, true); for (const p of [c.expiredProbe, c.finalProbe]) { assert.equal(p.status, 404); assert.equal(p.code, 'evaluation_disabled'); assert.equal(p.providerCalls, 0); }
  assert.equal(c.providerCallsForCleanup, 0); assert.equal(c.finalEnvironment.grammarV3, 'true'); assert.equal(c.finalEnvironment.evaluationKeys, 0);
  assert.equal(c.finalSite.access_mode, 'public'); assert.equal(c.finalSite.policy_revision, 4);
  assert.equal(c.originalEnvironmentUnchanged, true); assert.equal(c.fullAccessPolicyUnchanged, true); assert.equal(c.sourceVersionUnchanged, true);
  assert.equal(c.finalEnvironment.candidateEnabled, false); assert.equal(c.sourceCommit, report.sourceCommit);
  for(const d of [c.expiredDeployment,c.finalDeployment]) { assert.equal(d.status,'succeeded'); assert.equal(d.version_id,c.versionId); }
  assert.equal(report.unattempted,120-report.calls); assert.equal(report.authorization.humanAuthorization,'additional-120-free-annotated-calls');
  assert.equal(report.review.providerAndModelHiddenUntilAdjudication, true); assert.ok(report.review.checkedReferences.length);
  assert.match(report.review.referenceAccess, /checked-references/);
  assert.equal(report.validationPolicy, 'annotated-evidence-v1-exact-units-hangul-presence-flat-contradictions+original-judgment-v1'); assert.equal(report.publication.plannedCasesPerProvider, 60); assert.equal(report.publication.complete120Collection, report.calls === 120);
});

test('annotated report retains bounded safe quota and keeps the frozen prior reports unchanged', () => {
  for (const r of report.rows) {
    if (r.quota !== undefined) {
      const fields = ['remainingTokens', 'remainingRequests', 'resetTokensSeconds', 'resetRequestsSeconds'];
      assert.ok(Object.keys(r.quota).every(k => fields.includes(k)));
      for (const [k, v] of Object.entries(r.quota)) {
        assert.ok(Number.isInteger(v)); assert.ok(v >= (k.startsWith('reset') ? 1 : 0)); assert.ok(v <= (k.startsWith('reset') ? 604800 : 1000000000));
      }
    }
    if (r.retryAfterSeconds !== undefined) {
      assert.equal(r.status, 'failure'); assert.ok(Number.isInteger(r.retryAfterSeconds)); assert.ok(r.retryAfterSeconds >= 1 && r.retryAfterSeconds <= 604800);
    }
  }
  for (const r of plan.references) {
    const content = readFileSync(r.path, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(content).digest('hex'), r.hash);
  }
  const old = read('data/evaluations/english-accuracy-2026-10-02-counted.json');
  assert.equal(old.calls, 26); assert.equal(old.unattempted, 94); assert.equal(old.totalCalls, 701);
  assert.equal(report.glossHistory.length, 2);
  for (const h of report.glossHistory) {
    const a = report.rows.find(r => r.caseId === h.caseId && r.provider === h.provider);
    assert.equal(h.outcome, a.status !== 'response' ? 'unavailable' : a.dimensions.structure === 'pass' ? 'observed_resolved' : 'still_failed');
  }
});


test('annotated cohort retains full critical denominators and never counts skipped calls as attempts', () => {
  assert.equal(report.publication.gatePassed, report.calls === 120 && Object.values(report.checks).every(Boolean));
  for (const p of ['google', 'groq']) {
    const a = report.rows.filter(r => r.provider === p), c = report.temporaryEndpoint;
    assert.equal(a.length, 60); assert.equal(a.filter(r => r.status === 'not_attempted').length, 60-report.summaries[p].attempts);
    for (const proof of [c.expiredProbe, c.finalProbe]) {
      assert.equal(proof.actualCurrentTokenUsed, true); assert.ok(Number.isFinite(Date.parse(proof.checkedAt)));
    }
  }
  assert.ok(Date.parse(report.review.reviewedAt) >= Date.parse(report.temporaryEndpoint.finalProbe.checkedAt));
  assert.ok(report.rows.filter(r => r.status === 'not_attempted').every(r => !r.label && !r.number && !r.httpStatus && !r.feedback));
});
