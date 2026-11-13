// Offline planning arithmetic only. No corpus, approval, network or release verdict.
import {exactCriticalUpper} from './ai-quality-v147-report.mjs';
import {MODELS} from './ai-quality-v147-budget.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
const positive = n => Number.isSafeInteger(n) && n > 0;
const probability = x => Number.isFinite(x) && x > 0 && x < 1;
export const CONFIRMATORY_STRATA = ['word.normal', 'word.needsCorrection', 'word.insufficientContext', 'grammar.normal', 'grammar.needsCorrection', 'grammar.insufficientContext'];

// Fixed finite tail allocation; dependence between endpoints does not invalidate
// the union bound. Independent representative families within each stratum are
// still required for each binomial interval itself.
export function confirmationBounds() {
  return CONFIRMATORY_STRATA.flatMap(stratum => [
    {stratum, endpoint: 'any-model-critical', model: 'all-three', tail: 'upper'},
    ...MODELS.flatMap(model => [
      {stratum, endpoint: 'any-dimension-failure', model, tail: 'upper'},
      {stratum, endpoint: 'repeat-flip', model, tail: 'upper'},
      ...['gain', 'loss'].flatMap(endpoint => ['lower', 'upper'].map(tail => ({stratum, endpoint, model, tail})))
    ])
  ]);
}

export function tailConfidence(familywiseConfidence, boundCount) {
  check(probability(familywiseConfidence) && positive(boundCount), 'RISK_CONFIDENCE_INPUT');
  const confidence = 1 - (1 - familywiseConfidence) / boundCount;
  check(probability(confidence), 'RISK_CONFIDENCE_PRECISION'); return confidence;
}

export function zeroEventFamilies({maximumRisk, familywiseConfidence, boundCount}) {
  check(probability(maximumRisk), 'RISK_MAXIMUM_INPUT');
  const confidence = tailConfidence(familywiseConfidence, boundCount);
  let n = Math.ceil(Math.log1p(-confidence) / Math.log1p(-maximumRisk));
  check(positive(n), 'RISK_SAMPLE_PRECISION');
  // Verify both sides of the integer boundary,including floating point rounding.
  while (exactCriticalUpper(0, n, confidence) > maximumRisk) n++;
  while (n > 1 && exactCriticalUpper(0, n - 1, confidence) <= maximumRisk) n--;
  // At equality,independent solvers can round to opposite sides. Plan one more
  // family instead of treating a floating point tie as sufficient precision.
  const numericTolerance = Math.min(1e-12, maximumRisk * 1e-8);
  const numericBoundaryGuard = Math.abs(exactCriticalUpper(0, n, confidence) - maximumRisk) <= numericTolerance
    || n > 1 && Math.abs(exactCriticalUpper(0, n - 1, confidence) - maximumRisk) <= numericTolerance;
  if (Math.abs(exactCriticalUpper(0, n, confidence) - maximumRisk) <= numericTolerance) n++;
  check(positive(n), 'RISK_SAMPLE_PRECISION');
  return {n, confidence, upperAtZero: exactCriticalUpper(0, n, confidence),
    upperAtPrevious: n > 1 ? exactCriticalUpper(0, n - 1, confidence) : null,
    numericBoundaryGuard, numericTolerance,
    assumption: 'iid representative families within the stratum; all planned cells measured',
    zeroEventDesignOnly: true, powerGuaranteed: false};
}

export function pairedEffect({n, gains, losses, familywiseConfidence, boundCount}) {
  check(positive(n) && Number.isSafeInteger(gains) && Number.isSafeInteger(losses) && gains >= 0 && losses >= 0 && gains + losses <= n, 'RISK_PAIR_COUNTS');
  check(positive(boundCount) && boundCount >= 4, 'RISK_PAIR_TAIL_ALLOCATION');
  const c = tailConfidence(familywiseConfidence, boundCount);
  const bounds = k => ({lower: k === 0 ? 0 : 1 - exactCriticalUpper(n - k, n, c), upper: exactCriticalUpper(k, n, c)});
  const gain = bounds(gains), loss = bounds(losses);
  return {n, gains, losses, estimate: (gains - losses) / n, lower: Math.max(-1, gain.lower - loss.upper), upper: Math.min(1, gain.upper - loss.lower),
    gain, loss, perTailConfidence: c, method: 'four marginal exact binomial tails with prespecified simultaneous allocation; no independence assumed between gain and loss',
    samplingVerified: false, releaseEligible: false};
}

export function confirmationCalls({familiesPerStratum, variantsPerFamily, repetitions, calibrationCalls}) {
  check(Array.isArray(familiesPerStratum) && familiesPerStratum.length === 6 && familiesPerStratum.every(positive)
    && positive(variantsPerFamily) && positive(repetitions) && Number.isSafeInteger(calibrationCalls) && calibrationCalls >= 0, 'RISK_CALL_COUNTS');
  const families = familiesPerStratum.reduce((a, b) => a + b, 0), cases = families * variantsPerFamily;
  const generation = cases * repetitions * 3 * 2, judge = generation;
  check([families, cases, generation, generation * 2 + calibrationCalls + 762].every(Number.isSafeInteger), 'RISK_CALL_OVERFLOW');
  return {independentFamilyUnits: families, caseTexts: cases, variantsPerFamily, repetitions, phases: 2, models: 3,
    generation, mainJudge: judge, calibration: calibrationCalls, confirmationMaximum: generation + judge + calibrationCalls,
    priorPilotMaximumSeparate: 756, productionGenerationSeparate: 6, productionJudgeNotScheduled: true,
    maximumAcrossListedStages: 756 + generation + judge + calibrationCalls + 6,
    dispatchAuthorized: false, monetaryBudgetApproved: false};
}

export function riskPlanningOption({maximumCriticalRisk, familywiseConfidence = .95, repetitions = 2, variantsPerFamily = 1}) {
  const bounds = confirmationBounds(), boundCount = bounds.length;
  const sample = zeroEventFamilies({maximumRisk: maximumCriticalRisk, familywiseConfidence, boundCount});
  return {status: 'draft-not-approved', maximumCriticalRisk, familywiseConfidence, boundCount, bounds, sample,
    familiesPerStratum: Object.fromEntries(CONFIRMATORY_STRATA.map(s => [s, sample.n])),
    costs: confirmationCalls({familiesPerStratum: Array(6).fill(sample.n), variantsPerFamily, repetitions, calibrationCalls: 36}),
    fixedMaximumLooks: 1, stopEarlyForHarmAllowed: true, extendSampleAfterOutcomesAllowed: false,
    proposedOtherCriteria: {maximumAnyDimensionFailure: .10, noninferiorityMargin: .02, maximumRepeatFlip: .05,
      zeroObservedCritical: true, zeroRequiredNormalFalseRejections: true, zeroUnmeasured: true,
      minimumPairedImprovement: null, improvementScope: 'must preregister targeted family set and effect size separately; no improvement claim from noninferiority alone'},
    designApproved: false, sampleJustifiedForRealCorpus: false, iidFamiliesVerified: false, actualModelQualityMeasured: false,
    note: 'The n calculation addresses only zero-event critical precision. It does not prove feasible independent families,effect power,review capacity or affordable monetary cost. These are mandatory approval holds.'};
}
