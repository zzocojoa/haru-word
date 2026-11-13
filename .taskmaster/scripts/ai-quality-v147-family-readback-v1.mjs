// Read-only synthetic physical replay. Never constructs a transport or session.
import {inspectSyntheticPanelV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {digest, DIMENSIONS, CRITICAL, sameGrade} from './ai-quality-v147-calibration.mjs';
import {aggregateFamilyPairsV1} from './ai-quality-v147-family-pairs-v1.mjs';

const check = (ok, code) => { if (!ok) throw Error('FR1_' + code); };
export function inspectSyntheticFamilyPairsV1({context, seal, observeCurrent, reportInputs, arithmetic}) {
  check(context?.spec?.mode === 'synthetic' && context.spec.profile.stage === 'pilot-panel', 'SYNTHETIC_PILOT_ONLY');
  check(arithmetic && Object.keys(arithmetic).sort().join('|') === 'boundCount|familywiseConfidence|minimumImprovement', 'ARITHMETIC_FIELDS');
  const state = inspectSyntheticPanelV3({context, seal, observeCurrent, reportInputs});
  const report = state.report, by = new Map(report.panel.rows.map(r => [r.rowId, r]));
  const observations = context.spec.requests.filter(d => d.role === 'generation').map(d => {
    const row = by.get(d.key); check(row, 'PLANNED_ROW');
    const grades = row.rawReviews.filter(r => r.state === 'graded' && r.grade).map(r => r.grade);
    const critical = grades.some(g => CRITICAL.some(k => g.criticalErrors[k]));
    const fullyAssessed = report.calibration.thresholdArithmeticSatisfied && row.referenceLevel !== 'unresolved'
      && row.received === 4 && row.valid === 4 && grades.length === 4
      && grades.every(g => DIMENSIONS.every(k => ['pass', 'fail'].includes(g[k])))
      && grades.every(g => sameGrade(g, grades[0]));
    const assessment = !fullyAssessed ? 'unavailable' : !critical && DIMENSIONS.every(k => grades[0][k] === 'pass') ? 'pass' : 'fail';
    return {rowId: d.key, modelId: d.generatorId, phase: d.phase, caseId: d.caseId, repetition: d.repetition,
      assessment, critical, evidenceHash: state.ledger.slots[d.key]?.receiptHash ?? null};
  });
  const result = aggregateFamilyPairsV1({cases: reportInputs.cases.map(({id, familyId, domain, stratum}) => ({id, familyId, domain, stratum})),
    repetitions: context.spec.profile.generationRepeats, observations,
    familywiseConfidence: arithmetic?.familywiseConfidence, boundCount: arithmetic?.boundCount,
    minimumImprovement: arithmetic?.minimumImprovement});
  return {...result, physicalCaptureReadbackVerified: true, noDispatchPerformed: true,
    collection: {runId: report.runId, specHash: report.specHash, sourceSeal: report.sourceSeal, closed: report.closed,
      collectionComplete: report.collectionComplete, calibrationArithmeticSatisfied: report.calibration.thresholdArithmeticSatisfied,
      sourceQualification: report.calibration.sourceQualification, originalPanelHeld: report.panel.held,
      originalPanelCounts: report.panel.counts, physicalReportHash: digest(report),
      originalReleaseVerdict: report.releaseVerdict},
    qualificationHoldsLifted: false, liveEvaluationReady: false, actualProviderCalls: 0, actualCountApiCalls: 0,
    actualKeyReads: 0, providerReceiptAuthenticated: false, scope: 'Historical or owned synthetic captures only; current raw bytes verified,AI grades remain unqualified. Family union arithmetic does not certify independence or English truth.'};
}
