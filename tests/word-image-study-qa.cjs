// Local HTTP fixtures only. Image bytes come from the approved local WebP output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { emptyState } = require('./fixtures/backup-history.cjs');
const engine = process.env.QA_BROWSER || 'chromium';
const disabled = process.argv[2] === 'disabled' || !['development', 'enabled'].includes(process.env.QA_IMAGE_PILOT_MODE);
const out = `outputs/word-image-full/${engine}`;
const web = JSON.parse(fs.readFileSync('data/word-image-web-manifest.json'));
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const pilotIds = new Set(JSON.parse(fs.readFileSync('data/word-image-pilot-web.json')).entries.map(e => e.entryId));
const samples = ['A1', 'A2', 'B1', 'B2'].map(level => web.entries.find(e => e.level === level && !pilotIds.has(e.entryId) && e.pos === 'n.'));
const byHash = new Map(web.entries.map(e => [e.sha256, e]));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const checks = [], errors = [];

async function layouts(page, panel) {
  await page.addScriptTag({ path: axePath });
  for (const width of [320, 390, 1440]) for (const size of [100, 200]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(size => document.documentElement.style.fontSize = size + '%', size);
    assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth), false);
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector('.session-panel'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations);
    assert.deepEqual(violations.map(v => v.id), []);
    await page.screenshot({ path: `${out}/learn-${width}-${size}.png` });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '100%');
}

