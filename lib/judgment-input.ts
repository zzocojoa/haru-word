// Bounded, independent evidence of an incomplete sentence-writing input.
// This is not a POS tagger or a general grammar oracle. Context can justify a short answer.
// Only reviewed nominal fragments are independently withheld. An unknown
// single word can be a valid imperative; its judgment belongs to the model.
const nominalFragments = new Set('music furniture information equipment'.split(' '));
export function insufficientInput(original: string, contextKind = 'sentence'): 'single_fragment'|'quantity_fragment'|'word_list'|'relation_fragment'|'location_fragment'|undefined {
  // Only a separate learner-selected kind licenses fragments. Free-text mentions,
  // negations and quoted instructions never change this independent decision.
  if (['reply','title','command'].includes(contextKind)) return;
  const text = original.trim(), words = text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?|\d+/g) ?? [];
  if (!words.length) return 'single_fragment';
  if (words.length === 1 && nominalFragments.has(words[0]) && !/[!?]$/.test(text)) return 'single_fragment';
  // Token count or membership in a verb dictionary is not proof of a list:
  // Give help / Enjoy sleep have nominal complements; Go read has a bare verb.
  // Delegate undelimited strings to the model without forcing either judgment.
  // Explicit list syntax and the reviewed incomplete forms remain bounded guards.
  // Bounded evidence only: a relation/location head + article + one nominal
  // token cannot contain the missing main proposition in sentence-writing mode.
  // Do not expand this into a general POS or finite-clause detector.
  if (/^(?:although|because|unless|if|while|when|since)\s+(?:a|an|the)\s+[a-z]+[.!?…\s]*$/i.test(text)) return 'relation_fragment';
  if (/^(?:under|behind|beside|inside|outside|above|below|between)\s+(?:a|an|the)\s+[a-z]+[.!?…\s]*$/i.test(text)) return 'location_fragment';
  if (/^(?:exactly|about|almost|only|nearly|over|under|at least)\s+(?:\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty)(?:[.!?…\s]*)$/i.test(text)) return 'quantity_fragment';
  if (text.includes('/') && words.length <= 6 && !/\b(?:i|you|he|she|we|they|is|are|was|were|can|will)\b/i.test(text)) return 'word_list';
}
export const missingContextQuestion = '짧은 답변·제목인가요, 아니면 누가 무엇을 하는지 나타내는 문장을 쓰려던 건가요? 의도한 문맥을 알려 주세요.';
