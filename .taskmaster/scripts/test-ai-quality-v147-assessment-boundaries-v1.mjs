import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ASSESSMENT_CONTEXT_HASH_V1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { compileAssessmentBoundariesV1, parseAssessmentBoundariesV1 } from './ai-quality-v147-assessment-boundaries-v1.mjs';
import { inspectAssessmentBoundaryContrastV1, prepareAssessmentBoundaryContrastV1 } from './ai-quality-v147-assessment-boundary-contrast-v1.mjs';
import { meaningContrastBudgetV1 } from './ai-quality-v147-meaning-contrast-v1.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const evidence = resolve(manifest.baseline.existingDashboardRoot, 'outputs/ai-quality-v147-implementation-20261106');
const prepared = prepareAssessmentBoundaryContrastV1(evidence);
const { plan } = prepared;

function payload(request) {
  const row = plan.cases.find(x => x.id === request.caseId);
  const { repairContext, assignmentForm, ...before } = structuredClone(row.expected);
  return { ...before, ...(request.version === 8 ? { repairContext, assignmentForm } : {}), reasonCodes: ['confirmed'],
    productRubricHash: plan.rubricHashes[request.version], assessmentContextHash: ASSESSMENT_CONTEXT_HASH_V1 };
}

const candidate = id => plan.requests.find(x => x.caseId === id && x.version === 8);
const parse = (request, value = payload(request)) => parseAssessmentBoundariesV1({ ...request, payloadRaw: JSON.stringify(value) });

test('All 18 pairs keep the same evidence, output limit and model and hide the expected result', () => {
  assert.equal(plan.cases.length, 6);
  assert.equal(new Set(plan.cases.map(x => x.family)).size, 3);
  assert.equal(new Set(plan.requests.map(x => x.key)).size, 36);
  for (const request of plan.requests.filter(x => x.version === 8)) {
    const old = plan.requests.find(x => x.key === request.key.replace(/v8$/, 'v7'));
    const before = JSON.parse(old.requestRaw), after = JSON.parse(request.requestRaw);
    assert.equal(after.max_output_tokens, 1024);
    assert.equal(request.layout, old.layout);
    assert.equal(after.input[0].content, before.input[0].content);
    assert.doesNotMatch(after.input[0].content, /expectedGrade|expectedEvidenceAxes|time-open|object-repair|form-excluded/);
    assert.deepEqual(JSON.parse(request.countRequestRaw), Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, after[key]])));
    for (const key of ['instructions', 'text']) after[key] = before[key];
    assert.deepEqual(after, before);
  }
  assert.equal(plan.liveDispatchAuthorized, false);
  assert.equal(plan.isConfirmationHoldout, false);
});

test('A known grammar defect stays known when the same repair chooses an unprovided time', () => {
  const open = parse(candidate('time-open')), explicit = parse(candidate('time-specified'));
  assert.deepEqual([open.grade.grammar, explicit.grade.grammar], ['pass', 'pass']);
  assert.deepEqual([open.repairContext, explicit.repairContext], ['missing', 'sufficient']);
  assert.deepEqual([open.grade.correction, explicit.grade.correction], ['uncertain', 'pass']);
  assert.deepEqual([open.abstentionNeed, explicit.abstentionNeed], ['required', 'not_required']);
});

test('A false claim can fail grammar without grading a replacement the product never offered', () => {
  const falseApproval = parse(candidate('object-approval')), repair = parse(candidate('object-repair'));
  assert.equal(falseApproval.repairContext, 'not_applicable');
  assert.equal(falseApproval.grade.criticalErrors.approveBadGrammar, true);
  assert.deepEqual([falseApproval.grade.grammar, falseApproval.learnerContext, falseApproval.abstentionNeed], ['fail', 'sufficient', 'not_required']);
  assert.deepEqual([repair.grade.grammar, repair.repairContext], ['pass', 'sufficient']);
});

