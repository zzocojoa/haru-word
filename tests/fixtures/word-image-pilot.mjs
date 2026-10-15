import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha = value => createHash('sha256').update(value).digest('hex');
export function imagePilotFixture() {
  const base = path.resolve('work');
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(path.join(base, 'pilot-prepare-fixture-'));
  const sourceRoot = path.join(root, 'source'), projectRoot = path.join(root, 'project'), assetRoot = path.join(root, 'assets');
  for (const dir of [path.join(sourceRoot, 'data'), path.join(projectRoot, 'data'), assetRoot]) mkdirSync(dir, { recursive: true });
  const wb = readFileSync('data/words.json'), cb = readFileSync('data/content.json'), words = JSON.parse(wb), content = JSON.parse(cb);
  for (const dir of [sourceRoot, projectRoot]) { writeFileSync(path.join(dir, 'data/words.json'), wb); writeFileSync(path.join(dir, 'data/content.json'), cb); }
  // Synthetic one-pixel PNGs exercise the filesystem boundary, never real learning approval.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1QAAAAASUVORK5CYII=', 'base64');
  const entries = words.slice(0, 20).map(w => {
    const file = w.id + '-fixture-v1.png';
    writeFileSync(path.join(assetRoot, file), png);
    return { entryId: w.id, word: w.word, pos: w.pos, baseMeaning: content[w.id].meaning, sourceFingerprint: sha(JSON.stringify({ word: w, content: content[w.id] })), status: 'approved', file, sha256: sha(png), width: 1, height: 1, bytes: png.length,
      review: { textFree: true, styleConsistent: true, meaningMatch: true, smallScreenChecked: true, pngDecoded: true } };
  });
  const manifest = { dataset: { wordsSha256: sha(wb), contentSha256: sha(cb), sha256: sha(sha(wb) + ':' + sha(cb)) }, pilotEntryIds: entries.map(e => e.entryId), entries };
  const manifestPath = path.join(sourceRoot, 'data/word-image-manifest.json');
  const saveManifest = () => writeFileSync(manifestPath, JSON.stringify(manifest));
  saveManifest();
  return { sourceRoot, projectRoot, assetRoot, root, manifest, manifestPath, saveManifest };
}
