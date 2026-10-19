// Display help must not change learning data or expose answers during recall.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker, axePath } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/grammar-terms-${engine}`;
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  await waitForWorker(); const browser = await launchBrowser({ engine }); let p;
  try {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const word = words.find(w => w.word === 'arrive' && w.pos === 'v.'); const errors = [];
    for (const stage of ['done', 'learn', 'en', 'ko', 'sentence', 'warmup']) {
      const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, extraHTTPHeaders: accountHeaders('terms'), reducedMotion: 'reduce' });
      const get = async () => (await c.request.get(base + '/api/state')).json();
      const initial = await get(), id = crypto.randomUUID();
      const session = { id, kind: 'daily', date, period: date, ids: [word.id], warmupIds: stage === 'warmup' ? [word.id] : [], stage, index: 0,
        records: { [word.id]: { meaning: content[word.id].meaning, material: content[word.id], en: stage === 'done' ? 'independent' : 'unmeasured', ko: stage === 'done' ? 'independent' : 'unmeasured', sentenceStatus: stage === 'done' ? 'written' : 'unmeasured', sentence: stage === 'done' ? 'I arrive at seven.' : '', notes: '' } }, retry: [], retryMode: false, elapsed: 0, paused: true, finished: stage === 'done', createdAt: new Date().toISOString() };
      assert.equal((await c.request.put(base + '/api/state', { data: { revision: initial.revision, settings: { ...initial.state.settings, dailyGoal: 1, activeSessionId: id }, progress: {}, sessions: { [id]: session } } })).status(), 200);
      p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.goto(base); await p.getByText('저장됨', { exact: true }).waitFor();
      if (stage !== 'done') { await p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await p.locator('.session-panel').waitFor(); }
      // Resuming legitimately restores carryover material. Compare help with the
      // settled resumed state, not the deliberately minimal fixture.
      await p.getByText('저장됨', { exact: true }).waitFor();
      const beforeHelp = await get();
      assert.deepEqual(beforeHelp.state.sessions[id].records, session.records);
      const scope = stage === 'done' ? p.locator('.today-words') : p.locator('.session-panel');
      assert.match(await scope.locator('.pos-label').first().innerText(), /동사\s*\(v\.\)/);
      const help = scope.locator('.grammar-terms');
      if (['en', 'ko', 'warmup'].includes(stage)) {
        assert.equal(await help.count(), 0, 'recall must not gain explanatory example answers');
        assert.equal(await p.locator('.answer-box').count(), 0);
      } else {
        assert.equal(await help.getAttribute('open'), null, 'help begins collapsed');
        await help.locator(':scope > summary').focus(); await p.keyboard.press('Enter');
        assert.equal(await help.getAttribute('open'), '');
        for (const [code, english, korean] of [['S','Subject','주어'],['V','Verb','동사'],['O','Object','목적어'],['C','Complement','보어']]) {
          const term = help.locator('.grammar-term-list > div').filter({ hasText: english });
          assert.equal(await term.count(), 1); assert.match(await term.innerText(), new RegExp(`${code}.*${korean}`));
        }
        assert.match(await help.innerText(), /명사\(n\.\).*목적어\(O\)/s);
        assert.equal(await help.locator('p b').first().evaluate(el => getComputedStyle(el).fontSize === getComputedStyle(el.parentElement).fontSize), true, 'word heading sizes must not leak into helper emphasis');
        if (stage !== 'done') assert.match(await help.locator('.grammar-current-term').innerText(), /verb \(v\.\)/);
        await help.getByText('품사 표기 15개', { exact: true }).click();
        const rows = help.locator('.grammar-pos-list > div'); assert.equal(await rows.count(), 15);
        for (const code of new Set(words.map(w => w.pos))) assert.equal(await rows.locator('dd > span:first-child').filter({ hasText: new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).count(), 1);
        await help.getByText('M과 수식어', { exact: true }).click();
        if (stage === 'done') {
          for (const width of [320, 390, 430, 768, 1440]) for (const size of [100, 200]) {
            await p.setViewportSize({ width, height: 844 }); await p.evaluate(size => document.documentElement.style.fontSize = size + '%', size);
            assert.equal(await help.evaluate(el => el.scrollWidth > el.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth), false, `${width}px ${size}%`);
          }
          await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => document.documentElement.style.fontSize = '100%');
          await p.addScriptTag({ path: axePath }); assert.deepEqual(await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa'] })).violations.map(v => v.id)), []);
          await help.getByText('품사 표기 15개', { exact: true }).click(); await help.getByText('M과 수식어', { exact: true }).click();
          await help.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 72)); await p.screenshot({ path: `${out}/mobile-guide.png` });
          await p.getByRole('button', { name: '오늘 단어 다시 보기', exact: true }).click();
          const replay = p.getByRole('dialog'); assert.match(await replay.locator('.pos-label').innerText(), /동사\s*\(v\.\)/);
          await replay.locator('.grammar-terms > summary').click(); assert.match(await replay.innerText(), /Subject/);
          await p.keyboard.press('Escape'); await replay.waitFor({ state: 'hidden' });
        }
      }
      const after = await get(); assert.deepEqual(after.state.progress, beforeHelp.state.progress); assert.deepEqual(after.state.sessions[id].records, session.records);
      assert.deepEqual(after.state.sessions[id].ids, session.ids); assert.equal(after.state.settings.dailyGoal, 1);
      if (stage === 'done') assert.equal(after.revision, beforeHelp.revision, 'reading help/replay must not save');
      await c.close();
    }
    assert.deepEqual(errors, []);
    const report = { passed: true, engine, checks: ['six daily states and completed replay', 'S/V/O/C meanings and all 15 Oxford codes', 'optional help and keyboard toggling; recall answers hidden', '5 widths/200% text and axe; goals, records, grades unchanged'] };
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (e) { if (p && !p.isClosed()) await p.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw e; }
  finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
