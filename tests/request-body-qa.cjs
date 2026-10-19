const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { launchBrowser, closeBrowser, accountHeaders, waitForWorker, base } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/request-body/${engine}`;
const compatibility = { 'X-Study-Grammar': '2', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1' };
fs.mkdirSync(out, { recursive: true });

// Do not send EOF or the rest of the body. A 413 must arrive while the sender
// still holds the connection open: this fails with await request.text().
function rejectBeforeEnd(path, method, identity, prefix, declaredLength) {
  return new Promise((resolve, reject) => {
    const headers = { ...identity, ...compatibility, 'Content-Type': 'application/json', 'X-Study-Revision': '0' };
    if (declaredLength !== undefined) headers['Content-Length'] = String(declaredLength);
    const request = http.request(base + path, { method, headers, agent: false }, response => {
      const beforeEnd = !request.writableEnded;
      if (response.statusCode !== 413) {
        console.error('Unexpected local stream status', path, response.statusCode);
        let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
        response.on('end', () => { clearTimeout(timer); resolve({ status: response.statusCode, beforeEnd, body }); request.destroy(); });
        request.end(); return;
      }
      // The local HTTP proxy sends status/body before EOF but holds the response
      // terminator until upload ends. Assert early status, then close both sides.
      if (declaredLength !== undefined) {
        clearTimeout(timer); resolve({ status: response.statusCode, beforeEnd });
        response.destroy(); request.destroy();
      } else {
        response.resume();
        response.on('end', () => { clearTimeout(timer); resolve({ status: response.statusCode, beforeEnd }); });
        request.end();
      }
    });
    const timer = setTimeout(() => { request.destroy(); reject(Error(`${path}: no early rejection`)); }, 10_000);
    request.on('error', error => { clearTimeout(timer); reject(new Error(`${path}: ${error.message}`, { cause: error })); });
    request.flushHeaders(); if (prefix) request.write(prefix);
  });
}

(async () => {
  await waitForWorker(); const browser = await launchBrowser({ engine }), errors = [], checks = [];
  try {
    const identity = accountHeaders('body_limits');
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: identity });
    const get = async () => (await c.request.get(base + '/api/state', { headers: compatibility })).json();
    const before = await get();
    for (const [path, method, size] of [
      ['/api/state', 'PUT', 1_800_001], ['/api/state/restore', 'POST', 8_000_001], ['/api/state/restore/jobs', 'POST', 100_001],
      [`/api/state/restore/jobs/${crypto.randomUUID()}/chunks/0`, 'PUT', 1_800_001],
      ['/api/sentence-feedback', 'POST', 12_001], ['/api/grammar-feedback', 'POST', 12_001],
    ]) {
      // An interrupted upload can rotate Wrangler's development proxy target.
      // A read-only readiness check settles that target; never retry mutations.
      await waitForWorker();
      const result = await rejectBeforeEnd(path, method, identity, Buffer.alloc(size, 32));
      assert.equal(result.status, 413, `${path}: ${JSON.stringify(result.body)}`); assert.equal(result.beforeEnd, true);
    }
    await waitForWorker();
    const declared = await rejectBeforeEnd('/api/state', 'PUT', identity, null, 100_000_000);
    assert.equal(declared.status, 413); assert.equal(declared.beforeEnd, true);
    await waitForWorker();
    assert.deepEqual(await get(), before); checks.push('built Worker: six chunked requests return 413 before EOF; oversized Content-Length returns before any body; original account unchanged');

    const page = await c.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.getByText('저장됨', { exact: true }).waitFor();
    await page.getByRole('tab', { name: '단어장', exact: true }).click();
    await page.getByRole('button', { name: '개인 단어 추가', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('영어 단어', { exact: true }).fill('kept-draft');
    await dialog.getByLabel('학습할 한국어 뜻', { exact: true }).fill('보존할 입력');
    let status, amplified = false;
    await page.route('**/api/state', async route => {
      if (route.request().method() !== 'PUT' || amplified) return route.continue();
      amplified = true;
      const response = await route.fetch({ postData: route.request().postData() + ' '.repeat(1_800_001) });
      status = response.status(); await route.fulfill({ response });
    });
    await dialog.getByRole('button', { name: '내 단어장에 추가', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: '기록이 너무 큽니다' }).waitFor();
    await waitForWorker();
    assert.equal(status, 413); assert.deepEqual(await get(), before);
    assert.equal(await dialog.getByLabel('영어 단어', { exact: true }).inputValue(), 'kept-draft');
    assert.equal(await dialog.getByLabel('학습할 한국어 뜻', { exact: true }).inputValue(), '보존할 입력');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await dialog.locator('.dialog-scroll').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await page.screenshot({ path: `${out}/rejected-${width}.png` });
    }
    // Retry the latest editor draft without discarding the open editor.
    const retry = dialog.getByRole('button', { name: '다시 저장', exact: true });
    assert.equal(await retry.isEnabled(), true);
    await dialog.getByLabel('학습할 한국어 뜻', { exact: true }).fill('실패 후 수정한 입력');
    await retry.click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByText('저장됨', { exact: true }).waitFor();
    await page.reload(); await page.getByText('저장됨', { exact: true }).waitFor();
    const after = await get(); assert.equal(after.revision, before.revision + 1);
    assert.ok(Object.values(after.state.progress).some(p => p.personal?.word === 'kept-draft' && p.meaning === '실패 후 수정한 입력'));
    checks.push('real 413 shown inside editor; inputs survive; in-dialog retry saves the latest edited input once and survives reload; 320/390/1440px');
    assert.deepEqual(errors, []); const result = { passed: true, engine, checks, errors };
    fs.writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
