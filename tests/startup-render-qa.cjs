// Built loopback Worker, synthetic learners. Tests first render while requests are
// still pending; waiting for page.load would miss the original white-screen bug.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker } = require('./qa/runtime.cjs');
const out = 'outputs/startup-render';
// Screenshots deliberately capture pending fonts rather than awaiting font readiness.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
fs.mkdirSync(out, { recursive: true });

async function visibleShell(page) {
  await page.getByRole('heading', { name: '오늘의 학습', exact: true }).waitFor({ timeout: 5000 });
  assert.ok(await page.locator('.brand').isVisible());
  assert.ok(await page.getByRole('tablist', { name: '학습 화면' }).isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

(async () => {
  await waitForWorker();
  const results = [];
  for (const engine of ['webkit', 'chromium']) {
    const browser = await launchBrowser({ engine });
    try {
      for (const mode of ['font-pending', 'font-failed', 'javascript-pending', 'state-pending']) {
        const context = await browser.newContext({ viewport: { width: 440, height: 956 },
          screen: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true,
          hasTouch: true, extraHTTPHeaders: accountHeaders('startup_render') });
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        let delayed = 0;
        await context.route('https://fonts.googleapis.com/**', async route => {
          if (mode === 'font-pending') { delayed++; await gate; }
          if (mode === 'font-failed') return route.abort('failed');
          return route.fulfill({ contentType: 'text/css', body: ':root { --qa-font-ready: yes; }' });
        });
        if (mode === 'javascript-pending') await context.route('**/_next/static/chunks/*.js', async route => {
          delayed++; await gate; await route.continue();
        });
        if (mode === 'state-pending') await context.route('**/api/state**', async route => {
          delayed++; await gate; await route.continue();
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        try {
          await page.goto(base, { waitUntil: 'commit' });
          if (mode === 'javascript-pending' || mode === 'state-pending') {
            await page.getByRole('heading', { name: '하루단어', exact: true }).waitFor({ timeout: 5000 });
            assert.ok(await page.locator('.app-splash').isVisible());
            assert.ok(await page.getByRole('status').filter({ hasText: '학습 기록을 불러오는 중' }).isVisible());
            assert.equal(await page.locator('.shell').count(), 0);
          } else await visibleShell(page);
          if (mode !== 'font-failed') {
            const until = Date.now() + 5000;
            while (!delayed && Date.now() < until) await page.waitForTimeout(20);
            assert.ok(delayed > 0, 'the intended request must actually be pending');
          }
          if (mode !== 'javascript-pending' && mode !== 'state-pending') {
            // Optional font failures/delays must not prevent loading the account or using controls.
            await page.getByText('서버에 저장됨', { exact: true }).waitFor({ timeout: 5000 });
            await page.getByRole('button', { name: '학습 설정', exact: true }).click();
            await page.getByRole('dialog').waitFor();
            await page.getByRole('button', { name: 'Close', exact: true }).click();
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
          }
          await page.screenshot({ path: `${out}/${engine}-${mode}.png`, timeout: 5000 });
          release();
          await page.getByText('서버에 저장됨', { exact: true }).waitFor({ timeout: 10000 });
          assert.equal(await page.locator('.app-splash').count(), 0);
          if (mode !== 'font-failed') await page.waitForFunction(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--qa-font-ready').trim() === 'yes');
          assert.equal(await page.locator('link[data-web-fonts]').count(), 1);
          assert.deepEqual(errors, []);
          results.push({ engine, mode, delayed, passed: true });
        } finally { release(); await context.close(); }
      }
      // The initial HTML must also show a useful shell before any JS executes.
      const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
      const page = await noJS.newPage();
      await page.goto(base);
      assert.ok(await page.getByRole('heading', { name: '하루단어', exact: true }).isVisible());
      // Playwright's text engine deliberately skips noscript descendants.
      assert.ok(await page.locator('noscript p').isVisible());
      assert.equal(await page.locator('noscript p').textContent(), 'JavaScript를 켠 뒤 다시 열어 주세요.');
      assert.equal(await page.locator('.app-splash-status').isVisible(), false);
      assert.equal(await page.locator('link[href*="fonts.googleapis.com"]').count(), 0);
      await noJS.close();
      results.push({ engine, mode: 'no-javascript', passed: true });
      // Metadata and media matching are testable here; the native Home Screen
      // launch animation/cache still needs a physical iPhone check.
      for (const [width, height, ratio] of [[320,568,2],[390,844,3],[440,956,3],[956,440,3]]) {
        const context = await browser.newContext({ javaScriptEnabled: false,
          screen: { width, height }, viewport: { width, height }, deviceScaleFactor: ratio, isMobile: true });
        const page = await context.newPage();
        await page.goto(base);
        const links = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll(links =>
          links.map(link => ({ href: link.getAttribute('href'), matches: matchMedia(link.media).matches })));
        const matches = links.filter(link => link.matches);
        assert.equal(matches.length, 1, `${engine}: one matching startup image at ${width}x${height}@${ratio}`);
        const image = await context.request.get(base + matches[0].href);
        assert.equal(image.status(), 200);
        const png = await image.body();
        assert.equal(png.readUInt32BE(16), width * ratio);
        assert.equal(png.readUInt32BE(20), height * ratio);
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#ffffff');
        assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'), 'yes');
        assert.equal(await page.locator('link[rel="manifest"]').getAttribute('href'), '/manifest.webmanifest');
        assert.equal(await page.locator('link[rel="manifest"]').getAttribute('crossorigin'), 'use-credentials');
        const manifest = await context.request.get(base + '/manifest.webmanifest');
        assert.equal(manifest.status(), 200);
        assert.equal((await manifest.json()).start_url, '/');
        await context.close();
      }
      results.push({ engine, mode: 'startup-metadata-four-screens', passed: true });
    } finally { await closeBrowser(browser); }
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ passed: true, results }, null, 2));
  console.log(JSON.stringify({ passed: true, results }));
})().catch(error => { console.error(error); process.exitCode = 1; });
