const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { accountHeaders, launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const { grammarWorker } = require('./qa/worker-profile.cjs');
const { history } = require('./fixtures/backup-history.cjs');

const cleanupPath = '/api/state/familiarity-cleanup';
const cleanupLabel = '테스트 진행 지우기';
const stateHeaders = { 'X-Study-Grammar': '5', 'X-Study-Sense-Keys': '1' };

async function run() {
  mkdirSync('work', { recursive: true });
  const tester = accountHeaders('familiarity_cleanup');
  const worker = await grammarWorker(4, { familiarityCleanupTestUserId: tester['oai-authenticated-user-id'] });
  let browser;
  const checks = [];
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ extraHTTPHeaders: tester, viewport: { width: 390, height: 840 } });
    const other = await browser.newContext({ extraHTTPHeaders: accountHeaders('other_learner') });
    const anonymous = await browser.newContext();
    const url = worker.base;
    const read = async account => {
      const response = await account.request.get(url + '/api/state', { headers: stateHeaders });
      assert.equal(response.status(), 200);
      return response.json();
    };
    const save = async (account, data) => {
      const response = await account.request.put(url + '/api/state', { headers: stateHeaders, data });
      assert.equal(response.status(), 200, 'synthetic fixture save');
    };
    const clear = (account, data, headers) => account.request.post(url + cleanupPath, { data, headers });
    const old = history(2, 2);
    old.settings.reviewDay = 4;
    old.grammar = { noun: { stage: 0, answers: {}, sentence: 'Synthetic draft', updatedAt: '2026-10-01T12:00:00.000Z' } };
    await save(context, { revision: (await read(context)).revision, ...old });
    const original = await read(context);
    assert.equal(Object.keys(original.state.sessions).length, 2);
    assert.deepEqual(original.state.grammar, old.grammar);

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const saved = () => page.getByText('저장됨', { exact: true }).waitFor();
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(url);
    await saved();
    await button('학습 설정').click();
    await button('친숙도 다시 확인하기').click();
    await page.getByText('표시를 고르면 뜻을 볼 수 있어요.', { exact: true }).waitFor();
    assert.equal(await button(cleanupLabel).count(), 0);
    await page.getByRole('button', { name: /처음 봐요$/ }).click();
    await page.locator('.reference-meaning').waitFor();
    await saved();
    const before = await read(context);
    const { ids } = before.state.settings.assessments.A1;
    const first = ids[0];
    const draft = before.state.progress[first].familiarityCheck;
    assert.equal(original.state.progress[first], undefined);
    assert.deepEqual(Object.keys(before.state.progress[first]), ['familiarityCheck']);

    await save(other, { revision: (await read(other)).revision, ...before.state });
    const otherBefore = await read(other);
    assert.equal((await clear(anonymous, { revision: before.revision })).status(), 401);
    assert.equal((await clear(other, { revision: otherBefore.revision })).status(), 404);
    assert.equal((await clear(context, { revision: before.revision }, { Origin: 'https://example.test' })).status(), 403);
    assert.equal((await clear(context, { revision: before.revision, entryId: first })).status(), 400);
    assert.equal((await clear(context, { revision: before.revision - 1 })).status(), 409);
    assert.deepEqual(await read(context), before);
    assert.deepEqual(await read(other), otherBefore);
    const otherPage = await other.newPage();
    await otherPage.goto(url);
    await otherPage.getByText('저장됨', { exact: true }).waitFor();
    await otherPage.getByRole('button', { name: '친숙도 확인 이어서', exact: true }).click();
    await otherPage.locator('.reference-meaning').waitFor();
    assert.equal(await otherPage.getByRole('button', { name: cleanupLabel, exact: true }).count(), 0);
    const otherContinued = await read(other);
    checks.push('anonymous, other account, cross-origin, arbitrary target and stale revision rejected without a write; other account has no cleanup button');

    const dialog = page.getByRole('alertdialog', { name: '테스트 진행을 지울까요?' });
    await button(cleanupLabel).click();
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await read(context), before);
    await button(cleanupLabel).click();
    await dialog.getByRole('button', { name: cleanupLabel, exact: true }).click();
    await page.getByText('테스트 진행을 지웠어요.', { exact: true }).waitFor();
    await saved();
    assert.deepEqual(await read(context), { revision: before.revision + 1, state: original.state });
    await page.reload();
    await saved();
    assert.equal(await button('친숙도 확인 이어서').count(), 0);
    assert.deepEqual(await read(other), otherContinued);
    checks.push('cancel leaves state intact; confirmed cleanup removes the test assessment and draft-only row; reread preserves previous word, session, grammar and settings data');

    const legacyWord = { familiarity: 'known', en: 'independent', notes: 'Synthetic older notes', lastStudied: '2026-10-01' };
    const settings = structuredClone(before.state.settings);
    settings.assessments.A2 = {
      ids: [require('../data/words.json').find(word => word.level === 'A2').id],
      index: 0, marks: {}, completed: false,
    };
    await save(context, { revision: before.revision + 1, settings, progress: { [first]: { ...legacyWord, familiarityCheck: draft } }, sessions: {} });
    const retained = await read(context);
    const race = await Promise.all([
      clear(context, { revision: retained.revision }),
      clear(context, { revision: retained.revision }),
    ]);
    assert.deepEqual(race.map(response => response.status()).sort(), [200, 409]);
    const expected = structuredClone(retained);
    expected.revision++;
    delete expected.state.settings.assessments.A1;
    delete expected.state.progress[first].familiarityCheck;
    assert.deepEqual(await read(context), expected);
    assert.deepEqual(expected.state.progress[first], legacyWord);
    assert.deepEqual(await read(other), otherContinued);
    checks.push('concurrent requests commit once; cleanup preserves same-word history fields, a different level assessment and the other account');

    const protectedStates = [
      { assessment: settings.assessments.A1, check: { ...draft, final: 'new' } },
      { assessment: settings.assessments.A1, check: { ...draft, answer: 'Synthetic non-empty answer' } },
      { assessment: { ...settings.assessments.A1, index: 1, marks: { [first]: 'new' } }, check: draft },
    ];
    for (const { assessment, check } of protectedStates) {
      await save(context, {
        revision: (await read(context)).revision,
        settings: { ...settings, assessments: { ...settings.assessments, A1: assessment } },
        progress: { [first]: { ...legacyWord, familiarityCheck: check } },
        sessions: {},
      });
      const protectedState = await read(context);
      assert.equal((await clear(context, { revision: protectedState.revision })).status(), 422);
      assert.deepEqual(await read(context), protectedState);
    }
    assert.deepEqual(errors, []);
    checks.push('confirmed result, an entered answer and an advanced assessment are all ineligible');
    const engine = process.env.QA_BROWSER || 'chromium';
    const result = { engine, passed: true, checks, browserErrors: errors, productionWrites: 0 };
    writeFileSync(`work/familiarity-cleanup-${engine}-qa.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally {
    try {
      if (browser) await closeBrowser(browser);
    } finally {
      await worker.stop();
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
