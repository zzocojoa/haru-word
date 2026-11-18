import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {MODELS} from './ai-quality-v147-budget.mjs';
import {exactCriticalUpper} from './ai-quality-v147-report.mjs';
import {CONFIRMATORY_STRATA, confirmationBounds, tailConfidence, zeroEventFamilies, pairedEffect, confirmationCalls, riskPlanningOption} from './ai-quality-v147-risk-design.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(HERE, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8'));
const SOURCE = resolve(manifest.baseline.sourceRoot);
const reference = JSON.parse(readFileSync(resolve(SOURCE, '.taskmaster/evaluation/ai-quality-v147/risk-design-reference.json'), 'utf8'));
const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(SOURCE, 'work', 'risk-design-' + randomUUID())); mkdirSync(out, {recursive: true});
let maxError = 0;
const close = (a, b) => { const e = Math.abs(a - b); maxError = Math.max(maxError, e); assert.ok(e < 1e-10, `${a} versus ${b}`); };

test('zero errors in60 leaves a positive one-sided upper risk,not proof of zero future risk', () => {
  close(exactCriticalUpper(0, 60, .95), reference.n60ZeroErrorUpper95);
  assert.ok(reference.n60ZeroErrorUpper95 > .048 && reference.n60ZeroErrorUpper95 < .049);
  assert.ok(exactCriticalUpper(0, 60, tailConfidence(.95, 114)) > .12);
});

test('all114 finite bound statements are predeclared with actual three model IDs and no pooled stratum claims', () => {
  const bounds = confirmationBounds(); assert.equal(bounds.length, 114);
  assert.equal(new Set(bounds.map(x => [x.stratum, x.endpoint, x.model, x.tail].join('/'))).size, 114);
  for (const stratum of CONFIRMATORY_STRATA) {
    const b = bounds.filter(x => x.stratum === stratum); assert.equal(b.length, 19);
    assert.equal(b.filter(x => x.endpoint === 'any-model-critical').length, 1);
    for (const model of MODELS) assert.equal(b.filter(x => x.model === model).length, 6);
  }
  bounds[0].stratum = 'changed'; assert.notEqual(confirmationBounds()[0].stratum, 'changed');
});

test('zero-event family sizes match54 independent SciPy searches,with conservative equality boundaries', () => {
  assert.equal(reference.zeroSamples.length, 54);
  for (const item of reference.zeroSamples) {
    const sample = zeroEventFamilies(item);
    if (sample.n !== item.n) {
      assert.equal(sample.n, item.n + 1); assert.equal(sample.numericBoundaryGuard, true);
      close(sample.upperAtPrevious, item.maximumRisk);
    } else { close(sample.upperAtZero, item.upperAtZero); if (item.upperAtPrevious !== null) close(sample.upperAtPrevious, item.upperAtPrevious); }
    assert.ok(sample.upperAtZero < item.maximumRisk); assert.ok(sample.upperAtPrevious === null || sample.upperAtPrevious > item.maximumRisk || sample.numericBoundaryGuard);
    assert.equal(sample.zeroEventDesignOnly, true); assert.equal(sample.powerGuaranteed, false);
  }
});

test('paired interval matches56 independent gain/loss tail references including zeros and extreme discordance', () => {
  assert.equal(reference.pairedIntervals.length, 56);
  for (const item of reference.pairedIntervals) {
    // A standalone95% tail is an80% four-tail simultaneous allocation,not95%.
    const request = item.boundCount === 1 ? {...item, familywiseConfidence: .8, boundCount: 4} : item;
    const result = pairedEffect(request); close(result.lower, item.lower); close(result.upper, item.upper);
    for (const which of ['gain', 'loss']) for (const tail of ['lower', 'upper']) close(result[which][tail], item[which][tail]);
    assert.ok(result.lower <= result.estimate && result.upper >= result.estimate);
    assert.equal(result.samplingVerified, false); assert.equal(result.releaseEligible, false);
  }
});

test('all-tied perfect baseline and candidate cannot establish positive improvement', () => {
  const result = pairedEffect({n: 60, gains: 0, losses: 0, familywiseConfidence: .95, boundCount: 114});
  assert.equal(result.estimate, 0); assert.ok(result.lower < 0 && result.upper > 0);
  const inverse = pairedEffect({n: 120, gains: 3, losses: 12, familywiseConfidence: .95, boundCount: 114});
  const direct = pairedEffect({n: 120, gains: 12, losses: 3, familywiseConfidence: .95, boundCount: 114});
  close(direct.lower, -inverse.upper); close(direct.upper, -inverse.lower);
});

