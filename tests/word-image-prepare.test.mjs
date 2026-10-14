import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { prepareWordImagePilot } from '../scripts/prepare-word-image-pilot.mjs';
import { imagePilotFixture } from './fixtures/word-image-pilot.mjs';

test('unapproved pilot images are rejected before any destination is created', () => {
  const f = imagePilotFixture();
  f.manifest.entries[7].status = 'held'; f.saveManifest();
  assert.throws(() => prepareWordImagePilot(f), { message: 'Unapproved image: ' + f.manifest.entries[7].entryId });
  assert.equal(existsSync(path.join(f.projectRoot, 'public/oxford-image-pilot')), false);
  assert.equal(existsSync(path.join(f.projectRoot, 'data/word-image-pilot.json')), false);
});
