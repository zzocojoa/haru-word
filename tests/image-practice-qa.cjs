// Local synthetic learner only; all non-loopback requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker } = require('./qa/runtime.cjs');
const { emptyState } = require('./fixtures/backup-history.cjs');
const engine = process.env.QA_BROWSER || 'chromium', stage = process.argv[2] || 'all';
const out = 'outputs/word-image-pilot/' + engine;
const catalog = JSON.parse(fs.readFileSync('data/word-image-pilot.json'));
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
(async () => {
  await waitForWorker();
  const browser = await launchBrowser({ engine });
  fs.mkdirSync(out, { recursive: true });
  const checks = [], errors = [], imageRequests = [], moduleNameMatches = [], requests = { writes: 0, ai: 0, external: 0 };
  const heldImages = new Map();
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('image_pilot') });
    const ids = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
    let revision = 7, stored = { ...emptyState(), grammar: {} };
    stored.settings.assessments.A1 = { ids, index: 20, marks: Object.fromEntries(ids.map(id => [id, 'uncertain'])), completed: true };
    const id = catalog.entries[0].entryId;
    stored.progress[id] = { meaning: content[id].meaning, familiarity: 'known', en: 'independent', ko: 'help', sentenceStatus: 'written', sentence: 'This is a sample.', notes: '검사 전 기록', studyDates: [date], lastStudied: date, needsReview: true, familiarityCheck: { initial: 'known', answer: '검사 전 최초 풀이', meaning: content[id].meaning, final: 'known' } };
    if (stage === 'editor') stored.progress[id].senses = { '다른 뜻': { meaning: '다른 뜻', expression: 'another sample' } };
    const before = structuredClone({ state: stored, revision });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { requests.external++; return route.abort(); }
      if (url.pathname.startsWith('/oxford-image-pilot/')) imageRequests.push(url.pathname);
      if (stage === 'front' && url.pathname.startsWith('/oxford-image-pilot/')) return;
      if (stage === 'error' && url.pathname.startsWith('/oxford-image-pilot/')) { heldImages.set(url.pathname, route); return; }
      if (/feedback|automation|ai-eval|sentence-structure/.test(url.pathname)) {
        if (url.pathname.startsWith('/api/')) { requests.ai++; return route.abort(); }
        moduleNameMatches.push(url.pathname);
      }
      if (url.pathname === '/api/state') {
        if (request.method() === 'GET') return route.fulfill({ json: { state: stored, revision } });
        requests.writes++;
        return route.fulfill({ status: 503, json: { error: 'Unexpected practice write' } });
      }
      return route.continue();
    });
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '이미지 연습', exact: true }).count(), 1);
    checks.push('today overview has one independent image-practice entry');
    if (stage === 'editor') {
      await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('apple');
      await page.getByRole('button', { name: 'apple 명사', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.equal(await dialog.locator('img').count(), 1, 'matching editor meaning has one preview');
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[0].url);
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] img')].every(image => image.complete && image.naturalWidth > 0));
      await page.screenshot({ path: out + '/editor.png', fullPage: true });
      await dialog.getByLabel('학습할 뜻 선택', { exact: true }).selectOption('다른 뜻');
      assert.equal(await dialog.locator('img').count(), 0, 'changed meaning hides preview immediately');
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('changed sample');
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: '계속 편집', exact: true }).click();
      assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'changed sample');
      await dialog.getByLabel('학습할 뜻 선택', { exact: true }).selectOption('사과');
      assert.equal(await dialog.locator('img').count(), 1);
      await dialog.getByRole('button', { name: '다른 뜻 추가', exact: false }).click();
      assert.equal(await dialog.locator('img').count(), 0, 'empty new sense has no preview');
      await dialog.getByLabel('오늘의 뜻', { exact: true }).fill('새로운 뜻');
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: '변경 버리고 닫기', exact: true }).click();
      checks.push('editor shows matching preview, hides changed/new meanings and preserves dismissal protection');
    }
    if (stage === 'error') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('img').waitFor();
      await dialog.locator('img').evaluate(image => { window.qaOldImage = image; });
      for (let i = 0; i < 100 && !heldImages.has(catalog.entries[0].url); i++) await page.waitForTimeout(50);
      await heldImages.get(catalog.entries[0].url).fulfill({ status: 503, body: 'Unavailable' });
      await page.waitForTimeout(300);
      assert.equal(await dialog.getByRole('button', { name: '건너뛰기', exact: true }).count(), 1, 'failed image can be skipped without an answer');
      assert.equal(await dialog.locator('[lang="en"]').count(), 0);
      await dialog.getByRole('button', { name: '건너뛰기', exact: true }).click();
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[1].url);
      await page.evaluate(() => { window.qaOldImage.dispatchEvent(new Event('load')); delete window.qaOldImage; });
      assert.equal(await dialog.getByRole('button', { name: '단어 확인', exact: true }).isDisabled(), true, 'old image event cannot enable a new card');
      await heldImages.get(catalog.entries[1].url).fulfill({ contentType: 'image/png', body: fs.readFileSync('public' + catalog.entries[1].url) });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '단어 확인' && !b.disabled));
      await dialog.getByRole('button', { name: '연습 닫기', exact: true }).click();
      checks.push('503 skip hides answer; late detached load cannot change next loading state; current response enables reveal');
    }
    if (stage === 'network') {
      assert.equal(imageRequests.length, 0, 'no image requests before practice');
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      await page.waitForTimeout(500);
      assert.deepEqual([...new Set(imageRequests)], catalog.entries.slice(0, 2).map(e => e.url), 'only current and next image are requested');
      checks.push('only current image and one next image are fetched');
    }
    if (stage === 'front') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      await page.waitForTimeout(400);
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.count(), 1, 'practice opens one dialog');
      assert.equal(await dialog.getByRole('button', { name: '단어 확인', exact: true }).isDisabled(), true);
      const markup = await dialog.innerHTML();
      assert.equal(/apple|사과|n\.|A1/.test(markup), false, 'front DOM has no answer or word metadata');
      assert.equal(await dialog.locator('img').count(), 1);
      await dialog.getByRole('button', { name: '연습 닫기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      checks.push('slow image blocks reveal, front hides answers, close remains available');
    }
    if (stage === 'back') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      const dialog = page.getByRole('dialog');
      const reveal = dialog.getByRole('button', { name: '단어 확인', exact: true });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '단어 확인' && !b.disabled));
      assert.equal(/apple|사과/.test(await dialog.innerHTML()), false);
      await page.screenshot({ path: out + '/front.png', fullPage: true });
      await reveal.click();
      assert.equal(await dialog.locator('[lang="en"]').filter({ hasText: /^apple$/ }).count(), 1, 'reveal shows the correct English word');
      assert.equal(await dialog.locator('details[open]').count(), 0);
      assert.equal(await dialog.getByText('사과', { exact: true }).isVisible(), false);
      await page.screenshot({ path: out + '/back.png', fullPage: true });
      checks.push('reveal shows English; meaning/pronunciation help starts collapsed');
    }
    if (stage === 'lifecycle') {
      const entry = page.getByRole('button', { name: '이미지 연습', exact: true });
      await entry.click();
      const dialog = page.getByRole('dialog');
      for (let i = 0; i < catalog.entries.length; i++) {
        const expected = words.find(w => w.id === catalog.entries[i].entryId).word;
        assert.equal(await dialog.locator('[lang="en"]').count(), 0, 'new card has no English answer');
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '단어 확인' && !b.disabled));
        await dialog.getByRole('button', { name: '단어 확인', exact: true }).click();
        assert.equal(await dialog.locator('.image-practice-answer').innerText(), expected);
        assert.equal(await dialog.locator('details[open]').count(), 0);
        if (i < 19) {
          assert.equal(await dialog.getByRole('button', { name: '다음', exact: true }).count(), 1, 'revealed card has a next button');
          await dialog.getByRole('button', { name: '다음', exact: true }).click();
        }
      }
      await dialog.getByRole('button', { name: '처음부터', exact: true }).click();
      assert.equal(await dialog.locator('[lang="en"]').count(), 0);
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[0].url);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await entry.evaluate(e => e === document.activeElement), true);
      await entry.click();
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[0].url);
      await page.waitForTimeout(220);
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]'), bounds = dialog.getBoundingClientRect();
        const x = 5, y = bounds.top + 90, target = document.elementFromPoint(x, y);
        for (const [type, dx] of [['touchstart', 0], ['touchmove', 180], ['touchend', 180]]) {
          const event = new Event(type, { bubbles: true, cancelable: true });
          const point = { identifier: 1, clientX: x + dx, clientY: y };
          Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
          target.dispatchEvent(event);
        }
      });
      await dialog.waitFor({ state: 'hidden' });
      await entry.click();
      await page.reload();
      await page.getByText('서버에 저장됨', { exact: true }).waitFor();
      assert.equal(await dialog.count(), 0, 'refresh does not restore practice');
      checks.push('20 cards reveal correct words and reset; restart, Escape, app Back gesture, refresh, focus return');
    }
    assert.deepEqual({ state: stored, revision }, before);
    assert.equal(requests.writes, 0); assert.equal(requests.ai, 0);
    const report = { passed: true, stage, engine, checks, requests, imageRequests, errors, sourceImages: 20, stateUnchanged: true, actualIphoneChecked: false };
    fs.writeFileSync(out + '/' + stage + '-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: out + '/' + stage + '-failure.png', fullPage: true });
      const body = await page.locator('body').innerText();
      fs.writeFileSync(out + '/' + stage + '-failure.json', JSON.stringify({ stage, requests, moduleNameMatches, errors, body }, null, 2));
      console.error(JSON.stringify({ setupDiagnostic: body.slice(0, 1800), requests, moduleNameMatches, errors }));
    }
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
