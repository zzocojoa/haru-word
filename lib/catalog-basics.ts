import rawWords from '../data/words.json' with { type: 'json' };
import basics from '../data/catalog-basics.json' with { type: 'json' };
import type { Progress, Word } from './learning/model.ts';

// Generated from the same reviewed textbook as the full material. The build
// verifies both source hashes before this smaller initial catalog is used.
export const WORDS = rawWords as Word[];
export const WORD_MAP = new Map(WORDS.map(word => [word.id, word]));
const meanings: Record<string, string> = basics.meanings;
export function cardMeaning(id: string, progress?: Progress): string {
  return progress?.meaning ?? (Object.hasOwn(meanings, id) ? meanings[id] : '');
}
export function dictionaryUrl(word: string) { return 'https://www.oxfordlearnersdictionaries.com/search/american_english/direct/?q=' + encodeURIComponent(word === 'a, an' ? 'a' : word); }
export function koreanDictionaryUrl(word: string) { return 'https://en.dict.naver.com/#/search?query=' + encodeURIComponent(word === 'a, an' ? 'a' : word); }
