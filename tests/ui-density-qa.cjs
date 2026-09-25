// Local synthetic learner only. Exercise responsive navigation without changing scores.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/ui-density-${engine}`;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await launchBrowser({ engine }), checks = [], errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('ui_density') });
    const get = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
    const before = await get(), words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const word = words.find(w => w.word === 'arrive' && w.pos === 'v.');
    const record = { entryId: word.id, meaning: content[word.id].meaning, material: content[word.id], learnedOn: date, en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'I arrive home at six.', notes: '' };
    const session = (kind, hour) => { const id = crypto.randomUUID(); return { id, kind, date, period: kind === 'monthly' ? date.slice(0, 7) : date, ids: [word.id], records: { [word.id]: { ...record, ...(kind === 'monthly' ? { ko: 'unmeasured' } : {}) } }, stage: kind === 'monthly' ? 'ko' : 'done', index: 0, warmupIds: [], retry: [], retryMode: false, elapsed: 0, paused: true, finished: kind === 'daily', createdAt: date + `T0${hour}:00:00Z` }; };
    const daily = session('daily', 0), old = session('monthly', 1), latest = session('monthly', 2);
    const state = { ...before.state, settings: { ...before.state.settings, dailyGoal: 1 }, sessions: Object.fromEntries([daily, old, latest].map(s => [s.id, s])), grammar: { noun: { stage: 0, sentence: '', answers: {}, updatedAt: new Date().toISOString() } } };
    const restored = await context.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(before.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(restored.status(), 200, await restored.text());
    const savedState = (await get()).state;
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base, { waitUntil: 'domcontentloaded' }); await p.getByText('서버에 저장됨', { exact: true }).waitFor();
    const tab = name => p.getByRole('tab', { name, exact: true }).click();
    const shot = async name => { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
    const audit = async () => {
      await p.addScriptTag({ path: axePath });
      assert.deepEqual(await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => v.id)), []);
    };
    await tab('전체 단어장');
    const rows = p.locator('.word-table tbody tr'); assert.equal(await rows.count(), 10);
    const top = p.getByRole('navigation', { name: '단어 목록 상단 페이지 이동' }), bottom = p.getByRole('navigation', { name: '단어 목록 하단 페이지 이동' });
    const first = await rows.first().innerText();
    await top.getByRole('button', { name: '다음 페이지' }).click(); assert.notEqual(await rows.first().innerText(), first);
    await bottom.getByRole('button', { name: '이전 페이지' }).click(); assert.equal(await rows.first().innerText(), first);
    assert.equal(await p.getByRole('heading', { name: '단어 찾기' }).evaluate(el => document.activeElement === el), true);
    await p.getByLabel('페이지당 단어 수').selectOption('30'); assert.equal(await rows.count(), 30);
    await p.getByLabel('페이지당 단어 수').selectOption('10');
    await p.getByLabel('단어 또는 한국어 뜻 검색').fill('arrive'); assert.equal(await rows.count(), 1);
    await p.getByRole('button', { name: 'arrive 동사 도움말' }).click(); await p.getByRole('dialog').waitFor(); await p.keyboard.press('Escape');
    await p.getByRole('button', { name: '필터 초기화' }).click();
    const identity = await p.locator('.word-identity').first().evaluate(el => ({ height: el.getBoundingClientRect().height, help: el.querySelector('.pos-help-button').getBoundingClientRect().height }));
    assert.ok(identity.height < 80 && identity.help >= 44);
    for (const width of [320, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 844 });
      for (const size of [100, 200]) {
        await p.evaluate(size => document.documentElement.style.fontSize = `${size}%`, size);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await p.evaluate(() => document.documentElement.style.fontSize = '100%');
      if ([390, 1440].includes(width)) await shot(`library-${width}`);
    }
    checks.push('10/30 entries, both pagination controls, bottom focus, help alignment and 320–1440px/200% text');
    await p.setViewportSize({ width: 390, height: 844 }); await tab('품사·문장 연습');
    assert.equal(await p.locator('.grammar-group[open]').count(), 1);
    await p.locator('.grammar-group > summary').filter({ hasText: '관계와 연결' }).click();
    assert.equal(await p.locator('.grammar-group[open]').count(), 2);
    await shot('catalog-mobile'); await audit();
    await p.locator('.grammar-tile').first().click();
    assert.ok((await p.locator('.grammar-stage').boundingBox()).y < 400);
    await shot('lesson-mobile'); await audit();
    await p.getByRole('button', { name: '수업 목록', exact: true }).click();
    assert.equal(await p.locator('.grammar-group[open]').count(), 2);
    checks.push('catalog groups expand and survive return; mobile lesson exposes content above 400px');
    await tab('주간·월말 점검');
    const pending = p.getByRole('tabpanel', { name: '주간·월말 점검', exact: true }).locator('.pending-reviews'); assert.match(await pending.innerText(), /1회차/);
    assert.match(await p.locator('[data-review-kind=monthly]').innerText(), /2회차.*최신 회차/);
    assert.equal(await p.locator('.practice-options button').count(), 0);
    assert.ok(await p.getByText('지금 보완할 항목이 없어요.').isVisible());
    await shot('review-mobile'); await audit();
    await p.setViewportSize({ width: 1440, height: 1000 }); await shot('review-desktop');
    await tab('학습 기록'); assert.doesNotMatch(await p.locator('.journal-list').innerText(), /기록을 보고 있어요/);
    assert.deepEqual((await get()).state, savedState, 'browsing and display choices preserve all stored learning');
    checks.push('duplicate-period sessions are distinct; empty practice and redundant history copy collapse without data writes');
    await p.setViewportSize({ width: 390, height: 844 }); await tab('오늘의 학습');
    await p.getByRole('button', { name: '오늘 단어 다시 학습', exact: true }).click();
    const expression = p.locator('.expression-line'); await expression.waitFor();
    assert.ok(await expression.evaluate(el => !!(el.compareDocumentPosition(document.querySelector('.example-box')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.equal(await p.locator('.learn-actions').evaluate(el => getComputedStyle(el).position), 'static');
    await shot('learn-mobile');
    checks.push('expression and translation precede example; confirmation no longer overlays study content');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, engine, checks }));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
