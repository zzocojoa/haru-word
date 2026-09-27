// Local synthetic accounts; provider replies are mocked. Never invokes a paid API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { launchBrowser, closeBrowser, base, accountHeaders, axePath } = require('./qa/runtime.cjs');
const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const material = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const saved = p => p.getByText('서버에 저장됨', { exact: true }).waitFor();
(async () => {
  await build({ entryPoints: ['lib/grammar/content.ts'], outfile: 'work/refactor-grammar-content.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const lesson = require('../work/refactor-grammar-content.cjs').LESSON_MAP.get('noun');
  const engine = process.env.QA_BROWSER || 'chromium';
  const browser = await launchBrowser({ engine }), checks = [], errors = [];
  let currentPage;
  const out = 'outputs/refactor-boundaries' + (engine === 'chromium' ? '' : '-' + engine); fs.mkdirSync(out, { recursive: true });
  async function setup() {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('refactor_boundaries') });
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
    await p.goto(base); await saved(p); await p.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await p.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
    const open = () => p.getByRole('button', { name: 'work 동사', exact: true }).click(); await open();
    const dialog = p.getByRole('dialog'), phrase = dialog.getByLabel('함께 익힐 표현', { exact: true }), sense = dialog.getByLabel('학습할 뜻 선택');
    await phrase.fill('work on a new draft'); await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).fill('새 초안을 작성하다');
    await sense.selectOption('작동하다'); const confirm = p.getByRole('alertdialog'); await confirm.waitFor();
    for (const width of [320, 390, 1440]) { await p.setViewportSize({ width, height: 844 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    await p.setViewportSize({ width: 390, height: 844 }); await p.addScriptTag({ path: axePath });
    await confirm.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)); });
    const violations = await p.evaluate(async () => (await axe.run(document)).violations);
    fs.writeFileSync(out + '/accessibility.json', JSON.stringify(violations, null, 2));
    assert.deepEqual(violations.map(v => v.id), []);
    await confirm.getByRole('button', { name: '계속 편집', exact: true }).click();
    assert.equal(await sense.inputValue(), original.meaning); assert.equal(await phrase.inputValue(), 'work on a new draft');
    assert.equal(await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '새 초안을 작성하다');
    await dialog.getByRole('button', { name: '다른 뜻 추가', exact: true }).click(); await confirm.waitFor();
    await p.waitForFunction(() => !!document.activeElement?.closest('[role="alertdialog"]'));
    await p.keyboard.press('Escape'); await confirm.waitFor({ state: 'hidden' }); assert.equal(await phrase.inputValue(), 'work on a new draft');
    await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); await saved(p);
    await p.reload(); await saved(p); await p.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await p.getByLabel('단어 또는 한국어 뜻 검색').fill('work'); await open();
    assert.equal(await phrase.inputValue(), 'work on a new draft'); await sense.selectOption('작동하다'); assert.equal(await confirm.count(), 0);
    await phrase.fill('discard this only'); await sense.selectOption(original.meaning); await confirm.getByRole('button', { name: '변경 버리고 전환', exact: true }).click();
    assert.equal(await phrase.inputValue(), 'work on a new draft');
    const after = (await get()).state; assert.equal(after.progress[word.id].en, before.progress[word.id].en); assert.equal(after.progress[word.id].ko, before.progress[word.id].ko);
    assert.deepEqual(after.progress[word.id].senses['작동하다'], before.progress[word.id].senses['작동하다']); assert.deepEqual(after.sessions, before.sessions);
    checks.push('sense switch and new-sense actions preserve unsaved input until explicit discard; cancel/Escape/save/reconnect preserve translations and grades');
    await c.close();

    for (const mode of ['tab', 'tool']) {
      const { c, p, get, put } = await setup(), now = new Date().toISOString(), sentence = 'I like books.';
      await put({ grammar: { noun: { stage: 5, answers: Object.fromEntries(lesson.questions.map((q, i) => ['q' + (i + 1), { first: q.answer, latest: q.answer, helped: false, attempts: 1 }])), sentence, updatedAt: now } } });
      await p.goto(base); await saved(p); await p.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await p.getByRole('tab', { name: '품사·문장 연습', exact: true }).click(); await p.locator('.grammar-tile').first().click();
      let release, requested; const hold = new Promise(r => release = r), called = new Promise(r => requested = r);
      await p.route('**/api/grammar-feedback', async route => { requested(); await hold; await route.fulfill({ json: { feedback: { original: sentence, correctedSentence: sentence, explanation: '합성 응답', meaningUsage: 'appropriate', grammar: 'natural', model: 'gemini-3.1-flash-lite', createdAt: now } } }).catch(() => {}); });
      try {
        await p.getByRole('button', { name: 'AI로 문장 점검', exact: true }).click(); await called;
        if (mode === 'tab') await p.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
        else assert.equal((await p.evaluate(() => window.auditTools.show_learning_view.execute({ view: 'today' }))).navigated, true);
        await p.getByRole('tabpanel', { name: '오늘의 학습', exact: true }).waitFor({ state: 'visible' }); release(); await p.waitForTimeout(800);
        assert.equal((await get()).state.grammar.noun.feedback, undefined);
        // Both entry points must also remain on the current view after a failed draft flush.
        await p.getByRole('tab', { name: '전체 단어장', exact: true }).click();
        await p.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '합성 저장 실패' } }) : route.continue());
        await p.getByRole('textbox', { name: '내 문장', exact: true }).fill('I like coffee.');
        if (mode === 'tab') await p.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
        else assert.equal((await p.evaluate(() => window.auditTools.show_learning_view.execute({ view: 'today' }))).navigated, false);
        await p.getByText('합성 저장 실패', { exact: true }).waitFor();
        assert.equal(await p.getByRole('tab', { name: '전체 단어장', exact: true }).getAttribute('aria-selected'), 'true');
        assert.equal(await p.getByRole('textbox', { name: '내 문장', exact: true }).inputValue(), 'I like coffee.');
        checks.push(mode + ': late AI discarded; failed persistence blocks navigation and preserves the draft');
      } finally { release(); await c.close(); }
    }
    assert.deepEqual(errors, []); fs.writeFileSync(out + '/result.json', JSON.stringify({ passed: true, checks, errors }, null, 2)); console.log(JSON.stringify({ passed: true, checks }));
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      await currentPage.screenshot({ path: out + '/failure.png', fullPage: true });
      fs.writeFileSync(out + '/failure.json', JSON.stringify(await currentPage.evaluate(() => ({
        focus: document.activeElement?.outerHTML, dialogs: [...document.querySelectorAll('[role=alertdialog]')].map(el => ({ text: el.textContent, state: el.getAttribute('data-state') }))
      })), null, 2));
    }
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
