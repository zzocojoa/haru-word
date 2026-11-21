import raw from '../data/word-image-ui.json' with { type: 'json' };
import { WORD_MAP, cardMeaning } from './catalog-basics.ts';
import type { Word } from './learning/model.ts';

export type WordImage = Readonly<{ entryId: string; pos: string; baseMeaning: string; sha256: string; width: number; height: number; url: string }>;
const words = WORD_MAP;
type ImageRow = [entryId: string, sha256: string, height: number, previousMeaning?: string, previousOnly?: true];
const rows = raw.entries as ImageRow[];
// The build checks this compact index against both full provenance manifests and
// the exact textbook bytes. Do not derive these fields from user-edited content.
export const WORD_IMAGES: readonly WordImage[] = rows.map(([entryId, sha256, height, previousMeaning, previousOnly]) => {
  return Object.freeze({ entryId, pos: words.get(entryId)!.pos,
    baseMeaning: previousOnly ? previousMeaning! : cardMeaning(entryId),
    sha256, width: 640, height, url: `/word-images/v1/${sha256}.webp` });
});
const byId = new Map(WORD_IMAGES.map(image => [image.entryId, image]));
const previousById = new Map<string, WordImage>();
for (const [entryId, , , previousMeaning, previousOnly] of rows) {
  if (previousMeaning && !previousOnly) {
    previousById.set(entryId, Object.freeze({ ...byId.get(entryId)!, baseMeaning: previousMeaning }));
  }
}

export function resolveWordImage(word: Word, selectedMeaning: string): WordImage | undefined {
  if (word.personal) return undefined;
  const image = byId.get(word.id);
  if (!image || words.get(word.id)?.word !== word.word || image.pos !== word.pos) return undefined;
  const selected = selectedMeaning.trim();
  if (image.baseMeaning.trim() === selected) return image;
  const previous = previousById.get(word.id);
  return previous?.baseMeaning.trim() === selected ? previous : undefined;
}
