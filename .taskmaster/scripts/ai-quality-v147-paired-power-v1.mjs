// Prospective arithmetic only: one prespecified model/stratum paired comparison.
// No calls, grades, approvals, sample selection, stopping changes or release verdict.
import {tailConfidence} from './ai-quality-v147-risk-design.mjs';
import {exactCriticalUpper} from './ai-quality-v147-report.mjs';

const check = (ok, code) => { if (!ok) throw new Error(code); };
export const MAX_POWER_FAMILIES = 4096; // Local computational ceiling, not an API quota.
const categories = ['gain', 'loss', 'tie', 'unavailable'];
function sum(values) {
  let total = 0, correction = 0;
  for (const x of values) { const y = x - correction, next = total + y; correction = (next - total) - y; total = next; }
  return total;
}
function checkedProbability(x) {
  check(Number.isFinite(x) && x >= -1e-12 && x <= 1 + 1e-12, 'POWER_NUMERIC_PROBABILITY');
  return Math.max(0, Math.min(1, x));
}
function distribution(input) {
  check(input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).sort().join('|') === [...categories].sort().join('|'), 'POWER_CATEGORY_FIELDS');
  check(categories.every(k => Number.isFinite(input[k]) && input[k] >= 0 && input[k] <= 1), 'POWER_CATEGORY_PROBABILITY');
  const divisor = sum(categories.map(k => input[k]));
  check(Math.abs(divisor - 1) <= 1e-12, 'POWER_CATEGORY_TOTAL');
  return {probabilities: Object.fromEntries(categories.map(k => [k, input[k] / divisor])), normalizationDivisor: divisor};
}

// Start at the mode, so the unnormalised weights never grow from a tiny tail.
// Retain upper-tail mass directly; do not compute it as 1 minus a rounded CDF.
function binomialWeights(n, p) {
  const weights = new Float64Array(n + 1);
  if (p === 0 || p === 1) { weights[p === 0 ? 0 : n] = 1; return weights; }
  const q = 1 - p, mode = Math.min(n, Math.floor((n + 1) * p));
  weights[mode] = 1;
  for (let k = mode; k < n; k++) weights[k + 1] = weights[k] * ((n - k) * p / ((k + 1) * q));
  for (let k = mode; k > 0; k--) weights[k - 1] = weights[k] * (k * q / ((n - k + 1) * p));
  const total = sum(weights);
  check(Number.isFinite(total) && total >= 1, 'POWER_NUMERIC_WEIGHTS');
  return weights.map(x => x / total);
}

export function pairedPowerSensitivity({n, familywiseConfidence, boundCount, minimumImprovement, scenarios}) {
  check(Number.isSafeInteger(n) && n > 0 && n <= MAX_POWER_FAMILIES, 'POWER_FAMILY_COUNT');
  check(Number.isSafeInteger(boundCount) && boundCount >= 4, 'POWER_TAIL_ALLOCATION');
  check(Number.isFinite(minimumImprovement) && minimumImprovement >= 0 && minimumImprovement <= 1, 'POWER_MARGIN');
  const confidence = tailConfidence(familywiseConfidence, boundCount);
  check(Array.isArray(scenarios) && scenarios.length > 0, 'POWER_SCENARIOS');
  const ids = new Set();
  const inputs = scenarios.map(s => {
    check(s && typeof s.id === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(s.id) && !ids.has(s.id), 'POWER_SCENARIO_ID');
    ids.add(s.id); return {id: s.id, ...distribution(s.probabilities)};
  });
  const upper = Array.from({length: n + 1}, (_, k) => exactCriticalUpper(k, n, confidence));
  const lower = upper.map((_, k) => k === 0 ? 0 : 1 - upper[n - k]);
  // Exactly the existing pairedEffect lower > margin rule, including strictness.
  // A missing measurement is never removed from n or counted as a tie/pass.
  const minimumGainsByLossCount = upper.map((lossUpper, losses) => {
    let lo = 0, hi = n - losses + 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (Math.max(-1, lower[mid] - lossUpper) > minimumImprovement) hi = mid;
      else lo = mid + 1;
    }
    return lo <= n - losses ? lo : null;
  });
  const rows = inputs.map(({id, probabilities: p, normalizationDivisor}) => {
    const measured = sum([p.gain, p.loss, p.tie]);
    const allMeasured = measured === 0 ? 0 : checkedProbability(Math.exp(n * Math.log(measured)));
    let conditional = null;
    if (measured > 0) {
      const lossWeights = binomialWeights(n, checkedProbability(p.loss / measured));
      const nonLoss = p.gain + p.tie, gainProbability = nonLoss === 0 ? 0 : checkedProbability(p.gain / nonLoss);
      const terms = minimumGainsByLossCount.map((firstGain, losses) => {
        if (firstGain === null || lossWeights[losses] === 0) return 0;
        const gainWeights = binomialWeights(n - losses, gainProbability);
        return lossWeights[losses] * sum(gainWeights.subarray(firstGain));
      });
      conditional = checkedProbability(sum(terms));
    }
    return {id, probabilities: p, normalizationDivisor,
      alternativePairedDifference: p.gain - p.loss,
      probabilityAllMeasured: allMeasured, conditionalPowerGivenAllMeasured: conditional,
      power: conditional === null ? 0 : checkedProbability(allMeasured * conditional),
      allMeasuredProbabilityUnderflow: measured > 0 && allMeasured === 0};
  });
  return {protocol: 'ai-quality-v147-paired-power-v1', n, familywiseConfidence, boundCount,
    perTailConfidence: confidence, minimumImprovement, minimumGainsByLossCount, rows,
    decision: 'all n measured AND existing pairedEffect.lower > minimumImprovement',
    method: 'finite multinomial sum via mode-centred binomial recurrences; binary64, not Monte Carlo',
    unit: 'one iid independent representative family; aggregate repeats/variants before assigning a category',
    scope: 'one prespecified model/stratum comparison, not joint study success or English truth',
    probabilityZeroIsProofOfImpossibility: false, missingRemovedFromDenominator: false,
    probabilitiesEstimatedFromConfirmation: false, sampleSizeSelected: false,
    iidFamiliesVerified: false, ownerRiskApproved: false, actualEnglishQualityMeasured: false,
    liveAuthorized: false, releaseEligible: false};
}
