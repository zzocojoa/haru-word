// Local synthetic learner only; all non-loopback requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { emptyState } = require('./fixtures/backup-history.cjs');
const engine = process.env.QA_BROWSER || 'chromium', stage = process.argv[2] || (['development', 'enabled'].includes(process.env.QA_IMAGE_PILOT_MODE) ? 'all' : 'production');
const stages = ['front', 'back', 'lifecycle', 'network', 'error', 'editor', 'eligible', 'empty', 'matrix', 'full', 'extended'];
if (stage === 'all') {
  const { spawnSync } = require('node:child_process');
  for (const part of stages) {
    const result = spawnSync(process.execPath, [__filename, part], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  process.exit(0);
}
if (![...stages, 'entry', 'production', 'isolation'].includes(stage)) throw Error('Unknown image-practice QA stage');
const out = 'outputs/word-image-full/' + engine;
const pilot = JSON.parse(fs.readFileSync('data/word-image-pilot-web.json'));
const web = JSON.parse(fs.readFileSync('data/word-image-web-manifest.json'));
const ui = JSON.parse(fs.readFileSync('data/word-image-ui.json'));
const byId = new Map(web.entries.map(e => [e.entryId, e]));
const allEntries = ui.entries.map(([id]) => ({ ...byId.get(id), url: '/word-images/v1/' + byId.get(id).sha256 + '.webp' }));
const pilotIds = new Set(pilot.entries.map(e => e.entryId));
const sampleIds = new Set(['A1', 'A2', 'B1', 'B2'].flatMap(level => allEntries.filter(e => e.level === level && !pilotIds.has(e.entryId)).slice(0, 3).map(e => e.entryId)));
for (const e of allEntries) if (['close', 'lead', 'read', 'print', 'truth'].includes(e.word)) sampleIds.add(e.entryId);
const catalog = { entries: allEntries.filter(e => stage === 'extended' ? sampleIds.has(e.entryId) : pilotIds.has(e.entryId)) };
function imageBytes(entry) {
  const name = require('node:path').join(process.env.QA_WORD_IMAGE_ASSET_ROOT || 'public/word-images-pilot', entry.sha256 + '.webp');
  return fs.readFileSync(name);
}
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const ipa = JSON.parse(fs.readFileSync('data/american-ipa-ui.json')).entries;
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function checkLayouts(page, dialog, label) {
  await page.addScriptTag({ path: axePath });
  for (const width of [320, 390, 865, 1440]) for (const size of [100, 200]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(size => document.documentElement.style.fontSize = `${size}%`, size);
    const preview = dialog.locator('.dialog-word .word-image-preview');
    if (await preview.count()) {
      const bounds = await preview.evaluate(image => {
        const picture = image.getBoundingClientRect(), heading = image.closest('.dialog-word').getBoundingClientRect();
        const sheet = image.closest('[role="dialog"]').getBoundingClientRect();
        return { left: picture.left, right: picture.right, top: picture.top, bottom: picture.bottom,
          headingLeft: heading.left, headingRight: heading.right, headingTop: heading.top, headingBottom: heading.bottom,
          sheetLeft: sheet.left, sheetRight: sheet.right, viewportWidth: innerWidth, width: picture.width, height: picture.height };
      });
      assert.ok(bounds.width > 0 && bounds.height > 0 && bounds.left >= Math.max(0, bounds.sheetLeft) - 1
        && bounds.right <= Math.min(bounds.viewportWidth, bounds.sheetRight) + 1
        && bounds.top >= bounds.headingTop - 1 && bounds.bottom <= bounds.headingBottom + 1,
      `${label} preview stays inside dialog at ${width}px/${size}%: ${JSON.stringify(bounds)}`);
    }
    assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth), false, label + ' overflow');
    if (await dialog.locator('.editor-fields').count()) {
      const field = dialog.getByLabel('함께 익힐 표현', { exact: true });
      await field.scrollIntoViewIfNeeded();
      assert.equal(await field.evaluate(el => {
        const rect = el.getBoundingClientRect(), body = el.closest('.dialog-scroll').getBoundingClientRect();
        return rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1;
      }), true, `${label} editor input remains readable at ${width}/${size}`);
    }
    const audit = await page.evaluate(async () => (await axe.run(document.querySelector('[role="dialog"]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations);
    assert.deepEqual(audit.map(v => v.id), [], label + ' axe');
    // At 200% the card body scrolls: prove every condition can be brought fully into view.
    for (const variant of await dialog.locator('.word-ipa .pronunciation-variants > span').all()) {
      await variant.scrollIntoViewIfNeeded();
      assert.equal(await variant.evaluate(el => {
        const bounds = el.getBoundingClientRect(), body = el.closest('.dialog-scroll').getBoundingClientRect();
        return bounds.top >= body.top - 1 && bounds.bottom <= body.bottom + 1 && bounds.left >= body.left - 1 && bounds.right <= body.right + 1;
      }), true, `${label} each IPA condition is readable at ${width}/${size}`);
    }
    await page.screenshot({ path: out + `/${label}-${width}-${size}.png`, fullPage: false });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '100%');
  await page.setViewportSize({ width: 390, height: 844 });
}
(async () => {
  await waitForWorker();
  const browser = await launchBrowser({ engine });
  fs.mkdirSync(out, { recursive: true });
  const checks = [], errors = [], imageRequests = [], moduleNameMatches = [], requests = { writes: 0, positionWrites: 0, ai: 0, external: 0 };
  const heldImages = new Map();
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: stage === 'back', reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('image_pilot') });
    const ids = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
    let revision = 7, stored = { ...emptyState(), grammar: {} };
    stored.settings.assessments.A1 = { ids, index: 20, marks: Object.fromEntries(ids.map(id => [id, 'uncertain'])), completed: true };
    const id = catalog.entries[0].entryId;
    // A synthetic selected-meaning fixture keeps the original lifecycle matrix
    // small. The separate full stage proves that all 3809 are eligible by default.
    if (stage !== 'full') {
      const eligibleIds = new Set(catalog.entries.map(e => e.entryId));
      if (stage === 'editor') eligibleIds.add(allEntries.find(e => e.word === 'recommendation' && e.pos === 'n.').entryId);
      for (const entry of allEntries) if (!eligibleIds.has(entry.entryId)) stored.progress[entry.entryId] = { meaning: '별도 사용자 뜻' };
    }
    stored.progress[id] = { meaning: content[id].meaning, familiarity: 'known', en: 'independent', ko: 'help', sentenceStatus: 'written', sentence: 'This is a sample.', notes: '검사 전 기록', studyDates: [date], lastStudied: date, needsReview: true, familiarityCheck: { initial: 'known', answer: '검사 전 최초 풀이', meaning: content[id].meaning, final: 'known' } };
    if (stage === 'editor') stored.progress[id].senses = { '다른 뜻': { meaning: '다른 뜻', expression: 'another sample' } };
    if (stage === 'eligible') stored.progress[id].meaning = '시범과 다른 뜻';
    if (stage === 'empty') for (const entry of catalog.entries) stored.progress[entry.entryId] = { meaning: '시범과 다른 뜻' };
    const persisted = stage === 'isolation';
    const api = async () => {
      const response = await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '4' } });
      assert.equal(response.status(), 200, 'local state GET');
      return response.json();
    };
    if (persisted) {
      await context.request.get(base + '/signin-with-chatgpt?return_to=/');
      const sessionId = require('node:crypto').randomUUID();
      stored.sessions[sessionId] = { id: sessionId, kind: 'daily', date, period: date, ids: [id], warmupIds: [], stage: 'done', index: 0,
        records: { [id]: { entryId: id, meaning: content[id].meaning, material: content[id], familiarity: 'known', en: 'independent', ko: 'help',
          enAnswer: 'fruit', koAnswer: 'apple', sentenceStatus: 'written', sentence: 'This is a sample.', notes: '', learnedOn: date } },
        retry: [], retryMode: false, elapsed: 913, finished: true, paused: true, createdAt: date + 'T12:00:00.000Z' };
      const initial = await api();
      const response = await context.request.put(base + '/api/state', { headers: { 'X-Study-Grammar': '4' }, data: { ...stored, revision: initial.revision } });
      assert.equal(response.status(), 200, 'synthetic local state setup');
      const saved = await api(); stored = saved.state; revision = saved.revision;
    }
    const before = structuredClone({ state: stored, revision });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { requests.external++; return route.abort(); }
      if (url.pathname === '/api/image-practice/position' && request.method() === 'PUT') requests.positionWrites++;
      if (url.pathname.startsWith('/word-images/v1/')) {
        imageRequests.push(url.pathname);
        if (stage === 'front') return;
        if (stage === 'error') { heldImages.set(url.pathname, route); return; }
        const image = allEntries.find(e => e.url === url.pathname);
        assert.ok(image, 'only reviewed image URLs are requested');
        return route.fulfill({ contentType: 'image/webp', body: imageBytes(image) });
      }
      if (/feedback|automation|ai-eval|sentence-structure/.test(url.pathname)) {
        if (url.pathname.startsWith('/api/')) { requests.ai++; return route.abort(); }
        moduleNameMatches.push(url.pathname);
      }
      if (url.pathname === '/api/state') {
        if (request.method() === 'GET') return persisted ? route.continue() : route.fulfill({ json: { state: stored, revision } });
        requests.writes++;
        return route.fulfill({ status: 503, json: { error: 'Unexpected practice write' } });
      }
      return route.continue();
    });
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('저장됨', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '이미지 연습', exact: true }).count(), stage === 'production' ? 0 : 1);
    checks.push(stage === 'production' ? 'production has no practice entry' : 'today overview has one independent image-practice entry');
    if (stage === 'production') {
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('apple');
      await page.getByRole('button', { name: 'apple 명사', exact: true }).click();
      await page.getByRole('dialog').getByLabel('함께 익힐 표현', { exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog').locator('img').count(), 0);
      assert.equal(imageRequests.length, 0);
      checks.push('production editor has no image preview or image request');
    }
    if (stage === 'eligible' || stage === 'empty') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      const dialog = page.getByRole('dialog');
      if (stage === 'empty') {
        await dialog.getByText('현재 선택한 뜻으로 연습할 이미지가 없어요.', { exact: true }).waitFor();
        assert.equal(await dialog.locator('img').count(), 0);
        assert.equal(imageRequests.length, 0);
      } else {
        assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[1].url);
        assert.equal(await dialog.getByText('19개 · 성적은 기록하지 않아요', { exact: true }).count(), 1);
        assert.equal(imageRequests.includes(catalog.entries[0].url), false);
      }
      checks.push('different selected meanings excluded; actual count/empty state preserved');
    }
    if (stage === 'matrix') {
      const entry = page.getByRole('button', { name: '이미지 연습', exact: true });
      await entry.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await page.waitForFunction(() => document.querySelector('.image-practice-flip:not(:disabled)') !== null);
      await page.addScriptTag({ path: axePath });
      for (const width of [320, 390, 865, 1440]) for (const size of [100, 200]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(size => document.documentElement.style.fontSize = `${size}%`, size);
        assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
        assert.equal(await dialog.locator('[lang="en"]').count(), 0);
        const audit = await page.evaluate(async () => (await axe.run(document.querySelector('[role="dialog"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
        assert.deepEqual(audit.map(v => ({ id: v.id, impact: v.impact })), [], 'practice axe');
        await page.screenshot({ path: out + `/front-${width}-${size}.png`, fullPage: false });
      }
      await page.evaluate(() => document.documentElement.style.fontSize = '100%');
      await page.setViewportSize({ width: 390, height: 844 });
      const reveal = dialog.locator('.image-practice-flip');
      await reveal.focus(); await page.keyboard.press('Space');
      assert.equal(await dialog.locator('.image-practice-answer').innerText(), 'apple');
      await checkLayouts(page, dialog, 'back');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('.image-practice-entry') === document.activeElement);
      assert.equal(await entry.evaluate(e => e === document.activeElement), true);
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByRole('tab', { name: '오늘 학습', exact: true }).click();
      await entry.click();
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[0].url);
      assert.equal(await dialog.locator('[lang="en"]').count(), 0);
      checks.push('320/390/865/1440 at 100/200% text, keyboard Enter/Space/Escape, focus return, axe, tab reset');
    }
    if (stage === 'editor') {
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('apple');
      await page.getByRole('button', { name: 'apple 명사', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).waitFor();
      assert.equal(await dialog.locator('img').count(), 1, 'matching editor meaning has one preview');
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[0].url);
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] img')].every(image => image.complete && image.naturalWidth > 0));
      await page.screenshot({ path: out + '/editor.png', fullPage: false });
      await checkLayouts(page, dialog, 'editor');
      await dialog.getByLabel('학습할 뜻 선택', { exact: true }).selectOption('다른 뜻');
      assert.equal(await dialog.locator('img').count(), 0, 'changed meaning hides preview immediately');
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('changed sample');
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: '계속 편집', exact: true }).click();
      assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'changed sample');
      await dialog.getByLabel('학습할 뜻 선택', { exact: true }).selectOption('사과');
      assert.equal(await dialog.locator('img').count(), 1);
      await dialog.getByRole('button', { name: '다른 뜻 추가', exact: false }).click();
      assert.equal(await dialog.locator('img').count(), 0, 'empty new sense has no preview');
      await dialog.getByLabel('학습할 뜻', { exact: true }).fill('새로운 뜻');
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: '변경 버리고 닫기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('[data-slot=dialog-overlay]').waitFor({ state: 'detached' });
      const search = page.getByLabel('단어 또는 한국어 뜻 검색');
      for (const word of ['a, an', 'recommendation', 'bicycle']) {
        await search.click(); await search.fill(word);
        assert.equal(await search.inputValue(), word);
        await page.getByRole('button', { name: `${word} ${word === 'a, an' ? '부정관사' : '명사'}`, exact: true }).click();
        await dialog.getByLabel('함께 익힐 표현', { exact: true }).waitFor();
        assert.equal(await dialog.locator('img').count(), 1, 'longer editor word also has a preview');
        const image = allEntries.find(e => e.word === word && e.pos === (word === 'a, an' ? 'indefinite article' : 'n.'));
        assert.equal(await dialog.locator('img').getAttribute('src'), image.url);
        await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] img')].every(image => image.complete && image.naturalWidth > 0));
        await checkLayouts(page, dialog, `editor-${word}`);
        await dialog.getByRole('button', { name: '닫기', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.locator('[data-slot=dialog-overlay]').waitFor({ state: 'detached' });
      }
      checks.push('editor shows matching preview, hides changed/new meanings and preserves dismissal protection');
      checks.push('article variants, bicycle and nonpilot recommendation previews preserve readable editor inputs at 320/390/1440px and 100/200% text');
    }
    if (stage === 'error') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('img').waitFor();
      await dialog.locator('img').evaluate(image => { window.qaOldImage = image; });
      for (let i = 0; i < 100 && !heldImages.has(catalog.entries[0].url); i++) await page.waitForTimeout(50);
      await heldImages.get(catalog.entries[0].url).fulfill({ status: 503, body: 'Unavailable' });
      await page.waitForTimeout(300);
      assert.equal(await dialog.getByRole('button', { name: '다음', exact: true }).count(), 1, 'failed image can be skipped using the common navigation');
      assert.equal(await dialog.locator('[lang="en"]').count(), 0);
      await dialog.getByRole('button', { name: '다음', exact: true }).click();
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[1].url);
      await page.evaluate(() => { window.qaOldImage.dispatchEvent(new Event('load')); delete window.qaOldImage; });
      assert.equal(await dialog.locator('.image-practice-flip').isDisabled(), true, 'old image event cannot enable a new card');
      await heldImages.get(catalog.entries[1].url).fulfill({ contentType: 'image/webp', body: imageBytes(catalog.entries[1]) });
      await page.waitForFunction(() => document.querySelector('.image-practice-flip:not(:disabled)') !== null);
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
      assert.equal(await dialog.locator('.image-practice-flip').isDisabled(), true);
      const markup = await dialog.innerHTML();
      assert.equal(/apple|사과|n\.|A1/.test(markup), false, 'front DOM has no answer or word metadata');
      assert.equal(/apple|사과/.test(await page.locator('body').ariaSnapshot()), false, 'modal accessibility tree hides background answers');
      assert.equal(await dialog.locator('img').count(), 1);
      await dialog.getByRole('button', { name: '다음', exact: true }).click();
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[1].url);
      assert.equal(await dialog.locator('.image-practice-flip').isDisabled(), true);
      await dialog.getByRole('button', { name: '연습 닫기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      checks.push('slow image blocks reveal, navigation still advances, front hides answers, close remains available');
    }
    if (stage === 'back') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await page.waitForFunction(() => document.querySelector('.image-practice-picture')?.naturalWidth > 0);
      const historyLength = await page.evaluate(() => history.length);
      const flip = dialog.locator('.image-practice-flip'), picture = dialog.locator('.image-practice-picture');
      assert.equal(await dialog.getByRole('button', { name: '단어 확인', exact: true }).count(), 0, 'no separate reveal button');
      assert.equal(/apple|사과/.test(await dialog.innerHTML()), false);
      assert.equal(await dialog.locator('.word-ipa').count(), 0, 'front has no IPA DOM');
      await page.screenshot({ path: out + '/front.png', fullPage: false });
      await dialog.locator('.image-practice-picture').click();
      await dialog.locator('.image-practice-meaning').waitFor({ state: 'visible', timeout: 2000 });
      assert.equal(await dialog.locator('[lang="en"]').filter({ hasText: /^apple$/ }).count(), 1, 'reveal shows the correct English word');
      assert.equal(await dialog.locator('details[open]').count(), 0);
      assert.equal(await flip.locator('.word-ipa').count(), 1, 'back immediately includes IPA inside the card');
      assert.equal(await flip.locator('.phonetic').innerText(), '/ˈæpəl/');
      assert.equal(await flip.locator('.phonetic').isVisible(), true);
      assert.equal(await flip.locator('button, a, input, details').count(), 0, 'flip card contains text only');
      assert.equal(await dialog.getByText('사과', { exact: true }).isVisible(), true, 'meaning is visible immediately after reveal');
      assert.equal(await dialog.locator('.image-practice-sense .pos-label').innerText(), '명사 (n.)');
      assert.match(await flip.getAttribute('type'), /^button$/);
      assert.match(await dialog.ariaSnapshot(), /apple.*사과.*이미지 보기/);
      await page.screenshot({ path: out + '/back.png', fullPage: false });
      const pronunciation = dialog.locator('summary').filter({ hasText: /^발음$/ });
      await pronunciation.click();
      assert.equal(await dialog.locator('.word-ipa').count(), 1, 'audio help does not duplicate IPA');
      assert.equal(await dialog.locator('details[open]').count(), 1, 'pronunciation opens without flipping the card');
      assert.equal(await dialog.locator('.image-practice-meaning').isVisible(), true);
      await dialog.locator('.image-practice-meaning').click();
      await picture.waitFor({ state: 'visible' });
      assert.equal(await dialog.locator('.image-practice-sense').count(), 0, 'returning to front removes answer DOM');
      assert.equal(await dialog.locator('.word-ipa').count(), 0, 'returning to front also removes IPA');
      assert.equal(await dialog.locator('details').count(), 0);
      assert.equal(/apple|사과/.test(await dialog.ariaSnapshot()), false, 'returned front hides answers from assistive technology');
      await flip.focus();
      await page.keyboard.press('Enter');
      await dialog.locator('.image-practice-meaning').waitFor({ state: 'visible' });
      assert.equal(await flip.evaluate(el => el === document.activeElement), true, 'keyboard flip keeps focus on the same card');
      await page.keyboard.press('Space');
      await picture.waitFor({ state: 'visible' });
      assert.equal(await flip.evaluate(el => el === document.activeElement), true);
      for (let i = 0; i < 3; i++) {
        const imageBox = await picture.boundingBox();
        await page.touchscreen.tap(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
        await dialog.locator('.image-practice-meaning').waitFor({ state: 'visible' });
        const meaningBox = await dialog.locator('.image-practice-meaning').boundingBox();
        await page.touchscreen.tap(meaningBox.x + meaningBox.width / 2, meaningBox.y + meaningBox.height / 2);
        await picture.waitFor({ state: 'visible' });
      }
      assert.equal(await page.evaluate(() => history.length), historyLength, 'flipping creates no browser history entries');
      assert.equal(requests.positionWrites, 0, 'flipping does not save or change the practice position');
      assert.equal(imageRequests.filter(url => url === catalog.entries[0].url).length, 1, 'same picture stays loaded across flips');
      await flip.click();
      await dialog.locator('.image-practice-meaning').waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: '연습 닫기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      await picture.waitFor({ state: 'visible' });
      assert.equal(await dialog.locator('.image-practice-sense').count(), 0, 'reopening always starts at the image front');
      checks.push('image/meaning clicks, repeated touch taps and Enter/Space flip both ways; focus, pronunciation, hidden answers, no writes or extra image fetches/history, reopen front');
    }
    if (stage === 'full') {
      await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByText('3,809개 · 성적은 기록하지 않아요', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('.image-practice-flip:not(:disabled)') !== null);
      assert.equal(await dialog.getByText('1 / 3809', { exact: true }).count(), 1);
      assert.deepEqual([...new Set(imageRequests)], allEntries.slice(0, 2).map(e => e.url));
      checks.push('all 3809 textbook entries eligible; only current and next image requested');
    }
    if (stage === 'lifecycle' || stage === 'isolation' || stage === 'extended') {
      const entry = page.getByRole('button', { name: '이미지 연습', exact: true });
      await entry.click();
      const dialog = page.getByRole('dialog');
      for (let i = 0; i < catalog.entries.length; i++) {
        const expected = words.find(w => w.id === catalog.entries[i].entryId).word;
        assert.equal(await dialog.locator('.word-ipa').count(), 0, 'each new front omits IPA');
        assert.equal(await dialog.locator('[lang="en"]').count(), 0, 'new card has no English answer');
        assert.equal(await dialog.getByText(expected, { exact: true }).count(), 0, 'every front DOM hides its English answer');
        assert.equal((await dialog.locator('.dialog-scroll').innerHTML()).includes(catalog.entries[i].baseMeaning), false, 'every front card DOM hides its meaning');
        await page.waitForFunction(() => document.querySelector('.image-practice-flip:not(:disabled)') !== null);
        assert.deepEqual(await dialog.locator('img').evaluate(image => [image.naturalWidth, image.naturalHeight]), [catalog.entries[i].width, catalog.entries[i].height], 'web image decoded with the catalog dimensions');
        const allowed = new Set(catalog.entries.slice(0, i + 2).map(e => e.url));
        assert.equal(imageRequests.every(url => allowed.has(url)), true, 'every step fetches at most one image ahead');
        await dialog.locator('.image-practice-flip').click();
        assert.equal(await dialog.locator('.image-practice-answer').innerText(), expected);
        assert.deepEqual(await dialog.locator('.word-ipa .phonetic').allTextContents(), ipa[catalog.entries[i].entryId].map(v => v[0]), 'each back has the current word IPA');
        if (ipa[catalog.entries[i].entryId].length > 1)
          assert.deepEqual((await dialog.locator('.ipa-usage').allTextContents()).map(text => text.trim()), ipa[catalog.entries[i].entryId].map(v => v[1]), 'all variant conditions remain visible');
        assert.equal(await dialog.locator('.image-practice-meaning').innerText(), catalog.entries[i].baseMeaning);
        assert.equal(await dialog.locator('.image-practice-meaning').isVisible(), true);
        assert.equal(await dialog.locator('.image-practice-sense .pos-code').innerText(), '(' + catalog.entries[i].pos + ')');
        assert.equal(await dialog.locator('details[open]').count(), 0);
        if (i >= 6 && i <= 13) await page.screenshot({ path: out + '/sense-' + (i + 1) + '.png', fullPage: false });
        if (i === 17 && stage === 'lifecycle') await checkLayouts(page, dialog, 'long-meaning');
        if (expected === 'a, an' && stage === 'lifecycle') await checkLayouts(page, dialog, 'article-ipa');
        if (i < catalog.entries.length - 1) {
          assert.equal(await dialog.getByRole('button', { name: '다음', exact: true }).count(), 1, 'revealed card has a next button');
          await dialog.getByRole('button', { name: '다음', exact: true }).click();
        }
      }
      assert.equal(await dialog.getByRole('button', { name: '다음', exact: true }).isDisabled(), true);
      await dialog.getByRole('button', { name: /카드 번호/ }).click();
      await dialog.getByLabel(/카드 번호 \(1/).fill('1');
      await dialog.getByRole('button', { name: '이동', exact: true }).click();
      await dialog.getByText('위치 저장됨', { exact: true }).waitFor();
      assert.equal(await dialog.locator('[lang="en"]').count(), 0);
      assert.equal(await dialog.locator('img').getAttribute('src'), catalog.entries[0].url);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('.image-practice-entry') === document.activeElement);
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
      await page.getByText('저장됨', { exact: true }).waitFor();
      assert.equal(await dialog.count(), 0, 'refresh does not restore practice');
      checks.push(`${catalog.entries.length} cards reveal correct words, visible meanings and parts of speech; restart, Escape, app Back gesture, refresh, focus return`);
    }
    assert.deepEqual({ state: stored, revision }, before);
    if (persisted) assert.deepEqual(await api(), before, 'actual local D1 documents and revision unchanged after practice');
    assert.equal(requests.writes, 0); assert.equal(requests.ai, 0);
    assert.deepEqual(errors, []);
    const report = { passed: true, stage, engine, checks, requests, imageRequests, errors, sourceImages: stage === 'full' ? 3809 : catalog.entries.length, stateUnchanged: true, stateBoundary: persisted ? 'local-d1' : 'mock-http', actualIphoneChecked: false };
    fs.writeFileSync(out + '/' + stage + '-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, imageRequests: imageRequests.length }));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: out + '/' + stage + '-failure.png', fullPage: false });
      const body = await page.locator('body').innerText();
      fs.writeFileSync(out + '/' + stage + '-failure.json', JSON.stringify({ stage, requests, moduleNameMatches, errors, body }, null, 2));
      console.error(JSON.stringify({ setupDiagnostic: body.slice(0, 1800), requests, moduleNameMatches, errors }));
    }
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
