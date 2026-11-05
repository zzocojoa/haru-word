// UI-3 built-Worker regression adapted from the frozen audit probe. Prepare now; run only when the root reviewer schedules
// an isolated loopback browser slot. No product source or hosted state is changed.
// Expected: input accepted AFTER reload confirmation must survive or be blocked.
// A confirmed result requires loss from UI + real D1 + native backing storage.
// Refutation is recorded and exits nonzero; setup/automation errors are separate.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const source = path.resolve(__dirname, '..');
process.chdir(source);
const req = createRequire(path.join(source, 'package.json'));
const { build } = req('esbuild');
const { base, accountHeaders, launchBrowser, closeBrowser } = req('./tests/qa/runtime.cjs');
const { emptyState } = req('./tests/fixtures/backup-history.cjs');
const engine = process.env.QA_BROWSER || 'chromium';
const quota=process.argv[2]==='quota';
assert.ok(['chromium', 'webkit'].includes(engine));
const out = path.join(source, 'outputs/comprehensive-remediation-browser/reload-input'+(quota?'-quota':''), engine);
fs.mkdirSync(out, { recursive: true });
const sentences = {
  server: 'Original synthetic D1 sentence.',
  beforeConfirmation: 'Synthetic edit before reload confirmation.',
  afterConfirmation: 'New synthetic input accepted after reload confirmation.',
};
const timeouts = { action: 7000, navigation: 30000, api: 15000, hold: 14000, readiness: 11000 };
const conflictBody = { error: '다른 기기에서 기록이 바뀌었습니다. 현재 입력을 백업한 뒤 최신 기록을 불러와 주세요.', conflict: true };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  // A route can fail before the controlling scenario starts awaiting it.
  promise.catch(() => {});
  return { promise, resolve, reject };
};
async function bounded(promise, ms, name) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(name + ' timed out')), ms); })]); }
  finally { clearTimeout(timer); }
}
const progress = [], methods = [], errors = [], routeErrors = [], blockedAi = [], externalBlocked = [], warnings = [];
let browser, context, page, phase = 'setup', reproSetupValid = false, before = null, after = null, acceptedDuringHold = false;
let holdNextGet = false, injectNextPutConflict = false, holdTimer, holdExpired = false, closing = false;
const reloadGate = deferred(), reloadReady = deferred(), reloadFulfilled = deferred(), conflictSeen = deferred();
const pendingPuts = new Set();
let heldSnapshot, heldMethod = null;
function step(name) {
  phase = name; progress.push({ name, at: new Date().toISOString() });
  fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify(progress, null, 2));
  console.log('STAGE ' + name);
}
const scope = {
  boundary: 'remediation built app + synthetic loopback D1 + actual grammar textarea',
  syntheticAccounts: 1, productionWrites: 0, actualProviderCalls: 0,
  injectedFaults: ['localStorage getter SecurityError', 'one valid state PUT409 without committing', 'one real state GET200 response body held'],
  noProductHookOrStoreSeam: true,
  storageObservation: 'test-only closure captures native storage before getter denial; product still receives SecurityError; closure performs reads only',
};
function result(outcome, reason) {
  return { passed:outcome==='protected', confirmed: outcome === 'confirmed', refuted: outcome === 'refuted', outcome, reason, engine, sourceHead: '5609a8e6fa7d148ff4cf6582ae20fe0ed2669171',
    reproSetupValid, phase, before, after, acceptedDuringHold, holdExpired, heldMethod, scopes: scope, methods,
    pageErrors: errors, routeErrors, blockedAi, externalBlocked, warnings, progress };
}
function writeResult(outcome, reason) { const value = result(outcome, reason); fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(value, null, 2)); return value; }
function refute(reason) {
  writeResult('refuted', reason);
  try { assert.fail('FINDING_REFUTED: ' + reason); }
  catch (error) { error.auditOutcome = 'refuted'; throw error; }
}
async function storageSnapshot() {
  return page.evaluate(() => window.__reloadInputLossStorageProbe());
}
async function snapshot(label) {
  const response = await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '4' }, timeout: timeouts.api });
  methods.push({ source: 'direct-synthetic-D1-read', phase, label, method: 'GET', path: '/api/state', status: response.status() });
  assert.equal(response.status(), 200, label + ': actual state GET must succeed');
  return response.json();
}
async function screenshot(name) {
  if (!page || page.isClosed()) return;
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true, timeout: 5000 }).catch(error => warnings.push({ screenshot: name, error: error.message }));
}
(async () => {
  try {
    await build({ entryPoints: ['lib/grammar/model.ts', 'lib/grammar/practice.ts', 'lib/grammar/content-v4.ts'],
      outdir: path.join(out, 'modules'), bundle: true, platform: 'node', format: 'cjs', outExtension: { '.js': '.cjs' }, logLevel: 'silent' });
    const { grammarProgressSchema } = require(path.join(out, 'modules', 'model.cjs'));
    const { newLessonProgress } = require(path.join(out, 'modules', 'practice.cjs'));
    const { PRACTICE_LESSONS_V4 } = require(path.join(out, 'modules', 'content-v4.cjs'));
    const lesson = PRACTICE_LESSONS_V4.noun;
    const answered = q => ({ first: q.answer, latest: q.answer, helped: false, attempts: 1 });
    const seed = { ...newLessonProgress('noun', '2026-11-01T00:00:00.000Z', 4), stage: 5,
      observation: answered(lesson.observation), answers: Object.fromEntries(lesson.questions.map((q, i) => ['q' + (i + 1), answered(q)])), sentence: sentences.server };
    assert.equal(grammarProgressSchema.safeParse(seed).success, true, 'setup: valid incomplete stage5 grammar seed');
    const identity = accountHeaders('reload_input_loss');
    browser = await launchBrowser({ engine });
    context = await browser.newContext({ extraHTTPHeaders: identity, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(timeouts.action); context.setDefaultNavigationTimeout(timeouts.navigation);
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { const url = new URL(request.url()); if (url.origin === base && url.pathname === '/api/state' && request.method() === 'PUT') pendingPuts.add(request); });
    page.on('requestfinished', request => pendingPuts.delete(request));
    page.on('requestfailed', request => {
      pendingPuts.delete(request);
      const url = new URL(request.url());
      if (url.origin === base && url.pathname === '/api/state') methods.push({ source: 'browser-request-failed', phase, method: request.method(), path: url.pathname, failure: request.failure()?.errorText ?? 'unknown' });
    });
    page.on('response', response => { const url = new URL(response.url()); if (url.origin === base && url.pathname === '/api/state') methods.push({ source: 'browser-response', phase, method: response.request().method(), path: url.pathname, status: response.status() }); });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      try {
        if (url.origin !== base) { externalBlocked.push(url.origin); return await route.abort(); }
        if (request.method() === 'POST' && /feedback|automation|ai-eval/.test(url.pathname)) {
          blockedAi.push(url.pathname); return await route.abort();
        }
        if (url.pathname === '/api/state' && request.method() === 'PUT' && injectNextPutConflict) {
          injectNextPutConflict = false;
          const body = request.postDataJSON();
          assert.equal(body.grammar?.noun?.sentence, sentences.beforeConfirmation, 'setup: conflict belongs to the initial edit');
          methods.push({ source: 'injected-conflict', phase, method: 'PUT', path: url.pathname, status: 409, revision: body.revision });
          await route.fulfill({ status: 409, json: conflictBody });
          conflictSeen.resolve(); return;
        }
        if (url.pathname === '/api/state' && request.method() === 'GET' && holdNextGet) {
          holdNextGet = false;
          const response = await route.fetch({ timeout: timeouts.api });
          assert.equal(response.status(), 200, 'setup: held reload fetch is a real successful D1 read');
          heldSnapshot = await response.json();
          assert.equal(heldSnapshot.state.grammar.noun.sentence, sentences.server, 'setup: held D1 snapshot still has the original sentence');
          heldMethod = { method: 'GET', status: response.status(), revision: heldSnapshot.revision, realD1Response: true };
          step('reload-real-GET200-held');
          holdTimer = setTimeout(() => { holdExpired = true; reloadGate.resolve(); }, timeouts.hold);
          reloadReady.resolve();
          await reloadGate.promise;
          clearTimeout(holdTimer);
          if (closing) { await route.abort().catch(() => {}); reloadFulfilled.resolve(); return; }
          await route.fulfill({ response });
          reloadFulfilled.resolve(); return;
        }
        return await route.continue();
      } catch (error) {
        if (!closing) routeErrors.push({ phase, method: request.method(), path: url.pathname, error: error.message });
        reloadReady.reject(error); conflictSeen.reject(error); reloadFulfilled.reject(error);
        await route.abort().catch(() => {});
      }
    });
    await page.addInitScript(({ owner, phrases,quota }) => {
      let backing, backingError = null;
      try { backing = window.localStorage; } catch (error) { backingError = error.name; }
      if(quota)Storage.prototype.setItem=function(){throw new DOMException('Synthetic quota for UI-3','QuotaExceededError');};
      else Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Synthetic storage denial for UI-3', 'SecurityError'); } });
      Object.defineProperty(window, '__reloadInputLossStorageProbe', { configurable: true, value: () => {
        let getterDenied = false;
        try { void window.localStorage; } catch (error) { getterDenied = error.name === 'SecurityError'; }
        if (!backing) return { getterDenied, backingAvailable: false, backingError, ownerRows: null, totalDraftRows: null, containsAfterConfirmation: null };
        const prefix = 'haru-words:local-input:v1:', own = prefix + encodeURIComponent(owner) + ':';
        const keys = Array.from({ length: backing.length }, (_, i) => backing.key(i)).filter(Boolean);
        const rows = keys.filter(key => key.startsWith(own));
        return { getterDenied, backingAvailable: true, ownerRows: rows.length, totalDraftRows: keys.filter(key => key.startsWith(prefix)).length,
          containsAfterConfirmation: rows.some(key => (backing.getItem(key) || '').includes(phrases.afterConfirmation)) };
      } });
    }, { owner: identity['oai-authenticated-user-id'], phrases: sentences,quota });
    const initial = await snapshot('initial');
    const restored = await context.request.post(base + '/api/state/restore', { timeout: timeouts.navigation,
      headers: { 'X-Study-Grammar': '4', 'X-Study-Revision': String(initial.revision) },
      data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state: { ...emptyState(), grammar: { noun: seed } } } });
    methods.push({ source: 'synthetic-fixture-seed', phase, method: 'POST', path: '/api/state/restore', status: restored.status() });
    assert.equal(restored.status(), 200, 'setup: synthetic D1 seed must be accepted');
    assert.equal((await snapshot('seed-verified')).state.grammar.noun.sentence, sentences.server);
    step('valid-synthetic-stage5-seeded');
    await page.goto(base);
    await page.getByText('저장됨', { exact: true }).first().waitFor();
    await page.getByRole('tab', { name: '단어장', exact: true }).click();
    await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click();
    await page.locator('.grammar-tile').first().click();
    const input = page.getByRole('textbox', { name: '내 문장', exact: true });
    await input.waitFor(); assert.equal(await input.inputValue(), sentences.server);
    const initialStorage = await storageSnapshot();
    assert.equal(initialStorage.getterDenied, !quota, 'setup: expected storage failure is active');
    assert.equal(initialStorage.backingAvailable, true, 'setup: separate read-only backing observation is available');
    assert.equal(initialStorage.ownerRows, 0, 'setup: fresh synthetic context has no owner recovery row');
    step('real-grammar-editor-ready-storage-denied');
    injectNextPutConflict = true;
    await input.fill(sentences.beforeConfirmation);
    await bounded(conflictSeen.promise, timeouts.readiness, 'initial edit PUT409');
    const banner = page.getByRole('alert').filter({ hasText: conflictBody.error });
    await banner.waitFor();
    const conflictServer = await snapshot('after-injected409');
    assert.equal(conflictServer.state.grammar.noun.sentence, sentences.server, 'setup: rejected edit did not reach D1');
    const oldInput = await input.elementHandle();
    await banner.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await confirmation.waitFor();
    // The modal makes the background aria-hidden. Read the already captured
    // input handle without treating it as an interactable modal descendant.
    assert.equal(await oldInput.inputValue(), sentences.beforeConfirmation);
    step('reload-confirmation-open');
    holdNextGet = true;
    await confirmation.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
    await bounded(reloadReady.promise, timeouts.readiness, 'confirmed reload real GET hold');
    await confirmation.waitFor({ state: 'hidden' });
    assert.equal(holdExpired, false, 'setup: held GET has not timed out or released early');
    reproSetupValid = true;
    const editorPresent = await input.count() === 1;
    const editorVisible = editorPresent && await input.isVisible();
    const editable = editorVisible && await input.isEditable();
    before = { serverSentence: conflictServer.state.grammar.noun.sentence, beforeConfirmationSentence: sentences.beforeConfirmation,
      heldGetSentence: heldSnapshot.state.grammar.noun.sentence, heldGetRevision: heldSnapshot.revision,
      editorPresentDuringGet: editorPresent, editorVisibleDuringGet: editorVisible, editorEditableDuringGet: editable,
      currentInputBeforeNewTyping: editorPresent ? await input.inputValue() : null, storage: await storageSnapshot(), pendingPuts: pendingPuts.size };
    if (editable) {
      // Actual user-facing input only. Never set React/store state through evaluate.
      await input.fill(sentences.afterConfirmation, { timeout: 2500 });
      acceptedDuringHold = await input.inputValue() === sentences.afterConfirmation;
    }
    before.acceptedInputValue = editorPresent ? await input.inputValue() : null;
    before.newInputAccepted = acceptedDuringHold;
    before.storageAfterTyping = await storageSnapshot();
    assert.equal(holdExpired, false, 'setup: new typing was attempted while the GET was still held');
    await screenshot('during-held-reload');
    step(acceptedDuringHold ? 'new-input-accepted-during-confirmed-reload' : 'new-input-blocked-during-confirmed-reload');
    reloadGate.resolve();
    await bounded(reloadFulfilled.promise, timeouts.readiness, 'held real GET delivery');
    assert.equal(holdExpired, false, 'setup: scenario explicitly released the GET before its deadline');
    // Let the real 500ms grammar queue/effects settle. If an implementation
    // preserves and saves the new input, its genuine PUT is allowed and refutes loss.
    await page.waitForTimeout(800);
    // A successful whole-state reload remounts the library in its word-list
    // view. Reopen the same saved lesson to inspect user-recoverable input.
    let editorReopenedAfterEpoch = false;
    if (await input.count() === 0 || !await input.isVisible()) {
      await page.getByRole('tab', { name: '단어장', exact: true }).click();
      await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click();
      await page.locator('.grammar-tile').first().click();
      await input.waitFor({ state: 'visible' });
      editorReopenedAfterEpoch = true;
    }
    const putsDeadline = Date.now() + timeouts.action;
    while (pendingPuts.size && Date.now() < putsDeadline) await page.waitForTimeout(50);
    assert.equal(pendingPuts.size, 0, 'setup: no incomplete save obscures the after observation');
    const afterServer = await snapshot('after-reload-settled');
    const afterStorage = await storageSnapshot();
    after = { inputValue: await input.inputValue(), serverSentence: afterServer.state.grammar.noun.sentence,
      serverRevision: afterServer.revision, storage: afterStorage, oldEditorDetached: oldInput ? !await oldInput.evaluate(element => element.isConnected) : null,
      pendingPuts: pendingPuts.size, editorReopenedAfterEpoch };
    await oldInput?.dispose();
    assert.deepEqual(routeErrors, [], 'setup: no route interception errors');
    assert.deepEqual(errors, [], 'setup: no page errors');
    assert.deepEqual(blockedAi, [], 'scope: no AI attempt');
    assert.equal(afterStorage.getterDenied, !quota, 'setup: expected storage failure remains installed');
    assert.equal(afterStorage.backingAvailable, true, 'setup: native backing store can still be observed');
    assert.equal(acceptedDuringHold,false,'replacement GET must not accept new input');
    assert.equal(before.editorEditableDuringGet,false,'replacement input is locked');
    if (after.inputValue === sentences.afterConfirmation || after.serverSentence === sentences.afterConfirmation || afterStorage.containsAfterConfirmation) {
      refute('The newly accepted input survived in the real UI, D1, or a device recovery row.');
    }
    assert.equal(after.oldEditorDetached, true, 'setup: actual old editor was replaced after the reload epoch');
    assert.equal(after.inputValue, sentences.server, 'UI-3: reloaded editor reverted to the original D1 sentence');
    assert.equal(after.serverSentence, sentences.server, 'UI-3: new input was not preserved on the server');
    assert.equal(afterStorage.ownerRows, 0, 'UI-3: no owner draft survives for recovery');
    assert.equal(afterStorage.totalDraftRows, 0, 'UI-3: no other fresh-context draft copy exists');
    step('replacement-input-protected');
    await screenshot('after-reload');
    const report = writeResult('protected', 'The real editor rejects new input while the confirmed snapshot replacement GET is pending.');
    console.log(JSON.stringify(report));
  } catch (error) {
    const outcome = error.auditOutcome === 'refuted' ? 'refuted' : 'probe-setup-error';
    if (outcome !== 'refuted') writeResult(outcome, error.message);
    const failure = { ...result(outcome, error.message), classification: outcome === 'refuted' ? 'finding-refuted-by-observation' : 'fixture-or-observation-setup-failed; not product-defect evidence',
      error: { name: error.name, message: error.message },
      visibleSyntheticPage: page && !page.isClosed() ? await page.locator('body').innerText({ timeout: 1000 }).catch(() => '') : null };
    fs.writeFileSync(path.join(out, 'probe-failure.json'), JSON.stringify(failure, null, 2));
    await screenshot('probe-failure'); throw error;
  } finally {
    closing = true; holdNextGet = false; clearTimeout(holdTimer); reloadGate.resolve();
    // Always release held routes before closing the owned browser. Cleanup errors
    // must not replace an earlier failure, but remain visible in their own artifact.
    if (browser) {
      await bounded(closeBrowser(browser), 15000, 'owned browser cleanup').catch(error => {
        fs.writeFileSync(path.join(out, 'cleanup-failure.json'), JSON.stringify({ error: error.message, phase }, null, 2)); process.exitCode = 1;
      });
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
