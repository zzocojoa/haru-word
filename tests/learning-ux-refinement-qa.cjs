const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { accountHeaders, base, closeBrowser, launchBrowser } = require('./qa/runtime.cjs');

const words = JSON.parse(readFileSync('data/words.json', 'utf8'));
const content = JSON.parse(readFileSync('data/content.json', 'utf8'));
const ids = words.filter(word => word.level === 'A1').slice(0, 3).map(word => word.id);
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const viewports = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }];
const cases = [
  { stage: 'learn', index: 0, action: '뜻 저장하고 계속', next: '단어 익히기', nextStage: 'learn', nextIndex: 1 },
  { stage: 'learn', index: 2, action: '뜻 저장하고 계속', next: '영어 → 뜻', nextStage: 'en', nextIndex: 0 },
  { stage: 'sentence', index: 0, action: '문장을 완성했어요', next: '내 문장 만들기', nextStage: 'sentence', nextIndex: 1 },
  { stage: 'sentence', index: 2, action: '문장을 완성했어요', next: '학습 기록을 저장했어요', nextStage: 'done', finished: true },
  { stage: 'sentence', index: 1, action: '저장하고 나가기', next: '학습 기록을 저장했어요', nextStage: 'sentence', nextIndex: 1, paused: true },
];

async function saved(page) {
  await page.getByText('저장됨', { exact: true }).first().waitFor();
}

async function seed(context, sample) {
  const snapshot = await (await context.request.get(base + '/api/state')).json();
  const id = randomUUID();
  const records = Object.fromEntries(ids.map(entryId => [entryId, {
    entryId, meaning: content[entryId].meaning, material: content[entryId], en: 'independent', ko: 'independent',
    sentence: '', notes: '', sentenceStatus: 'unmeasured',
  }]));
  const session = {
    id, kind: 'daily', date, period: date, ids, warmupIds: [], stage: sample.stage, index: sample.index,
    records, retry: [], retryMode: false, elapsed: 0, paused: true, finished: false,
    createdAt: new Date().toISOString(),
  };
  const reply = await context.request.put(base + '/api/state', {
    data: { revision: snapshot.revision, settings: { ...snapshot.state.settings, activeSessionId: id }, progress: {}, sessions: { [id]: session } },
  });
  assert.equal(reply.status(), 200);
  return id;
}

