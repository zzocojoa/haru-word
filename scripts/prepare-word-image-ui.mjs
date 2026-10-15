import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, null, 2) + '\n';
const origin = 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site';

// Keep the large provenance manifests out of the browser. Derived textbook fields
// are safe only while this build gate binds them to the reviewed source snapshot.
export function createWordImageUiCatalog(catalog, hosted, wordsBytes, contentBytes, pilot) {
  const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
  assert.equal(catalog.dataset.wordsSha256, sha(wordsBytes), 'Textbook words changed');
  assert.equal(catalog.dataset.contentSha256, sha(contentBytes), 'Textbook content changed');
  assert.equal(words.length, 3809);
  assert.equal(catalog.entries.length, words.length);
  assert.equal(hosted.entries.length, words.length);
  assert.equal(hosted.catalogSha256, sha(canonical(catalog)), 'Hosted catalog provenance changed');
  assert.equal(hosted.origin, origin);
  const source = new Map(catalog.entries.map(e => [e.entryId, e]));
  const remote = new Map(hosted.entries.map(e => [e.entryId, e]));
  assert.equal(source.size, words.length); assert.equal(remote.size, words.length);
  assert.equal(new Set(words.map(w => w.id)).size, words.length);
  assert.equal(new Set(catalog.entries.map(e => e.sha256)).size, words.length);
  for (const word of words) {
    const e = source.get(word.id), r = remote.get(word.id);
    assert.ok(e && r && content[word.id], 'Missing textbook identity');
    assert.equal(e.word, word.word); assert.equal(e.pos, word.pos); assert.equal(e.level, word.level);
    assert.equal(e.baseMeaning, content[word.id].meaning);
    assert.equal(e.sourceFingerprint, sha(JSON.stringify({ word, content: content[word.id] })), 'Source meaning changed');
    assert.match(e.sha256, /^[a-f0-9]{64}$/);
    assert.equal(e.objectKey, `oxford-images/v1/${e.sha256}.webp`);
    assert.equal(e.contentType, 'image/webp');
    assert.equal(e.width, 640); assert.ok([852, 853].includes(e.height));
    assert.equal(r.sha256, e.sha256); assert.equal(r.url, `${origin}/word-images/v1/${e.sha256}.webp`);
  }
  assert.equal(pilot.entries.length, 20);
  const first = pilot.entries.map(e => e.entryId), firstIds = new Set(first);
  assert.equal(firstIds.size, 20);
  for (const e of pilot.entries) {
    assert.equal(e.sha256, source.get(e.entryId)?.sha256, 'Pilot image changed');
    assert.equal(e.baseMeaning, source.get(e.entryId)?.baseMeaning);
    assert.equal(e.pos, source.get(e.entryId)?.pos);
  }
  const order = [...first, ...words.filter(w => !firstIds.has(w.id)).map(w => w.id)];
  return {
    schemaVersion: 1,
    dataset: { wordsSha256: sha(wordsBytes), contentSha256: sha(contentBytes) },
    catalogSha256: sha(canonical(catalog)), hostedSha256: sha(canonical(hosted)),
    // entry ID, image hash, actual height. Width is fixed by the validated recipe.
    entries: order.map(id => [id, source.get(id).sha256, source.get(id).height]),
  };
}

export function prepareWordImageUi(check = false) {
  const json = file => JSON.parse(readFileSync(file));
  const result = createWordImageUiCatalog(json('data/word-image-web-manifest.json'), json('data/word-image-hosted-manifest.json'),
    readFileSync('data/words.json'), readFileSync('data/content.json'), json('data/word-image-pilot-web.json'));
  const bytes = JSON.stringify(result) + '\n', file = 'data/word-image-ui.json';
  if (check) assert.equal(readFileSync(file, 'utf8'), bytes, 'UI index is stale; run npm run images:ui:prepare');
  else writeFileSync(file, bytes);
  return { checked: check, entries: result.entries.length, bytes: Buffer.byteLength(bytes) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Unknown argument');
  console.log(JSON.stringify(prepareWordImageUi(process.argv.includes('--check'))));
}
