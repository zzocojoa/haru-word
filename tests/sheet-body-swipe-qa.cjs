// Only local synthetic accounts. WebKit touch dispatch is not a physical iPhone test.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/sheet-body-swipe-${engine}`;
fs.mkdirSync(out, { recursive: true });
(async () => {
  await waitForWorker(); const browser = await launchBrowser({ engine }); let p;
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, extraHTTPHeaders: accountHeaders('sheet_body') });
    p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(base); await p.getByText('저장됨', { exact: true }).waitFor();
    const before = await (await c.request.get(base + '/api/state')).json();
    await p.getByRole('tab', { name: '단어장', exact: true }).click();
    const dialog = p.getByRole('dialog'), body = p.locator('.sheet-dialog .dialog-scroll');
    const text = p.locator('.sheet-dialog .sense-selector > p');
    const open = async () => {
      await p.getByRole('button', { name: 'a, an 부정관사', exact: true }).click();
      await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
    };
    const atTop = () => body.evaluate(el => { el.scrollTop = 0; });
    const drag = async (target, dy, { cancel = false } = {}) => target.evaluate((el, { dy, cancel }) => {
      const sheet = el.closest('.sheet-dialog'), r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const fire = (type, delta) => {
        const e = new Event(type, { bubbles: true, cancelable: true }), t = { identifier: 19, clientX: x, clientY: y + delta };
        Object.defineProperties(e, { touches: { value: /end|cancel/.test(type) ? [] : [t] }, changedTouches: { value: [t] } });
        // Observe at the sheet, before Radix's document scroll lock. The lock
        // may independently prevent overscroll on controls at the boundary.
        let prevented = false;
        sheet.addEventListener(type, event => { prevented = event.defaultPrevented; }, { once: true });
        el.dispatchEvent(e); return prevented;
      };
      const start = fire('touchstart', 0), smallMove = fire('touchmove', Math.sign(dy) * 3), move = fire('touchmove', dy);
      const moving = sheet.hasAttribute('data-sheet-dragging');
      fire(cancel ? 'touchcancel' : 'touchend', dy);
      return { start, smallMove, move, moving };
    }, { dy, cancel });
    await open();
    const downward = await drag(text, 150);
    assert.equal(downward.start, false, 'body taps must retain native behavior');
    assert.equal(downward.smallMove, true, 'reserve downward boundary motion before native scrolling');
    assert.equal(downward.moving, true, 'word editor body at top must drag the sheet');
    await dialog.waitFor({ state: 'hidden' });

    await open();
    for (const options of [{ dy: 35 }, { dy: 150, cancel: true }]) {
      await drag(text, options.dy, options);
      await p.waitForFunction(() => !document.querySelector('.sheet-dialog')?.hasAttribute('data-sheet-motion'));
      assert.ok(await dialog.isVisible());
    }
    assert.deepEqual(await drag(text, -150), { start: false, smallMove: false, move: false, moving: false });
    await body.evaluate(el => { el.scrollTop = 80; });
    assert.equal(await body.evaluate(el => el.scrollTop), 80, 'scroll position must be exposed by the body container');
    assert.equal((await drag(text, 150)).moving, false, 'a scrolled body must not dismiss');
    await atTop();
    for (const control of [dialog.getByRole('textbox', { name: '함께 익힐 표현', exact: true }), dialog.getByRole('textbox', { name: '영어 예문', exact: true }), dialog.getByLabel('학습할 뜻 선택'), dialog.locator('summary').first()]) {
      assert.deepEqual(await drag(control, 150), { start: false, smallMove: false, move: false, moving: false });
    }
    await text.evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); getSelection().addRange(r); });
    assert.equal((await drag(text, 150)).moving, false, 'text selection keeps ownership');
    await p.evaluate(() => getSelection().removeAllRanges());
    assert.ok(await dialog.isVisible());

    if (engine === 'chromium') {
      const client = await c.newCDPSession(p);
      const nativeDrag = async dy => {
        const r = await text.boundingBox(), x = r.x + r.width / 2, y = r.y + r.height / 2;
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 15; i++) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * i / 15 }] });
        }
        const moving = await dialog.getAttribute('data-sheet-dragging');
        if (moving !== null) await p.screenshot({ path: `${out}/body-drag.png` });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        return moving !== null;
      };
      await atTop(); assert.equal(await nativeDrag(-150), false);
      assert.ok(await body.evaluate(el => el.scrollTop > 0), 'upward gesture scrolls native content');
      // A downward scroll reaching the top cannot turn into dismissal mid-gesture.
      await body.evaluate(el => { el.scrollTop = 60; });
      assert.equal(await nativeDrag(150), false); assert.ok(await dialog.isVisible());
      await atTop(); assert.equal(await nativeDrag(150), true); await dialog.waitFor({ state: 'hidden' });
      await client.detach(); await open();
    }

    await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('a useful book'); await atTop();
    await drag(text, 150); await p.getByRole('alertdialog').waitFor();
    await p.getByRole('button', { name: '계속 편집', exact: true }).click();
    assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'a useful book');
    await p.getByRole('alertdialog').waitFor({ state: 'hidden' });
    await p.waitForFunction(() => !document.querySelector('.sheet-dialog')?.hasAttribute('data-sheet-motion'));
    await atTop(); await drag(text, 150); await p.getByRole('button', { name: '변경 버리고 닫기', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await p.getByRole('button', { name: 'a, an 부정관사', exact: true }).evaluate(el => el === document.activeElement), true);
    assert.deepEqual(await (await c.request.get(base + '/api/state')).json(), before);
    assert.deepEqual(errors, []);
    const report = { passed: true, engine, checks: ['word body downward boundary dismissal; tap/short/cancel/upward retained', 'scrolled body, inputs, select, summary and selection excluded', 'native Chromium scrolling/dismissal; WebKit event contract', 'discard cancel preserves draft; confirmed close restores focus and leaves server state unchanged'] };
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (e) { if (p) await p.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw e; }
  finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
