export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

// Call only after authentication. Body reading/size limits remain route-specific.
export function validateJsonMutation(request: Request): Response | null {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: '요청 출처를 확인할 수 없습니다.' }, 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'JSON 요청만 지원합니다.' }, 415);
  }
  return null;
}