test('The same imperative can comply with one task and violate another while grammar stays fixed', () => {
  const allowed = parse(candidate('form-permitted')), excluded = parse(candidate('form-excluded'));
  assert.deepEqual([allowed.grade.grammar, excluded.grade.grammar], ['pass', 'pass']);
  assert.deepEqual([allowed.assignmentForm, excluded.assignmentForm], ['complies', 'violates']);
  assert.deepEqual([allowed.grade.correction, excluded.grade.correction], ['pass', 'fail']);
});

test('Policy tampering, invented repair metadata and internally contradictory grades are rejected', () => {
  const open = candidate('time-open'), approval = candidate('object-approval'), excluded = candidate('form-excluded');
  assert.throws(() => parse({ ...open, requestRaw: open.requestRaw + ' ' }), /AB1_REQUEST_BINDING/);
  assert.throws(() => parse(open, { ...payload(open), repairContext: 'not_applicable' }), /AB1_SHOWN_REPAIR/);
  assert.throws(() => parse(open, { ...payload(open), grade: { ...payload(open).grade, correction: 'pass' } }), /AB1_MISSING_REPAIR_CONTEXT/);
  assert.throws(() => parse(approval, { ...payload(approval), repairContext: 'missing' }), /AB1_NO_REPAIR/);
  assert.throws(() => parse(excluded, { ...payload(excluded), grade: { ...payload(excluded).grade, correction: 'pass' } }), /AB1_ASSIGNMENT_REPAIR_CONFLICT/);
});

test('Unavailable feedback remains unavailable in the new axes', () => {
  const old = candidate('object-approval');
  const body = JSON.parse(old.baseRequestRaw), data = JSON.parse(body.input[0].content);
  data.EVALUATION_DATA.feedback = null;
  body.input[0].content = JSON.stringify(data);
  const baseRequestRaw = JSON.stringify(body);
  const { requestRaw } = compileAssessmentBoundariesV1(baseRequestRaw);
  const value = payload(old);
  for (const key of Object.keys(value.grade)) if (key !== 'criticalErrors') value.grade[key] = 'unavailable';
  value.grade.criticalErrors.approveBadGrammar = false;
  Object.assign(value, { sourceAdequacy: 'not_applicable', learnerContext: 'unavailable', abstentionNeed: 'unavailable', repairContext: 'unavailable', assignmentForm: 'unavailable' });
  assert.equal(parseAssessmentBoundariesV1({ baseRequestRaw, requestRaw, payloadRaw: JSON.stringify(value) }).assignmentForm, 'unavailable');
});

test('The fixed denominator and budget bound reject gaps and the scorer preserves regressions', () => {
  const records = plan.requests.map(request => ({ ...request, payloadRaw: JSON.stringify(payload(request)) }));
  const pass = inspectAssessmentBoundaryContrastV1(prepared, records);
  assert.deepEqual([pass.candidatePasses, pass.improvements, pass.regressions, pass.diagnosticImprovement], [18, 0, 0, false]);
  assert.equal(pass.sourceQualified, false);
  assert.throws(() => inspectAssessmentBoundaryContrastV1(prepared, records.slice(1)), /ABC1_DENOMINATOR/);
  const index = records.findIndex(x => x.version === 8 && x.caseId === 'time-open');
  const worse = payload(records[index]);
  worse.grade.grammar = 'uncertain';
  const changed = records.with(index, { ...records[index], payloadRaw: JSON.stringify(worse) });
  assert.equal(inspectAssessmentBoundaryContrastV1(prepared, changed).regressions, 1);
  assert.equal(prepared.upper.totalMicros, '4283592');
  const counts = plan.requests.map(request => ({ ...request, inputTokens: 8000 }));
  assert.throws(() => meaningContrastBudgetV1(prepared, [{ ...counts[0], inputTokens: 8001 }, ...counts.slice(1)]), /MC1_INPUT_BOUND/);
});
