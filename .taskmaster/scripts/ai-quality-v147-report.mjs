// Pure aggregation for pilot/confirmation/production records. No network, IO or grade mutation.
import {PLAN, MODELS, digest} from './ai-quality-v147-budget.mjs';
import {DIMENSIONS, CRITICAL, validateGrade} from './ai-quality-v147-calibration.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fields = (x, keys) => object(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|');
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const id = x => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(x);
const integer = x => Number.isSafeInteger(x) && x >= 1;
const strata = ['normal', 'needsCorrection', 'insufficientContext'];
const critical = g => Boolean(g && CRITICAL.some(k => g.criticalErrors[k]));
const assessed = g => Boolean(g && DIMENSIONS.every(k => ['pass', 'fail'].includes(g[k])));
const passed = g => Boolean(g && DIMENSIONS.every(k => g[k] === 'pass') && !critical(g));
const count = (rows, fn) => rows.reduce((n, row) => n + Number(Boolean(fn(row))), 0);
const keyOf = row => [row.phase, row.modelId, row.caseId, row.repetition].join('/');
export const reportRecordKey = keyOf;

function logAdd(a, b) { const high = Math.max(a, b); return high === -Infinity ? high : high + Math.log1p(Math.exp(Math.min(a, b) - high)); }
function logBinomialCdf(k, n, p) {
  if (p === 0) return 0;
  if (p === 1) return k === n ? 0 : -Infinity;
  let term = n * Math.log1p(-p), sum = term;
  const ratio = Math.log(p) - Math.log1p(-p);
  for (let j = 0; j < k; j++) { term += Math.log(n - j) - Math.log(j + 1) + ratio; sum = logAdd(sum, term); }
  return Math.min(0, sum);
}
// One-sided Clopper-Pearson upper endpoint via numerical binomial-CDF inversion.
export function exactCriticalUpper(k, n, confidence) {
  check(integer(n) && Number.isSafeInteger(k) && k >= 0 && k <= n && Number.isFinite(confidence) && confidence > 0 && confidence < 1, 'REPORT_BINOMIAL_INPUT');
  if (k === n) return 1;
  if (k === 0) return -Math.expm1(Math.log1p(-confidence) / n);
  let lower = 0, upper = 1; const alpha = Math.log1p(-confidence);
  for (let i = 0; i < 80; i++) {
    const mid = (lower + upper) / 2; if (mid === lower || mid === upper) break;
    if (logBinomialCdf(k, n, mid) > alpha) lower = mid; else upper = mid;
  }
  return upper;
}

