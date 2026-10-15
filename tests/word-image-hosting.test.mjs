import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { serveWordImage, IMAGE_CACHE_CONTROL } from '../lib/server/word-image-hosting.ts';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pilot = JSON.parse(readFileSync('data/word-image-pilot-web.json')).entries[0];
const bytes = readFileSync('public' + pilot.url), hash = sha(bytes), images = { [hash]: bytes.length };
const origin = 'https://images.example.test', now = Date.parse('2026-10-15T00:00:00Z'), token = 'a'.repeat(64);
function bucket() {
  const objects = new Map(), writes = [];
  const metadata = () => ({ size: bytes.length, customMetadata: { sha256: hash }, httpMetadata: { contentType: 'image/webp', cacheControl: IMAGE_CACHE_CONTROL } });
  return { objects, writes, metadata,
    async get(key) { const e = objects.get(key); return e ? { ...e, body: new Response(e.data).body } : null; },
    async head(key) { return objects.get(key) || null; },
    async put(key, value, options) {
      writes.push({ key, value, options }); assert.equal(options.onlyIf.get('If-None-Match'), '*'); assert.equal(options.sha256, sha(value));
      if (objects.has(key)) return null;
      const result = { ...metadata(), data: value }; objects.set(key, result); return result;
    }
  };
}
const config = storage => ({ BUCKET: storage, word_image_upload_key: token, word_image_upload_expires: new Date(now + 60 * 60_000).toISOString() });
const request = (method = 'GET', extra = {}, imageHash = hash) => new Request(`${origin}/word-images/v1/${imageHash}.webp`, {
  method, ...(method === 'PUT' ? { headers: { Authorization: `Bearer ${token}`, Origin: origin, 'Content-Type': 'image/webp' }, body: bytes } : {}), ...extra
});

test('hosting allowlist is an exact small server index of all approved image hashes and lengths', () => {
  const catalog = JSON.parse(readFileSync('data/word-image-web-manifest.json'));
  const index = JSON.parse(readFileSync('data/word-image-hosting-index.json'));
  assert.equal(index.catalogSha256, sha(JSON.stringify(catalog, null, 2) + '\n'));
  assert.deepEqual(index.images, Object.fromEntries(catalog.entries.map(e => [e.sha256, e.bytes])));
  assert.equal(Object.keys(index.images).length, 3809);
  const hosting = JSON.parse(readFileSync('.openai/hosting.json'));
  assert.equal(hosting.project_id, 'appgprj_6ab0a3cbaaa08191a05b0bcdf62df225'); assert.equal(hosting.d1, 'DB'); assert.equal(hosting.r2, 'BUCKET');
});
test('uploads require a configured unexpired key and same origin before touching storage or body', async () => {
  const storage = bucket(); let reads = 0;
  const req = headers => request('PUT', { headers, body: new ReadableStream({ pull() { reads++; } }, { highWaterMark: 0 }), duplex: 'half' });
  const headers = { Authorization: `Bearer ${token}`, Origin: origin, 'Content-Type': 'image/webp' };
  for (const change of [{ word_image_upload_key: undefined }, { word_image_upload_expires: new Date(now).toISOString() },
    { word_image_upload_expires: 'invalid' }, { word_image_upload_expires: new Date(now + 7 * 3600_000).toISOString() }])
    assert.equal((await serveWordImage(req(headers), { ...config(storage), ...change }, images, now)).status, 404);
  for (const change of [{ Authorization: 'Bearer ' + 'b'.repeat(64) }, { Authorization: token }, { Origin: 'https://evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }])
    assert.equal((await serveWordImage(req({ ...headers, ...change }), config(storage), images, now)).status, 403);
  assert.equal(storage.writes.length, 0); assert.equal(reads, 0);
});
test('only approved hash paths are served and error responses cannot be cached', async () => {
  const storage = bucket();
  for (const url of [`${origin}/word-images/v1/${'f'.repeat(64)}.webp`, `${origin}/word-images/v1/../../secret`, `${origin}/word-images/v1/%2e%2e.webp`]) {
    const result = await serveWordImage(new Request(url), config(storage), images, now);
    assert.equal(result.status, 404); assert.equal(result.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal((await serveWordImage(request('DELETE'), config(storage), images, now)).status, 405);
  assert.equal((await serveWordImage(request(), {}, images, now)).status, 503);
});
test('uploaded bytes are checksum-bound and repeated/competing uploads never replace objects', async () => {
  const storage = bucket();
  const result = await serveWordImage(request('PUT'), config(storage), images, now);
  assert.equal(result.status, 201); assert.equal((await result.json()).sha256, hash);
  assert.equal((await serveWordImage(request('PUT'), config(storage), images, now)).status, 200);
  const stored = storage.objects.get(`oxford-images/v1/${hash}.webp`);
  stored.customMetadata.sha256 = 'f'.repeat(64);
  assert.equal((await serveWordImage(request('PUT'), config(storage), images, now)).status, 409);
  assert.equal(storage.objects.get(`oxford-images/v1/${hash}.webp`), stored);
});
test('size, content type and hash errors are rejected before any R2 write', async () => {
  const storage = bucket(), headers = { Authorization: `Bearer ${token}`, Origin: origin, 'Content-Type': 'image/webp' };
  for (const [extra, status] of [[{ headers: { ...headers, 'Content-Type': 'image/png' } }, 415],
    [{ headers: { ...headers, 'Content-Length': String(bytes.length + 1) } }, 413], [{ body: bytes.subarray(1) }, 400],
    [{ body: Buffer.alloc(bytes.length) }, 400], [{ body: Buffer.alloc(bytes.length + 1) }, 413]]) {
    assert.equal((await serveWordImage(request('PUT', extra), config(storage), images, now)).status, status);
  }
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(bytes.length + 1)); }, cancel() { cancelled = true; } });
  assert.equal((await serveWordImage(request('PUT', { body, duplex: 'half' }), config(storage), images, now)).status, 413);
  assert.equal(cancelled, true); assert.equal(storage.writes.length, 0);
});
test('GET and HEAD return exact bytes, MIME, immutable cache and conditional ETags after upload', async () => {
  const storage = bucket(); await serveWordImage(request('PUT'), config(storage), images, now);
  for (const method of ['GET', 'HEAD']) {
    const result = await serveWordImage(request(method), config(storage), images, now);
    assert.equal(result.status, 200); assert.equal(result.headers.get('Content-Type'), 'image/webp');
    assert.equal(result.headers.get('Cache-Control'), IMAGE_CACHE_CONTROL); assert.equal(result.headers.get('Content-Length'), String(bytes.length));
    assert.equal(result.headers.get('ETag'), `"${hash}"`); assert.equal(result.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal((await result.arrayBuffer()).byteLength, method === 'GET' ? bytes.length : 0);
  }
  const cached = await serveWordImage(request('GET', { headers: { 'If-None-Match': `W/"${hash}"` } }), config(storage), images, now);
  assert.equal(cached.status, 304); assert.equal((await cached.arrayBuffer()).byteLength, 0);
  storage.objects.get(`oxford-images/v1/${hash}.webp`).httpMetadata.contentType = 'text/html';
  assert.equal((await serveWordImage(request(), config(storage), images, now)).status, 503);
});
test('storage failures return safe codes without backend diagnostics', async () => {
  const storage = { async put() { throw Error('secret backend details'); }, async get() { throw Error('secret backend details'); } };
  for (const method of ['GET', 'PUT']) {
    const result = await serveWordImage(request(method), config(storage), images, now);
    assert.equal(result.status, 503); assert.equal((await result.text()).includes('secret'), false);
  }
});
