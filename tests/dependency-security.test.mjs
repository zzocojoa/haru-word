import test from 'node:test';
import assert from 'node:assert/strict';
import uri from 'fast-uri';
import { BalancedPool } from 'undici';
import { SourceMapConsumer, SourceNode } from 'source-map-js';
import sharp from 'sharp';

test('encoded scheme-relative hosts use the same canonical host', () => {
  for (const reference of ['//%41.com', '//A.com', '//a.com']) {
    assert.equal(uri.parse(reference).host, 'a.com');
    assert.equal(uri.normalize(reference), '//a.com');
    assert.equal(uri.equal(reference, '//a.com'), true);
  }
});

test('BalancedPool preserves a custom connector and its rejection', async () => {
  const rejected = new Error('Synthetic connector rejects the connection');
  let calls = 0;
  // A regressed default connector can reach only this closed loopback port.
  const pool = new BalancedPool(['http://127.0.0.1:1'], {
    connect(_options, callback) {
      calls++;
      callback(rejected);
    },
    connectTimeout: 1000,
  });
  try {
    await assert.rejects(pool.request({ method: 'GET', path: '/' }), error => error === rejected);
    assert.equal(calls, 1);
  } finally {
    await pool.close();
  }
});

const basicMap = { version: 3, sources: ['input.js'], sourcesContent: ['const answer = 42;\n'], names: [], mappings: 'AAAA' };
const indexedMap = line => ({ version: 3, sections: [{ offset: { line, column: 0 }, map: basicMap }] });

test('indexed source maps reject unsafe section offsets before line padding', () => {
  // Constructing a consumer is bounded even on the vulnerable version. Never
  // pass these oversized offsets into SourceNode's old line-padding loop.
  for (const line of [10_000_001, Number.MAX_SAFE_INTEGER + 1, Infinity, 0.5]) {
    assert.throws(() => new SourceMapConsumer(indexedMap(line)), undefined, String(line));
  }
});

test('valid indexed source maps preserve generated code and original positions', () => {
  const consumer = new SourceMapConsumer(indexedMap(1));
  const code = '\nconst answer = 42;\n';
  const mappings = [];
  consumer.eachMapping(mapping => mappings.push(mapping));
  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].source, 'input.js');
  assert.equal(mappings[0].originalLine, 1);
  assert.equal(mappings[0].originalColumn, 0);
  assert.equal(mappings[0].generatedLine, 2);
  assert.equal(mappings[0].generatedColumn, 0);
  assert.equal(SourceNode.fromStringWithSourceMap(code, consumer).toString(), code);
});

test('image tooling decodes trusted SVG and round-trips PNG and WebP', async t => {
  t.diagnostic(`sharp ${sharp.versions.sharp}; librsvg ${sharp.versions.rsvg}; libvips ${sharp.versions.vips}`);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="#12ab34"/></svg>');
  const png = await sharp(svg).png().toBuffer();
  const webp = await sharp(png).webp({ lossless: true }).toBuffer();
  const original = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const restored = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(restored.info.width, 16);
  assert.equal(restored.info.height, 12);
  assert.equal(restored.info.channels, 4);
  assert.deepEqual(restored.data, original.data);
  assert.deepEqual([...restored.data.subarray(0, 4)], [0x12, 0xab, 0x34, 0xff]);
});
