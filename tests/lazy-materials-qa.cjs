// Built loopback Worker and a synthetic account only; no real learner or AI.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker } = require('./qa/runtime.cjs');
const { history } = require('./fixtures/backup-history.cjs');
const out = `outputs/lazy-materials/${process.env.QA_BROWSER || 'chromium'}`;
const content = JSON.parse(fs.readFileSync('data/content.json'));
const lastHash = JSON.parse(fs.readFileSync('data/word-image-ui.json')).entries.at(-1)[1];
const heavy = new Set(fs.readdirSync('dist/client/_next/static/chunks').filter(name => name.endsWith('.js')).filter(name => {
  const text = fs.readFileSync('dist/client/_next/static/chunks/' + name, 'utf8');
  return text.includes('We talked about work after lunch.') || text.includes(lastHash) || text.includes('원형·현재') || text.includes('I am now reading.') || text.includes('The teacher reads.');
}));
assert.ok(heavy.size);
(async () => {
  await waitForWorker(); fs.mkdirSync(out, { recursive: true });
  const browser = await launchBrowser(), checks = [], errors = [], requests = [], forbidden = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('lazy_materials') });
    const get = async () => { const response = await context.request.get(base + '/api/state'); assert.equal(response.status(), 200); return response.json(); };
    const initial = await get(), state = { ...history(1, 3), grammar: {} };
    const firstId = Object.keys(state.progress)[0];
    state.progress[firstId] = { ...state.progress[firstId], example: 'This is my stored example.', notes: 'keep my note' };
    const restored = await context.request.post(base + '/api/state/restore', { headers: { 'X-Study-Revision': String(initial.revision), 'X-Study-Grammar': '4' }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(restored.status(), 200); const before = await get();
    let failure = 'editor', holdImages = true, heldImageModule, holdReload = false, heldReload;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), filename = path.posix.basename(url.pathname);
      if (url.origin !== base) return route.abort();
      if (!['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/api/') && /feedback|automation|evaluation/.test(url.pathname)) { forbidden.push('write_or_ai'); return route.abort(); }
      if ((failure === 'editor' && /^word-editor-.*\.js$/.test(filename)) || (failure === 'dependency' && /^catalog-.*\.js$/.test(filename))) { failure = ''; return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Synthetic module unavailable' }); }
      if (holdReload && request.resourceType() === 'fetch' && /^word-editor-.*\.js$/.test(filename)) { heldReload = route; return; }
      if (/^image-practice-.*\.js$/.test(filename) && holdImages) { heldImageModule = route; return; }
      if (url.pathname.startsWith('/word-images/v1/')) {
        const file = path.join('public/word-images-pilot', filename);
        assert.ok(fs.existsSync(file), 'only first pilot image and next image expected');
        return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(file) });
      }
      return route.continue();
    });
    function observe(target) {
      target.setDefaultTimeout(30000);
      target.on('pageerror', error => { if (!/dynamically imported module|Importing a module script failed|module script|Failed to fetch/.test(error.message)) errors.push(error.name); });
      target.on('request', request => requests.push(new URL(request.url()).pathname));
    }
    page = await context.newPage(); observe(page);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('저장됨', { exact: true }).waitFor();
    assert.equal(requests.some(resource => heavy.has(path.posix.basename(resource))), false);
    checks.push('initial saved screen requests neither full examples nor image index');
    const search = page.getByLabel('단어 또는 한국어 뜻 검색');
    async function library() { await page.getByRole('tab', { name: '단어장', exact: true }).click(); await search.waitFor(); }
    async function editor() { await library(); await search.fill('apple'); await page.getByRole('button', { name: 'apple 명사', exact: true }).click(); }
    await library();
    assert.equal(requests.some(resource => heavy.has(path.posix.basename(resource))), false);
    checks.push('word list and search request neither full examples, image index nor grammar lessons');
    await editor();
    const failureAlert = () => page.getByRole('alert').filter({ hasText: '단어 편집 자료를 불러오지 못했어요.' });
    await failureAlert().waitFor();
    await page.getByRole('heading', { name: 'apple', exact: true }).waitFor();
    assert.deepEqual(await get(), before);
    // Cancelling a native unload must keep the original error view and state.
    await page.evaluate(() => { window.__qaUnload = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', window.__qaUnload); });
    const cancelled = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
    await page.getByRole('button', { name: '다시 불러오기', exact: true }).click(); await cancelled;
    await page.getByRole('button', { name: '다시 불러오기', exact: true }).waitFor();
    await page.evaluate(() => window.removeEventListener('beforeunload', window.__qaUnload));
    const origin = await page.evaluate(() => performance.timeOrigin);
    holdReload = true;
    const reloadRequest = page.waitForRequest(request => request.resourceType() === 'fetch' && /word-editor-.*\.js$/.test(request.url()));
    await page.getByRole('button', { name: '다시 불러오기', exact: true }).click(); await reloadRequest;
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const refreshed = page.waitForResponse(response => response.request().resourceType() === 'fetch' && /word-editor-.*\.js$/.test(response.url()));
    assert.ok(heldReload); holdReload = false; await heldReload.continue();
    await (await refreshed).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => performance.timeOrigin), origin, 'late recovery must not reload after closing the editor');
    await editor(); await failureAlert().waitFor();
    assert.deepEqual(await get(), before);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '다시 불러오기', exact: true }).click()]);
    await page.getByText('저장됨', { exact: true }).waitFor();
    failure = 'dependency'; await editor(); await failureAlert().waitFor();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '다시 불러오기', exact: true }).click()]);
    await page.getByText('저장됨', { exact: true }).waitFor();
    await editor();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('함께 익힐 표현', { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), content['adb44eba7b3ceef3'].expression);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('tab', { name: '오늘 학습', exact: true }).click(); await library();
    assert.equal(await search.inputValue(), 'apple');
    checks.push('editor entry and textbook failures recover without saving; accessible loading/error header, unload cancellation and late-close protection; list state retained');
    await page.getByRole('tab', { name: '오늘 학습', exact: true }).click();
    await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '이미지 연습 자료를 불러오는 중이에요.' }).waitFor();
    await page.getByRole('button', { name: '연습 닫기', exact: true }).click();
    assert.ok(heldImageModule);
    holdImages = false; await heldImageModule.continue();
    await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
    await page.getByRole('dialog').getByText('3,809개 · 성적은 기록하지 않아요', { exact: true }).waitFor();
    await page.getByRole('dialog').locator('.image-practice-flip').click();
    await page.getByRole('dialog').locator('.image-practice-answer').waitFor();
    await page.getByRole('button', { name: '연습 닫기', exact: true }).click();
    checks.push('closing an in-flight image module is safe; reopening reveals approved images without saves');
    assert.deepEqual(await get(), before); assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/verification.json', JSON.stringify({ passed: true, checks, applicationErrors: errors, forbiddenRequests: forbidden, fullStateAndRevisionUnchanged: true, actualIphoneChecked: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, fullStateAndRevisionUnchanged: true }));
    await context.close();
  } catch (error) {
    fs.writeFileSync(out + '/failure.json', JSON.stringify({ checks, error: error.message }, null, 2));
    if (page) await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
