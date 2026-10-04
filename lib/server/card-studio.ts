export type CardStudioConfig = {
  card_studio_enabled?: string;
  card_studio_owner_id?: string;
  card_studio_bridge_secret?: string;
  card_studio_origin?: string;
};
export type StudioUser = { userId: string } | null;
const BASE = '/api/card-studio';
const MESSAGE = '영어 카드 연결 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요.';
const UUID = '[a-fA-F0-9-]{36}';
const DELIVERY = '[A-Za-z0-9_:-]{1,200}';
const routes: Record<string, RegExp[]> = {
  GET: [
    /^\/automation(?:\/runs)?$/,
    new RegExp(`^/api/cards/${UUID}$`),
    /^\/api\/(boot|state|export)$/,
    /^\/api\/page\/(cards|assets|schedules|deliveries)$/,
    new RegExp(`^/api/deliveries/${DELIVERY}/attempts$`),
    new RegExp(`^/api/schedules/${UUID}/(pause-preview|recovery|recovery-history)$`),
    /^\/(images|original)\/[a-f0-9]{64}(\.png)?$/,
  ],
  POST: [
    /^\/automation\/(start|pause|trial)$/,
    /^\/api\/(cards|schedules|import|dry-run|disconnect|connection\/retry|studio\/kakao)$/,
    new RegExp(`^/api/cards/${UUID}/(image|review)$`),
    new RegExp(`^/api/schedules/${UUID}/(pause|cancel|resume|recovery)$`),
    new RegExp(`^/api/deliveries/${DELIVERY}/resolve$`),
  ],
  PUT: [/^\/automation$/, new RegExp(`^/api/(cards|schedules)/${UUID}$`)],
  DELETE: [new RegExp(`^/api/assets/${UUID}$`)],
};
export function isCardStudioOwner(config: CardStudioConfig, user: StudioUser): boolean {
  return config.card_studio_enabled === 'true' && Boolean(config.card_studio_owner_id) &&
    Boolean(user) && user!.userId === config.card_studio_owner_id;
}
function failure(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function boundedBody(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get('Content-Length')) > limit) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

// Identity comes exclusively from Sites dispatch. Browser headers/cookies are
// never forwarded to the card server; every route rechecks the one allowed user.
export async function proxyCardStudio(request: Request, config: CardStudioConfig,
  user: StudioUser, transport: typeof fetch = fetch): Promise<Response> {
  if (!user) return failure(401, 'LOGIN_REQUIRED', '하루단어에 로그인해 주세요.');
  if (config.card_studio_enabled !== 'true' || !config.card_studio_owner_id)
    return failure(503, 'STUDIO_UNAVAILABLE', '개인 영어 카드 연결을 준비하고 있습니다.');
  if (!isCardStudioOwner(config, user)) return failure(403, 'NOT_OWNER', '본인 전용 작업실입니다.');
  if (!config.card_studio_bridge_secret || config.card_studio_bridge_secret.length < 32)
    return failure(503, 'STUDIO_CONFIG', '영어 카드 연결 설정을 확인해 주세요.');
  const url = new URL(request.url);
  if (!url.pathname.startsWith(BASE + '/')) return failure(404, 'NOT_FOUND', '요청한 기능이 없습니다.');
  const path = url.pathname.slice(BASE.length);
  if (!routes[request.method]?.some(pattern => pattern.test(path)))
    return failure(404, 'NOT_FOUND', '요청한 기능이 없습니다.');
  let origin: URL;
  try {
    origin = new URL(config.card_studio_origin ?? 'https://en-card.kmksla4.workers.dev');
    const loopback = (hostname: string) => hostname === '127.0.0.1' || hostname === 'localhost';
    if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback(origin.hostname) && loopback(url.hostname)))) throw new Error();
  } catch { return failure(503, 'STUDIO_CONFIG', '영어 카드 연결 주소를 확인해 주세요.'); }
  const headers = new Headers({ Authorization: `Bearer ${config.card_studio_bridge_secret}`,
    'X-Studio-User': user.userId, Origin: origin.origin });
  const mutation = request.method !== 'GET';
  let body: Uint8Array | undefined;
  if (mutation) {
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')
      return failure(403, 'ORIGIN', '하루단어 화면에서 다시 시도해 주세요.');
    const image = /\/image$/.test(path);
    const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim();
    if (contentType !== (image ? 'image/png' : 'application/json'))
      return failure(415, 'CONTENT_TYPE', '요청 형식이 올바르지 않습니다.');
    headers.set('Content-Type', contentType);
    if (image) headers.set('X-Card-Revision', request.headers.get('X-Card-Revision') ?? '');
    try { body = await boundedBody(request, path.startsWith('/automation') ? 4096 : 1_048_576); }
    catch (error) { return failure(error instanceof RangeError ? 413 : 400, 'BODY', '요청 크기나 전송 상태를 확인해 주세요.'); }
  }
  try {
    const upstreamPath = path.startsWith('/automation') ? `/api${path}` : path;
    const response = await transport(`${origin.origin}${upstreamPath}${url.search}`, {
      method: request.method, headers, ...(body ? { body: body as BodyInit } : {}),
      redirect: 'manual', signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return failure(502, 'STUDIO_REDIRECT', MESSAGE);
    }
    const resultHeaders = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    for (const key of ['Content-Type', 'Content-Disposition']) {
      const value = response.headers.get(key); if (value) resultHeaders.set(key, value);
    }
    return new Response(response.body, { status: response.status, headers: resultHeaders });
  } catch { return failure(502, 'STUDIO_UPSTREAM', MESSAGE); }
}
