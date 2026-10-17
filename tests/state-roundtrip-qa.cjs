const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launchBrowser, closeBrowser, accountHeaders, waitForWorker, base, axePath } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/state-roundtrip/${engine}`;
fs.mkdirSync(out, { recursive: true });
const headers = { 'X-Study-Grammar': '2', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1' };
const get = async c => (await c.request.get(base + '/api/state', { headers })).json();
const saved = page => page.getByText('서버에 저장됨', { exact: true }).waitFor();
const work = JSON.parse(fs.readFileSync('data/words.json')).find(w => w.word === 'work' && w.pos === 'v.');
async function openWork(page) {
  await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
  await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
  await page.getByRole('button', { name: 'work 동사', exact: true }).click();
}
(async () => {
  await waitForWorker(); const browser = await launchBrowser({ engine }), errors = [], checks = [];
  let diagnosticPage, stage = 'initial load', fontStylesheets = 0;
  const unexpectedFontFiles = [];
  async function contextFor(prefix) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders(prefix) });
    // Font subsets arriving between pointerdown/up can move the searched row
    // and lose the click in WebKit. Persistence QA uses stable system fonts;
    // font loading/failure behavior is covered by startup-render-qa.cjs.
    await context.route('https://fonts.googleapis.com/**', route => {
      fontStylesheets++;
      return route.fulfill({ contentType: 'text/css', body: '' });
    });
    await context.route('https://fonts.gstatic.com/**', route => {
      unexpectedFontFiles.push(new URL(route.request().url()).pathname);
      return route.abort();
    });
    return context;
  }
  try {
    const c = await contextFor('literal_senses');
    const page = await c.newPage(); diagnosticPage = page; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await saved(page);
    for (const meaning of ['constructor', 'prototype', '__proto__']) {
      stage = `edit ${meaning}`;
      await openWork(page); const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: '다른 뜻 추가', exact: true }).click();
      await dialog.getByLabel('오늘의 뜻', { exact: true }).fill(meaning);
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill(`literal ${meaning}`);
      await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); await saved(page);
      await page.reload(); await saved(page);
      const p = (await get(c)).state.progress[work.id]; assert.ok(Object.hasOwn(p.senses, meaning)); assert.equal(p.senses[meaning].expression, `literal ${meaning}`);
    }
    stage = 'backup export';
    await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    await page.getByRole('button', { name: '기록 관리', exact: true }).click();
    await page.getByRole('menuitem', { name: '전체 백업', exact: true }).click();
    await page.getByText('현재 앱에서 복원 가능한 백업이에요.', { exact: true }).waitFor();
    const event = page.waitForEvent('download'); await page.getByRole('button', { name: '백업 파일 다운로드', exact: true }).click();
    await (await event).saveAs(`${out}/literal-senses.json`);
    const raw = fs.readFileSync(`${out}/literal-senses.json`, 'utf8'), original = (await get(c)).state;
    assert.deepEqual(JSON.parse(raw).state, original); await c.close();
    stage = 'restore and switch senses';
    const restored = await contextFor('literal_restored');
    const initial = await get(restored);
    const oldHeaders = { ...headers, 'Content-Type': 'application/json', 'X-Study-Revision': String(initial.revision) }; delete oldHeaders['X-Study-Sense-Keys'];
    const oldRestore = await restored.request.post(base + '/api/state/restore', { headers: oldHeaders, data: raw });
    assert.equal(oldRestore.status(), 426); assert.deepEqual(await get(restored), initial);
    const response = await restored.request.post(base + '/api/state/restore', { headers: { ...headers, 'Content-Type': 'application/json', 'X-Study-Revision': String(initial.revision) }, data: raw });
    assert.equal(response.status(), 200, await response.text()); assert.deepEqual((await get(restored)).state, original);
    const rp = await restored.newPage(); diagnosticPage = rp; rp.on('pageerror', e => errors.push(e.message));
    await rp.goto(base); await saved(rp); await openWork(rp);
    for (const meaning of ['constructor', 'prototype', '__proto__']) {
      await rp.getByRole('dialog').getByLabel('학습할 뜻 선택').selectOption(meaning);
      assert.equal(await rp.getByRole('dialog').getByLabel('함께 익힐 표현', { exact: true }).inputValue(), `literal ${meaning}`);
    }
    await restored.close(); checks.push('literal reserved senses: UI editing, saving, reload, validated export, actual restore and sense switching');

    stage = 'account capacity';
    const limit = await contextFor('account_limit');
    let snapshot = await get(limit);
    for (let offset = 0; offset < 5000; offset += 1000) {
      const progress = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => {
        const id = 'personal_' + crypto.randomUUID(), word = 'sample' + (offset + i);
        return [id, { meaning: '합성 단어', personal: { id, word, headword: word, pos: 'n.', level: 'A1', page: 0, personal: true } }];
      }));
      const result = await limit.request.put(base + '/api/state', { headers, data: { revision: snapshot.revision, progress, sessions: {} } });
      assert.equal(result.status(), 200, await result.text()); snapshot.revision = (await result.json()).revision;
    }
    const before = await get(limit), lp = await limit.newPage(); diagnosticPage = lp; lp.on('pageerror', e => errors.push(e.message));
    await lp.goto(base); await saved(lp); await lp.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await lp.getByRole('button', { name: '개인 단어 추가', exact: true }).click();
    const dialog = lp.getByRole('dialog');
    await dialog.getByLabel('영어 단어', { exact: true }).fill('one-more-word');
    await dialog.getByLabel('오늘의 한국어 뜻', { exact: true }).fill('보관할 초안');
    const request = lp.waitForResponse(r => r.url().endsWith('/api/state') && r.request().method() === 'PUT');
    await dialog.getByRole('button', { name: '내 단어장에 추가', exact: true }).click();
    assert.equal((await request).status(), 413);
    await dialog.getByRole('alert').filter({ hasText: '5,000개' }).waitFor();
    assert.equal(await dialog.getByLabel('영어 단어', { exact: true }).inputValue(), 'one-more-word');
    assert.equal(await dialog.getByLabel('오늘의 한국어 뜻', { exact: true }).inputValue(), '보관할 초안');
    assert.deepEqual(await get(limit), before);
    for (const width of [320, 390, 1440]) {
      await lp.setViewportSize({ width, height: 844 });
      await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
      assert.equal(await lp.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await dialog.locator('.dialog-scroll').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await lp.screenshot({ path: `${out}/capacity-${width}.png` });
    }
    await lp.addScriptTag({ path: axePath });
    const violations = await lp.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) })));
    assert.deepEqual(violations, []); await limit.close();
    checks.push('5001st entry rejected by real server; modal explains the limit and retains input; original account/revision unchanged; 320/390/1440px and axe');
    assert.ok(fontStylesheets > 0, 'the optional font stylesheet must be intercepted');
    assert.deepEqual(unexpectedFontFiles, [], 'roundtrip QA must not depend on external font subsets');
    checks.push('all three contexts and reloads use local empty font CSS; no external font files');
    assert.deepEqual(errors, []); const result = { passed: true, engine, checks, errors, fontStylesheets, unexpectedFontFiles };
    fs.writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } catch (error) {
    if (diagnosticPage && !diagnosticPage.isClosed()) {
      await diagnosticPage.screenshot({ path: `${out}/failure.png` });
      fs.writeFileSync(`${out}/failure.json`, JSON.stringify({ stage, errors, fontStylesheets, unexpectedFontFiles,
        fontStatus: await diagnosticPage.evaluate(() => document.fonts.status), dialogCount: await diagnosticPage.getByRole('dialog').count(),
        editorCount: await diagnosticPage.getByRole('button', { name: '다른 뜻 추가', exact: true }).count() }, null, 2));
    }
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
