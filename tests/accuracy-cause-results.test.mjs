import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';
import { blindAttempt } from '../scripts/evaluate-english-accuracy.mjs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const report = read('data/evaluations/english-accuracy-2026-10-01-root-cause.json');
const plan = read('data/evaluations/accuracy-cause-plan.json');
const fixture = read('tests/fixtures/english-accuracy.json').cases;
const old = read(plan.sourceArtifact);
const dims = ['meaning', 'grammar', 'correction', 'structure'];
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const count = (a, f) => a.filter(f).length;

test('paired pilot preserves frozen history, sixty-slot authorization and blinded result identity', () => {
  assert.equal(report.comparison, 'root-cause-v1'); assert.equal(report.sourceCommit, '00500c86cc1165da4c4e17b5bb0fbdce973a21ec');
  assert.equal(report.fixtureHash, old.fixtureHash); assert.equal(report.fixtureContentHash, plan.fixtureContentHash);
  assert.equal(report.planHash, hash(plan)); assert.deepEqual(report.parentLedgerHashes, plan.parentLedgerHashes); assert.equal(report.previousLedgerHash, plan.combinedParentHash);
  assert.equal(report.approvedCalls, 60); assert.equal(report.previousCalls, 480); assert.equal(report.calls, 60); assert.equal(report.totalCalls, 540); assert.equal(report.maximumTotalCalls, 540);
  assert.equal(report.retries, 0); assert.equal(report.fallback, false); assert.equal(report.freeTierConfirmation, 'human-user'); assert.equal(report.billingConsoleInspected, false);
  assert.equal(report.rows.length, 60); assert.equal(new Set(report.rows.map(r => `${r.caseId}:${r.provider}:${r.variant}`)).size, 60);
  for (const [i, row] of report.rows.entries()) {
    assert.equal(row.number, 481 + i); const entry = plan.cases.find(c => c.caseId === row.caseId); assert.ok(entry);
    assert.ok(['control', entry.family].includes(row.variant)); assert.equal(row.group, row.variant === 'control' ? 'control' : 'candidate'); assert.equal(row.family, entry.family);
    assert.equal(row.model, report.models[row.provider]); assert.equal(row.promptHash, report.profiles[`${row.caseId}:${row.variant}`].promptHash);
    assert.equal(row.requestHash, report.profiles[`${row.caseId}:${row.variant}`].requestHash);
  }
  const blinded = [...report.rows].sort((a, b) => a.label.localeCompare(b.label)).map(r => { const x = blindAttempt(r); x.label = r.label; delete x.number; return x; });
  assert.equal(hash(blinded), report.blindHash);
  for (const h of [report.ledgerHash, report.blindHash, report.adjudicationHash]) assert.match(h, /^[a-f0-9]{64}$/);
});

test('available feedback alone receives judgments and safe failures do not count as English passes', () => {
  const safe = new Set(['caseId', 'family', 'variant', 'provider', 'group', 'model', 'status', 'number', 'httpStatus', 'providerStatus', 'code', 'validationStage', 'diagnostic', 'validationDetail', 'promptHash', 'requestHash', 'label', 'feedback', 'dimensions', 'overall', 'criticalErrors', 'reason']);
  for (const r of report.rows) {
    assert.ok(Object.keys(r).every(k => safe.has(k))); const c = fixture.find(c => c.id === r.caseId); assert.ok(c && r.reason.trim());
    assert.ok(r.criticalErrors.every(k => c.expected.critical[k]));
    if (r.status === 'response') {
      assert.equal(r.httpStatus, 200); assert.ok(sentenceFeedbackSchema.safeParse(r.feedback).success);
      assert.equal(r.feedback.original, c.sentence); assert.equal(r.feedback.model, r.model);
      assert.ok(dims.every(d => ['pass', 'fail'].includes(r.dimensions[d])));
      assert.equal(r.overall, dims.some(d => r.dimensions[d] === 'fail') ? 'fail' : 'pass');
      for (const [f, d] of [['meaningUsage', 'meaning'], ['grammar', 'grammar']]) if (!c.expected[f].includes(r.feedback[f])) assert.equal(r.dimensions[d], 'fail');
      if (r.criticalErrors.length) assert.equal(r.overall, 'fail');
    } else {
      assert.equal(r.status, 'failure'); assert.equal(r.feedback, undefined); assert.equal(r.overall, 'unavailable');
      assert.ok(dims.every(d => r.dimensions[d] === 'unavailable')); assert.deepEqual(r.criticalErrors, []);
      if (r.validationDetail?.kind === 'schema') assert.deepEqual(r.validationDetail, { kind: 'schema', issues: [{ field: 'explanation', reason: 'too_small' }], truncated: false });
      if (r.validationDetail?.kind === 'tokens') { const t = r.validationDetail; assert.equal(t.reason, 'part_exceeds_tokens'); assert.ok(t.consumedTokens + t.requestedTokens > t.tokenCount); }
    }
  }
  assert.equal(count(report.rows, r => r.status === 'response'), 48); assert.equal(count(report.rows, r => r.overall === 'fail'), 19);
  assert.equal(count(report.rows, r => r.validationDetail?.kind === 'tokens'), 6); assert.equal(count(report.rows, r => r.validationDetail?.kind === 'schema'), 5);
  assert.equal(count(report.rows, r => r.code === 'provider_unavailable'), 1);
});

