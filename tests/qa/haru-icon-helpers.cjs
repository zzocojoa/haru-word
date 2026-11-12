// Shared browser evidence for the approved icon placements. Synthetic local owners only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker, axePath } = require('./runtime.cjs');
const { validateEnvironment, requireDisabledAiStatus } = require('./preflight.cjs');
// Match the current app reader so comparisons include modern grammar and feedback.
const stateHeaders = { 'X-Study-Grammar': '5', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1' };

async function createIconQa(name) {
  validateEnvironment();
  await waitForWorker();
  await requireDisabledAiStatus(base, accountHeaders(name + '_preflight'));
  const engine = process.env.QA_BROWSER || 'chromium';
  const out = path.resolve('outputs', name, engine);
  fs.mkdirSync(out, { recursive: true });
  const report = {
    passed: false, engine, actualDevice: false, syntheticAccount: true,
    layouts: [], audits: [], screenshots: [], clicks: [], checks: [], errors: [], requests: [],
  };
  const browser = await launchBrowser({ engine });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', colorScheme: 'light', extraHTTPHeaders: accountHeaders(name),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      report.requests.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  });
  const getState = async () => {
    const response = await context.request.get(base + '/api/state', { headers: stateHeaders });
    assert.equal(response.status(), 200, await response.text());
    const value = await response.json();
    return { revision: value.revision, state: value.state };
  };
  const seed = async patch => {
    const { revision } = await getState();
    const response = await context.request.put(base + '/api/state', { headers: stateHeaders, data: { revision, ...patch } });
    assert.equal(response.status(), 200, await response.text());
    return getState();
  };
  const saved = () => page.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
  const settle = () => page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  });
  const capture = async (filename, fullPage = true) => {
    await page.screenshot({ path: path.join(out, filename), fullPage, animations: 'disabled' });
    report.screenshots.push(filename);
  };
  const checkIcon = async (locator, size, label) => {
    assert.equal(await locator.count(), 1, label + ' has exactly one icon');
    assert.equal(await locator.getAttribute('aria-hidden'), 'true', label + ' is decorative');
    assert.notEqual(await locator.getAttribute('focusable'), 'true', label + ' is not focusable');
    assert.ok(Number(await locator.getAttribute('tabindex') ?? -1) < 0, label + ' is outside keyboard order');
    const bounds = await locator.boundingBox();
    assert.ok(bounds && Math.abs(bounds.width - size) <= 0.5 && Math.abs(bounds.height - size) <= 0.5,
      label + ' remains ' + size + 'px: ' + JSON.stringify(bounds));
    const width = page.viewportSize().width;
    assert.ok(bounds.x >= -0.5 && bounds.x + bounds.width <= width + 0.5,
      label + ' fits the horizontal viewport: ' + JSON.stringify(bounds));
  };
  const inspect = async (label, options = {}) => {
    const { icons = [], readOnly = true, widths = [320, 390, 430, 768, 1440], textSizes = [100, 200] } = options;
    const before = readOnly ? await getState() : null;
    if (!await page.evaluate(() => typeof window.axe !== 'undefined')) await page.addScriptTag({ path: axePath });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      for (const textSize of textSizes) {
        await page.evaluate(size => {
          document.documentElement.style.fontSize = size + '%';
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, textSize);
        await settle();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
          label + ' fits ' + width + 'px at ' + textSize + '% text');
        const dialogOverflow = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], .dialog-scroll')]
          .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'
            && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
          .map(element => ({ role: element.getAttribute('role'), className: element.className, width: element.clientWidth, scrollWidth: element.scrollWidth })));
        assert.deepEqual(dialogOverflow, [], label + ' dialog content fits at ' + width + 'px / ' + textSize + '% text');
        for (const [locator, size, iconLabel] of icons) await checkIcon(locator, size, iconLabel);
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
        report.audits.push({ label, width, textSize, violations });
        assert.deepEqual(violations, [], label + ' accessibility');
        report.layouts.push({ label, width, textSize });
        if (textSize === 100 || width === 320) await capture(label + '-' + width + '-' + textSize + '.png');
      }
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '100%');
    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    if (readOnly) assert.deepEqual(await getState(), before, label + ' inspection preserves server revision and records');
  };
  const click = async (locator, label, { minSize = 44 } = {}) => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await locator.waitFor({ state: 'visible' });
      // ViewRestoration applies a newly entered view's scroll after two frames.
      // Let that transition and the resize finish before testing a user scroll.
      await settle();
      await locator.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await settle();
      const bounds = await locator.boundingBox();
      assert.ok(bounds && bounds.width >= minSize && bounds.height >= minSize,
        label + ' touch target at ' + width + ': ' + JSON.stringify(bounds));
      assert.ok(bounds.x >= -0.5 && bounds.x + bounds.width <= width + 0.5
        && bounds.y >= -0.5 && bounds.y + bounds.height <= 844.5,
      label + ' fits the viewport at ' + width + ': ' + JSON.stringify(bounds));
      assert.equal(await locator.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return !!hit && (hit === element || element.contains(hit));
      }), true, label + ' is not covered at ' + width);
      await capture('action-' + label + '-' + width + '.png', false);
      const result = { label, width, minSize, bounds, scrollY: await page.evaluate(() => window.scrollY), unobstructed: true, clicked: false };
      report.clicks.push(result);
      if (width === 320) {
        await locator.click();
        result.clicked = true;
      }
    }
  };
  let finished = false;
  const finish = async error => {
    if (finished) { if (error) throw error; return; }
    finished = true;
    let failure = error;
    if (!failure && report.errors.length) failure = new Error('Unexpected browser errors: ' + report.errors.join('; '));
    if (failure) {
      report.error = failure.stack || failure.message;
      try { await capture('failure.png', false); }
      catch (captureError) { report.failureScreenshotError = captureError.message; }
    }
    try { await closeBrowser(browser); }
    catch (cleanupError) { report.cleanupError = cleanupError.message; failure ||= cleanupError; }
    report.passed = !failure;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (failure) throw failure;
    console.log(JSON.stringify({ name, passed: true, layouts: report.layouts.length, audits: report.audits.length, screenshots: report.screenshots.length, checks: report.checks }));
  };
  return { base, engine, page, context, browser, report, out, getState, seed, saved, settle, checkIcon, inspect, capture, click, finish };
}

module.exports = { createIconQa };
