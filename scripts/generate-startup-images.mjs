// Run with: node --experimental-strip-types scripts/generate-startup-images.mjs
// Uses the image library already installed with the existing build tooling.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startupImages } from '../lib/startup-images.ts';

const publicRoot = new URL('../public/', import.meta.url);
const icon = await readFile(new URL('favicon.svg', publicRoot));
await mkdir(new URL('startup/', publicRoot), { recursive: true });
for (const { url, width, height, scale } of startupImages) {
  const size = 72 * scale;
  const mark = await sharp(icon, { density: 72 * size / 32 }).resize(size, size).png().toBuffer();
  // Neutral launch surface: no personal data, fake controls or progress claims.
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(url.slice(1), publicRoot)));
}
for (const size of [192, 512]) {
  await sharp(icon, { density: 72 * size / 32 }).resize(size, size)
    .png().toFile(fileURLToPath(new URL(`app-icon-${size}.png`, publicRoot)));
}
console.log(`Generated ${startupImages.length} startup images and two app icons.`);
