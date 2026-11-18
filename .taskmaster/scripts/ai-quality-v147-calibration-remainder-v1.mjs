// Remaining eight public witnesses; the four measured Korean-intent controls stay immutable.
import { createHash } from 'node:crypto';
import { JUDGES, digest, sameGrade } from './ai-quality-v147-calibration.mjs';
import { compileBilingualProductReviewV1, BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';
import { compileGroupedProductReviewV1, validateGroupedProductReviewRequestV1, parseGroupedProductReviewV1, GROUPED_PRODUCT_REVIEW_V1 } from './ai-quality-v147-grouped-product-review-v1.mjs';

export const CALIBRATION_REMAINDER_V1 = 'ai-quality-v147-calibration-remainder-v1';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('CRM1_' + code); };
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];
const blocks = [['MC01', 'MC03', 'MC09'], ['MC02', 'MC10', 'MC11'], ['MC04', 'MC12']];
const refresh = (slot, body) => {
  slot.requestRaw = JSON.stringify(body); slot.requestSha256 = sha(slot.requestRaw);
  slot.countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(k => [k, body[k]])));
  slot.countRequestSha256 = sha(slot.countRequestRaw);
};

export function compileCalibrationRemainderV1(bank) {
  const witnesses = blocks.flat().map(id => {
    const row = bank.rows.find(r => r.id === id); check(row, 'WITNESS'); return structuredClone(row);
  });
  const slots = [];
  for (const row of witnesses) {
    const selected = new Map();
    for (const model of JUDGES.slice(0, 2)) {
      // Placeholder is removed before validation/dispatch; it only allows the existing grouping compiler to retain MC04.
      const placeholder = { original: row.requestInput.sentence, meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', explanation: '' };
      const p = compileBilingualProductReviewV1({ observations: [{ id: row.id, domain: row.assessmentDomain,
        parentRequestRaw: JSON.stringify({ model, input: [{ role: 'user', content: JSON.stringify(row.requestInput) }] }),
        feedback: row.feedback ?? placeholder, reference: row.reference }], salt: Buffer.alloc(32, 179) });
      for (const s of p.slots) if (!selected.has(s.model + '|' + s.layout)) {
        s.privateBinding.generatorId = 'synthetic-fixture'; s.privateBinding.evidenceOrigin = 'public-calibration-witness-not-a-product-generation';
        s.key = sha(CALIBRATION_REMAINDER_V1 + '|' + row.id + '|' + s.model + '|' + s.layout);
        selected.set(s.model + '|' + s.layout, s);
      }
    }
    check(selected.size === 6, 'SLOTS'); slots.push(...selected.values());
  }
  const requests = blocks.flatMap(ids => compileGroupedProductReviewV1({ policyHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V1,
    slots: slots.filter(s => ids.includes(s.privateBinding.sourceId)) }).requests);
  for (const request of requests) {
    const group = JSON.parse(request.requestRaw), packet = JSON.parse(group.input[0].content);
    for (const member of request.privateMembers) if (member.individual.privateBinding.sourceId === 'MC04') {
      const s = member.individual, body = JSON.parse(s.requestRaw), data = JSON.parse(body.input[0].content);
      data.EVALUATION_DATA.feedback = null; body.input[0].content = JSON.stringify(data);
      s.feedbackAvailable = false; s.privateBinding.visibleFeedbackHash = digest(null); refresh(s, body);
      packet.items.find(i => i.itemId === member.itemId).EVALUATION_DATA.feedback = null;
    }
    group.input[0].content = JSON.stringify(packet); refresh(request, group); request.key = request.requestSha256;
    validateGroupedProductReviewRequestV1(request);
  }
  check(requests.length === 18 && requests.reduce((n, r) => n + r.itemCount, 0) === 48, 'DENOMINATOR');
  return { protocol: GROUPED_PRODUCT_REVIEW_V1, calibrationProtocol: CALIBRATION_REMAINDER_V1, logicalSlots: 48,
    requests, witnesses, previouslyMeasuredNegativeControls: 24, expectedGradesAreHypotheses: true,
    sourceQualified: false, formalCalibrationQualification: false, mainDispatchAuthorized: false, actualProviderCalls: 0, actualCountCalls: 0 };
}

export function inspectCalibrationRemainderV1(plan, records, negativeControlVotes) {
  check(records.length === 18 && new Set(records.map(r => r.key)).size === 18, 'RECORDS');
  check(negativeControlVotes.length === 24, 'PREVIOUS_VOTES');
  const votes = [];
  for (const r of plan.requests) {
    const record = records.find(x => x.key === r.key); check(record?.requestSha256 === r.requestSha256, 'BINDING');
    for (const parsed of parseGroupedProductReviewV1(r, record.payloadRaw)) {
      const row = plan.witnesses.find(w => w.id === parsed.sourceId), a = parsed.assessment;
      const changed = row.feedback && !!row.feedback.correctedSentence && row.feedback.correctedSentence !== row.feedback.original;
      const expectedAxes = { ...row.expectedEvidenceAxes, repairContext: row.feedback === null ? 'unavailable' : changed ? row.expectedEvidenceAxes.learnerContext : 'not_applicable',
        assignmentForm: row.feedback === null ? 'unavailable' : changed ? 'not_specified' : 'not_applicable' };
      votes.push({ id: row.id, model: r.model, layout: r.layout, ...a, expectedGrade: row.expectedGrade, expectedAxes,
        exactGradeMatch: sameGrade(a.grade, row.expectedGrade), axesMatch: Object.entries(expectedAxes).every(([k,v]) => a[k] === v),
        missedCriticalFlags: Object.keys(row.expectedGrade.criticalErrors).filter(k => row.expectedGrade.criticalErrors[k] && !a.grade.criticalErrors[k]),
        extraCriticalFlags: Object.keys(row.expectedGrade.criticalErrors).filter(k => !row.expectedGrade.criticalErrors[k] && a.grade.criticalErrors[k]) });
    }
  }
  const prior = negativeControlVotes.map(v => {
    const missing = v.id === 'MC08', changed = v.id !== 'MC05';
    const expectedAxes = { sourceAdequacy: 'sufficient', learnerContext: missing ? 'missing' : 'sufficient',
      abstentionNeed: missing ? 'required' : 'not_required', repairContext: changed ? missing ? 'missing' : 'sufficient' : 'not_applicable',
      assignmentForm: changed ? 'not_specified' : 'not_applicable' };
    return { ...v, expectedAxes, axesMatch: Object.entries(expectedAxes).every(([k,value]) => v[k] === value), evidenceCohort: 'previous24' };
  });
  const full = [...prior, ...votes.map(v => ({ ...v, evidenceCohort: 'new48' }))];
  check(full.length === 72 && new Set(full.map(v => v.id + '|' + v.model + '|' + v.layout)).size === 72, 'COMPLETE_COVERAGE');
  const byModel = JUDGES.map(model => { const rows = full.filter(v => v.model === model); return { model, denominator: rows.length,
    exactGradeMatches: rows.filter(v => v.exactGradeMatch).length, criticalMisses: rows.filter(v => v.missedCriticalFlags.length).length }; });
  return { protocol: CALIBRATION_REMAINDER_V1, newDenominator: 48, newGradeMatches: votes.filter(v => v.exactGradeMatch).length,
    newAxesMatches: votes.filter(v => v.axesMatch).length, combinedDenominator: 72, combinedGradeMatches: full.filter(v => v.exactGradeMatch).length,
    criticalMisses: full.filter(v => v.missedCriticalFlags.length).length, extraCriticalVotes: full.filter(v => v.extraCriticalFlags.length).length,
    byModel, combinedAxesMatches: full.filter(v => v.axesMatch).length,
    observedGradeCriterionSatisfied: byModel.every(r => r.denominator === 24 && r.exactGradeMatches >= 22 && r.criticalMisses === 0)
      && full.every(v => v.axesMatch && v.extraCriticalFlags.length === 0), votes,
    formalCalibrationQualification: false, sourceQualified: false, mainDispatchAuthorized: false, englishTruthCertified: false,
    groupedIndividualEquivalenceEstablished: false };
}
