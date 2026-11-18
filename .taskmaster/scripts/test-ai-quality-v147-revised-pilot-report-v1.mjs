import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { CRITICAL, DIMENSIONS } from './ai-quality-v147-calibration.mjs';
import { summarizeRehearsedPilotV1 } from './ai-quality-v147-revised-pilot-report-v1.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8'));
const evidence = join(manifest.baseline.existingDashboardRoot, 'outputs/ai-quality-v147-implementation-20261106');
const sha = value => createHash('sha256').update(value).digest('hex');
function readFrozen(name, expected) {
  const raw = readFileSync(join(evidence, name));
  assert.equal(sha(raw), expected);
  return JSON.parse(raw);
}
const handoffSha256 = '37fd2a99771af02d6dee99a5281007d5b2ee5558ddf20392cb33ad3726ac8b68';
const draftSha256 = '74cee048579a4405e8099a1f3a4cca6ed5f880c8b8d08d215a6d074016832b57';
const handoff = readFrozen('phase138/review-handoff.json', handoffSha256);
const { cases } = readFrozen('phase137/pilot-60-replacement-draft.json', draftSha256);
const planned = { handoff, cases };
const visible = handoff.reviewSlots.filter(slot => slot.readyForRehearsal);
const unavailable = handoff.reviewSlots.find(slot => !slot.readyForRehearsal);
const parents = new Map();
for (const slot of visible) {
  const { sourceId } = slot.privateBinding;
  const seats = parents.get(sourceId) ?? [];
  seats.push(slot);
  parents.set(sourceId, seats);
}

function readBody(slot) {
  const body = JSON.parse(slot.requestRaw);
  return { schema: body.text.format.schema, data: JSON.parse(body.input[0].content).EVALUATION_DATA };
}

function syntheticVote(slot, change = () => {}) {
  const { schema, data } = readBody(slot);
  const repair = data.feedback.correctedSentence?.trim();
  const changed = !!repair && repair !== data.input.sentence.trim();
  const vote = {
    grade: { ...Object.fromEntries(DIMENSIONS.map(axis => [axis, 'pass'])),
      criticalErrors: Object.fromEntries(CRITICAL.map(flag => [flag, false])) },
    reasonCodes: ['confirmed'],
    productRubricHash: schema.properties.productRubricHash.enum[0],
    assessmentContextHash: schema.properties.assessmentContextHash.enum[0],
    sourceAdequacy: 'sufficient',
    learnerContext: 'sufficient',
    abstentionNeed: 'not_required',
    repairContext: changed ? 'sufficient' : 'not_applicable',
    assignmentForm: changed ? 'not_specified' : 'not_applicable',
  };
  change(vote);
  return {
    requestId: slot.requestId, requestSha256: slot.requestSha256, model: slot.model, dataClass: 'synthetic',
    state: 'graded', payloadRaw: JSON.stringify(vote),
  };
}

function checkDenominators(report) {
  assert.equal(report.plannedParents, 360);
  assert.equal(report.plannedReviews, 1440);
  assert.deepEqual(report.pairedVisibility, { both: 177, 'candidate-only': 3 });
  assert.equal(report.heldParents, 360);
  assert.equal(report.unmeasuredComparisons, 180);
  assert.equal(report.qualifiedPasses, 0);
  assert.equal(report.releaseVerdict, 'held');
  assert.equal(report.mainDispatchAuthorized, false);
  assert.equal(report.englishQualityMeasured, false);
  assert.equal(report.learnerEfficacyMeasured, false);
  assert.equal(report.actualProviderCalls, 0);
  assert.equal(report.groups.length, 36);
  assert.ok(report.groups.every(group => group.planned === 10 && group.held === 10 && group.qualifiedPasses === 0));
  assert.ok(report.pairs.every(pair => pair.comparison === 'unmeasured'));
}

test('revised frozen rehearsal retains all planned slots when no votes exist', () => {
  const report = summarizeRehearsedPilotV1({ ...planned, captures: [] });
  checkDenominators(report);
  assert.deepEqual(report.voteStates, { missing: 1428, 'no-screen': 12 });
  assert.equal(report.observedUnanimousPasses, 0);
  assert.equal(report.observedUnanimousFailures, 0);
  assert.equal(report.rows.filter(row => row.reasons.includes('no-visible-feedback')).length, 3);
});

