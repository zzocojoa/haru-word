import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CRITICAL, JUDGES, digest, sameGrade } from './ai-quality-v147-calibration.mjs';
import { MAIN_RUBRIC_HASH_V8, quoteMainCalibrationV8 } from './ai-quality-v147-main-panel-v8.mjs';
import { validateProductGradeV2 } from './ai-quality-v147-product-rubric-v2.mjs';
import { parseV3Json, validateV3Output } from './ai-quality-v147-wire-v3.mjs';

const protocol = 'ai-quality-v147-rendered-calibration-v1';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const check = (ok, code) => { if (!ok) throw new Error('RC1_' + code); };
const axisKeys = ['sourceAdequacy', 'learnerContext', 'abstentionNeed', 'repairContext', 'assignmentForm'];
const prefix = '\nFor this comparison, feedback contains only learner-visible content.';
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];

function pinned(file, hash) {
  const raw = readFileSync(file);
  check(sha(raw) === hash, 'EVIDENCE');
  return JSON.parse(raw);
}

export function projectRenderedCalibrationSlot(slot, feedback, screenInstructions) {
  const body = parseV3Json(slot.requestRaw, 131072);
  const input = parseV3Json(body.input[0].content);
  const data = input.EVALUATION_DATA;
  const before = data.feedback;
  check(sha(slot.requestRaw) === slot.requestSha256 && slot.kind === 'calibration' &&
    body.model === slot.model && body.text.format.schema.properties.productRubricHash.enum[0] === MAIN_RUBRIC_HASH_V8, 'SLOT');
  check(typeof screenInstructions === 'string' && screenInstructions.startsWith(prefix), 'SCREEN_INSTRUCTIONS');
  check((before === null) === (feedback === null), 'AVAILABILITY');
  if (feedback !== null) {
    check(feedback && Object.keys(feedback).sort().join(',') === 'correctedSentence,explanation,headings' &&
      Array.isArray(feedback.headings) && feedback.headings.length >= 2 && feedback.headings.every(x => typeof x === 'string' && x.length > 0) &&
      typeof feedback.explanation === 'string' && feedback.explanation.length > 0 &&
      before.original === data.input.sentence && (before.correctedSentence || null) === feedback.correctedSentence, 'SCREEN_SHAPE');
  }
  data.feedback = feedback;
  body.input[0].content = JSON.stringify(input);
  body.instructions += screenInstructions;
  const requestRaw = JSON.stringify(body);
  const countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(key => [key, body[key]])));
  check(Buffer.byteLength(requestRaw) <= 131072, 'REQUEST_SIZE');
  return { ...slot, legacyLabelRequestRaw: slot.requestRaw, evidenceHash: digest(data),
    requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw), dispatchEligible: false };
}

