// Body-only touch gestures and tab-local navigation; synthetic local learners only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { base, accountHeaders, launchBrowser, closeBrowser, axePath } = require('./qa/runtime.cjs');
const until = async (check, label) => {
  for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw Error(label);
};
(async () => {
  await build({ entryPoints: ['lib/grammar/content.ts'], outfile: 'work/navigation-content.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { LESSON_MAP } = require('../work/navigation-content.cjs');
  const engine = process.env.QA_BROWSER || 'chromium';
  const browser = await launchBrowser({ engine }), checks = [], errors = [];
  const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('navigation'), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const get = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
  const before = await get(), now = new Date().toISOString();
  const grammar = { noun: { stage: 5, sentence: 'I like books.', updatedAt: now,
    answers: Object.fromEntries(LESSON_MAP.get('noun').questions.map((q, i) => [`q${i + 1}`, { first: q.answer, latest: q.answer, attempts: 1, helped: false }])) } };
  const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
  const word = words.find(w => w.word === 'apple' && w.pos === 'n.');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const id = crypto.randomUUID(), session = { id, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], stage: 'en', index: 0,
    records: { [word.id]: { meaning: content[word.id].meaning, material: content[word.id], en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' } },
    retry: [], retryMode: false, elapsed: 0, finished: false, paused: false, createdAt: now };
  assert.equal((await context.request.put(base + '/api/state', { data: { revision: before.revision, settings: { ...before.state.settings, activeSessionId: id }, grammar, progress: {}, sessions: { [id]: session } } })).status(), 200);
  const page = await context.newPage(); page.setDefaultTimeout(10_000); page.on('pageerror', error => errors.push(error.message));

  const tab = name => page.getByRole('tab', { name, exact: true });
  const swipe = async ({ dx = 180, dy = 0, cancel = false, x = 5 } = {}) => {
    await page.waitForTimeout(220); // Let the existing dialog entrance animation finish.
    const result = await page.evaluate(({ dx, dy, cancel, x }) => {
      const dialogs = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(e => e.getClientRects().length && !e.closest('[aria-hidden="true"]'));
      const dialog = dialogs.at(-1), bounds = dialog?.getBoundingClientRect();
      const y = bounds ? Math.min(innerHeight - 40, bounds.top + 40) : document.querySelector('.topbar').getBoundingClientRect().bottom + 100;
      const target = document.elementFromPoint(x, y);
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const chrome = () => ({ header: rect('.topbar'), nav: rect('.main-nav') });
      const before = chrome(), length = history.length;
      const fire = (type, point) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
          touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : [point] },
          changedTouches: { value: [point] },
        });
        target.dispatchEvent(event); return event.defaultPrevented;
      };
      const prevented = fire('touchstart', { identifier: 1, clientX: x, clientY: y });
      fire('touchmove', { identifier: 1, clientX: x + dx, clientY: y + dy });
      const during = chrome();
      const moved = [...document.querySelectorAll('.navigation-body,[role="dialog"],[role="alertdialog"]')].some(e => e.style.transform.includes('translateX('));
      const translation = document.querySelector('.navigation-body').style.transform;
      fire(cancel ? 'touchcancel' : 'touchend', { identifier: 1, clientX: x + dx, clientY: y + dy });
      return { before, during, length, prevented, moved, translation };
    }, { dx, dy, cancel, x });
    assert.deepEqual(result.during, result.before, 'header and main nav must stay fixed during drag');
    await page.waitForTimeout(240);
    assert.equal(await page.evaluate(() => history.length), result.length, 'gestures must not add browser history entries');
    return result;
  };
  const back = () => swipe();
  const at = async name => {
    await until(async () => await tab(name).getAttribute('aria-selected') === 'true', 'tab ' + name);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    assert.equal(await tab(name).getAttribute('aria-selected'), 'true', 'focus restoration must not activate a different tab');
  };
  const marker = () => page.evaluate(() => history.length);
  try {
    await page.goto(base + '/favicon.svg'); await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    const initialHistory = await marker();
    for (const name of ['전체 단어장', '주간·월말 점검', '학습 기록', '오늘의 학습', '전체 단어장']) {
      await tab(name).click(); const rootSwipe = await back(); await at(name);
      assert.equal(rootSwipe.moved, false, 'tab root is not a Back destination');
    }
    assert.equal(await marker(), initialHistory);
    assert.equal(await page.evaluate(() => {
      const target = document.elementFromPoint(5, 25);
      const event = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: [{ identifier: 1, clientX: 5, clientY: 25 }] });
      target.dispatchEvent(event);
      return event.defaultPrevented && !document.documentElement.hasAttribute('data-swiping');
    }), true, 'fixed header edge must not trigger a full-page native transition');
    await page.getByRole('button', { name: '학습 설정', exact: true }).click(); await page.getByRole('dialog').waitFor();
    await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); await at('전체 단어장');
    await page.getByRole('button', { name: '학습 설정', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' }); await back(); await at('전체 단어장');
    checks.push('all tab roots ignore Back; tab visits do not add browser history; settings swipe and Close work');

    const search = page.getByLabel('단어 또는 한국어 뜻 검색'); await search.fill('apple');
    await page.getByRole('button', { name: 'apple 명사', exact: true }).click(); await page.getByRole('dialog').waitFor();
    await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(await search.inputValue(), 'apple');
    await page.getByRole('button', { name: '개인 단어 추가', exact: true }).click(); await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'apple 명사 도움말', exact: true }).click(); await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '학습 방식·출처', exact: true }).click(); await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    checks.push('word editor, personal word, POS help and source dialog close without resetting filters');

    await tab('품사·문장 연습').click(); await page.locator('.grammar-tile').first().click();
    const input = page.getByRole('textbox', { name: '내 문장', exact: true });
    if (engine === 'chromium') {
      const client = await context.newCDPSession(page);
      const chrome = () => page.evaluate(() => ['.topbar', '.main-nav'].map(selector => {
        const r = document.querySelector(selector).getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
      }));
      const beforeDrag = await chrome();
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 5, y: 160 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 162 }] });
      assert.equal(await page.locator('.navigation-body').evaluate(e => e.style.transform.includes('translateX(')), true);
      assert.deepEqual(await chrome(), beforeDrag);
      fs.mkdirSync('outputs/navigation', { recursive: true });
      await page.screenshot({ path: 'outputs/navigation/body-swipe.png' });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await input.isVisible(), true);
      await client.detach();
      checks.push('browser-injected touch moves only body; header/nav coordinates unchanged; touchcancel keeps lesson');
    }
    await swipe({ dx: 30 }); assert.equal(await input.isVisible(), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await swipe({ dx: 180, cancel: true });
    assert.match(reduced.translation, /translateX\(0px\)/, 'reduced motion does not translate the body');
    assert.equal(await page.locator('.navigation-body').evaluate(e => e.style.transform), '', 'cancel clears inline styles');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await swipe({ dx: 180, cancel: true }); assert.equal(await input.isVisible(), true);
    await swipe({ dx: 20, dy: 160 }); assert.equal(await input.isVisible(), true);
    await swipe({ dx: -100 }); assert.equal(await input.isVisible(), true);
    await swipe({ x: 150 }); assert.equal(await input.isVisible(), true);
    await tab('오늘의 학습').click(); await back(); await at('오늘의 학습');
    await tab('전체 단어장').click(); assert.equal(await input.isVisible(), true);
    checks.push('short/cancelled/vertical/leftward/mid-page touches do not navigate; each tab retains its own internal view');
    await page.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '검사 저장 실패' } }) : route.continue());
    await input.fill('I like coffee and books.'); await back();
    await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
    assert.equal(await input.isVisible(), true);
    assert.equal(await input.inputValue(), 'I like coffee and books.');
    await page.unroute('**/api/state'); await back(); await page.locator('.grammar-catalog').waitFor();
    assert.equal((await get()).state.grammar.noun.sentence, 'I like coffee and books.');
    assert.deepEqual((await get()).state.grammar.noun.answers, grammar.noun.answers);
    await page.locator('.grammar-tile').first().click(); await input.waitFor(); assert.equal(await input.inputValue(), 'I like coffee and books.');
    let aiRoute;
    await page.route('**/api/grammar-feedback', route => { aiRoute = route; });
    await page.getByRole('button', { name: 'AI로 문장 점검', exact: true }).click(); await until(() => !!aiRoute, 'AI request');
    await back(); await page.locator('.grammar-catalog').waitFor();
    await aiRoute.fulfill({ json: { feedback: { original: 'I like coffee and books.', correctedSentence: 'I like tea.', explanation: '합성 의견', meaningUsage: 'appropriate', grammar: 'natural', model: 'gemini-3.1-flash-lite', createdAt: now } } }).catch(() => {});
    await page.waitForTimeout(200); assert.equal((await get()).state.grammar.noun.feedback, undefined);
    await back(); await search.waitFor(); assert.equal(await search.inputValue(), 'apple');
    checks.push('grammar Back saves drafts, failed saves block departure, reopening resumes, late AI is ignored');

    await tab('학습 기록').click(); await page.getByRole('button', { name: '기록 관리', exact: true }).click(); await page.getByRole('menuitem', { name: '전체 백업', exact: true }).click();
    await page.getByRole('dialog').waitFor(); await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '기록 관리', exact: true }).click(); await page.getByRole('menuitem', { name: '백업 가져오기', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForFunction(() => document.querySelector('input[type=file]') && !document.querySelector('input[type=file]').disabled);
    const backup = { format: 'haru-words-v1', exportedAt: now, state: (await get()).state };
    await page.locator('input[type=file]').setInputFiles({ name: 'navigation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.locator('[data-safety-preview]').filter({ hasText: '복원 가능' }).waitFor();
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: '현재 기록 먼저 백업받기', exact: true }).click(); await download;
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '이 백업으로 복원', exact: true }).click();
    await page.getByRole('alertdialog').waitFor(); await back(); await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    await page.getByRole('button', { name: '이 백업으로 복원', exact: true }).click(); await page.getByRole('alertdialog').waitFor();
    await back(); await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '기록 관리', exact: true }).click();
    await page.getByRole('menuitem', { name: '백업 가져오기', exact: true }).click(); await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    assert.equal((await get()).state.sessions[id].records[word.id].en, 'unmeasured');
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    checks.push('backup export/import and nested confirmation navigate without applying a restore or reviving stale consent');

    await tab('오늘의 학습').click(); await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
    const answer = page.getByRole('textbox', { name: '한국어 뜻 입력', exact: true }); await answer.fill('사과 - 아직 채점 전');
    await back(); await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).waitFor();
    const saved = (await get()).state.sessions[id];
    assert.equal(saved.records[word.id].draft.answer, '사과 - 아직 채점 전'); assert.equal(saved.records[word.id].en, 'unmeasured');
    assert.equal(saved.paused, true); assert.equal(saved.finished, false);
    await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
    assert.equal(await answer.inputValue(), '사과 - 아직 채점 전');
    await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click();
    await page.getByRole('button', { name: '학습 홈으로', exact: true }).click();
    checks.push('daily Back pauses and saves ungraded input; existing exit/home buttons still work');

    await page.getByRole('button', { name: '학습 설정', exact: true }).click();
    await page.getByRole('button', { name: '친숙도 다시 확인하기', exact: true }).click();
    await page.getByLabel('친숙도 확인 순서').waitFor();
    await back(); await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).waitFor();
    checks.push('closing settings and asynchronously opening familiarity is not lost; Back returns home');

    // Finished daily lesson dialogs and a save in flight use the same safety gate.
    const current = await get(), done = structuredClone(current.state.sessions[id]);
    Object.assign(done, { finished: true, stage: 'done', index: done.ids.length, paused: true });
    Object.assign(done.records[word.id], { en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'I eat an apple.' });
    delete done.records[word.id].draft;
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: current.revision, sessions: { [id]: done }, progress: {}, settings: { ...current.state.settings, dailyGoal: 1 } } })).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    await page.getByRole('button', { name: '오늘 단어 다시 보기', exact: true }).click(); await page.getByRole('dialog').waitFor();
    await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '학습일 수정', exact: true }).click(); await page.getByRole('dialog').waitFor();
    const previous = new Date(date + 'T12:00:00Z'); previous.setUTCDate(previous.getUTCDate() - 1);
    await page.locator('#correct-study-date').fill(previous.toISOString().slice(0, 10));
    let held;
    await page.route('**/api/state', route => route.request().method() === 'PUT' ? (held = route) : route.continue());
    const correctionIndex = await marker(); await page.getByRole('button', { name: '학습일 수정하기', exact: true }).click();
    await until(() => !!held, 'date save in flight'); await back();
    await until(async () => await marker() === correctionIndex, 'saving date blocks Back'); assert.equal(await page.getByRole('dialog').isVisible(), true);
    await held.continue(); await page.unroute('**/api/state'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal((await get()).state.sessions[id].date, previous.toISOString().slice(0, 10));
    checks.push('completed lesson and date editor support Back; date save in flight cannot be dismissed');

    // A real revision conflict reloads the account while Settings stays open.
    // The new account epoch must retain a dismissible tool, not old lesson paths.
    await page.getByRole('button', { name: '학습 설정', exact: true }).click();
    const remote = await get();
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: remote.revision, settings: { ...remote.state.settings, dailyGoal: 2 }, progress: {}, sessions: {} } })).status(), 200);
    await page.getByRole('combobox', { name: '하루 목표', exact: true }).click();
    await page.getByRole('option', { name: '3개 · 기본 목표', exact: true }).click();
    await page.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    await page.getByRole('dialog').waitFor();
    await back(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal((await get()).state.settings.dailyGoal, 2);
    checks.push('account reload preserves Settings dismissal while invalidating old record views');

    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations), []);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    // Reload creates a new in-memory navigation session, with no synthetic root trap.
    const root = await context.newPage(); await root.goto(base + '/favicon.svg'); await root.goto(base, { waitUntil: 'domcontentloaded' });
    await root.getByText('서버에 저장됨', { exact: true }).waitFor(); await root.goBack(); assert.match(root.url(), /favicon\.svg$/);
    checks.push('320–1440px, accessibility, original root Back leaves the site');
    assert.deepEqual(errors, []);
    fs.mkdirSync('outputs/navigation', { recursive: true });
    fs.writeFileSync(`outputs/navigation/${engine}.json`, JSON.stringify({ passed: true, engine, checks, actualIPhone: false, realGoogleCalls: 0 }, null, 2));
    console.log(JSON.stringify({ passed: true, engine, checks }));
  } catch (error) {
    console.error(JSON.stringify({ engine, checks, errors, navigation: await page.evaluate(() => ({ trace: window.navigationTrace, historyLength: history.length, tab: document.querySelector('[role=tab][aria-selected=true]')?.textContent, dialogs: document.querySelectorAll('[role=dialog], [role=alertdialog]').length })) }));
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
