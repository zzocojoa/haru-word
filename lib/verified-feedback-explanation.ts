import type { SentenceFeedback } from './sentence-feedback';

// App-authored facts, based on the reviewed grammar curriculum. Model free-text
// reasons are not a trusted source for teaching a rule. Unmatched edits are compared literally.
export function verifiedCorrectionRule(original: string, correction: string): string | undefined {
  if (/\b(?:want|wants|wanted|need|needs|needed)\s+(?!to\b)[a-z]+/i.test(original)
    && /\b(?:want|wants|wanted|need|needs|needed)\s+to\s+[a-z]+/i.test(correction)) return 'want·need 뒤에서 하려는 행동을 나타낼 때는 to + 동사원형을 사용할 수 있어요.';
  if (/^they\s+is\b/i.test(original) && /^they\s+are\b/i.test(correction)) return '주어 they에 현재형 be동사를 맞출 때는 are를 써요.';
  if (/^(?:he|she|it)\s+are\b/i.test(original) && /^(?:he|she|it)\s+is\b/i.test(correction)) return '주어 he·she·it에 현재형 be동사를 맞출 때는 is를 써요.';
  if (/^(?:him|her|me|us|them)\b/i.test(original) && /^(?:he|she|i|we|they)\b/i.test(correction)) return '대명사는 문장에서 쓰이는 자리에 따라 주격과 목적격 형태를 구분해요.';
  if (/\bbuyed\b/i.test(original) && /\bbought\b/i.test(correction)) return 'buy의 과거형은 bought예요. 불규칙 변화이므로 buyed로 만들지 않아요.';
  if (/\bgoed\b/i.test(original) && /\bwent\b/i.test(correction)) return 'go의 과거형은 went예요. 불규칙 변화예요.';
  if (/\beated\b/i.test(original) && /\bate\b/i.test(correction)) return 'eat의 과거형은 ate예요. 과거분사 eaten과 구분해요.';
  if (/\blisten\s+(?!to\b)/i.test(original) && /\blisten\s+to\b/i.test(correction)) return '듣는 대상을 listen 뒤에 연결할 때는 보통 to를 함께 써요.';
  if (/\b(?:am|is|are|was|were)\s+\w+ing\b/i.test(correction)) return '진행형에서는 be동사와 동사의 -ing 형태가 함께 동사구를 이루어요.';
}
export function verifiedFeedbackExplanation(feedback: Pick<SentenceFeedback,'meaningUsage'|'grammar'|'correctedSentence'>, original: string, question = '') {
  const target = { appropriate: 'AI는 목표 표현의 사용을 적절하다고 보았어요.', needs_work: 'AI는 목표 뜻·용법을 별도로 확인할 필요가 있다고 보았어요.', uncertain: '목표 사용은 문맥이 더 있어야 판단할 수 있어요.' };
  const grammar = { natural: 'AI의 문법 의견에는 수정 제안이 없어 원문을 그대로 두었어요.', needs_work: 'AI는 원문 문법에 보완을 제안했어요. 아래의 원문과 교정문을 비교해 주세요.', uncertain: '책임 있게 교정할 문맥이 부족해 교정문을 보류했어요.' };
  const lines = [`목표: ${target[feedback.meaningUsage]}`, `문법: ${grammar[feedback.grammar]}`];
  const correction = feedback.correctedSentence;
  if (correction && correction !== original.trim()) {
    const rule = verifiedCorrectionRule(original, correction);
    lines.push(rule ? `교정 참고: ${rule}` : '교정: 실제 바뀐 표현을 비교해 주세요. 이 변경에 대한 세부 문법 규칙은 확인된 범위를 넘어 단정하지 않아요.');
  }
  if (question) lines.push('추가 문맥: '+question);
  return lines.join('\n');
}
