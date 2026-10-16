// Built loopback Worker, synthetic records, and local static-response faults only.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { history } = require('./fixtures/backup-history.cjs');
const mode = process.argv[2] || 'all', engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['completed', 'obsolete', 'all'].includes(mode));
const out = path.resolve(process.env.QA_FIX_OUTPUT || `outputs/pr38-lazy-recovery/${engine}/${mode}`);
const dist = process.env.QA_FIX_DIST || 'dist';
const chunks = fs.readdirSync(path.join(dist, 'client/_next/static/chunks'));
const completedChunk = chunks.find(name => /^completed-lesson-[\w-]+\.js$/.test(name));
const editorChunk = chunks.find(name => /^word-editor-[\w-]+\.js$/.test(name));
assert.ok(completedChunk && editorChunk);
const checks = [], errors = [], forbidden = [];
let page;
async function nextPaint(target) { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function setup(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('lazy_recovery') });
  const get = async () => { const response = await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '4' } }); assert.equal(response.status(), 200); return response.json(); };
  const initial = await get(), clock = await context.request.get(base + '/api/study-clock'); assert.equal(clock.status(), 200);
  const { serverTime } = await clock.json();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(serverTime));
  const state = { ...history(1, 3), grammar: {} }, session = Object.values(state.sessions)[0];
  Object.assign(session, { date, period: date, createdAt: new Date(serverTime).toISOString() });
  state.settings.activeSessionId = session.id;
  for (const record of Object.values(session.records)) record.learnedOn = date;
  for (const progress of Object.values(state.progress)) Object.assign(progress, { studyDates: [date], lastStudied: date });
  const restored = await context.request.post(base + '/api/state/restore', { headers: { 'X-Study-Revision': String(initial.revision), 'X-Study-Grammar': '4' }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
  assert.equal(restored.status(), 200);
  const before = await get();
  const target = await context.newPage(); target.setDefaultTimeout(30000); page = target;
  target.on('pageerror', error => { if (!/dynamically imported module|Importing a module script failed|module script|Failed to fetch/.test(error.message)) errors.push(error.name); });
  async function guard(route, extra) {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    if (!['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/api/') && /feedback|automation|evaluation/.test(url.pathname)) { forbidden.push('write_or_ai'); return route.abort(); }
    if (extra && await extra(route, request, url)) return;
    return route.continue();
  }
  const home = async () => { await target.goto(base, { waitUntil: 'domcontentloaded' }); await target.getByText('서버에 저장됨', { exact: true }).waitFor(); };
  const open = () => target.getByRole('button', { name: '오늘 단어 다시 보기', exact: true }).click();
  const unchanged = async () => assert.deepEqual(await get(), before);
  return { context, target, before, session, guard, home, open, unchanged };
}
async function layout(target, dialog, label) {
  await target.addScriptTag({ path: axePath });
  for (const width of [320, 390, 1440]) for (const size of [100, 200]) {
    await target.setViewportSize({ width, height: 844 });
    await target.evaluate(value => document.documentElement.style.fontSize = `${value}%`, size);
    assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth || document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await dialog.getByRole('button', { name: 'Close', exact: true }).isVisible(), true);
    const violations = await target.evaluate(async () => (await axe.run(document.querySelector('[role="dialog"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(row => ({ id: row.id, impact: row.impact })));
    assert.deepEqual(violations, []);
  }
  await target.setViewportSize({ width: 390, height: 844 }); await target.evaluate(() => document.documentElement.style.fontSize = '100%');
  await target.screenshot({ path: path.join(out, label + '.png'), fullPage: false });
}
async function completed(browser) {
  const fixture = await setup(browser), { context, target, guard, home, open, session, unchanged } = fixture;
  let held, hold = true;
  try {
    await context.route('**/*', route => guard(route, async (route, request, url) => {
      if (hold && path.posix.basename(url.pathname) === completedChunk) { held = route; return true; }
      return false;
    }));
    await home();
    const requested = target.waitForRequest(request => path.posix.basename(new URL(request.url()).pathname) === completedChunk);
    await open(); await requested; await nextPaint(target);
    const dialog = target.getByRole('dialog');
    assert.equal(await dialog.count(), 1, 'completed lesson must mount its modal before its content module arrives');
    await dialog.getByRole('heading', { name: '오늘 단어 다시 보기', exact: true }).waitFor();
    await dialog.getByRole('status').filter({ hasText: '완료 기록 자료를 불러오는 중이에요.' }).waitFor();
    await layout(target, dialog, 'completed-loading');
    await target.keyboard.press('Tab');
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'keyboard focus stays inside loading dialog');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await target.locator('[data-slot=dialog-overlay]').waitFor({ state: 'detached' });
    await target.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    hold = false; assert.ok(held);
    const response = target.waitForResponse(response => path.posix.basename(new URL(response.url()).pathname) === completedChunk);
    await held.continue(); await (await response).finished(); await nextPaint(target);
    assert.equal(await dialog.count(), 0, 'late content must not reopen the closed record on another tab');
    assert.equal(await target.getByRole('tab', { name: '전체 단어장', exact: true }).getAttribute('aria-selected'), 'true');
    await target.getByRole('tab', { name: '오늘의 학습', exact: true }).click(); await open();
    await dialog.locator('.review-meaning').waitFor();
    assert.equal(await dialog.locator('.review-meaning').innerText(), session.records[session.ids[0]].meaning);
    await layout(target, dialog, 'completed-loaded'); await unchanged();
    checks.push('completed loading modal/title/close/focus/layout is immediate; closed late content cannot reopen; original records preserved');
  } finally { await context.close(); }
  const failureFixture = await setup(browser);
  try {
    let fail = true;
    await failureFixture.context.route('**/*', route => failureFixture.guard(route, async (route, request, url) => {
      if (fail && path.posix.basename(url.pathname) === completedChunk) { fail = false; await route.fulfill({ status: 503, body: 'Synthetic content failure' }); return true; }
      return false;
    }));
    await failureFixture.home(); await failureFixture.open();
    const dialog = failureFixture.target.getByRole('dialog');
    await dialog.getByRole('alert').filter({ hasText: '완료 기록 자료를 불러오지 못했어요.' }).waitFor();
    await layout(failureFixture.target, dialog, 'completed-error');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await failureFixture.target.locator('[data-slot=dialog-overlay]').waitFor({ state: 'detached' });
    await failureFixture.open(); await dialog.getByRole('alert').waitFor();
    await Promise.all([failureFixture.target.waitForEvent('load'), dialog.getByRole('button', { name: '다시 불러오기', exact: true }).click()]);
    await failureFixture.target.getByText('서버에 저장됨', { exact: true }).waitFor();
    await failureFixture.open(); await failureFixture.target.getByRole('dialog').locator('.review-meaning').waitFor();
    await failureFixture.unchanged(); checks.push('completed failure keeps modal/title/close and explicit retry restores the original record');
  } finally { await failureFixture.context.close(); }
}
async function obsolete(browser, status) {
  const { context, target, guard, home, unchanged } = await setup(browser);
  const obsoleteChunk = 'word-editor-obsolete-fixture.js'; let navigations = 0, rewrites = 0, recoveryMisses = 0;
  try {
    await context.route('**/*', route => guard(route, async (route, request, url) => {
      if (request.isNavigationRequest()) navigations++;
      if (path.posix.basename(url.pathname) === obsoleteChunk) {
        if (request.resourceType() === 'fetch') recoveryMisses++;
        await route.fulfill({ status, contentType: 'text/plain', headers: { 'cache-control': 'no-store' }, body: 'Synthetic obsolete asset' }); return true;
      }
      // A local fixture represents the old document referring to a removed hash.
      // Recovery fetches and the next document always receive the real new files.
      if (navigations === 1 && request.resourceType() === 'script' && url.pathname.endsWith('.js')) {
        const response = await route.fetch(), body = await response.text();
        const replacement = body.replaceAll(editorChunk, obsoleteChunk); if (replacement !== body) rewrites++;
        const headers = { ...response.headers(), 'cache-control': 'no-store' }; delete headers['content-encoding']; delete headers['content-length'];
        await route.fulfill({ status: response.status(), headers, body: replacement }); return true;
      }
      return false;
    }));
    await home();
    async function editor() {
      await target.getByRole('tab', { name: '전체 단어장', exact: true }).click();
      await target.getByLabel('단어 또는 한국어 뜻 검색').fill('apple');
      await target.getByRole('button', { name: 'apple 명사', exact: true }).click();
    }
    await editor(); await target.getByRole('alert').filter({ hasText: '단어 편집 자료를 불러오지 못했어요.' }).waitFor();
    assert.ok(rewrites > 0, 'exercise the obsolete URL from an actual imported module');
    const origin = await target.evaluate(() => performance.timeOrigin);
    if (status === 503) {
      const retried = target.waitForResponse(response => path.posix.basename(new URL(response.url()).pathname) === obsoleteChunk && response.request().resourceType() === 'fetch');
      await target.getByRole('button', { name: '다시 불러오기', exact: true }).click(); await retried;
      await target.getByRole('button', { name: '다시 불러오기', exact: true }).waitFor();
      assert.equal(await target.evaluate(() => performance.timeOrigin), origin);
      assert.equal(navigations, 1); assert.equal(recoveryMisses, 1); await unchanged();
      checks.push('a continuing 503 keeps the error view and original records without reloading');
      return;
    }
    await target.evaluate(() => { window.__unloadGuard = event => { event.preventDefault(); event.returnValue = ''; }; addEventListener('beforeunload', window.__unloadGuard); });
    const cancelled = target.waitForEvent('dialog', { timeout: 10000 }).then(dialog => dialog.dismiss());
    await target.getByRole('button', { name: '다시 불러오기', exact: true }).click(); await cancelled;
    assert.equal(await target.evaluate(() => performance.timeOrigin), origin, 'native draft/unload cancellation must still prevent a reload');
    assert.ok(recoveryMisses > 0);
    await target.evaluate(() => removeEventListener('beforeunload', window.__unloadGuard));
    await Promise.all([target.waitForEvent('load'), target.getByRole('button', { name: '다시 불러오기', exact: true }).click()]);
    await target.getByText('서버에 저장됨', { exact: true }).waitFor(); assert.notEqual(await target.evaluate(() => performance.timeOrigin), origin);
    await editor(); await target.getByRole('dialog').getByLabel('함께 익힐 표현', { exact: true }).waitFor();
    assert.equal(navigations, 2); assert.ok(recoveryMisses >= 2); await unchanged();
    checks.push(`obsolete chunk ${status} permits a guarded fresh document; unload cancellation still works; new asset restores editor without saving`);
  } finally { await context.close(); }
}
(async () => {
  await waitForWorker(); fs.mkdirSync(out, { recursive: true }); const browser = await launchBrowser();
  try {
    if (mode !== 'obsolete') await completed(browser);
    if (mode !== 'completed') for (const status of [404, 410, 503]) await obsolete(browser, status);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ passed: true, checks, errors, forbidden, mode, engine, actualIphoneChecked: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, mode, engine }));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ checks, error: error.message, mode, engine }, null, 2));
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
