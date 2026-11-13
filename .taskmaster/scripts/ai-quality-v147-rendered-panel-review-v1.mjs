import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CRITICAL, DIMENSIONS, JUDGES, digest, sameGrade } from './ai-quality-v147-calibration.mjs';
import { MAIN_RUBRIC_HASH_V8 } from './ai-quality-v147-main-panel-v8.mjs';
import { validateProductGradeV2 } from './ai-quality-v147-product-rubric-v2.mjs';
import { validateV3Output } from './ai-quality-v147-wire-v3.mjs';
import { quoteWitnessSourceReviewV1 } from './ai-quality-v147-witness-source-review-v1.mjs';

const protocol = 'ai-quality-v147-rendered-panel-review-v1';
const sha = data => createHash('sha256').update(data).digest('hex');
const check = (ok, code) => { if (!ok) throw new Error('RP1_' + code); };
const read = (file, hash) => {
  const raw = readFileSync(file);
  check(sha(raw) === hash, 'EVIDENCE');
  return JSON.parse(raw);
};

export function prepareRenderedPanelReviewV1(root) {
  const out = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  const prior = read(resolve(out, 'phase99/prepared.json'), '699046a6312f4c2b4107658f4b18b4e1c83825ac61783fc95a6437f5b740b7a3');
  const previousScreen = read(resolve(out, 'phase101/prepared.json'), '50d5ae14349df0df5f1f74e22f51f251265d29c96ddae59b9bfd0c35c0e2f675');
  const rendered = read(resolve(out, 'phase103/rendered-panel.json'), '9e2713ded4fd074d4143cca1675134c593a3786b938a9acdde6a0a473fe85336');
  check(digest(prior.plan) === prior.hash && prior.plan.rubricHash === MAIN_RUBRIC_HASH_V8 &&
    digest(previousScreen.plan) === previousScreen.hash && previousScreen.plan.previousRubricHash === MAIN_RUBRIC_HASH_V8, 'RUBRIC');
  const candidates = prior.plan.candidates.map(row => {
    const screen = rendered.candidates.find(x => x.caseId === row.caseId);
    check(screen && (row.feedback === null) === (screen.feedback === null), 'RENDERED_CASE');
    return { ...row, feedback: screen.feedback };
  });
  const baselines = rendered.baselines.map(({ caseId, feedback }) => {
    const candidate = candidates.find(x => x.caseId === caseId);
    check(candidate && ['MC01', 'MC03'].includes(caseId), 'BASELINE');
    return { caseId: caseId + '/baseline', input: candidate.input, sources: candidate.sources, feedback };
  });
  const controls = previousScreen.plan.controls;
  const rows = [...candidates, ...baselines, ...controls];
  check(candidates.length === 12 && baselines.length === 2 && controls.length === 2 &&
    new Set(rows.map(x => x.caseId)).size === 16, 'CASE_COUNT');
  const { instructions, text } = JSON.parse(previousScreen.plan.requests[0].requestRaw);
  const format = structuredClone(text.format);
  format.name = 'haru_rendered_panel_review_v1';
  format.schema.properties.reviews.minItems = rows.length;
  format.schema.properties.reviews.maxItems = rows.length;
  const requests = JUDGES.map(model => {
    const paired = rows.map(({ caseId, input, feedback, sources }) => ({ caseId, opaqueId: sha(`${protocol}/${model}/${caseId}`).slice(0, 24), input, feedback, sources }));
    paired.sort((a, b) => a.opaqueId.localeCompare(b.opaqueId));
    const mapping = paired.map(({ opaqueId, caseId }) => ({ opaqueId, caseId }));
    const items = paired.map(({ opaqueId, input, feedback, sources }) => ({ opaqueId, input, feedback, sources }));
    const wire = { model, instructions, input: [{ role: 'user', content: JSON.stringify({ items }) }],
      text: { format },
      reasoning: { effort: 'low' }, max_output_tokens: 4096, service_tier: 'default', stream: false, store: false };
    const requestRaw = JSON.stringify(wire);
    const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(k => [k, wire[k]])));
    return { model, key: model, mapping, requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw) };
  });
  const plan = { protocol, previousPanelHash: prior.hash, rubricHash: MAIN_RUBRIC_HASH_V8, candidates, baselines, controls, requests,
    evidenceAxes: prior.plan.evidenceAxes, inputCeiling: 18000, outputCeiling: 4096, sourceQualified: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export const quoteRenderedPanelReviewV1 = quoteWitnessSourceReviewV1;

function controlPass(id, vote) {
  if (id === 'control-false-rule') return vote.grade.explanation === 'fail' && vote.grade.criticalErrors.approveBadGrammar;
  return id === 'control-supplied-intent' && vote.assignmentForm === 'violates' && vote.grade.correction === 'fail' &&
    !vote.grade.criticalErrors.inventedIntent && !vote.grade.criticalErrors.reverseMeaning;
}

export function inspectRenderedPanelReviewV1(prepared, records) {
  const { plan } = prepared;
  check(digest(plan) === prepared.hash && records.length === 3 && new Set(records.map(r => r.key)).size === 3, 'DENOMINATOR');
  const reviews = new Map(), controls = [], malformed = [];
  const items = [...plan.candidates, ...plan.baselines, ...plan.controls];
  const controlIds = new Set(plan.controls.map(x => x.caseId));
  for (const request of plan.requests) {
    const record = records.find(r => r.key === request.key);
    check(record?.requestRaw === request.requestRaw, 'REQUEST');
    const votes = new Map(validateV3Output(request.requestRaw, record.payloadRaw).reviews.map(row => [row.opaqueId, row]));
    check(votes.size === request.mapping.length && request.mapping.every(row => votes.has(row.opaqueId)), 'ALIASES');
    for (const { opaqueId, caseId } of request.mapping) {
      const row = items.find(x => x.caseId === caseId), vote = votes.get(opaqueId);
      try { validateProductGradeV2(vote, { available: row.feedback !== null }); } catch (error) {
        malformed.push({ model: request.model, caseId, code: error.message });
      }
      const change = row.feedback?.correctedSentence?.trim(), shown = !!change && change !== row.input.sentence.trim();
      const absent = row.feedback === null ? 'unavailable' : 'not_applicable';
      const repairConsistent = shown ? ![vote.repairContext, vote.assignmentForm].some(x => ['unavailable', 'not_applicable'].includes(x)) :
        vote.repairContext === absent && vote.assignmentForm === absent;
      if (!repairConsistent || (vote.assignmentForm === 'violates' && vote.grade.correction !== 'fail') ||
          (vote.repairContext === 'missing' && (vote.learnerContext !== 'missing' || vote.grade.correction === 'pass'))) {
        malformed.push({ model: request.model, caseId, code: 'RP1_AXIS_CONFLICT' });
      }
      reviews.set(request.model + '/' + caseId, vote);
      if (controlIds.has(caseId)) controls.push({ model: request.model, caseId, passed: controlPass(caseId, vote) });
    }
  }
  const matches = (row, model) => {
    const vote = reviews.get(model + '/' + row.caseId);
    return sameGrade(vote.grade, row.expectedGrade) && plan.evidenceAxes.every(key => vote[key] === row.expectedAxes[key]);
  };
  const support = plan.candidates.map(row => ({ caseId: row.caseId, byJudge: JUDGES.map(judge => {
    const voters = JUDGES.filter(x => x !== judge);
    return { judge, voters, supported: voters.every(model => matches(row, model) &&
      !malformed.some(x => x.model === model && x.caseId === row.caseId) && controls.filter(x => x.model === model).every(x => x.passed) &&
      !malformed.some(x => x.model === model && plan.controls.some(c => c.caseId === x.caseId))) };
  }) }));
  const disagreements = plan.candidates.flatMap(row => JUDGES.filter(model => !matches(row, model)).map(model => {
    const vote = reviews.get(model + '/' + row.caseId);
    return { caseId: row.caseId, model, dimensions: DIMENSIONS.filter(key => vote.grade[key] !== row.expectedGrade[key]),
      critical: CRITICAL.filter(key => vote.grade.criticalErrors[key] !== row.expectedGrade.criticalErrors[key]),
      axes: plan.evidenceAxes.filter(key => vote[key] !== row.expectedAxes[key]), evidenceNote: vote.evidenceNote };
  }));
  const supportedCases = support.filter(row => row.byJudge.every(x => x.supported)).map(row => row.caseId);
  const pairs = plan.baselines.flatMap(baseline => JUDGES.map(model => {
    const caseId = baseline.caseId.split('/')[0];
    const candidate = plan.candidates.find(row => row.caseId === caseId);
    const before = reviews.get(model + '/' + baseline.caseId), after = reviews.get(model + '/' + caseId);
    const safe = [before, after].every(vote => vote.grade.grammar === 'pass' && vote.grade.correction === 'pass' &&
      vote.grade.abstention === 'pass' && vote.learnerContext === 'missing' && vote.abstentionNeed === 'required' &&
      vote.repairContext === 'not_applicable' && vote.assignmentForm === 'not_applicable' && CRITICAL.every(key => !vote.grade.criticalErrors[key]));
    const valid = !malformed.some(x => x.model === model && [caseId, baseline.caseId].includes(x.caseId)) &&
      controls.filter(x => x.model === model).every(x => x.passed) && !malformed.some(x => x.model === model && controlIds.has(x.caseId));
    const matched = valid && safe && matches(candidate, model);
    return { model, caseId, beforeMeaning: before.grade.meaning, afterMeaning: after.grade.meaning,
      safe, matched, improved: matched && before.grade.meaning !== 'pass',
      beforeNote: before.evidenceNote, afterNote: after.evidenceNote };
  }));
  return { support, controls, malformed, disagreements, supportedCases, pairs,
    improved: pairs.filter(x => x.improved).length, candidateMatches: pairs.filter(x => x.matched).length,
    passed: pairs.length === 6 && pairs.every(x => x.matched), referenceEvidenceComplete: supportedCases.length === 12,
    transportProvenanceRequired: true, sourceQualified: false, mainDispatchAuthorized: false };
}
