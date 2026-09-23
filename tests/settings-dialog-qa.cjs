// Built local Worker only; synthetic account, no production or Google writes.
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8787', out = 'outputs/settings-dialog';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch(), checks = [], errors = [], audits = [];
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: { 'oai-authenticated-user-id': 'settings_dialog_' + Date.now(), 'oai-authenticated-user-email': 'qa@example.test' } });
    const get = async () => (await c.request.get(base + '/api/state')).json();
    const initial = await get(), words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
    const w = words.find(w => w.word === 'arrive' && w.pos === 'v.'), date = '2026-09-01', sid = crypto.randomUUID();
    const session = { id: sid, kind: 'daily', date, period: date, ids: [w.id], warmupIds: [], stage: 'done', index: 0, retry: [], retryMode: false, elapsed: 300, paused: true, finished: true, createdAt: date + 'T01:00:00Z', records: { [w.id]: { entryId: w.id, meaning: content[w.id].meaning, material: content[w.id], en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'I arrive home at six.', notes: '', learnedOn: date } } };
    const state = { ...initial.state, sessions: { [sid]: session } };
    const restore = await c.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(initial.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(restore.status(), 200, await restore.text());
    const preserved = await get(), p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    let clockMode = 'ready', heldClock, saveMode = 'ready', heldSave;
    await p.route('**/api/study-clock', r => {
      if (clockMode === 'hold') { heldClock = r; return; }
      if (clockMode === 'fail') return r.fulfill({ status: 503, json: { error: 'temporary failure' } });
      return r.continue();
    });
    await p.route('**/api/state', r => {
      if (r.request().method() !== 'PUT' || saveMode === 'ready') return r.continue();
      if (saveMode === 'hold') { heldSave = r; return; }
      return r.fulfill({ status: 503, json: { error: 'temporary failure' } });
    });
    await p.goto(base, { waitUntil: 'domcontentloaded' }); await p.getByText('서버에 저장됨', { exact: true }).waitFor();
    await p.getByRole('button', { name: '학습 설정', exact: true }).click();
    const d = p.getByRole('dialog'), body = d.locator('.dialog-scroll'), goal = d.getByRole('combobox', { name: '하루 목표', exact: true });
    const enabled = async () => { await p.waitForFunction(() => { const el = document.querySelector('.settings-dialog [aria-label="하루 목표"]'); return el && !el.disabled; }); assert.ok(await goal.isEnabled()); };
    const axe = async label => { await p.addScriptTag({ path: 'work/axe/package/axe.min.js' }); const issues = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))); audits.push({ label, issues }); assert.deepEqual(issues, [], label); };
    await enabled();
    for (const width of [320, 390, 430, 768, 1440]) {
      await p.setViewportSize({ width, height: 844 });
      for (const font of [100, 200]) {
        const style = await p.addStyleTag({ content: `html{font-size:${font}% !important}` });
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await d.evaluate(el => el.scrollWidth > el.clientWidth), false, `${width}/${font} dialog overflow`);
        const layout = await body.evaluate(el => {
          const rows = [...el.children].filter(x => x.tagName === 'LABEL').map(x => x.getBoundingClientRect());
          return { gap: getComputedStyle(el).gap, gaps: rows.slice(1).map((r, i) => r.top - rows[i].bottom), small: [...el.querySelectorAll('button,summary,a')].filter(x => { const r = x.getBoundingClientRect(); return r.height && (r.height < 44 || r.width < 44); }).map(x => x.textContent) };
        });
        assert.ok(layout.gaps.every(g => g >= 15.9), JSON.stringify(layout)); assert.deepEqual(layout.small, []);
        await body.evaluate(el => el.scrollTop = 5000);
        const close = await d.getByRole('button', { name: 'Close', exact: true }).boundingBox(), header = await d.locator('[data-slot=dialog-header]').boundingBox();
        assert.ok(close.y >= 0 && close.y + close.height <= 844 && header.y >= 0);
        await body.evaluate(el => el.scrollTop = 0); await style.evaluate(el => el.remove());
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    const overlay = await p.locator('[data-slot=dialog-overlay]').evaluate(el => getComputedStyle(el).backgroundColor);
    assert.match(overlay, /rgba\(.+, 0\.48\)/);
    await axe('ready'); await p.screenshot({ path: out + '/ready-mobile.png' });
    checks.push('five widths × 100/200% text: translucent overlay, separated rows, 44px controls and fixed close/header');
    clockMode = 'hold'; const clockRequest = p.waitForRequest('**/api/study-clock'); await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await clockRequest;
    await d.getByRole('status').filter({ hasText: '한국 시간을 확인하고 있어요' }).waitFor(); assert.ok(await goal.isDisabled());
    await heldClock.fulfill({ status: 503, json: { error: 'temporary failure' } });
    await d.getByRole('button', { name: '시간 다시 확인', exact: true }).waitFor();
    await axe('clock failure'); await p.screenshot({ path: out + '/clock-error-mobile.png' });
    clockMode = 'ready'; await d.getByRole('button', { name: '시간 다시 확인', exact: true }).click();
    await d.getByRole('button', { name: '시간 다시 확인', exact: true }).waitFor({ state: 'hidden' }); await enabled();
    checks.push('clock wait/failure is visible inside the modal; retry unlocks settings without closing or reloading');
    saveMode = 'hold'; await goal.click(); await p.getByRole('option', { name: '10개', exact: true }).click();
    await d.getByRole('status').filter({ hasText: '변경한 설정을 저장하고 있어요' }).waitFor(); assert.ok(await goal.isDisabled());
    await heldSave.fulfill({ status: 503, json: { error: 'temporary failure' } });
    await d.getByRole('button', { name: '다시 시도', exact: true }).waitFor(); assert.ok(await goal.isDisabled());
    assert.equal(await p.locator('.error-banner').count(), 1);
    await axe('save failure');
    saveMode = 'ready'; await d.getByRole('button', { name: '다시 시도', exact: true }).click(); await d.getByRole('alert').waitFor({ state: 'hidden' }); await enabled();
    assert.equal((await get()).state.settings.dailyGoal, 10);
    checks.push('save pending/error/retry stays in the dialog, no duplicate error banner, goal 10 persists');
    const remote = await get();
    const changed = await c.request.put(base + '/api/state', { data: { revision: remote.revision, settings: { ...remote.state.settings, reviewDay: 4 }, progress: {}, sessions: {} } }); assert.equal(changed.status(), 200, await changed.text());
    await goal.click(); await p.getByRole('option', { name: '9개', exact: true }).click();
    await d.getByRole('alert').filter({ hasText: '다른 기기' }).waitFor(); assert.ok(await goal.isDisabled());
    const backup = p.waitForEvent('download'); await d.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
    const pending = JSON.parse(fs.readFileSync(await (await backup).path(), 'utf8')); assert.equal(pending.settings.dailyGoal, 9); assert.deepEqual(pending.sessions, preserved.state.sessions);
    await d.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).click(); assert.ok(await goal.isDisabled());
    await d.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await d.getByRole('alert').waitFor({ state: 'hidden' }); await enabled();
    assert.match(await goal.innerText(), /10/); assert.deepEqual((await get()).state.sessions, preserved.state.sessions);
    await d.getByRole('button', { name: 'Close', exact: true }).click(); await p.reload({ waitUntil: 'domcontentloaded' }); await p.getByText('서버에 저장됨', { exact: true }).waitFor();
    await p.getByRole('button', { name: '학습 설정', exact: true }).click(); await enabled(); assert.match(await goal.innerText(), /10/);
    assert.deepEqual((await get()).state.sessions, preserved.state.sessions); assert.deepEqual(errors, []);
    checks.push('conflict backup/cancel/explicit reload preserve historical scores and remote settings across reconnect');
    fs.writeFileSync(out + '/result.json', JSON.stringify({ passed: true, checks, audits, errors }, null, 2)); console.log(JSON.stringify({ passed: true, checks }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
