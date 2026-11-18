import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PLAN, MODELS, digest} from './ai-quality-v147-budget.mjs';
import {DIMENSIONS, CRITICAL} from './ai-quality-v147-calibration.mjs';
import {reportEvaluation, reportRecordKey, exactCriticalUpper} from './ai-quality-v147-report.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(HERE, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8')), SOURCE = resolve(manifest.baseline.sourceRoot);
const template = JSON.parse(readFileSync(resolve(SOURCE, '.taskmaster/docs/ai-quality-v147-evaluation-design.json'), 'utf8'));
const reference = JSON.parse(readFileSync(resolve(SOURCE, '.taskmaster/evaluation/ai-quality-v147/risk-reference.json'), 'utf8'));
const root = resolve(process.env.QA_OUTPUT_DIR ?? resolve(SOURCE, 'work', `report-test-${randomUUID()}`)); mkdirSync(root, {recursive: true});
const h = digest('synthetic arithmetic fixture; not a protocol,review or risk approval'), examples = [];
const good = () => ({...Object.fromEntries(DIMENSIONS.map(k => [k, 'pass'])), criticalErrors: Object.fromEntries(CRITICAL.map(k => [k, false]))});
const unavailable = () => ({...Object.fromEntries(DIMENSIONS.map(k => [k, 'unavailable'])), criticalErrors: Object.fromEntries(CRITICAL.map(k => [k, false]))});
const bad = (dimension = 'explanation', critical) => { const g = good(); g[dimension] = 'fail'; if (critical) g.criticalErrors[critical] = true; return g; };
function design(kind = 'pilot', options = {}) {
  const cases = options.cases ?? template.slots.map(s => ({id: s.id, domain: s.domain, stratum: s.grammarStratum, familyId: 'F-' + s.id}));
  const phases = kind === 'production' ? ['production'] : ['baseline', 'candidate'];
  return {schemaVersion: 1, planId: PLAN, runId: randomUUID(), protocolHash: h, evaluationKind: kind, dataClass: 'synthetic', modelIds: [...MODELS], phases,
    phaseSeals: Object.fromEntries(phases.map(p => [p, digest('synthetic source/' + p)])), repetitions: options.repetitions ?? 1, cases,
    risk: {confidenceLevel: .95, samplingModel: options.iid ? 'iid-family-union' : 'unverified', assumptionEvidenceHash: options.iid ? h : null,
      criterionStatus: 'unapproved', approvalEvidenceHash: null, maximumCriticalRisk: .05}};
}
function records(d) {
  const rows = [];
  for (const phase of d.phases) for (const modelId of d.modelIds) for (const c of d.cases) for (let repetition = 1; repetition <= d.repetitions; repetition++)
    rows.push({designHash: digest(d), phase, modelId, caseId: c.id, repetition, sourceHash: d.phaseSeals[phase], generationState: 'completed', appState: 'accepted',
      visibleAction: c.stratum === 'insufficientContext' ? 'abstention' : 'answer', judgeState: 'completed', judgeModelId: MODELS[(MODELS.indexOf(modelId) + 1) % 3],
      rawGrade: good(), evidenceHash: digest({phase, modelId, c: c.id, repetition}), diagnosticHash: null});
  return rows;
}
function reviewAll(rows) {
  const reviews = [], adjudications = [];
  for (const r of rows.filter(r => r.appState === 'accepted')) {
    const review = {key: reportRecordKey(r), rawRecordHash: digest(r), evidenceHash: r.evidenceHash, reviewerId: 'same-author-fixture', grade: structuredClone(r.rawGrade ?? unavailable()), reasonCodes: ['confirmed']};
    reviews.push(review); adjudications.push({key: review.key, rawRecordHash: digest(r), reviewHash: digest(review), adjudicatorId: 'same-author-fixture', decision: 'confirm_raw'});
  }
  return {reviews, adjudications};
}
const target = (rows, phase = 'candidate', model = MODELS[0]) => rows.find(r => r.phase === phase && r.modelId === model);
function summarize(d, rows, review = {}) {
  const before = digest({d, rows, review}), result = reportEvaluation({design: d, records: rows, ...review});
  assert.equal(digest({d, rows, review}), before); assert.equal(result.releaseVerdict, 'held'); assert.equal(result.actualModelQualityVerified, false); return result;
}

