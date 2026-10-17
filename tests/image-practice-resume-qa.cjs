// Real isolated local D1, synthetic accounts; never send requests to a hosted app.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { history } = require('./fixtures/backup-history.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/image-practice-resume/${engine}`;
const rows = JSON.parse(fs.readFileSync('data/word-image-ui.json')).entries;
const ids = rows.map(row => row[0]), urls = rows.map(row => `/word-images/v1/${row[1]}.webp`);
const headers = { 'X-Study-Grammar': '4', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1' };
const endpoint = '/api/image-practice/position';
const assetRoot = process.env.QA_WORD_IMAGE_ASSET_ROOT || 'public/word-images-pilot';
const wait = async predicate => { for (let i = 0; i < 300; i++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 20)); } throw Error('Condition did not settle'); };
(async () => {
  await waitForWorker(); fs.mkdirSync(out, { recursive: true });
  const browser = await launchBrowser({ engine }), identity = accountHeaders('image_resume'), checks = [], errors = [];
  let page;
  try {
    const context = await browser.newContext({ extraHTTPHeaders: identity, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const getState = async () => { const r = await context.request.get(base + '/api/state', { headers }); assert.equal(r.status(), 200); return r.json(); };
    const getPosition = async () => { const r = await context.request.get(base + endpoint); assert.equal(r.status(), 200); return r.json(); };
    const writePosition = async (entryId, revision) => { const r = await context.request.put(base + endpoint, { data: { entryId, revision } }); assert.equal(r.status(), 200); return r.json(); };
    const initial = await getState(), state = { ...history(1, 3), grammar: {} };
    const setup = await context.request.post(base + '/api/state/restore', { headers: { ...headers, 'X-Study-Revision': String(initial.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(setup.status(), 200); const before = await getState();
    await require('esbuild').build({ entryPoints: ['lib/backup-format.ts'], outfile: 'work/image-practice-resume/backup.cjs', bundle: true, format: 'cjs', platform: 'node', logLevel: 'silent' });
    const { makeBackup } = require('../work/image-practice-resume/backup.cjs');
    const backupBefore = makeBackup(before.state, new Date('2026-10-17T00:00:00Z'));
    let mode = '', held = null, active = 0, maxActive = 0, blockImage = false;
    const calls = [], imageRequests = [], forbidden = [];
    async function routes(ctx, control = false) {
      await ctx.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== base) return route.abort();
        if (url.pathname.startsWith('/word-images/v1/')) {
          imageRequests.push(url.pathname);
          if (control && blockImage) return route.fulfill({ status: 503, body: 'Synthetic image unavailable' });
          return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(assetRoot, path.basename(url.pathname))) });
        }
        if (url.pathname.startsWith('/api/') && url.pathname !== endpoint && !['GET', 'HEAD'].includes(request.method())) { forbidden.push('unexpected_write'); return route.abort(); }
        if (url.pathname.startsWith('/api/') && /feedback|automation|evaluation/.test(url.pathname)) { forbidden.push('ai'); return route.abort(); }
        if (url.pathname === endpoint && control) {
          const method = request.method(); calls.push(method);
          active++; maxActive = Math.max(maxActive, active);
          try {
            if (mode === 'get-error' && method === 'GET' || mode === 'put-error' && method === 'PUT') return await route.fulfill({ status: 503, json: {} });
            if (mode === 'put-hold' && method === 'PUT') { mode = ''; held = { route, finish: () => { active--; } }; return; }
            if (mode === 'put-lost' && method === 'PUT') { mode = ''; await route.fetch(); return await route.abort(); }
            if (mode === 'put-timeout' && method === 'PUT') {
              mode = ''; held = { route, finish: () => { active--; } }; return;
            }
            return await route.continue();
          } finally { if (held?.route !== route) active--; }
        }
        return route.continue();
      });
    }
    await routes(context, true);
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.name));
    const ready = async p => { await p.goto(base, { waitUntil: 'domcontentloaded' }); await p.getByText('서버에 저장됨', { exact: true }).waitFor(); };
    const open = async (p = page) => { await p.getByRole('button', { name: '이미지 연습', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: /카드 번호/ }).waitFor(); return p.getByRole('dialog'); };
    const number = (n, p = page) => p.getByRole('dialog').getByRole('button', { name: `카드 번호 ${n} / 3809`, exact: true });
    const saved = async (p = page) => p.getByRole('dialog').getByText('위치 저장됨', { exact: true }).waitFor();
    const jump = async n => { const d = page.getByRole('dialog'); await d.getByRole('button', { name: /카드 번호/ }).click(); await d.getByLabel(/카드 번호 \(1/).fill(String(n)); await d.getByRole('button', { name: '이동', exact: true }).click();
      assert.equal(await number(n).evaluate(el => document.activeElement === el), true, 'jump returns focus to the surviving card number control'); };
    const close = async (p = page) => { await p.getByRole('button', { name: '연습 닫기', exact: true }).click(); await p.getByRole('dialog').waitFor({ state: 'hidden' }); };
    await ready(page); assert.equal(calls.length, 0); assert.equal(imageRequests.length, 0);
    let dialog = await open(); await number(1).waitFor(); assert.equal(await dialog.getByRole('button', { name: '이전', exact: true }).isDisabled(), true);
    await page.waitForFunction(() => document.querySelector('.image-practice-picture')?.naturalWidth > 0);
    assert.deepEqual([...new Set(imageRequests)], urls.slice(0, 2));
    await dialog.getByRole('button', { name: '단어 확인', exact: true }).click(); await dialog.locator('summary').filter({ hasText: /^발음$/ }).click();
    const historyLength = await page.evaluate(() => window.history.length);
    mode = 'put-hold'; await dialog.getByRole('button', { name: '다음', exact: true }).click(); await wait(() => held);
    await dialog.getByRole('button', { name: '다음', exact: true }).click(); await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await number(4).waitFor(); assert.equal(await dialog.locator('.image-practice-answer').count(), 0);
    assert.equal(calls.filter(c => c === 'PUT').length, 1); await close();
    const pending = held; held = null; await pending.route.continue(); pending.finish();
    await wait(async () => (await getPosition()).entryId === ids[3]);
    dialog = await open(); await number(4).waitFor(); assert.equal(await dialog.locator('.image-practice-answer').count(), 0); await saved();
    assert.equal(await page.evaluate(() => window.history.length), historyLength); checks.push('rapid navigation coalesces, closes while saving, resumes front, no history entries');
    await close(); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await page.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
    await open(); await number(4).waitFor(); await close(); await page.reload(); await page.getByText('서버에 저장됨', { exact: true }).waitFor(); await open(); await number(4).waitFor();
    const second = await browser.newContext({ extraHTTPHeaders: identity, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); await routes(second);
    const other = await second.newPage(); await ready(other); await open(other); await number(4, other).waitFor();
    checks.push('tab return, reload and separate browser context resume same account');
    await other.getByRole('dialog').getByRole('button', { name: '다음', exact: true }).click(); await saved(other);
    await page.getByRole('dialog').getByRole('button', { name: '이전', exact: true }).click();
    await page.getByRole('button', { name: '다른 기기 위치로 이동', exact: true }).waitFor();
    await page.getByRole('button', { name: '다른 기기 위치로 이동', exact: true }).click(); await number(5).waitFor(); await saved();
    await other.getByRole('dialog').getByRole('button', { name: '다음', exact: true }).click(); await saved(other);
    await page.getByRole('dialog').getByRole('button', { name: '이전', exact: true }).click();
    await page.getByRole('button', { name: '현재 위치 저장', exact: true }).waitFor();
    await page.getByRole('button', { name: '현재 위치 저장', exact: true }).click(); await number(4).waitFor(); await saved();
    assert.equal((await getPosition()).entryId, ids[3]); checks.push('two devices conflict and both explicit choices work');
    // Pages in one browser context share localStorage, unlike the device contexts above.
    const sibling = await context.newPage(); await ready(sibling); await open(sibling); await saved(sibling);
    mode = 'put-error'; await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor(); mode = '';
    await close(sibling);
    const siblingRead = sibling.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.request().method() === 'GET');
    await open(sibling); await (await siblingRead).finished(); await saved(sibling);
    const sharedDraft = await sibling.evaluate(owner => JSON.parse(localStorage.getItem(`haru-image-position-v1:${encodeURIComponent(owner)}`)), identity['oai-authenticated-user-id']);
    assert.equal(sharedDraft.pending, true); assert.equal(sharedDraft.entryId, ids[4]);
    await page.reload(); await page.getByText('서버에 저장됨', { exact: true }).waitFor(); await open(); await number(5).waitFor(); await saved();
    assert.equal((await getPosition()).entryId, ids[4]); await sibling.close();
    checks.push('same-browser tab lookup preserves another tab failed cursor across reload and recovery');
    const latestTab = await context.newPage(); await ready(latestTab); await open(latestTab); await saved(latestTab);
    // This tab has its own request queue; the held-request counter tracks the original tab.
    await latestTab.route('**/api/image-practice/position', route => route.continue());
    mode = 'put-hold'; await dialog.getByRole('button', { name: '다음', exact: true }).click(); await wait(() => held);
    await dialog.getByRole('button', { name: '다음', exact: true }).click(); await number(7).waitFor();
    await latestTab.getByRole('dialog').getByRole('button', { name: '다음', exact: true }).click(); await number(6, latestTab).waitFor(); await saved(latestTab);
    const latestSaved = await getPosition(), staleHeld = held; held = null;
    await staleHeld.route.abort(); staleHeld.finish(); await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
    const savedCache = await page.evaluate(owner => JSON.parse(localStorage.getItem(`haru-image-position-v1:${encodeURIComponent(owner)}`)), identity['oai-authenticated-user-id']);
    assert.equal(savedCache.pending, false); assert.equal(savedCache.entryId, ids[5]);
    const reloadStart = calls.length;
    await page.reload(); await page.getByText('서버에 저장됨', { exact: true }).waitFor(); await open(); await number(6).waitFor(); await saved();
    assert.deepEqual(calls.slice(reloadStart), ['GET']); assert.deepEqual(await getPosition(), latestSaved); await latestTab.close();
    checks.push('late failed write cannot resurrect an older draft over another tab saved choice or auto-replay after reload');
    mode = 'put-error'; await dialog.getByRole('button', { name: '다음', exact: true }).click(); await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
    const retryStart = calls.length; mode = ''; await page.getByRole('button', { name: '다시 저장', exact: true }).click(); await saved(); assert.deepEqual(calls.slice(retryStart), ['GET', 'PUT']);
    mode = 'put-lost'; await dialog.getByRole('button', { name: '다음', exact: true }).click(); await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
    const lostStart = calls.length; await page.getByRole('button', { name: '다시 저장', exact: true }).click(); await saved(); assert.deepEqual(calls.slice(lostStart), ['GET']);
    // Exercise the real 25s request deadline using the browser clock; the server receives no held write.
    await page.clock.install(); mode = 'put-timeout'; await dialog.getByRole('button', { name: '다음', exact: true }).click(); await wait(() => held);
    await page.clock.runFor(26000); await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
    const timeoutHeld = held; held = null; await timeoutHeld.route.abort(); timeoutHeld.finish();
    await page.clock.resume(); const timeoutStart = calls.length; await page.getByRole('button', { name: '다시 저장', exact: true }).click(); await saved(); assert.deepEqual(calls.slice(timeoutStart), ['GET', 'PUT']);
    checks.push('write failure, lost response and timeout preserve position and retry reads first');
    await jump(3809); await saved(); assert.equal(await dialog.getByRole('button', { name: '다음', exact: true }).isDisabled(), true);
    const lastImageCount = imageRequests.length; await page.waitForTimeout(80); assert.equal(imageRequests.length, lastImageCount);
    await dialog.getByRole('button', { name: /카드 번호/ }).click();
    for (const bad of ['0', '3810', '1.5', '1e2', '-2', '']) {
      await dialog.getByLabel(/카드 번호 \(1/).fill(bad); await dialog.getByRole('button', { name: '이동', exact: true }).click();
      await dialog.getByRole('alert').waitFor(); await number(3809).waitFor();
    }
    await dialog.getByLabel(/카드 번호 \(1/).fill('1'); await dialog.getByRole('button', { name: '이동', exact: true }).click(); await saved();
    blockImage = true; await jump(30); await dialog.getByText(/이미지를 불러오지 못했어요/).waitFor();
    await dialog.getByRole('button', { name: '다음', exact: true }).click(); await number(31).waitFor(); await saved(); blockImage = false;
    checks.push('first/last boundaries, strict integer jump and navigation through failed images');
    await jump(8); await saved(); await page.addScriptTag({ path: axePath });
    const navigationFailures = [];
    const nextButton = dialog.getByRole('button', { name: '다음', exact: true });
    await nextButton.focus(); await page.keyboard.press('Enter'); await number(9).waitFor(); await saved();
    const announcement = await dialog.locator('[aria-live="polite"][aria-atomic="true"]').allTextContents();
    if (!announcement.includes('카드 9 / 3809')) navigationFailures.push('keyboard Next must update the live card-position announcement');
    assert.equal(await nextButton.evaluate(el => document.activeElement === el), true, 'Next retains keyboard focus');
    await jump(8); await saved();
    await page.keyboard.press('Tab'); // Establish keyboard modality after the pointer-driven jump helper.
    for (const width of [320, 390, 1440]) for (const size of [100, 200]) {
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(size => document.documentElement.style.fontSize = `${size}%`, size);
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth), false);
      const bounds = await dialog.locator('.image-practice-navigation').evaluate(nav => [...nav.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right, bottom: r.bottom }; }));
      assert.ok(bounds.every(r => r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= width && r.bottom <= 844));
      for (const button of await dialog.locator('.image-practice-navigation button').all()) {
        await button.focus();
        const ring = await button.evaluate(el => {
          const r = el.getBoundingClientRect(), c = el.closest('.image-practice-controls').getBoundingClientRect(), s = getComputedStyle(el);
          const extent = Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset));
          return { label: el.textContent, visible: el.matches(':focus-visible'), extent,
            inside: r.left - extent >= c.left - .5 && r.right + extent <= c.right + .5 && r.top - extent >= c.top - .5 && r.bottom + extent <= c.bottom + .5 };
        });
        if (!ring.visible || !ring.extent || !ring.inside) navigationFailures.push({ width, size, ...ring });
      }
      assert.deepEqual(await page.evaluate(async () => (await axe.run(document.querySelector('[role="dialog"]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => v.id)), []);
      await page.screenshot({ path: `${out}/navigation-${width}-${size}.png` });
    }
    assert.deepEqual(navigationFailures, [], 'card announcements and complete keyboard focus rings');
    await page.evaluate(() => document.documentElement.style.fontSize = '100%'); await page.setViewportSize({ width: 390, height: 844 });
    await dialog.getByRole('button', { name: /카드 번호/ }).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
    assert.equal(await dialog.getByRole('button', { name: '다음', exact: true }).evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByLabel(/카드 번호 \(1/).evaluate(el => document.activeElement === el), true, 'keyboard entry reaches the actual number input');
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('9'); await page.keyboard.press('Enter'); await number(9).waitFor();
    assert.equal(await number(9).evaluate(el => document.activeElement === el), true, 'keyboard jump preserves navigation focus');
    await saved(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('.image-practice-entry'));
    checks.push('320/390/1440, 100/200% text, 44px targets, keyboard, focus return and axe');
    // Fresh context has no cache: failed first read offers retry, never writes first card.
    const isolated = await browser.newContext({ extraHTTPHeaders: identity }); await routes(isolated);
    let readsFail = true, isolatedWrites = 0;
    await isolated.route('**/api/image-practice/position', async route => {
      if (route.request().method() === 'PUT') isolatedWrites++;
      return readsFail ? route.fulfill({ status: 503, json: {} }) : route.continue();
    });
    const fresh = await isolated.newPage(); await ready(fresh); await fresh.getByRole('button', { name: '이미지 연습', exact: true }).click();
    await fresh.getByRole('button', { name: '다시 불러오기', exact: true }).waitFor(); assert.equal(await fresh.getByRole('dialog').locator('img').count(), 0); assert.equal(isolatedWrites, 0);
    readsFail = false; await fresh.getByRole('button', { name: '다시 불러오기', exact: true }).click(); await fresh.getByRole('dialog').getByRole('button', { name: /카드 번호/ }).waitFor();
    assert.equal(isolatedWrites, 0); checks.push('unknown initial server position cannot be overwritten after load failure');
    // Server position stays untouched when selected meanings exclude the saved card.
    const cursorBeforeFallback = await writePosition(ids[1], (await getPosition()).revision);
    const filtered = await browser.newContext({ extraHTTPHeaders: identity }); await routes(filtered);
    let fallbackKind = 'excluded';
    await filtered.route('**/api/state', route => {
      const fixture = structuredClone(before);
      if (fallbackKind === 'empty') for (const id of ids) fixture.state.progress[id] = { meaning: '다른 뜻' };
      else fixture.state.progress[ids[1]] = { meaning: '다른 뜻' };
      return route.fulfill({ json: fixture });
    });
    const fallbackPage = await filtered.newPage(); await ready(fallbackPage); await open(fallbackPage);
    await fallbackPage.getByText(/저장한 카드는 현재 연습에서 제외/).waitFor();
    assert.equal(await fallbackPage.locator('.image-practice-picture').getAttribute('src'), urls[2]);
    assert.deepEqual(await getPosition(), cursorBeforeFallback);
    await fallbackPage.evaluate(({ owner, entryId, revision }) => localStorage.setItem(`haru-image-position-v1:${encodeURIComponent(owner)}`,
      JSON.stringify({ version: 1, entryId, revision, pending: true, sent: null })),
    { owner: identity['oai-authenticated-user-id'], entryId: ids[1], revision: cursorBeforeFallback.revision - 1 });
    await ready(fallbackPage); await open(fallbackPage);
    await fallbackPage.getByRole('button', { name: '현재 위치 저장', exact: true }).waitFor();
    assert.equal(await fallbackPage.locator('.image-practice-picture').getAttribute('src'), urls[2]);
    await fallbackPage.getByRole('button', { name: '현재 위치 저장', exact: true }).click(); await saved(fallbackPage);
    const cursorAfterFallbackChoice = await getPosition(); assert.equal(cursorAfterFallbackChoice.entryId, ids[2]);
    checks.push('explicit current choice saves the displayed fallback card after conflict');
    fallbackKind = 'empty'; await fallbackPage.reload(); await fallbackPage.getByText('서버에 저장됨', { exact: true }).waitFor();
    await fallbackPage.getByRole('button', { name: '이미지 연습', exact: true }).click(); await fallbackPage.getByText('현재 선택한 뜻으로 연습할 이미지가 없어요.', { exact: true }).waitFor();
    assert.equal(await fallbackPage.getByRole('dialog').locator('img').count(), 0); assert.deepEqual(await getPosition(), cursorAfterFallbackChoice);
    checks.push('excluded saved card advances in original order; empty deck and lookup never overwrite server cursor');
    const after = await getState(); assert.deepEqual(after, before); assert.deepEqual(makeBackup(after.state, new Date('2026-10-17T00:00:00Z')), backupBefore);
    const cursor = await getPosition(); await writePosition(cursor.entryId, cursor.revision);
    // A stale page after sign-in changes must not send its old cursor as the new user.
    const otherIdentity = accountHeaders('image_other');
    const signedInAgain = await browser.newContext({ extraHTTPHeaders: otherIdentity }); await routes(signedInAgain);
    const newAccountPage = await signedInAgain.newPage(); await ready(newAccountPage); await open(newAccountPage); await number(1, newAccountPage).waitFor();
    const switched = await browser.newContext({ extraHTTPHeaders: identity }); await routes(switched);
    const switchedPage = await switched.newPage(); await ready(switchedPage); await open(switchedPage);
    await switched.setExtraHTTPHeaders(otherIdentity);
    await switchedPage.getByRole('dialog').getByRole('button', { name: '다음', exact: true }).click();
    await switchedPage.getByText('로그인을 확인한 뒤 다시 열어 주세요.', { exact: true }).waitFor();
    assert.equal(await switchedPage.getByRole('dialog').getByRole('button', { name: '다음', exact: true }).isDisabled(), true);
    // End network probes here. The baseline Worker also stalls a reused
    // connection after an unread PUT body is rejected with 401 in local Wrangler.
    // No-DB-write on rejection is independently covered by the real SQLite API test.
    checks.push('new account starts at its own position; stale owner receives 401 and stops navigation/writes');
    assert.deepEqual(forbidden, []); assert.deepEqual(errors, []); assert.equal(maxActive, 1);
    const report = { passed: true, engine, checks, maxConcurrentPositionRequests: maxActive, unchangedLearningStateRevisionAndBackup: true, actualIphoneChecked: false };
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (error) {
    if (page) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });

