// Built loopback Worker, synthetic learners. Tests first render while requests are
// still pending; waiting for page.load would miss the original white-screen bug.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker } = require('./qa/runtime.cjs');
const { startupDiagnostics } = require('./qa/startup-diagnostics.cjs');
const out = 'outputs/startup-render';
// Screenshots deliberately capture pending fonts rather than awaiting font readiness.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
fs.mkdirSync(out, { recursive: true });
const diagnosticDir = fs.mkdtempSync(`${out}/run-`);

async function visibleShell(page) {
  await page.getByRole('heading', { name: '오늘 학습', exact: true }).waitFor({ timeout: 5000 });
  assert.ok(await page.locator('.brand').isVisible());
  assert.ok(await page.getByRole('tablist', { name: '학습 화면' }).isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

// Replay real provider CSS/WOFF2, including unicode subsets. Never replace the
// display policy: this regression must exercise the URL chosen by the app.
const fontAssets = new Map();
const fontUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
async function fontAsset(url) {
  assert.ok(['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(url).hostname));
  if (!fontAssets.has(url)) fontAssets.set(url, (async () => {
    const key = createHash('sha256').update(fontUserAgent + url).digest('hex'), file = `${out}/font-assets/${key}`;
    fs.mkdirSync(`${out}/font-assets`, { recursive: true });
    if (!fs.existsSync(file)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: {
        'User-Agent': fontUserAgent,
      } });
      assert.equal(response.status, 200, 'real font fixture fetch must succeed');
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    }
    return fs.readFileSync(file);
  })());
  return fontAssets.get(url);
}

async function fontInteraction(browser, engine, mode, width = 390, zoom = 100) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, extraHTTPHeaders: accountHeaders('font_interaction') });
  const pending = [], errors = [];
  let stylesheet, css, display, served = 0, releaseAll = mode === 'ready';
  const fulfillFont = async route => {
    const body = await fontAsset(route.request().url()); served++;
    await route.fulfill({ body, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
  };
  await context.route('https://fonts.gstatic.com/**', route => releaseAll ? fulfillFont(route) : pending.push(route));
  await context.route('https://fonts.googleapis.com/**', async route => {
    stylesheet = route; display = new URL(route.request().url()).searchParams.get('display');
    css = await fontAsset(route.request().url());
    assert.match(css.toString(), new RegExp(`font-display:\\s*${display}`));
    assert.match(css.toString(), /unicode-range:/, 'the captured response must contain the real split font');
    if (mode === 'subsets' || mode === 'ready') await route.fulfill({ body: css, contentType: 'text/css' });
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('저장됨', { exact: true }).waitFor();
    const until = Date.now() + 30000;
    while (!css && Date.now() < until) await page.waitForTimeout(20);
    assert.ok(css?.length, 'real stylesheet must have arrived in the test harness');
    let button = page.getByRole('button', { name: '학습 설정', exact: true });
    if (mode === 'subsets' || mode === 'ready') {
      await page.waitForFunction(() => document.fonts.size > 0);
      if (mode === 'ready') await page.evaluate(() => document.fonts.ready);
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
      if (zoom !== 100) await page.evaluate(value => { document.documentElement.style.fontSize = `${value}%`; }, zoom);
      button = page.getByRole('button', { name: 'work 동사', exact: true });
      await button.scrollIntoViewIfNeeded();
      if (mode === 'subsets') {
        await page.waitForTimeout(300); // Exceed the optional face's short initial display period.
        const partial = pending.filter(route => /\/dmsans\/|\.11[789]\.woff2/.test(route.request().url()));
        assert.ok(partial.length > 0 && pending.length > partial.length, 'both partial and delayed real font subsets are required');
        for (const route of partial) { pending.splice(pending.indexOf(route), 1); await fulfillFont(route); }
        await page.waitForTimeout(150);
      }
    }
    const element = await button.elementHandle(), before = await element.boundingBox(); assert.ok(before);
    if (mode === 'stylesheet-keyboard') {
      await button.focus(); await page.keyboard.down('Enter');
    } else {
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down();
    }
    releaseAll = true;
    if (mode.startsWith('stylesheet-')) await stylesheet.fulfill({ body: css, contentType: 'text/css' });
    for (const route of pending.splice(0)) await fulfillFont(route);
    await page.waitForTimeout(300); await page.evaluate(() => document.fonts.ready);
    const after = await element.boundingBox();
    if (mode === 'stylesheet-keyboard') await page.keyboard.up('Enter'); else await page.mouse.up();
    await page.getByRole('dialog').waitFor({ timeout: 5000 });
    if (mode === 'subsets' || mode === 'ready') {
      await page.getByRole('dialog').getByRole('button', { name: '다른 뜻 추가', exact: true }).waitFor({ timeout: 5000 });
      assert.ok(served > 0, 'this test must load actual font files');
      assert.equal(await page.locator('link[data-web-fonts]').count(), 1);
    } else {
      assert.equal(await page.locator('link[data-web-fonts]').count(), 0, 'interaction cancels an unapplied stylesheet');
      assert.equal(await page.evaluate(() => document.fonts.size), 0, 'late CSS must not introduce fonts after interaction');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    const result = { engine, mode, width, zoom, display, served, before, after, passed: true };
    console.log(JSON.stringify(result)); return result;
  } finally { await context.close(); }
}

(async () => {
  await waitForWorker();
  const results = [];
  for (const engine of ['webkit', 'chromium']) {
    const browser = await launchBrowser({ engine });
    try {
      if (!process.argv.includes('--fonts-only')) {
      for (const mode of ['font-pending', 'font-failed', 'javascript-pending', 'state-pending']) {
        const context = await browser.newContext({ viewport: { width: 440, height: 956 },
          screen: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true,
          hasTouch: true, extraHTTPHeaders: accountHeaders('startup_render') });
        const diagnostic = startupDiagnostics(context, { base, engine, mode,
          file: `${diagnosticDir}/${engine}-${mode}.json` });
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        let delayed = 0;
        await context.route('https://fonts.googleapis.com/**', async route => {
          if (mode === 'font-pending') { delayed++; await gate; }
          if (mode === 'font-failed') return route.abort('failed');
          return route.fulfill({ contentType: 'text/css', body: ':root { --qa-font-ready: yes; }' });
        });
        if (mode === 'javascript-pending') await context.route('**/_next/static/chunks/*.js', async route => {
          delayed++; diagnostic.held(route.request()); await gate; await route.continue(); diagnostic.continued(route.request());
        });
        if (mode === 'state-pending') await context.route('**/api/state**', async route => {
          delayed++; diagnostic.held(route.request()); await gate; await route.continue(); diagnostic.continued(route.request());
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        try {
          diagnostic.phase('navigation');
          await page.goto(base, { waitUntil: 'commit' });
          diagnostic.phase('pending-ui');
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
            await page.getByText('저장됨', { exact: true }).waitFor({ timeout: 5000 });
            await page.getByRole('button', { name: '학습 설정', exact: true }).click();
            await page.getByRole('dialog').waitFor();
            await page.getByRole('button', { name: '닫기', exact: true }).click();
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
          }
          diagnostic.phase('pending-screenshot');
          await page.screenshot({ path: `${out}/${engine}-${mode}.png`, timeout: 5000 });
          diagnostic.phase('release');
          release();
          diagnostic.phase('saved-status');
          await page.getByText('저장됨', { exact: true }).waitFor({ timeout: 10000 });
          diagnostic.phase('settled-ui');
          assert.equal(await page.locator('.app-splash').count(), 0);
          if (!['font-pending', 'font-failed'].includes(mode)) await page.waitForFunction(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--qa-font-ready').trim() === 'yes');
          assert.equal(await page.locator('link[data-web-fonts]').count(), ['font-pending', 'font-failed'].includes(mode) ? 0 : 1);
          assert.deepEqual(errors, []);
          results.push({ engine, mode, delayed, passed: true });
          diagnostic.finish(true, errors.length);
        } catch (error) {
          diagnostic.finish(false, errors.length);
          await page.screenshot({ path: `${diagnosticDir}/${engine}-${mode}-failure.png`, timeout: 2000 }).catch(() => {});
          throw error;
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
      }
      for (const [width, zoom] of [[390,100], [320,100], [1440,100], [390,200]])
        results.push(await fontInteraction(browser, engine, 'subsets', width, zoom));
      for (const mode of ['stylesheet-pointer', 'stylesheet-keyboard', 'ready'])
        results.push(await fontInteraction(browser, engine, mode));
    } finally { await closeBrowser(browser); }
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ passed: true, results }, null, 2));
  fs.writeFileSync(`${out}/font-assets.json`, JSON.stringify(await Promise.all([...fontAssets].map(async ([url, body]) =>
    ({ url, sha256: createHash('sha256').update(await body).digest('hex') }))), null, 2));
  console.log(JSON.stringify({ passed: true, results }));
})().catch(error => { console.error(error); process.exitCode = 1; });
