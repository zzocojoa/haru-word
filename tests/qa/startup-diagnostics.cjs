const fs = require('node:fs');

// Only startup resource metadata. Never record headers, queries, response bodies,
// learner text, or arbitrary URLs/errors from the page.
function startupDiagnostics(context, { base, file, engine, mode }) {
  const started = Date.now(), events = [], ids = new WeakMap();
  let nextId = 0, dropped = 0, phase = 'created';
  function record(event, request, status) {
    const item = { ms: Date.now() - started, event };
    if (request) {
      const url = new URL(request.url());
      if (url.origin !== base || !(/^\/_next\/static\/chunks\/[^/]+\.js$/.test(url.pathname)
          || ['/api/state', '/api/study-clock'].includes(url.pathname))) return;
      if (!ids.has(request)) ids.set(request, ++nextId);
      Object.assign(item, { id: ids.get(request), path: url.pathname });
      if (status !== undefined) item.status = status;
    }
    if (events.length === 256) { events.shift(); dropped++; }
    events.push(item);
  }
  const handlers = {
    request: request => record('request', request),
    response: response => record('response', response.request(), response.status()),
    requestfinished: request => record('finished', request),
    requestfailed: request => record('failed', request),
  };
  for (const [name, handler] of Object.entries(handlers)) context.on(name, handler);
  const result = passed => ({ engine, mode, passed, phase, elapsedMs: Date.now() - started, dropped, events });
  // Persist the case identity before navigation, even if the outer process dies.
  fs.writeFileSync(file, JSON.stringify(result(null), null, 2));
  console.log(JSON.stringify({ engine, mode, event: 'startup-case-start', diagnostic: file }));
  return {
    phase(value) { phase = value; record(value); },
    held(request) { record('held', request); },
    continued(request) { record('continued', request); },
    finish(passed, pageErrorCount = 0) {
      for (const [name, handler] of Object.entries(handlers)) context.off(name, handler);
      fs.writeFileSync(file, JSON.stringify({ ...result(passed), pageErrorCount }, null, 2));
      console.log(JSON.stringify({ engine, mode, passed, phase, diagnostic: file }));
    },
  };
}

module.exports = { startupDiagnostics };
