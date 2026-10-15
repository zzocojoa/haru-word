import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ORIGIN = 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site';
const CACHE = 'public, max-age=31536000, immutable';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const fail = code => { throw Error(code); };
function checkHeaders(response, entry, method) {
  const headers = Object.fromEntries(['content-type', 'content-length', 'cache-control', 'etag', 'x-content-type-options'].map(key => [key, response.headers.get(key)]));
  if (response.status !== 200 || headers['content-type'] !== 'image/webp' ||
    (headers['content-length'] !== null && headers['content-length'] !== String(entry.bytes)) || (method === 'HEAD' && headers['content-length'] === null) ||
    headers['cache-control'] !== CACHE || headers.etag !== `"${entry.sha256}"` || headers['x-content-type-options'] !== 'nosniff') fail('remote_header_mismatch');
  return headers;
}

export async function uploadOxfordImages({ entries, assetRoot, outputRoot, origin, token, verifyOnly = false, transport = fetch, onProgress = () => {} }) {
  if (new URL(origin).origin !== origin || !/^https:\/\//.test(origin)) fail('invalid_upload_origin');
  if (!verifyOnly && !/^[a-f0-9]{64}$/.test(token || '')) fail('missing_upload_credential');
  const started = new Date().toISOString(), runId = randomUUID(), runRoot = path.join(outputRoot, 'runs', runId);
  mkdirSync(runRoot, { recursive: true });
  const checked = new Array(entries.length), requests = { GET: 0, HEAD: 0, PUT: 0 };
  let index = 0, completed = 0, uploaded = 0, reused = 0, stopped;
  const call = async (url, init = {}) => {
    requests[init.method || 'GET']++;
    try { return await transport(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
    catch { fail('remote_transport_failed'); }
  };
  async function worker() {
    while (!stopped && index < entries.length) {
      const i = index++, entry = entries[i];
      try {
        if (!/^[a-f0-9]{64}$/.test(entry.sha256) || entry.objectKey !== `oxford-images/v1/${entry.sha256}.webp` ||
          !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > 200_000) fail('invalid_upload_entry');
        const url = `${origin}/word-images/v1/${entry.sha256}.webp`;
        let response = await call(url, { headers: { 'Cache-Control': 'no-cache' }, cache: 'no-store' });
        if (response.status === 404 && !verifyOnly) {
          await response.arrayBuffer();
          const bytes = readFileSync(path.join(assetRoot, entry.sha256 + '.webp'));
          if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) fail('local_image_mismatch');
          const saved = await call(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Origin: origin, 'Content-Type': 'image/webp' }, body: bytes });
          if (![200, 201].includes(saved.status)) { await saved.arrayBuffer(); fail('remote_upload_failed'); }
          const receipt = await saved.json();
          if (receipt.sha256 !== entry.sha256 || receipt.bytes !== entry.bytes) fail('remote_upload_receipt_mismatch');
          uploaded++;
          response = await call(url, { headers: { 'Cache-Control': 'no-cache' }, cache: 'no-store' });
        } else reused++;
        const getHeaders = checkHeaders(response, entry, 'GET');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) fail('remote_image_mismatch');
        const head = await call(url, { method: 'HEAD', headers: { 'Cache-Control': 'no-cache' }, cache: 'no-store' });
        const headHeaders = checkHeaders(head, entry, 'HEAD');
        if ((await head.arrayBuffer()).byteLength !== 0) fail('remote_head_has_body');
        const result = { entryId: entry.entryId, sha256: entry.sha256, bytes: entry.bytes, url, checkedAt: new Date().toISOString(), get: { status: 200, headers: getHeaders }, head: { status: 200, headers: headHeaders } };
        writeFileSync(path.join(runRoot, entry.sha256 + '.json'), json(result), { flag: 'wx' });
        checked[i] = result; completed++; onProgress({ completed, total: entries.length, uploaded, reused });
      } catch (error) { stopped = error; throw error; }
    }
  }
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => worker()));
  const failed = results.find(result => result.status === 'rejected');
  const report = { passed: !failed, started, finished: new Date().toISOString(), runId, origin, mode: verifyOnly ? 'verify' : 'upload',
    expected: entries.length, completed, uploaded, reused, bytes: checked.filter(Boolean).reduce((sum, entry) => sum + entry.bytes, 0), requests,
    ...(failed ? { failure: failed.reason.message } : {}), checked: checked.filter(Boolean) };
  const reportFile = path.join(runRoot, 'report.json');
  writeFileSync(reportFile, json(report), { flag: 'wx' });
  if (failed) fail(`${report.failure}; completed=${completed}; report=${reportFile}`);
  return { ...report, reportFile };
}

