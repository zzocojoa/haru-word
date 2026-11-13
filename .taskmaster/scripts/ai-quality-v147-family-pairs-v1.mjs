// Pure descriptive arithmetic over caller-supplied assessments. Not qualification.
import {digest, MODELS_V3} from './ai-quality-v147-budget-v3.mjs';
import {CONFIRMATORY_STRATA, pairedEffect, tailConfidence} from './ai-quality-v147-risk-design.mjs';

const check = (ok, code) => { if (!ok) throw Error('FP1_' + code); };
const id = x => typeof x === 'string' && /^[A-Za-z0-9_.:/-]{1,160}$/.test(x);
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const key = x => JSON.stringify([x.phase, x.modelId, x.caseId, x.repetition]);
export const FAMILY_PAIRS_V1 = 'ai-quality-v147-family-pairs-v1';
export const FAMILY_PAIR_RULE_V1 = Object.freeze({
  phaseSuccess: 'all planned variants and repeats pass',
  phaseFailure: 'all planned variants and repeats assessed; at least one fail',
  phaseUnavailable: 'any planned variant or repeat unavailable, including absent records',
  pairedCategory: 'baseline fail/candidate pass=gain;pass/fail=loss;pass/pass orfail/fail=tie;otherwise unavailable',
  mixedChanges: 'cell gains and losses retained even when both family phases fail',
  critical: 'observed candidate critical retained even if paired category unavailable',
  repeatFlip: 'within the same case across repeats only; variation across cases is not a repeat flip'
});

