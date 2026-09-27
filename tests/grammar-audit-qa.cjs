// Only local synthetic accounts. These cases exercise the v2 draft fields, not real records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { base, launchBrowser, closeBrowser, accountHeaders } = require('./qa/runtime.cjs');

(async () => {
  await build({ entryPoints: ['lib/grammar/practice.ts', 'lib/grammar/content-v2.ts', 'lib/grammar/model.ts'], outdir: 'work/grammar-audit-qa', bundle: true, format: 'cjs', platform: 'node', outExtension: { '.js': '.cjs' }, logLevel: 'silent' });
  const { newLessonProgress } = require('../work/grammar-audit-qa/practice.cjs');
  const { PRACTICE_LESSONS } = require('../work/grammar-audit-qa/content-v2.cjs');
  const { recordAnswer } = require('../work/grammar-audit-qa/model.cjs');
  const browser = await launchBrowser(), headers = { 'X-Study-Grammar': '2' };
  const until = async (fn, label) => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error(label); };
  const open = async grammar => {
    const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('grammar_audit'), viewport: { width: 390, height: 844 } });
    const get = async () => (await context.request.get(base + '/api/state', { headers })).json();
    const put = async (grammar, revision) => context.request.put(base + '/api/state', { headers, data: { grammar, revision, progress: {}, sessions: {} } });
    assert.equal((await put(grammar, (await get()).revision)).status(), 200);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const enter = async () => { await page.goto(base); await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await page.getByRole('tab', { name: '품사·문장 연습', exact: true }).click(); await page.locator('.grammar-tile').first().click(); };
    await enter(); return { context, page, get, put, enter };
  };
  const writing = () => {
    const p = newLessonProgress('noun'), l = PRACTICE_LESSONS.noun;
    return { ...p, stage: 5, observation: recordAnswer(undefined, l.observation.answer), answers: Object.fromEntries(l.questions.map((q, i) => [`q${i + 1}`, recordAnswer(undefined, q.answer)])) };
  };
  try {
    // An unsubmitted choice is a draft, survives retry/reload and is never a score.
    {
      const { context, page, get, enter } = await open({ noun: newLessonProgress('noun') });
      try {
        const before = await get();
        await page.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: '테스트 저장 실패' } }) : route.continue());
        await page.getByRole('button', { name: '일이라는 대상', exact: true }).click();
        await page.getByRole('button', { name: '다시 저장', exact: true }).waitFor();
        assert.equal((await get()).revision, before.revision);
        assert.equal(await page.getByRole('button', { name: '일이라는 대상', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.unroute('**/api/state'); await page.getByRole('button', { name: '다시 저장', exact: true }).click();
        await until(async () => (await get()).state.grammar.noun.observationChoice === '일이라는 대상', 'observation draft retry');
        await enter();
        assert.equal(await page.getByRole('button', { name: '일이라는 대상', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal((await get()).state.grammar.noun.observation, undefined);
        assert.equal(await page.getByRole('button', { name: '역할 알아보기', exact: true }).isDisabled(), true);
        console.log('PASS v2 observation draft: failure, retry, reload and no inferred answer');
      } finally { await context.close(); }
    }
    // Both self-checks including uncertainty, and the chosen frame survive reload.
    {
      const { context, page, get, put, enter } = await open({ noun: writing() });
      try {
        await page.getByRole('button', { name: 'books', exact: true }).click();
        await page.getByRole('button', { name: '이 문장으로 시작', exact: true }).click();
        await page.locator('.grammar-self-checks fieldset').nth(0).getByLabel('모르겠어요', { exact: true }).check();
        await page.locator('.grammar-self-checks fieldset').nth(1).getByLabel('확인했어요', { exact: true }).check();
        await until(async () => (await get()).state.grammar.noun.check === 'uncertain', 'v2 checks saved');
        await enter();
        assert.equal(await page.getByRole('textbox', { name: '내 문장', exact: true }).inputValue(), 'I like books.');
        const saved = (await get()).state.grammar.noun;
        assert.deepEqual(saved.frame, ['books']); assert.deepEqual(saved.checks, { meaning: 'uncertain', form: 'appropriate' });
        assert.equal(await page.getByRole('button', { name: '수업 마치기', exact: true }).isDisabled(), false);
        const remote = { ...saved, sentence: 'I like tea.', check: undefined, checks: undefined };
        assert.equal((await put({ noun: remote }, (await get()).revision)).status(), 200);
        await page.getByRole('textbox', { name: '내 문장', exact: true }).fill('I like coffee and books.');
        await page.getByRole('button', { name: '최신 기록 불러오기', exact: true }).waitFor();
        assert.deepEqual((await get()).state.grammar.noun, JSON.parse(JSON.stringify(remote)));
        const download = page.waitForEvent('download'); await page.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
        const backup = JSON.parse(fs.readFileSync(await (await download).path(), 'utf8')), state = backup.state ?? backup;
        assert.equal(state.grammar.noun.sentence, 'I like coffee and books.');
        assert.deepEqual(state.grammar.noun.frame, ['books']);
        assert.equal(state.grammar.noun.contentVersion, 2);
        console.log('PASS v2 frame/check drafts: reload, uncertainty completion and conflict backup');
      } finally { await context.close(); }
    }
    // Legacy omissions remain unmeasured and get a recommendation based on the actual known date.
    {
      const p = writing(); delete p.contentVersion; delete p.questionIds; delete p.observation;
      const legacy = { ...p, stage: 6, sentence: 'I like books.', check: 'appropriate', completedAt: '2026-09-01T00:00:00.000Z' };
      const { context, page, get } = await open({ noun: legacy });
      try {
        await page.getByText('살펴보기 · 미측정 · 이전 수업 기록', { exact: true }).waitFor();
        await page.getByText('다른 날 다시 확인할 차례예요.', { exact: true }).waitFor();
        assert.deepEqual((await get()).state.grammar.noun, legacy);
        console.log('PASS legacy summary: unmeasured observation and read-only recommendation');
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
