const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, base, accountHeaders, axePath } = require('./qa/runtime.cjs');
(async () => {
  const browser = await chromium.launch();
  const checks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('editor_save') });
    const page = await context.newPage(); let mode = 'hold', held;
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/state', route => {
      if (route.request().method() !== 'PUT' || mode === 'ready') return route.continue();
      if (mode === 'fail') return route.fulfill({ status: 503, json: { error: 'temporary failure' } });
      held = route;
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    const search = page.getByLabel('단어 또는 한국어 뜻 검색'), dialog = page.getByRole('dialog');
    const expression = () => dialog.getByLabel('함께 익힐 표현', { exact: true });
    async function open(word) { await search.fill(word); await page.getByRole('button', { name: word + ' 동사', exact: true }).click(); }
    async function close() { await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); }
    async function saved() { await page.getByText('서버에 저장됨', { exact: true }).waitFor(); }
    const get = async () => (await context.request.get(base + '/api/state')).json();
    await open('work'); await expression().fill('work today');
    await dialog.getByRole('button', { name: '기록 저장', exact: true }).click();
    await page.getByText('저장 중', { exact: true }).waitFor();
    assert.equal(await expression().isDisabled(), true);
    assert.equal(await dialog.getByLabel('학습할 뜻 선택').isDisabled(), true);
    await close(); await open('want'); await expression().fill('want a new draft');
    await held.continue(); await saved();
    assert.equal(await dialog.isVisible(), true); assert.equal(await expression().inputValue(), 'want a new draft');
    checks.push('submitting editor locks inputs and sense changes; previous word save cannot close another editor');
    await close(); await open('work'); await expression().fill('work again');
    await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await page.getByText('저장 중', { exact: true }).waitFor();
    await close(); await open('work'); await expression().fill('reopened work draft');
    await held.continue(); await saved();
    assert.equal(await dialog.isVisible(), true); assert.equal(await expression().inputValue(), 'reopened work draft');
    checks.push('closing and reopening the same word creates an independent editor instance');
    mode = 'fail'; await dialog.getByRole('button', { name: '기록 저장', exact: true }).click();
    await page.getByText('temporary failure', { exact: true }).waitFor();
    assert.equal(await dialog.isVisible(), true); assert.equal(await expression().inputValue(), 'reopened work draft');
    mode = 'ready'; await close(); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await saved();
    await page.reload({ waitUntil: 'domcontentloaded' }); await saved(); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await open('work');
    assert.equal(await expression().inputValue(), 'reopened work draft'); await close();
    checks.push('failed save retains draft; explicit retry and reconnect retain the submitted value');
    await page.getByRole('button', { name: /개인 단어 추가/ }).click();
    await dialog.getByLabel('영어 단어', { exact: true }).fill('commute');
    await dialog.getByLabel('오늘의 한국어 뜻', { exact: true }).fill('통근하다');
    mode = 'hold'; await dialog.getByRole('button', { name: '내 단어장에 추가', exact: true }).click(); await page.getByText('저장 중', { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel('영어 단어', { exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole('combobox').isDisabled(), true);
    await close(); await open('want'); await expression().fill('want preserved');
    await held.continue(); await saved(); assert.equal(await dialog.isVisible(), true);
    assert.equal(await expression().inputValue(), 'want preserved');
    const snapshot = await get(); assert.equal(Object.values(snapshot.state.progress).filter(p => p.personal?.word === 'commute').length, 1);
    checks.push('personal addition locks all inputs and preserves a subsequently opened editor');
    await page.addScriptTag({ path: axePath });
    const audit = await page.evaluate(async () => (await axe.run(document)).violations);
    assert.deepEqual(audit, []); assert.deepEqual(errors, []);
    fs.mkdirSync('outputs/editor-save', { recursive: true });
    fs.writeFileSync('outputs/editor-save/result.json', JSON.stringify({ passed: true, checks, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
