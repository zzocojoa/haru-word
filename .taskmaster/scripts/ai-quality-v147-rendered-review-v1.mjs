import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { costUpperMicros } from './ai-quality-v147-budget.mjs';
import { CRITICAL, DIMENSIONS, JUDGES, digest } from './ai-quality-v147-calibration.mjs';
import { validateProductGradeV2 } from './ai-quality-v147-product-rubric-v2.mjs';
import { validateV3Output } from './ai-quality-v147-wire-v3.mjs';

const protocol = 'ai-quality-v147-rendered-review-v1';
const inputCeiling = 9000, outputCeiling = 2048, countAllowanceMicros = 105000n;
const sha = value => createHash('sha256').update(value).digest('hex');
const check = (ok, code) => { if (!ok) throw new Error('RR1_' + code); };
const pinned = (file, expected) => {
  const raw = readFileSync(file);
  check(sha(raw) === expected, 'EVIDENCE');
  return JSON.parse(raw);
};

export function prepareRenderedReviewV1(root) {
  const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  const rendered = pinned(resolve(evidence, 'phase101/rendered-observations.json'), '8225b5eb2fa2a19e3607b3b83430005b613ea71843ee0f86d84dac934c3f2133');
  const prior = pinned(resolve(evidence, 'phase99/prepared.json'), '699046a6312f4c2b4107658f4b18b4e1c83825ac61783fc95a6437f5b740b7a3');
  check(rendered.capture.length === 4 && rendered.phase100Sha256 === '7a8975f16320896751b688dd780bb4710bc31be9a059b1afa013d36e27e2b6ed', 'RENDERED_SOURCE');
  const cases = rendered.capture.map(row => {
    const witness = prior.plan.candidates.find(x => x.caseId === ({ time: 'MC01', quantity: 'MC03' })[row.caseId]);
    check(witness?.input.sentence === row.original && row.correctedSentence === null, 'PAIR_INPUT');
    return { caseId: row.caseId + '/' + row.profile, pair: row.caseId, profile: row.profile, input: witness.input, sources: witness.sources,
      feedback: { headings: row.headings, correctedSentence: row.correctedSentence, explanation: row.explanation } };
  });
  const controls = prior.plan.controls.filter(x => ['control-false-rule', 'control-supplied-intent'].includes(x.caseId)).map(row => ({ caseId: row.caseId,
    input: row.input, sources: row.sources, feedback: { headings: ['수업 목표 · 확인 필요', '문법 · ' + (row.feedback.grammar === 'uncertain' ? '판단 어려움' : '확인 필요')],
      correctedSentence: row.feedback.correctedSentence || null, explanation: row.feedback.explanation } }));
  const items = [...cases, ...controls];
  check(controls.length === 2, 'CONTROLS');
  const base = JSON.parse(prior.plan.requests[0].requestRaw);
  const format = structuredClone(base.text.format);
  format.name = 'haru_rendered_feedback_review_v1';
  format.schema.properties.reviews.minItems = items.length;
  format.schema.properties.reviews.maxItems = items.length;
  const instructions = base.instructions + '\nFor this comparison, feedback contains only learner-visible content. Interpret headings as the displayed target, grammar, and correction opinions. A null correctedSentence means no correction is shown. Grade the original grammar opinion using the actual heading and explanation. A separately withheld repair can be appropriate even when an original form error is clear. Use correction and abstention to judge the decision to withhold. Judge each item separately without guessing a comparison pair.';
  const requests = JUDGES.map(model => {
    const rows = items.map(({ caseId, input, sources, feedback }) => ({ caseId, opaqueId: sha(`${protocol}/${model}/${caseId}`).slice(0, 24), input, sources, feedback }));
    rows.sort((a, b) => a.opaqueId.localeCompare(b.opaqueId));
    const mapping = rows.map(({ caseId, opaqueId }) => ({ caseId, opaqueId }));
    const input = [{ role: 'user', content: JSON.stringify({ items: rows.map(({ opaqueId, input, sources, feedback }) => ({ opaqueId, input, sources, feedback })) }) }];
    const wire = { model, instructions, input, text: { format }, reasoning: { effort: 'low' }, max_output_tokens: outputCeiling,
      store: false, stream: false, service_tier: 'default' };
    const requestRaw = JSON.stringify(wire);
    const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, wire[key]])));
    return { key: model, model, mapping, requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw) };
  });
  const plan = { protocol, previousRubricHash: prior.plan.rubricHash, renderedSourceSha256: rendered.phase100Sha256,
    cases, controls, requests, inputCeiling, outputCeiling, countAllowanceMicros: String(countAllowanceMicros), sourceQualified: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export function quoteRenderedReviewV1(prepared, receipts) {
  const { plan } = prepared;
  check(digest(plan) === prepared.hash && receipts.length === 3, 'SCOPE');
  const rates = { 'gpt-6.1-sol': [2, 10], 'gpt-6.1-terra': [1, 5], 'gpt-6-astra': [10, 50] };
  const quote = { regionalNumerator: '11', regionalDenominator: '10', inputFactorNumerator: '5', inputFactorDenominator: '4',
    models: Object.fromEntries(Object.entries(rates).map(([model, [input, output]]) => [model, { inputMicrosPerMillion: String(input * 1e6), outputMicrosPerMillion: String(output * 1e6) }])) };
  const model = plan.requests.reduce((sum, request, index) => {
    const receipt = receipts[index];
    check(receipt.key === request.key && receipt.requestSha256 === request.requestSha256 && receipt.countRequestSha256 === request.countRequestSha256 &&
      Number.isSafeInteger(receipt.inputTokens) && receipt.inputTokens > 0 && receipt.inputTokens <= inputCeiling, 'COUNT_LIMIT');
    return sum + BigInt(costUpperMicros({ quote }, { modelId: request.model, inputTokenMax: Math.ceil(receipt.inputTokens * 5 / 4), outputTokenMax: outputCeiling }));
  }, 0n);
  return { modelMicros: String(model), countAllowanceMicros: String(countAllowanceMicros), reserveMicros: String(model + countAllowanceMicros) };
}

const correctionStayedSafe = vote => vote.grade.correction === 'pass' && vote.grade.abstention === 'pass' && vote.learnerContext === 'missing' &&
  vote.abstentionNeed === 'required' && vote.repairContext === 'not_applicable' && vote.assignmentForm === 'not_applicable';
const candidateMatches = vote => DIMENSIONS.every(key => vote.grade[key] === 'pass') && vote.sourceAdequacy === 'sufficient' && correctionStayedSafe(vote) &&
  CRITICAL.every(key => !vote.grade.criticalErrors[key]);
function controlPass(id, vote) {
  return id === 'control-false-rule' ? vote.grade.explanation === 'fail' && vote.grade.criticalErrors.approveBadGrammar :
    vote.assignmentForm === 'violates' && vote.grade.correction === 'fail' && !vote.grade.criticalErrors.inventedIntent && !vote.grade.criticalErrors.reverseMeaning;
}

export function inspectRenderedReviewV1(prepared, records) {
  const { plan } = prepared;
  check(digest(plan) === prepared.hash && records.length === 3 && new Set(records.map(x => x.key)).size === 3, 'DENOMINATOR');
  const pairs = [], controls = [];
  for (const request of plan.requests) {
    const record = records.find(x => x.key === request.key);
    check(record?.requestRaw === request.requestRaw, 'REQUEST');
    const votes = new Map(validateV3Output(request.requestRaw, record.payloadRaw).reviews.map(x => [x.opaqueId, x]));
    check(votes.size === request.mapping.length && request.mapping.every(x => votes.has(x.opaqueId)), 'ALIASES');
    const byCase = new Map(request.mapping.map(({ caseId, opaqueId }) => [caseId, votes.get(opaqueId)]));
    for (const vote of byCase.values()) validateProductGradeV2(vote);
    const controlsPassed = plan.controls.every(({ caseId }) => controlPass(caseId, byCase.get(caseId)));
    for (const { caseId } of plan.controls) controls.push({ model: request.model, caseId, passed: controlPass(caseId, byCase.get(caseId)) });
    for (const pair of ['time', 'quantity']) {
      const before = byCase.get(pair + '/baseline'), after = byCase.get(pair + '/candidate');
      const safe = correctionStayedSafe(before) && correctionStayedSafe(after);
      pairs.push({ model: request.model, pair, baselineGrammar: before.grade.grammar, candidateGrammar: after.grade.grammar,
        candidateMatched: candidateMatches(after), safe, controlsPassed,
        improved: controlsPassed && before.grade.grammar !== 'pass' && candidateMatches(after) && safe,
        beforeNote: before.evidenceNote, afterNote: after.evidenceNote });
    }
  }
  return { pairs, controls, improved: pairs.filter(x => x.improved).length, candidateMatches: pairs.filter(x => x.candidateMatched).length,
    passed: pairs.length === 6 && pairs.every(x => x.improved), sourceQualified: false, mainDispatchAuthorized: false };
}
