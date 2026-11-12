// Real local app, a fresh synthetic account, and read-only navigation.
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
    const screenshot = async name => {
      await page.screenshot({ path: path.join(out, name), fullPage: false, animations: 'disabled' });
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
  console.log(JSON.stringify({ passed: true, engine, layouts: report.layouts.length, screenshots: report.screenshots.length, dataPreserved: true }));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
