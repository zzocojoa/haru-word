// Local UI verification. Uses the real feedback component and a synthetic account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { launchBrowser, closeBrowser, accountHeaders, base, waitForWorker, axePath } = require('./qa/runtime.cjs');
const out = 'outputs/learning-message'; fs.mkdirSync(out, { recursive: true });
const checks = [];
(async () => {
  await build({ stdin: { contents: `import React from 'react';
    import {flushSync} from 'react-dom';
    import {createRoot} from 'react-dom/client';
    import {LearningMessage} from './app/learning/learning-message';
    import {useLearningMessage} from './app/learning/use-learning-message';
    window.flushNotice=flushSync;
    function Harness(){const m=useLearningMessage();window.noticeHarness=m;return <main>
      <h1>학습 안내 확인</h1><button onClick={()=>m.setMessage('학습할 대상이 없어요. 다른 수준을 선택하거나 친숙도를 확인해 주세요.')}>안내 표시</button>
      <label>연습 답<input defaultValue="기존 입력" /></label>
      {m.message&&<LearningMessage messageId={m.messageId} message={m.message} onDismiss={m.dismissMessage}/>}</main>}
    createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`, resolveDir: process.cwd(), loader: 'tsx' },
    outfile: 'work/learning-message-harness.js', bundle: true, format: 'iife', platform: 'browser', logLevel: 'silent', define: { 'process.env.NODE_ENV': '"development"' } });
  const browser = await launchBrowser(); const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => errors.push(e.message)); await page.clock.install();
    await page.setContent('<!doctype html><html lang="ko"><head><title>학습 안내 검사</title></head><body><div id="root"></div></body></html>');
    await page.evaluate(() => { window.noticePointerEvents=[]; document.addEventListener('pointerover',event=>window.noticePointerEvents.push({type:event.pointerType,notice:!!event.target.closest('.learning-message')})); });
    const tokens = fs.readFileSync('app/globals.css', 'utf8').match(/:root\s*\{[^}]+\}/)[0];
    await page.addStyleTag({ content: tokens + fs.readFileSync('app/study-design.css', 'utf8') });
    await page.addScriptTag({ path: 'work/learning-message-harness.js' });
    // Fake timer advancement must follow React's native message-task commit.
    const settle = () => page.evaluate(async () => {
      for (let i = 0; i < 2; i++) await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
        channel.port2.postMessage(null);
      });
    });
    const advance = async ms => { await settle(); await page.clock.runFor(ms); await settle(); };
    const show = () => page.getByRole('button', { name: '안내 표시', exact: true }).click();
    const notice = page.locator('.learning-message'), close = page.getByRole('button', { name: '안내 닫기', exact: true });
    await show(); await advance(9000); assert.equal(await notice.count(), 1);
    await advance(1100); await notice.waitFor({ state: 'hidden' });
    checks.push('10 seconds dismisses ordinary feedback');
    await show(); await close.click(); await notice.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('textbox', { name: '연습 답' }).inputValue(), '기존 입력');
    checks.push('manual close leaves the learning input intact');
    await show(); await close.focus(); await advance(20000); assert.equal(await notice.count(), 1);
    await page.keyboard.press('Escape'); await notice.waitFor({ state: 'hidden' });
    checks.push('keyboard focus pauses dismissal; Escape closes the focused notice');
    await show(); await notice.hover();
    const hoverState=await notice.evaluate(el=>({hovered:el.matches(':hover'),events:window.noticePointerEvents.slice(-6)}));
    await advance(20000); assert.equal(await notice.count(), 1, JSON.stringify(hoverState));
    await page.mouse.move(0, 0); await advance(10100); await notice.waitFor({ state: 'hidden' });
    checks.push('hover pauses the timer and leaving grants a fresh reading interval');
    await show(); await advance(9000);
    await page.evaluate(() => { window.oldNoticeDismiss = window.noticeHarness.dismissMessage; });
    await show(); await page.evaluate(() => window.oldNoticeDismiss());
    await advance(2000); assert.equal(await notice.count(), 1);
    await advance(8100); await notice.waitFor({ state: 'hidden' });
    checks.push('identical repeated feedback restarts its timer; stale callbacks cannot close it');
    await show();
    await page.evaluate(() => window.flushNotice(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }));
    await advance(20000); assert.equal(await notice.count(), 1);
    await page.evaluate(() => window.flushNotice(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); }));
    await advance(10100); await notice.waitFor({ state: 'hidden' });
    checks.push('hidden pages preserve the notice until a fresh visible reading interval');

    await show(); await notice.hover(); await close.focus();
    await page.mouse.move(0, 0); await advance(20000); assert.equal(await notice.count(), 1);
    await notice.hover(); await page.getByRole('textbox', { name: '연습 답' }).focus();
    await advance(20000); assert.equal(await notice.count(), 1);
    await page.mouse.move(0, 0); await advance(9000); assert.equal(await notice.count(), 1);
    await advance(1100); await notice.waitFor({ state: 'hidden' });
    checks.push('overlapping hover and focus require both pause reasons to clear');

    await show(); await close.focus();
    await page.evaluate(() => window.flushNotice(() => window.noticeHarness.setMessage(window.noticeHarness.message)));
    await advance(9000); assert.equal(await notice.count(), 1);
    await advance(1100); await notice.waitFor({ state: 'hidden' });
    checks.push('replacing a focused message resets its reading state without a caller key');

    await show(); await advance(9000);
    await page.evaluate(() => window.flushNotice(() => window.noticeHarness.setMessage('')));
    await notice.waitFor({ state: 'hidden' });
    await show(); await advance(2000); assert.equal(await notice.count(), 1);
    await advance(8100); await notice.waitFor({ state: 'hidden' });
    checks.push('clearing and remounting leaves no previous timer affecting a later message');

    await show();
    await notice.dispatchEvent('pointerover', { pointerType: 'touch' });
    await advance(10100); await notice.waitFor({ state: 'hidden' });
    checks.push('touch interaction does not leave a permanent hover pause');

    await show(); await close.focus();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const box = await close.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: out + '/notice-mobile.png' });
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => v.id));
    assert.deepEqual(violations, []); checks.push('320–768px, 44px close target and accessibility pass');
    await page.close();

    await waitForWorker();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('learning_message') });
    const snapshot = await (await context.request.get(base + '/api/state')).json();
    const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
    const word = words.find(w => w.word === 'work' && w.pos === 'v.');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const id = crypto.randomUUID();
    const session = { id, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], stage: 'learn', index: 0,
      records: { [word.id]: { entryId: word.id, meaning: content[word.id].meaning, en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' } },
      retry: [], retryMode: false, elapsed: 0, paused: true, finished: false, createdAt: new Date().toISOString() };
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: snapshot.revision, settings: { ...snapshot.state.settings, activeSessionId: id }, sessions: { [id]: session }, progress: {} } })).status(), 200);
    const app = await context.newPage(); app.on('pageerror', e => errors.push(e.message));
    await app.goto(base, { waitUntil: 'domcontentloaded' }); await app.getByText('저장됨', { exact: true }).waitFor();
    await app.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await app.getByText('저장됨', { exact: true }).waitFor();
    const trigger = async () => {
      await app.getByRole('tab', { name: '학습 기록', exact: true }).click();
      await app.getByRole('button', { name: '기록 관리', exact: true }).click();
      await app.getByRole('menuitem', { name: '백업으로 복원', exact: true }).click();
      await app.locator('.learning-message').waitFor();
      await app.getByRole('menu').waitFor({ state: 'hidden' });
    };
    const before = await (await context.request.get(base + '/api/state')).json();
    await trigger(); await app.getByRole('button', { name: '안내 닫기', exact: true }).click();
    assert.equal(await app.locator('.learning-message').count(), 0);
    await trigger(); await app.getByRole('tab', { name: '단어장', exact: true }).click();
    assert.equal(await app.locator('.learning-message').count(), 0);
    assert.deepEqual(await (await context.request.get(base + '/api/state')).json(), before);
    checks.push('real app feedback can be closed and clears across tabs with zero record writes');
    await context.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/verification.json', JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }));
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
