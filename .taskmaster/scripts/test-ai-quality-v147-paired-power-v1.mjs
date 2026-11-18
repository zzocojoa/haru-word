import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {pairedPowerSensitivity, MAX_POWER_FAMILIES} from './ai-quality-v147-paired-power-v1.mjs';
import {pairedEffect, zeroEventFamilies} from './ai-quality-v147-risk-design.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(HERE, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8'));
const SOURCE = resolve(manifest.baseline.sourceRoot);
const reference = JSON.parse(readFileSync(resolve(SOURCE, '.taskmaster/evaluation/ai-quality-v147/paired-power-reference-v1.json'), 'utf8'));
const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(SOURCE, 'work', 'paired-power-' + randomUUID()));
mkdirSync(out, {recursive: true});
const base = {n: 20, familywiseConfidence: .95, boundCount: 114, minimumImprovement: 0};
const allGain = [{id: 'one', probabilities: {gain: 1, loss: 0, tie: 0, unavailable: 0}}];
let maxAbsoluteError = 0, maxRelativeError = 0;
let referenceComparisonPassed = false;
const results = new Map();
const close = (actual, expected) => {
  const error = Math.abs(actual - expected); maxAbsoluteError = Math.max(maxAbsoluteError, error);
  assert.ok(error < 1e-11, `${actual} versus ${expected}`);
  if (expected > 1e-280 && expected < 1) {
    const relative = error / expected; maxRelativeError = Math.max(maxRelativeError, relative);
    assert.ok(relative < 1e-8, `relative ${relative}: ${actual} versus ${expected}`);
  }
};
const key = p => [p.n, p.boundCount, p.minimumImprovement].join('/');

test('110 independent SciPy power references and33 Decimal exhaustive sums preserve the fixed decision boundary', () => {
  assert.equal(reference.plans.length, 10);
  for (const p of reference.plans) {
    const result = pairedPowerSensitivity({...p, scenarios: p.rows.map(({id, probabilities}) => ({id, probabilities}))});
    results.set(key(p), result);
    assert.deepEqual(result.minimumGainsByLossCount, p.minimumGainsByLossCount);
    for (let i = 0; i < result.rows.length; i++) {
      const actual = result.rows[i], expected = p.rows[i];
      for (const field of ['power', 'probabilityAllMeasured', 'conditionalPowerGivenAllMeasured']) {
        if (expected[field] === null) assert.equal(actual[field], null); else close(actual[field], expected[field]);
      }
      if (expected.decimalExhaustivePower !== undefined) close(actual.power, Number(expected.decimalExhaustivePower));
    }
  }
  referenceComparisonPassed = true;
});

test('every small-n gain/loss state uses the existing pairedEffect rule,with strict margin equality excluded', () => {
  const equality = pairedEffect({...base, gains: 17, losses: 0}).lower;
  assert.ok(equality > 0);
  for (const minimumImprovement of [0, .02, equality]) {
    const result = pairedPowerSensitivity({...base, minimumImprovement, scenarios: allGain});
    for (let gains = 0; gains <= base.n; gains++) for (let losses = 0; losses <= base.n - gains; losses++) {
      const first = result.minimumGainsByLossCount[losses];
      assert.equal(first !== null && gains >= first, pairedEffect({...base, gains, losses}).lower > minimumImprovement);
    }
    if (minimumImprovement === equality) assert.ok(result.minimumGainsByLossCount[0] > 17);
  }
});

test('zero unavailable is required: observed missingness never becomes a tie or smaller denominator', () => {
  for (const result of results.values()) {
    const get = id => result.rows.find(x => x.id === id);
    const complete = get('gain10-low-discordance'), missing = get('gain10-one-percent-missing');
    close(missing.probabilityAllMeasured, .99 ** result.n);
    close(missing.conditionalPowerGivenAllMeasured, complete.power);
    close(missing.power, complete.power * .99 ** result.n);
    for (const row of result.rows) assert.ok(row.power <= row.probabilityAllMeasured + 1e-15);
    assert.equal(get('all-unavailable').power, 0);
    assert.equal(get('all-unavailable').conditionalPowerGivenAllMeasured, null);
    assert.equal(result.missingRemovedFromDenominator, false);
  }
});

test('same net improvement is insufficient to specify power;discordance and declared margin change it', () => {
  const zero = results.get('151/114/0'), margin = results.get('151/114/0.02');
  const low = zero.rows.find(x => x.id === 'gain10-low-discordance'), high = zero.rows.find(x => x.id === 'gain10-high-discordance');
  close(low.alternativePairedDifference, high.alternativePairedDifference);
  assert.ok(low.power > high.power);
  for (let i = 0; i < zero.rows.length; i++) assert.ok(margin.rows[i].power <= zero.rows[i].power + 1e-15);
});

