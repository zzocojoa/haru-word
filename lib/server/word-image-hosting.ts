import { timingSafeEqual } from 'node:crypto';

export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
type HostingEnv = { BUCKET?: R2Bucket; word_image_upload_key?: string; word_image_upload_expires?: string };
type ImageIndex = Readonly<Record<string, number>>;
const hashPattern = /^[a-f0-9]{64}$/;
const keyFor = (hash: string) => `oxford-images/v1/${hash}.webp`;
const failure = (status: number, code: string) => Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
const digest = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');

function metadataMatches(object: R2Object, hash: string, bytes: number) {
  return object.size === bytes && object.customMetadata?.sha256 === hash &&
    object.httpMetadata?.contentType === 'image/webp' && object.httpMetadata?.cacheControl === IMAGE_CACHE_CONTROL;
}

// This route only exposes reviewed, hash-addressed images. It has no learner/DB access.
export async function serveWordImage(request: Request, env: HostingEnv, images: ImageIndex, now = Date.now()) {
  const url = new URL(request.url), match = /^\/word-images\/v1\/([a-f0-9]{64})\.webp$/.exec(url.pathname);
  const hash = match?.[1], expectedBytes = hash && Object.hasOwn(images, hash) ? images[hash] : undefined;
  if (!hash || !expectedBytes) return failure(404, 'image_not_found');
  if (request.method === 'PUT') {
    const key = env.word_image_upload_key, expires = Date.parse(env.word_image_upload_expires || '');
    if (!key || !hashPattern.test(key) || !Number.isFinite(expires) || expires <= now || expires - now > 6 * 60 * 60_000)
      return failure(404, 'upload_disabled');
    const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '')?.[1];
    if (!token || !hashPattern.test(token) || !timingSafeEqual(new TextEncoder().encode(token), new TextEncoder().encode(key)) ||
      request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return failure(403, 'upload_forbidden');
    if (request.headers.get('Content-Type') !== 'image/webp') return failure(415, 'invalid_image_type');
    if (!env.BUCKET) return failure(503, 'image_storage_unavailable');
    const length = request.headers.get('Content-Length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) !== expectedBytes)) return failure(413, 'invalid_image_size');
    if (!request.body) return failure(400, 'invalid_image_body');
    const reader = request.body.getReader(), parts: Uint8Array[] = [];
    let size = 0, complete = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (request.signal.aborted) return failure(400, 'invalid_image_body');
        if (done) break;
        size += value.byteLength;
        if (size > expectedBytes) return failure(413, 'invalid_image_size');
        parts.push(value);
      }
      complete = true;
    } catch { return failure(400, 'invalid_image_body'); }
    finally { if (!complete) void reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (size !== expectedBytes) return failure(400, 'invalid_image_size');
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    if (await digest(bytes) !== hash || size < 12 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'RIFF' ||
      new TextDecoder().decode(bytes.subarray(8, 12)) !== 'WEBP') return failure(400, 'invalid_image_hash');
    try {
      const stored = await env.BUCKET.put(keyFor(hash), bytes, { onlyIf: new Headers({ 'If-None-Match': '*' }), sha256: hash,
        httpMetadata: { contentType: 'image/webp', cacheControl: IMAGE_CACHE_CONTROL }, customMetadata: { sha256: hash } });
      // A resumed/competing upload never overwrites an existing object.
      const result = stored || await env.BUCKET.head(keyFor(hash));
      if (!result || !metadataMatches(result, hash, expectedBytes)) return failure(409, 'image_storage_conflict');
      return Response.json({ sha256: hash, bytes: expectedBytes, created: !!stored }, { status: stored ? 201 : 200, headers: { 'Cache-Control': 'no-store' } });
    } catch { return failure(503, 'image_storage_failed'); }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return failure(405, 'method_not_allowed');
  if (!env.BUCKET) return failure(503, 'image_storage_unavailable');
  try {
    const object = request.method === 'HEAD' ? await env.BUCKET.head(keyFor(hash)) : await env.BUCKET.get(keyFor(hash));
    if (!object) return failure(404, 'image_not_found');
    if (!metadataMatches(object, hash, expectedBytes)) return failure(503, 'image_storage_invalid');
    const body = 'body' in object && object.body instanceof ReadableStream ? object.body : null;
    if (request.method === 'GET' && !body) return failure(503, 'image_storage_invalid');
    const headers = new Headers({ 'Content-Type': 'image/webp', 'Cache-Control': IMAGE_CACHE_CONTROL,
      ETag: `"${hash}"`, 'X-Content-Type-Options': 'nosniff' });
    if (request.headers.get('If-None-Match')?.split(',').some(tag => tag.trim().replace(/^W\//, '') === `"${hash}"` || tag.trim() === '*')) {
      if (body) void body.cancel().catch(() => {});
      return new Response(null, { status: 304, headers });
    }
    headers.set('Content-Length', String(expectedBytes));
    return new Response(request.method === 'GET' ? body : null, { headers });
  } catch { return failure(503, 'image_storage_failed'); }
}
