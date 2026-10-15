import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkWordImageWeb } from '../scripts/prepare-word-image-web.mjs';

test('all twenty shipped WebPs retain original identities and fit the mobile size budget', () => {
  const result = checkWordImageWeb();
  assert.equal(result.verified, 20);
  assert.ok(result.bytes < 2_000_000);
});

test('publication checks reject altered web bytes and public copies of the source PNGs', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'word-image-web-'));
  mkdirSync(path.join(root, 'data'));
  for (const name of ['word-image-pilot.json', 'word-image-pilot-web.json']) cpSync('data/' + name, path.join(root, 'data', name));
  mkdirSync(path.join(root, 'public/word-images-pilot'), { recursive: true });
  for (const name of readdirSync('public/word-images-pilot')) cpSync('public/word-images-pilot/' + name, path.join(root, 'public/word-images-pilot', name));
  assert.equal(checkWordImageWeb(root).verified, 20);
  const catalog = JSON.parse(readFileSync(path.join(root, 'data/word-image-pilot-web.json')));
  const last = path.join(root, 'public', catalog.entries.at(-1).url.slice(1)), original = readFileSync(last);
  writeFileSync(last, 'changed');
  assert.throws(() => checkWordImageWeb(root), /Web image hash mismatch/);
  writeFileSync(last, original);
  mkdirSync(path.join(root, 'public/oxford-image-pilot'));
  assert.throws(() => checkWordImageWeb(root), /Original PNGs must stay outside public/);
});
