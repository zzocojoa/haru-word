import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {aggregateFamilyPairsV1, FAMILY_PAIR_RULE_V1} from './ai-quality-v147-family-pairs-v1.mjs';
import {inspectSyntheticFamilyPairsV1} from './ai-quality-v147-family-readback-v1.mjs';
import {reportEvaluation} from './ai-quality-v147-report.mjs';
import {digest, DIMENSIONS, CRITICAL} from './ai-quality-v147-calibration.mjs';
import {MODELS_V3, PLAN_V3} from './ai-quality-v147-budget-v3.mjs';
import {panelFixtureV3, responseEnvelopeV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {createV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openSyntheticPanelExecutorV3} from './ai-quality-v147-panel-executor-v3.mjs';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(HERE, '.taskmaster/docs/ai-quality-v147-manifest.json'), 'utf8'));
const ROOT = resolve(manifest.baseline.existingDashboardRoot), SOURCE = resolve(manifest.baseline.sourceRoot);
const OUT = resolve(process.env.QA_OUTPUT_DIR ?? resolve(SOURCE, 'work', 'family-pairs-' + randomUUID()));
mkdirSync(OUT, {recursive: true});
const arithmetic = {familywiseConfidence: .95, boundCount: 114, minimumImprovement: 0};
const good = () => ({...Object.fromEntries(DIMENSIONS.map(k => [k, 'pass'])), criticalErrors: Object.fromEntries(CRITICAL.map(k => [k, false]))});
const cases = () => [1, 2].map(i => ({id: 'variant-' + i, familyId: 'same-family', domain: 'word', stratum: 'normal'}));
function fixture(repetitions = 2) {
  const c = cases(), observations = [];
  for (const phase of ['baseline', 'candidate']) for (const modelId of MODELS_V3) for (const x of c) for (let repetition = 1; repetition <= repetitions; repetition++) {
    const identity = {phase, modelId, caseId: x.id, repetition};
    observations.push({...identity, rowId: digest(identity), evidenceHash: digest({capture: identity}), assessment: 'pass', critical: false});
  }
  return {cases: c, repetitions, observations, ...arithmetic};
}
const cell = (f, phase, caseId = 'variant-1', repetition = 1, modelId = MODELS_V3[0]) => f.observations.find(r => r.phase === phase && r.caseId === caseId && r.repetition === repetition && r.modelId === modelId);
const group = (r, model = MODELS_V3[0]) => r.groups.find(g => g.stratum === 'word.normal' && g.modelId === model);
const unit = (r, model = MODELS_V3[0]) => r.units.find(g => g.modelId === model);
const save = (name, x) => writeFileSync(resolve(OUT, name + '.json'), JSON.stringify(x, null, 2) + '\n');
function tree(root) {
  const files = {};
  function visit(dir, prefix = '') { for (const d of readdirSync(dir, {withFileTypes: true})) {
    const relative = prefix + d.name, file = join(dir, d.name);
    if (d.isDirectory()) visit(file, relative + '/');
    else files[relative] = createHash('sha256').update(readFileSync(file)).digest('hex');
  } }
  visit(root); return files;
}