async function checkSummary(page) {
  const summary = page.locator('.session-summary');
  const gaps = await summary.evaluate(el => {
    const gap = (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().bottom;
    const actions = el.querySelector('.button-row');
    return [
      gap(el.querySelector('h2'), el.querySelector(':scope > .muted')),
      gap(actions.previousElementSibling, actions),
      gap(actions, el.querySelector('.journal-words')),
    ];
  });
  assert.ok(gaps.every(gap => gap > 0), JSON.stringify(gaps));
  for (const expanded of [false, true]) {
    if (expanded) await summary.locator('.journal-word-trigger').first().click();
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const visibleAboveMenu = await summary.evaluate(el => {
      const nav = document.querySelector('.main-nav');
      return getComputedStyle(nav).position !== 'fixed' || el.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top;
    });
    assert.ok(visibleAboveMenu, 'summary bottom clears fixed navigation at the end of the page');
  }
}

async function transition(browser, viewport, sample, failFirst) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('ux_transition') });
  try {
    const id = await seed(context, sample);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await saved(page);
    await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
    await saved(page);
    const panel = page.locator('.session-panel');
    let input;
    if (sample.stage === 'sentence') {
      input = panel.getByRole('textbox', { name: '내 영어 문장', exact: true });
      await input.fill('This is a synthetic practice sentence.');
    }
    const action = panel.getByRole('button', { name: sample.action, exact: true });
    await action.evaluate(async el => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      el.scrollIntoView({ block: 'end', behavior: 'instant' });
      if (window.scrollY === 0) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    const before = await page.evaluate(() => window.scrollY);
    assert.ok(before > 0, 'test starts below the top: ' + JSON.stringify({ viewport, sample }));
    let failed = false;
    if (failFirst) {
      await page.route('**/api/state', async route => {
        if (route.request().method() !== 'PUT' || failed) return route.continue();
        failed = true;
        await route.fulfill({ status: 503, json: { error: '합성 저장 실패' } });
      });
    }
    await action.click();
    if (failFirst) {
      await page.getByText('합성 저장 실패', { exact: true }).waitFor();
      assert.ok(await panel.isVisible());
      assert.ok(await page.evaluate(() => window.scrollY > 0), 'failure does not reset scroll');
      if (input) assert.equal(await input.inputValue(), 'This is a synthetic practice sentence.');
      const rejected = (await (await context.request.get(base + '/api/state')).json()).state.sessions[id];
      assert.equal(rejected.stage, sample.stage);
      assert.equal(rejected.index, sample.index);
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    }
    await saved(page);
    const heading = page.getByRole('heading', { name: sample.next, exact: true });
    await heading.waitFor();
    await page.waitForFunction(name => {
      const focused = document.activeElement;
      const rect = focused?.getBoundingClientRect();
      return window.scrollY === 0 && focused?.textContent === name && rect && rect.top >= 0 && rect.bottom <= innerHeight;
    }, sample.next);
    const accepted = (await (await context.request.get(base + '/api/state')).json()).state.sessions[id];
    assert.equal(accepted.stage, sample.nextStage);
    if (sample.nextIndex !== undefined) assert.equal(accepted.index, sample.nextIndex);
    if (sample.paused) {
      assert.equal(accepted.paused, true);
      assert.equal(accepted.finished, false);
      await checkSummary(page);
    }
    if (sample.finished) assert.equal(accepted.finished, true);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

async function settingsAndBorders(browser, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('ux_layout') });
  try {
    const page = await context.newPage();
    await page.goto(base);
    await saved(page);
    await page.getByRole('tab', { name: '복습 점검', exact: true }).click();
    for (const name of ['주간 점검', '월말 쓰기']) {
      const card = page.locator('.review-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
      const sides = await card.evaluate(el => ['Top', 'Right', 'Bottom', 'Left'].map(side => {
        const css = getComputedStyle(el);
        return [css['border' + side + 'Width'], css['border' + side + 'Color'], css['border' + side + 'Style']];
      }));
      assert.equal(sides[0][0], '1px');
      assert.equal(sides[0][2], 'solid');
      for (const side of sides) assert.deepEqual(side, sides[0]);
    }
    await page.getByRole('button', { name: '학습 설정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '학습 설정', exact: true });
    const disclosures = dialog.locator('.dialog-scroll details');
    assert.deepEqual(await disclosures.locator('summary').allTextContents(), [
      '목표 배정 안내', 'AI 모델·요금 안내', '임시 입력·로그아웃', '학습일·기록 안내', '문제 진단',
    ]);
    assert.equal(await dialog.locator('details[open]').count(), 0);
    assert.equal(await dialog.getByRole('switch', { name: '복습만 하기', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('button', { name: '친숙도 다시 확인', exact: true }).count(), 1);
    const ai = dialog.locator('.ai-model-settings');
    await ai.getByRole('combobox', { name: 'AI 모델', exact: true }).waitFor();
    const layout = await dialog.locator('.dialog-scroll').evaluate(el => ({
      overflow: el.scrollWidth > el.clientWidth + 1,
      labels: [...el.querySelectorAll('[data-settings-field]')].map(row => row.querySelector('.settings-label, .astryx-switch-label')?.textContent),
    }));
    assert.equal(layout.overflow, false);
    assert.deepEqual(layout.labels, ['학습 수준', '하루 단어 목표', '복습만 하기', '주간 점검 요일', 'AI 참고 의견 모델']);
    const drafts = dialog.getByText('임시 입력·로그아웃', { exact: true });
    await drafts.click();
    await dialog.getByRole('button', { name: '임시 입력 삭제', exact: true }).click();
    await dialog.getByText('삭제 후 AI 버튼을 누르면 새 유료 요청이 될 수 있어요.', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await dialog.getByRole('group', { name: '임시 입력 삭제 확인' }).count(), 0);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await launchBrowser();
  try {
    for (const viewport of viewports) {
      for (const sample of cases) await transition(browser, viewport, sample, false);
      await settingsAndBorders(browser, viewport);
      console.log(JSON.stringify({ viewport, transitions: 5, settings: true, reviewBorders: true }));
    }
    for (const sample of [cases[0], cases[3], cases[4]]) await transition(browser, viewports[1], sample, true);
    console.log(JSON.stringify({ passed: true, successfulTransitions: 15, failedAndRetried: 3, viewportCount: 3 }));
  } finally {
    await closeBrowser(browser);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