test('one-sided exact upper bounds match245 independent installed SciPy references including low confidence and edges', () => {
  assert.equal(reference.installedScipyVersion, '1.16.3'); assert.equal(reference.references.length, 245);
  let largestError = 0;
  for (const r of reference.references) { const value = exactCriticalUpper(r.k, r.n, r.confidence), error = Math.abs(value - r.upper); largestError = Math.max(largestError, error); assert.ok(error < 5e-10, `n=${r.n},k=${r.k},confidence=${r.confidence},error=${error}`); }
  assert.ok(exactCriticalUpper(5, 10, .1) < .5);
  for (const args of [[0, 0, .95], [-1, 10, .95], [11, 10, .95], [1.1, 10, .95], [1, 10, 0], [1, 10, 1], [1, 10, NaN]]) assert.throws(() => exactCriticalUpper(...args), /REPORT_BINOMIAL_INPUT/);
  writeFileSync(resolve(root, 'independent-statistics-comparison.json'), JSON.stringify({referencePoints: reference.references.length, scipyVersion: reference.installedScipyVersion, largestAbsoluteError: largestError, actualProviderCalls: 0}, null, 2) + '\n');
});
test('empty collection keeps60 per model and all strata; unmeasured is not zero critical risk or an English fail', () => {
  const d = design(), report = summarize(d, []), c = report.byPhase.candidate[MODELS[0]];
  assert.equal(c.raw.denominator, 60); assert.equal(c.raw.correct, 0); assert.equal(c.collection.missingRecords, 60); assert.equal(c.raw.unmeasured, 60);
  assert.equal(c.raw.dimensions.grammar.fail, 0); assert.equal(c.raw.dimensions.grammar.notGraded, 60); assert.equal(c.raw.risk.upper, null);
  assert.equal(c.raw.risk.unavailableReason, 'unmeasured-family'); assert.equal(report.pilotScreening.raw.allModelsSatisfied, false);
  assert.deepEqual(['normal', 'needsCorrection', 'insufficientContext'].map(s => c.byStratum[s].raw.denominator), [20, 25, 15]);
});
test('complete synthetic pilot separates raw/review/adjudicated and reports exact word/grammar/family coverage without release', () => {
  const d = design(), rows = records(d), reviews = reviewAll(rows), report = summarize(d, rows, reviews);
  for (const model of MODELS) {
    const c = report.byPhase.candidate[model]; assert.equal(c.raw.correct, 60); assert.equal(c.adjudicated.correct, 60); assert.equal(c.review.correct, 60);
    assert.equal(c.byDomain.word.raw.denominator, 30); assert.equal(c.byDomain.grammar.raw.denominator, 30); assert.equal(Object.keys(c.byFamily).length, 60);
    assert.equal(c.reviewCoverage.pending, 0); assert.equal(c.collection.complete, true); assert.equal(c.raw.risk.unavailableReason, 'sampling-model-unverified');
  }
  assert.equal(report.pilotScreening.raw.allModelsSatisfied, true); assert.equal(report.pilotScreening.adjudicated.allModelsSatisfied, true);
  assert.equal(report.pilotScreening.raw.releaseEligible, false); assert.equal(report.independentReviewerCredentialsVerified, false);
  writeFileSync(resolve(root, 'complete-synthetic-pilot-report.json'), JSON.stringify(report, null, 2) + '\n');
});
test('conditional candidate risk uses60 family unions across three models, not180 model-case calls', () => {
  const d = design('pilot', {iid: true}), rows = records(d), report = summarize(d, rows);
  const risk = report.familyUnionRiskByPhase.candidate.raw;
  assert.equal(risk.plannedUnits, 60); assert.equal(risk.fullyAssessedUnits, 60); assert.equal(risk.observedCriticalUnits, 0);
  assert.ok(Math.abs(risk.upper - reference.references.find(r => r.n === 60 && r.k === 0 && r.confidence === .95).upper) < 5e-10);
  assert.ok(risk.upper > exactCriticalUpper(0, 180, .95)); assert.equal(risk.criterionStatus, 'unapproved'); assert.equal(risk.approvalOrSamplingVerifiedHere, false);
  assert.equal(risk.numericLimitSatisfied, true); examples.push({kind: 'conditional-risk-not-approval', risk, releaseVerdict: report.releaseVerdict});
});
test('missing one candidate cell remains59/60 with an unavailable comparison,not59/59 or a measured improvement', () => {
  const d = design('pilot', {iid: true}), rows = records(d), removed = target(rows); rows.splice(rows.indexOf(removed), 1);
  const report = summarize(d, rows), c = report.byPhase.candidate[MODELS[0]], pair = report.comparisons[MODELS[0]].raw;
  assert.equal(c.raw.denominator, 60); assert.equal(c.raw.correct, 59); assert.equal(c.raw.rate, 59 / 60); assert.equal(c.raw.unmeasured, 1); assert.equal(c.collection.complete, false);
  assert.equal(pair.regressions, 0); assert.equal(pair.unmeasured, 1); assert.equal(pair.availabilityLosses, 0); assert.equal(pair.availabilityUnmeasured, 1); assert.equal(pair.improvements, 0);
  assert.equal(report.pilotScreening.raw.byModel[MODELS[0]].numericThresholdsMet, true); assert.equal(report.pilotScreening.raw.byModel[MODELS[0]].preScreenSatisfied, false);
  assert.equal(report.familyUnionRiskByPhase.candidate.raw.upper, null);
});
test('app rejection,generation failure,unknown dispatch and judge failure remain different unavailable cells', () => {
  const d = design(), rows = records(d), selected = rows.filter(r => r.phase === 'candidate' && r.modelId === MODELS[0]).slice(0, 4);
  for (const r of selected) { r.rawGrade = null; r.judgeState = 'not-run'; r.judgeModelId = null; r.diagnosticHash = h; }
  Object.assign(selected[0], {appState: 'rejected', visibleAction: null});
  Object.assign(selected[1], {generationState: 'failed', appState: 'not-run', visibleAction: null});
  Object.assign(selected[2], {generationState: 'unknown', appState: 'not-run', visibleAction: null});
  Object.assign(selected[3], {judgeState: 'failed', judgeModelId: MODELS[1]});
  const report = summarize(d, rows), c = report.byPhase.candidate[MODELS[0]];
  assert.equal(c.raw.denominator, 60); assert.equal(c.raw.correct, 56); assert.equal(c.raw.unmeasured, 4); assert.equal(c.raw.appRejections, 1);
  assert.equal(c.collection.generationFailed, 1); assert.equal(c.collection.generationUnknown, 1); assert.equal(c.collection.judgeFailed, 1);
  assert.equal(c.byStratum.normal.collection.generationUnknown, 1); assert.equal(c.byDomain.word.collection.appRejected, 1); assert.equal(report.comparisons[MODELS[0]].raw.availabilityLosses, 2); assert.equal(report.comparisons[MODELS[0]].raw.availabilityUnmeasured, 1);
  assert.equal(c.raw.dimensions.grammar.fail, 0); assert.equal(c.raw.dimensions.grammar.notGraded, 4); assert.equal(c.raw.appRejectionsOnAnswerExpected, 1);
  assert.equal(report.pilotScreening.raw.allModelsSatisfied, false);
});
test('known visible over-abstention and appropriate abstention stay separate from app rejection', () => {
  const d = design(), rows = records(d), r = target(rows); r.visibleAction = 'abstention'; r.rawGrade.abstention = 'fail';
  const c = summarize(d, rows).byPhase.candidate[MODELS[0]];
  assert.equal(c.raw.visibleOverAbstention, 1); assert.equal(c.raw.appropriateVisibleAbstention, 15); assert.equal(c.raw.appRejections, 0); assert.equal(c.raw.correct, 59);
  assert.equal(c.raw.dimensions.grammar.pass, 60);
});
test('one weak model or weak stratum cannot be hidden by the other models or a57 overall count', () => {
  for (const [stratum, badCount, total] of [['normal', 3, 20], ['normal', 4, 20], ['needsCorrection', 3, 25], ['insufficientContext', 2, 15]]) {
    const d = design(), rows = records(d), ids = d.cases.filter(c => c.stratum === stratum).slice(0, badCount).map(c => c.id);
    for (const r of rows.filter(r => r.modelId === MODELS[0] && ids.includes(r.caseId))) r.rawGrade = bad();
    const report = summarize(d, rows), c = report.byPhase.candidate[MODELS[0]], gate = report.pilotScreening.raw.byModel[MODELS[0]];
    assert.equal(c.raw.correct, 60 - badCount); assert.equal(c.byStratum[stratum].raw.correct, total - badCount); assert.equal(gate.numericThresholdsMet, false);
    assert.equal(report.comparisons[MODELS[0]].raw.regressions, 0); assert.equal(report.pilotScreening.raw.allModelsSatisfied, false);
    assert.equal(report.byPhase.candidate[MODELS[1]].raw.correct, 60); assert.equal(report.byPhase.candidate[MODELS[2]].raw.correct, 60);
  }
});
test('exact57/60 and18/20,25/25,14/15 may satisfy only the prerelease pilot screen with zero measured paired regression', () => {
  const d = design(), rows = records(d), ids = [...d.cases.filter(c => c.stratum === 'normal').slice(0, 2), d.cases.find(c => c.stratum === 'insufficientContext')].map(c => c.id);
  for (const r of rows.filter(r => ids.includes(r.caseId))) r.rawGrade = bad();
  const report = summarize(d, rows, reviewAll(rows));
  assert.equal(report.pilotScreening.raw.allModelsSatisfied, true); assert.equal(report.pilotScreening.adjudicated.allModelsSatisfied, true);
  for (const model of MODELS) { const c = report.byPhase.candidate[model]; assert.equal(c.raw.correct, 57); assert.deepEqual(['normal', 'needsCorrection', 'insufficientContext'].map(s => c.byStratum[s].raw.correct), [18, 25, 14]); }
  assert.equal(report.releaseVerdict, 'held'); assert.equal(report.pilotScreening.raw.releaseEligible, false);
});
test('one critical case is visible despite a59/60 score and its union risk never uses a pooled180 denominator', () => {
  const d = design('pilot', {iid: true}), rows = records(d), r = target(rows); r.rawGrade = bad('meaning', 'reverseMeaning');
  const report = summarize(d, rows), c = report.byPhase.candidate[MODELS[0]], risk = report.familyUnionRiskByPhase.candidate.raw;
  assert.equal(c.raw.correct, 59); assert.equal(c.raw.criticalByType.reverseMeaning, 1); assert.equal(report.pilotScreening.raw.byModel[MODELS[0]].criticalZero, false);
  assert.equal(risk.plannedUnits, 60); assert.equal(risk.observedCriticalUnits, 1); assert.equal(risk.numericLimitSatisfied, false);
});
test('review and explicit adjudication can disagree while raw scores and original hashes remain unchanged', () => {
  const d = design(), rows = records(d), r = target(rows); r.rawGrade = bad(); const inputHash = digest(rows), bundle = reviewAll(rows);
  const review = bundle.reviews.find(v => v.key === reportRecordKey(r)); review.grade = good();
  const decision = bundle.adjudications.find(v => v.key === review.key); decision.decision = 'confirm_review'; decision.reviewHash = digest(review);
  const report = summarize(d, rows, bundle), c = report.byPhase.candidate[MODELS[0]];
  assert.equal(c.raw.correct, 59); assert.equal(c.review.correct, 60); assert.equal(c.adjudicated.correct, 60); assert.equal(c.reviewCoverage.conflicting, 1);
  assert.equal(report.rawRecordHash, inputHash); assert.equal(digest(rows), inputHash); assert.equal(report.comparisons[MODELS[0]].raw.regressions, 1); assert.equal(report.comparisons[MODELS[0]].adjudicated.regressions, 0);
});
test('unresolved review keeps adjusted unmeasured rather than silently falling back to the raw pass', () => {
  const d = design('pilot', {iid: true}), rows = records(d), bundle = reviewAll(rows), r = target(rows);
  bundle.adjudications.find(v => v.key === reportRecordKey(r)).decision = 'unresolved';
  const report = summarize(d, rows, bundle), c = report.byPhase.candidate[MODELS[0]];
  assert.equal(c.raw.correct, 60); assert.equal(c.adjudicated.correct, 59); assert.equal(c.adjudicated.unmeasured, 1); assert.equal(c.reviewCoverage.pending, 1);
  assert.equal(c.adjudicated.risk.upper, null); assert.equal(report.pilotScreening.adjudicated.allModelsSatisfied, false);
});
test('manual review cannot promote a missing provider grade into a successful primary automated evaluation', () => {
  const d = design(), rows = records(d), r = target(rows); r.judgeState = 'failed'; r.rawGrade = null;
  const bundle = reviewAll(rows), review = bundle.reviews.find(v => v.key === reportRecordKey(r)), decision = bundle.adjudications.find(v => v.key === review.key);
  review.grade = good(); decision.reviewHash = digest(review); decision.decision = 'confirm_review';
  assert.throws(() => summarize(d, rows, bundle), /REPORT_MISSING_RAW_NOT_PROMOTABLE/);
});
test('stale/duplicate reviews or decisions and changed original grades are rejected without rewriting inputs', () => {
  for (const kind of ['duplicate-review', 'duplicate-decision', 'changed-raw', 'changed-review', 'wrong-evidence']) {
    const d = design(), rows = records(d), bundle = reviewAll(rows);
    if (kind === 'duplicate-review') bundle.reviews.push(bundle.reviews[0]);
    if (kind === 'duplicate-decision') bundle.adjudications.push(bundle.adjudications[0]);
    if (kind === 'changed-raw') rows[0].rawGrade.explanation = 'fail';
    if (kind === 'changed-review') bundle.reviews[0].grade.explanation = 'fail';
    if (kind === 'wrong-evidence') bundle.reviews[0].evidenceHash = h;
    const before = digest({d, rows, bundle}); assert.throws(() => summarize(d, rows, bundle)); assert.equal(digest({d, rows, bundle}), before);
  }
});
test('correlated confirmation repeats stay case/family units with explicit flips and separate per-repeat results', () => {
  const cases = [{id: 'C1', domain: 'word', stratum: 'normal', familyId: 'F1'}, {id: 'C2', domain: 'grammar', stratum: 'needsCorrection', familyId: 'F1'},
    {id: 'C3', domain: 'word', stratum: 'insufficientContext', familyId: 'F2'}, {id: 'C4', domain: 'grammar', stratum: 'normal', familyId: 'F2'}];
  const d = design('confirmation', {cases, repetitions: 3, iid: true}), rows = records(d), r = rows.find(r => r.phase === 'candidate' && r.modelId === MODELS[0] && r.caseId === 'C1' && r.repetition === 2); r.rawGrade = bad('meaning', 'swapRoles');
  rows.find(r => r.phase === 'candidate' && r.modelId === MODELS[1] && r.caseId === 'C2' && r.repetition === 1).rawGrade = bad('meaning', 'reverseMeaning');
  const report = summarize(d, rows), c = report.byPhase.candidate[MODELS[0]], risk = report.familyUnionRiskByPhase.candidate.raw;
  assert.equal(c.raw.denominator, 12); assert.equal(c.byRepetition['2'].raw.denominator, 4); assert.equal(c.byRepetition['2'].raw.correct, 3);
  assert.deepEqual(c.repeatRobustness.raw, {caseDenominator: 4, repetitions: 3, robustCases: 3, flipCases: 1, unmeasuredCases: 0});
  assert.equal(risk.plannedUnits, 2); assert.equal(risk.observedCriticalUnits, 1); assert.ok(Math.abs(risk.upper - exactCriticalUpper(1, 2, .95)) < 1e-12);
  assert.equal(report.pilotScreening, null); examples.push({kind: 'correlated-repeats', risk, repeatRobustness: c.repeatRobustness.raw});
});
test('pilot,confirmation and six-cell production results never share denominators or imply production verification', () => {
  const p = design(), pilotRows = records(p), c = design('confirmation'), confirmRows = records(c);
  assert.throws(() => summarize(p, [...pilotRows, ...confirmRows]), /REPORT_RECORD_BINDING/);
  const d = design('production', {cases: [{id: 'S1', domain: 'word', stratum: 'normal', familyId: 'S1'}, {id: 'S2', domain: 'grammar', stratum: 'needsCorrection', familyId: 'S2'}]}), report = summarize(d, records(d));
  assert.equal(report.evaluationKind, 'production'); assert.equal(report.pilotScreening, null); assert.equal(MODELS.reduce((n, m) => n + report.byPhase.production[m].raw.denominator, 0), 6);
  for (const model of MODELS) assert.equal(report.comparisons[model].raw, null); assert.equal(report.operationalVerdict, 'held');
});
test('invalid pilot denominator/strata,repeated identities,self judging,changed source/protocol and raw grade types fail closed', () => {
  for (const kind of ['fifty-nine', 'stratum', 'duplicate', 'unknown-case', 'self-judge', 'source', 'protocol', 'grade-false', 'grade-zero', 'grade-null', 'visibility']) {
    const d = design();
    if (kind === 'fifty-nine') d.cases.pop();
    if (kind === 'stratum') d.cases[0].stratum = 'needsCorrection';
    const rows = records(d);
    if (kind === 'duplicate') rows.push(rows[0]);
    if (kind === 'unknown-case') rows[0].caseId = 'unknown-case';
    if (kind === 'self-judge') rows[0].judgeModelId = rows[0].modelId;
    if (kind === 'source') rows[0].sourceHash = h;
    if (kind === 'protocol') d.protocolHash = digest('changed after collection');
    if (kind === 'grade-false') rows[0].rawGrade = false;
    if (kind === 'grade-zero') rows[0].rawGrade = 0;
    if (kind === 'grade-null') rows[0].rawGrade = null;
    if (kind === 'visibility') rows[0].visibleAction = 'abstention';
    assert.throws(() => summarize(d, rows), undefined, kind);
  }
});
test('unverified sampling or incomplete families produce unavailable bounds; boundary comparisons remain numerically ambiguous', () => {
  const unverified = design(), a = summarize(unverified, records(unverified)); assert.equal(a.familyUnionRiskByPhase.candidate.raw.upper, null);
  const d = design('pilot', {iid: true}); d.risk.maximumCriticalRisk = exactCriticalUpper(0, 60, .95); const report = summarize(d, records(d));
  assert.equal(report.familyUnionRiskByPhase.candidate.raw.numericLimitSatisfied, null); assert.equal(report.familyUnionRiskByPhase.candidate.raw.criterionStatus, 'unapproved');
});
test('recorded metadata does not certify model accuracy,reviewer credentials or an unapproved risk criterion', () => {
  const d = design(); d.dataClass = 'recorded'; const report = summarize(d, records(d));
  assert.equal(report.dataClass, 'recorded'); assert.equal(report.actualModelQualityVerified, false); assert.equal(report.independentReviewerCredentialsVerified, false);
  const badDesign = design(); badDesign.risk.criterionStatus = 'preregistered'; assert.throws(() => summarize(badDesign, records(badDesign)), /REPORT_RISK_APPROVAL/);
});
test('unknown private fields and reasons fail with fixed messages; reports contain no raw responses or reviewer identifiers', () => {
  const canary = 'SYNTHETIC_PRIVATE_SENTENCE sk-proj-SYNTHETIC-NOT-A-KEY', d = design(), rows = records(d), bundle = reviewAll(rows);
  rows[0][canary] = canary; assert.throws(() => summarize(d, rows, bundle), error => error.message === 'REPORT_RECORD_FIELDS'); delete rows[0][canary];
  bundle.reviews[0].reasonCodes = [canary]; assert.throws(() => summarize(d, rows, bundle), error => error.message === 'REPORT_REVIEW_REASONS');
  const report = summarize(d, rows); assert.doesNotMatch(JSON.stringify(report), /SYNTHETIC_PRIVATE|sk-proj-|same-author-fixture/);
});
test.after(() => { writeFileSync(resolve(root, 'report-examples.json'), JSON.stringify({sourceRoot: SOURCE, arithmeticOnly: true, actualProviderCalls: 0, riskDesignApproved: false, examples}, null, 2) + '\n'); });
