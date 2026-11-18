// Prospective calibration: reuse eight controls, add Korean intent to four harms.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { digest, JUDGES, sameGrade } from './ai-quality-v147-calibration.mjs';
import { compileBilingualProductReviewV1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';
import { compileGroupedProductReviewV1, parseGroupedProductReviewV1, validateGroupedProductReviewRequestV1, GROUPED_PRODUCT_REVIEW_V1 } from './ai-quality-v147-grouped-product-review-v1.mjs';

export const BILINGUAL_CALIBRATION_V1 = 'ai-quality-v147-bilingual-calibration-v1';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('BCL1_' + code); };
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];
const partitions = [['MC01', 'MC03', 'MC05', 'MC06'], ['MC02', 'MC07', 'MC09', 'MC10'], ['MC04', 'MC08', 'MC11', 'MC12']];

export function prepareBilingualCalibrationV1(sourceRoot) {
  const file = resolve(sourceRoot, '.taskmaster/evaluation/ai-quality-v147/explanation-main-witness-candidate-v1.json');
  const priorRaw = readFileSync(file), prior = JSON.parse(priorRaw), rows = structuredClone(prior.rows);
  check(rows.length === 12, 'BANK');
  const korean = { MC05: '그녀는 집에 가.', MC06: '그는 고양이 두 마리를 소유하고 있지 않아.', MC07: '그가 그녀를 봤어.', MC08: '음악' };
  for (const row of rows) {
    if (row.id === 'MC07') {
      row.assessmentDomain = 'word';
      row.requestInput = { word: 'see', pos: 'v.', meaning: '보다', expression: 'see', sentence: row.requestInput.sentence };
    }
    if (Object.hasOwn(korean, row.id)) Object.assign(row.requestInput, { contextKind: 'sentence', contextRole: 'intended_korean', contextNote: korean[row.id] });
    const axes = row.feedback === null ? { sourceAdequacy: 'not_applicable', learnerContext: 'unavailable', abstentionNeed: 'unavailable' } : structuredClone(row.expectedEvidenceAxes);
    const shown = row.feedback?.correctedSentence, changed = !!shown && shown !== row.feedback.original.trim();
    row.expectedAxesV9 = { ...axes, repairContext: row.feedback === null ? 'unavailable' : changed ? axes.learnerContext : 'not_applicable',
      assignmentForm: row.feedback === null ? 'unavailable' : changed ? 'not_specified' : 'not_applicable' };
    row.evidenceOrigin = 'synthetic-calibration-not-a-product-generation'; row.sourceQualifiedV9 = false;
  }
  const slotsById = new Map(), salt = Buffer.from(sha(BILINGUAL_CALIBRATION_V1 + digest(rows)), 'hex');
  for (const row of rows) {
    // Two hypothetical assignment envelopes cover all three judges. No model is
    // claimed to have generated this hand-authored feedback.
    const feedback = row.feedback ?? { original: row.requestInput.sentence, meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', explanation: 'Calibration placeholder, replaced by absent feedback before dispatch.' };
    const observations = JUDGES.slice(0, 2).map((model, i) => ({ id: row.id + '-hypothetical-' + i, domain: row.assessmentDomain,
      parentRequestRaw: JSON.stringify({ model, input: [{ role: 'user', content: JSON.stringify(row.requestInput) }] }), feedback, reference: row.reference }));
    const compiled = compileBilingualProductReviewV1({ observations, salt }), selected = new Map();
    for (const slot of compiled.slots) {
      const key = slot.model + '/' + slot.layout;
      if (selected.has(key)) continue;
      slot.key = sha(BILINGUAL_CALIBRATION_V1 + '/' + row.id + '/' + key);
      slot.privateBinding.sourceId = row.id; slot.privateBinding.generatorId = 'synthetic-fixture';
      slot.privateBinding.evidenceOrigin = row.evidenceOrigin; selected.set(key, slot);
    }
    check(selected.size === 6, 'JUDGE_COVERAGE'); slotsById.set(row.id, [...selected.values()]);
  }
  const requests = [];
  for (const block of partitions) {
    const partial = compileGroupedProductReviewV1({ policyHash: compileBilingualProductReviewV1({ observations: [{
      id: 'policy-sentinel', domain: rows[0].assessmentDomain,
      parentRequestRaw: JSON.stringify({ model: JUDGES[0], input: [{ role: 'user', content: JSON.stringify(rows[0].requestInput) }] }),
      feedback: rows[0].feedback, reference: rows[0].reference }], salt }).policyHash, slots: block.flatMap(id => slotsById.get(id)) });
    check(partial.requests.length === 6, 'PARTITION');
    for (const request of partial.requests) {
      const body = JSON.parse(request.requestRaw), packet = JSON.parse(body.input[0].content);
      for (const member of request.privateMembers) if (member.individual.privateBinding.sourceId === 'MC04') {
        const slot = member.individual, b = JSON.parse(slot.requestRaw), d = JSON.parse(b.input[0].content);
        d.EVALUATION_DATA.feedback = null; b.input[0].content = JSON.stringify(d);
        slot.requestRaw = JSON.stringify(b); slot.requestSha256 = sha(slot.requestRaw);
        slot.countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(k => [k, b[k]]))); slot.countRequestSha256 = sha(slot.countRequestRaw);
        slot.feedbackAvailable = false; slot.privateBinding.visibleFeedbackHash = digest(null);
        packet.items.find(item => item.itemId === member.itemId).EVALUATION_DATA.feedback = null;
      }
      body.input[0].content = JSON.stringify(packet); request.requestRaw = JSON.stringify(body); request.key = sha(request.requestRaw);
      request.requestSha256 = request.key; request.countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(k => [k, body[k]])));
      request.countRequestSha256 = sha(request.countRequestRaw); validateGroupedProductReviewRequestV1(request); requests.push(request);
    }
  }
  check(requests.length === 18 && requests.every(r => r.itemCount === 4 && r.outputTokenMax === 4096), 'MATRIX');
  const plan = { protocol: GROUPED_PRODUCT_REVIEW_V1, calibrationProtocol: BILINGUAL_CALIBRATION_V1, role: 'calibration',
    logicalSlots: 72, requests, sourceBankFile: file, sourceBankSha256: sha(priorRaw), witnesses: rows,
    oldWitnessesUnmodified: 8, koreanIntentControls: 4, calibrationAbsenceProbes: 6,
    expectedGradesAreHypotheses: true, actualCalibrationMeasured: false, sourceQualified: false,
    calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false, actualProviderCalls: 0, actualCountCalls: 0 };
  return { plan, hash: digest(plan) };
}

