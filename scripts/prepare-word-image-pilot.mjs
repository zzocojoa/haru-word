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
  return { prepared: 0 };
}
