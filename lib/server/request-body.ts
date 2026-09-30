export type BodyLimits = { bytes: number; characters?: number };
export type BodyMetrics = { bytes: number };
type BodyErrorCode = 'body_too_large' | 'body_unreadable' | 'body_aborted';

// Preserve the existing 12,000 UTF-16 character AI contract. Valid UTF-8 uses
// at most three bytes per UTF-16 code unit, including Korean and emoji pairs.
export const FEEDBACK_BODY_LIMITS: BodyLimits = { bytes: 36_000, characters: 12_000 };

export class RequestBodyError extends Error {
  readonly status: number;
  constructor(readonly code: BodyErrorCode, readonly bytes: number, readonly limit: number,
    readonly characters?: number, readonly characterLimit?: number) {
    super(code === 'body_too_large' ? '전송 크기 한도를 넘었어요.' : '요청 내용을 읽지 못했어요.');
    this.status = code === 'body_too_large' ? 413 : 400;
  }
}

// Invoke only after authentication/origin checks. Content-Length is an early
// rejection hint; the stream's actual bytes remain authoritative.
export async function readBoundedJsonText(request: Request, limits: BodyLimits, metrics?: BodyMetrics): Promise<string> {
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    if (!request.body) throw new Error('Missing body');
    reader = request.body.getReader();
  } catch { throw new RequestBodyError('body_unreadable', 0, limits.bytes); }
  let bytes = 0, raw = '', completed = false, cancelled = false;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    // Teardown must neither delay a rejection nor replace its 413/400 result.
    // Some sources reject or never settle cancel(); no more reads are issued.
    void reader.cancel().catch(() => {});
  };
  const checkAbort = () => { if (request.signal.aborted) throw new RequestBodyError('body_aborted', bytes, limits.bytes); };
  const checkCharacters = () => {
    if (limits.characters !== undefined && raw.length > limits.characters)
      throw new RequestBodyError('body_too_large', bytes, limits.bytes, raw.length, limits.characters);
  };
  request.signal.addEventListener('abort', cancel, { once: true });
  try {
    checkAbort();
    const length = request.headers.get('content-length');
    if (length !== null && /^\d+$/.test(length) && Number(length) > limits.bytes)
      throw new RequestBodyError('body_too_large', 0, limits.bytes);
    while (true) {
      const { done, value } = await reader.read();
      checkAbort();
      if (done) break;
      bytes += value.byteLength;
      if (metrics) metrics.bytes = bytes;
      if (bytes > limits.bytes) throw new RequestBodyError('body_too_large', bytes, limits.bytes);
      raw += decoder.decode(value, { stream: true });
      checkCharacters();
    }
    raw += decoder.decode();
    checkCharacters();
    completed = true;
    return raw;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(request.signal.aborted ? 'body_aborted' : 'body_unreadable', bytes, limits.bytes);
  } finally {
    request.signal.removeEventListener('abort', cancel);
    if (!completed) cancel();
    reader.releaseLock();
  }
}

export function logBodyRejection(error: unknown, operation: 'save' | 'restore' | 'sentence_feedback' | 'grammar_feedback') {
  if (error instanceof RequestBodyError)
    console.warn(JSON.stringify({ event: 'request_body_rejected', operation, code: error.code, status: error.status, bytes: error.bytes, limit: error.limit,
      ...(error.characterLimit !== undefined ? { characters: error.characters, characterLimit: error.characterLimit } : {}) }));
}
