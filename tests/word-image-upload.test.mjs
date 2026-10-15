import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { uploadOxfordImages } from '../scripts/upload-oxford-images.mjs';
const pilot = JSON.parse(readFileSync('data/word-image-pilot-web.json')).entries[0];
const entry = { ...pilot, objectKey: `oxford-images/v1/${pilot.sha256}.webp` };
const bytes = readFileSync('public' + pilot.url);
const origin = 'https://images.example.test', token = 'a'.repeat(64);
function fixture() {
  mkdirSync('outputs', { recursive: true }); const root = mkdtempSync(path.resolve('outputs/word-image-upload-test-'));
  const assetRoot = path.join(root, 'assets'); mkdirSync(assetRoot); writeFileSync(path.join(assetRoot, entry.sha256 + '.webp'), bytes);
  return { root, assetRoot, outputRoot: path.join(root, 'remote'), entries: [entry], origin, token };
}
function cleanup(root) {
  assert.equal(path.dirname(root), path.resolve('outputs')); assert.ok(path.basename(root).startsWith('word-image-upload-test-'));
  rmSync(root, { recursive: true });
}
const headers = { 'Content-Type': 'image/webp', 'Content-Length': String(entry.bytes), 'Cache-Control': 'public, max-age=31536000, immutable',
  ETag: `"${entry.sha256}"`, 'X-Content-Type-Options': 'nosniff' };

test('upload verifies public GET bytes and both GET/HEAD headers without forwarding credentials to reads', async () => {
  const f = fixture(), methods = []; let exists = false;
  try {
    const result = await uploadOxfordImages({ ...f, transport: async (url, init) => {
      assert.equal(url, `${origin}/word-images/v1/${entry.sha256}.webp`); assert.equal(init.redirect, 'error'); methods.push(init.method || 'GET');
      if (init.method === 'PUT') { assert.equal(init.headers.Authorization, `Bearer ${token}`); assert.deepEqual(init.body, bytes); exists = true; return Response.json({ sha256: entry.sha256, bytes: entry.bytes }, { status: 201 }); }
      assert.equal(init.headers.Authorization, undefined);
      if (!exists) return new Response(null, { status: 404 });
      return new Response(init.method === 'HEAD' ? null : bytes, { headers });
    } });
    assert.equal(result.passed, true); assert.equal(result.completed, 1); assert.equal(result.uploaded, 1);
    assert.deepEqual(methods, ['GET', 'PUT', 'GET', 'HEAD']); assert.equal(result.bytes, bytes.length);
    assert.equal(readFileSync(result.reportFile, 'utf8').includes(token), false);
  } finally { cleanup(f.root); }
});
test('an uncertain upload is not retried; restarting verifies the stored file and performs no second PUT', async () => {
  const f = fixture(); let exists = false, writes = 0;
  const transport = async (_url, init) => {
    if (init.method === 'PUT') { writes++; exists = true; throw Error('private transport detail'); }
    if (!exists) return new Response(null, { status: 404 });
    return new Response(init.method === 'HEAD' ? null : bytes, { headers });
  };
  try {
    await assert.rejects(uploadOxfordImages({ ...f, transport }), /remote_transport_failed/);
    assert.equal(writes, 1);
    const result = await uploadOxfordImages({ ...f, transport }); assert.equal(result.reused, 1); assert.equal(writes, 1);
  } finally { cleanup(f.root); }
});
test('verification rejects a wrong remote body or header and can never upload a missing object', async () => {
  const f = fixture();
  try {
    for (const response of [() => new Response(Buffer.alloc(entry.bytes), { headers }),
      () => new Response(bytes, { headers: { ...headers, 'Content-Type': 'application/octet-stream' } }),
      () => new Response(null, { status: 404 })]) {
      let writes = 0;
      await assert.rejects(uploadOxfordImages({ ...f, verifyOnly: true, transport: async (_url, init) => { if (init.method === 'PUT') writes++; return response(); } }), /remote_(image|header)_mismatch/);
      assert.equal(writes, 0);
    }
    assert.equal(readdirSync(path.join(f.outputRoot, 'runs')).length, 3);
  } finally { cleanup(f.root); }
});
test('streamed GET may omit Content-Length while HEAD must describe the exact stored size', async () => {
  const f = fixture();
  try {
    const streamedHeaders = { ...headers }; delete streamedHeaders['Content-Length'];
    const result = await uploadOxfordImages({ ...f, verifyOnly: true, transport: async (_url, init) =>
      new Response(init.method === 'HEAD' ? null : bytes, { headers: init.method === 'HEAD' ? headers : streamedHeaders }) });
    assert.equal(result.passed, true); assert.equal(result.bytes, bytes.length);
    await assert.rejects(uploadOxfordImages({ ...f, verifyOnly: true, transport: async (_url, init) =>
      new Response(init.method === 'HEAD' ? null : bytes, { headers: streamedHeaders }) }), /remote_header_mismatch/);
  } finally { cleanup(f.root); }
});
