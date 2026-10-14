import raw from '../data/word-image-pilot.json' with { type: 'json' };
import type { Word } from './learning/model.ts';

export type WordImage = Readonly<{ entryId: string; pos: string; baseMeaning: string; sourceFingerprint: string; sha256: string; width: number; height: number; url: string }>;
export const WORD_IMAGES: readonly WordImage[] = raw.entries;

export function resolveWordImage(word: Word, selectedMeaning: string): WordImage | undefined {
  return WORD_IMAGES.find(image => image.entryId === word.id && image.pos === word.pos && image.baseMeaning.trim() === selectedMeaning.trim());
}
