import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');

export function prepareWordImagePilot({ sourceRoot, projectRoot }) {
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'data/word-image-manifest.json'), 'utf8'));
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
  for (const id of manifest.pilotEntryIds) {
    const entry = manifest.entries.find(entry => entry.entryId === id), word = words.get(id), material = content[id];
    if (!word || !material || entry.pos !== word.pos || entry.baseMeaning !== material.meaning ||
      entry.sourceFingerprint !== sha(JSON.stringify({ word, content: material }))) throw new Error('Entry fingerprint mismatch: ' + id);
  }
  return { prepared: 0 };
}
