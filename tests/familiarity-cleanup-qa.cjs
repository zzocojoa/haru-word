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
  try {
    browser = await launchBrowser();
    const designated = await browser.newContext({ extraHTTPHeaders: tester, viewport: { width: 390, height: 840 } });
    const other = await browser.newContext({ extraHTTPHeaders: accountHeaders('other_learner') });
    const anonymous = await browser.newContext();
    const url = worker.base;
    const read = async account => {
      const response = await account.request.get(url + '/api/state', { headers: stateHeaders });
      assert.equal(response.status(), 200);
      return response.json();
    };
    const seed = async (account, state) => {
      const response = await account.request.put(url + '/api/state', {
        headers: stateHeaders,
        data: { ...state, revision: (await read(account)).revision },
      });
      assert.equal(response.status(), 200);
    };

    const historyFixture = history(2, 2);
    historyFixture.settings.reviewDay = 4;
    historyFixture.grammar = { noun: { stage: 0, answers: {}, sentence: 'Synthetic draft', updatedAt: '2026-10-01T12:00:00.000Z' } };
    await seed(designated, historyFixture);
    const original = await read(designated);
    const page = await designated.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.getByText('저장됨', { exact: true }).waitFor();
    await page.getByRole('button', { name: '학습 설정', exact: true }).click();
    await page.getByRole('button', { name: '친숙도 다시 확인', exact: true }).click();
    await page.getByText('표시를 고르면 뜻을 볼 수 있어요.', { exact: true }).waitFor();
    await page.getByRole('button', { name: /처음 봐요$/ }).click();
    await page.locator('.reference-meaning').waitFor();
    await page.getByText('저장됨', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: cleanupLabel, exact: true }).count(), 0);
    const pending = await read(designated);
    const assessment = pending.state.settings.assessments.A1;
    assert.equal(assessment.ids.length, 20);
    assert.equal(assessment.index, 0);
    const draft = pending.state.progress[assessment.ids[0]].familiarityCheck;
    assert.equal(draft.initial, 'new');
    assert.equal(draft.answer, '');
    assert.equal(draft.final, undefined);
    assert.deepEqual(pending.state.sessions, original.state.sessions);
    assert.deepEqual(pending.state.grammar, original.state.grammar);

    await seed(other, pending.state);
    const otherPage = await other.newPage();
    otherPage.on('pageerror', error => errors.push(error.message));
    await otherPage.goto(url);
    await otherPage.getByText('저장됨', { exact: true }).waitFor();
    await otherPage.getByRole('button', { name: '친숙도 확인 이어서', exact: true }).click();
    await otherPage.locator('.reference-meaning').waitFor();
    await otherPage.getByText('저장됨', { exact: true }).waitFor();
    assert.equal(await otherPage.getByRole('button', { name: cleanupLabel, exact: true }).count(), 0);
    const otherBefore = await read(other);

    const diagnosis = await designated.request.get(url + cleanupPath + '/status');
    assert.equal(diagnosis.status(), 200);
    assert.deepEqual(await diagnosis.json(), { bindingPresent: true, matchesCurrentLogin: true });
    for (const [account, revision] of [
      [designated, pending.revision],
      [other, otherBefore.revision],
      [anonymous, 0],
    ]) {
      const response = await account.request.post(url + cleanupPath, { data: { revision } });
      assert.equal(response.status(), 410);
      assert.equal(response.headers()['cache-control'], 'no-store');
    }
    assert.deepEqual(await read(designated), pending);
    assert.deepEqual(await read(other), otherBefore);

    await page.reload();
    await page.getByText('저장됨', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '친숙도 확인 이어서', exact: true }).count(), 1);
    assert.deepEqual(errors, []);
    const engine = process.env.QA_BROWSER || 'chromium';
    const result = {
      engine,
      passed: true,
      checks: [
        'normal familiarity reveal saves the pending comparison and reload offers resume',
        'button is absent at the same meaning comparison stage for both accounts',
        'old cleanup requests return 410 even with a matching runtime binding',
        'both account snapshots and revisions are preserved after the rejected requests',
      ],
      browserErrors: errors,
      productionWrites: 0,
    };
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
