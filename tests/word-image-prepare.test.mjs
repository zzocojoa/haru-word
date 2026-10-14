import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareWordImagePilot } from '../scripts/prepare-word-image-pilot.mjs';
import { imagePilotFixture, sha } from './fixtures/word-image-pilot.mjs';

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

test('a pilot entry with a different source fingerprint is rejected', () => {
  const f = imagePilotFixture();
  f.manifest.entries[0].sourceFingerprint = '0'.repeat(64); f.saveManifest();
  assert.throws(() => prepareWordImagePilot(f), { message: 'Entry fingerprint mismatch: ' + f.manifest.entries[0].entryId });
  assert.equal(existsSync(path.join(f.projectRoot, 'public/oxford-image-pilot')), false);
});

test('a corrupt final PNG is rejected before any earlier PNG is copied', () => {
  const f = imagePilotFixture(), entry = f.manifest.entries.at(-1);
  writeFileSync(path.join(f.assetRoot, entry.file), 'corrupt PNG');
  assert.throws(() => prepareWordImagePilot(f), { message: 'PNG fingerprint mismatch: ' + entry.entryId });
  assert.equal(existsSync(path.join(f.projectRoot, 'public/oxford-image-pilot')), false);
  assert.equal(existsSync(path.join(f.projectRoot, 'data/word-image-pilot.json')), false);
});

test('pilot IDs must contain exactly twenty unique entries', () => {
  for (const mode of ['duplicate', 'missing', 'empty']) {
    const f = imagePilotFixture();
    if (mode === 'duplicate') f.manifest.pilotEntryIds[19] = f.manifest.pilotEntryIds[0];
    if (mode === 'missing') f.manifest.pilotEntryIds.pop();
    if (mode === 'empty') f.manifest.pilotEntryIds = [];
    f.saveManifest();
    assert.throws(() => prepareWordImagePilot(f), { message: 'Expected twenty unique pilot IDs' });
  }
});

test('a different existing PNG is never overwritten', () => {
  const f = imagePilotFixture(), entry = f.manifest.entries[0], out = path.join(f.projectRoot, 'public/oxford-image-pilot');
  mkdirSync(out, { recursive: true });
  const file = path.join(out, entry.sha256 + '.png');
  writeFileSync(file, 'keep existing bytes');
  assert.throws(() => prepareWordImagePilot(f), { message: 'Existing PNG differs: ' + entry.sha256 });
  assert.equal(readFileSync(file, 'utf8'), 'keep existing bytes');
  assert.equal(existsSync(path.join(f.projectRoot, 'data/word-image-pilot.json')), false);
});

test('source filenames cannot leave the approved asset directory', () => {
  const f = imagePilotFixture(), entry = f.manifest.entries[0];
  writeFileSync(path.join(f.root, 'escape.png'), readFileSync(path.join(f.assetRoot, entry.file)));
  entry.file = '../escape.png'; f.saveManifest();
  assert.throws(() => prepareWordImagePilot(f), { message: 'Unsafe image filename: ' + entry.entryId });
});

test('twenty verified images are prepared with hash-only URLs and reused on the next run', () => {
  const f = imagePilotFixture(), first = prepareWordImagePilot(f);
  assert.equal(first.prepared, 20);
  const metadataFile = path.join(f.projectRoot, 'data/word-image-pilot.json'), before = readFileSync(metadataFile), catalog = JSON.parse(before);
  assert.equal(catalog.entries.length, 20);
  assert.deepEqual(catalog.entries.map(e => e.entryId), f.manifest.pilotEntryIds);
  for (const entry of catalog.entries) {
    assert.equal(entry.url, '/oxford-image-pilot/' + entry.sha256 + '.png');
    assert.equal(sha(readFileSync(path.join(f.projectRoot, 'public', entry.url.slice(1)))), entry.sha256);
    assert.equal(entry.attempts, undefined); assert.equal(entry.prompt, undefined);
  }
  const second = prepareWordImagePilot(f);
  assert.equal(second.prepared, 20); assert.equal(second.copied, 0); assert.equal(second.reused, 20);
  assert.deepEqual(readFileSync(metadataFile), before);
});

test('a different existing catalog is preserved and blocks PNG preparation', () => {
  const f = imagePilotFixture(), file = path.join(f.projectRoot, 'data/word-image-pilot.json');
  writeFileSync(file, '{"existing":"keep"}');
  assert.throws(() => prepareWordImagePilot(f), { message: 'Existing pilot catalog differs' });
  assert.equal(readFileSync(file, 'utf8'), '{"existing":"keep"}');
  assert.equal(existsSync(path.join(f.projectRoot, 'public/oxford-image-pilot')), false);
});

test('the CLI rejects a source outside the approved source revision', () => {
  const f = imagePilotFixture();
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/prepare-word-image-pilot.mjs', import.meta.url)), '--source', f.sourceRoot, '--assets', f.assetRoot], { cwd: f.projectRoot, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Expected approved image source commit 228f8ba/);
  assert.equal(existsSync(path.join(f.projectRoot, 'public/oxford-image-pilot')), false);
});