async function hiddenInput() {
  return await new Promise((resolve, reject) => {
    let value = ''; const terminal = process.stdin.isTTY;
    const finish = error => {
      process.stdin.removeListener('data', onData); process.stdin.removeListener('end', onEnd);
      if (terminal) process.stdin.setRawMode(false); process.stdin.pause();
      if (error) reject(error); else resolve(value);
    };
    const onData = chunk => { value += chunk;
      if (value.includes('\u0003') || value.length > 4096) finish(Error('upload_input_cancelled'));
      else if (value.includes('\n') || value.includes('\r')) finish(); };
    const onEnd = () => finish();
    if (terminal) process.stdin.setRawMode(true);
    process.stderr.write('Ready for upload JSON on stdin (input is hidden).\n');
    process.stdin.setEncoding('utf8'); process.stdin.on('data', onData); process.stdin.once('end', onEnd); process.stdin.resume();
  });
}
async function main() {
  const { values } = parseArgs({ options: { verify: { type: 'boolean' }, canary: { type: 'boolean' } } });
  const catalog = JSON.parse(readFileSync('data/word-image-web-manifest.json'));
  const catalogSha256 = sha(json(catalog));
  if (catalog.entries.length !== 3809 || new Set(catalog.entries.map(e => e.sha256)).size !== 3809) fail('incomplete_upload_catalog');
  const assets = path.join('outputs/oxford-web', catalog.dataset.sha256, 'webp-640-q82-v1');
  const uploads = JSON.parse(readFileSync(path.join(assets, 'upload-manifest.json')));
  if (uploads.catalogSha256 !== catalogSha256 || uploads.files.length !== 3809) fail('upload_manifest_mismatch');
  for (const [i, entry] of catalog.entries.entries()) {
    const file = uploads.files[i];
    if (file.entryId !== entry.entryId || file.sha256 !== entry.sha256 || file.bytes !== entry.bytes || file.objectKey !== entry.objectKey ||
      file.contentType !== 'image/webp' || file.cacheControl !== CACHE || file.file !== `assets/${entry.sha256}.webp`) fail('upload_manifest_mismatch');
  }
  const input = values.verify ? {} : JSON.parse(await hiddenInput());
  const entries = values.canary ? catalog.entries.slice(0, 1) : catalog.entries;
  const outputRoot = path.join('outputs/oxford-hosting', catalog.dataset.sha256);
  const result = await uploadOxfordImages({ entries, origin: ORIGIN, token: input.token, assetRoot: path.join(assets, 'assets'), outputRoot, verifyOnly: !!values.verify,
    onProgress: progress => { if (progress.completed % 25 === 0 || progress.completed === progress.total) console.log(JSON.stringify(progress)); } });
  if (!values.canary) {
    const hosted = { schemaVersion: 1, origin: ORIGIN, catalogSha256,
      entries: result.checked.map(entry => ({ entryId: entry.entryId, sha256: entry.sha256, url: entry.url })) };
    const filename = 'data/word-image-hosted-manifest.json';
    try { writeFileSync(filename, json(hosted), { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST' || JSON.stringify(JSON.parse(readFileSync(filename))) !== JSON.stringify(hosted)) throw error; }
  }
  console.log(JSON.stringify({ ...result, checked: undefined }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
