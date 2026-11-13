import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boundedProductPolicyV1, normalizeAssessmentInputV1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { costUpperMicros } from './ai-quality-v147-budget.mjs';
import { digest, JUDGES } from './ai-quality-v147-calibration.mjs';
import { parseTargetMeaningPayloadV1, PRODUCT_RUBRIC_HASH_V6, reviseTargetMeaningRequestV1 } from './ai-quality-v147-target-meaning-v1.mjs';
import { parseTargetMeaningPayloadV2, PRODUCT_RUBRIC_HASH_V7, reviseTargetMeaningRequestV2 } from './ai-quality-v147-target-meaning-v2.mjs';

const protocol = 'ai-quality-v147-meaning-contrast-v1';
const baseHash = 'ea36a01152724b3e69653bfb8eb0bc160a6c04d9dd6536e88f11d4875c1aa427';
const priceHash = 'd0d845be62058435461dbb00b85f38fe794278f8b371fb8ee3e9b066312728d4';
const rates = { 'gpt-6.1-sol': [2, 10], 'gpt-6.1-terra': [1, 5], 'gpt-6-astra': [10, 50] };
const sha = raw => createHash('sha256').update(raw).digest('hex');
const countCeiling = 8000;
const countAllowance = 35000n;

function unchanged(sentence, explanation) {
  return { original: sentence, meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: sentence, explanation };
}

function musicInput(sentence, contextKind = 'sentence', contextNote = '') {
  return { word: 'music', pos: 'n.', meaning: '음악', expression: 'music', sentence, contextKind, contextNote };
}

function controls() {
  const phrase = 'Behind the music';
  const phraseFeedback = unchanged(phrase, 'music은 전치사 behind가 이끄는 구에서 명사로 쓰였습니다.');
  const verb = 'My cousin go to the library.';
  const verbFeedback = { original: verb, meaningUsage: 'appropriate', grammar: 'needs_work', correctedSentence: 'My cousin goes to the library.', explanation: '현재형에서 단수 주어 my cousin에는 goes를 사용합니다.' };
  const criterion = 'In a present-simple affirmative clause, use third-person singular verb agreement.';
  const used = 'Music can make a room feel calmer.';
  const derived = 'The show was musical.';
  return [
    { id: 'message-sentence', domain: 'word', anchor: 'V5-MC08', request: musicInput(phrase, 'sentence', 'Write a complete declarative clause. The intended message is not specified.'), feedback: phraseFeedback, meaning: 'pass', policy: 'fail' },
    { id: 'message-title', domain: 'word', anchor: 'V5-MC08', request: musicInput(phrase, 'title', 'Title for a feature about the making of an album.'), feedback: phraseFeedback, meaning: 'pass', policy: 'pass' },
    { id: 'inflection-word', domain: 'word', anchor: 'V5-MC05', request: { word: 'go', pos: 'v.', meaning: '가다', expression: 'go', sentence: verb }, feedback: verbFeedback, meaning: 'pass', policy: 'pass' },
    { id: 'inflection-grammar', domain: 'grammar', anchor: 'V5-MC05', request: { sentence: verb, target: criterion, targetCriterion: criterion, role: '', pattern: '', task: '', check: '', stem: '' }, feedback: verbFeedback, meaning: 'fail', policy: 'pass' },
    { id: 'lexical-noun', domain: 'word', anchor: 'V5-MC08', request: musicInput(used), feedback: unchanged(used, 'music은 음악을 뜻하는 명사입니다.'), meaning: 'pass', policy: 'pass' },
    { id: 'lexical-derived', domain: 'word', anchor: 'V5-MC08', request: musicInput(derived), feedback: unchanged(derived, '이 문장의 musical은 보어로 쓰였습니다.'), meaning: 'fail', policy: 'pass' },
  ];
}