test('old case×repeat denominator4 contrasts with one family,without rewriting the historical report', () => {
  const f = fixture(); cell(f, 'baseline').assessment = 'fail';
  const d = {schemaVersion: 1, planId: PLAN_V3, runId: randomUUID(), protocolHash: digest('synthetic-only'), evaluationKind: 'confirmation', dataClass: 'synthetic',
    modelIds: [...MODELS_V3], phases: ['baseline', 'candidate'], phaseSeals: {baseline: digest('baseline'), candidate: digest('candidate')},
    repetitions: 2, cases: f.cases, risk: {confidenceLevel: .95, samplingModel: 'unverified', assumptionEvidenceHash: null, criterionStatus: 'unapproved', approvalEvidenceHash: null, maximumCriticalRisk: .05}};
  const records = f.observations.map(o => {
    const rawGrade = good(); if (o.assessment === 'fail') rawGrade.grammar = 'fail';
    return {designHash: digest(d), phase: o.phase, modelId: o.modelId, caseId: o.caseId, repetition: o.repetition, sourceHash: d.phaseSeals[o.phase], generationState: 'completed', appState: 'accepted', visibleAction: 'answer', judgeState: 'completed', judgeModelId: MODELS_V3[(MODELS_V3.indexOf(o.modelId) + 1) % 3], rawGrade, evidenceHash: o.evidenceHash, diagnosticHash: null};
  });
  const old = reportEvaluation({design: d, records}), result = aggregateFamilyPairsV1(f);
  assert.equal(old.comparisons[MODELS_V3[0]].raw.denominator, 4);
  assert.equal(result.plannedFamilyLabels, 1); assert.equal(result.plannedGenerationCells, 24);
  assert.equal(result.plannedModelFamilyComparisons, 3); assert.equal(group(result).plannedFamilies, 1);
  assert.deepEqual(group(result).counts, {gain: 1, loss: 0, tie: 0, unavailable: 0});
  assert.equal(group(result).interval.n, 1); assert.equal(result.releaseEligible, false);
  save('denominator-contrast', {oldCellDenominator: 4, newFamilyDenominator: 1, result, historicalReportChanged: false});
});

test('opposing variant changes remain a both-fail tie plus explicit gains/losses,never a hidden regression', () => {
  const f = fixture(1); cell(f, 'baseline').assessment = 'fail'; cell(f, 'candidate', 'variant-2').assessment = 'fail';
  const r = aggregateFamilyPairsV1(f), u = unit(r), g = group(r);
  assert.equal(u.category, 'tie'); assert.equal(g.tiesBothFail, 1); assert.equal(g.mixedChangeFamilies, 1);
  assert.equal(g.cellGains, 1); assert.equal(g.cellLosses, 1); assert.equal(r.cellRegressionObserved, true);
  assert.equal(g.counts.gain, 0); assert.equal(g.counts.loss, 0); save('mixed-changes', r);
});

test('one absent planned repeat keeps the whole pair unavailable and all planned families in n', () => {
  const f = fixture(), absent = cell(f, 'candidate', 'variant-2', 2); f.observations.splice(f.observations.indexOf(absent), 1);
  const observed = cell(f, 'candidate'); observed.assessment = 'fail'; observed.critical = true;
  const r = aggregateFamilyPairsV1(f), u = unit(r), g = group(r);
  assert.equal(g.plannedFamilies, 1); assert.equal(g.counts.unavailable, 1); assert.equal(g.interval, null);
  assert.equal(g.intervalUnavailableReason, 'unmeasured-family'); assert.equal(u.candidate.missingRecords, 1);
  assert.equal(u.candidate.status, 'unavailable'); assert.equal(r.candidateCriticalObserved, true);
  assert.equal(r.allPairsAssessed, false); save('missing-and-critical', r);
});

test('ties both pass and both fail are distinct;an explicit unavailable assessment is not an English fail', () => {
  const f = fixture(1); cell(f, 'baseline').assessment = 'fail'; cell(f, 'candidate').assessment = 'fail';
  let r = aggregateFamilyPairsV1(f); assert.equal(group(r).tiesBothFail, 1); assert.equal(group(r, MODELS_V3[1]).tiesBothPass, 1);
  cell(f, 'baseline').assessment = 'unavailable'; r = aggregateFamilyPairsV1(f);
  assert.equal(group(r).counts.unavailable, 1); assert.equal(group(r).counts.loss, 0); assert.equal(group(r).counts.gain, 0);
});

test('within-case repeat flips are retained but variant differences are not labelled as repeat flips', () => {
  const a = fixture(1); cell(a, 'baseline').assessment = 'fail'; assert.equal(unit(aggregateFamilyPairsV1(a)).baseline.observedRepeatFlip, false);
  const b = fixture(2); cell(b, 'baseline').assessment = 'fail'; assert.equal(unit(aggregateFamilyPairsV1(b)).baseline.observedRepeatFlip, true);
});

