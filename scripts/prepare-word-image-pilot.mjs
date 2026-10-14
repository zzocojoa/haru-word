import { readFileSync } from 'node:fs';
import path from 'node:path';

export function prepareWordImagePilot({ sourceRoot }) {
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'data/word-image-manifest.json'), 'utf8'));
  for (const id of manifest.pilotEntryIds) {
    if (manifest.entries.find(entry => entry.entryId === id)?.status !== 'approved') throw new Error('Unapproved image: ' + id);
  }
  return { prepared: 0 };
}
