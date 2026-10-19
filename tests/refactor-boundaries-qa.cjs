// Local synthetic accounts; provider replies are mocked. Never invokes a paid API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { launchBrowser, closeBrowser, base, accountHeaders, axePath } = require('./qa/runtime.cjs');
const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const material = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const saved = p => p.getByText('저장됨', { exact: true }).waitFor();
(async () => {
  await build({ entryPoints: ['lib/grammar/content.ts'], outfile: 'work/refactor-grammar-content.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const lesson = require('../work/refactor-grammar-content.cjs').LESSON_MAP.get('noun');
  const engine = process.env.QA_BROWSER || 'chromium';
  const browser = await launchBrowser({ engine }), checks = [], errors = [];
  let currentPage;
  const out = 'outputs/refactor-boundaries' + (engine === 'chromium' ? '' : '-' + engine); fs.mkdirSync(out, { recursive: true });
  async function setup() {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('refactor_boundaries') });
    const get = async () => (await c.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
    const put = async delta => { const before = await get(); assert.equal((await c.request.put(base + '/api/state', { data: { revision: before.revision, progress: {}, sessions: {}, ...delta } })).status(), 200); };
    const p = await c.newPage(); currentPage = p; p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(() => { window.auditTools = {}; Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool(t) { window.auditTools[t.name] = t; } } }); });
    return { c, p, get, put };
  }
  try {
    const { c, p, get, put } = await setup(), word = words.find(w => w.word === 'work' && w.pos === 'v.'), original = material[word.id];
    await put({ progress: { [word.id]: { meaning: original.meaning, expression: original.expression, expressionTranslation: original.expressionTranslation, example: original.example, translation: original.translation, en: 'independent', ko: 'help', notes: '기존 메모', senses: { '작동하다': { meaning: '작동하다', expression: 'It works.', expressionTranslation: '작동한다', en: 'help' } } } } });
    const before = (await get()).state;
    await p.goto(base); await saved(p); await p.getByRole('tab', { name: '단어장', exact: true }).click();
    await p.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
    const open = () => p.getByRole('button', { name: 'work 동사', exact: true }).click(); await open();
    const dialog = p.getByRole('dialog'), phrase = dialog.getByLabel('함께 익힐 표현', { exact: true }), sense = dialog.getByLabel('학습할 뜻 선택');
    await phrase.fill('work on a new draft'); await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).fill('새 초안을 작성하다');
    await sense.selectOption('작동하다'); const confirm = p.getByRole('alertdialog'); assert.equal(await confirm.count(), 0);
    await phrase.fill('This machine works well.'); await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).fill('이 기계는 잘 작동한다');
    await dialog.getByRole('button', { name: '다른 뜻 추가', exact: true }).click();
    await dialog.getByRole('textbox', { name: '영어 예문', exact: true }).fill('A new example.');
    await sense.selectOption(original.meaning);
    assert.equal(await phrase.inputValue(), 'work on a new draft');
    assert.equal(await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '새 초안을 작성하다');
    assert.equal(await dialog.getByRole('button', { name: '기록 저장', exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: '새 뜻 초안 보기', exact: true }).click();
    assert.equal(await dialog.getByRole('textbox', { name: '영어 예문', exact: true }).inputValue(), 'A new example.');
    await dialog.getByLabel('학습할 뜻', { exact: true }).fill('새 용법');
    await phrase.fill('new usage'); await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).fill('새 표현');
    await sense.selectOption(original.meaning);
    // A Back discard confirmation blocks WebMCP too; a rejected visit must not claim success.
    await dialog.getByRole('heading').click(); await p.waitForTimeout(250);
    await p.evaluate(() => {
      const el = document.querySelector('[role=dialog]'), r = el.getBoundingClientRect(), x = 5, y = Math.min(innerHeight - 40, r.top + 40), target = document.elementFromPoint(x, y);
      const fire = (type, dx) => { const point = { identifier: 1, clientX: x + dx, clientY: y }, event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } }); target.dispatchEvent(event); };
      fire('touchstart', 0); fire('touchmove', 180); fire('touchend', 180);
    });
    await confirm.waitFor();
    const rejected = await p.evaluate(() => window.auditTools.show_learning_view.execute({ view: 'today' }));
    assert.equal(rejected.navigated, false); assert.equal(rejected.view, undefined);
    assert.equal(await p.locator('[role=tab][aria-controls$="content-library"]').getAttribute('aria-selected'), 'true');
    for (const width of [320, 390, 1440]) { await p.setViewportSize({ width, height: 844 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    await p.setViewportSize({ width: 390, height: 844 }); await p.addScriptTag({ path: axePath });
    await confirm.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)); });
    const violations = await p.evaluate(async () => (await axe.run(document)).violations);
    fs.writeFileSync(out + '/accessibility.json', JSON.stringify(violations, null, 2));
    assert.deepEqual(violations.map(v => v.id), []);
    await confirm.getByRole('button', { name: '계속 편집', exact: true }).click();
    assert.equal(await sense.inputValue(), original.meaning); assert.equal(await phrase.inputValue(), 'work on a new draft');
    assert.equal(await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '새 초안을 작성하다');
    // Close protects every cached draft; cancelling leaves all three available.
    await p.keyboard.press('Escape'); await confirm.waitFor();
    await p.waitForFunction(() => !!document.activeElement?.closest('[role="alertdialog"]'));
    await p.keyboard.press('Escape'); await confirm.waitFor({ state: 'hidden' }); assert.equal(await phrase.inputValue(), 'work on a new draft');
    // A failed optimistic save must preserve new-sense identity and allow an identical retry.
    await p.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '합성 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.' } }) : route.continue());
    await dialog.getByRole('button', { name: '기록 저장', exact: true }).click();
    await dialog.getByText('합성 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.', { exact: true }).waitFor();
    assert.equal(await phrase.inputValue(), 'work on a new draft'); await sense.selectOption('');
    assert.equal(await phrase.inputValue(), 'new usage'); await sense.selectOption(original.meaning);
    await p.unroute('**/api/state');
    await dialog.getByRole('button', { name: '다시 저장', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' }); await saved(p);
    assert.equal((await p.evaluate(() => window.auditTools.show_learning_view.execute({ view: 'today' }))).navigated, true);
    await p.getByRole('tabpanel', { name: '오늘 학습', exact: true }).waitFor({ state: 'visible' });
    await p.reload(); await saved(p); await p.getByRole('tab', { name: '단어장', exact: true }).click(); await p.getByLabel('단어 또는 한국어 뜻 검색').fill('work'); await open();
    assert.equal(await phrase.inputValue(), 'work on a new draft'); await sense.selectOption('작동하다'); assert.equal(await confirm.count(), 0);
    assert.equal(await phrase.inputValue(), 'This machine works well.');
    await sense.selectOption('새 용법'); assert.equal(await phrase.inputValue(), 'new usage');
    await sense.selectOption(original.meaning);
    assert.equal(await phrase.inputValue(), 'work on a new draft');
    const after = (await get()).state; assert.equal(after.progress[word.id].en, before.progress[word.id].en); assert.equal(after.progress[word.id].ko, before.progress[word.id].ko);
    assert.equal(after.progress[word.id].senses['작동하다'].en, before.progress[word.id].senses['작동하다'].en);
    assert.equal(after.progress[word.id].senses['새 용법'].en, 'unmeasured'); assert.deepEqual(after.sessions, before.sessions);
    await sense.selectOption('작동하다'); await phrase.fill('hidden unsaved draft'); await sense.selectOption(original.meaning);
    await p.keyboard.press('Escape'); await confirm.waitFor();
    await confirm.getByRole('button', { name: '계속 편집', exact: true }).click();
    await sense.selectOption('작동하다'); assert.equal(await phrase.inputValue(), 'hidden unsaved draft');
    for (const width of [320, 390, 1440]) {
      await p.setViewportSize({ width, height: 844 }); await dialog.getByRole('heading').click();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.screenshot({ path: out + '/editor-' + width + '.png' });
    }
    checks.push('three sense drafts survive switching, failed save, retry and reload; incomplete hidden drafts block save; grades remain intact');
    checks.push('pending Back confirmation rejects tool navigation truthfully; cancellation preserves drafts and subsequent navigation succeeds');
    await c.close();

    for (const mode of ['tab', 'tool']) {
      const { c, p, get, put } = await setup(), now = new Date().toISOString(), sentence = 'I like books.';
      await put({ grammar: { noun: { stage: 5, answers: Object.fromEntries(lesson.questions.map((q, i) => ['q' + (i + 1), { first: q.answer, latest: q.answer, helped: false, attempts: 1 }])), sentence, updatedAt: now } } });
      await p.goto(base); await saved(p); await p.getByRole('tab', { name: '단어장', exact: true }).click(); await p.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click(); await p.locator('.grammar-tile').first().click();
      let release, requested; const hold = new Promise(r => release = r), called = new Promise(r => requested = r);
      await p.route('**/api/grammar-feedback', async route => { requested(); await hold; await route.fulfill({ json: { feedback: { original: sentence, correctedSentence: sentence, explanation: '합성 응답', meaningUsage: 'appropriate', grammar: 'natural', model: 'gemini-3.1-flash-lite', createdAt: now } } }).catch(() => {}); });
      try {
        await p.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click(); await called;
        if (mode === 'tab') await p.getByRole('tab', { name: '오늘 학습', exact: true }).click();
        else assert.equal((await p.evaluate(() => window.auditTools.show_learning_view.execute({ view: 'today' }))).navigated, true);
        await p.getByRole('tabpanel', { name: '오늘 학습', exact: true }).waitFor({ state: 'visible' }); release(); await p.waitForTimeout(800);
        assert.equal((await get()).state.grammar.noun.feedback, undefined);
        // Both entry points must also remain on the current view after a failed draft flush.
        await p.getByRole('tab', { name: '단어장', exact: true }).click();
        await p.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '합성 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.' } }) : route.continue());
        await p.getByRole('textbox', { name: '내 문장', exact: true }).fill('I like coffee.');
        if (mode === 'tab') await p.getByRole('tab', { name: '오늘 학습', exact: true }).click();
        else assert.equal((await p.evaluate(() => window.auditTools.show_learning_view.execute({ view: 'today' }))).navigated, false);
        await p.getByText('합성 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.', { exact: true }).waitFor();
        assert.equal(await p.getByRole('tab', { name: '단어장', exact: true }).getAttribute('aria-selected'), 'true');
        assert.equal(await p.getByRole('textbox', { name: '내 문장', exact: true }).inputValue(), 'I like coffee.');
        checks.push(mode + ': late AI discarded; failed persistence blocks navigation and preserves the draft');
      } finally { release(); await c.close(); }
    }
    assert.deepEqual(errors, []); fs.writeFileSync(out + '/result.json', JSON.stringify({ passed: true, checks, errors }, null, 2)); console.log(JSON.stringify({ passed: true, checks }));
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      await currentPage.screenshot({ path: out + '/failure.png', fullPage: true });
      fs.writeFileSync(out + '/failure.json', JSON.stringify(await currentPage.evaluate(() => ({
        focus: document.activeElement?.outerHTML, dialogCount: document.querySelectorAll('[role=dialog]').length,
        labels: [...document.querySelectorAll('textarea')].map(el => ({ labels: [...el.labels].map(l => l.textContent), hidden: !!el.closest('[aria-hidden=true]') })),
        dialogs: [...document.querySelectorAll('[role=alertdialog]')].map(el => ({ text: el.textContent, state: el.getAttribute('data-state') }))
      })), null, 2));
    }
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
