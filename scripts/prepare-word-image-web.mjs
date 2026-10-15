import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = value => createHash('sha256').update(value).digest('hex');
const sourceCatalog = root => JSON.parse(readFileSync(path.join(root, 'data/word-image-pilot.json')));
const transform = { width: 640, format: 'webp', quality: 82, effort: 6 };
const assetDir = 'public/word-images-pilot';

// Only the pinned, verified originals in work/ are transcoded. No image generation.
export async function prepareWordImageWeb(root = process.cwd()) {
  const sharp = (await import('sharp')).default;
  const source = sourceCatalog(root), entries = [], outputs = [];
  for (const entry of source.entries) {
    const original = readFileSync(path.join(root, 'work/oxford-image-pilot', entry.sha256 + '.png'));
    if (sha(original) !== entry.sha256) throw Error('Original image hash mismatch');
    const { data, info } = await sharp(original).resize({ width: transform.width, withoutEnlargement: true })
      .webp({ quality: transform.quality, effort: transform.effort }).toBuffer({ resolveWithObject: true });
    const hash = sha(data), url = '/word-images-pilot/' + hash + '.webp';
    entries.push({ ...entry, sourceSha256: entry.sha256, sha256: hash, width: info.width, height: info.height, bytes: data.length, url });
    outputs.push({ file: path.join(root, 'public', url.slice(1)), data });
  }
  const catalog = { schemaVersion: 1, sourceCatalogSha256: sha(JSON.stringify(source)), transform, entries };
  const catalogFile = path.join(root, 'data/word-image-pilot-web.json');
  if (existsSync(catalogFile) && JSON.stringify(JSON.parse(readFileSync(catalogFile))) !== JSON.stringify(catalog)) throw Error('Existing web catalog differs');
  for (const { file, data } of outputs) if (existsSync(file) && !readFileSync(file).equals(data)) throw Error('Existing web image differs');
  mkdirSync(path.join(root, assetDir), { recursive: true });
  for (const { file, data } of outputs) if (!existsSync(file)) writeFileSync(file, data, { flag: 'wx' });
  if (!existsSync(catalogFile)) writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' });
  return checkWordImageWeb(root);
}

export function checkWordImageWeb(root = process.cwd()) {
  const source = sourceCatalog(root), catalog = JSON.parse(readFileSync(path.join(root, 'data/word-image-pilot-web.json')));
  if (existsSync(path.join(root, 'public/oxford-image-pilot'))) throw Error('Original PNGs must stay outside public');
  if (source.entries.length !== 20 || catalog.entries.length !== 20 || new Set(catalog.entries.map(e => e.entryId)).size !== 20 ||
    catalog.sourceCatalogSha256 !== sha(JSON.stringify(source)) || JSON.stringify(catalog.transform) !== JSON.stringify(transform)) throw Error('Web catalog provenance mismatch');
  let bytes = 0;
  for (const [index, entry] of catalog.entries.entries()) {
    const original = source.entries[index];
    for (const field of ['entryId', 'pos', 'baseMeaning', 'sourceFingerprint']) if (entry[field] !== original[field]) throw Error('Web image identity mismatch');
    if (entry.sourceSha256 !== original.sha256 || !/^[a-f0-9]{64}$/.test(entry.sha256) || entry.url !== '/word-images-pilot/' + entry.sha256 + '.webp' ||
      entry.width !== 640 || entry.height !== 853 || !Number.isInteger(entry.bytes) || entry.bytes > 200_000) throw Error('Web image metadata mismatch');
    const data = readFileSync(path.join(root, 'public', entry.url.slice(1)));
    if (sha(data) !== entry.sha256 || data.length !== entry.bytes || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') throw Error('Web image hash mismatch');
    bytes += data.length;
  }
  const files = readdirSync(path.join(root, assetDir));
  if (files.length !== 20 || files.some(name => !catalog.entries.some(e => e.url.endsWith('/' + name))) || bytes > 2_000_000) throw Error('Unexpected web assets or size budget exceeded');
  return { verified: 20, bytes, maxImageBytes: Math.max(...catalog.entries.map(e => e.bytes)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(process.argv.includes('--check') ? checkWordImageWeb() : await prepareWordImageWeb())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
