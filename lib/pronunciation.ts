import rawGuide from '@/data/pronunciation-guide.json';
import type {Word} from './learning/model';

export type PronunciationGuide = {
  word:string; pos:string; meaning:string;
  variants:{ipa:string; usage:string}[];
  note:string; url:string; reviewedAt:string;
};
export const PRONUNCIATION_GUIDE = rawGuide as Record<string,PronunciationGuide>;
const riskWords = new Set(Object.values(PRONUNCIATION_GUIDE).map(entry=>entry.word));

// A catalog ID alone cannot identify a user-edited or historical sense.
export function pronunciationFor(word:Word, meaning:string) {
  const guide = PRONUNCIATION_GUIDE[word.id];
  if (!word.personal && guide && guide.word===word.word && guide.pos===word.pos &&
      guide.meaning.trim()===meaning.trim()) return {kind:'reviewed', guide} as const;
  if (riskWords.has(word.word.trim().toLowerCase())) return {kind:'dictionary'} as const;
  return {kind:'device'} as const;
}

export function familyMeaningNote(word:string) {
  return ['brother','sister'].includes(word.trim().toLowerCase())
    ? '가족 관계에서 brother/sister 자체는 나이를 정하지 않아요. younger는 어린, older는 나이가 더 많은 형제를 뜻해요.'
    : undefined;
}
