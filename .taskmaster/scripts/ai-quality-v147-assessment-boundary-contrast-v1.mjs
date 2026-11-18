import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeAssessmentInputV1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { compileAssessmentBoundariesV1, parseAssessmentBoundariesV1 } from './ai-quality-v147-assessment-boundaries-v1.mjs';
import { digest, JUDGES, sameGrade } from './ai-quality-v147-calibration.mjs';
import { meaningContrastBudgetV1 } from './ai-quality-v147-meaning-contrast-v1.mjs';
import { reviseTargetMeaningRequestV1 } from './ai-quality-v147-target-meaning-v1.mjs';
import { parseTargetMeaningPayloadV2, PRODUCT_RUBRIC_HASH_V7 } from './ai-quality-v147-target-meaning-v2.mjs';

const protocol = 'ai-quality-v147-assessment-boundary-contrast-v1';
const sha = value => createHash('sha256').update(value).digest('hex');
const templateHash = 'ea36a01152724b3e69653bfb8eb0bc160a6c04d9dd6536e88f11d4875c1aa427';
const phase95Hash = '68bce1020d88bc8565c73690f28ac2e6de329a53a6fe3479094d4b30c6a6e9cc';
const limit = 8000;

function feedback(original, correctedSentence, explanation, approves = false) {
  return { original, correctedSentence, explanation, meaningUsage: approves ? 'appropriate' : 'needs_work', grammar: approves ? 'natural' : 'needs_work' };
}

function expected({ approvesBadForm = false, correction = 'pass', needsContext = false, repairContext = 'sufficient', assignmentForm = 'not_specified' } = {}) {
  const grade = approvesBadForm ? 'fail' : 'pass';
  return {
    grade: { meaning: grade, grammar: grade, correction, explanation: grade, abstention: needsContext ? 'fail' : 'pass',
      criticalErrors: { approveBadGrammar: approvesBadForm, reverseMeaning: false, swapRoles: false, inventedIntent: false } },
    sourceAdequacy: 'sufficient', learnerContext: needsContext ? 'missing' : 'sufficient',
    abstentionNeed: needsContext ? 'required' : 'not_required', repairContext, assignmentForm,
  };
}

function contrastCases() {
  const time = 'Maya might left the key in the drawer.';
  const timeFeedback = feedback(time, 'Maya might have left the key in the drawer.', '과거의 가능성을 나타낼 때 might have 뒤에는 과거분사를 씁니다.');
  const person = 'The editor returned the file to we.';
  const form = 'Close gate the.';
  const formFeedback = feedback(form, 'Close the gate.', '교정문은 문을 닫으라는 명령문입니다.');
  const sharedIntent = ' The intended message is that you want the other person to close the gate.';
  return [
    { id: 'time-open', family: 'time', anchor: 'V5-MC02', sentence: time, target: 'Use a grammatical modal construction.', feedback: timeFeedback,
      expected: expected({ correction: 'uncertain', needsContext: true, repairContext: 'missing' }) },
    { id: 'time-specified', family: 'time', anchor: 'V5-MC02', sentence: time, target: 'Use a grammatical modal construction.', feedback: timeFeedback,
      contextNote: 'This is a guess about where Maya left the key yesterday.', expected: expected() },
    { id: 'object-approval', family: 'claim', anchor: 'V5-MC08', sentence: person, target: 'Use object pronouns after a preposition.',
      feedback: feedback(person, person, '전치사 to 뒤에 주격 we를 그대로 쓰는 것이 문법에 맞아요.', true),
      expected: expected({ approvesBadForm: true, correction: 'fail', repairContext: 'not_applicable', assignmentForm: 'not_applicable' }) },
    { id: 'object-repair', family: 'claim', anchor: 'V5-MC08', sentence: person, target: 'Use object pronouns after a preposition.',
      feedback: feedback(person, 'The editor returned the file to us.', '전치사 to 뒤에 목적격 us를 씁니다.'), expected: expected() },
    { id: 'form-permitted', family: 'form', anchor: 'V5-MC08', sentence: form, target: 'Put the article before the noun gate.', feedback: formFeedback,
      contextNote: 'Use one imperative sentence.' + sharedIntent, expected: expected({ assignmentForm: 'complies' }) },
    { id: 'form-excluded', family: 'form', anchor: 'V5-MC08', sentence: form, target: 'Put the article before the noun gate.', feedback: formFeedback,
      contextNote: 'Use one declarative sentence.' + sharedIntent, expected: expected({ correction: 'fail', assignmentForm: 'violates' }) },
  ];
}

