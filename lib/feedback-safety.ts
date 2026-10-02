import type { SentenceFeedback } from './sentence-feedback';

export const FEEDBACK_SAFETY_REASONS = ['progressive_role', 'preposition_object'] as const;
export type FeedbackSafetyReason = typeof FEEDBACK_SAFETY_REASONS[number];

// This detects specific contradictions, not all English errors. Keep it outside
// persistence schemas and frozen evaluation contracts: old records stay intact.
// A short complete clause only: longer complements can change the analysis
// (We are teaching staff / I am working class). Do not guess their structure.
const progressive = /^(?:I\s+(?:am|was)|(?:he|she)\s+(?:is|was)|(?:you|we|they)\s+(?:are|were)|I['’]m|(?:you|we|they)['’]re|(?:he|she)['’]s)\s+(?:(?:not|now|still|currently)\s+){0,2}(writing|reading|playing|sleeping|studying|swimming|walking|talking|listening|learning|eating|drinking|cooking|driving|waiting|watching|using|making|doing|speaking|teaching|looking)[.!?]?$/i;
// Restrict this check to arrive + at/in. A preposition-looking prefix alone
// cannot establish a direct-object error (about a week / for ... to / titles).
const arrival = /\barriv(?:e|es|ed|ing)\s+$/i;
const arrivalPreposition = /^(?:at|in)\s+(?:the|a|an|my|your|his|her|its|our|their|this|that|these|those|me|him|us|them)\b/;
const quote = /["'“”‘’]/;

export function feedbackSafetyIssue(feedback: SentenceFeedback): FeedbackSafetyReason | undefined {
  const structure = feedback.structure;
  if (structure?.status !== 'available') return;
  const sentence = feedback.correctedSentence.trim();
  const match = sentence.match(progressive);
  // Exclude proper names such as Reading; this is not a POS tagger.
  const action = match && match[1] === match[1].toLowerCase() ? match[1] : undefined;
  const verbStart = action ? sentence.lastIndexOf(action) : -1;
  const verbEnd = action ? verbStart + action.length : -1;
  let cursor = 0;
  const spans = [];
  for (let i = 0; i < structure.parts.length; i++) {
    const part = structure.parts[i];
    const start = sentence.indexOf(part.text, cursor);
    if (start < 0) return; // Literal integrity remains the schema's responsibility.
    const end = start + part.text.length;
    cursor = end;
    spans.push({ start, end, role: part.role });
  }
  // Overlap rather than containment also catches a word split into several parts.
  if (action && spans.some(part => part.start < verbEnd && part.end > verbStart && part.role !== 'V')) return 'progressive_role';
  for (let i = 0; i < spans.length; i++) {
    const part = spans[i];
    if (part.role !== 'O') continue;
    const start = part.start;
    let end = part.end;
    // Restore consecutive O spans using the original text, without merging a
    // modifier inside an already-started noun object into a new object.
    while (spans[i + 1]?.role === 'O') end = spans[++i].end;
    if (start > 0 && !/\s/.test(sentence[start - 1]) && !quote.test(sentence[start - 1])) continue;
    // A quoted phrase can be the object of say/write/discuss. Do not reinterpret
    // quoted language, including quotes that were split into separate parts.
    if (quote.test(sentence[start - 1] ?? '') || quote.test(sentence[end] ?? '')) continue;
    const object = sentence.slice(start, end);
    if (arrival.test(sentence.slice(0, start)) && arrivalPreposition.test(object)) return 'preposition_object';
  }
}

export const FEEDBACK_SAFETY_GUIDANCE = {
  progressive_role: {
    explanation: '진행형의 본동사를 다른 문장 성분으로 표시한 설명이 있어 AI 교정과 설명을 보류했어요.',
    lesson: '진행형에서는 be동사와 본동사의 -ing 형태가 함께 동사구를 이루어요.',
    source: 'https://dictionary.cambridge.org/grammar/british-grammar/present-continuous',
  },
  preposition_object: {
    explanation: 'arrive 뒤의 전치사구를 동사의 직접목적어로 표시한 설명이 있어 AI 교정과 설명을 보류했어요.',
    lesson: '전치사구 전체와 동사의 직접목적어는 구분해야 해요. 전치사 뒤의 명사구는 그 전치사의 목적어예요.',
    source: 'https://dictionary.cambridge.org/us/grammar/british-grammar/prepositional-phrases',
  },
} as const;
