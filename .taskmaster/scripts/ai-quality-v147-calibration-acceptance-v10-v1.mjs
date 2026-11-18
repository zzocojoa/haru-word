// Reconcile unchanged measured v10 votes with separately qualified sources.
// Acceptance is bounded to the measured grouping ceiling, never English truth.
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { JUDGES, digest, sameGrade } from './ai-quality-v147-calibration.mjs';
import { loadSourceAdmissionV10, assertCurrentWitnessSourcesV10 } from './ai-quality-v147-source-admission-v10-v1.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V2, validateBilingualProductReviewRequestV2 } from './ai-quality-v147-bilingual-product-review-v2.mjs';
import { GROUPED_PRODUCT_REVIEW_V2, GROUPED_PRODUCT_POLICY_HASH_V2, compileGroupedProductReviewV2, parseGroupedProductReviewV2, validateGroupedProductReviewRequestV2 } from './ai-quality-v147-grouped-product-review-v2.mjs';

export const CALIBRATION_ACCEPTANCE_V10_V1 = 'ai-quality-v147-calibration-acceptance-v10-v1';
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('CA10_' + code); };
const axes = ['sourceAdequacy', 'learnerContext', 'abstentionNeed', 'repairContext', 'assignmentForm'];
function pinned(root, file, hash) {
  const p = resolve(root, file); check(lstatSync(p).isFile() && !lstatSync(p).isSymbolicLink() && realpathSync(p) === p && sha(p) === hash, 'EVIDENCE_CHANGED'); return read(p);
}

export function inspectCalibrationAcceptanceV10(plan, records, sourcePackets) {
  check(plan.individualPolicyHash === BILINGUAL_PRODUCT_RUBRIC_HASH_V2 && plan.policyHash === GROUPED_PRODUCT_POLICY_HASH_V2, 'POLICY');
  check(plan.logicalSlots === 72 && plan.requests.length === 18 && records.length === 18 && new Set(records.map(r => r.key)).size === 18, 'DENOMINATOR');
  check(sourcePackets.length === 12 && new Set(sourcePackets.map(p => p.caseId)).size === 12, 'SOURCES');
  const bySlot = new Map(), votes = [];
  for (const request of plan.requests) {
    validateGroupedProductReviewRequestV2(request);
    check(request.itemCount === 4 && request.outputTokenMax === 4096, 'MEASURED_GROUP_SIZE');
    const record = records.find(r => r.key === request.key); check(record?.requestSha256 === request.requestSha256, 'RECORD_BINDING');
    for (const member of request.privateMembers) {
      const s = member.individual, d = JSON.parse(JSON.parse(s.requestRaw).input[0].content).EVALUATION_DATA;
      const candidate = sourcePackets.find(p => p.caseId === s.privateBinding.sourceId);
      check(candidate && digest({ input: candidate.input, feedback: candidate.feedback, reference: candidate.reference }) === digest(d), 'SOURCE_CONTENT');
      const w = plan.witnesses.find(w => w.id === candidate.caseId); check(w && sameGrade(w.expectedGrade, candidate.expectedGrade), 'EXPECTED_GRADE');
      const key = [candidate.caseId, request.model, request.layout].join('|'); check(!bySlot.has(key), 'DUPLICATE_SLOT'); bySlot.set(key, candidate);
    }
    for (const parsed of parseGroupedProductReviewV2(request, record.payloadRaw)) {
      const key = [parsed.sourceId, parsed.model, parsed.layout].join('|'), candidate = bySlot.get(key), a = parsed.assessment;
      check(candidate, 'UNBOUND_VOTE');
      votes.push({ caseId: parsed.sourceId, model: parsed.model, layout: parsed.layout,
        gradeMatch: sameGrade(a.grade, candidate.expectedGrade), axesMatch: axes.every(k => a[k] === candidate.expectedAxes[k]),
        criticalMisses: Object.keys(candidate.expectedGrade.criticalErrors).filter(k => candidate.expectedGrade.criticalErrors[k] && !a.grade.criticalErrors[k]),
        extraCriticalFlags: Object.keys(candidate.expectedGrade.criticalErrors).filter(k => !candidate.expectedGrade.criticalErrors[k] && a.grade.criticalErrors[k]) });
    }
  }
  const cells = JUDGES.flatMap(model => ['input-first', 'feedback-first'].map(layout => {
    const rows = votes.filter(v => v.model === model && v.layout === layout);
    return { model, layout, denominator: rows.length, matches: rows.filter(v => v.gradeMatch).length, axesMatches: rows.filter(v => v.axesMatch).length,
      criticalMisses: rows.reduce((n, v) => n + v.criticalMisses.length, 0), extraCriticalFlags: rows.reduce((n, v) => n + v.extraCriticalFlags.length, 0) };
  }));
  check(votes.length === 72 && cells.every(c => c.denominator === 12), 'COMPLETE_MATRIX');
  const accepted = cells.every(c => c.matches >= 11 && c.axesMatches === 12 && c.criticalMisses === 0 && c.extraCriticalFlags === 0);
  return { protocol: CALIBRATION_ACCEPTANCE_V10_V1, observedCriterionSatisfied: accepted, maximumCalibratedGroupItems: 4, actuallyObservedGroupItems: [4], cells,
    logicalJudgments: 72, gradeMatches: votes.filter(v => v.gradeMatch).length, axesMatches: votes.filter(v => v.axesMatch).length,
    votes, sourceQualificationRequired: true, qualificationIsSourceConditional: true, publicDevelopmentOnly: true,
    individualGroupedEquivalenceEstablished: false, unseenCasesCertified: false, freshHoldout: false, englishTruthCertified: false,
    referencesQualified: 0, formalPilotGenerations: 0, formalPilotGrades: 0, mainDispatchAuthorized: false };
}

