// Real local app, synthetic accounts, and read-only inspection after fixture setup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { validateEnvironment, requireDisabledAiStatus } = require('./qa/preflight.cjs');

const engine = process.env.QA_BROWSER || 'chromium';
const widths = [320, 390, 600, 601, 640, 641, 768, 1440];
const tabs = [
  { name: '오늘 학습', slug: 'today' },
  { name: '단어장', slug: 'library' },
  { name: '복습 점검', slug: 'review' },
  { name: '학습 기록', slug: 'log' },
];

(async () => {
  if (!['chromium', 'webkit'].includes(engine)) throw Error('Unsupported QA browser engine');
  const out = path.resolve('outputs/haru-icons', engine);
  fs.mkdirSync(out, { recursive: true });
  const report = {
    passed: false, engine, syntheticAccount: true, actualDevice: false,
    layouts: [], dialogs: [], audits: [], screenshots: [], pageErrors: [], mutations: [],
    today: { layouts: [], states: [] },
  };
  let browser, context, page, failure;
  try {
    validateEnvironment();
    await waitForWorker();
    await requireDisabledAiStatus(base, accountHeaders('haru_icons_preflight'));
    browser = await launchBrowser({ engine });
    context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
      reducedMotion: 'reduce', colorScheme: 'light',
      extraHTTPHeaders: accountHeaders('haru_icons'),
    });
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
    await page.addScriptTag({ path: axePath });
    const readState = async () => {
      const response = await context.request.get(base + '/api/state');
      assert.equal(response.status(), 200, await response.text());
      const value = await response.json();
      return { revision: value.revision, state: value.state };
    };
    const before = await readState();
    report.beforeRevision = before.revision;
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === base && url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) {
        report.mutations.push({ method: request.method(), path: url.pathname });
      }
    });
    const settle = () => page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    });
    const screenshot = async (name, fullPage = false) => {
      await page.screenshot({ path: path.join(out, name), fullPage, animations: 'disabled' });
      report.screenshots.push(name);
    };
    const audit = async label => {
      const violations = await page.evaluate(async () => (await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
      report.audits.push({ label, violations });
      assert.deepEqual(violations, [], label + ' accessibility');
    };
    const decorative = async (locator, label) => {
      assert.equal(await locator.count(), 1, label + ' has one icon');
      assert.equal(await locator.getAttribute('aria-hidden'), 'true', label + ' is decorative');
      assert.notEqual(await locator.getAttribute('focusable'), 'true', label + ' is not focusable');
      assert.ok(Number(await locator.getAttribute('tabindex') ?? -1) < 0, label + ' is outside the tab order');
    };
    const box = async (locator, label) => {
      const bounds = await locator.boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0, label + ' is visible');
      return bounds;
    };
    const approximately = (actual, expected, label) => assert.ok(
      Math.abs(actual - expected) <= 0.5, label + ': expected ' + expected + ', got ' + actual,
    );
    const mainTabs = page.getByRole('tablist', { name: '학습 화면', exact: true });
    const settings = page.getByRole('button', { name: '학습 설정', exact: true });
    const source = page.getByRole('button', { name: '학습 방식·출처', exact: true });
    const checkLayout = async (width, activeTab) => {
      const overflow = await page.evaluate(() => ({
        viewport: innerWidth, document: document.documentElement.scrollWidth,
      }));
      assert.ok(overflow.document <= overflow.viewport + 1, activeTab + ' at ' + width + 'px overflows');
      const brand = await box(page.locator('.brand-icon svg'), 'brand');
      const brandSize = width <= 600 ? 20 : 22;
      approximately(brand.width, brandSize, 'brand width at ' + width);
      approximately(brand.height, brandSize, 'brand height at ' + width);
      const settingsBox = await box(settings, 'settings');
      approximately(settingsBox.width, 44, 'settings target width');
      approximately(settingsBox.height, 44, 'settings target height');
      assert.ok(settingsBox.x >= -0.5 && settingsBox.x + settingsBox.width <= width + 0.5, 'settings fits the viewport');
      await decorative(page.locator('.brand-icon svg'), 'brand');
      await decorative(page.locator('.save-state svg'), 'save status');
      await decorative(settings.locator('svg'), 'settings');
      await decorative(page.locator('.daily-label svg'), 'date');
      await decorative(source.locator('svg'), 'source');
      assert.equal(await mainTabs.getByRole('tab').count(), 4, 'four existing main tabs');
      const tabSizes = [];
      for (const tab of tabs) {
        const trigger = mainTabs.getByRole('tab', { name: tab.name, exact: true });
        const bounds = await box(trigger, tab.name);
        const icon = await box(trigger.locator('svg'), tab.name + ' icon');
        const iconSize = width <= 640 ? 20 : 18, targetHeight = width <= 640 ? 52 : 48;
        approximately(icon.width, iconSize, tab.name + ' icon width');
        approximately(icon.height, iconSize, tab.name + ' icon height');
        assert.ok(bounds.height >= targetHeight - 0.5 && bounds.width >= 44, tab.name + ' touch target');
        assert.ok(bounds.x >= -0.5 && bounds.x + bounds.width <= width + 0.5, tab.name + ' fits the viewport');
        assert.equal(await trigger.getAttribute('aria-selected'), String(tab.name === activeTab));
        await decorative(trigger.locator('svg'), tab.name);
        tabSizes.push({ name: tab.name, width: bounds.width, height: bounds.height, iconSize: icon.width });
      }
      report.layouts.push({ width, activeTab, brandSize: brand.width, settingsTarget: settingsBox, tabs: tabSizes, overflow });
    };
    const visit = async name => {
      await mainTabs.getByRole('tab', { name, exact: true }).click();
      await page.getByRole('tabpanel', { name, exact: true }).waitFor({ state: 'visible' });
      await settle();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await settle();
    };
    const dialogCheck = async ({ trigger, title, slug, width, escape }) => {
      await trigger.focus();
      assert.equal(await trigger.evaluate(element => document.activeElement === element), true, slug + ' keyboard focus');
      await trigger.press('Enter');
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await dialog.waitFor({ state: 'visible' });
      await settle();
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, slug + ' traps focus');
      assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth + 1), false, slug + ' has no overflow');
      await screenshot(slug + '-' + width + '.png');
      await audit(slug + ' at ' + width);
      if (escape) await page.keyboard.press('Escape');
      else await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('[data-slot=dialog-overlay]').waitFor({ state: 'detached' });
      const handle = await trigger.elementHandle();
      try { await page.waitForFunction(element => document.activeElement === element, handle); }
      finally { await handle?.dispose(); }
      assert.equal(await trigger.isVisible(), true, slug + ' trigger and accessible name remain available');
      report.dialogs.push({ width, name: title, close: escape ? 'Escape' : '닫기', focusRestored: true });
    };

    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 640 ? 844 : 900 });
      for (const tab of tabs) {
        await visit(tab.name);
        await checkLayout(width, tab.name);
        if ([390, 1440].includes(width)) {
          await screenshot(tab.slug + '-' + width + '.png');
          await audit(tab.name + ' at ' + width);
        }
      }
      if ([390, 1440].includes(width)) {
        await dialogCheck({ trigger: settings, title: '학습 설정', slug: 'settings', width, escape: width === 390 });
        await dialogCheck({ trigger: source, title: '학습 방식과 자료 출처', slug: 'source', width, escape: width === 1440 });
      }
    }
    const after = await readState();
    report.afterRevision = after.revision;
    assert.deepEqual(after, before, 'navigation and dialog inspection must preserve the API revision and every stored record');
    report.dataPreserved = true;
    assert.deepEqual(report.mutations, [], 'read-only inspection must not send API mutations');

    // The existing Today/top-up/repeat QA covers learning, failed saves and score
    // preservation. These fixtures inspect the same real UI without grading or
    // starting another session, including a finished but unmeasured record.
    await context.close();
    const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
    const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
    const targets = ['arrive', 'busy', 'breakfast'].map(term => words.find(word => word.word === term));
    const ids = targets.map(word => word.id), pool = words.filter(word => word.level === 'A1').slice(0, 80);
    const sample = pool.slice(0, 20).map(word => word.id);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const previous = new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const record = (id, measured = false, day = date) => ({
      entryId: id, meaning: content[id].meaning, material: content[id], learnedOn: day,
      en: measured ? 'independent' : 'unmeasured', ko: measured ? 'independent' : 'unmeasured',
      sentenceStatus: measured ? 'written' : 'unmeasured', sentence: measured ? 'Keep this saved sentence.' : '', notes: 'Keep this note.',
    });
    const session = (kind, day, selected, finished = false) => ({
      id: crypto.randomUUID(), kind, date: day, period: kind === 'monthly' ? day.slice(0, 7) : day,
      ids: selected, warmupIds: [], stage: finished ? 'done' : kind === 'monthly' ? 'ko' : 'learn',
      index: 0, retry: [], retryMode: false, elapsed: 200, paused: true, finished,
      createdAt: day + 'T01:00:00Z', records: Object.fromEntries(selected.map(id => [id, record(id, finished, day)])),
    });
    const iconAt = async (locator, size, label) => {
      await decorative(locator, label);
      const bounds = await box(locator, label);
      approximately(bounds.width, size, label + ' width');
      approximately(bounds.height, size, label + ' height');
    };
    for (const scenario of ['initial', 'ready', 'progress', 'ended']) {
      context = await browser.newContext({
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light',
        extraHTTPHeaders: accountHeaders('haru_today_' + scenario),
      });
      page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(30_000);
      page.on('pageerror', error => report.pageErrors.push(error.message));
      if (scenario !== 'initial') {
        const blank = await readState();
        const history = session('daily', previous, [ids[0]], true);
        const progress = Object.fromEntries(pool.map(word => [word.id, { familiarity: 'uncertain' }]));
        progress[ids[0]] = {
          meaning: content[ids[0]].meaning, familiarity: 'known', en: 'help', ko: 'independent',
          sentenceStatus: 'written', needsReview: true, lastStudied: previous, studyDates: [previous],
        };
        history.records[ids[0]].en = 'help';
        const seed = {
          revision: blank.revision,
          settings: { ...blank.state.settings, level: 'A1', dailyGoal: scenario === 'ready' ? 3 : 6,
            assessments: { A1: { ids: sample, index: sample.length, marks: Object.fromEntries(sample.map(id => [id, 'uncertain'])), completed: true } } },
          progress, sessions: { [history.id]: history },
        };
        if (scenario !== 'ready') {
          const daily = session('daily', date, ids, scenario === 'ended');
          daily.records = Object.fromEntries(ids.map((id, index) => [id, record(id, index !== 1)]));
          Object.assign(daily.records[ids[2]], { ko: 'help', sentenceStatus: 'improve' });
          const monthly = session('monthly', date, ids);
          seed.sessions[daily.id] = daily;
          seed.sessions[monthly.id] = monthly;
          seed.settings.activeSessionId = daily.id;
          for (const [index, id] of ids.entries()) {
            const item = daily.records[id];
            progress[id] = { meaning: item.meaning, familiarity: 'known', en: item.en, ko: item.ko,
              sentenceStatus: item.sentenceStatus, needsReview: index === 2,
              lastStudied: date, studyDates: index === 0 ? [previous, date] : [date] };
          }
        }
        const seeded = await context.request.put(base + '/api/state', { data: seed, headers: { 'X-Study-Monthly-Carryover': '1' } });
        assert.equal(seeded.status(), 200, await seeded.text());
      }
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
      await page.addScriptTag({ path: axePath });
      const snapshot = await readState(), mutations = [];
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin === base && url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) {
          mutations.push({ method: request.method(), path: url.pathname });
        }
      });
      const home = page.locator('.home-panel'), rows = home.locator('.today-words > .today-word-row');
      const actions = scenario === 'initial' ? ['단어 20개 친숙도 확인']
        : scenario === 'ready' ? ['오늘의 학습 시작']
          : scenario === 'progress' ? ['중단한 학습 이어서']
            : ['추가 3개 학습하기', '오늘 단어 다시 보기', '오늘 단어 다시 연습', '오늘의 기록 보기'];
      for (const name of actions) await home.getByRole('button', { name, exact: true }).waitFor();
      if (scenario === 'initial' || scenario === 'ready') {
        const absent = scenario === 'initial' ? '오늘의 학습 시작' : '단어 20개 친숙도 확인';
        assert.equal(await home.getByRole('button', { name: absent, exact: true }).count(), 0, 'assessment and daily start stay distinct');
      } else {
        assert.equal(await rows.count(), 3);
        for (const summary of await rows.locator('.help-details summary').all()) await summary.click();
        assert.equal(await rows.nth(0).getByText('월말 점검 대기', { exact: true }).isVisible(), true);
        assert.equal(await rows.nth(0).locator('.status-warn').count(), 0, 'a waiting review is not a failed answer');
        assert.equal(await rows.nth(2).getByText('재학습 필요', { exact: true }).isVisible(), true);
        assert.equal(await rows.nth(2).getByText('문장 보완 필요', { exact: true }).isVisible(), true);
        assert.equal((await home.locator('.daily-metrics b').nth(1).innerText()).replace(/\s/g, ''), '2/3개',
          'the recorded count includes helped answers and excludes unmeasured work');
        if (scenario === 'ended') {
          await home.getByRole('heading', { name: '오늘 회차를 마쳤어요', exact: true }).waitFor();
          assert.equal(await rows.nth(1).getByText('미완료 연습 남음', { exact: true }).isVisible(), true);
        }
      }
      for (const width of [320, 390, 430, 768, 1440]) {
        await page.setViewportSize({ width, height: width <= 640 ? 844 : 900 });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await settle();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Today ' + scenario + ' overflow at ' + width);
        for (const name of actions) {
          const button = home.getByRole('button', { name, exact: true });
          await iconAt(button.locator('svg'), 17, name);
          const bounds = await box(button, name);
          assert.ok(bounds.height >= 44 && bounds.x >= -0.5 && bounds.x + bounds.width <= width + 0.5, name + ' remains usable');
        }
        for (const origin of await rows.locator('.daily-origin').all()) await iconAt(origin.locator('svg'), 12, await origin.innerText());
        if (scenario !== 'initial') {
          assert.ok(await rows.locator('.daily-origin.new').count() > 0, 'new learning retains its visible label');
          assert.ok(await rows.locator('.daily-origin.returning').count() > 0, 'review retains its visible label');
        }
        if (scenario === 'progress' || scenario === 'ended') {
          const neutralLabel = scenario === 'progress' ? '진행 중' : '회차 마침';
          for (const [index, label, tone] of [[0, '학습 기록함', 'status-good'], [1, neutralLabel, 'status-neutral'], [2, '학습 기록함', 'status-good'], [2, '보완 필요', 'status-warn']]) {
            const badge = rows.nth(index).locator('.status-badge').filter({ hasText: new RegExp('^' + label + '$') });
            assert.match(await badge.getAttribute('class'), new RegExp('\\b' + tone + '\\b'));
            await iconAt(badge.locator('svg'), 14, label);
          }
          assert.equal(await rows.nth(1).locator('.status-good,.status-warn').count(), 0, 'unmeasured work stays neutral');
          assert.equal(await rows.locator('.status-good').count(), 2, 'recorded means measured, including an answer that needs help');
        }
        await screenshot('today-' + scenario + '-' + width + '.png', true);
        await audit('Today ' + scenario + ' at ' + width);
        report.today.layouts.push({ scenario, width, actions, rowCount: await rows.count() });
      }
      if (scenario === 'ended') {
        await home.getByRole('button', { name: '오늘의 기록 보기', exact: true }).click();
        await page.getByRole('tabpanel', { name: '학습 기록', exact: true }).waitFor({ state: 'visible' });
        assert.equal(await page.getByRole('tab', { name: '학습 기록', exact: true }).getAttribute('aria-selected'), 'true');
        await page.getByRole('tab', { name: '오늘 학습', exact: true }).click();
        await home.waitFor({ state: 'visible' });
      }
      const inspected = await readState();
      assert.deepEqual(inspected, snapshot, scenario + ' inspection preserves the API revision and stored scores');
      assert.deepEqual(mutations, [], scenario + ' inspection sends no writes');
      report.today.states.push({ scenario, beforeRevision: snapshot.revision, afterRevision: inspected.revision, dataPreserved: true });
      await context.close();
    }
    assert.deepEqual(report.pageErrors, []);
    report.passed = true;
  } catch (error) {
    failure = error;
    report.error = error.stack || error.message;
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: false, timeout: 5000 });
        report.failureScreenshot = 'failure.png';
      } catch (captureError) { report.failureScreenshotError = captureError.message; }
    }
  } finally {
    // The shared helper closes every context before closing the browser.
    if (browser) {
      try { await closeBrowser(browser); }
      catch (error) {
        report.cleanupError = error.message;
        failure ||= error;
      }
    }
    if (failure) report.passed = false;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ passed: true, engine, layouts: report.layouts.length, todayLayouts: report.today.layouts.length, screenshots: report.screenshots.length, dataPreserved: true }));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