test('zero-event precision N does not certify80percent improvement-detection power', () => {
  const sample = zeroEventFamilies({maximumRisk: .05, familywiseConfidence: .95, boundCount: 114});
  assert.equal(sample.n, 151);
  const p = results.get('151/114/0').rows.find(x => x.id === 'gain10-low-discordance');
  assert.ok(p.power < .8);
  assert.equal(sample.powerGuaranteed, false);
});

test('endpoint and tiny upper-tail probabilities survive without subtracting a rounded CDF', () => {
  const result = pairedPowerSensitivity({...base, scenarios: [
    {id: 'tiny-gain', probabilities: {gain: 1e-10, loss: 0, tie: 1 - 1e-10, unavailable: 0}},
    {id: 'gain-or-missing', probabilities: {gain: .99, loss: 0, tie: 0, unavailable: .01}}
  ]});
  assert.ok(result.rows[0].power > 0 && result.rows[0].power < 1e-20);
  close(result.rows[1].power, .99 ** 20);
  assert.equal(results.get('1/114/0').rows.find(x => x.id === 'all-gain').power, 0);
  assert.equal(results.get('20/114/0').rows.find(x => x.id === 'all-gain').power, 1);
  assert.equal(results.get('20/114/0').rows.find(x => x.id === 'all-loss').power, 0);
  assert.equal(results.get('20/114/0').rows.find(x => x.id === 'all-tie').power, 0);
  assert.equal(pairedPowerSensitivity({...base, minimumImprovement: 1, scenarios: allGain}).rows[0].power, 0);
});

test('floating underflow is labelled and never reported as proof that an outcome is impossible', () => {
  const result = pairedPowerSensitivity({...base, n: 512, scenarios: [{id: 'underflow',
    probabilities: {gain: .01, loss: 0, tie: 0, unavailable: .99}}]});
  assert.equal(result.rows[0].conditionalPowerGivenAllMeasured, 1);
  assert.equal(result.rows[0].power, 0);
  assert.equal(result.rows[0].allMeasuredProbabilityUnderflow, true);
  assert.equal(result.probabilityZeroIsProofOfImpossibility, false);
});

test('planning output never grants population,English judgment,approval or study-wide success claims', () => {
  for (const result of results.values()) {
    for (const field of ['probabilityZeroIsProofOfImpossibility', 'probabilitiesEstimatedFromConfirmation', 'sampleSizeSelected',
      'iidFamiliesVerified', 'ownerRiskApproved', 'actualEnglishQualityMeasured', 'liveAuthorized', 'releaseEligible']) assert.equal(result[field], false);
    assert.match(result.unit, /aggregate repeats/);
    assert.match(result.scope, /not joint study success/);
  }
});

test('invalid distributions,duplicate scenarios,infinite inputs and unsupported N fail without silent truncation', () => {
  const run = changes => pairedPowerSensitivity({...base, scenarios: allGain, ...changes});
  for (const n of [0, -1, 1.1, Infinity, NaN, '20', MAX_POWER_FAMILIES + 1]) assert.throws(() => run({n}), /POWER_FAMILY_COUNT/);
  for (const minimumImprovement of [-.1, 1.1, NaN, Infinity, '0']) assert.throws(() => run({minimumImprovement}), /POWER_MARGIN/);
  for (const boundCount of [0, 1, 3, 4.5, Infinity]) assert.throws(() => run({boundCount}), /POWER_TAIL_ALLOCATION/);
  for (const familywiseConfidence of [0, 1, NaN, '.95']) assert.throws(() => run({familywiseConfidence}));
  for (const probabilities of [{gain: 1}, {gain: .8, loss: .3, tie: 0, unavailable: 0}, {gain: .8, loss: 0, tie: 0, unavailable: 0},
    {gain: NaN, loss: 0, tie: 0, unavailable: 0}, {gain: -1, loss: 1, tie: 1, unavailable: 0},
    {gain: '1', loss: 0, tie: 0, unavailable: 0}]) assert.throws(() => run({scenarios: [{id: 'bad', probabilities}]}));
  assert.throws(() => run({scenarios: []}), /POWER_SCENARIOS/);
  assert.throws(() => run({scenarios: [...allGain, ...allGain]}), /POWER_SCENARIO_ID/);
});

test.after(() => {
  writeFileSync(resolve(out, 'paired-power-comparison.json'), JSON.stringify({referenceComparisonPassed, scipyVersion: reference.scipyVersion,
    independentPlans: 10, independentRows: 110, decimalExhaustiveRows: 33, maxAbsoluteError, maxRelativeError,
    actualProviderCalls: 0, actualCountApiCalls: 0, ownerRiskApproved: false, sampleJustified: false}, null, 2) + '\n');
  writeFileSync(resolve(out, 'paired-power-sensitivity.json'), JSON.stringify({arithmeticOnly: true,
    scenariosAreIllustrativeNotPilotEstimates: true, results: [...results.values()],
    actualEnglishQualityMeasured: false, sampleJustified: false, actualProviderCalls: 0}, null, 2) + '\n');
});