test('empty and unplanned strata stay explicit;models and missing rows never become extra independent families', () => {
  const f = fixture(); f.observations = []; const r = aggregateFamilyPairsV1(f);
  assert.equal(r.groups.length, 18); assert.equal(r.plannedFamilyLabels, 1); assert.equal(r.plannedModelFamilyComparisons, 3);
  assert.equal(group(r).counts.unavailable, 1); assert.equal(group(r).interval, null);
  const empty = r.groups.find(g => g.stratum === 'grammar.normal'); assert.equal(empty.plannedFamilies, 0); assert.equal(empty.intervalUnavailableReason, 'no-planned-families');
});

test('duplicate captures/cells,extra models/cases/repeats and cross-stratum family reuse fail closed', () => {
  let f = fixture(); f.cases[1].stratum = 'needsCorrection'; assert.throws(() => aggregateFamilyPairsV1(f), /FAMILY_STRATUM_DRIFT/);
  f = fixture(); f.observations.push(structuredClone(f.observations[0])); assert.throws(() => aggregateFamilyPairsV1(f), /DUPLICATE_CELL/);
  f = fixture(); f.observations[1].evidenceHash = f.observations[0].evidenceHash; assert.throws(() => aggregateFamilyPairsV1(f), /DUPLICATE_EVIDENCE/);
  for (const change of [{modelId: 'other'}, {caseId: 'absent'}, {repetition: 3}, {assessment: 'unknown'}, {assessment: 'pass', critical: true}, {evidenceHash: null}]) {
    f = fixture(); Object.assign(f.observations[0], change); assert.throws(() => aggregateFamilyPairsV1(f));
  }
  for (const repetitions of [0, 1.5, Infinity]) assert.throws(() => aggregateFamilyPairsV1({...fixture(), repetitions}));
});

test('pure arithmetic preserves its inputs and never certifies family independence,English truth or approval', () => {
  const f = fixture(), before = digest(f), r = aggregateFamilyPairsV1(f); assert.equal(digest(f), before);
  assert.equal(r.ruleHash, digest(FAMILY_PAIR_RULE_V1)); assert.equal(Object.isFrozen(FAMILY_PAIR_RULE_V1), true);
  const namespaced = fixture(); namespaced.cases.forEach(c => { c.familyId = 'word:normal/related.' + 'x'.repeat(110); });
  assert.equal(aggregateFamilyPairsV1(namespaced).plannedFamilyLabels, 1);
  for (const k of ['independentFamilySamplingVerified', 'familyLabelsProveIndependence', 'probabilitiesFromQualifiedPilot', 'ownerRuleApproved', 'actualEnglishQualityMeasured', 'sourceProvenanceVerified', 'releaseEligible']) assert.equal(r[k], false);
});

test('1872-slot historical replay respects its bound runtime;valid replay retains dissent and never changes files',{timeout:180000}, () => {
  const root = resolve(ROOT, 'outputs/ai-quality-v147-implementation-20261106/phase25/node22-final/full-main');
  const b = JSON.parse(readFileSync(resolve(root, 'bundle.json'), 'utf8')), before = tree(root);
  const options = {context: {allowedRoot: root, directory: resolve(root, 'v3-' + b.spec.runId), spec: b.spec}, seal: b.seal, observeCurrent: () => b.current, reportInputs: b.reportInputs, arithmetic};
  if (b.current.environment.nodeVersion !== process.version) {
    assert.throws(() => inspectSyntheticFamilyPairsV1(options), /R3_PHYSICAL_CAPTURE_REQUIRED/);
    assert.deepEqual(tree(root), before);
    save('historical-runtime-mismatch-held', {historicalTreeHash: digest(before), historicalFilesUnchanged: true,
      boundNodeVersion: b.current.environment.nodeVersion, actualNodeVersion: process.version,
      runtimeGuardPreserved: true, actualProviderCalls: 0});
    return;
  }
  const r = inspectSyntheticFamilyPairsV1(options);
  assert.deepEqual(tree(root), before); assert.equal(r.noDispatchPerformed, true);
  assert.equal(r.physicalCaptureReadbackVerified, true); assert.equal(r.plannedGenerationCells, 360);
  assert.equal(r.plannedFamilyLabels, 60); assert.equal(r.plannedModelFamilyComparisons, 180);
  assert.equal(r.units.filter(u => u.category === 'unavailable').length, 1);
  assert.equal(r.collection.originalPanelCounts['held-disagreement'], 1);
  assert.equal(r.collection.originalPanelCounts['ai-consensus-pass'], 359);
  assert.equal(r.collection.closed, true); assert.equal(r.collection.collectionComplete, true);
  assert.equal(r.liveEvaluationReady, false); assert.equal(r.actualProviderCalls, 0); assert.equal(r.actualKeyReads, 0);
  save('historical-physical-replay', {historicalTreeHash: digest(before), historicalFiles: Object.keys(before).length, historicalFilesUnchanged: true, result: r});
});

