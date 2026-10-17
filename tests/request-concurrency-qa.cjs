// Real browser requests to an owned loopback server; no app, D1 or external services.
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http');
const { launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const { trackRequestConcurrency } = require('./qa/request-concurrency.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/request-concurrency/${engine}`;
const endpoint = '/api/image-practice/position';
async function waitFor(predicate) {
  const until = Date.now() + 5000;
  while (!predicate() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'controlled request must reach its expected phase');
}
(async () => {
  const pending = new Map(), forwarded = new Set();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== endpoint) { response.end('<!doctype html><title>Request concurrency fixture</title>'); return; }
    const id = url.searchParams.get('id'); pending.set(id, response);
    response.on('close', () => pending.delete(id));
    response.writeHead(id === 'second' ? 503 : 200, { 'Content-Type': 'application/json' });
    response.write('{"complete":'); // Headers and partial body arrive; the request is still unfinished.
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const matches = request => { const url = new URL(request.url()); return url.origin === base && url.pathname === endpoint; };
  let browser, counter;
  try {
    browser = await launchBrowser({ engine });
    const context = await browser.newContext(), page = await context.newPage();
    await page.route('**/*', async route => {
      await route.continue();
      if (matches(route.request())) forwarded.add(new URL(route.request().url()).searchParams.get('id'));
    });
    const events = ['request', 'requestfinished', 'requestfailed'];
    const listenersBefore = events.map(name => page.listenerCount(name));
    counter = trackRequestConcurrency(page, matches);
    await page.goto(base); // The document request must not be counted.
    assert.equal(counter.active, 0);
    const firstResponse = page.waitForResponse(response => response.url().endsWith('id=first'));
    await page.evaluate(url => { window.first = fetch(url).then(async response => { await response.text(); return response.status; }); }, `${base}${endpoint}?id=first`);
    await firstResponse; await waitFor(() => pending.has('first') && forwarded.has('first'));
    const activeAfterHeaders = counter.active;
    await page.evaluate(url => { window.second = fetch(url).then(async response => { await response.text(); return response.status; }); }, `${base}${endpoint}?id=second`);
    await waitFor(() => pending.size === 2 && forwarded.has('second'));
    const overlap = { engine, actualHeldRequests: pending.size, activeAfterHeaders, measuredActive: counter.active, measuredMaximum: counter.maximum };
    console.log(JSON.stringify(overlap));
    assert.equal(counter.active, 2, 'two unfinished HTTP requests must both remain active after route.continue');
    assert.equal(counter.maximum, 2, 'overlapping requests must measure 2');
    assert.equal(activeAfterHeaders, 1, 'response headers are not request completion');
    pending.get('first').end('true}');
    assert.equal(await page.evaluate(() => window.first), 200);
    await waitFor(() => counter.active === 1);
    pending.get('second').end('true}');
    assert.equal(await page.evaluate(() => window.second), 503);
    await waitFor(() => counter.active === 0);
    // Aborts end the same request lifetime without a successful response body.
    await page.evaluate(url => {
      window.abortController = new AbortController();
      window.aborted = fetch(url, { signal: window.abortController.signal }).then(response => response.text()).catch(error => error.name);
    }, `${base}${endpoint}?id=abort`);
    await waitFor(() => pending.has('abort') && counter.active === 1);
    await page.evaluate(() => window.abortController.abort());
    assert.equal(await page.evaluate(() => window.aborted), 'AbortError');
    await waitFor(() => counter.active === 0 && !pending.has('abort'));
    // Each page has its own controller: another tab must not inflate this page's count.
    const sibling = await context.newPage(); await sibling.goto(base);
    await sibling.evaluate(url => { window.result = fetch(url).then(response => response.text()); }, `${base}${endpoint}?id=sibling`);
    await waitFor(() => pending.has('sibling'));
    assert.equal(counter.active, 0);
    pending.get('sibling').end('true}'); await sibling.evaluate(() => window.result);
    await sibling.close();
    counter.dispose();
    assert.deepEqual(events.map(name => page.listenerCount(name)), listenersBefore);
    const report = { passed: true, ...overlap, pendingAtEnd: counter.active, httpErrorFinished: true, abortedRequestRemoved: true, otherPageExcluded: true, listenersRemoved: true };
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    counter?.dispose();
    try { if (browser) await closeBrowser(browser); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
