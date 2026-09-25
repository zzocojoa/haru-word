// Synthetic local accounts only. AI responses are controlled here, never sent to Google.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { base, launchBrowser, closeBrowser, accountHeaders } = require('./qa/runtime.cjs');
const baseline = process.env.GRAMMAR_AUDIT_BASELINE === '1', checks = [];
(async () => {
  await build({ entryPoints: ['lib/grammar/content.ts'], outfile: 'work/grammar-plan-content.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { LESSON_MAP } = require('../work/grammar-plan-content.cjs');
  const now = new Date().toISOString(), browser = await launchBrowser();
  const progress = (id, stage = 5) => ({ stage, answers: stage >= 5 ? Object.fromEntries(LESSON_MAP.get(id).questions.map((q, i) => [`q${i + 1}`, { first: q.answer, latest: q.answer, helped: false, attempts: 1 }])) : {}, sentence: stage >= 5 ? LESSON_MAP.get(id).stem : '', check: stage >= 5 ? 'appropriate' : undefined, updatedAt: now });
  const open = async grammar => {
    const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('grammar_plan'), viewport: { width: 390, height: 844 } });
    const get = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
    const initial = await get();
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: initial.revision, grammar, progress: {}, sessions: {} } })).status(), 200);
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await page.getByRole('tab', { name: '품사·문장 연습', exact: true }).click();
    return { context, page, get };
  };
  const until = async (fn, label) => { for (let i = 0; i < 80; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error(label); };
  const check = async (name, fn) => { try { await fn(); checks.push({ name, passed: true }); } catch (e) { checks.push({ name, passed: false, error: e.message }); if (!baseline) throw e; } };
  try {
    await check('article emphasis matches the standalone article, not a letter in have', async () => {
      const { context, page } = await open({});
      try {
        await page.locator('.grammar-group > summary').filter({ hasText: '명사를 특정하는 말' }).click();
        await page.locator('.grammar-tile').filter({ hasText: '부정관사' }).click();
        const before = await page.locator('.grammar-examples mark').first().evaluate(el => el.previousSibling?.textContent);
        assert.equal(before, 'I have ');
      } finally { await context.close(); }
    });
    await check('help after an initial answer remains recorded on next and reload', async () => {
      const { context, page, get } = await open({ noun: progress('noun', 2) });
      try {
        await page.locator('.grammar-tile').first().click();
        await page.getByRole('button', { name: 'teacher', exact: true }).click();
        await page.getByRole('button', { name: '답을 보고 도움받기', exact: true }).click();
        await page.getByRole('button', { name: '다음', exact: true }).click();
        await until(async () => (await get()).state.grammar.noun.stage === 3, 'next saved');
        const answer = (await get()).state.grammar.noun.answers.q1;
        assert.equal(answer.first, 'teacher'); assert.equal(answer.attempts, 1); assert.equal(answer.helped, true);
      } finally { await context.close(); }
    });
    await check('unfinished review with a wrong answer is visible in the catalog', async () => {
      const p = { ...progress('noun', 6), completedAt: now, review: { index: 1, answers: { q1: { first: '동사', latest: '동사', helped: false, attempts: 1 } } } };
      const { context, page } = await open({ noun: p });
      try { assert.equal(await page.locator('.grammar-tile').first().locator('.grammar-review-tag').count(), 1); }
      finally { await context.close(); }
    });
    await check('failed completion is never presented as a saved completion', async () => {
      const { context, page, get } = await open({ verb: progress('verb') });
      try {
        await page.locator('.grammar-tile').filter({ hasText: /^v\./ }).click();
        await page.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '테스트 저장 실패' } }) : route.continue());
        await page.getByRole('button', { name: '수업 마치기', exact: true }).click();
        await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
        assert.equal(await page.getByText('수업을 마쳤어요.', { exact: true }).count(), 0);
        await page.unroute('**/api/state');
        await page.getByRole('button', { name: '다시 시도', exact: true }).click();
        await until(async () => !!(await get()).state.grammar.verb.completedAt, 'global retry saved completion');
        await page.getByText('수업을 마쳤어요.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: '다시 저장', exact: true }).count(), 0);
      } finally { await context.close(); }
    });
    for (const destination of ['단어 목록', '오늘의 학습']) await check(`late AI response is discarded after leaving for ${destination}`, async () => {
      const { context, page, get } = await open({ adjective: progress('adjective') });
      let release; const hold = new Promise(r => release = r); let calls = 0;
      try {
        await page.locator('.grammar-group > summary').filter({ hasText: '설명을 더하는 말' }).click();
        await page.locator('.grammar-tile').filter({ hasText: /^adj\./ }).click();
        await page.route('**/api/grammar-feedback', async route => { calls++; const sentence = route.request().postDataJSON().sentence; await hold; await route.fulfill({ json: { feedback: { original: sentence, correctedSentence: sentence, explanation: '합성 의견', meaningUsage: 'appropriate', grammar: 'natural', model: 'gemini-3.1-flash-lite', createdAt: now } } }).catch(() => {}); });
        await page.getByRole('button', { name: 'AI로 문장 점검', exact: true }).evaluate(button => { button.click(); button.click(); });
        await until(() => calls === 1, 'AI called once');
        await page.getByRole('tab', { name: destination, exact: true }).click(); release();
        await page.waitForTimeout(1200);
        assert.equal((await get()).state.grammar.adjective.feedback, undefined);
      } finally { release(); await context.close(); }
    });
    await check('invalid AI replies preserve input and allow a valid retry; applying a correction requires a fresh self-check', async () => {
      const { context, page, get } = await open({ noun: progress('noun') });
      try {
        await page.locator('.grammar-tile').first().click();
        const sentence = page.getByRole('textbox', { name: '내 문장', exact: true });
        const original = await sentence.inputValue(), corrected = 'I like books.';
        let calls = 0;
        await page.route('**/api/grammar-feedback', async route => {
          calls++;
          const feedback = { original, correctedSentence: corrected, explanation: '학습용 합성 의견', meaningUsage: 'appropriate', grammar: 'natural', model: 'gemini-3.1-flash-lite', createdAt: now };
          await route.fulfill({ json: { feedback: calls === 1 ? { ...feedback, original: 'Another sentence.' } : calls === 2 ? {} : feedback } });
        });
        for (let attempt = 1; attempt <= 2; attempt++) {
          await page.getByRole('button', { name: 'AI로 문장 점검', exact: true }).click();
          await page.locator('.ai-feedback-issue[role=alert]').waitFor();
          assert.equal(await sentence.inputValue(), original);
          assert.equal(await page.getByRole('heading', { name: 'AI 의견', exact: true }).count(), 0);
          assert.equal(await page.getByRole('radio', { name: '뜻과 형태를 확인했어요', exact: true }).isChecked(), true);
        }
        await page.getByRole('button', { name: 'AI로 문장 점검', exact: true }).click();
        await page.getByRole('heading', { name: 'AI 의견', exact: true }).waitFor();
        assert.equal(calls, 3); assert.equal(await sentence.inputValue(), original, 'AI never replaces text automatically');
        await page.getByRole('button', { name: '수정안 사용하기', exact: true }).click();
        assert.equal(await sentence.inputValue(), corrected);
        assert.equal(await page.getByRole('heading', { name: 'AI 의견', exact: true }).count(), 0);
        assert.equal(await page.getByRole('radio', { checked: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '수업 마치기', exact: true }).isDisabled(), true);
        await until(async () => (await get()).state.grammar.noun.sentence === corrected, 'correction saved');
        const saved = (await get()).state.grammar.noun;
        assert.equal(saved.check, undefined); assert.equal(saved.feedback, undefined);
      } finally { await context.close(); }
    });
    await check('lesson return retains word filters/page/scroll and keeps focus on a visible control', async () => {
      const all = Object.fromEntries([...LESSON_MAP.keys()].map(id => [id, { ...progress(id, 6), completedAt: now }]));
      const { context, page } = await open(all);
      try {
        await page.getByRole('tab', { name: '단어 목록', exact: true }).click();
        const query = page.getByRole('textbox', { name: '단어 또는 한국어 뜻 검색' });
        await query.fill('a');
        await page.getByRole('combobox', { name: '단어장 수준 필터' }).click(); await page.getByRole('option', { name: 'A1', exact: true }).click();
        await page.getByRole('combobox', { name: '친숙도 필터' }).click(); await page.getByRole('option', { name: '아직 미표시', exact: true }).click();
        await page.getByRole('navigation', { name: '단어 목록 상단 페이지 이동' }).getByRole('button', { name: '다음 페이지', exact: true }).click();
        const trigger = page.locator('.pos-help-button').nth(5), name = await trigger.getAttribute('aria-label');
        await trigger.click(); const scroll = await page.evaluate(() => scrollY);
        await page.getByRole('button', { name: '이 품사 배우기', exact: true }).click();
        await page.getByRole('button', { name: '같은 품사의 단어 보기', exact: true }).waitFor();
        await page.getByRole('tab', { name: '단어 목록', exact: true }).click();
        await until(async () => await page.getByRole('button', { name, exact: true }).evaluate(el => document.activeElement === el), 'word help focus restored');
        assert.equal(await query.inputValue(), 'a'); assert.match(await page.locator('.pagination').first().innerText(), /2 \//);
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), name, JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 250), scroll: scrollY }))));
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) <= 2);
        await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('button', { name: '이 품사 배우기', exact: true }).click();
        await page.getByRole('button', { name: '같은 품사의 단어 보기', exact: true }).click();
        // The hidden word list stays mounted; wait for navigation and focus restoration.
        await query.waitFor({ state: 'visible' });
        await until(async () => await query.evaluate(el => document.activeElement === el), 'word search focus restored');
        assert.equal(await query.inputValue(), 'a'); assert.match(await page.getByRole('combobox', { name: '단어장 수준 필터' }).innerText(), /A1/);
        assert.match(await page.getByRole('combobox', { name: '친숙도 필터' }).innerText(), /아직 미표시/);
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '단어 또는 한국어 뜻 검색');
      } finally { await context.close(); }
    });
    await check('two-device conflicts preserve both server progress and exportable local input', async () => {
      const { context, page, get } = await open({ noun: progress('noun') });
      try {
        await page.locator('.grammar-tile').first().click();
        const before = await get(), remote = { ...before.state.grammar.noun, sentence: 'I like tea.', updatedAt: now };
        assert.equal((await context.request.put(base + '/api/state', { data: { revision: before.revision, grammar: { noun: remote }, progress: {}, sessions: {} } })).status(), 200);
        await page.getByRole('textbox', { name: '내 문장', exact: true }).fill('I like coffee.');
        await page.getByRole('button', { name: '최신 기록 불러오기', exact: true }).waitFor();
        assert.deepEqual((await get()).state.grammar.noun, remote);
        await page.getByRole('textbox', { name: '내 문장', exact: true }).fill('I like coffee and books.');
        const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
        const backup = JSON.parse(fs.readFileSync(await (await downloaded).path(), 'utf8'));
        assert.equal((backup.state ?? backup).grammar.noun.sentence, 'I like coffee and books.');
        await page.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
        await page.getByText('서버에 저장됨', { exact: true }).waitFor();
        await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
        await page.getByRole('tab', { name: '품사·문장 연습', exact: true }).click(); await page.locator('.grammar-tile').first().click();
        assert.equal(await page.getByRole('textbox', { name: '내 문장', exact: true }).inputValue(), 'I like tea.');
      } finally { await context.close(); }
    });
    await check('global retry acknowledgement cannot mark newer input as saved', async () => {
      const { context, page, get } = await open({ noun: progress('noun') });
      let release; const hold = new Promise(r => release = r); let retrying = false;
      try {
        await page.locator('.grammar-tile').first().click();
        const input = page.getByRole('textbox', { name: '내 문장', exact: true });
        await page.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '테스트 저장 실패' } }) : route.continue());
        await input.fill('I like tea.'); await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
        await page.unroute('**/api/state');
        await page.route('**/api/state', async route => { if (route.request().method() === 'PUT') { retrying = true; await hold; } await route.continue(); });
        await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await until(() => retrying, 'global retry in flight');
        await input.fill('I like books.'); release();
        await until(async () => (await get()).state.grammar.noun.sentence === 'I like tea.', 'earlier snapshot acknowledged');
        assert.equal(await input.inputValue(), 'I like books.');
        assert.equal(await page.locator('.grammar-toolbar').getByText('저장됨', { exact: true }).count(), 0);
        await page.unroute('**/api/state'); await page.getByRole('button', { name: '다시 저장', exact: true }).click();
        await until(async () => (await get()).state.grammar.noun.sentence === 'I like books.', 'latest snapshot saved explicitly');
        await page.locator('.grammar-toolbar').getByText('저장됨', { exact: true }).waitFor();
      } finally { release(); await context.close(); }
    });
    console.log(JSON.stringify({ baseline, checks }));
  } finally {
    fs.mkdirSync('outputs/grammar-plan', { recursive: true });
    fs.writeFileSync(`outputs/grammar-plan/${baseline ? 'before' : 'after'}.json`, JSON.stringify({ baseline, checks }, null, 2));
    await closeBrowser(browser);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
