// Synthetic accounts and faults on the local built Worker only.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker, axePath } = require('./qa/runtime.cjs');
const out = 'outputs/startup-lifecycle';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
fs.mkdirSync(out, { recursive: true });

(async () => {
  await waitForWorker();
  const results = [];
  for (const engine of ['webkit', 'chromium']) {
    const browser = await launchBrowser({ engine });
    try {
      for (const failure of ['signed-out', 'unavailable', 'timeout']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 },
          extraHTTPHeaders: accountHeaders('splash_lifecycle') });
        await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        let calls = 0;
        await context.route('**/api/state', async route => {
          calls++;
          await gate;
          if (failure === 'signed-out') return route.fulfill({ status: 401, json: { error: '로그인 필요' } });
          return route.fulfill({ status: 503, json: { error: '기록 조회 점검 중' } });
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        try {
          await page.clock.install();
          await page.goto(base, { waitUntil: 'domcontentloaded' });
          await page.locator('.app-splash').waitFor();
          await page.waitForFunction(() => document.querySelector('link[data-web-fonts]'));
          // Wait for the actual state request before advancing its timeout.
          const deadline = Date.now() + 5000;
          while (!calls && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
          assert.ok(calls > 0, 'initial state request must start');
          assert.equal(await page.locator('.shell').count(), 0);
          if (failure === 'timeout') await page.clock.fastForward(20_050);
          else release();
          await page.locator('.app-splash').waitFor({ state: 'hidden' });
          if (failure === 'signed-out') {
            assert.ok(await page.getByRole('link', { name: '로그인하고 학습하기', exact: false }).isVisible());
          } else {
            await page.getByRole('alert').filter({ hasText: failure === 'timeout' ? '불러오는 데 시간이 오래' : '기록 조회 점검 중' }).waitFor();
            assert.equal(calls, 1, 'initial failure must not trigger automatic retries');
            release();
            await context.unroute('**/api/state');
            let retries = 0;
            // A second failure must still settle to usable recovery controls;
            // neither a failed retry nor a successful one may replay startup.
            for (const retryFails of [true, false]) {
              let retryRelease;
              const retryGate = new Promise(resolve => { retryRelease = resolve; });
              await context.route('**/api/state', async route => {
                retries++;
                await retryGate;
                if (retryFails) return route.fulfill({ status: 503, json: { error: '재시도 연결 실패' } });
                await route.continue();
              });
              try {
                await page.getByRole('button', { name: '다시 시도', exact: true }).click();
                await page.getByText('기록 불러오는 중', { exact: true }).waitFor();
                assert.equal(await page.locator('.app-splash').count(), 0, 'retry must preserve the normal recovery surface');
                retryRelease();
                if (retryFails) {
                  await page.getByRole('alert').filter({ hasText: '재시도 연결 실패' }).waitFor();
                  assert.ok(await page.getByRole('button', { name: '다시 시도', exact: true }).isEnabled());
                } else await page.getByText('저장됨', { exact: true }).waitFor();
                assert.equal(await page.locator('.app-splash').count(), 0);
              } finally {
                retryRelease();
                await context.unroute('**/api/state');
              }
            }
            assert.equal(retries, 2, 'one request per manual retry, even after repeated failures');
            const before = await (await context.request.get(base + '/api/state')).json();
            for (const name of ['단어장', '복습 점검', '학습 기록', '오늘 학습']) {
              await page.getByRole('tab', { name, exact: true }).click();
              assert.equal(await page.locator('.app-splash').count(), 0, 'tab changes must not replay startup');
            }
            assert.deepEqual(await (await context.request.get(base + '/api/state')).json(), before);
          }
          assert.deepEqual(errors, []);
          results.push({ engine, failure, passed: true });
        } finally { release(); await context.close(); }
      }
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await context.route('**/_next/static/chunks/*.js', async route => { await gate; await route.continue(); });
      const page = await context.newPage();
      try {
        await page.goto(base, { waitUntil: 'commit' });
        await page.locator('.app-splash').waitFor();
        assert.equal(await page.locator('.app-splash-spinner').evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.addScriptTag({ path: axePath });
        const issues = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } })).violations.map(v => v.id));
        assert.deepEqual(issues, []);
        for (const width of [320,390,440,1440]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: `${out}/${engine}-${width}.png` });
        }
        await page.setViewportSize({ width: 320, height: 568 });
        await page.addStyleTag({ content: 'html {font-size:200% !important}' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.ok(await page.getByRole('heading', { name: '하루단어', exact: true }).isVisible());
        await page.screenshot({ path: `${out}/${engine}-200-percent.png` });
        results.push({ engine, mode: 'first-html-responsive-accessible-reduced-motion', passed: true });
      } finally { release(); await context.close(); }

      if (engine === 'chromium') {
        // Model private-host cookie auth. The old missing attribute must fail,
        // and the real HTML must allow Chromium to fetch its manifest with cookies.
        for (const stripCredentials of [true, false]) {
          const context = await browser.newContext();
          await context.addCookies([{ name: 'qa_manifest_auth', value: 'synthetic', url: base }]);
          if (stripCredentials) await context.route(base + '/', async route => {
            const response = await route.fetch();
            const body = (await response.text()).replace(/ crossorigin="use-credentials"/gi, '');
            await route.fulfill({ response, body });
          });
          let sentCookie = false, manifestRequests = 0;
          await context.route('**/manifest.webmanifest', async route => {
            manifestRequests++;
            sentCookie = (await route.request().allHeaders()).cookie?.includes('qa_manifest_auth=synthetic') ?? false;
            if (!sentCookie) return route.fulfill({ status: 401, body: 'Sign in required' });
            return route.continue();
          });
          const page = await context.newPage();
          await page.goto(base, { waitUntil: 'domcontentloaded' });
          const cdp = await context.newCDPSession(page);
          const manifest = await cdp.send('Page.getAppManifest');
          assert.ok(manifestRequests > 0);
          assert.equal(sentCookie, !stripCredentials);
          if (!stripCredentials) assert.equal(JSON.parse(manifest.data).name, '하루단어');
          else assert.equal(manifest.data, '', '401 must leave no usable manifest');
          await context.close();
        }
        results.push({ engine, mode: 'private-manifest-cookie-positive-and-negative', passed: true });
      }
    } finally { await closeBrowser(browser); }
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ passed: true, results }, null, 2));
  console.log(JSON.stringify({ passed: true, results }));
})().catch(error => { console.error(error); process.exitCode = 1; });
