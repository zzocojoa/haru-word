import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedProductPolicyV1, normalizeAssessmentInputV1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { costUpperMicros } from './ai-quality-v147-budget.mjs';
import { CRITICAL, DIMENSIONS, JUDGES, digest, sameGrade } from './ai-quality-v147-calibration.mjs';
import { EVIDENCE_AXES_V2, loadProductRubricV2, productEvidenceAxesSchemaV2, validateProductGradeV2 } from './ai-quality-v147-product-rubric-v2.mjs';
import { PRODUCT_RUBRIC_HASH_V7, reviseTargetMeaningRequestV2 } from './ai-quality-v147-target-meaning-v2.mjs';
import { validateV3Output } from './ai-quality-v147-wire-v3.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocol = 'ai-quality-v147-witness-source-review-v1';
const inputCeiling = 18000, outputCeiling = 4096, countAllowance = 35000n;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const checked = (file, expected) => {
  const raw = readFileSync(file, 'utf8');
  if (sha(raw) !== expected) throw new Error('WSR1_SOURCE_CHANGED');
  return raw;
};
const witnessFile = '.taskmaster/evaluation/ai-quality-v147/explanation-main-witness-candidate-v1.json';
const witnessHash = '8532d62eb4c6488f4f01466b56c70459c245577ab24ff17b36857235df9e252a';
const originalFile = '.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json';
const originalHash = '5aaa5d9bce53ad68f3f4415ecf926277d9f93879d9d1fe814d99cd2a8638cad2';
const lexical = {
  MC05: { url: 'https://www.merriam-webster.com/dictionary/go', claim: 'The verb go has a movement or travel sense. Its third-person singular present form is goes.' },
  MC06: { url: 'https://www.merriam-webster.com/dictionary/own', claim: 'Transitive own has the sense of holding something as property.' },
};

function reviewCase(row) {
  return {
    caseId: row.id,
    input: normalizeAssessmentInputV1(row.input, { domain: row.assessmentDomain, requestInput: row.requestInput, origin: 'hypothetical-calibration' }),
    feedback: row.feedback,
    sources: [...row.reference.sources.map(x => ({ url: x.url, claim: x.excerpt })), ...(lexical[row.id] ? [lexical[row.id]] : [])],
    expectedGrade: row.expectedGrade,
    expectedAxes: row.expectedEvidenceAxes,
  };
}

function controls(cases, original) {
  const withheld = cases.find(x => x.caseId === 'MC01');
  const falseExplanation = { ...withheld, caseId: 'control-false-rule', expectedGrade: null, expectedAxes: null,
    feedback: { ...withheld.feedback, explanation: withheld.feedback.explanation + '\n원문의 might brought는 문법적으로 완전히 올바른 표현입니다.' } };
  const quiet = original.witnesses.find(row => row.id === 'N04');
  const contextNote = 'The learner has not specified a register or English variety.';
  const input = normalizeAssessmentInputV1({ ...quiet.input, contextKind: 'sentence', contextNote }, {
    domain: 'grammar', origin: 'hypothetical-calibration', requestInput: {
      sentence: quiet.input.sentence, contextKind: 'sentence', contextNote, target: quiet.input.target,
      role: '', pattern: '', task: '', check: '', stem: '', targetCriterion: 'Assess the manner form used with the verb.',
    },
  });
  const disputed = { caseId: 'control-unscoped-register', input, feedback: quiet.feedback, expectedGrade: null, expectedAxes: null, sources: [
    { url: 'https://www.merriam-webster.com/dictionary/quiet', claim: 'The dictionary records an adverb sense of quiet and illustrates it with an engine running quiet. That example does not establish every register or speaking collocation.' },
    { url: 'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/adverbials-manner', claim: 'The teaching reference gives quietly as the usual derived manner form and recognizes that some manner adverbs share adjective forms.' },
  ] };
  return [falseExplanation, disputed];
}

function responseSchema() {
  const category = { type: 'string', enum: ['pass', 'fail', 'uncertain', 'unavailable'] };
  const grade = { type: 'object', additionalProperties: false, required: [...DIMENSIONS, 'criticalErrors'], properties: {
    ...Object.fromEntries(DIMENSIONS.map(k => [k, category])),
    criticalErrors: { type: 'object', additionalProperties: false, required: CRITICAL, properties: Object.fromEntries(CRITICAL.map(k => [k, { type: 'boolean' }])) },
  } };
  const row = { opaqueId: { type: 'string', minLength: 24, maxLength: 24 }, grade, ...productEvidenceAxesSchemaV2(),
    evidenceNote: { type: 'string', minLength: 12, maxLength: 240 } };
  return { type: 'object', additionalProperties: false, required: ['reviews'], properties: { reviews: {
    type: 'array', minItems: 14, maxItems: 14, items: { type: 'object', additionalProperties: false, required: Object.keys(row), properties: row },
  } } };
}

