const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, base, accountHeaders } = require('./qa/runtime.cjs');
(async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('response_contract') });
    const page = await context.newPage(); let writes = 0;
    await page.route('**/api/state', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      writes++;
      // Server commits, but an invalid success body reaches the client.
      const response = await route.fetch(); assert.equal(response.status(), 200);
      await route.fulfill({ response, json: {} });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
    await page.getByRole('button', { name: 'work 동사', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('keep this draft');
    await dialog.getByRole('button', { name: '기록 저장', exact: true }).click();
    await page.getByText('서버 응답을 확인하지 못했어요. 현재 입력을 백업한 뒤 서버 기록을 확인해 주세요.', { exact: true }).waitFor();
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'keep this draft');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await page.getByText('저장 필요', { exact: true }).waitFor();
    assert.equal(await page.getByText('서버에 저장됨', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '현재 입력 백업', exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('button', { name: '다시 시도', exact: true }).count(), 0);
    await page.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    assert.equal(writes, 1);
    const saved = await (await context.request.get(base + '/api/state')).json();
    assert.ok(Object.values(saved.state.progress).some(p => p.expression === 'keep this draft'));
    console.log(JSON.stringify({ passed: true, checks: ['invalid success keeps draft and unsaved state; no retry; explicit reconciliation restores the committed state'] }));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