async function scenario(browser, name, entry, stage = 'learn') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('image_full_study') });
  const id = entry.entryId, word = words.find(w => w.id === id);
  const state = { ...emptyState(), grammar: {} };
  const assessmentIds = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
  state.settings.assessments.A1 = { ids: assessmentIds, index: 20, marks: Object.fromEntries(assessmentIds.map(id => [id, 'uncertain'])), completed: true };
  state.progress[id] = { meaning: content[id].meaning, notes: '보존할 사용자 편집', familiarity: 'known', en: 'independent', ko: 'help',
    studyDates: ['2026-09-30'], lastStudied: '2026-09-30', familiarityCheck: { initial: 'known', answer: '최초 답 보존', meaning: content[id].meaning, final: 'known' } };
  const sid = randomUUID(), material = { ...content[id] };
  if (name === 'snapshot') material.meaning = '과거에 선택한 별도 뜻';
  state.sessions[sid] = { id: sid, kind: 'daily', date, period: date, ids: [id], warmupIds: stage === 'warmup' ? [id] : [], stage, index: 0,
    records: { [id]: { entryId: id, meaning: material.meaning, material, enAnswer: '이전 최초 답', notes: '기록 보존', learnedOn: '2026-09-30',
      en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: '' } },
    retry: [], retryMode: false, elapsed: 0, finished: false, paused: true, createdAt: date + 'T09:00:00.000Z' };
  if (name === 'editor-retry') state.sessions = {};
  let revision = 9, writes = 0, failedImage = false;
  const initial = structuredClone(state), imageRequests = [];
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    if (url.pathname.startsWith('/word-images/v1/')) {
      imageRequests.push(url.pathname);
      if (name === 'image-error' && !failedImage) { failedImage = true; return route.fulfill({ status: 503, body: 'Unavailable' }); }
      const entry = byHash.get(path.basename(url.pathname, '.webp')); assert.ok(entry);
      return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(process.env.QA_WORD_IMAGE_ASSET_ROOT, entry.sha256 + '.webp')) });
    }
    if (url.pathname.startsWith('/api/') && /feedback|automation|ai-eval/.test(url.pathname)) throw Error('Image UI must not call AI');
    if (url.pathname === '/api/state') {
      if (request.method() === 'GET') return route.fulfill({ json: { state, revision } });
      const data = request.postDataJSON(); writes++;
      assert.equal(data.revision, revision);
      if (name === 'editor-retry' && writes === 1) return route.fulfill({ status: 503, json: { error: '검사 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.' } });
      if (data.settings) state.settings = data.settings;
      Object.assign(state.progress, data.progress); Object.assign(state.sessions, data.sessions);
      return route.fulfill({ json: { revision: ++revision } });
    }
    return route.continue();
  });
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('저장됨', { exact: true }).waitFor();
    if (name === 'editor-retry') {
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill(word.word);
      await page.getByRole('button', { name: word.word + ' 명사', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('img').waitFor();
      assert.equal(await dialog.locator('img').getAttribute('src'), `/word-images/v1/${entry.sha256}.webp`);
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('a changed expression');
      await dialog.getByRole('button', { name: '기록 저장', exact: true }).click();
      await dialog.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
      assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'a changed expression');
      assert.deepEqual(state, initial);
      await dialog.getByRole('button', { name: '다시 저장', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(writes, 2);
      assert.equal(state.progress[id].expression, 'a changed expression');
      assert.deepEqual(state.progress[id].familiarityCheck, initial.progress[id].familiarityCheck);
      assert.deepEqual(state.progress[id].studyDates, initial.progress[id].studyDates);
      assert.equal(state.progress[id].notes, initial.progress[id].notes);
      assert.equal(state.progress[id].en, initial.progress[id].en); assert.equal(state.progress[id].ko, initial.progress[id].ko);
      assert.deepEqual(state.sessions, initial.sessions);
      await page.reload(); await page.getByText('저장됨', { exact: true }).waitFor();
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill(word.word);
      await page.getByRole('button', { name: word.word + ' 명사', exact: true }).click();
      assert.equal(await page.getByRole('dialog').getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'a changed expression');
    } else {
      await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
      const panel = page.locator('.session-panel'); await panel.waitFor();
      assert.equal(writes, 1, 'only the explicit resume saves');
      // Resume has its own existing carryover normalization. Take the image-only
      // baseline after that explicit action, not before opening the lesson.
      const resumedProgress = structuredClone(state.progress);
      if (stage !== 'learn' || name === 'snapshot' || name === 'disabled-learn') {
        assert.equal(await panel.locator('img').count(), 0);
        assert.equal(imageRequests.length, 0);
      } else if (name === 'image-error') {
        await page.waitForFunction(() => !document.querySelector('.word-image-learn'));
        assert.equal(await panel.locator('h3[lang="en"]').innerText(), word.word);
        await panel.locator('#study-meaning').fill('그림 없는 다른 뜻');
        await panel.locator('#study-meaning').fill(entry.baseMeaning);
        await panel.locator('.word-image-learn').waitFor();
      } else {
        const image = panel.locator('.word-image-learn'); await image.waitFor();
        assert.equal(await image.getAttribute('src'), `/word-images/v1/${entry.sha256}.webp`);
        await page.waitForFunction(() => { const image = document.querySelector('.word-image-learn'); return image?.complete && image.naturalWidth > 0; });
        if (name === 'learn-A1') await layouts(page, panel);
        await panel.locator('#study-meaning').fill('그림 없는 다른 뜻');
        await image.waitFor({ state: 'detached' });
        assert.equal(await panel.locator('img').count(), 0);
        await panel.locator('#study-meaning').fill(entry.baseMeaning);
        await image.waitFor({ state: 'visible' });
        assert.equal(await panel.locator('img').count(), 1);
      }
      assert.deepEqual(state.progress, resumedProgress);
      const originalSense = state.progress[id].senses?.[initial.progress[id].meaning] || state.progress[id];
      assert.equal(originalSense.en, initial.progress[id].en); assert.equal(originalSense.ko, initial.progress[id].ko);
      assert.deepEqual(state.progress[id].familiarityCheck, initial.progress[id].familiarityCheck);
      assert.deepEqual(state.sessions[sid].records, initial.sessions[sid].records);
      assert.equal(writes, 1, 'image loading and draft edits do not save grades or material');
    }
    checks.push({ name, entryId: id, level: entry.level, writes, imagesRequested: imageRequests.length });
  } catch (error) {
    await page.screenshot({ path: `${out}/${name}-failure.png` });
    console.error((await page.locator('body').innerText()).slice(0, 1800)); throw error;
  } finally { await context.close(); }
}

(async () => {
  await waitForWorker(); fs.mkdirSync(out, { recursive: true });
  const browser = await launchBrowser({ engine });
  try {
    if (disabled) await scenario(browser, 'disabled-learn', samples[0]);
    else {
      for (const entry of samples) await scenario(browser, 'learn-' + entry.level, entry);
      for (const stage of ['warmup', 'en', 'ko']) await scenario(browser, 'hidden-' + stage, samples[0], stage);
      await scenario(browser, 'snapshot', samples[0]);
      await scenario(browser, 'image-error', samples[0]);
      await scenario(browser, 'editor-retry', samples[0]);
    }
    assert.deepEqual(errors, []);
    const report = { passed: true, engine, checks, errors, localFixturesOnly: true, actualIphoneChecked: false };
    fs.writeFileSync(`${out}/study${disabled ? '-disabled' : ''}-report.json`, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