export function inspectBilingualCalibrationV1(plan, records) {
  check(records.length === 18 && new Set(records.map(r => r.key)).size === 18, 'RECORDS');
  const grades = plan.requests.flatMap(request => {
    const record = records.find(r => r.key === request.key); check(record && record.requestSha256 === request.requestSha256, 'REQUEST_BINDING');
    return parseGroupedProductReviewV1(request, record.payloadRaw);
  });
  const axes = ['sourceAdequacy', 'learnerContext', 'abstentionNeed', 'repairContext', 'assignmentForm'];
  const votes = grades.map(g => {
    const row = plan.witnesses.find(w => w.id === g.sourceId), v = g.assessment;
    return { witnessId: row.id, model: g.model, layout: g.layout, grade: v.grade,
      matches: sameGrade(row.expectedGrade, v.grade), axesMatch: axes.every(k => v[k] === row.expectedAxesV9[k]),
      missedCriticalFlags: Object.keys(row.expectedGrade.criticalErrors).filter(k => row.expectedGrade.criticalErrors[k] && !v.grade.criticalErrors[k]),
      falseCriticalFlags: Object.keys(row.expectedGrade.criticalErrors).filter(k => !row.expectedGrade.criticalErrors[k] && v.grade.criticalErrors[k]) };
  });
  check(votes.length === 72, 'VOTES');
  return { protocol: BILINGUAL_CALIBRATION_V1, denominator: 72, matched: votes.filter(v => v.matches && v.axesMatch).length,
    missedCriticalVotes: votes.filter(v => v.missedCriticalFlags.length).length, falseCriticalVotes: votes.filter(v => v.falseCriticalFlags.length).length,
    votes, sourceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false, englishTruthCertified: false };
}