test('synthetic votes retain dissent, critical flags, missing seats and invalid payloads separately', () => {
  const [missing, failed, invalid, dissent, critical, uncertain, source, fail] = [...parents.values()];
  const form = [...parents.values()].slice(8).find(([slot]) => {
    const { input, feedback } = readBody(slot).data;
    return feedback.correctedSentence && feedback.correctedSentence.trim() !== input.sentence.trim();
  });
  assert.ok(form);
  const captures = new Map(visible.map(slot => [slot.requestId, syntheticVote(slot)]));
  const get = slot => captures.get(slot.requestId);
  const set = (slot, fn) => captures.set(slot.requestId, syntheticVote(slot, fn));
  captures.delete(missing[0].requestId);
  Object.assign(get(failed[0]), { state: 'failed', payloadRaw: null });
  get(invalid[0]).payloadRaw = '{';
  set(dissent[0], vote => { vote.grade.grammar = 'fail'; });
  set(critical[0], vote => {
    vote.grade.grammar = 'fail';
    vote.grade.criticalErrors.approveBadGrammar = true;
  });
  critical.slice(1).forEach(slot => captures.delete(slot.requestId));
  set(uncertain[0], vote => { vote.grade.grammar = 'uncertain'; });
  set(source[0], vote => { vote.sourceAdequacy = 'insufficient'; });
  fail.forEach(slot => set(slot, vote => { vote.grade.grammar = 'fail'; }));
  form.forEach(slot => set(slot, vote => { vote.assignmentForm = 'uncertain'; }));
  const report = summarizeRehearsedPilotV1({ ...planned, captures: [...captures.values()] });
  checkDenominators(report);
  const rowById = new Map(report.rows.map(row => [row.sourceId, row]));
  const row = slots => rowById.get(slots[0].privateBinding.sourceId);
  for (const slots of [missing, failed, invalid]) assert.ok(row(slots).reasons.includes('incomplete-review'));
  assert.ok(row(dissent).reasons.includes('disagreement'));
  assert.ok(row(uncertain).reasons.includes('uncertain-grade'));
  assert.ok(row(source).reasons.includes('insufficient-review-source'));
  assert.ok(row(source).reasons.includes('disagreement'));
  assert.ok(row(form).reasons.includes('uncertain-assignment-form'));
  assert.equal(row(form).observedUnanimity, null);
  assert.deepEqual(row(critical).critical, ['approveBadGrammar']);
  assert.ok(row(critical).reasons.includes('critical-flag') && row(critical).reasons.includes('incomplete-review'));
  assert.equal(row(fail).observedUnanimity, 'unanimous-fail');
  const saved = row(critical).votes.find(vote => vote.requestId === critical[0].requestId);
  assert.equal(saved.payloadSha256, sha(get(critical[0]).payloadRaw));
  assert.equal(saved.grade.criticalErrors.approveBadGrammar, true);
  assert.deepEqual(report.voteStates, { missing: 4, graded: 1422, failed: 1, invalid: 1, 'no-screen': 12 });
  assert.equal(report.criticalParents, 1);
  assert.equal(report.dissentingParents, 3);
  assert.equal(report.observedUnanimousPasses, 348);
  assert.equal(report.observedUnanimousFailures, 1);
  if (process.env.QA_OUTPUT_DIR) {
    const { groups, pairs, rows, ...summary } = report;
    const out = process.env.QA_OUTPUT_DIR;
    const payloads = [...captures.values()];
    const rawVotes = JSON.stringify(payloads) + '\n';
    const reportRaw = JSON.stringify({ ...summary, groups, pairs, rows }) + '\n';
    writeFileSync(join(out, 'synthetic-votes.json'), rawVotes, { flag: 'wx' });
    writeFileSync(join(out, 'synthetic-report.json'), reportRaw, { flag: 'wx' });
    const audit = { ...summary, handoffSha256, draftSha256, syntheticVotesSha256: sha(rawVotes),
      syntheticReportSha256: sha(reportRaw), unsubmittedReviewStates: { missing: 1428, 'no-screen': 12 } };
    writeFileSync(join(out, 'report-audit.json'), JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
  }
});

test('rejects swapped, duplicated, unplanned and no-screen captures and different parent receipts', () => {
  const capture = syntheticVote(visible[0]);
  assert.throws(() => summarizeRehearsedPilotV1({ ...planned, captures: [capture, capture] }), /Duplicate review capture/);
  assert.throws(() => summarizeRehearsedPilotV1({ ...planned,
    captures: [{ ...capture, requestSha256: '0'.repeat(64) }] }), /capture body changed/);
  assert.throws(() => summarizeRehearsedPilotV1({ ...planned,
    captures: [{ ...capture, model: visible[0].privateBinding.generatorId }] }), /capture model changed/);
  assert.throws(() => summarizeRehearsedPilotV1({ ...planned,
    captures: [{ ...capture, requestId: 'unplanned' }] }), /Unplanned review capture/);
  assert.throws(() => summarizeRehearsedPilotV1({ ...planned,
    captures: [{ ...capture, requestId: unavailable.requestId, model: unavailable.model,
      requestSha256: unavailable.requestSha256 }] }), /no visible screen/);
  const reviewSlots = [...handoff.reviewSlots];
  const slot = reviewSlots[1];
  reviewSlots[1] = { ...slot, privateBinding: { ...slot.privateBinding, parentReceiptHash: '0'.repeat(64) } };
  assert.throws(() => summarizeRehearsedPilotV1({ handoff: { ...handoff, reviewSlots }, cases, captures: [] }),
    /different parent receipt/);
});
