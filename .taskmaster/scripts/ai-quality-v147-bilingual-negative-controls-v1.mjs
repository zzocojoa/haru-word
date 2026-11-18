// Four development controls only; prior witnesses, rubric and real app outputs stay unchanged.
import { createHash } from 'node:crypto';
import { JUDGES, sameGrade } from './ai-quality-v147-calibration.mjs';
import { compileBilingualProductReviewV1, BILINGUAL_PRODUCT_RUBRIC_HASH_V1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';
import { compileGroupedProductReviewV1, parseGroupedProductReviewV1, GROUPED_PRODUCT_REVIEW_V1 } from './ai-quality-v147-grouped-product-review-v1.mjs';

export const NEGATIVE_CONTROLS_V1 = 'ai-quality-v147-bilingual-negative-controls-v1';
const check = (ok, code) => { if (!ok) throw Error('BNC1_' + code); };
const sha = raw => createHash('sha256').update(raw).digest('hex');
const ids = ['MC05', 'MC06', 'MC07', 'MC08'];
const korean = ['그녀는 집에 가.', '그는 고양이 두 마리를 소유하고 있지 않아.', '그가 그녀를 봤어.', '음악'];

export function compileNegativeControlsV1(bank) {
  const controls = ids.map((id, i) => {
    const original = bank.rows.find(r => r.id === id); check(original, 'WITNESS');
    const r = structuredClone(original); r.originWitnessSha256 = sha(JSON.stringify(original));
    if (id === 'MC07') {
      r.assessmentDomain = 'word';
      r.requestInput = { word: 'see', pos: 'v.', meaning: '보다', expression: 'see', sentence: r.feedback.original };
    }
    Object.assign(r.requestInput, { contextKind: 'sentence', contextRole: 'intended_korean', contextNote: korean[i] });
    r.expectedGradesAreHypotheses = true; r.sourceQualified = false;
    return r;
  });
  const slots = [];
  for (const r of controls) {
    const selected = new Map();
    // Hypothetical parent envelopes unlock all three judge models; no model is claimed as generator.
    for (const generator of JUDGES.slice(0, 2)) {
      const compiled = compileBilingualProductReviewV1({ observations: [{ id: r.id, domain: r.assessmentDomain,
        parentRequestRaw: JSON.stringify({ model: generator, input: [{ role: 'user', content: JSON.stringify(r.requestInput) }] }),
        feedback: r.feedback, reference: r.reference }], salt: Buffer.alloc(32, 178) });
      for (const s of compiled.slots) if (!selected.has(s.model + '|' + s.layout)) {
        s.privateBinding.generatorId = 'synthetic-fixture';
        s.privateBinding.evidenceOrigin = 'authored-negative-control-not-an-app-generation';
        s.key = sha(NEGATIVE_CONTROLS_V1 + '|' + r.id + '|' + s.model + '|' + s.layout);
        selected.set(s.model + '|' + s.layout, s);
      }
    }
    check(selected.size === 6, 'SLOTS'); slots.push(...selected.values());
  }
  // Two independent pairs keep the already tested collector's exact 12-request /24-grade shape.
  const requests = [[controls[0], controls[1]], [controls[2], controls[3]]].flatMap(pair =>
    compileGroupedProductReviewV1({ policyHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V1,
      slots: slots.filter(s => pair.some(r => r.id === s.privateBinding.sourceId)) }).requests);
  check(requests.length === 12 && requests.every(r => r.itemCount === 2), 'DENOMINATOR');
  return { protocol: GROUPED_PRODUCT_REVIEW_V1, diagnosticProtocol: NEGATIVE_CONTROLS_V1,
    logicalSlots: 24, requests, controls, expectedGradesAreHypotheses: true, sourceQualified: false,
    formalCalibrationQualification: false, mainDispatchAuthorized: false, actualProviderCalls: 0, actualCountCalls: 0 };
}

export function inspectNegativeControlsV1(plan, records) {
  check(records.length === 12 && new Set(records.map(r => r.key)).size === 12, 'RECORDS');
  const votes = [];
  for (const r of plan.requests) {
    const record = records.find(x => x.key === r.key);
    check(record?.requestSha256 === r.requestSha256, 'BINDING');
    const grades = parseGroupedProductReviewV1(r, record.payloadRaw);
    grades.forEach((parsed, i) => {
      const grade = parsed.assessment;
      const id = r.privateMembers[i].individual.privateBinding.sourceId;
      const expected = plan.controls.find(c => c.id === id).expectedGrade;
      const missed = Object.keys(expected.criticalErrors).filter(k => expected.criticalErrors[k] && !grade.grade.criticalErrors[k]);
      const extra = Object.keys(expected.criticalErrors).filter(k => !expected.criticalErrors[k] && grade.grade.criticalErrors[k]);
      votes.push({ id, model: r.model, layout: r.layout, ...grade, expectedGrade: expected,
        exactGradeMatch: sameGrade(grade.grade, expected), missedCriticalFlags: missed, extraCriticalFlags: extra });
    });
  }
  return { protocol: NEGATIVE_CONTROLS_V1, denominator: votes.length,
    exactGradeMatches: votes.filter(v => v.exactGradeMatch).length,
    criticalDetectedVotes: votes.filter(v => v.missedCriticalFlags.length === 0).length,
    missedCriticalVotes: votes.filter(v => v.missedCriticalFlags.length > 0).length,
    extraCriticalVotes: votes.filter(v => v.extraCriticalFlags.length > 0).length, votes,
    formalCalibrationQualification: false, sourceQualified: false, mainDispatchAuthorized: false, englishTruthCertified: false };
}
