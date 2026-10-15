import raw from '../data/word-image-ui.json' with { type: 'json' };
import rawWords from '../data/words.json' with { type: 'json' };
import rawContent from '../data/content.json' with { type: 'json' };
import type { Word } from './learning/model.ts';

export type WordImage = Readonly<{ entryId: string; pos: string; baseMeaning: string; sha256: string; width: number; height: number; url: string }>;
const words = new Map(rawWords.map(word => [word.id, word]));
const content = rawContent as Record<string, { meaning: string }>;
// The build checks this compact index against both full provenance manifests and
// the exact textbook bytes. Do not derive these fields from user-edited content.
export const WORD_IMAGES: readonly WordImage[] = raw.entries.map(row => {
  const [entryId, sha256, height] = row as [string, string, number];
  return Object.freeze({ entryId, pos: words.get(entryId)!.pos, baseMeaning: content[entryId].meaning,
    sha256, width: 640, height, url: `/word-images/v1/${sha256}.webp` });
});
const byId = new Map(WORD_IMAGES.map(image => [image.entryId, image]));

export function resolveWordImage(word: Word, selectedMeaning: string): WordImage | undefined {
  if (word.personal) return undefined;
  const image = byId.get(word.id);
  return image && words.get(word.id)?.word === word.word && image.pos === word.pos &&
    image.baseMeaning.trim() === selectedMeaning.trim() ? image : undefined;
}