export function aggregateFamilyPairsV1({cases, repetitions, observations, familywiseConfidence, boundCount, minimumImprovement}) {
  check(Array.isArray(cases) && cases.length > 0, 'CASES');
  check(Number.isSafeInteger(repetitions) && repetitions > 0 && Number.isSafeInteger(cases.length * repetitions * 6), 'REPETITIONS');
  check(Number.isSafeInteger(boundCount) && boundCount >= 4, 'TAIL_ALLOCATION');
  tailConfidence(familywiseConfidence, boundCount);
  check(Number.isFinite(minimumImprovement) && minimumImprovement >= 0 && minimumImprovement <= 1, 'MARGIN');
  const caseMap = new Map(), families = new Map();
  for (const c of cases) {
    check(c && id(c.id) && id(c.familyId) && ['word', 'grammar'].includes(c.domain)
      && ['normal', 'needsCorrection', 'insufficientContext'].includes(c.stratum) && !caseMap.has(c.id), 'CASE_IDENTITY');
    const existing = families.get(c.familyId);
    check(!existing || existing.domain === c.domain && existing.stratum === c.stratum, 'FAMILY_STRATUM_DRIFT');
    if (!existing) families.set(c.familyId, {familyId: c.familyId, domain: c.domain, stratum: c.stratum, caseIds: []});
    families.get(c.familyId).caseIds.push(c.id); caseMap.set(c.id, c);
  }
  check(Array.isArray(observations), 'OBSERVATIONS');
  const indexed = new Map(), rowIds = new Set(), evidenceHashes = new Set();
  for (const o of observations) {
    check(o && ['baseline', 'candidate'].includes(o.phase) && MODELS_V3.includes(o.modelId) && caseMap.has(o.caseId)
      && Number.isSafeInteger(o.repetition) && o.repetition > 0 && o.repetition <= repetitions, 'OBSERVATION_IDENTITY');
    check(typeof o.rowId === 'string' && o.rowId.length > 0 && o.rowId.length <= 500 && !rowIds.has(o.rowId) && !indexed.has(key(o)), 'DUPLICATE_CELL');
    check(['pass', 'fail', 'unavailable'].includes(o.assessment) && typeof o.critical === 'boolean'
      && !(o.assessment === 'pass' && o.critical), 'ASSESSMENT');
    check(o.evidenceHash === null ? o.assessment === 'unavailable' : hash(o.evidenceHash), 'EVIDENCE');
    check(o.evidenceHash === null || !evidenceHashes.has(o.evidenceHash), 'DUPLICATE_EVIDENCE');
    if (o.evidenceHash !== null) evidenceHashes.add(o.evidenceHash);
    rowIds.add(o.rowId); indexed.set(key(o), o);
  }
  const inputHash = digest({cases, repetitions, observations, familywiseConfidence, boundCount, minimumImprovement});
  const units = [];
  for (const f of families.values()) for (const modelId of MODELS_V3) {
    const phaseRows = phase => f.caseIds.flatMap(caseId => Array.from({length: repetitions}, (_, i) =>
      indexed.get(key({phase, modelId, caseId, repetition: i + 1})) ?? {phase, modelId, caseId, repetition: i + 1, assessment: 'unavailable', critical: false, rowId: null, evidenceHash: null}));
    const a = phaseRows('baseline'), b = phaseRows('candidate');
    const phase = rows => ({plannedCells: rows.length, assessed: rows.filter(r => r.assessment !== 'unavailable').length,
      missingRecords: rows.filter(r => r.rowId === null).length,
      status: rows.some(r => r.assessment === 'unavailable') ? 'unavailable' : rows.every(r => r.assessment === 'pass') ? 'pass' : 'fail',
      observedCritical: rows.some(r => r.critical),
      observedRepeatFlip: f.caseIds.some(caseId => { const v = rows.filter(r => r.caseId === caseId); return v.some(r => r.assessment === 'pass') && v.some(r => r.assessment === 'fail'); })});
    const baseline = phase(a), candidate = phase(b);
    let cellGains = 0, cellLosses = 0, cellUnmeasured = 0;
    for (let i = 0; i < a.length; i++) {
      if ([a[i].assessment, b[i].assessment].includes('unavailable')) cellUnmeasured++;
      else if (a[i].assessment === 'fail' && b[i].assessment === 'pass') cellGains++;
      else if (a[i].assessment === 'pass' && b[i].assessment === 'fail') cellLosses++;
    }
    const category = [baseline.status, candidate.status].includes('unavailable') ? 'unavailable'
      : baseline.status === 'fail' && candidate.status === 'pass' ? 'gain'
      : baseline.status === 'pass' && candidate.status === 'fail' ? 'loss' : 'tie';
    units.push({...f, modelId, baseline, candidate, category, cellGains, cellLosses, cellUnmeasured,
      mixedCellChanges: cellGains > 0 && cellLosses > 0,
      evidence: [...a, ...b].filter(r => r.rowId !== null).map(r => ({rowId: r.rowId, evidenceHash: r.evidenceHash}))});
  }
  const groups = CONFIRMATORY_STRATA.flatMap(stratum => MODELS_V3.map(modelId => {
    const selected = units.filter(u => u.domain + '.' + u.stratum === stratum && u.modelId === modelId);
    const counts = Object.fromEntries(['gain', 'loss', 'tie', 'unavailable'].map(k => [k, selected.filter(u => u.category === k).length]));
    const n = selected.length, interval = n > 0 && counts.unavailable === 0
      ? pairedEffect({n, gains: counts.gain, losses: counts.loss, familywiseConfidence, boundCount}) : null;
    return {stratum, modelId, plannedFamilies: n, counts,
      tiesBothPass: selected.filter(u => u.category === 'tie' && u.baseline.status === 'pass').length,
      tiesBothFail: selected.filter(u => u.category === 'tie' && u.baseline.status === 'fail').length,
      mixedChangeFamilies: selected.filter(u => u.mixedCellChanges).length,
      cellGains: selected.reduce((v, u) => v + u.cellGains, 0), cellLosses: selected.reduce((v, u) => v + u.cellLosses, 0),
      observedCandidateCriticalFamilies: selected.filter(u => u.candidate.observedCritical).length,
      interval, intervalUnavailableReason: n === 0 ? 'no-planned-families' : counts.unavailable > 0 ? 'unmeasured-family' : null,
      numericLowerAboveMargin: interval === null ? null : interval.lower > minimumImprovement,
      approvalOrIndependenceVerified: false};
  }));
  check(inputHash === digest({cases, repetitions, observations, familywiseConfidence, boundCount, minimumImprovement}), 'INPUT_MUTATED');
  return {protocol: FAMILY_PAIRS_V1, rule: FAMILY_PAIR_RULE_V1, ruleHash: digest(FAMILY_PAIR_RULE_V1), inputHash,
    plannedFamilyLabels: families.size, plannedModelFamilyComparisons: units.length,
    plannedGenerationCells: cases.length * repetitions * 6, providedCells: observations.length, repetitions,
    familywiseConfidence, boundCount, minimumImprovement, units, groups,
    candidateCriticalObserved: units.some(u => u.candidate.observedCritical), cellRegressionObserved: units.some(u => u.cellLosses > 0),
    allPairsAssessed: units.every(u => u.category !== 'unavailable'),
    arithmeticOnly: true, independentFamilySamplingVerified: false, familyLabelsProveIndependence: false,
    probabilitiesFromQualifiedPilot: false, ownerRuleApproved: false, actualEnglishQualityMeasured: false,
    sourceProvenanceVerified: false, releaseEligible: false};
}
