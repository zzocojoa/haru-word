// Real loopback Worker, synthetic owner; shared components without an app consumer
// use an isolated in-memory QA page, never an added product route.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { createIconQa } = require('./qa/haru-icon-helpers.cjs');
const { currentAiHeaders } = require('./qa/openai-fixture.cjs');

(async () => {
  const qa = await createIconQa('haru-system-icons');
  const { page, context, base, report } = qa;
  let failure, startupPage, startupInterceptionActive = false;
  const startupRouteErrors = [];
  const closeStartupInspection = async () => {
    if (!startupPage) return;
    const errors = [];
    if (startupInterceptionActive) {
      // Drain route callbacks before closing the startup-only context.
      try { await startupPage.unrouteAll({ behavior: 'wait' }); }
      catch (error) { errors.push(error); }
      finally { startupInterceptionActive = false; }
    }
    errors.push(...startupRouteErrors);
    try { await startupPage.context().close(); startupPage = undefined; }
    catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'Startup request handling or context cleanup failed');
  };
  const svg = locator => locator.locator('svg');
  const button = name => page.getByRole('button', { name, exact: true });
  const settingsTrigger = button('학습 설정');
  const settings = page.getByRole('dialog', { name: '학습 설정', exact: true });
  const compactMatrix = { widths: [320, 1440], textSizes: [100, 200] };
  const draftRows = () => page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('haru-words:local-input:v1:'))
    .map(key => [key, localStorage.getItem(key)]).sort(([a], [b]) => a.localeCompare(b)));
  const waitDraft = text => page.waitForFunction(value => Object.keys(localStorage)
    .filter(key => key.startsWith('haru-words:local-input:v1:'))
    .some(key => JSON.parse(localStorage.getItem(key)).values?.sentence === value), text);
  const waitValue = (locator, value) => page.waitForFunction(({ id, value }) => document.getElementById(id)?.value === value,
    { id: 'my-sentence', value }).then(async () => assert.equal(await locator.inputValue(), value));
  const changeAndSave = async action => {
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/state'
      && response.request().method() === 'PUT');
    await action(); assert.equal((await response).status(), 200); await qa.saved();
  };
  const openSettings = async () => {
    await settingsTrigger.focus(); await settingsTrigger.press('Enter'); await settings.waitFor();
    await settings.getByText('AI 의견 요청 기능이 현재 꺼져 있어요.', { exact: true }).waitFor();
  };
  const closeSettings = async () => {
    await page.keyboard.press('Escape'); await settings.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '학습 설정');
  };
  page.on('dialog', dialog => void (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()));
  try {
    const initial = await qa.getState();
    const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
    const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
    const word = words.find(item => item.word === 'apple' && item.pos === 'n.');
    assert.ok(word);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const previous = new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const session = (day, finished) => ({
      id: crypto.randomUUID(), kind: 'daily', date: day, period: day, ids: [word.id], warmupIds: [],
      stage: finished ? 'done' : 'sentence', index: 0, retry: [], retryMode: false, elapsed: 12,
      paused: true, finished, createdAt: day + 'T01:00:00Z',
      records: { [word.id]: { entryId: word.id, meaning: content[word.id].meaning, material: content[word.id],
        en: 'independent', ko: 'help', sentenceStatus: finished ? 'written' : 'unmeasured',
        sentence: finished ? 'Preserve this historical sentence.' : 'Existing server sentence.', notes: '' } },
    });
    const history = session(previous, true), lesson = session(date, false);
    const seeded = await qa.seed({
      settings: { ...initial.state.settings, level: 'A1', dailyGoal: 3, activeSessionId: lesson.id },
      progress: { [word.id]: { meaning: content[word.id].meaning, familiarity: 'known',
        en: 'independent', ko: 'help', sentenceStatus: 'written', lastStudied: previous, studyDates: [previous] } },
      sessions: { [history.id]: history, [lesson.id]: lesson },
    });
    // Keep the real server HTML/CSS, but suppress app hydration in a context
    // that never loads the real app. Both contexts use the same synthetic owner.
    // Pending scripts can prevent WebKit's document.fonts.ready from settling;
    // empty JS lets load finish without bypassing font/layout/screenshot waits.
    startupPage = await qa.createIsolatedPage();
    report.startupMode = 'isolated-context-server-html-with-app-scripts-suppressed';
    report.startupPhase = 'navigation';
    report.startupScriptsSuppressed = 0;
    report.startupScriptPaths = [];
    const startupScripts = async route => {
      try {
        const request = route.request(), url = new URL(request.url());
        if (request.resourceType() === 'script' && url.origin === base) {
          report.startupScriptsSuppressed++;
          report.startupScriptPaths.push(url.pathname);
          return await route.fulfill({ status: 200, contentType: 'application/javascript',
            headers: { 'cache-control': 'no-store' }, body: '/* Startup-only QA: application scripts are suppressed. */' });
        }
        await route.continue();
      } catch (error) {
        // Route callbacks run outside the test promise. Re-throw after draining
        // so qa.finish records the failure instead of losing the whole report.
        startupRouteErrors.push(error);
        report.startupRouteErrors = startupRouteErrors.map(item => item.stack || item.message);
      }
    };
    startupInterceptionActive = true;
    await startupPage.route('**/*', startupScripts);
    await startupPage.goto(base, { waitUntil: 'load' });
    report.startupPhase = 'inspection';
    await startupPage.locator('.app-splash').waitFor();
    assert.ok(report.startupScriptsSuppressed > 0, 'Startup-only script suppression is exercised');
    await qa.inspect('startup', { page: startupPage, diagnostics: true,
      icons: [[startupPage.locator('.app-splash-brand > svg'), 72, 'P104 startup brand']] });
    assert.equal(await startupPage.locator('.app-splash').isVisible(), true, 'The server startup screen remains present throughout inspection');
    report.startupPhase = 'startup-context-cleanup';
    await closeStartupInspection();
    report.startupPhase = 'application-navigation';
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await qa.saved();
    await page.locator('.app-splash').waitFor({ state: 'hidden' });
    report.startupPhase = 'application-ready';
    const links = await page.locator('head link[rel="icon"],head link[rel="apple-touch-icon"],head link[rel="apple-touch-startup-image"]').evaluateAll(nodes =>
      nodes.map(node => ({ rel: node.rel, href: new URL(node.href).pathname, sizes: node.getAttribute('sizes') })));
    assert.ok(links.some(link => link.href === '/favicon.svg'));
    assert.ok(links.some(link => link.href === '/apple-touch-icon.png' && link.sizes === '180x180'));
    assert.equal(links.filter(link => link.rel === 'apple-touch-startup-image').length, 26);
    for (const url of ['/favicon.svg', '/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png', '/app-icon-192.png', '/app-icon-512.png']) {
      const response = await context.request.get(base + url); assert.equal(response.status(), 200, url);
      assert.ok((await response.body()).length > 100, url + ' has an actual asset');
    }
    report.checks.push('P101–105: actual server startup HTML/CSS with app scripts suppressed only in an isolated context; a clean context loads the real app for the same synthetic owner; unchanged favicon/home-screen metadata, 26 iOS declarations and local asset responses');

    await openSettings();
    const goal = settings.getByRole('combobox', { name: '하루 목표', exact: true });
    const pause = settings.getByRole('checkbox', { name: '새 단어 쉬기 · 복습만 하기', exact: true });
    const icons = [
      ['학습 수준', 18], ['하루 목표 단어 수', 18], ['새 단어 쉬기 · 복습만 하기', 18], ['주간 점검 요일', 18], ['AI 참고 의견 모델', 20],
    ].map(([name, size]) => [settings.locator('.settings-label').filter({ hasText: name }).locator('svg'), size, name]);
    icons.push([svg(settings.getByRole('button', { name: '친숙도 다시 확인하기', exact: true })), 18, 'P085 reassessment'],
      [svg(settings.getByRole('button', { name: '이 기기의 임시 입력 삭제', exact: true })), 18, 'P087 local delete'],
      [svg(settings.getByRole('link', { name: '임시 입력을 지우고 로그아웃', exact: true })), 18, 'P088 local logout'],
      [svg(settings.getByRole('button', { name: '닫기', exact: true })), 16, 'P095 dialog close'],
      [svg(goal), 16, 'P097 select trigger']);
    await qa.inspect('settings', { icons });
    assert.equal(await pause.evaluate(element => element.tagName + ':' + element.type), 'INPUT:checkbox');
    assert.equal(await settings.getByRole('combobox', { name: 'AI 모델', exact: true }).isEnabled(), true,
      'the existing model preference stays editable while AI generation is disabled');
    const beforeMenu = await qa.getState();
    // Radix intentionally dismisses Select on window resize. Set each viewport
    // before opening, so this checks the real menu without changing that policy.
    for (const width of compactMatrix.widths) for (const textSize of compactMatrix.textSizes) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(size => document.documentElement.style.fontSize = size + '%', textSize);
      await qa.settle(); await goal.focus(); await goal.press('Space'); await page.getByRole('listbox').waitFor();
      await qa.inspect('goal-options-' + width + '-' + textSize, { widths: [width], textSizes: [textSize],
        icons: [[page.getByRole('option', { name: '3개 · 기본 목표', exact: true }).locator('svg'), 16, 'P098 selected option']] });
    }
    await goal.focus(); await goal.press('Space'); await page.getByRole('listbox').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await goal.evaluate(element => element === document.activeElement), true);
    assert.deepEqual(await qa.getState(), beforeMenu, 'opening and cancelling selection is read-only');
    const waitForOptionFocus = async (name, selected) => {
      const option = page.getByRole('option', { name, exact: true });
      await option.waitFor();
      const element = await option.elementHandle();
      assert.ok(element, name + ' exists');
      try {
        await page.waitForFunction(({ element, selected }) => document.activeElement === element
          && element.getAttribute('aria-selected') === String(selected), { element, selected });
      } finally { await element.dispose(); }
    };
    const waitForTriggerFocus = async name => {
      const evidence = { name };
      (report.triggerFocus ??= []).push(evidence);
      try {
        await page.waitForFunction(name => {
          const active = document.activeElement;
          return active?.closest('.settings-dialog') && active.getAttribute('aria-label') === name
            && active.getAttribute('role') === 'combobox' && !active.disabled;
        }, name);
        evidence.returned = true;
      } finally {
        try {
          evidence.finalState = await page.evaluate(name => {
            const target = [...document.querySelectorAll('.settings-dialog [role="combobox"]')].find(element => element.getAttribute('aria-label') === name);
            const active = document.activeElement;
            return { targetPresent: !!target, targetDisabled: target?.disabled, targetFocused: !!target && target === active,
              activeTag: active?.tagName, activeRole: active?.getAttribute('role'), activeLabel: active?.getAttribute('aria-label') };
          }, name);
        } catch (error) { evidence.snapshotError = error.message; }
      }
    };
    const chooseOption = async (control, currentName, nextName) => {
      await control.focus(); await control.press('Space'); await page.getByRole('listbox').waitFor();
      await waitForOptionFocus(currentName, true);
      await page.getByRole('option', { name: nextName, exact: true }).focus();
      await waitForOptionFocus(nextName, false);
      await page.keyboard.press('Enter'); await page.getByRole('listbox').waitFor({ state: 'hidden' });
    };
    // Radix defers navigation focus with setTimeout. Observe each real keyboard
    // destination before the next key so Enter cannot select the previous item.
    await changeAndSave(async () => {
      await goal.focus(); await goal.press('Space'); await page.getByRole('listbox').waitFor();
      await waitForOptionFocus('3개 · 기본 목표', true);
      await page.keyboard.press('Home'); await waitForOptionFocus('1개', false);
      await page.keyboard.press('ArrowDown'); await waitForOptionFocus('2개', false);
      await page.keyboard.press('Enter'); await page.getByRole('listbox').waitFor({ state: 'hidden' });
    });
    assert.equal((await goal.innerText()).trim(), '2개');
    assert.equal((await qa.getState()).state.settings.dailyGoal, 2);
    await waitForTriggerFocus('하루 목표');
    await changeAndSave(async () => {
      await goal.focus(); await goal.press('Space'); await page.getByRole('listbox').waitFor();
      await waitForOptionFocus('2개', true);
      await page.keyboard.press('ArrowDown'); await waitForOptionFocus('3개 · 기본 목표', false);
      await page.keyboard.press('Enter'); await page.getByRole('listbox').waitFor({ state: 'hidden' });
    });
    assert.equal((await goal.innerText()).trim(), '3개 · 기본 목표');
    assert.equal((await qa.getState()).state.settings.dailyGoal, 3);
    // Select restores focus asynchronously. Observe that return before moving
    // to the next native control, so Space cannot be stolen by closing content.
    const goalFocusState = () => goal.evaluate(element => {
      const active = document.activeElement;
      return {
        goal: { focused: element === active, disabled: element.disabled, expanded: element.getAttribute('aria-expanded'),
          state: element.getAttribute('data-state'), ariaLabel: element.getAttribute('aria-label') },
        active: { tag: active?.tagName, id: active?.id, role: active?.getAttribute('role'),
          ariaLabel: active?.getAttribute('aria-label'), slot: active?.getAttribute('data-slot') },
        visibleListboxes: [...document.querySelectorAll('[role="listbox"]')].filter(node => node.getClientRects().length).length,
      };
    });
    report.goalFocusReturn = { before: await goalFocusState() };
    try {
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '하루 목표');
    } finally {
      try { report.goalFocusReturn.after = await goalFocusState(); }
      catch (error) { report.goalFocusReturn.snapshotError = error.message; }
    }
    await qa.settle();
    report.pauseCheckbox = [];
    for (const checked of [true, false]) {
      const attempt = { expectedChecked: checked, saves: [] };
      report.pauseCheckbox.push(attempt);
      const snapshot = () => pause.evaluate(element => ({
        focused: element === document.activeElement, checked: element.checked, disabled: element.disabled,
        activeTag: document.activeElement?.tagName, activeLabel: document.activeElement?.getAttribute('aria-label'),
      }));
      const selector = '.settings-dialog .check-label input[type="checkbox"]';
      try {
        await page.waitForFunction(selector => {
          const element = document.querySelector(selector);
          return element instanceof HTMLInputElement && !element.disabled;
        }, selector);
        await pause.focus(); await qa.settle();
        await page.waitForFunction(selector => {
          const element = document.querySelector(selector);
          return element instanceof HTMLInputElement && element === document.activeElement && !element.disabled;
        }, selector);
        attempt.beforeSpace = await snapshot();
        assert.equal(await pause.isChecked(), !checked, 'Space starts from the opposite native state');
        const [response] = await Promise.all([
          page.waitForResponse(response => {
            if (new URL(response.url()).pathname !== '/api/state' || response.request().method() !== 'PUT') return false;
            const payload = response.request().postDataJSON();
            attempt.saves.push({ revision: payload?.revision, newWordsPaused: payload?.settings?.newWordsPaused, status: response.status() });
            return payload?.settings?.newWordsPaused === checked;
          }),
          page.keyboard.press('Space'),
        ]);
        assert.equal(response.status(), 200, 'The intended checkbox setting is accepted');
        attempt.responseRevision = (await response.json()).revision;
        await page.waitForFunction(({ selector, checked }) => {
          const element = document.querySelector(selector);
          return element instanceof HTMLInputElement && element.checked === checked && !element.disabled;
        }, { selector, checked });
        await qa.saved();
        assert.equal(await pause.isChecked(), checked);
        attempt.serverChecked = !!(await qa.getState()).state.settings.newWordsPaused;
        assert.equal(attempt.serverChecked, checked);
      } finally {
        try { attempt.finalState = await snapshot(); }
        catch (error) { attempt.snapshotError = error.message; }
      }
    }
    // Exercise each settings-only focus return through the real save path.
    // Model choices come from the local status response; no generation is requested.
    const statusResponse = await context.request.get(base + '/api/sentence-feedback', { headers: currentAiHeaders });
    assert.equal(statusResponse.status(), 200);
    const modelStatus = await statusResponse.json();
    assert.equal(modelStatus.enabled, false, 'Real AI generation remains disabled');
    const originalModel = modelStatus.models.find(model => model.id === modelStatus.model && model.enabled);
    const otherModel = modelStatus.models.find(model => model.enabled && model.id !== modelStatus.model);
    assert.ok(originalModel && otherModel, 'The synthetic profile provides two enabled preference choices');
    const originalDay = seeded.state.settings.reviewDay ?? 0;
    const otherDay = (originalDay + 1) % 7;
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    report.settingsFocus = [];
    for (const { name, key, choices } of [
      { name: '주간 점검 요일', key: 'reviewDay', choices: [{ value: otherDay, label: dayNames[otherDay] }, { value: originalDay, label: dayNames[originalDay] }] },
      { name: '학습 수준', key: 'level', choices: [{ value: 'A2', label: 'A2 · 기초' }, { value: 'A1', label: 'A1 · 시작' }] },
      { name: 'AI 모델', key: 'aiModelId', choices: [otherModel, originalModel].map(model => ({ value: model.id, label: model.label })) },
    ]) {
      const control = settings.getByRole('combobox', { name, exact: true });
      for (const choice of choices) {
        const currentName = (await control.innerText()).trim();
        await changeAndSave(() => chooseOption(control, currentName, choice.label));
        await waitForTriggerFocus(name);
        assert.equal((await control.innerText()).trim(), choice.label);
        assert.equal((await qa.getState()).state.settings[key], choice.value);
        report.settingsFocus.push({ name, value: choice.value, returned: true });
      }
    }
    assert.equal(report.requests.filter(request => request.method === 'POST' && /\/api\/(sentence|grammar)-feedback$/.test(request.path)).length, 0);

    // Hold only the synthetic owner's intended PUT until a real focus/close
    // action has occurred. Always release and drain the route, including failure.
    const delayedGoalSave = async (value, label, leaveWhileSaving) => {
      const before = await qa.getState();
      const currentName = (await goal.innerText()).trim();
      const nextName = value === 3 ? '3개 · 기본 목표' : value + '개';
      const evidence = { label, value, held: 0, routeErrors: [] };
      report.settingsFocus.push(evidence);
      let release, markHeld, rejectHeld, heldTimer;
      const gate = new Promise(resolve => { release = resolve; });
      const held = new Promise((resolve, reject) => {
        markHeld = resolve; rejectHeld = reject;
      });
      const matches = request => request.method() === 'PUT' && new URL(request.url()).pathname === '/api/state'
        && request.postDataJSON()?.settings?.dailyGoal === value;
      const intercept = async route => {
        try {
          if (matches(route.request())) {
            evidence.held++;
            evidence.requestRevision = route.request().postDataJSON().revision;
            clearTimeout(heldTimer); markHeld();
            await gate;
          }
          await route.continue();
        } catch (error) { evidence.routeErrors.push(error.stack || error.message); }
      };
      try {
        await page.route('**/api/state', intercept);
        heldTimer = setTimeout(() => rejectHeld(new Error(label + ': intended PUT was not intercepted within 15000ms')), 15_000);
        await Promise.all([held, chooseOption(goal, currentName, nextName)]);
        await qa.settle();
        assert.equal(evidence.held, 1, label + ' holds exactly one intended save');
        assert.equal(await goal.isDisabled(), true, label + ' runs while the save disables its trigger');
        assert.equal(await page.getByRole('listbox').isVisible(), false);
        assert.deepEqual(await qa.getState(), before, label + ' has not reached the server before release');
        const destination = await leaveWhileSaving();
        assert.equal(await destination.evaluate(element => element === document.activeElement), true, label + ' explicitly moves focus');
        evidence.movedWhileSaving = true;
        await qa.capture('settings-' + label + '.png', false);
        const response = page.waitForResponse(response => matches(response.request()));
        release();
        assert.equal((await response).status(), 200);
        await qa.saved();
        if (await settings.isVisible()) {
          await page.waitForFunction(() => {
            const element = document.querySelector('.settings-dialog [aria-label="하루 목표"]');
            return element instanceof HTMLButtonElement && !element.disabled;
          });
        }
        await qa.settle();
        assert.equal(await destination.evaluate(element => element === document.activeElement), true, label + ' keeps user focus after the delayed save');
        const after = await qa.getState();
        assert.deepEqual(after.state, { ...before.state, settings: { ...before.state.settings, dailyGoal: value } }, label + ' changes only the intended preference');
        assert.ok(after.revision > before.revision);
        evidence.retainedAfterSave = true;
        evidence.responseRevision = after.revision;
      } finally {
        clearTimeout(heldTimer); release();
        // No other main-page route is installed at this point in the test.
        await page.unrouteAll({ behavior: 'wait' });
      }
      assert.deepEqual(evidence.routeErrors, [], label + ' route handling');
    };
    await delayedGoalSave(2, 'save-focus-move', async () => {
      const help = settings.locator('summary').filter({ hasText: '목표 수를 바꾸면?' });
      await help.focus(); return help;
    });
    await delayedGoalSave(3, 'save-dialog-close', async () => {
      await closeSettings(); return settingsTrigger;
    });
    assert.equal(await settings.isVisible(), false, 'A completed save does not reopen settings');
    await openSettings();
    report.checks.push('Settings goal/review-day/level/model preference saves return focus; delayed synthetic PUTs preserve explicit focus movement and dialog dismissal; effective preference values restored and no AI generation requested');
    for (const name of ['학습 수준', '주간 점검 요일']) {
      const control = settings.getByRole('combobox', { name, exact: true });
      await control.focus(); await control.press('Space'); await page.getByRole('listbox').waitFor();
      await page.keyboard.press('Escape'); assert.equal(await control.evaluate(element => element === document.activeElement), true);
    }
    assert.deepEqual((await qa.getState()).state.sessions, seeded.state.sessions);
    assert.deepEqual((await qa.getState()).state.progress, seeded.state.progress);
    await closeSettings();
    report.checks.push('P081–088, P095, P097–098: labels, keyboard selection/native checkbox, disabled AI and dialog return focus preserve learning records');

    const sourcesTrigger = button('학습 방식·출처');
    await sourcesTrigger.focus(); await sourcesTrigger.press('Enter');
    const sources = page.getByRole('dialog', { name: '학습 방식과 자료 출처', exact: true });
    await sources.waitFor();
    const sourceLinks = [
      ['Oxford 원문 PDF 보기', '/sources/oxford-source.pdf', 18, 2],
      ['사전 출처 · CC BY-SA 4.0', 'https://github.com/jhseo1211/open-english-korean-dict', 18, 2],
      ['Tatoeba 문장 자료 · CC BY 2.0', 'https://www.manythings.org/anki/', 18, 2],
      ['발음 데이터·출처·라이선스', '/sources/american-ipa.json', 20, 2],
      ['OpenAI API 데이터 정책', 'https://developers.openai.com/api/docs/guides/your-data', 18, 1],
      ['데이터 변경·라이선스 안내', '/sources/content-attribution.txt', 18, 2],
    ];
    const sourceIcons = [];
    for (const [name, href, size, count] of sourceLinks) {
      const link = sources.getByRole('link', { name, exact: true });
      assert.equal(await link.getAttribute('href'), href); assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(await svg(link).count(), count);
      for (let index = 0; index < count; index++) sourceIcons.push([svg(link).nth(index), size, name + ' ' + index]);
    }
    await qa.inspect('sources', { icons: sourceIcons });
    await qa.click(sources.getByRole('button', { name: '닫기', exact: true }), 'sources-close');
    await sources.waitFor({ state: 'hidden' });
    const sourceHandle = await sourcesTrigger.elementHandle();
    try { await page.waitForFunction(element => document.activeElement === element, sourceHandle); }
    finally { await sourceHandle?.dispose(); }
    report.checks.push('P091–095: all source link names/destinations and return focus survive decorative icons without opening external sites');

    const field = page.getByRole('textbox', { name: '내 영어 문장', exact: true });
    const openLesson = async () => {
      await qa.saved();
      const resume = button('중단한 학습 이어서');
      if (await resume.isVisible()) { await resume.click(); await qa.saved(); }
      await field.waitFor();
      await page.waitForFunction(() => document.activeElement?.tagName === 'H2' && !!document.activeElement.closest('.session-panel'));
    };
    await openLesson();
    await field.fill('A synthetic draft to recover.'); await waitDraft('A synthetic draft to recover.');
    await page.reload({ waitUntil: 'domcontentloaded' }); await openLesson();
    await waitValue(field, 'A synthetic draft to recover.');
    const draftBaseline = await qa.getState();
    const undo = button('복구한 입력 되돌리기');
    await qa.inspect('draft-restored', { icons: [[svg(undo), 18, 'P090 restore undo']] });
    await qa.click(undo, 'draft-undo'); await waitValue(field, 'Existing server sentence.');
    assert.deepEqual(await qa.getState(), draftBaseline, 'undo does not grade or save recovered input');
    await field.fill('A draft kept for explicit comparison.'); await waitDraft('A draft kept for explicit comparison.');
    const latest = await qa.getState(), current = latest.state.sessions[lesson.id];
    const changed = { ...current,
      records: { ...current.records, [word.id]: { ...current.records[word.id], sentence: 'Changed server sentence.' } } };
    // PUT requires both delta maps; an empty progress map leaves saved grades intact.
    const changedSnapshot = await qa.seed({ progress: {}, sessions: { [lesson.id]: changed } });
    assert.equal(changedSnapshot.revision, latest.revision + 1);
    assert.deepEqual(changedSnapshot.state, { ...latest.state,
      sessions: { ...latest.state.sessions, [lesson.id]: changed } }, 'remote fixture changes only this sentence');
    await page.reload({ waitUntil: 'domcontentloaded' }); await openLesson();
    await waitValue(field, 'Changed server sentence.');
    const comparisonBaseline = await qa.getState();
    await page.locator('.local-draft-notice summary').filter({ hasText: '이 기기에 남은 다른 입력 확인' }).click();
    await button('현재 입력과 비교').first().click();
    const comparison = page.getByRole('group', { name: '임시 입력 복구 확인', exact: true });
    await comparison.waitFor(); await qa.inspect('draft-comparison', compactMatrix);
    await qa.click(comparison.getByRole('button', { name: '취소', exact: true }), 'draft-comparison-cancel');
    assert.equal(await field.inputValue(), 'Changed server sentence.');
    assert.deepEqual(await qa.getState(), comparisonBaseline);
    await button('현재 입력과 비교').first().click();
    await qa.click(button('비교한 입력으로 이어쓰기'), 'draft-apply');
    await waitValue(field, 'A draft kept for explicit comparison.');
    assert.deepEqual(await qa.getState(), comparisonBaseline);
    report.checks.push('P090: automatic recovery, undo, explicit comparison/cancel/apply preserve original scores, first answers and server revision');

    await openSettings();
    const deletionBaseline = await qa.getState(), localBefore = await draftRows();
    assert.ok(localBefore.length > 0);
    await qa.click(button('이 기기의 임시 입력 삭제'), 'draft-delete-open');
    const deletion = page.getByRole('group', { name: '임시 입력 삭제 확인', exact: true });
    await qa.inspect('draft-delete-confirmation', compactMatrix);
    await qa.click(deletion.getByRole('button', { name: '취소', exact: true }), 'draft-delete-cancel');
    assert.deepEqual(await draftRows(), localBefore); assert.deepEqual(await qa.getState(), deletionBaseline);
    await button('이 기기의 임시 입력 삭제').click(); await qa.click(button('기기 보관 항목 삭제'), 'draft-delete-confirm');
    await settings.getByText('기기 보관 항목을 삭제했어요. 다시 편집하는 입력부터 새로 임시 보관해요.', { exact: true }).waitFor();
    assert.deepEqual(await draftRows(), []); assert.deepEqual(await qa.getState(), deletionBaseline);
    await closeSettings(); assert.equal(await field.inputValue(), 'A draft kept for explicit comparison.');

    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.restoreQaStorage = () => { Storage.prototype.setItem = original; delete window.restoreQaStorage; };
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('haru-words:local-input:v1:')) throw new DOMException('Synthetic storage failure', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await field.fill('Retain my input when storage fails.');
    const retry = button('기기 보관 다시 확인'); await retry.waitFor();
    await qa.inspect('draft-storage-error', { icons: [[svg(retry), 18, 'P089 storage retry']] });
    await page.evaluate(() => window.restoreQaStorage());
    await qa.click(retry, 'draft-storage-retry'); await retry.waitFor({ state: 'hidden' });
    assert.equal(await field.inputValue(), 'Retain my input when storage fails.');
    await waitDraft('Retain my input when storage fails.');
    assert.deepEqual(await qa.getState(), deletionBaseline);
    report.checks.push('P087/P089: cancel preserves device drafts; confirmed local delete and recoverable storage failure preserve displayed input and server records');

    await openSettings();
    const logout = settings.getByRole('link', { name: '임시 입력을 지우고 로그아웃', exact: true });
    assert.equal(await logout.getAttribute('href'), '/signout-with-chatgpt?return_to=%2F');
    // No provider/account session is contacted: intercept this synthetic context's
    // top-level local navigation after the production clear-before-logout handler.
    await page.route('**/signout-with-chatgpt?*', route => route.fulfill({ contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="ko"><head><title>합성 로그아웃 확인</title></head><body><main><h1>합성 로그아웃 도착</h1></main></body></html>' }));
    await qa.click(logout, 'draft-logout'); await page.getByRole('heading', { name: '합성 로그아웃 도착' }).waitFor();
    assert.deepEqual(await draftRows(), []);
    assert.equal(await page.evaluate(() => localStorage.getItem('haru-words:local-input-owner:v1')), null);
    assert.deepEqual(await qa.getState(), deletionBaseline);
    report.checks.push('P088: production logout handler clears only synthetic device drafts before intercepted local navigation; no actual provider logout');

    // P099 has no current app consumer. Exercise its actual Radix component with
    // the built app stylesheet on a QA-only intercepted URL, plus transient close.
    // Match RecordActions' existing non-modal menu configuration.
    await page.goto(base); await qa.saved();
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.href));
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
      import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSub,DropdownMenuSubTrigger,DropdownMenuSubContent} from './components/ui/dropdown-menu';
      import {LearningMessage} from './app/learning/learning-message';
      function Harness(){const [selected,setSelected]=useState(false),[message,setMessage]=useState(true);return <main className="page-shell"><h1>공통 아이콘 합성 검사</h1>
        <DropdownMenu modal={false}><DropdownMenuTrigger asChild><button className="secondary-button">합성 메뉴</button></DropdownMenuTrigger><DropdownMenuContent>
          <DropdownMenuItem>기본 항목</DropdownMenuItem><DropdownMenuSub><DropdownMenuSubTrigger>다음 항목</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onSelect={()=>setSelected(true)}>합성 선택</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
        </DropdownMenuContent></DropdownMenu><p role="status">{selected?'합성 항목을 선택했어요.':'선택 전'}</p>
        <label>보존할 연습 입력<input defaultValue="기존 입력"/></label>
        {message&&<LearningMessage messageId={1} message="학습 안내를 읽은 뒤 닫을 수 있어요." onDismiss={()=>setMessage(false)}/>}</main>}
      createRoot(document.getElementById('root')).render(<Harness/>);` },
      bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' } });
    await page.route('**/__qa/haru-system-icons', route => route.fulfill({ contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="ko"><head><title>공통 아이콘 합성 검사</title>' + styles.map(href => '<link rel="stylesheet" href="' + href + '">').join('')
        + '</head><body><div id="root"></div></body></html>' }));
    await page.goto(base + '/__qa/haru-system-icons'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const messageClose = button('안내 닫기'); await messageClose.waitFor(); await messageClose.focus();
    await qa.inspect('transient-message', { ...compactMatrix, icons: [[svg(messageClose), 20, 'P096 transient close']] });
    await qa.click(messageClose, 'transient-close');
    assert.equal(await page.getByRole('textbox', { name: '보존할 연습 입력', exact: true }).inputValue(), '기존 입력');
    const menu = button('합성 메뉴'); await menu.focus(); await menu.press('Enter');
    const sub = page.getByRole('menuitem', { name: '다음 항목', exact: true }); await sub.waitFor();
    await qa.inspect('submenu', { ...compactMatrix, icons: [[svg(sub), 16, 'P099 submenu arrow']] });
    await sub.focus(); await sub.press('ArrowRight');
    const item = page.getByRole('menuitem', { name: '합성 선택', exact: true }); await item.waitFor();
    assert.equal(await sub.getAttribute('aria-expanded'), 'true');
    await item.press('ArrowLeft'); assert.equal(await sub.getAttribute('aria-expanded'), 'false');
    await sub.press('ArrowRight'); await item.press('Enter');
    await page.getByText('합성 항목을 선택했어요.', { exact: true }).waitFor();
    const menuHandle = await menu.elementHandle();
    try { await page.waitForFunction(element => document.activeElement === element, menuHandle); }
    finally { await menuHandle?.dispose(); }
    assert.equal(await menu.evaluate(element => element === document.activeElement), true);
    report.checks.push('P096/P099 QA-only real-component harness: dismiss preserves input; submenu ArrowRight/Left/Enter and returned focus preserve Radix semantics');
    assert.deepEqual((await qa.getState()).state.sessions[history.id], seeded.state.sessions[history.id]);
    assert.equal(report.requests.filter(request => request.method === 'POST' && /\/api\/(sentence|grammar)-feedback$/.test(request.path)).length, 0);
  } catch (error) {
    failure = error;
    if (startupPage && !startupPage.isClosed()) {
      try { await qa.capture('startup-failure.png', false, startupPage); }
      catch (captureError) { report.startupFailureScreenshotError = captureError.message; }
    }
  }
  finally {
    try { await closeStartupInspection(); }
    catch (error) {
      report.startupCleanupError = error.stack || error.message;
      failure ||= error;
    }
  }
  await qa.finish(failure);
})().catch(error => { console.error(error); process.exitCode = 1; });