export function prepareRenderedCalibrationV1(root) {
  const out = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  const prior = pinned(resolve(out, 'phase98/prepared.json'), 'af5f71603a07cda1200b8dcf7c7790b31889b48259e1193194b77ba4c60ef6af');
  const screenPlan = pinned(resolve(out, 'phase103/prepared.json'), '0d2a4e5dc961bd9ef8e1a5d088891639b0f1a4986c6fd3d2d7b2c944d7630a4f');
  const screens = pinned(resolve(out, 'phase103/rendered-panel.json'), '9e2713ded4fd074d4143cca1675134c593a3786b938a9acdde6a0a473fe85336');
  const audit = pinned(resolve(out, 'phase103/audit-actual.json'), '920176d9d65901c2ebf8b368ba34e5cfff27aa84e7b8f9819eb96a2c1c24c60e');
  check(digest(prior.plan) === prior.hash && prior.plan.rubricHash === MAIN_RUBRIC_HASH_V8 &&
    digest(screenPlan.plan) === screenPlan.hash && screenPlan.plan.rubricHash === MAIN_RUBRIC_HASH_V8 &&
    audit.pairedCriterionMet && audit.modelCalls === 3 && screens.browsers.join(',') === 'chromium,webkit', 'AUDIT');
  const { instructions } = JSON.parse(screenPlan.plan.requests[0].requestRaw);
  const position = instructions.indexOf(prefix);
  check(position > 0 && prior.plan.requests.length === 72 && screens.candidates.length === 12, 'MATRIX');
  const screenInstructions = instructions.slice(position) +
    ' Use the shown text when the rubric refers to an internal label example. The response still uses the declared structured fields.';
  const rows = new Map(screens.candidates.map(row => [row.caseId, row.feedback]));
  const { witnesses, waveKeys, countCeiling, outputCeiling } = prior.plan;
  check(rows.size === 12 && new Set(audit.supportedCases).size === 12 && audit.supportedCases.length === 12 && witnesses.length === 12, 'SOURCE_DENOMINATOR');
  const sourceBindings = witnesses.map(witness => {
    const screen = screenPlan.plan.candidates.find(x => x.caseId === witness.id);
    check(rows.has(witness.id) && screen && digest(rows.get(witness.id)) === digest(screen.feedback) &&
      digest(witness.expectedGrade) === digest(screen.expectedGrade) && digest(witness.expectedV8Axes) === digest(screen.expectedAxes) &&
      audit.supportedCases.includes(witness.id), 'SOURCE_SCREEN');
    const { sources, level } = witness.reference;
    const sourceClaims = sources.map(({ url, excerpt }) => ({ url, claim: excerpt }));
    check(digest(sourceClaims) === digest(screen.sources), 'SOURCE_CLAIMS');
    check(screen.feedback === null ? level === 'unresolved' && sources.length === 0 :
      level === 'source-supported' && sources.length > 0 && sources.every(x => /^https:\/\//.test(x.url) && /^[0-9a-f]{64}$/.test(x.contentSha256)), 'SOURCE_TRACE');
    return { caseId: witness.id, evidenceKind: screen.feedback === null ? 'unavailable-control' : 'source-excerpts-and-screen',
      sourceCount: sources.length, screenHash: digest(screen.feedback), supportedInGroupedReview: true };
  });
  const requests = prior.plan.requests.map(slot => projectRenderedCalibrationSlot(slot, rows.get(slot.privateBinding.witnessId), screenInstructions));
  for (const { witnessId, keys } of waveKeys) {
    const screen = screenPlan.plan.candidates.find(row => row.caseId === witnessId);
    const slots = requests.filter(slot => keys.includes(slot.key));
    check(slots.length === 6 && JUDGES.every(model => ['input-first', 'feedback-first'].every(layout =>
      slots.some(slot => slot.model === model && slot.layout === layout))), 'WAVE');
    for (const slot of slots) {
      const { EVALUATION_DATA: data } = JSON.parse(JSON.parse(slot.requestRaw).input[0].content);
      check(slot.privateBinding.witnessId === witnessId && digest(data.input) === digest(screen.input) &&
        digest(data.reference.sources.map(({ url, excerpt }) => ({ url, claim: excerpt }))) === digest(screen.sources), 'SLOT_SOURCE');
      const order = Object.keys(data);
      check((order.indexOf('input') < order.indexOf('feedback')) === (slot.layout === 'input-first'), 'LAYOUT');
    }
  }
  const plan = { protocol, rubricHash: MAIN_RUBRIC_HASH_V8, previousPlanHash: prior.hash, screenPlanHash: screenPlan.hash,
    witnesses, sourceBindings, requests, waveKeys, countCeiling, outputCeiling,
    sourceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export function quoteRenderedCalibrationV1(prepared, availableMicros) {
  check(typeof availableMicros === 'string' && /^\d+$/.test(availableMicros), 'BUDGET');
  const { plan } = prepared;
  const quote = assumedInputTokens => quoteMainCalibrationV8(prepared, plan.requests.map(slot => ({ ...slot, inputTokens: assumedInputTokens })));
  const conservative = quote(plan.countCeiling);
  // One input token gives a strict lower bound on the required reservation, not on actual charges.
  const lowerBound = quote(1).totals.totalMicros;
  return { countAllowanceMicros: conservative.totals.countAllowanceMicros, availableMicros,
    minimumReservationMicros: lowerBound, maximumReservationMicros: conservative.totals.totalMicros,
    maximumOneWaveMicros: conservative.waves[0].totalMicros,
    shortfallAtMinimumMicros: String(BigInt(lowerBound) > BigInt(availableMicros) ? BigInt(lowerBound) - BigInt(availableMicros) : 0n),
    minimumReservationFits: BigInt(lowerBound) <= BigInt(availableMicros),
    fitsConservativeMaximum: BigInt(conservative.totals.totalMicros) <= BigInt(availableMicros),
    actualCountsMeasured: false, reservationCreated: false };
}

export function inspectRenderedCalibrationV1(prepared, records) {
  const { plan } = prepared;
  const indexed = new Map(records.map(record => [record.key, record]));
  check(digest(plan) === prepared.hash && plan.requests.length === 72 && records.length === 72 && indexed.size === 72, 'DENOMINATOR');
  const rows = plan.requests.map(slot => {
    const record = indexed.get(slot.key);
    check(record?.requestRaw === slot.requestRaw && sha(record.requestRaw) === slot.requestSha256, 'REQUEST_BINDING');
    const vote = validateV3Output(slot.requestRaw, record.payloadRaw);
    const { input, feedback } = JSON.parse(JSON.parse(slot.requestRaw).input[0].content).EVALUATION_DATA;
    validateProductGradeV2(vote, { available: feedback !== null });
    check(new Set(vote.reasonCodes).size === vote.reasonCodes.length, 'REASONS');
    const replacement = feedback?.correctedSentence?.trim();
    const changed = !!replacement && replacement !== input.sentence.trim();
    const noRepair = feedback === null ? 'unavailable' : 'not_applicable';
    const repairAxes = [vote.repairContext, vote.assignmentForm];
    check(changed ? repairAxes.every(x => !['not_applicable', 'unavailable'].includes(x)) :
      repairAxes.every(x => x === noRepair), 'REPAIR_APPLICABILITY');
    check(vote.repairContext !== 'missing' || (vote.learnerContext === 'missing' && vote.abstentionNeed === 'required' &&
      vote.grade.correction !== 'pass'), 'MISSING_REPAIR_CONTEXT');
    check(vote.assignmentForm !== 'violates' || vote.grade.correction === 'fail', 'ASSIGNMENT_REPAIR_CONFLICT');
    const witness = plan.witnesses.find(w => w.id === slot.privateBinding.witnessId);
    return { caseId: witness.id, model: slot.model, layout: slot.layout,
      gradeMatch: sameGrade(witness.expectedGrade, vote.grade), axesMatch: axisKeys.every(key => witness.expectedV8Axes[key] === vote[key]),
      missedCriticalFlags: CRITICAL.filter(key => witness.expectedGrade.criticalErrors[key] && !vote.grade.criticalErrors[key]) };
  });
  return { denominator: rows.length, rows, arithmeticMatches: rows.filter(row => row.gradeMatch && row.axesMatch).length,
    sourceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false };
}
