import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const bytes = readFileSync('data/word-image-web-manifest.json');
const catalog = JSON.parse(bytes);
if (catalog.entries.length !== 3809 || new Set(catalog.entries.map(e => e.sha256)).size !== 3809) throw Error('Incomplete image catalog');
const images = {};
for (const entry of catalog.entries) {
  if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > 200_000 ||
    entry.objectKey !== `oxford-images/v1/${entry.sha256}.webp` || entry.contentType !== 'image/webp') throw Error('Invalid image identity');
  images[entry.sha256] = entry.bytes;
}
const result = { schemaVersion: 1, catalogSha256: createHash('sha256').update(JSON.stringify(catalog, null, 2) + '\n').digest('hex'), images };
writeFileSync('data/word-image-hosting-index.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ indexed: Object.keys(images).length, catalogSha256: result.catalogSha256 }));
