const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launchBrowser, closeBrowser, accountHeaders, waitForWorker, base } = require('./qa/runtime.cjs');

(async () => {
  await waitForWorker();
  const browser = await launchBrowser();
  const errors = [], retiredRequests = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('retired_cards') });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/en-card|\/api\/card-|\/card-studio\//.test(request.url())) retiredRequests.push(request.url());
    });
    await page.goto(base);
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '영어 카드', exact: true }).count(), 0);
    const before = await (await context.request.get(base + '/api/state')).json();
    await page.goto(base + '/cards');
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
    const retiredEndpoints = [
      ['/api/card-studio/account', 'GET'], ['/api/card-studio/api/state', 'GET'],
      ['/api/card-studio/automation/start', 'POST'], ['/api/card-studio/automation', 'PUT'],
      ['/api/card-studio/api/assets/00000000-0000-0000-0000-000000000000', 'DELETE'],
      ['/api/card-automation', 'POST'], ['/api/card-automation-validation', 'POST'],
    ];
    // Old bookmarks and callers must terminate even without a login session.
    const anonymous = await browser.newContext();
    const anonymousRedirect = await anonymous.request.get(base + '/cards', { maxRedirects: 0 });
    assert.equal(anonymousRedirect.status(), 307);
    assert.equal(anonymousRedirect.headers().location, '/');
    for (const caller of [context, anonymous]) {
      for (const [path, method] of retiredEndpoints) {
        const response = await caller.request.fetch(base + path, { method });
        assert.equal(response.status(), 410, path);
        assert.equal((await response.json()).error, 'CARD_FEATURE_RETIRED');
        assert.equal(response.headers()['cache-control'], 'no-store');
      }
    }
    await anonymous.close();
    assert.equal((await context.request.get(base + '/card-studio/index.html')).status(), 404);
    const after = await (await context.request.get(base + '/api/state')).json();
    assert.deepEqual(after, before, 'retired card access must not change learning state or revision');
    await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await page.getByLabel('단어 또는 한국어 뜻 검색').fill('book');
    assert.ok(await page.getByRole('button', { name: /^book/ }).count() >= 2);
    await page.reload();
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(retiredRequests, [], 'learning pages must not request retired services');
    const report = { passed: true, engine: process.env.QA_BROWSER || 'chromium', checks: ['no card menu', 'authenticated and anonymous old bookmarks redirect home', 'seven retired API methods return 410 for authenticated and anonymous callers', 'card assets removed', 'learning state and revision preserved', 'word search and reload', 'no card requests or browser errors'] };
    fs.mkdirSync('outputs/card-retirement', { recursive: true });
    fs.writeFileSync(`outputs/card-retirement/${report.engine}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
