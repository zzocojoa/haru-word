// Measure separately from functional QA. Synthetic state, no production records or AI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { launchBrowser, closeBrowser, base, accountHeaders } = require('./qa/runtime.cjs');
const { history } = require('./fixtures/backup-history.cjs');
(async () => {
  await build({ entryPoints: ['lib/grammar/content-v2.ts', 'lib/grammar/practice.ts'], outdir: 'work/grammar-input-v2', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const noun = require('../work/grammar-input-v2/content-v2.cjs').PRACTICE_LESSONS.noun;
  const { newLessonProgress } = require('../work/grammar-input-v2/practice.cjs');
  const browser = await launchBrowser(), results = [], errors = [];
  try {
    for (const count of [0, 1825]) for (let sample = 1; sample <= 3; sample++) {
      let state = history(count, 3), revision = 1, writes = 0;
      const original = { settings: state.settings, progress: state.progress, sessions: state.sessions };
      state.grammar = { noun: { ...newLessonProgress('noun'), stage: 5, observation: { first: noun.observation.answer, latest: noun.observation.answer, helped: false, attempts: 1 }, answers: Object.fromEntries(noun.questions.map((q, i) => ['q' + (i + 1), { first: q.answer, latest: q.answer, helped: false, attempts: 1 }])), sentence: 'I like books.' } };
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('grammar_input_perf') });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/state', route => {
        if (route.request().method() === 'PUT') {
          const delta = route.request().postDataJSON();
          assert.deepEqual(delta.progress, {}); assert.deepEqual(delta.sessions, {}); assert.equal(delta.settings, undefined);
          state = { ...state, grammar: { ...state.grammar, ...delta.grammar } }; writes++;
          return route.fulfill({ json: { revision: ++revision } });
        }
        return route.fulfill({ json: { revision, state } });
      });
      await page.goto(base); await page.getByText('저장됨', { exact: true }).waitFor();
      for (const name of ['학습 기록', '복습 점검', '단어장']) await page.getByRole('tab', { name, exact: true }).click();
      await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click(); await page.locator('.grammar-tile').first().click();
      const input = page.getByRole('textbox', { name: '내 문장', exact: true }); await input.waitFor();
      await input.press('ControlOrMeta+End'); // Measure appending at a deterministic caret position.
      const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => { window.longTasks = []; window.observer = new PerformanceObserver(list => window.longTasks.push(...list.getEntries().map(e => Math.round(e.duration)))); window.observer.observe({ type: 'longtask' }); });
      const text = ' I read every day.', started = performance.now(); await input.pressSequentially(text, { delay: 30 });
      const typingMs = Math.round(performance.now() - started);
      for (let attempt = 0; state.grammar.noun.sentence !== 'I like books.' + text && attempt < 100; attempt++) await page.waitForTimeout(100);
      await page.locator('.save-state').getByText('저장됨', { exact: true }).waitFor();
      assert.equal(state.grammar.noun.sentence, 'I like books.' + text); assert.ok(writes);
      assert.deepEqual({ settings: state.settings, progress: state.progress, sessions: state.sessions }, original);
      results.push({ sessions: count, sample, cpuThrottle: 4, characters: text.length, typingMs, longTasksMs: await page.evaluate(() => window.longTasks) });
      await context.close();
    }
    assert.deepEqual(errors, []);
    const report = { passed: true, environment: 'Local Worker, mocked synthetic snapshots, Chromium 390px, 4x CPU slowdown; not an iPhone measurement', results, errors };
    fs.mkdirSync('outputs/grammar-input-performance', { recursive: true }); fs.writeFileSync('outputs/grammar-input-performance/result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
