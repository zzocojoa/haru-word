import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from './source-fingerprint.mjs';

export function catalogBasics(wordsBytes, contentBytes) {
  const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
  const meanings = Object.fromEntries(words.map(word => {
    assert.equal(typeof content[word.id]?.meaning, 'string', 'Missing catalog meaning');
    return [word.id, content[word.id].meaning];
  }));
  assert.equal(Object.keys(meanings).length, words.length, 'Duplicate catalog identity');
  return { wordsSha256: sourceFingerprint(wordsBytes), contentSha256: sourceFingerprint(contentBytes), meanings };
}

export function prepareCatalogBasics(check = false) {
  const value = catalogBasics(readFileSync('data/words.json'), readFileSync('data/content.json'));
  const bytes = JSON.stringify(value) + '\n', file = 'data/catalog-basics.json';
  if (check) assert.equal(readFileSync(file, 'utf8'), bytes, 'Catalog basics are stale; run node scripts/prepare-catalog-basics.mjs');
  else writeFileSync(file, bytes);
  return { checked: check, entries: Object.keys(value.meanings).length, bytes: Buffer.byteLength(bytes) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Unknown argument');
  console.log(JSON.stringify(prepareCatalogBasics(process.argv.includes('--check'))));
}