test('word substitutions,repetitions,models and phases increase calls but never independent family counts', () => {
  const x = confirmationCalls({familiesPerStratum: [2, 3, 4, 5, 6, 7], variantsPerFamily: 2, repetitions: 3, calibrationCalls: 36});
  assert.equal(x.independentFamilyUnits, 27); assert.equal(x.caseTexts, 54);
  assert.equal(x.generation, 54 * 3 * 3 * 2); assert.equal(x.mainJudge, x.generation);
  assert.equal(x.confirmationMaximum, 1980); assert.equal(x.maximumAcrossListedStages, 2742);
  assert.equal(x.priorPilotMaximumSeparate, 756); assert.equal(x.productionGenerationSeparate, 6);
  assert.equal(x.dispatchAuthorized, false); assert.equal(x.monetaryBudgetApproved, false);
});

test('stricter risk or more comparisons requires at least as many families; repeated output is not a sample-size discount', () => {
  const input = {maximumRisk: .01, familywiseConfidence: .95, boundCount: 114};
  const a = zeroEventFamilies(input), b = zeroEventFamilies({...input, maximumRisk: .005}), c = zeroEventFamilies({...input, boundCount: 1});
  assert.ok(b.n > a.n && a.n > c.n);
  const once = riskPlanningOption({maximumCriticalRisk: .01, repetitions: 1}), twice = riskPlanningOption({maximumCriticalRisk: .01, repetitions: 2});
  assert.equal(once.sample.n, twice.sample.n); assert.equal(twice.costs.generation, once.costs.generation * 2);
});

test('draft sensitivity options expose precision-only N and every outstanding claim/approval hold', () => {
  const options = [.05, .01, .005].map(maximumCriticalRisk => riskPlanningOption({maximumCriticalRisk}));
  for (const option of options) {
    assert.equal(option.status, 'draft-not-approved'); assert.equal(option.fixedMaximumLooks, 1); assert.equal(option.extendSampleAfterOutcomesAllowed, false);
    for (const key of ['designApproved', 'sampleJustifiedForRealCorpus', 'iidFamiliesVerified', 'actualModelQualityMeasured']) assert.equal(option[key], false);
    assert.equal(option.proposedOtherCriteria.minimumPairedImprovement, null);
  }
  writeFileSync(resolve(out, 'risk-options.json'), JSON.stringify({arithmeticOnly: true, actualProviderCalls: 0, options}, null, 2) + '\n');
});

test('invalid confidence,risk,integer sample,discordant counts and overflow fail before any authorization', () => {
  for (const bad of [0, 1, -1, Infinity, NaN, '.95']) assert.throws(() => tailConfidence(bad, 114));
  for (const bad of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => tailConfidence(.95, bad));
  for (const bad of [0, 1, -1, Infinity, NaN, '0.01', Number.MIN_VALUE]) assert.throws(() => zeroEventFamilies({maximumRisk: bad, familywiseConfidence: .95, boundCount: 114}));
  for (const [n, gains, losses] of [[0, 0, 0], [1.1, 0, 0], [10, -1, 1], [10, 6, 5], [10, .5, 0]]) assert.throws(() => pairedEffect({n, gains, losses, familywiseConfidence: .95, boundCount: 114}));
  for (const boundCount of [1, 2, 3]) assert.throws(() => pairedEffect({n: 60, gains: 0, losses: 0, familywiseConfidence: .95, boundCount}), /RISK_PAIR_TAIL_ALLOCATION/);
  for (const familyCounts of [[], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 0], Array(6).fill(Number.MAX_SAFE_INTEGER)]) assert.throws(() => confirmationCalls({familiesPerStratum: familyCounts, variantsPerFamily: 1, repetitions: 2, calibrationCalls: 36}));
});

test.after(() => { writeFileSync(resolve(out, 'independent-risk-comparison.json'), JSON.stringify({scipyVersion: reference.scipyVersion, zeroSampleReferences: 54, pairedReferences: 56, n60ZeroErrorUpper95: reference.n60ZeroErrorUpper95, largestAbsoluteError: maxError, actualProviderCalls: 0, riskDesignApproved: false}, null, 2) + '\n'); });
