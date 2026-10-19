// Built local Worker only. No production learner records or external AI calls.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath, waitForWorker } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/ui-continuity-${engine}`;
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const targets = ['work', 'arrive', 'busy', 'breakfast', 'home', 'travel', 'want', 'friend', 'family', 'help'].map(term => words.find(w => w.word === term));
const sample = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
const assessment = { ids: sample, index: 20, marks: Object.fromEntries(sample.map(id => [id, 'uncertain'])), completed: true };
const record = (w, i) => ({ entryId: w.id, meaning: content[w.id].meaning, material: content[w.id], learnedOn: date,
  en: 'independent', ko: 'independent', sentenceStatus: i === 0 ? 'unmeasured' : 'written',
  sentence: i === 0 ? '' : 'This is a saved practice sentence.', notes: i === 0 ? '문장 없이 보완점만 남긴 기록' : '보관된 보완점. '.repeat(50), dailyOrigin: i < 5 ? 'returning' : 'new' });
function session(records, hour) {
  const id = crypto.randomUUID();
  return { id, kind: 'daily', date, period: date, ids: Object.keys(records), records, stage: 'done', index: 0,
    warmupIds: [], retry: [], retryMode: false, elapsed: 600, paused: true, finished: true, createdAt: date + `T0${hour}:00:00Z` };
}
(async () => {
  await waitForWorker();
  const browser = await launchBrowser({ engine }), checks = [], errors = [], layouts = [];
  let p;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('ui_continuity') });
    const get = async () => (await context.request.get(base + '/api/state')).json();
    const initial = await get();
    const first = session(Object.fromEntries(targets.map((w, i) => [w.id, record(w, i)])), 0);
    const alternate = { ...record(targets[0], 0), meaning: '다른 뜻을 구분하는 점검용 풀이', material: { ...content[targets[0].id], meaning: '다른 뜻을 구분하는 점검용 풀이' } };
    const second = session({ [targets[0].id]: alternate }, 1);
    const state = { ...initial.state, settings: { ...initial.state.settings, dailyGoal: 10, assessments: { A1: assessment } }, sessions: { [first.id]: first, [second.id]: second } };
    const response = await context.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(initial.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(response.status(), 200, await response.text());
    p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base); await p.getByText('저장됨', { exact: true }).waitFor();
    const before = await get();
    const tab = name => p.getByRole('tab', { name, exact: true }).click();
    const audit = async label => {
      await p.addScriptTag({ path: axePath });
      assert.deepEqual(await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => v.id)), [], label);
    };
    assert.equal(await p.locator('.daily-origin.new').count(), 5);
    assert.equal(await p.locator('.daily-origin.returning').count(), 5);
    await p.screenshot({ path: `${out}/today-mobile.png`, fullPage: true });
    await p.getByRole('button', { name: '오늘 단어 다시 보기', exact: true }).click();
    const dialog = p.getByRole('dialog'), body = dialog.locator('.dialog-scroll');
    const selector = p.getByRole('combobox', { name: '다시 볼 단어 선택' });
    const savedNote = dialog.locator('.review-my-sentence .muted');
    await savedNote.waitFor();
    assert.equal(await savedNote.innerText(), '보완점 · 문장 없이 보완점만 남긴 기록');
    await selector.click(); assert.equal(await p.getByRole('option').count(), 11);
    assert.match(await p.getByRole('option').first().innerText(), new RegExp(content[targets[0].id].meaning));
    await p.getByRole('option').last().click(); assert.equal(await dialog.locator('.review-meaning').innerText(), alternate.meaning);
    assert.ok(await dialog.getByRole('button', { name: '다음', exact: true }).isDisabled());
    await selector.focus(); await p.keyboard.press('ArrowDown');
    await p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option');
    await p.keyboard.press('Home');
    await p.waitForFunction(() => document.activeElement === document.querySelector('[role=option]'));
    await p.keyboard.press('Enter');
    await dialog.locator('.review-meaning').getByText(first.records[targets[0].id].meaning, { exact: true }).waitFor();
    assert.equal(await dialog.locator('.review-meaning').innerText(), first.records[targets[0].id].meaning);
    for (const width of [320, 390, 430, 768, 1440]) {
      await p.setViewportSize({ width, height: 844 });
      for (const textSize of [100, 200]) {
        await p.evaluate(size => document.documentElement.style.fontSize = `${size}%`, textSize);
        await body.evaluate(el => el.scrollTop = el.scrollHeight);
        const fit = await dialog.evaluate(el => {
          const bounds = el.getBoundingClientRect(), content = el.querySelector('.dialog-scroll').getBoundingClientRect();
          const controls = [...el.querySelectorAll('.replay-controls button,.dialog-actions button')].map(b => b.getBoundingClientRect());
          return { overflow: el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth,
            contentHeight: content.height, controlsVisible: controls.every(r => r.y >= bounds.y && r.bottom <= bounds.bottom && r.height >= 44 && r.width >= 44) };
        });
        layouts.push({ width, textSize, ...fit });
        assert.equal(fit.overflow, false); assert.ok(fit.controlsVisible); assert.ok(fit.contentHeight >= 80, JSON.stringify(layouts.at(-1)));
      }
      await p.evaluate(() => document.documentElement.style.fontSize = '100%');
      await body.evaluate(el => el.scrollTop = 0);
      if ([390, 1440].includes(width)) await p.screenshot({ path: `${out}/replay-${width}.png` });
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await body.evaluate(el => el.scrollTop = el.scrollHeight); assert.ok(await body.evaluate(el => el.scrollTop > 0));
    await dialog.getByRole('button', { name: '다음', exact: true }).click(); assert.equal(await body.evaluate(el => el.scrollTop), 0);
    await selector.click(); await p.screenshot({ path: `${out}/replay-options-mobile.png` }); await audit('word selection');
    await p.keyboard.press('Escape'); await audit('replay'); await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    assert.deepEqual(await get(), before, 'replay, selectors and layout inspection never write grades');
    checks.push('11 cards with distinct same-word meanings, notes without sentence, keyboard selection, fixed controls, scroll reset, 5 widths and 200% text');

    await tab('학습 기록');
    const filter = p.getByRole('combobox', { name: '기록 종류 필터' });
    await filter.click(); await p.getByRole('option', { name: '월말 쓰기', exact: true }).click();
    await p.screenshot({ path: `${out}/history-empty-mobile.png`, fullPage: true }); await audit('filtered empty history');
    await p.getByRole('button', { name: '전체 기록 보기', exact: true }).click();
    assert.equal(await filter.evaluate(el => document.activeElement === el), true);
    assert.equal(await p.locator('.journal-day-trigger').count(), 1);
    assert.deepEqual(await get(), before);
    checks.push('empty history filter returns all records and restores filter focus with no save');

    const empty = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('ui_empty') });
    const blank = await (await empty.request.get(base + '/api/state')).json();
    assert.equal((await empty.request.put(base + '/api/state', { data: { revision: blank.revision,
      settings: { ...blank.state.settings, newWordsPaused: true, assessments: { A1: assessment } }, progress: {}, sessions: {} } })).status(), 200);
    p = await empty.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(base); await p.getByText('저장됨', { exact: true }).waitFor();
    assert.ok(await p.getByRole('button', { name: '지금 배정할 단어가 없어요', exact: true }).isDisabled());
    assert.ok(await p.getByText('배정할 단어가 없어요.', { exact: true }).isVisible());
    await p.getByRole('button', { name: '배정 설정 확인', exact: true }).click(); await p.getByRole('dialog').waitFor(); await p.keyboard.press('Escape');
    assert.ok(await p.getByRole('button', { name: '친숙도 확인', exact: true }).isEnabled());
    await p.screenshot({ path: `${out}/today-empty-mobile.png`, fullPage: true }); await audit('no eligible target');
    await tab('학습 기록'); await p.getByRole('button', { name: '오늘의 학습으로', exact: true }).click();
    assert.equal(await p.getByRole('tab', { name: '오늘 학습', exact: true }).getAttribute('aria-selected'), 'true');
    assert.deepEqual((await (await empty.request.get(base + '/api/state')).json()).state.sessions, {});
    checks.push('no target leads to settings or familiarity; empty log returns home without automatically creating a session');
    await p.getByRole('button', { name: '친숙도 확인', exact: true }).click();
    await p.locator('.familiarity-card').waitFor();
    const reset = await (await empty.request.get(base + '/api/state')).json();
    assert.equal(reset.state.settings.assessments.A1.index, 0);
    assert.equal(reset.state.settings.assessments.A1.completed, false);
    assert.deepEqual(reset.state.sessions, {});
    checks.push('familiarity action opens a fresh unscored assessment through the existing save flow');

    const pending = session({ [targets[1].id]: { ...record(targets[1], 1), sentenceStatus: 'unmeasured', sentence: '' } }, 2);
    Object.assign(pending, { stage: 'sentence', finished: false });
    assert.equal((await empty.request.put(base + '/api/state', { data: { revision: reset.revision,
      settings: { ...reset.state.settings, activeSessionId: pending.id, assessments: { A1: assessment } }, progress: {}, sessions: { [pending.id]: pending } } })).status(), 200);
    await p.reload(); await p.getByText('저장됨', { exact: true }).waitFor();
    await p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
    await p.getByText('저장됨', { exact: true }).waitFor();
    await p.getByLabel('내 영어 문장', { exact: true }).fill('I arrive home at six.');
    await p.route('**/api/state', route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '검사용 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.' }) }) : route.continue());
    await p.getByRole('button', { name: '문장을 완성했어요', exact: false }).click();
    await p.getByRole('heading', { name: '기록 저장을 확인하고 있어요.', exact: true }).waitFor();
    assert.equal(await p.locator('.summary-pending-icon').count(), 1);
    assert.equal((await p.locator('.summary-pending-icon').boundingBox()).height, 48);
    assert.equal(await p.locator('.session-summary .success-icon').count(), 0);
    assert.equal((await (await empty.request.get(base + '/api/state')).json()).state.sessions[pending.id].finished, false);
    await p.screenshot({ path: `${out}/summary-unsaved-mobile.png`, fullPage: true });
    await p.unroute('**/api/state'); await p.getByRole('button', { name: '다시 시도', exact: true }).click();
    await p.getByRole('heading', { name: '학습 기록을 저장했어요', exact: true }).waitFor();
    assert.equal(await p.locator('.session-summary .success-icon').count(), 1);
    assert.equal(await p.locator('.summary-pending-icon').count(), 0);
    checks.push('failed final save retains the sentence, shows a neutral pending icon, and only confirms success after retry');
    assert.deepEqual(errors, []);
    const report = { passed: true, engine, checks, layouts, errors };
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (error) {
    if (p) await p.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
