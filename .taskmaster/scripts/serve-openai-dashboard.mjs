import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, readDashboardSnapshot, renderDashboard } from './openai-dashboard-data.mjs';

export function createDashboardServer({ projectRoot = PROJECT_ROOT } = {}) {
  const projectKey = createHash('sha256').update(resolve(projectRoot)).digest('hex').slice(0,20);
  const server = createServer(async (request, response) => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const expectedHost = '127.0.0.1:' + port;
    const origin = request.headers.origin;
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin',
    };
    function send(status, body, type = 'application/json; charset=utf-8') {
      response.writeHead(status, { ...headers, 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    }
    if (request.headers.host !== expectedHost || (origin && origin !== 'http://' + expectedHost)
      || request.headers['sec-fetch-site'] === 'cross-site') return send(403, '{"error":"local_origin_required"}');
    if (!['GET','HEAD'].includes(request.method)) return send(405, '{"error":"read_only"}');
    let url;
    try { url = new URL(request.url, 'http://' + expectedHost); } catch { return send(400, '{"error":"invalid_url"}'); }
    if (url.pathname === '/api/health') return send(200, JSON.stringify({ app: 'haru-task-dashboard', projectKey }));
    if (url.pathname === '/favicon.ico') return send(204, '', 'image/x-icon');
    if (!['/','/index.html','/api/tasks'].includes(url.pathname)) return send(404, '{"error":"not_found"}');
    try {
      const snapshot = await readDashboardSnapshot(projectRoot, url.searchParams.get('plan') ?? undefined);
      if (url.pathname === '/api/tasks') return send(200, JSON.stringify(snapshot));
      response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
      return send(200, await renderDashboard(snapshot), 'text/html; charset=utf-8');
    } catch (error) { return error.message === 'unknown_plan' ? send(400, '{"error":"unknown_plan"}') : send(503, '{"error":"task_source_unavailable"}'); }
  });
  return { server, projectKey };
}

async function main() {
  let port = 4318;
  if (process.argv.length > 2) {
    if (process.argv[2] !== '--port' || process.argv.length !== 4 || !/^\d+$/.test(process.argv[3])) throw new Error('usage');
    port = Number(process.argv[3]);
    if (port < 1024 || port > 65530) throw new Error('port');
  }
  const { server, projectKey } = createDashboardServer();
  for (let attempt = 0; attempt < 6; attempt++, port++) {
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
      console.log(JSON.stringify({ url: 'http://127.0.0.1:' + port, readOnly: true, refreshSeconds: 5 }));
      const stop = () => server.close(() => process.exit(0));
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      try {
        const health = await (await fetch('http://127.0.0.1:' + port + '/api/health', { signal: AbortSignal.timeout(800) })).json();
        if (health.app === 'haru-task-dashboard' && health.projectKey === projectKey) {
          console.log(JSON.stringify({ url: 'http://127.0.0.1:' + port, existing: true, readOnly: true }));
          return;
        }
      } catch { /* The occupied port is not this project's dashboard. */ }
    }
  }
  throw new Error('no_local_port');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('로컬 대시보드를 시작하지 못했습니다. 포트와 작업 JSON을 확인해 주세요.'); process.exitCode = 1; });
}
