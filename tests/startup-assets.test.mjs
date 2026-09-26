import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startupImages } from '../lib/startup-images.ts';

function pngSize(url) {
  const bytes = readFileSync(new URL(`../public${url}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('each iPhone startup declaration has an actual PNG at its declared dimensions', () => {
  assert.equal(new Set(startupImages.map(image => image.url)).size, startupImages.length);
  assert.equal(new Set(startupImages.map(image => image.media)).size, startupImages.length);
  for (const { url, width, height } of startupImages) assert.deepEqual(pngSize(url), { width, height });
  // The reported recording is 1320 × 2868; do not lose its launch-image coverage.
  assert.ok(startupImages.some(image => image.width === 1320 && image.height === 2868));
  assert.ok(startupImages.some(image => image.width === 2868 && image.height === 1320));
});

test('home-screen metadata starts at the existing root and has valid local app icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color, '#ffffff');
  for (const icon of manifest.icons) {
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(icon.src), { width, height });
  }
});