function validateDesign(d) {
  check(fields(d, ['schemaVersion', 'planId', 'runId', 'protocolHash', 'evaluationKind', 'dataClass', 'modelIds', 'phases', 'phaseSeals', 'repetitions', 'cases', 'risk']), 'REPORT_DESIGN_FIELDS');
  check(d.schemaVersion === 1 && d.planId === PLAN && typeof d.runId === 'string' && /^[a-f0-9-]{36}$/.test(d.runId), 'REPORT_DESIGN_ID');
  check(hash(d.protocolHash), 'REPORT_PROTOCOL_BINDING');
  check(['pilot', 'confirmation', 'production'].includes(d.evaluationKind) && ['synthetic', 'recorded'].includes(d.dataClass), 'REPORT_EVALUATION_KIND');
  check(Array.isArray(d.modelIds) && digest([...d.modelIds].sort()) === digest([...MODELS].sort()), 'REPORT_MODELS');
  const phases = d.evaluationKind === 'production' ? ['production'] : ['baseline', 'candidate'];
  check(digest(d.phases) === digest(phases) && fields(d.phaseSeals, phases) && phases.every(p => hash(d.phaseSeals[p])), 'REPORT_PHASE_SEALS');
  check(integer(d.repetitions) && Array.isArray(d.cases) && d.cases.length > 0 && Number.isSafeInteger(d.cases.length * d.repetitions * d.modelIds.length * phases.length), 'REPORT_CASES');
  const ids = new Set();
  for (const c of d.cases) { check(fields(c, ['id', 'domain', 'stratum', 'familyId']) && id(c.id) && id(c.familyId) && !ids.has(c.id) && ['word', 'grammar'].includes(c.domain) && strata.includes(c.stratum), 'REPORT_CASE_DEFINITION'); ids.add(c.id); }
  if (d.evaluationKind === 'pilot') {
    check(d.repetitions === 1 && d.cases.length === 60, 'REPORT_PILOT_DENOMINATOR');
    for (const [domain, counts] of Object.entries({word: [10, 12, 8], grammar: [10, 13, 7]}))
      strata.forEach((stratum, i) => check(d.cases.filter(c => c.domain === domain && c.stratum === stratum).length === counts[i], 'REPORT_PILOT_STRATA'));
  }
  if (d.evaluationKind === 'production') check(d.repetitions === 1 && d.cases.length === 2 && ['word', 'grammar'].every(domain => d.cases.filter(c => c.domain === domain).length === 1), 'REPORT_PRODUCTION_SIX_CELLS');
  const r = d.risk;
  check(fields(r, ['confidenceLevel', 'samplingModel', 'assumptionEvidenceHash', 'criterionStatus', 'approvalEvidenceHash', 'maximumCriticalRisk'])
    && Number.isFinite(r.confidenceLevel) && r.confidenceLevel > 0 && r.confidenceLevel < 1
    && ['unverified', 'iid-family-union'].includes(r.samplingModel) && ['unapproved', 'preregistered'].includes(r.criterionStatus), 'REPORT_RISK_DESIGN');
  check(r.samplingModel === 'unverified' ? r.assumptionEvidenceHash === null : hash(r.assumptionEvidenceHash), 'REPORT_RISK_ASSUMPTION');
  check(r.criterionStatus === 'unapproved' ? r.approvalEvidenceHash === null : hash(r.approvalEvidenceHash) && r.maximumCriticalRisk !== null, 'REPORT_RISK_APPROVAL');
  check(r.maximumCriticalRisk === null || Number.isFinite(r.maximumCriticalRisk) && r.maximumCriticalRisk >= 0 && r.maximumCriticalRisk <= 1, 'REPORT_RISK_LIMIT');
}
function checkGradeVisibility(grade, action, c) {
  validateGrade(grade);
  check(grade.abstention !== 'pass' || action === (c.stratum === 'insufficientContext' ? 'abstention' : 'answer'), 'REPORT_GRADE_VISIBILITY_CONFLICT');
}
function indexRecords(design, records) {
  check(Array.isArray(records), 'REPORT_RECORDS'); const map = new Map(), designHash = digest(design), cases = new Map(design.cases.map(c => [c.id, c]));
  for (const r of records) {
    check(fields(r, ['designHash', 'phase', 'modelId', 'caseId', 'repetition', 'sourceHash', 'generationState', 'appState', 'visibleAction', 'judgeState', 'judgeModelId', 'rawGrade', 'evidenceHash', 'diagnosticHash']), 'REPORT_RECORD_FIELDS');
    check(r.designHash === designHash && design.phases.includes(r.phase) && design.modelIds.includes(r.modelId) && cases.has(r.caseId)
      && integer(r.repetition) && r.repetition <= design.repetitions && r.sourceHash === design.phaseSeals[r.phase], 'REPORT_RECORD_BINDING');
    check(['completed', 'failed', 'unknown', 'not-run'].includes(r.generationState) && ['accepted', 'rejected', 'failed', 'not-run'].includes(r.appState)
      && ['completed', 'failed', 'unknown', 'not-run'].includes(r.judgeState), 'REPORT_COLLECTION_STATE');
    check(r.generationState === 'completed' || r.appState === 'not-run', 'REPORT_APP_WITHOUT_GENERATION');
    check(r.appState === 'accepted' ? ['answer', 'abstention'].includes(r.visibleAction) : r.visibleAction === null && r.judgeState === 'not-run', 'REPORT_VISIBILITY_STATE');
    check(r.judgeState === 'not-run' ? r.judgeModelId === null : design.modelIds.includes(r.judgeModelId) && r.judgeModelId !== r.modelId, 'REPORT_JUDGE_IDENTITY');
    check(r.judgeState === 'completed' ? r.rawGrade !== null : r.rawGrade === null, 'REPORT_GRADE_STATE');
    check(r.evidenceHash === null ? r.generationState === 'not-run' : hash(r.evidenceHash), 'REPORT_EVIDENCE');
    check(r.diagnosticHash === null || hash(r.diagnosticHash), 'REPORT_DIAGNOSTIC');
    if (r.judgeState === 'completed') checkGradeVisibility(r.rawGrade, r.visibleAction, cases.get(r.caseId));
    const key = keyOf(r); check(!map.has(key), 'REPORT_DUPLICATE_RECORD'); map.set(key, r);
  }
  return map;
}
function attachReviews(rows, reviews, decisions) {
  check(Array.isArray(reviews) && Array.isArray(decisions), 'REPORT_REVIEWS'); const by = new Map(rows.map(r => [r.key, r])), rm = new Map(), dm = new Map();
  for (const review of reviews) {
    check(fields(review, ['key', 'rawRecordHash', 'evidenceHash', 'reviewerId', 'grade', 'reasonCodes']) && id(review.reviewerId), 'REPORT_REVIEW_FIELDS');
    const row = by.get(review.key); check(row?.record && row.record.appState === 'accepted' && !rm.has(review.key), 'REPORT_REVIEW_TARGET');
    check(review.rawRecordHash === digest(row.record) && review.evidenceHash === row.record.evidenceHash, 'REPORT_STALE_REVIEW');
    checkGradeVisibility(review.grade, row.record.visibleAction, row.c);
    check(Array.isArray(review.reasonCodes) && review.reasonCodes.length > 0 && review.reasonCodes.every(x => ['confirmed', 'target', 'grammar', 'meaning_preservation', 'explanation', 'abstention', 'unavailable'].includes(x)), 'REPORT_REVIEW_REASONS');
    rm.set(review.key, review);
  }
  for (const decision of decisions) {
    check(fields(decision, ['key', 'rawRecordHash', 'reviewHash', 'adjudicatorId', 'decision']) && id(decision.adjudicatorId), 'REPORT_DECISION_FIELDS');
    const row = by.get(decision.key), review = rm.get(decision.key); check(row?.record && review && !dm.has(decision.key), 'REPORT_DECISION_TARGET');
    check(decision.rawRecordHash === digest(row.record) && decision.reviewHash === digest(review) && ['confirm_raw', 'confirm_review', 'unresolved'].includes(decision.decision), 'REPORT_STALE_DECISION');
    check(decision.decision !== 'confirm_review' || row.record.rawGrade !== null, 'REPORT_MISSING_RAW_NOT_PROMOTABLE'); dm.set(decision.key, decision);
  }
  return rows.map(row => { const review = rm.get(row.key), decision = dm.get(row.key), resolved = Boolean(review && decision && decision.decision !== 'unresolved');
    return {...row, review, resolved, adjustedGrade: resolved && row.record.rawGrade ? decision.decision === 'confirm_raw' ? row.record.rawGrade : review.grade : null}; });
}
function riskFor(design, rows, grade) {
  const groups = new Map(); for (const row of rows) { if (!groups.has(row.c.familyId)) groups.set(row.c.familyId, []); groups.get(row.c.familyId).push(row); }
  const units = [...groups.values()], full = count(units, rs => rs.every(r => assessed(grade(r)))), bad = count(units, rs => rs.some(r => critical(grade(r))));
  const complete = full === units.length && units.length > 0, declared = design.risk.samplingModel === 'iid-family-union';
  const upper = complete && declared ? exactCriticalUpper(bad, units.length, design.risk.confidenceLevel) : null;
  const limit = design.risk.maximumCriticalRisk, delta = upper === null || limit === null ? null : limit - upper;
  return {unit: 'family-union', plannedUnits: units.length, fullyAssessedUnits: full, observedCriticalUnits: bad, unmeasuredUnits: units.length - full,
    endpoint: 'any critical flag in any included model or repetition within a family', method: 'one-sided Clopper-Pearson numeric inversion', confidenceLevel: design.risk.confidenceLevel,
    samplingModel: design.risk.samplingModel, assumptionEvidenceHash: design.risk.assumptionEvidenceHash, upper,
    unavailableReason: !complete ? 'unmeasured-family' : !declared ? 'sampling-model-unverified' : null,
    criterionStatus: design.risk.criterionStatus, declaredMaximum: limit, numericLimitSatisfied: delta === null || Math.abs(delta) <= 1e-10 ? null : delta > 0,
    inferenceConditionalOnIidFamilies: true, approvalOrSamplingVerifiedHere: false};
}
function aggregate(design, rows, grade) {
  const n = rows.length, correct = count(rows, r => passed(grade(r))), full = count(rows, r => assessed(grade(r)));
  return {denominator: n, correct, rate: n ? correct / n : null, graded: count(rows, r => Boolean(grade(r))), fullyAssessed: full, unmeasured: n - full,
    visibleAvailable: count(rows, r => r.record?.appState === 'accepted'), appRejections: count(rows, r => r.record?.appState === 'rejected'),
    visibleOverAbstention: count(rows, r => r.c.stratum !== 'insufficientContext' && r.record?.visibleAction === 'abstention'),
    appropriateVisibleAbstention: count(rows, r => r.c.stratum === 'insufficientContext' && r.record?.visibleAction === 'abstention' && grade(r)?.abstention === 'pass'),
    appRejectionsOnAnswerExpected: count(rows, r => r.c.stratum !== 'insufficientContext' && r.record?.appState === 'rejected'),
    criticalCases: count(rows, r => critical(grade(r))), criticalByType: Object.fromEntries(CRITICAL.map(k => [k, count(rows, r => grade(r)?.criticalErrors[k])])),
    dimensions: Object.fromEntries(DIMENSIONS.map(k => [k, {...Object.fromEntries(['pass', 'fail', 'uncertain', 'unavailable'].map(v => [v, count(rows, r => grade(r)?.[k] === v)])), notGraded: count(rows, r => !grade(r)), denominator: n}])),
    risk: riskFor(design, rows, grade)};
}
function collection(rows) {
  const terminal = r => r && (r.generationState === 'failed' || r.generationState === 'completed' && (['rejected', 'failed'].includes(r.appState) || r.appState === 'accepted' && ['completed', 'failed'].includes(r.judgeState)));
  return {planned: rows.length, records: count(rows, r => r.record), missingRecords: count(rows, r => !r.record), generationCompleted: count(rows, r => r.record?.generationState === 'completed'),
    generationFailed: count(rows, r => r.record?.generationState === 'failed'), generationUnknown: count(rows, r => r.record?.generationState === 'unknown'), generationNotRun: count(rows, r => r.record?.generationState === 'not-run'),
    appAccepted: count(rows, r => r.record?.appState === 'accepted'), appRejected: count(rows, r => r.record?.appState === 'rejected'), appFailed: count(rows, r => r.record?.appState === 'failed'),
    appNotRun: count(rows, r => r.record?.appState === 'not-run'), judgeCompleted: count(rows, r => r.record?.judgeState === 'completed'), judgeFailed: count(rows, r => r.record?.judgeState === 'failed'),
    judgeUnknown: count(rows, r => r.record?.judgeState === 'unknown'), judgeNotRun: count(rows, r => r.record?.judgeState === 'not-run'),
    complete: rows.every(r => terminal(r.record))};
}
const views = {raw: r => r.record?.rawGrade ?? null, review: r => r.review?.grade ?? null, adjudicated: r => r.adjustedGrade};
function table(design, rows) { return {...Object.fromEntries(Object.entries(views).map(([name, grade]) => [name, aggregate(design, rows, grade)])), collection: collection(rows)}; }
function paired(design, rows, model, grade) {
  if (design.evaluationKind === 'production') return null;
  let regressions = 0, improvements = 0, unmeasured = 0, availabilityLosses = 0, availabilityGains = 0, availabilityUnmeasured = 0;
  const visibility = r => r?.appState === 'accepted' ? 'available' : r?.generationState === 'failed' || ['rejected', 'failed'].includes(r?.appState) ? 'unavailable' : 'unknown';
  for (const c of design.cases) for (let repetition = 1; repetition <= design.repetitions; repetition++) {
    const a = rows.find(r => r.modelId === model && r.phase === 'baseline' && r.c.id === c.id && r.repetition === repetition), b = rows.find(r => r.modelId === model && r.phase === 'candidate' && r.c.id === c.id && r.repetition === repetition);
    if (!assessed(grade(a)) || !assessed(grade(b))) unmeasured++;
    else { if (passed(grade(a)) && !passed(grade(b))) regressions++; if (!passed(grade(a)) && passed(grade(b))) improvements++; }
    const va = visibility(a.record), vb = visibility(b.record);
    if (va === 'unknown' || vb === 'unknown') availabilityUnmeasured++;
    if (va === 'available' && vb === 'unavailable') availabilityLosses++;
    if (va === 'unavailable' && vb === 'available') availabilityGains++;
  }
  return {denominator: design.cases.length * design.repetitions, regressions, improvements, unmeasured, availabilityLosses, availabilityGains, availabilityUnmeasured};
}
function repeats(design, rows, grade) {
  let robustCases = 0, flipCases = 0, unmeasuredCases = 0;
  for (const c of design.cases) { const selected = rows.filter(r => r.c.id === c.id), complete = selected.every(r => assessed(grade(r)));
    if (!complete) unmeasuredCases++; if (selected.every(r => passed(grade(r)))) robustCases++;
    if (complete && selected.some(r => passed(grade(r))) && selected.some(r => !passed(grade(r)))) flipCases++;
  }
  return {caseDenominator: design.cases.length, repetitions: design.repetitions, robustCases, flipCases, unmeasuredCases};
}

