// Local synthetic accounts only. No real learner data or AI requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath } = require('./qa/runtime.cjs');

(async () => {
  const version = process.env.QA_GRAMMAR_VERSION === '3' ? 3 : 2;
  await build({ entryPoints: ['lib/grammar/content-v3.ts', 'lib/grammar/content-v2.ts', 'lib/grammar/content.ts'], outdir: 'work/grammar-v2-qa', bundle: true, platform: 'node', format: 'cjs', outExtension: { '.js': '.cjs' }, logLevel: 'silent' });
  const PRACTICE_LESSONS = version === 3 ? require('../work/grammar-v2-qa/content-v3.cjs').PRACTICE_LESSONS_V3 : require('../work/grammar-v2-qa/content-v2.cjs').PRACTICE_LESSONS;
  const { GRAMMAR_LESSONS } = require('../work/grammar-v2-qa/content.cjs');
  const browser = await launchBrowser({ engine: process.env.QA_ENGINE || 'chromium' });
  const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('grammar_v2'), viewport: { width: 390, height: 844 }, ...(process.env.QA_ENGINE === 'webkit' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/grammar-feedback', route => route.fulfill({ status: 429, json: { code: 'provider_limit', provider: 'google', error: '테스트 한도' } }));
  const snapshot = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': String(version) } })).json();
  const until = async fn => { for (let i = 0; i < 100; i++) { if (await fn()) return; await page.waitForTimeout(100); } throw Error('save timeout'); };
  const click = name => page.getByRole('button', { name, exact: true }).click();
  async function solve(q) {
    if (q.kind === 'choice') { await click(q.answer); await click('답 확인'); assert.equal(await page.getByRole('button', { name: '답 확인', exact: true }).isDisabled(), true); }
    else {
      for (const word of (q.orderFormat ? q.answer.replace(/[.!?]+$/, '') : q.answer).split(' ')) { const token = q.orderFormat ? q.options.find(t => t.toLowerCase() === word.toLowerCase()) : word; await page.locator('.grammar-options button:not([disabled])').filter({ hasText: new RegExp('^' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click(); }
      await click('정답 확인');
      assert.equal(await page.getByRole('button', { name: '정답 확인', exact: true }).isDisabled(), true);
    }
    await click('다음');
  }
  fs.mkdirSync('outputs/grammar-v2', { recursive: true });
  try {
    await page.goto(base); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await page.getByRole('tab', { name: '품사·문장 연습', exact: true }).click();
    const initial = await snapshot();
    for (const lesson of GRAMMAR_LESSONS) {
      const l = PRACTICE_LESSONS[lesson.id];
      const group = page.locator('.grammar-group').filter({ has: page.locator('h3', { hasText: lesson.group }) });
      if (!await group.getAttribute('open').then(v => v !== null)) await group.locator('summary').click();
      await page.locator('.grammar-tile').filter({ has: page.locator('b', { hasText: new RegExp('^' + lesson.title + '$') }) }).click();
      assert.equal(await page.locator('.grammar-reading-translation').count(), 0);
      assert.equal(await page.getByRole('button', { name: '역할 알아보기', exact: true }).isDisabled(), true);
      assert.equal(await page.locator('.grammar-inline-role').count(), 0);
      if (lesson.id === 'noun') {
        const word = page.getByRole('button', { name: 'friend 뜻과 쓰임', exact: true });
        await word.click(); await page.getByRole('dialog', { name: 'friend 뜻과 쓰임' }).waitFor();
        await page.keyboard.press('Escape'); await until(() => word.evaluate(el => el === document.activeElement));
        await word.click(); await click('뜻풀이 닫기'); await until(() => word.evaluate(el => el === document.activeElement));
        await word.click(); await page.getByRole('button', { name: 'shop 뜻과 쓰임', exact: true }).click();
        await page.getByRole('dialog', { name: 'shop 뜻과 쓰임' }).waitFor();
        await until(async () => await page.locator('.grammar-gloss').count() === 1);
        await click('뜻풀이 닫기');
        await word.click(); await page.locator('h2').last().click(); await page.locator('.grammar-gloss').waitFor({ state: 'detached' });
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 }); await word.click();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `reading overflow ${width}`);
          const box = await page.locator('.grammar-gloss').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
          await page.waitForFunction(() => getComputedStyle(document.querySelector('.grammar-gloss')).opacity === '1');
          if (width === 320) {
            const swipe = await page.locator('.grammar-gloss').evaluate(el => {
              const y = el.getBoundingClientRect().top + 100;
              let prevented = false;
              for (const [type, x] of [['touchstart', 20], ['touchmove', 200], ['touchend', 200]]) {
                const event = new Event(type, { bubbles: true, cancelable: true }), point = { identifier: 9, clientX: x, clientY: y };
                Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
                el.dispatchEvent(event); if (type === 'touchstart') prevented = event.defaultPrevented;
              }
              return { prevented, moving: document.documentElement.hasAttribute('data-swiping'), transform: el.style.transform };
            });
            assert.deepEqual(swipe, { prevented: true, moving: false, transform: '' }, 'gloss gestures must not navigate away');
          }
          await page.screenshot({ path: `outputs/grammar-v2/popover-${process.env.QA_ENGINE || 'chromium'}-${width}.png`, fullPage: true });
          await click('뜻풀이 닫기');
        }
        await page.setViewportSize({ width: 320, height: 900 });
        const readingZoom = await page.addStyleTag({ content: 'html{font-size:200%!important}' });
        await word.focus(); await page.keyboard.press('Enter');
        const zoomBox = await page.locator('.grammar-gloss').boundingBox();
        assert.ok(zoomBox.x >= 0 && zoomBox.x + zoomBox.width <= 321, '200% reading gloss fits');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.keyboard.press('Escape'); await until(() => word.evaluate(el => el === document.activeElement));
        await page.screenshot({ path: `outputs/grammar-v2/reading-${process.env.QA_ENGINE || 'chromium'}-200.png`, fullPage: true });
        await readingZoom.evaluate(el => el.remove());
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addScriptTag({ path: axePath });
        await word.click();
        const glossViolations = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations);
        assert.deepEqual(glossViolations.map(v => v.id), []);
        await click('뜻풀이 닫기');
        await click('한국어 해석'); assert.equal(await page.locator('.grammar-reading-translation').count(), 2);
        await click('일하는 행동');
        assert.equal(await page.locator('.grammar-feedback').count(), 0, 'selection is not a submission');
        await click('답 확인');
        assert.equal(await page.locator('.grammar-feedback').getByText(l.observation.wrong['일하는 행동'], { exact: true }).count(), 1);
      }
      await click(l.observation.answer); await click('답 확인');
      assert.equal(await page.getByRole('button', { name: '답 확인', exact: true }).isDisabled(), true);
      if (lesson.id === 'verb') {
        await until(async () => !!(await snapshot()).state.grammar.verb?.observation);
        const beforeHelp = (await snapshot()).state.grammar.verb.observation;
        await page.getByRole('button', { name: 'knows 뜻과 쓰임', exact: true }).click(); await click('뜻풀이 닫기'); await click('한국어 해석');
        await page.waitForTimeout(650);
        assert.deepEqual((await snapshot()).state.grammar.verb.observation, beforeHelp);
        assert.equal(beforeHelp.helped, false); assert.equal(beforeHelp.attempts, 1);
      }
      assert.ok(await page.locator('.grammar-inline-role').count());
      await click('역할 알아보기'); await click('3문제 연습');
      for (const q of l.questions) await solve(q);
      const writing = page.getByRole('textbox', { name: '내 문장', exact: true });
      await click('이 문장으로 시작'); assert.ok((await writing.inputValue()).length);
      if (lesson.id === 'noun') {
        await writing.fill('I like coffee and books.');
        await page.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click(); await page.locator('[data-feedback-code]').waitFor();
        assert.equal(await writing.inputValue(), 'I like coffee and books.');
      }
      await page.locator('.grammar-self-checks fieldset').nth(0).getByLabel('확인했어요', { exact: true }).check();
      assert.equal(await page.getByRole('button', { name: '수업 마치기', exact: true }).isDisabled(), true);
      await page.locator('.grammar-self-checks fieldset').nth(1).getByLabel('확인했어요', { exact: true }).check();
      await click('수업 마치기'); await until(async () => !!(await snapshot()).state.grammar[lesson.id]?.completedAt);
      for (const bank of ['a', 'b']) {
        await click('다른 3문제로 확인');
        for (const q of l.reviews[bank]) await solve(q);
        await until(async () => (await snapshot()).state.grammar[lesson.id].schedule.used[bank] === 1);
      }
      if (lesson.id === 'noun') {
        const p = (await snapshot()).state.grammar.noun;
        assert.equal(p.observation.first, '일하는 행동'); assert.equal(p.observation.helped, true); assert.equal(p.schedule.passed, 0);
        await click('내 문장 보완');
        for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); }
        await page.setViewportSize({ width: 320, height: 900 }); const style = await page.addStyleTag({ content: 'html{font-size:200%!important}' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.addScriptTag({ path: axePath }); const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations);
        assert.deepEqual(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
        await page.screenshot({ path: `outputs/grammar-v2/writing-${process.env.QA_ENGINE || 'chromium'}-200.png`, fullPage: true });
        await style.evaluate(el => el.remove()); await page.setViewportSize({ width: 390, height: 844 });
        await click('수업 마치기');
      }
      await click('수업 목록');
      console.log('PASS v' + version + ' flow ' + lesson.id);
    }
    const result = await snapshot(); assert.equal(Object.keys(result.state.grammar).length, 15);
    for(const p of Object.values(result.state.grammar))assert.equal(p.contentVersion,version);
    for (const key of ['settings', 'progress', 'sessions']) assert.deepEqual(result.state[key], initial.state[key]);
    await page.reload(); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await page.getByRole('tab', { name: '품사·문장 연습', exact: true }).click();
    assert.match(await page.locator('.grammar-catalog-count').innerText(), /15\/15/);
    assert.deepEqual(errors, []); console.log('PASS 15 lessons, 135 problems, persisted drafts, glossary, layout, accessibility and vocabulary invariance');
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