test('owned physical102-slot capture handles unanimous critical fail and dissent separately;tamper holds without sends',{timeout:180000}, async () => {
  const root = resolve(OUT, 'owned-physical'); mkdirSync(root); const b = panelFixtureV3();
  for (const d of b.spec.requests.filter(d => d.role === 'review')) {
    const baselineCritical = d.generatorId === MODELS_V3[0] && d.phase === 'baseline';
    const candidateCritical = d.generatorId === MODELS_V3[1] && d.phase === 'candidate';
    const candidateDissent = d.generatorId === MODELS_V3[2] && d.phase === 'candidate' && d.modelId === MODELS_V3[0] && d.layout === 'input-first';
    if (baselineCritical || candidateCritical || candidateDissent) {
      const v = JSON.parse(b.responses[d.key]); v.grade.meaning = 'fail'; v.grade.criticalErrors.reverseMeaning = true; v.reasonCodes = ['meaning_preservation']; b.responses[d.key] = JSON.stringify(v);
    }
  }
  const context = {allowedRoot: root, directory: resolve(root, 'v3-' + b.spec.runId), spec: b.spec}; createV3Journal(context, b.approval);
  let sends = 0; const options = {context, seal: b.seal, observeCurrent: () => b.current, reportInputs: b.reportInputs};
  const e = openSyntheticPanelExecutorV3({...options, readWire: k => b.wires[k], transport: async ({key}) => { sends++; return {status: 200, contentType: 'application/json', responseRaw: responseEnvelopeV3(b, key)}; }});
  const collected = await e.collect(); e.release(); assert.equal(collected.sent, 102); assert.equal(sends, 102);
  const before = tree(root), r = inspectSyntheticFamilyPairsV1({...options, arithmetic}); assert.deepEqual(tree(root), before);
  assert.equal(unit(r, MODELS_V3[0]).category, 'gain'); assert.equal(unit(r, MODELS_V3[1]).category, 'loss');
  assert.equal(unit(r, MODELS_V3[2]).category, 'unavailable'); assert.equal(r.candidateCriticalObserved, true);
  assert.equal(r.collection.originalPanelHeld, true); assert.equal(r.qualificationHoldsLifted, false); assert.equal(r.releaseEligible, false);
  save('owned-physical-readback', {syntheticDispatches: sends, result: r});
  const response = readdirSync(resolve(root, 'v3-' + b.spec.runId + '-captures')).find(x => x.endsWith('.response.txt'));
  const path = resolve(root, 'v3-' + b.spec.runId + '-captures', response), original = readFileSync(path);
  writeFileSync(resolve(root, 'original-response.txt'), original); writeFileSync(path, Buffer.concat([original, Buffer.from(' ')]));
  assert.throws(() => inspectSyntheticFamilyPairsV1({...options, arithmetic})); assert.equal(sends, 102);
  save('tamper-held', {physicalTamperRejected: true, sendsAfterReadback: 0, syntheticDispatchesBeforeTamper: sends, providerCalls: 0});
});

test('evaluation mode and arithmetic metadata overrides are rejected before physical access', () => {
  let touched = false; const options = {context: {spec: {mode: 'evaluation', profile: {stage: 'pilot-panel'}}}, observeCurrent: () => { touched = true; throw Error('unexpected'); }, arithmetic};
  assert.throws(() => inspectSyntheticFamilyPairsV1(options), /SYNTHETIC_PILOT_ONLY/); assert.equal(touched, false);
  options.context.spec.mode = 'synthetic'; options.arithmetic = {...arithmetic, observations: []};
  assert.throws(() => inspectSyntheticFamilyPairsV1(options), /ARITHMETIC_FIELDS/); assert.equal(touched, false);
});