export function reportEvaluation({design, records, reviews = [], adjudications = []}) {
  validateDesign(design); const indexed = indexRecords(design, records), inputHash = digest({design, records, reviews, adjudications}); let rows = [];
  for (const phase of design.phases) for (const modelId of design.modelIds) for (const c of design.cases) for (let repetition = 1; repetition <= design.repetitions; repetition++) {
    const identity = {phase, modelId, caseId: c.id, repetition}, key = keyOf(identity); rows.push({...identity, c, key, record: indexed.get(key) ?? null});
  }
  rows = attachReviews(rows, reviews, adjudications); const byPhase = {};
  for (const phase of design.phases) byPhase[phase] = Object.fromEntries(design.modelIds.map(modelId => {
    const selected = rows.filter(r => r.phase === phase && r.modelId === modelId);
    const groups = getter => Object.fromEntries([...new Set(selected.map(getter))].sort().map(k => [k, table(design, selected.filter(r => getter(r) === k))]));
    return [modelId, {...table(design, selected),
      byStratum: groups(r => r.c.stratum), byDomain: groups(r => r.c.domain), byFamily: groups(r => r.c.familyId), byRepetition: groups(r => String(r.repetition)),
      repeatRobustness: Object.fromEntries(Object.entries(views).map(([v, g]) => [v, repeats(design, selected, g)])),
      reviewCoverage: {required: count(selected, r => r.record?.appState === 'accepted'), received: count(selected, r => r.review), resolved: count(selected, r => r.resolved),
        conflicting: count(selected, r => r.review && r.record.rawGrade && digest(r.review.grade) !== digest(r.record.rawGrade)),
        pending: count(selected, r => r.record?.appState === 'accepted' && !r.resolved)}}];
  }));
  const comparisons = Object.fromEntries(design.modelIds.map(model => [model, Object.fromEntries(Object.entries(views).map(([v, g]) => [v, paired(design, rows, model, g)]))]));
  const thresholds = {overall: {minimum: 57, denominator: 60}, normal: {minimum: 18, denominator: 20}, needsCorrection: {minimum: 23, denominator: 25}, insufficientContext: {minimum: 14, denominator: 15}};
  const pilotScreening = design.evaluationKind !== 'pilot' ? null : Object.fromEntries(['raw', 'adjudicated'].map(view => {
    const byModel = Object.fromEntries(design.modelIds.map(model => { const c = byPhase.candidate[model], p = comparisons[model][view];
      const numericThresholdsMet = c[view].correct >= 57 && strata.every(s => c.byStratum[s][view].correct >= thresholds[s].minimum);
      return [model, {numericThresholdsMet, denominator: 60, correct: c[view].correct, assessmentComplete: c[view].unmeasured === 0,
        criticalZero: c[view].criticalCases === 0, pairedComplete: p.unmeasured === 0, regressionZero: p.regressions === 0 && p.availabilityLosses === 0,
        preScreenSatisfied: numericThresholdsMet && c.collection.complete && c[view].unmeasured === 0 && c[view].criticalCases === 0 && p.unmeasured === 0 && p.regressions === 0 && p.availabilityLosses === 0}]; }));
    return [view, {thresholds, byModel, allModelsSatisfied: Object.values(byModel).every(m => m.preScreenSatisfied), releaseEligible: false}];
  }));
  const familyUnionRiskByPhase = Object.fromEntries(design.phases.map(phase => [phase, Object.fromEntries(Object.entries(views).map(([v, g]) => [v, riskFor(design, rows.filter(r => r.phase === phase), g)]))]));
  check(digest({design, records, reviews, adjudications}) === inputHash, 'REPORT_INPUT_MUTATED');
  return {schemaVersion: 1, planId: design.planId, runId: design.runId, protocolHash: design.protocolHash, designHash: digest(design), inputHash, evaluationKind: design.evaluationKind, dataClass: design.dataClass,
    byPhase, comparisons, familyUnionRiskByPhase, pilotScreening, rawRecordHash: digest(records), reviewHash: digest(reviews), adjudicationHash: digest(adjudications),
    countsAreFixedToPlannedCells: true, rawReviewAdjudicatedNeverMerged: true, actualModelQualityVerified: false, independentReviewerCredentialsVerified: false,
    releaseVerdict: 'held', operationalVerdict: 'held',
    scope: 'Visible product output arithmetic; visibleAction concerns overall correction availability,not target-only uncertainty. App rejection is unavailability,not proof an English sentence is wrong. Pilot screening is not release qualification. Risk bounds are conditional on the declared iid family-union sampling model; no approval or independence certification is inferred.'};
}
