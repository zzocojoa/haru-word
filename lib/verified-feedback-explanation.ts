import type { SentenceFeedback } from './sentence-feedback';
import { clarificationQuestion } from './judgment-policy.ts';
import { verifiedCountUnitNoun } from './judgment-correction.ts';

const subjectForms: Record<string,string> = { him: 'he', her: 'she', me: 'i', us: 'we', them: 'they' };
const objectForms: Record<string,string> = { he: 'him', she: 'her', i: 'me', we: 'us', they: 'them' };
const tokens = (text: string) => text.trim().match(/[a-z]+(?:['’][a-z]+)?|[^\s]/gi) ?? [];
const modalBaseForms: Record<string, string> = { carries: 'carry', swims: 'swim', rests: 'rest', inspects: 'inspect' };
// Require a simple subject and a reviewed verb pair. For example, a compound
// noun such as "water can" does not establish an auxiliary verb.
const modalInflection = /^((?:i|you|he|she|it|we|they|(?:the|these|those|my|our|your|their)[ \t]+(?:child|children|students?|teachers?|workers?))[ \t]+(?:can|could|may|might|must|shall|should|would)[ \t]+(?:not[ \t]+)?)(carries|swims|rests|inspects)((?:[ \t]+[a-z]+)*[.!?]?)$/i;
const avoidClause = /^(i|you|he|she|it|we|they)[ \t]+(avoid|avoids|avoided)[ \t]+(to[ \t]+)?([a-z]+)((?:[ \t]+[a-z]+)*[.!?]?)$/i;
// Use reviewed spellings here rather than treating any -ing ending as a match.
const avoidActionForms: Record<string, string> = {
  call: 'calling', drive: 'driving', open: 'opening', read: 'reading',
  run: 'running', swim: 'swimming', talk: 'talking', use: 'using',
};

function avoidActionRule(original: string, correction: string) {
  const before = avoidClause.exec(original.trim());
  const after = avoidClause.exec(correction.trim());
  if (!before || !after) return;
  const [, originalSubject, originalVerbForm, , originalAction, originalRest] = before;
  const [, correctedSubject, correctedVerb, correctedInfinitive, correctedAction, correctedRest] = after;
  if (correctedInfinitive || originalSubject !== correctedSubject || originalRest !== correctedRest) return;
  if (avoidActionForms[originalAction.toLowerCase()] !== correctedAction.toLowerCase()) return;

  const subject = originalSubject.toLowerCase();
  const originalVerb = originalVerbForm.toLowerCase();
  const presentVerb = /^(?:he|she|it)$/.test(subject) ? 'avoids' : 'avoid';
  const expectedVerb = originalVerb === 'avoided' ? originalVerb : presentVerb;
  if (correctedVerb.toLowerCase() !== expectedVerb) return;

  const actionRule = 'avoid 뒤에 피하는 행동을 나타낼 때는 동사의 -ing형을 써요.';
  if (originalVerb === expectedVerb) return actionRule;
  const subjectLabel = subject === 'i' ? 'I' : subject;
  return `현재형에서 주어 ${subjectLabel}에 맞춰 ${expectedVerb}를 써요. ${actionRule}`;
}

function hasTransferCaseEdits(original: string, correction: string) {
  const before = tokens(original), after = tokens(correction);
  const recipient = before.length - (/^[.!?]$/.test(before.at(-1) ?? '') ? 2 : 1);
  if (before.length !== after.length || recipient < 4 || before[recipient - 1] !== 'to') return false;
  if (!/^(?:gave|handed|sent|showed|passed)$/.test(before[1] ?? '')) return false;
  const subject = before[0], object = before[recipient];
  const correctedSubject = after[0], correctedObject = after[recipient];
  if (!subject || !object || !correctedSubject || !correctedObject) return false;
  if (!/^[A-Z]?[a-z]+$/.test(subject) || !/^(?:I|[a-z]+)$/.test(object)) return false;
  if (subjectForms[subject.toLowerCase()] !== correctedSubject.toLowerCase() || objectForms[object.toLowerCase()] !== correctedObject) return false;
  const directObject = before.slice(2, recipient - 1);
  const nounPhrase = directObject.length >= 2 &&
    /^(?:a|an|the|this|that|these|those|my|his|her|our|their|your)$/.test(directObject[0] ?? '') &&
    directObject.every(token => /^[a-z]+$/i.test(token));
  if (!nounPhrase && !(directObject.length === 1 && directObject[0] === 'it')) return false;
  // Everything except the two role-preserving substitutions must match.
  return before.every((token, index) => index === 0 || index === recipient || token === after[index]);
}

// App-authored facts, based on the reviewed grammar curriculum. Model free-text
// reasons are not a trusted source for teaching a rule. Unmatched edits are compared literally.
export function verifiedCorrectionRule(original: string, correction: string): string | undefined {
  const countedNoun = verifiedCountUnitNoun(original, correction);
  if (countedNoun) {
    return `수량 표현에서 ${countedNoun}는 셀 수 없는 명사예요. 개수를 말할 때는 piece of 또는 item of 같은 단위를 쓰고, 하나보다 많으면 단위를 복수형으로 써요.`;
  }
  const avoidance = avoidActionRule(original, correction);
  if (avoidance) return avoidance;
  // Keep punctuation in the comparison so a second edit cannot disappear.
  // This is a bounded edit matcher, not a syntax or grammaticality validator.
  const before=tokens(original.toLowerCase()),after=tokens(correction.toLowerCase());
  let start=0,endBefore=before.length,endAfter=after.length;
  while(start<endBefore&&start<endAfter&&before[start]===after[start])start++;
  while(endBefore>start&&endAfter>start&&before[endBefore-1]===after[endAfter-1]){endBefore--;endAfter--;}
  const removed=before.slice(start,endBefore),added=after.slice(start,endAfter),previous=before[start-1];
  if(!removed.length&&added.length===1&&added[0]==='to'&&/^[a-z]+$/.test(before[start]??'')){
    if(/^(?:want|wants|wanted|need|needs|needed)$/.test(previous??''))return 'want·need 뒤에서 하려는 행동을 나타낼 때는 to + 동사원형을 사용할 수 있어요.';
    if(previous==='listen')return '듣는 대상을 listen 뒤에 연결할 때는 보통 to를 함께 써요.';
  }
  // Recognize a reviewed pair of edits when one rule explains both roles.
  if(removed.length!==1||added.length!==1){
    if(hasTransferCaseEdits(original,correction))return '주어 자리에는 주격을 쓰고, 전치사 to 뒤에는 목적격을 써요.';
    return;
  }
  const from=removed[0],to=added[0];
  const modalEdit = modalInflection.exec(original.trim());
  if (modalEdit && modalEdit[2] === from && modalBaseForms[from] === to && `${modalEdit[1]}${to}${modalEdit[3]}` === correction.trim()) {
    return '법조동사 다음의 동사는 주어와 관계없이 동사원형을 써요.';
  }
  if(start===1&&previous==='they'&&from==='is'&&to==='are')return '주어 they에 현재형 be동사를 맞출 때는 are를 써요.';
  if(start===1&&['he','she','it'].includes(previous)&&from==='are'&&to==='is')return '주어 he·she·it에 현재형 be동사를 맞출 때는 is를 써요.';
  if(start===0&&subjectForms[from]===to)return '대명사는 문장에서 쓰이는 자리에 따라 주격과 목적격 형태를 구분해요.';
  // These rules name the simple past, so do not attach them to a perfect,
  // passive or otherwise unsupported auxiliary construction.
  if(/\b(?:have|has|had|be|been|being|am|is|are|was|were)\b/.test(before.slice(0,start).join(' ')))return;
  if(from==='buyed'&&to==='bought')return 'buy의 과거형은 bought예요. 불규칙 변화이므로 buyed로 만들지 않아요.';
  if(from==='goed'&&to==='went')return 'go의 과거형은 went예요. 불규칙 변화예요.';
  if(from==='eated'&&to==='ate')return 'eat의 과거형은 ate예요. 과거분사 eaten과 구분해요.';
}

// A reviewed form error can be certain even when the learner's intended repair is open.
// Restrict this to short, unquoted clause shapes and forms with no bare-verb reading here.
const modalFormError = /^(?:i|you|he|she|it|we|they)[ \t]+(?:can|could|may|might|must|shall|should|will|would)[ \t]+(?:brought|bought|went|took|written|eaten|sent|seen)(?:[ \t]+[a-z]+)*[.!?]?$/i;
const demonstrativeFormError = /^(?:these|those)[ \t]+(?:car|book|dog|cat|student|chair|box|bottle|ticket)[ \t]+(?:is|was|belongs|seems|looks|has)(?:[ \t]+[a-z]+)*[.!?]?$/i;

export function verifiedWithheldGrammarIssue(feedback: Pick<SentenceFeedback,'grammar'|'correctedSentence'>, original: string, question: string) {
  if (feedback.grammar === 'natural' || feedback.correctedSentence) return;
  const sentence = original.trim();
  if (question === clarificationQuestion('time') && modalFormError.test(sentence)) return '조동사 바로 뒤에는 동사원형이 필요해요.';
  if (question === clarificationQuestion('quantity') && demonstrativeFormError.test(sentence)) return 'these·those가 가리키는 명사는 복수형이어야 해요.';
}

export const TARGET_NEEDS_WORK_EXPLANATION = 'AI는 원문이 목표 표현의 사용 기준에 맞지 않는다고 보았어요.';

export function verifiedFeedbackExplanation(feedback: Pick<SentenceFeedback,'meaningUsage'|'grammar'|'correctedSentence'>, original: string, question = '') {
  const target = { appropriate: 'AI는 목표 표현의 사용을 적절하다고 보았어요.', needs_work: TARGET_NEEDS_WORK_EXPLANATION, uncertain: '목표 사용은 문맥이 더 있어야 판단할 수 있어요.' };
  const grammar = { natural: 'AI의 문법 의견에는 수정 제안이 없어 원문을 그대로 두었어요.', needs_work: 'AI는 원문 문법에 보완을 제안했어요. 아래의 원문과 교정문을 비교해 주세요.', uncertain: '원문의 문법 판단에는 문맥이 더 필요해 교정문을 보류했어요.' };
  const knownIssue = verifiedWithheldGrammarIssue(feedback, original, question);
  const withheldRepair = feedback.grammar === 'needs_work' && !feedback.correctedSentence && !!question;
  const intentRepair = feedback.grammar === 'natural' && !!feedback.correctedSentence && feedback.correctedSentence !== original.trim();
  const grammarExplanation = intentRepair ? 'AI는 원문 문법에는 수정이 필요하지 않다고 보았어요. 교정 제안은 전달하려는 뜻을 비교해 주세요.' : withheldRepair
    ? `${knownIssue ? knownIssue + ' ' : ''}AI는 원문 문법에 보완이 필요하다고 보았어요. 의도에 맞게 고칠 문맥이 더 필요해 교정문을 보류했어요.`
    : knownIssue ? `${knownIssue} ${grammar[feedback.grammar]}` : grammar[feedback.grammar];
  const lines = [`목표: ${target[feedback.meaningUsage]}`, `문법: ${grammarExplanation}`];
  const correction = feedback.correctedSentence;
  if (correction && correction !== original.trim()) {
    const rule = intentRepair ? undefined : verifiedCorrectionRule(original, correction);
    lines.push(rule ? `교정 참고: ${rule}` : '교정: 실제 바뀐 표현을 비교해 주세요. 이 변경에 대한 세부 문법 규칙은 확인된 범위를 넘어 단정하지 않아요.');
  }
  if (question) lines.push('추가 문맥: '+question);
  return lines.join('\n');
}
