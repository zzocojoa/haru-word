import raw from '../data/american-ipa-ui.json' with { type: 'json' };
import type { Word } from './learning/model.ts';
import { WORD_MAP, cardMeaning } from './catalog-basics.ts';

export type IpaVariant = readonly [ipa: string, usage: string];
// The generator and build check validate every JSON row as an [ipa, usage] pair.
const entries = raw.entries as unknown as Record<string, readonly IpaVariant[]>;
const previousMeanings: Record<string, string> = raw.previousMeanings;

export function resolveWordIpa(word: Word, selectedMeaning: string): readonly IpaVariant[] | undefined {
  const base = WORD_MAP.get(word.id);
  if (word.personal || !base || base.word !== word.word || base.headword !== word.headword || base.pos !== word.pos) return undefined;
  const selected = selectedMeaning.trim();
  if (cardMeaning(base.id).trim() !== selected && previousMeanings[base.id]?.trim() !== selected) return undefined;
  return Object.hasOwn(entries, word.id) ? entries[word.id] : undefined;
}
