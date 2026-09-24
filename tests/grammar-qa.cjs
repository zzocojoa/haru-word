const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath } = require('./qa/runtime.cjs');

(async () => {
  const browser = await launchBrowser(), headers = accountHeaders('grammar');
  const context = await browser.newContext({ extraHTTPHeaders: headers, viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const snapshot = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
  const until = async (check, label) => { for (let i = 0; i < 100; i++) { if (await check()) return; await page.waitForTimeout(100); } throw Error(label); };
  const grammar = () => page.getByRole('tab', { name: '품사·문장 연습', exact: true });
  const getSentence = () => page.getByRole('textbox', { name: '내 문장', exact: true });
  fs.mkdirSync('outputs/grammar', { recursive: true });
  try {
    await page.goto(base); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await grammar().click(); assert.equal(await page.locator('.grammar-tile').count(), 15);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'catalog overflow ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addScriptTag({ path: axePath });
    let a11y = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations);
    assert.deepEqual(a11y.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), []);
    await page.screenshot({ path: 'outputs/grammar/catalog-mobile.png', fullPage: true });
    await page.locator('.grammar-tile').first().click();
    await page.getByRole('button', { name: '생각한 뒤 설명 확인', exact: true }).click();
    await page.getByRole('button', { name: '역할 알아보기' }).click();
    await page.getByRole('button', { name: '3문제 연습' }).click();
    await page.getByRole('button', { name: 'reads', exact: true }).click();
    await page.getByRole('button', { name: 'teacher', exact: true }).click();
    assert.match(await page.locator('.grammar-feedback').innerText(), /처음 답: reads/);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '답을 보고 도움받기', exact: true }).click();
    await page.getByRole('button', { name: 'bag', exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    for (const text of ['I', 'like', 'music.']) { const b = page.getByRole('button', { name: text, exact: true }); await b.focus(); await page.keyboard.press('Enter'); }
    await page.getByRole('button', { name: '정답 확인', exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await until(async () => (await snapshot()).state.grammar.noun?.stage === 5, 'stage save');
    const original = await snapshot();
    let delayed = false, release; const hold = new Promise(resolve => release = resolve);
    await page.route('**/api/state', async route => {
      if (route.request().method() === 'PUT' && !delayed) { delayed = true; await hold; }
      await route.continue();
    });
    await getSentence().fill('I like tea.'); await until(() => delayed, 'save started');
    await getSentence().fill('I like coffee.'); release();
    await page.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
    await until(async () => (await snapshot()).state.grammar.noun.sentence === 'I like coffee.', 'late input survives navigation');
    await page.unroute('**/api/state');
    await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await page.reload(); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await grammar().click(); await page.locator('.grammar-tile').first().click();
    assert.equal(await getSentence().inputValue(), 'I like coffee.');
    // A second device can load the same grammar snapshot without touching vocabulary.
    const otherDevice = await browser.newContext({ extraHTTPHeaders: headers });
    assert.equal((await (await otherDevice.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json()).state.grammar.noun.sentence, 'I like coffee.'); await otherDevice.close();
    let failures = 0;
    await page.route('**/api/state', async route => { if (route.request().method() === 'PUT') { failures++; await route.fulfill({ status: 503, json: { error: '테스트 저장 실패' } }); } else await route.continue(); });
    await getSentence().fill('I like green tea.'); await until(() => failures > 0, 'save failure');
    await getSentence().fill('I like green tea and coffee.');
    const pendingBackup = page.waitForEvent('download'); await page.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
    const emergency = JSON.parse(fs.readFileSync(await (await pendingBackup).path(), 'utf8'));
    assert.equal((emergency.state ?? emergency).grammar.noun.sentence, 'I like green tea and coffee.');
    await page.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
    assert.equal(await getSentence().inputValue(), 'I like green tea and coffee.');
    await page.unroute('**/api/state'); await page.getByRole('button', { name: '다시 저장', exact: true }).click();
    await until(async () => (await snapshot()).state.grammar.noun.sentence === 'I like green tea and coffee.', 'retry');
    // A delayed reply must not replace a newer draft; no real provider is called by QA.
    let aiCalls = 0, aiRelease; const aiHold = new Promise(resolve => aiRelease = resolve);
    await page.route('**/api/grammar-feedback', async route => { aiCalls++; const sentence = route.request().postDataJSON().sentence; await aiHold; await route.fulfill({ json: { feedback: { original: sentence, model: 'gemini-3.1-flash-lite', createdAt: new Date().toISOString(), meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: sentence, explanation: '명사를 알맞게 사용했어요.' } } }); });
    await page.getByRole('button', { name: 'AI로 문장 점검', exact: true }).click(); await until(() => aiCalls === 1, 'AI started');
    await getSentence().fill('I like books.'); aiRelease(); await page.waitForTimeout(250);
    assert.equal(await getSentence().inputValue(), 'I like books.'); assert.equal(await page.getByRole('heading', { name: 'AI 의견', exact: true }).count(), 0);
    await page.unroute('**/api/grammar-feedback');
    await page.route('**/api/grammar-feedback', route => route.fulfill({ status: 429, json: { error: 'Google 한도에 도달했어요.' } }));
    await page.getByRole('button', { name: 'AI로 문장 점검', exact: true }).click();
    await page.getByText(/Google 한도에 도달했어요/).waitFor(); assert.equal(await getSentence().inputValue(), 'I like books.');
    await page.getByLabel('뜻과 형태를 확인했어요', { exact: true }).check();
    await page.getByRole('button', { name: '수업 마치기', exact: true }).click();
    await until(async () => !!(await snapshot()).state.grammar.noun.completedAt, 'completion');
    assert.match(await page.locator('.grammar-results').innerText(), /처음엔 오답/);
    assert.match(await page.locator('.grammar-results').innerText(), /도움 사용/);
    await page.getByRole('button', { name: '다른 3문제로 확인', exact: true }).click();
    await page.getByRole('button', { name: '명사', exact: true }).click(); await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: 'shop', exact: true }).click(); await page.getByRole('button', { name: '다음', exact: true }).click();
    for (const text of ['My friend', 'likes', 'tea.']) await page.getByRole('button', { name: text, exact: true }).click();
    await page.getByRole('button', { name: '정답 확인', exact: true }).click(); await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '같은 품사의 단어 보기' }).click();
    assert.match(await page.getByRole('combobox', { name: '품사 필터' }).innerText(), /명사/);
    const after = await snapshot(); assert.deepEqual(after.state.progress, original.state.progress); assert.deepEqual(after.state.sessions, original.state.sessions); assert.deepEqual(after.state.settings, original.state.settings);
    assert.ok(after.state.grammar.noun.review.completedAt);
    assert.equal(after.state.grammar.noun.answers.q1.first, 'reads'); assert.equal(after.state.grammar.noun.answers.q2.helped, true);
    await page.getByRole('button', { name: /명사 도움말/ }).first().click(); await page.getByRole('button', { name: '이 품사 배우기' }).click();
    await page.getByRole('button', { name: '내 문장 보완', exact: true }).click();
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'lesson overflow ' + width); }
    await page.setViewportSize({ width: 320, height: 900 }); await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, '200% font overflow');
    await page.addScriptTag({ path: axePath }); a11y = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations); assert.deepEqual(a11y.map(v => v.id), []);
    await page.screenshot({ path: 'outputs/grammar/lesson-large-text.png', fullPage: true });
    assert.deepEqual(errors, []); console.log('PASS grammar flow: 15 lessons, mobile/a11y, retries/hints, save race/failure, cross-device reload, AI stale/429, independent vocabulary, review and POS links');
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
