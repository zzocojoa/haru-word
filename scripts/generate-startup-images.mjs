// Run with: node --experimental-strip-types scripts/generate-startup-images.mjs
// Uses the image library already installed with the existing build tooling.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startupImages } from '../lib/startup-images.ts';

const publicRoot = new URL('../public/', import.meta.url);
// Approved Haru v1 vectors are kept unchanged under public/brand.
// The iOS launch canvas, placement and CSS-equivalent 72px size stay unchanged.
const icon = await readFile(new URL('brand/brand-72.svg', publicRoot));
const appIcon = await readFile(new URL('brand/brand-app.svg', publicRoot));
await mkdir(new URL('startup/', publicRoot), { recursive: true });
for (const { url, width, height, scale } of startupImages) {
  const size = 72 * scale;
  const mark = await sharp(icon, { density: 72 * scale }).resize(size, size).png().toBuffer();
  // Neutral launch surface: no personal data, fake controls or progress claims.
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(url.slice(1), publicRoot)));
}
for (const [size, names] of [
  [180, ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']],
  [192, ['app-icon-192.png']],
  [512, ['app-icon-512.png']],
]) {
  const png = await sharp(appIcon).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  for (const name of names) await writeFile(new URL(name, publicRoot), png);
}
const faviconImages = [];
for (const size of [16, 32, 48]) {
  const source = await readFile(new URL(`brand/brand-${size}.svg`, publicRoot));
  const png = await sharp(source).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  faviconImages.push({ size, png });
  if (size === 32) await writeFile(new URL('favicon-32x32.png', publicRoot), png);
}
// ICO supports lossless PNG entries; keep the existing 16/32/48 metadata contract.
const header = Buffer.alloc(6 + faviconImages.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconImages.length, 4);
let offset = header.length;
faviconImages.forEach(({ size, png }, index) => {
  const at = 6 + index * 16;
  header.writeUInt8(size, at);
  header.writeUInt8(size, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
await writeFile(new URL('favicon.ico', publicRoot), Buffer.concat([header, ...faviconImages.map(({ png }) => png)]));
console.log(`Generated ${startupImages.length} unchanged-size startup canvases, four app PNGs and 16/32/48px favicons.`);
