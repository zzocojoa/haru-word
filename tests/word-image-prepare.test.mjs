import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

test('a changed current textbook is rejected before any output is created', () => {
  const f = imagePilotFixture();
  const file = path.join(f.projectRoot, 'data/content.json');
  const content = JSON.parse(readFileSync(file));
  content[f.manifest.pilotEntryIds[0]].meaning = '교재 변경';
  writeFileSync(file, JSON.stringify(content));
  assert.throws(() => prepareWordImagePilot(f), { message: 'Textbook fingerprint mismatch' });
  assert.equal(existsSync(path.join(f.projectRoot, 'public/oxford-image-pilot')), false);
});