export function prepareMeaningContrastV1(evidenceRoot) {
  const frozen = readFileSync(resolve(evidenceRoot, 'phase78/actual-prepared.json'), 'utf8');
  if (sha(frozen) !== baseHash) throw new Error('MC1_FROZEN_TEMPLATE');
  const prices = readFileSync(resolve(evidenceRoot, 'phase88/official-pricing.json'), 'utf8');
  if (sha(prices) !== priceHash) throw new Error('MC1_FROZEN_PRICES');
  const prior = JSON.parse(frozen).plan;
  const hypotheses = controls();
  const requests = [];
  for (const [i, row] of hypotheses.entries()) {
    const { sentence, contextKind = 'sentence', contextNote } = row.request;
    const target = row.domain === 'word' ? `word ${row.request.word}/${row.request.pos} ${row.request.meaning}` : row.request.target;
    const input = normalizeAssessmentInputV1({ sentence, target, contextKind, contextNote }, { domain: row.domain, requestInput: row.request, origin: 'hypothetical-calibration' });
    if (boundedProductPolicyV1(input, row.feedback).state !== row.policy) throw new Error(`MC1_POLICY_CONTRAST: ${row.id}`);
    if (prior.bank.rows.some(x => x.input.sentence === sentence)) throw new Error('MC1_PRIOR_CONTROL_SURFACE');
    for (const [j, model] of JUDGES.entries()) {
      const layout = (Math.floor(i / 2) + j) % 2 === 0 ? 'input-first' : 'feedback-first';
      const template = prior.requests.find(x => x.caseId === row.anchor && x.model === model && x.layout === layout);
      const body = JSON.parse(template.requestRaw);
      const packet = JSON.parse(body.input[0].content);
      packet.EVALUATION_DATA.input = input;
      packet.EVALUATION_DATA.feedback = row.feedback;
      body.input[0].content = JSON.stringify(packet);
      const v6 = reviseTargetMeaningRequestV1(JSON.stringify(body));
      const v7 = reviseTargetMeaningRequestV2(v6);
      for (const [version, requestRaw] of [[6, v6], [7, v7]]) {
        const wire = JSON.parse(requestRaw);
        const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, wire[key]])));
        requests.push({ key: `${row.id}/${model}/v${version}`, caseId: row.id, version, model, layout, requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw) });
      }
    }
  }
  requests.sort((a, b) => sha(protocol + a.key).localeCompare(sha(protocol + b.key)));
  const plan = { protocol, templateSha256: baseHash, priceEvidenceSha256: priceHash, rates: structuredClone(rates), rubricHashes: { 6: PRODUCT_RUBRIC_HASH_V6, 7: PRODUCT_RUBRIC_HASH_V7 }, hypotheses, requests, countCeiling, outputCeiling: 1024, countAllowancePerCallMicros: String(countAllowance), status: 'prepared-development-only', liveDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

export function meaningContrastBudgetV1(prepared, receipts) {
  if (prepared.hash !== digest(prepared.plan) || receipts.length !== prepared.plan.requests.length) throw new Error('MC1_BUDGET_BINDING');
  const quote = {
    models: Object.fromEntries(JUDGES.map(model => [model, { inputMicrosPerMillion: String(rates[model][0] * 1e6), outputMicrosPerMillion: String(rates[model][1] * 1e6) }])),
    regionalNumerator: '11', regionalDenominator: '10', inputFactorNumerator: '5', inputFactorDenominator: '4',
  };
  const generation = prepared.plan.requests.reduce((total, request, i) => {
    const receipt = receipts[i];
    if (receipt.key !== request.key || receipt.countRequestSha256 !== request.countRequestSha256 || receipt.requestSha256 !== request.requestSha256 || !Number.isInteger(receipt.inputTokens) || receipt.inputTokens < 1 || receipt.inputTokens > countCeiling) throw new Error('MC1_INPUT_BOUND');
    return total + BigInt(costUpperMicros({ quote }, { modelId: request.model, inputTokenMax: Math.ceil(receipt.inputTokens * 5 / 4), outputTokenMax: prepared.plan.outputCeiling }));
  }, 0n);
  const count = BigInt(receipts.length) * countAllowance;
  return { generationMicros: String(generation), countAllowanceMicros: String(count), totalMicros: String(generation + count) };
}

export function inspectMeaningContrastV1(prepared, records) {
  const { plan, hash } = prepared;
  if (hash !== digest(plan) || records.length !== plan.requests.length || new Set(records.map(x => x.key)).size !== records.length) throw new Error('MC1_DENOMINATOR');
  const rows = plan.requests.map(request => {
    const record = records.find(x => x.key === request.key);
    if (record?.requestRaw !== request.requestRaw) throw new Error('MC1_REQUEST_BINDING');
    const parse = request.version === 6 ? parseTargetMeaningPayloadV1 : parseTargetMeaningPayloadV2;
    const result = parse(record);
    const expected = plan.hypotheses.find(x => x.id === request.caseId);
    if (result.policyCompliance.state !== expected.policy) throw new Error('MC1_POLICY_DRIFT');
    return { caseId: request.caseId, model: request.model, layout: request.layout, version: request.version, grade: result.grade, policyCompliance: result.policyCompliance, expectedMeaning: expected.meaning, meaningMatched: result.grade.meaning === expected.meaning };
  });
  const pairs = rows.filter(r => r.version === 7).map(candidate => ({
    baseline: rows.find(r => r.version === 6 && r.caseId === candidate.caseId && r.model === candidate.model), candidate,
  }));
  const candidateMatched = pairs.filter(p => p.candidate.meaningMatched).length;
  const messageBoundaryGains = pairs.filter(p => p.candidate.caseId === 'message-sentence' && !p.baseline.meaningMatched && p.candidate.meaningMatched).length;
  return { pairs, candidateMatched, baselineMatched: pairs.filter(p => p.baseline.meaningMatched).length, pairedDenominator: pairs.length, messageBoundaryGains, localMeaningRuleMet: candidateMatched === pairs.length && messageBoundaryGains > 0, sourceQualified: false, mainDispatchAuthorized: false };
}
