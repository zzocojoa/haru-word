import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAiPanel, PANEL_LAYOUTS } from './ai-quality-v147-ai-panel.mjs';
import { assessmentContextPolicyV1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { compileAssessmentBoundariesV1, parseAssessmentBoundariesV1 } from './ai-quality-v147-assessment-boundaries-v1.mjs';
import { CRITICAL, digest, JUDGES, sameGrade } from './ai-quality-v147-calibration.mjs';
import { assertExplanationMainParentV1, explanationMainPolicyV1 } from './ai-quality-v147-explanation-main-v1.mjs';
import { reviseLabelSemanticsRequestV1 } from './ai-quality-v147-label-semantics-v1.mjs';
import { meaningContrastBudgetV1 } from './ai-quality-v147-meaning-contrast-v1.mjs';
import { reviseTargetMeaningRequestV1 } from './ai-quality-v147-target-meaning-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const protocol = 'ai-quality-v147-main-panel-v8';
export const MAIN_RUBRIC_HASH_V8 = 'bbb3f66845b43403d7b404e7c7b3df86e119ec448c066150fdfb68fe6062d5f0';
const runId = '448868a1-4b41-47a0-ae73-1a969287741f';
const axisKeys = ['sourceAdequacy', 'learnerContext', 'abstentionNeed', 'repairContext', 'assignmentForm'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, code) => { if (!ok) throw new Error('MP8_' + code); };
function pinned(file, expected) {
  const raw = readFileSync(file);
  check(sha(raw) === expected, 'EVIDENCE_BINDING');
  return JSON.parse(raw);
}

export function compileMainAssessmentPanelV8({ observations, witnesses, parents, panelRunId = runId, salt }) {
  const contract = pinned(resolve(source, '.taskmaster/docs/ai-quality-v147-decision-contract-v4.json'), '823b5c5a14c39ff8cfa423bb83ec3b22b8bebf839ce7e19e0143453f7ba15d79');
  contract.assessmentContext = assessmentContextPolicyV1();
  contract.explanationScope = explanationMainPolicyV1();
  delete contract.productOperationalRubric;
  delete contract.englishAssessmentScope;
  const base = compileAiPanel({ observations, witnesses, contract, runId: panelRunId, salt });
  const slots = base.slots.map(slot => {
    const parentRequestRaw = slot.kind === 'review' ? parents.get(slot.privateBinding.sourceId) : null;
    assertExplanationMainParentV1({ requestRaw: slot.raw, parentRequestRaw, role: slot.kind });
    if (slot.kind === 'review') check(JSON.parse(parentRequestRaw).model === slot.privateBinding.generatorId, 'PARENT_MODEL');
    const baseRequestRaw = reviseTargetMeaningRequestV1(reviseLabelSemanticsRequestV1(slot.raw));
    const { requestRaw, policyHash } = compileAssessmentBoundariesV1(baseRequestRaw);
    check(policyHash === MAIN_RUBRIC_HASH_V8, 'RUBRIC');
    const body = JSON.parse(requestRaw);
    const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, body[key]])));
    return { key: slot.key, requestId: slot.requestId, kind: slot.kind, model: slot.judgeId, layout: slot.layout,
      dispatchEligible: slot.dispatchEligible, evidenceHash: slot.evidenceHash, privateBinding: slot.privateBinding,
      requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw), baseRequestRaw };
  });
  const plan = { protocol, panelRunId, rubricHash: MAIN_RUBRIC_HASH_V8, baseSeal: base.seal, slots,
    sourceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export function prepareMainCalibrationV8(root) {
  const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  const p95 = pinned(resolve(evidence, 'phase95/progress-final.json'), '68bce1020d88bc8565c73690f28ac2e6de329a53a6fe3479094d4b30c6a6e9cc');
  const p97 = pinned(resolve(evidence, 'phase97/progress-final.json'), 'd09f6d87ef793519798871558edd064d4858d917e3bd7af126b154c8adf9bd05');
  const old = pinned(resolve(evidence, 'phase95/prepared.json'), p95.evidenceSha256['outputs/ai-quality-v147-implementation-20261106/phase95/prepared.json']);
  const actual = pinned(resolve(root, 'outputs/ai-quality-v147-witness-source-runtime-20261109/terminal.json'), '3b9124ae870d28e43a647d7ed3b5ff0a3bfd682dc3ce9fd271cd275038983641');
  check(actual.planHash === old.hash && actual.inspection.passedAcrossJudges === 9 && p97.diagnosticImprovement, 'PRIOR_RUN');
  const bank = pinned(resolve(source, '.taskmaster/evaluation/ai-quality-v147/explanation-main-witness-candidate-v1.json'), '8532d62eb4c6488f4f01466b56c70459c245577ab24ff17b36857235df9e252a');
  const lexical = pinned(resolve(evidence, 'phase98/lexical-evidence.json'), '141e4e9d153925aa346dc4a3cbeb3896806dd25eb1ed59065a489201d231eae2');
  const witnesses = bank.rows.map(row => {
    const prior = old.plan.candidates.find(item => item.caseId === row.id);
    check(prior && digest(prior.feedback) === digest(row.feedback) && digest(prior.expectedGrade) === digest(row.expectedGrade) &&
      digest(prior.expectedAxes) === digest(row.expectedEvidenceAxes) && digest(prior.input.assignmentContext.requestInput) === digest(row.requestInput), 'WITNESS_ORIGIN');
    const extra = lexical.sources.find(s => s.caseId === row.id);
    const reference = structuredClone(row.reference);
    if (extra) reference.sources.push({ url: extra.url, excerpt: extra.excerpt, checkedAt: lexical.checkedAt,
      contentSha256: digest({ ...extra, checkedAt: lexical.checkedAt, digestScope: 'editorial-record' }) });
    const change = row.feedback?.correctedSentence.trim();
    const shown = !!change && change !== row.feedback.original.trim();
    const defaultAxis = row.feedback === null ? 'unavailable' : 'not_applicable';
    const repairContext = shown ? row.expectedEvidenceAxes.learnerContext : defaultAxis;
    const assignmentForm = shown ? (row.id === 'MC08' ? 'violates' : 'not_specified') : defaultAxis;
    const previous = actual.inspection.support.find(item => item.caseId === row.id);
    check(previous && previous.byJudge.length === 3, 'REVIEW_COVERAGE');
    const priorSupport = previous.byJudge.map(({ judge, voters, supported }) => {
      check(JUDGES.includes(judge) && digest(voters) === digest(JUDGES.filter(model => model !== judge)), 'SELF_REVIEW');
      return { judge, voters, supported };
    });
    return { ...row, reference, expectedV8Axes: { ...row.expectedEvidenceAxes, repairContext, assignmentForm },
      priorV7Review: { supported: priorSupport.every(x => x.supported), byJudge: priorSupport }, sourceQualifiedV8: false };
  });
  check(witnesses.length === 12 && witnesses.filter(x => x.priorV7Review.supported).length === 9, 'WITNESS_COUNT');

  // The compiler requires a row; this synthetic unavailable row has no dispatch slot.
  const seed = witnesses[0];
  const generatorId = JUDGES[0], id = 'calibration-only-sentinel';
  const parent = JSON.stringify({ model: generatorId, input: [{ role: 'user', content: JSON.stringify(seed.requestInput) }] });
  const compiled = compileMainAssessmentPanelV8({ observations: [{ id, generatorId, phase: 'candidate', caseId: id, familyId: id,
    domain: seed.assessmentDomain, stratum: 'insufficientContext', parentReceiptHash: digest({ synthetic: true, parent }),
    input: seed.input, requestInput: seed.requestInput, feedback: null,
    reference: { level: 'unresolved', criterion: 'Synthetic unavailable row for the calibration compiler.', sources: [] } }],
    witnesses, parents: new Map([[id, parent]]), salt: Buffer.from(sha(protocol + runId), 'hex') });
  const requests = compiled.plan.slots.filter(slot => slot.kind === 'calibration');
  check(requests.length === 72 && compiled.plan.slots.filter(slot => slot.kind === 'review').every(slot => !slot.dispatchEligible), 'DENOMINATOR');
  const waveKeys = witnesses.map(row => {
    const slots = requests.filter(slot => slot.privateBinding.witnessId === row.id);
    check(slots.length === 6 && JUDGES.every(model => PANEL_LAYOUTS.every(layout => slots.some(slot => slot.model === model && slot.layout === layout))), 'MATRIX');
    return { witnessId: row.id, keys: slots.map(slot => slot.key) };
  });
  const plan = { protocol, rubricHash: MAIN_RUBRIC_HASH_V8, witnesses, requests, waveKeys, countCeiling: 8000, outputCeiling: 1024,
    priorSourceEvidencePolicy: 'v7-only-carry-as-provenance', sourceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export function quoteMainCalibrationV8(prepared, receipts) {
  check(prepared.hash === digest(prepared.plan) && prepared.plan.requests.length === 72, 'PREPARED');
  const { plan } = prepared;
  const totals = meaningContrastBudgetV1(prepared, receipts);
  const indexed = new Map(receipts.map(receipt => [receipt.key, receipt]));
  const waves = plan.waveKeys.map(wave => {
    const wavePlan = { ...plan, requests: wave.keys.map(key => plan.requests.find(slot => slot.key === key)) };
    const amount = meaningContrastBudgetV1({ plan: wavePlan, hash: digest(wavePlan) }, wave.keys.map(key => indexed.get(key)));
    return { witnessId: wave.witnessId, ...amount };
  });
  check(waves.reduce((sum, row) => sum + BigInt(row.totalMicros), 0n) === BigInt(totals.totalMicros), 'WAVE_TOTAL');
  return { totals, waves, reservationCreated: false, mainDispatchAuthorized: false };
}

export function inspectMainCalibrationV8(prepared, records) {
  const { plan } = prepared;
  const indexed = new Map(records.map(record => [record.key, record]));
  check(prepared.hash === digest(plan) && records.length === 72 && indexed.size === 72, 'DENOMINATOR');
  const rows = plan.requests.map(slot => {
    const record = indexed.get(slot.key);
    check(record?.requestRaw === slot.requestRaw, 'REQUEST_BINDING');
    const value = parseAssessmentBoundariesV1({ ...record, baseRequestRaw: slot.baseRequestRaw });
    const witness = plan.witnesses.find(item => item.id === slot.privateBinding.witnessId);
    return { witnessId: witness.id, model: slot.model, layout: slot.layout,
      gradeMatch: sameGrade(witness.expectedGrade, value.grade), axesMatch: axisKeys.every(key => witness.expectedV8Axes[key] === value[key]),
      missedCriticalFlags: CRITICAL.filter(key => witness.expectedGrade.criticalErrors[key] && !value.grade.criticalErrors[key]) };
  });
  return { denominator: 72, rows, arithmeticMatches: rows.filter(row => row.gradeMatch && row.axesMatch).length,
    sourceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false };
}
