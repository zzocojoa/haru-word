// Loopback-only synthetic learners; this suite never calls the AI provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath } = require('./qa/runtime.cjs');

(async () => {
  await build({ entryPoints: ['lib/grammar/content.ts'], outfile: 'work/grammar-ui-content.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { LESSON_MAP } = require('../work/grammar-ui-content.cjs');
  const browser = await launchBrowser(), now = new Date().toISOString(), errors = [], checks = [];
  fs.mkdirSync('outputs/grammar-ui', { recursive: true });
  const progress = (id, stage) => ({ stage, sentence: stage >= 5 ? LESSON_MAP.get(id).stem : '', updatedAt: now,
    answers: Object.fromEntries(LESSON_MAP.get(id).questions.slice(0, Math.max(0, stage - 2)).map((q, i) => [`q${i + 1}`, { first: q.answer, latest: q.answer, attempts: 1, helped: false }])),
    ...(stage >= 5 ? { check: 'appropriate' } : {}), ...(stage === 6 ? { completedAt: now } : {}) });
  async function open(grammar) {
    const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('grammar_ui'), viewport: { width: 390, height: 844 } });
    const get = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
    const before = await get();
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: before.revision, grammar, progress: {}, sessions: {} } })).status(), 200);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await page.getByRole('tab', { name: '품사·문장 연습', exact: true }).click();
    return { context, page, get };
  }
  async function layout(page, label, widths = [320, 390, 768, 1440]) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const scale of [100, 200]) {
        await page.evaluate(n => document.documentElement.style.fontSize = `${n}%`, scale);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${label} overflow ${width}/${scale}`);
        const clipped = await page.locator('.grammar-catalog, .grammar-lesson').evaluateAll(roots => roots.flatMap(root => [...root.querySelectorAll('button, p, h2, h3, label, li, .grammar-example')].filter(el => el.clientWidth && el.scrollWidth > el.clientWidth + 2).map(el => el.className)));
        assert.deepEqual(clipped, [], `${label} internal overflow ${width}/${scale}`);
      }
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '100%');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], label + ' accessibility');
    await page.screenshot({ path: `outputs/grammar-ui/${label}-mobile.png`, fullPage: true });
    checks.push(`${label}: 320–1440px, 200% text, axe`);
  }
  try {
    const noun = progress('noun', 2); noun.answers.q1 = { first: 'reads', latest: 'reads', attempts: 1, helped: false };
    const auxiliary = { ...progress('auxiliary', 6), review: { index: 0, answers: {} } };
    const modal = progress('modal', 6); modal.answers.q1.helped = true;
    const { context, page, get } = await open({ noun, verb: progress('verb', 6), adjective: progress('adjective', 5), auxiliary, modal });
    const before = await get(), filters = page.getByRole('group', { name: '수업 표시' });
    assert.equal(await page.locator('.grammar-tile').count(), 15);
    await layout(page, 'catalog');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'outputs/grammar-ui/catalog-desktop.png', fullPage: true });
    await filters.getByRole('button', { name: /^이어 하기\s*3$/ }).click();
    assert.equal(await page.locator('.grammar-tile').count(), 3);
    await filters.getByRole('button', { name: /^다시 확인\s*3$/ }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.grammar-tile').count(), 3);
    assert.match(await filters.getByRole('button', { pressed: true }).innerText(), /^다시 확인\s*3$/);
    assert.deepEqual((await get()).state, before.state, 'display filters never mutate stored learning');
    await page.locator('.grammar-tile').first().click();
    await page.getByRole('button', { name: '수업 목록', exact: true }).click();
    assert.match(await filters.getByRole('button', { pressed: true }).innerText(), /^다시 확인\s*3$/, 'return from lesson preserves catalog filter');
    await filters.getByRole('button', { name: /^전체\s*15$/ }).click();
    await page.locator('.grammar-tile').first().click();
    assert.match(await page.locator('.grammar-stepper [aria-current=step]').innerText(), /연습하기/);
    assert.equal(await page.locator('.grammar-feedback').getAttribute('data-tone'), 'review');
    await page.getByRole('button', { name: 'teacher', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '답 확인', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'teacher', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.grammar-feedback').getAttribute('data-tone'), 'success');
    assert.match(await page.locator('.grammar-feedback').innerText(), /처음엔 오답/);
    await layout(page, 'feedback');
    await context.close();
    checks.push('status filters, keyboard selection, feedback and stored results remain consistent');
    const empty = await open({});
    await empty.page.getByRole('group', { name: '수업 표시' }).getByRole('button', { name: /^이어 하기\s*0$/ }).click();
    assert.equal(await empty.page.locator('.grammar-tile').count(), 0);
    await empty.page.getByRole('button', { name: '전체 수업 보기', exact: true }).click();
    assert.equal(await empty.page.locator('.grammar-tile').count(), 15);
    assert.equal(await empty.page.getByRole('group', { name: '수업 표시' }).getByRole('button', { pressed: true }).evaluate(el => el === document.activeElement), true);
    await empty.context.close();
    checks.push('empty filter provides a route back to all lessons');
    for (const stage of [0, 1, 3, 4, 5, 6]) {
      const screen = await open({ noun: progress('noun', stage) });
      await screen.page.locator('.grammar-tile').first().click();
      await layout(screen.page, `stage-${stage}`);
      await screen.context.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
    fs.writeFileSync('outputs/grammar-ui/results.json', JSON.stringify({ passed: true, checks }, null, 2));
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exit(1); });