export function loadCalibrationAcceptanceV10(projectRoot = null) {
  const sources = loadSourceAdmissionV10(projectRoot), root = sources.projectRoot;
  const sourceScope = read(resolve(root, sources.registry.scopeFile));
  const executionFile = '.taskmaster/docs/ai-quality-v147-v10-live-execution-v1.json';
  const execution = pinned(root, executionFile, sourceScope.sourceBindings[executionFile]);
  const scope = pinned(root, execution.scopeFile, execution.scopeSha256);
  const plan = pinned(root, scope.planFile, scope.planSha256);
  check(execution.actualExecutionExitCode === 0 && execution.actualProviderCalls === 18 && execution.actualCountCalls === 18 && execution.actualKeyReads === 1, 'ACTUAL_SCOPE');
  const grant = pinned(root, scope.authorizationFile, scope.authorizationSha256);
  check(grant.currentUserApproved && grant.apiKeyReuseAlreadyApproved && grant.additionalTrancheCapMicros === '35000000' && !grant.oldClosedApprovalsReactivated, 'AUTHORIZATION');
  const prefix = 'outputs/' + scope.runtimeDirectoryName + '/';
  for (const [f, h] of Object.entries(execution.evidenceSha256)) if (f.replaceAll('\\', '/').startsWith(prefix)) pinned(root, f, h);
  const terminal = pinned(root, prefix + 'terminal.json', execution.evidenceSha256[prefix + 'terminal.json']);
  check(terminal.mode === 'evaluation' && terminal.failureCode === null && terminal.actualProviderCalls === 18 && terminal.actualCountCalls === 18, 'ACTUAL_TERMINAL');
  check(terminal.planHash === execution.scopeSha256 && terminal.collectorPlanHash === scope.planSha256, 'RUN_BINDING');
  const packetSource = assertCurrentWitnessSourcesV10({ packets: sources.prepared.plan.candidates, policyHash: plan.individualPolicyHash, projectRoot: root });
  const inspection = inspectCalibrationAcceptanceV10(plan, terminal.records, sources.prepared.plan.candidates);
  check(inspection.observedCriterionSatisfied && packetSource.sourceQualified, 'CRITERION_NOT_MET');
  return { ...inspection, calibrationAccepted: true, qualificationScope: 'declared-AI-only-v10-public-calibration;maximum-four-members',
    sourceAdmissionRegistrySha256: sources.registrySha256, calibrationPlanSha256: scope.planSha256,
    calibrationTerminalSha256: sha(resolve(root, prefix, 'terminal.json')), originalExecutionRecordUnchanged: true,
    sourceQualificationOccurredAfterMeasurement: true, existingVotesRescored: false, newProviderCalls: 0, newCountCalls: 0, newKeyReads: 0 };
}

export function compileCalibratedGroupsV10(individualPlan, projectRoot = null) {
  const acceptance = loadCalibrationAcceptanceV10(projectRoot);
  check(individualPlan.policyHash === BILINGUAL_PRODUCT_RUBRIC_HASH_V2 && Array.isArray(individualPlan.slots) && individualPlan.slots.length > 0, 'INDIVIDUAL_PLAN');
  check(new Set(individualPlan.slots.map(s => s.key)).size === individualPlan.slots.length, 'DUPLICATE_INDIVIDUAL');
  const buckets = [], unavailableSlots = [];
  for (const slot of individualPlan.slots) {
    const b = validateBilingualProductReviewRequestV2(slot.requestRaw), d = JSON.parse(b.input[0].content).EVALUATION_DATA;
    check(slot.feedbackAvailable === (d.feedback !== null), 'AVAILABILITY');
    if (d.feedback === null) { unavailableSlots.push(structuredClone(slot)); continue; }
    const original = d.input.requestInput.sentence;
    let bucket = buckets.find(x => x.model === slot.model && x.layout === slot.layout && x.slots.length < 4 && !x.originals.has(original));
    if (!bucket) { bucket = { model: slot.model, layout: slot.layout, slots: [], originals: new Set() }; buckets.push(bucket); }
    bucket.originals.add(original); bucket.slots.push(slot);
  }
  const requests = buckets.flatMap(x => compileGroupedProductReviewV2({ policyHash: individualPlan.policyHash, slots: x.slots }).requests);
  check(requests.every(r => r.itemCount <= 4) && requests.reduce((n, r) => n + r.itemCount, 0) + unavailableSlots.length === individualPlan.slots.length, 'FULL_DENOMINATOR');
  return { protocol: GROUPED_PRODUCT_REVIEW_V2, policyHash: GROUPED_PRODUCT_POLICY_HASH_V2, individualPolicyHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V2,
    logicalSlots: individualPlan.slots.length, availableSlots: individualPlan.slots.length - unavailableSlots.length, unavailableSlots, requests,
    sourcePlanHash: digest(individualPlan), calibrationAcceptanceProtocol: CALIBRATION_ACCEPTANCE_V10_V1,
    maximumGroupItems: 4, actuallyObservedCalibrationGroupItems: [4], calibrationEvidenceHash: acceptance.calibrationTerminalSha256,
    calibratedUnderDeclaredAiOnlyCriterion: true, lowerOccupancyGeneralEquivalenceCertified: false,
    actualEquivalenceEstablished: false, mainDispatchAuthorized: false, referencesQualified: 0, actualProviderCalls: 0, actualCountCalls: 0 };
}