test('all four condition totals, thirty paired comparisons and seventeen historical outcomes recompute from rows', () => {
  for (const provider of ['google', 'groq']) for (const group of ['control', 'candidate']) {
    const a = report.rows.filter(r => r.provider === provider && r.group === group), s = report.summaries[provider][group];
    assert.equal(a.length, 15); assert.equal(s.planned, 15); assert.equal(s.attempts, 15);
    for (const [key, predicate] of Object.entries({ valid: r => r.status === 'response', pass: r => r.overall === 'pass', languageFail: r => r.overall === 'fail', unavailable: r => r.overall === 'unavailable', designatedErrors: r => r.criticalErrors.length })) assert.equal(s[key], count(a, predicate));
    for (const d of dims) for (const v of ['pass', 'fail', 'unavailable']) assert.equal(s.dimensions[d][v], count(a, r => r.dimensions[d] === v));
  }
  assert.equal(report.pairs.length, 30);
  for (const p of report.pairs) {
    const [a, b] = ['control', 'candidate'].map(group => report.rows.find(r => r.caseId === p.caseId && r.provider === p.provider && r.group === group));
    assert.equal(p.controlLabel, a.label); assert.equal(p.candidateLabel, b.label); assert.equal(p.control, a.overall); assert.equal(p.candidate, b.overall);
    assert.equal(p.assessable, a.status === 'response' && b.status === 'response');
    assert.deepEqual(p.regressedDimensions, p.assessable ? dims.filter(d => a.dimensions[d] === 'pass' && b.dimensions[d] === 'fail') : []);
    assert.deepEqual(p.improvedDimensions, p.assessable ? dims.filter(d => a.dimensions[d] === 'fail' && b.dimensions[d] === 'pass') : []);
  }
  assert.deepEqual(report.pairedSummary, { total: 30, assessable: 21, failToPass: 9, passToFail: 1, regressedPairs: 1, unassessable: 9 });
  assert.equal(report.historical.length, 17);
  for (const h of report.historical) {
    const prior = old.rows.find(r => r.label === h.historicalLabel), candidate = report.rows.find(r => r.caseId === h.caseId && r.provider === h.provider && r.group === 'candidate');
    assert.equal(prior.caseId, h.caseId); assert.equal(prior.provider, h.provider); assert.equal(prior.overall, 'fail'); assert.equal(candidate.label, h.candidateLabel);
    assert.deepEqual(h.failedDimensions, dims.filter(d => prior.dimensions[d] === 'fail'));
    assert.deepEqual(h.unresolvedDimensions, candidate.status === 'response' ? h.failedDimensions.filter(d => candidate.dimensions[d] !== 'pass') : h.failedDimensions);
    assert.equal(h.outcome, candidate.status !== 'response' ? 'unavailable' : h.unresolvedDimensions.length ? 'still_failed' : 'observed_resolved');
  }
  for (const v of ['observed_resolved', 'still_failed', 'unavailable']) assert.equal(report.historicalSummary[v], count(report.historical, h => h.outcome === v));
  assert.deepEqual(report.historicalSummary, { observed_resolved: 13, still_failed: 3, unavailable: 1 });
});

test('partial improvement never opens publication and cleanup preserves v3 and the original seven keys', () => {
  assert.deepEqual(report.checks, { all17HistoricalFailuresObservedResolved: false, all30PairsAssessable: false, noObservedDimensionRegressions: false });
  assert.equal(report.targetedPilotPassed, Object.values(report.checks).every(Boolean)); assert.equal(report.publication.full60CaseGateTested, false); assert.equal(report.publication.promptPublished, false);
  const c = report.temporaryEndpoint; assert.equal(c.keysRemoved, true); assert.equal(c.expiredProbe.status, 404); assert.equal(c.finalProbe.status, 404);
  assert.equal(c.finalProbe.code, 'evaluation_disabled'); assert.equal(c.providerCallsForCleanup, 0); assert.equal(c.finalEnvironment, 28); assert.equal(c.version, 92);
  assert.equal(c.v3Enabled, true); assert.equal(c.candidateEnabled, false); assert.equal(c.originalKeys.length, 7); assert.equal(c.audience, 'public');
  assert.equal(c.sourceCommit, report.sourceCommit); assert.equal(c.finalDeploymentSucceeded, true); assert.equal(c.billingOrKeyOrRegionChanges, false);
});