export function prepareAssessmentBoundaryContrastV1(evidenceRoot) {
  const archived = readFileSync(resolve(evidenceRoot, 'phase78/actual-prepared.json'), 'utf8');
  const prior = readFileSync(resolve(evidenceRoot, 'phase95/progress-final.json'));
  if (sha(archived) !== templateHash || sha(prior) !== phase95Hash) throw new Error('ABC1_FROZEN_SOURCE');
  const original = JSON.parse(archived).plan;
  const cases = contrastCases();
  if (cases.some(row => original.bank.rows.some(x => x.input.sentence === row.sentence))) throw new Error('ABC1_PRIOR_SURFACE');
  const requests = [];
  let candidateHash;
  for (const [i, row] of cases.entries()) {
    const requestInput = { sentence: row.sentence, target: row.target, targetCriterion: row.target, role: '', pattern: '', task: '', check: '', stem: '' };
    if (row.contextNote) Object.assign(requestInput, { contextKind: 'sentence', contextNote: row.contextNote });
    const input = normalizeAssessmentInputV1(requestInput, { domain: 'grammar', requestInput, origin: 'hypothetical-calibration' });
    for (const [j, model] of JUDGES.entries()) {
      const layout = (Math.floor(i / 2) + j) % 2 === 0 ? 'input-first' : 'feedback-first';
      const template = original.requests.find(x => x.caseId === row.anchor && x.model === model && x.layout === layout);
      if (!template) throw new Error('ABC1_TEMPLATE');
      const body = JSON.parse(template.requestRaw);
      const packet = JSON.parse(body.input[0].content);
      const data = packet.EVALUATION_DATA;
      data.input = input;
      data.feedback = row.feedback;
      if (row.anchor === 'V5-MC08') data.reference.sources = data.reference.sources.filter(x => x.url.includes('/personal-pronouns'));
      if (data.reference.sources.length === 0) throw new Error('ABC1_SOURCE');
      body.input[0].content = JSON.stringify(packet);
      const baseRequestRaw = reviseTargetMeaningRequestV1(JSON.stringify(body));
      const { comparisonRequestRaw, requestRaw: candidate, policyHash } = compileAssessmentBoundariesV1(baseRequestRaw);
      if (candidateHash && candidateHash !== policyHash) throw new Error('ABC1_POLICY_HASH');
      candidateHash = policyHash;
      for (const [version, requestRaw] of [[7, comparisonRequestRaw], [8, candidate]]) {
        const wire = JSON.parse(requestRaw);
        const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, wire[key]])));
        requests.push({ key: `${row.id}/${model}/v${version}`, caseId: row.id, version, model, layout, requestRaw,
          requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw), ...(version === 8 ? { baseRequestRaw } : {}) });
      }
    }
  }
  requests.sort((a, b) => sha(protocol + a.key).localeCompare(sha(protocol + b.key)));
  const plan = { protocol, templateHash, phase95Hash, cases, requests, rubricHashes: { 7: PRODUCT_RUBRIC_HASH_V7, 8: candidateHash },
    countCeiling: limit, outputCeiling: 1024, families: 3, isConfirmationHoldout: false, liveDispatchAuthorized: false };
  const prepared = { plan, hash: digest(plan) };
  const upper = meaningContrastBudgetV1(prepared, requests.map(request => ({ ...request, inputTokens: limit })));
  return { ...prepared, upper };
}

export function inspectAssessmentBoundaryContrastV1(prepared, records) {
  const { plan } = prepared;
  const byKey = new Map(records.map(record => [record.key, record]));
  if (prepared.hash !== digest(plan) || records.length !== plan.requests.length || byKey.size !== plan.requests.length) throw new Error('ABC1_DENOMINATOR');
  const scores = new Map();
  for (const request of plan.requests) {
    const record = byKey.get(request.key);
    if (!record || record.requestRaw !== request.requestRaw) throw new Error('ABC1_REQUEST_BINDING');
    const { expected: want } = plan.cases.find(x => x.id === request.caseId);
    const result = request.version === 8 ? parseAssessmentBoundariesV1({ ...record, baseRequestRaw: request.baseRequestRaw }) : parseTargetMeaningPayloadV2(record);
    const coreMatch = sameGrade(result.grade, want.grade) && ['sourceAdequacy', 'learnerContext', 'abstentionNeed'].every(key => result[key] === want[key]);
    const newAxesMatch = request.version === 8 ? result.repairContext === want.repairContext && result.assignmentForm === want.assignmentForm : null;
    scores.set(request.key, { coreMatch, newAxesMatch, policyCompliance: result.policyCompliance });
  }
  const pairs = plan.requests.filter(x => x.version === 8).map(request => {
    const before = scores.get(request.key.replace(/\/v8$/, '/v7'));
    const after = scores.get(request.key);
    if (digest(before.policyCompliance) !== digest(after.policyCompliance)) throw new Error('ABC1_POLICY_CHANGED');
    return { caseId: request.caseId, model: request.model, before: before.coreMatch, after: after.coreMatch, newAxes: after.newAxesMatch };
  });
  const improvements = pairs.filter(x => !x.before && x.after).length;
  const regressions = pairs.filter(x => x.before && !x.after).length;
  return { pairs, improvements, regressions, candidatePasses: pairs.filter(x => x.after && x.newAxes).length,
    diagnosticImprovement: improvements > 0 && pairs.every(x => x.after && x.newAxes), sourceQualified: false, mainDispatchAuthorized: false };
}
