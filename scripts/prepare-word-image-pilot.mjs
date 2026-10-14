import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');

export function prepareWordImagePilot({ sourceRoot, projectRoot, assetRoot }) {
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'data/word-image-manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.pilotEntryIds) || manifest.pilotEntryIds.length !== 20 || new Set(manifest.pilotEntryIds).size !== 20) throw new Error('Expected twenty unique pilot IDs');
  for (const id of manifest.pilotEntryIds) {
    if (manifest.entries.find(entry => entry.entryId === id)?.status !== 'approved') throw new Error('Unapproved image: ' + id);
  }
  for (const [name, expected] of [['words', manifest.dataset.wordsSha256], ['content', manifest.dataset.contentSha256]]) {
    for (const root of [sourceRoot, projectRoot]) {
      if (sha(readFileSync(path.join(root, 'data/' + name + '.json'))) !== expected) throw new Error('Textbook fingerprint mismatch');
    }
  }
  const words = new Map(JSON.parse(readFileSync(path.join(projectRoot, 'data/words.json'), 'utf8')).map(word => [word.id, word]));
  const content = JSON.parse(readFileSync(path.join(projectRoot, 'data/content.json'), 'utf8'));
  const images = [];
  for (const id of manifest.pilotEntryIds) {
    const entry = manifest.entries.find(entry => entry.entryId === id), word = words.get(id), material = content[id];
    if (!word || !material || entry.pos !== word.pos || entry.baseMeaning !== material.meaning ||
      entry.sourceFingerprint !== sha(JSON.stringify({ word, content: material }))) throw new Error('Entry fingerprint mismatch: ' + id);
    if (!/^[a-f0-9]{16}$/.test(id) || typeof entry.file !== 'string' ||
      !entry.file.startsWith(id + '-') || !/^[a-f0-9]{16}-[a-z0-9-]+-v[1-9][0-9]*\.png$/.test(entry.file)) throw new Error('Unsafe image filename: ' + id);
    const bytes = readFileSync(path.join(assetRoot, entry.file));
    if (sha(bytes) !== entry.sha256 || bytes.length !== entry.bytes || bytes.length < 24 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      bytes.readUInt32BE(16) !== entry.width || bytes.readUInt32BE(20) !== entry.height) throw new Error('PNG fingerprint mismatch: ' + id);
    const target = path.join(projectRoot, 'public/oxford-image-pilot', entry.sha256 + '.png');
    if (existsSync(target) && sha(readFileSync(target)) !== entry.sha256) throw new Error('Existing PNG differs: ' + entry.sha256);
    images.push({ entry, bytes, target });
  }
  const catalog = { schemaVersion: 1, dataset: { wordsSha256: manifest.dataset.wordsSha256, contentSha256: manifest.dataset.contentSha256 },
    entries: images.map(({ entry }) => ({ entryId: entry.entryId, pos: entry.pos, baseMeaning: entry.baseMeaning,
      sourceFingerprint: entry.sourceFingerprint, sha256: entry.sha256, width: entry.width, height: entry.height,
      url: '/oxford-image-pilot/' + entry.sha256 + '.png' })) };
  const metadataFile = path.join(projectRoot, 'data/word-image-pilot.json');
  mkdirSync(path.join(projectRoot, 'public/oxford-image-pilot'), { recursive: true });
  let copied = 0, reused = 0;
  for (const { bytes, target } of images) {
    if (existsSync(target)) reused++;
    else { writeFileSync(target, bytes, { flag: 'wx' }); copied++; }
  }
  if (!existsSync(metadataFile)) writeFileSync(metadataFile, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' });
  return { prepared: images.length, copied, reused };
}