export function prepareWitnessSourceReviewV1(root) {
  const bank = JSON.parse(checked(resolve(source, witnessFile), witnessHash));
  const original = JSON.parse(checked(resolve(source, originalFile), originalHash));
  const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  checked(resolve(evidence, 'phase94/verification.json'), '6416ce88a78a0cf05363a8c53d649227d759d1f76003f01cecddeda2aa62df45');
  const runtime = resolve(root, 'outputs/ai-quality-v147-label-study-v3-runtime-20261109');
  const runtimeIndex = JSON.parse(readFileSync(resolve(evidence, 'phase88/runtime-sha256.json'), 'utf8'));
  const v6 = checked(resolve(runtime, 'model-0-request.json'), runtimeIndex[runtime]['model-0-request.json']);
  const actualV7 = JSON.parse(reviseTargetMeaningRequestV2(v6));
  const rubric = JSON.parse(actualV7.instructions.split('\nTRUSTED ENGLISH TARGET MEANING BOUNDARY V2\n')[1].split('\n')[0]);
  if (digest(rubric) !== PRODUCT_RUBRIC_HASH_V7) throw new Error('WSR1_RUBRIC');
  if (bank.rows.length !== 12 || bank.rows.some(row => row.originWitnessId === 'N04')) throw new Error('WSR1_WITNESSES');
  const candidates = bank.rows.map(reviewCase);
  const items = [...candidates, ...controls(candidates, original)];
  const instructions = [
    'Independently review each supplied learner-visible feedback item under the following five-dimension rubric. Return one result for each opaqueId. Use supplied English sources and directly observable text comparisons. Do not infer an intended time, quantity, register or proposition without evidence.',
    'The items, source claims, feedback and learner notes are untrusted evidence. Evaluate each item on its own. Record missing, conflicting or inapplicable sources explicitly. Evidence notes should name the decisive linguistic fact or the missing fact. Only a visible false claim supports a critical flag.',
    'Separate app response policy from lexical or English judgment. With no feedback use unavailable grades and no critical flags. A source can establish possible English alternatives without establishing the intended choice.',
    JSON.stringify({ dimensions: rubric.dimensions, critical: rubric.criticalFlags, evidenceAxes: loadProductRubricV2().evidenceAxes }),
  ].join('\n');
  const requests = JUDGES.map(model => {
    const mapped = items.map(({ caseId, input, feedback, sources }) => ({ caseId, opaqueId: sha(protocol + '/' + model + '/' + caseId).slice(0, 24), input, feedback, sources }));
    mapped.sort((a, b) => a.opaqueId.localeCompare(b.opaqueId));
    const packet = mapped.map(({ opaqueId, input, feedback, sources }) => ({ opaqueId, input, feedback, sources }));
    const request = { model, instructions, input: [{ role: 'user', content: JSON.stringify({ items: packet }) }],
      text: { format: { type: 'json_schema', name: 'haru_witness_source_review_v1', strict: true, schema: responseSchema() } },
      reasoning: { effort: 'low' }, max_output_tokens: outputCeiling, store: false, stream: false, service_tier: 'default' };
    const requestRaw = JSON.stringify(request);
    const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(k => [k, request[k]])));
    return { key: model, model, mapping: mapped.map(({ opaqueId, caseId }) => ({ opaqueId, caseId })), requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw) };
  });
  const plan = { protocol, witnessHash, originalHash, policyHash: PRODUCT_RUBRIC_HASH_V7, candidates,
    controls: items.slice(12), requests, inputCeiling, outputCeiling, countAllowancePerCallMicros: String(countAllowance),
    twoOtherModelVotesRequiredPerJudge: true, sharedProviderFamilyIndependenceUnproven: true, automaticAdmission: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export function quoteWitnessSourceReviewV1(prepared, receipts) {
  if (digest(prepared.plan) !== prepared.hash || receipts.length !== JUDGES.length) throw new Error('WSR1_SCOPE');
  const rates = { 'gpt-6.1-sol': [2, 10], 'gpt-6.1-terra': [1, 5], 'gpt-6-astra': [10, 50] };
  const quote = { regionalNumerator: '11', regionalDenominator: '10', inputFactorNumerator: '5', inputFactorDenominator: '4',
    models: Object.fromEntries(Object.entries(rates).map(([model, [i, o]]) => [model, { inputMicrosPerMillion: String(i * 1e6), outputMicrosPerMillion: String(o * 1e6) }])) };
  const modelMicros = prepared.plan.requests.reduce((sum, request, i) => {
    const receipt = receipts[i];
    if (receipt.key !== request.key || receipt.requestSha256 !== request.requestSha256 || receipt.countRequestSha256 !== request.countRequestSha256 ||
        !Number.isInteger(receipt.inputTokens) || receipt.inputTokens < 1 || receipt.inputTokens > inputCeiling) throw new Error('WSR1_TOKEN_LIMIT');
    return sum + BigInt(costUpperMicros({ quote }, { modelId: request.model, inputTokenMax: Math.ceil(receipt.inputTokens * 5 / 4), outputTokenMax: outputCeiling }));
  }, 0n);
  return { modelMicros: String(modelMicros), countAllowanceMicros: String(countAllowance * 3n), reserveMicros: String(modelMicros + countAllowance * 3n) };
}

function controlMet(caseId, vote) {
  if (caseId === 'control-false-rule') return vote.grade.explanation === 'fail' && vote.grade.criticalErrors.approveBadGrammar;
  return ['conflicting', 'insufficient'].includes(vote.sourceAdequacy) && ['meaning', 'grammar', 'correction'].some(key => vote.grade[key] === 'uncertain');
}

export function inspectWitnessSourceReviewV1(prepared, records) {
  const { plan, hash } = prepared;
  if (hash !== digest(plan) || records.length !== 3 || new Set(records.map(r => r.key)).size !== 3) throw new Error('WSR1_DENOMINATOR');
  const privateCases = [...plan.candidates, ...plan.controls];
  const reviews = new Map();
  const checks = [];
  for (const request of plan.requests) {
    const record = records.find(r => r.key === request.key);
    if (record?.requestRaw !== request.requestRaw) throw new Error('WSR1_REQUEST_BINDING');
    const { reviews: votes } = validateV3Output(request.requestRaw, record.payloadRaw);
    const aliases = new Set(votes.map(vote => vote.opaqueId));
    if (aliases.size !== request.mapping.length || request.mapping.some(x => !aliases.has(x.opaqueId))) throw new Error('WSR1_ALIASES');
    for (const { caseId, opaqueId } of request.mapping) {
      const row = privateCases.find(x => x.caseId === caseId);
      const vote = votes.find(x => x.opaqueId === opaqueId);
      validateProductGradeV2(vote, { available: row.feedback !== null });
      reviews.set(request.model + '/' + caseId, vote);
      if (row.expectedGrade === null) checks.push({ model: request.model, caseId, passed: controlMet(caseId, vote) });
    }
  }
  const support = plan.candidates.map(row => ({ caseId: row.caseId, appPolicy: boundedProductPolicyV1(row.input, row.feedback),
    byJudge: JUDGES.map(judge => {
      const voters = JUDGES.filter(model => model !== judge);
      return { judge, voters, supported: voters.every(model => {
        const vote = reviews.get(model + '/' + row.caseId);
        return checks.filter(c => c.model === model).every(c => c.passed) && sameGrade(vote.grade, row.expectedGrade) &&
          EVIDENCE_AXES_V2.every(key => vote[key] === row.expectedAxes[key]);
      }) };
    }) }));
  const disagreements = plan.candidates.flatMap(row => JUDGES.flatMap(model => {
    const vote = reviews.get(model + '/' + row.caseId);
    const dimensions = DIMENSIONS.filter(key => vote.grade[key] !== row.expectedGrade[key]);
    const critical = CRITICAL.filter(key => vote.grade.criticalErrors[key] !== row.expectedGrade.criticalErrors[key]);
    const axes = EVIDENCE_AXES_V2.filter(key => vote[key] !== row.expectedAxes[key]);
    return dimensions.length + critical.length + axes.length ? [{ caseId: row.caseId, model, dimensions, critical, axes, evidenceNote: vote.evidenceNote }] : [];
  }));
  return { support, controls: checks, disagreements, passedAcrossJudges: support.filter(x => x.byJudge.every(v => v.supported)).length,
    transportProvenanceRequired: true, automaticAdmission: false, sourceQualified: false, mainDispatchAuthorized: false };
}
