// Local synthetic accounts only. Never point this at the deployed site.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'http://127.0.0.1:8787';
const out = 'outputs/refactor-audit';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const items = ['apple', 'book'].map(name => words.find(word => word.word === name && word.pos === 'n.'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const checks = [], errors = [];
const requests = [];
let currentPage;
const saved = page => page.getByText('서버에 저장됨', { exact: true }).waitFor();
const read = async context => (await context.request.get(base + '/api/state')).json();
const timerSeconds = async page => {
  const text = await page.locator('.timer > span').first().innerText();
  const [minutes, seconds] = text.split(':').map(Number);
  return minutes * 60 + seconds;
};

(async () => {
  const browser = await chromium.launch();
  let serial = 0;
  const fresh = async (stage, freezeClock = false) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
      'oai-authenticated-user-id': 'refactor_' + Date.now() + '_' + serial++,
      'oai-authenticated-user-email': 'refactor@example.test',
    } });
    const data = await read(context);
    const session = {
      id: crypto.randomUUID(), kind: 'daily', date, period: date, ids: items.map(word => word.id), warmupIds: [], stage,
      index: 0, records: Object.fromEntries(items.map(word => [word.id, {
        entryId: word.id, meaning: content[word.id].meaning, material: content[word.id], en: 'unmeasured', ko: 'unmeasured',
        sentenceStatus: 'unmeasured', sentence: '', notes: '',
      }])), retry: [], retryMode: false, elapsed: 17, paused: false, finished: false, createdAt: new Date().toISOString(),
    };
    const response = await context.request.put(base + '/api/state', { data: {
      revision: data.revision, settings: { ...data.state.settings, dailyGoal: 2, activeSessionId: session.id },
      sessions: { [session.id]: session }, progress: Object.fromEntries(items.map(word => [word.id, { familiarity: 'uncertain' }])),
    } });
    assert.equal(response.status(), 200, await response.text());
    const page = await context.newPage();
    currentPage = page;
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().endsWith('/api/state')) requests.push({ method: response.request().method(), status: response.status() });
    });
    if (freezeClock) await page.clock.install();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await saved(page);
    await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
    await saved(page);
    if (freezeClock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    return { context, page, session };
  };
  try {
    // The session component is kept mounted when visiting another view or saving settings.
    for (const stage of ['learn', 'en', 'sentence']) {
      const { context, page, session } = await fresh(stage);
      const field = stage === 'learn' ? page.locator('#study-meaning') : stage === 'en' ? page.getByLabel('한국어 뜻 입력') : page.getByLabel('내 영어 문장', { exact: true });
      const draft = stage === 'sentence' ? 'I eat an apple every day.' : '작성 중인 나의 답';
      await field.fill(draft);
      if (stage === 'sentence') {
        await page.getByLabel('보완할 점', { exact: false }).fill('메모도 유지');
        await page.getByLabel('내 문장을 소리 내어 말해 봤어요').check();
      }
      await page.getByRole('tab', { name: '전체 단어장' }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('apple');
      await page.getByRole('tab', { name: '오늘의 학습' }).click();
      assert.equal(await field.inputValue(), draft);
      await page.getByRole('button', { name: '학습 설정', exact: true }).click();
      await page.getByRole('combobox', { name: '하루 목표', exact: true }).click();
      await page.getByRole('option', { name: '4개', exact: true }).click();
      await saved(page);
      // Wait for Select to release its layer, then explicitly close the settings dialog.
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.locator('.settings-dialog').waitFor({ state: 'hidden' });
      assert.equal(await field.inputValue(), draft);
      assert.equal((await read(context)).state.settings.activeSessionId, session.id);
      await page.getByRole('tab', { name: '전체 단어장' }).click();
      assert.equal(await page.getByLabel('단어 또는 한국어 뜻 검색').inputValue(), 'apple');
      await page.getByRole('tab', { name: '오늘의 학습' }).click();
      if (stage === 'sentence') {
        assert.equal(await page.getByLabel('보완할 점', { exact: false }).inputValue(), '메모도 유지');
        assert.ok(await page.getByLabel('내 문장을 소리 내어 말해 봤어요').isChecked());
      }
      await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click();
      await saved(page);
      const stored = (await read(context)).state.sessions[session.id].records[items[0].id];
      assert.equal(stage === 'learn' ? stored.meaning : stage === 'en' ? stored.draft.answer : stored.sentence, draft);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await saved(page);
      await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
      await saved(page);
      assert.equal(await field.inputValue(), draft);
      await page.addScriptTag({ path: 'work/axe/package/axe.min.js' });
      const accessibility = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      assert.deepEqual(accessibility.violations, []);
      await page.screenshot({ path: `${out}/${stage}-resumed.png`, fullPage: true });
      checks.push(`${stage}: tab visits and goal save retain draft and session identity; exit/reload resumes; axe has zero violations`);
      await context.close();
    }

    const { context, page, session } = await fresh('en', true);
    const start = await timerSeconds(page);
    await page.clock.runFor(3000);
    assert.equal(await timerSeconds(page), start + 3);
    await page.getByLabel('한국어 뜻 입력').fill('사과');
    await page.getByRole('tab', { name: '전체 단어장' }).click();
    await page.clock.runFor(10000);
    await page.getByRole('tab', { name: '오늘의 학습' }).click();
    assert.equal(await timerSeconds(page), start + 3);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(7000);
    await page.evaluate(() => {
      delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await timerSeconds(page), start + 3);
    await page.clock.runFor(2000);
    assert.equal(await timerSeconds(page), start + 5);
    await page.getByRole('button', { name: '타이머 일시 정지', exact: true }).click();
    await saved(page);
    await page.clock.runFor(8000);
    assert.equal(await timerSeconds(page), start + 5);
    await page.getByRole('button', { name: '계속 학습하기', exact: true }).click();
    await saved(page);
    await page.clock.runFor(2000);
    assert.equal(await timerSeconds(page), start + 7);
    assert.equal(await page.getByLabel('한국어 뜻 입력').inputValue(), '사과');
    checks.push('activity timer counts visible active time only; tabs, document hiding and manual pause do not add time or reset draft');

    await page.getByRole('button', { name: '내 답 확인', exact: false }).click();
    await saved(page);
    await page.getByRole('button', { name: '도움 없이 맞혔어요', exact: true }).click();
    await saved(page);
    assert.equal(await page.getByLabel('한국어 뜻 입력').inputValue(), '');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H2');
    const stored = (await read(context)).state.sessions[session.id];
    assert.equal(stored.index, 1);
    assert.equal(stored.records[items[0].id].en, 'independent');
    assert.equal(stored.records[items[1].id].en, 'unmeasured');
    await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click();
    await saved(page);
    const elapsed = (await read(context)).state.sessions[session.id].elapsed;
    await page.clock.runFor(10000);
    await page.getByRole('button', { name: '이어서 학습', exact: true }).click();
    await saved(page);
    assert.equal((await read(context)).state.sessions[session.id].elapsed, elapsed);
    checks.push('next question clears only its draft, focuses the heading, and preserves prior results; summary time is not counted');
    await context.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/verification.json', JSON.stringify({ passed: true, checks, pageErrors: errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      await currentPage.screenshot({path: out + '/failure.png', fullPage: true});
      const dom = await currentPage.evaluate(() => ({
        tabs: [...document.querySelectorAll('[role=tab]')].map(node => ({text:node.textContent, hidden:node.closest('[aria-hidden=true]')?.outerHTML.slice(0,250)})),
        dialogs: [...document.querySelectorAll('[role=dialog]')].map(node => ({text:node.textContent?.slice(0,200),state:node.getAttribute('data-state')})),
        body:document.body.getAttribute('style'),
      }));
      fs.writeFileSync(out + '/failure-dom.json', JSON.stringify({ ...dom, requests }, null, 2));
    }
    fs.writeFileSync(out + '/verification.json', JSON.stringify({ passed: false, checks, pageErrors: errors, error: String(error) }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
