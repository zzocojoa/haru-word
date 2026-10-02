import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { blindAttempt } from '../scripts/evaluate-english-accuracy.mjs';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { parseFeedbackValidationDetail } from '../lib/feedback-validation-detail.ts';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const report = read('data/evaluations/english-accuracy-2026-10-02-token.json'), plan = read('data/evaluations/token-evidence-plan.json');
const cases = read('tests/fixtures/english-accuracy.json').cases, baseline = read('data/evaluations/english-accuracy-2026-10-01-chunked-free.json');
const dims = ['meaning', 'grammar', 'correction', 'structure'], count = (a, fn) => a.filter(fn).length;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('token targeted cohort preserves frozen701 calls and accounts for separately approved34', () => {
  assert.equal(report.comparison, 'token-evidence-v1'); assert.equal(report.sourceCommit, '70f0bb0a294274d9799b1be48db4de419368249b');
  assert.equal(report.previousCalls, 701); assert.equal(report.approvedCalls, 34); assert.equal(report.maximumTotalCalls, 735);
  assert.equal(report.totalCalls, 701 + report.calls); assert.ok(report.calls <= 34); assert.equal(report.retries, 0); assert.equal(report.fallback, false);
  assert.equal(report.freeTierConfirmation, 'human-user'); assert.equal(report.billingConsoleInspected, false);
  assert.equal(report.fixtureHash, baseline.fixtureHash); assert.equal(report.fixtureContentHash, plan.fixtureContentHash);
  assert.equal(report.previousLedgerHash, plan.combinedParentHash); assert.deepEqual(report.parentLedgerHashes, plan.parentLedgerHashes); assert.deepEqual(report.referenceHashes, plan.references);
  assert.equal(report.rows.length, 34); assert.equal(new Set(report.rows.map(r => r.provider + ':' + r.caseId)).size, 34);
  assert.equal(count(report.rows, r => r.status !== 'not_attempted'), report.calls);
  for (const p of ['google', 'groq']) assert.deepEqual(report.rows.filter(r => r.provider === p).map(r => r.caseId).sort(), [...plan.caseIds].sort());
  for (const h of [report.ledgerHash, report.blindHash, report.adjudicationHash, report.planHash, ...report.parentLedgerHashes]) assert.match(h, /^[a-f0-9]{64}$/);
  const blind = report.rows.filter(r => r.label).sort((a, b) => a.label.localeCompare(b.label)).map(r => { const b = blindAttempt(r); b.label = r.label; delete b.number; return b; });
  assert.equal(hash(blind), report.blindHash);
});
test('token result judgments preserve original-language invariants and keep rejection unavailable', () => {
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
test('token publication gates use full denominators and treat unassessed critical cases as failure', () => {
  for (const p of ['google', 'groq']) {
    const a = report.rows.filter(r => r.provider === p), s = report.summaries[p], comparisons = report.comparisons.filter(c => c.provider === p);
    assert.equal(s.planned, 17); assert.equal(s.fullPublicationPlanned, 60); assert.equal(s.attempts, count(a, r => r.status !== 'not_attempted')); assert.equal(s.validResponses, count(a, r => r.status === 'response'));
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
    assert.deepEqual(s.checks, { atLeast54: s.overallPass >= 54, noDesignatedCriticalErrors: s.critical.failedCases === 0, allDesignatedCriticalAssessable: s.critical.fullPublicationUnavailable === 0,
      noDecreaseFromBaseline: s.overallPass >= s.baselinePass, noNewRegressions: s.newRegressions === 0 }); assert.equal(s.gatePassed, Object.values(s.checks).every(Boolean));
  }
  assert.equal(report.checks.bothProviderGates, Object.values(report.summaries).every(s => s.gatePassed));
  assert.equal(report.checks.all17HistoricalFailuresResolved, report.historicalSummary.observed_resolved === 17);
  assert.equal(report.checks.all17CandidateCasesPass, report.historical.every(h => h.candidateOverall === 'pass'));
  assert.equal(report.checks.noObservedDimensionRegressions, report.comparisons.every(c => !c.regressedDimensions.length));
  assert.equal(report.publication.gatePassed, false); assert.equal(report.publication.pilotCannotPassPublication, true); assert.equal(report.publication.targetedCasesPerProvider, 17);
  assert.ok(!report.publication.promptPublished); assert.equal(report.checks.bothProviderGates, false);
});
test('token historical failures and regression claims recompute against the frozen original cohort', () => {
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
test('token evaluation expires and removes temporary credentials while preserving v3 and audience', () => {
  const c = report.temporaryEndpoint;
  assert.equal(c.keysRemoved, true); for (const p of [c.expiredProbe, c.finalProbe]) { assert.equal(p.status, 404); assert.equal(p.code, 'evaluation_disabled'); assert.equal(p.providerCalls, 0); }
  assert.equal(c.providerCallsForCleanup, 0); assert.equal(c.finalEnvironment.grammarV3, 'true'); assert.equal(c.finalEnvironment.evaluationKeys, 0);
  assert.equal(c.finalSite.access_mode, 'public'); assert.equal(c.finalSite.policy_revision, 4);
  assert.equal(c.originalEnvironmentUnchanged, true); assert.equal(c.fullAccessPolicyUnchanged, true); assert.equal(c.sourceVersionUnchanged, true);
  assert.equal(c.finalEnvironment.candidateEnabled, false); assert.equal(c.sourceCommit, report.sourceCommit);
  for(const d of [c.expiredDeployment,c.finalDeployment]) { assert.equal(d.status,'succeeded'); assert.equal(d.version_id,c.versionId); }
  assert.equal(report.unattempted,34-report.calls); assert.equal(report.authorization.humanAuthorization,'additional-34-free-token-calls');
  assert.equal(report.review.providerAndModelHiddenUntilAdjudication, true); assert.ok(report.review.checkedReferences.length);
  assert.match(report.review.referenceAccess, /403.*official indexed result text/);
  assert.equal(report.validationPolicy, 'token-evidence-v1-exact-units-hangul-presence+original-judgment-v1'); assert.equal(report.publication.plannedCasesPerProvider, 60); assert.equal(report.publication.complete34Collection, report.calls === 34);
});

test('token report retains bounded safe quota and documents zero-provider setup recovery', () => {
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
  assert.equal(report.setupFailure.providerCalls, 0); assert.equal(report.setupFailure.ledgerAttempts, 0);
  assert.equal(report.setupFailure.authorizationPreserved, true); assert.equal(report.setupFailure.ledgerPreserved, true);
  assert.equal(report.setupFailure.sourceCommit, report.sourceCommit); assert.equal(report.setupFailure.noProviderRetries, true);
  assert.equal(report.setupFailure.secretValuesStored, false);
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

test('token completed34 cohort separates output rejection, language defects and partial historical observations', () => {
  assert.equal(report.calls, 34); assert.equal(report.totalCalls, 735); assert.equal(report.unattempted, 0);
  assert.deepEqual(report.providerStops, {}); assert.equal(report.endpointStop, undefined);
  assert.equal(report.publication.complete34Collection, true); assert.equal(report.publication.gatePassed, false);
  assert.deepEqual(report.historicalSummary, {observed_resolved:4, still_failed:3, unavailable:10});
  assert.equal(count(report.rows, r => r.status === 'response'), 17);
  assert.equal(count(report.rows, r => r.overall === 'pass'), 10);
  assert.equal(count(report.rows, r => r.overall === 'fail'), 7);
  // One old structure failure is fixed in this observation while a new grammar defect remains.
  assert.ok(report.historical.some(h => h.caseId === 'word-26' && h.provider === 'groq'
    && h.outcome === 'observed_resolved' && h.candidateOverall === 'fail'));
  const failures = report.rows.filter(r => r.status === 'failure');
  assert.equal(failures.length, 17); assert.ok(failures.every(r => r.providerStatus === 200 && r.httpStatus === 502));
  assert.equal(failures.filter(r => r.validationDetail?.reason === 'span_order').length, 5);
  assert.equal(failures.filter(r => r.validationDetail?.reason === 'governor_mismatch').length, 1);
  const issues = failures.flatMap(r => r.validationDetail?.issues ?? []);
  assert.equal(issues.filter(i => i.field === 'analysis.target.observedUse' && i.reason === 'schema').length, 10);
  assert.equal(issues.filter(i => i.field === 'analysis.structure.parts[].meaning' && i.reason === 'schema').length, 1);
  assert.equal(report.summaries.google.newRegressions, 2); assert.equal(report.summaries.groq.newRegressions, 3);
  assert.equal(report.summaries.google.critical.unavailable, 5); assert.equal(report.summaries.groq.critical.unavailable, 9);
  for (const p of [report.temporaryEndpoint.expiredProbe, report.temporaryEndpoint.finalProbe]) assert.equal(p.actualCurrentTokenUsed, true);
});
