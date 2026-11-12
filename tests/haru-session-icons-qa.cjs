// Actual local study flow; only synthetic learner data and no AI generation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { base, accountHeaders, launchBrowser, closeBrowser, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { validateEnvironment, requireDisabledAiStatus } = require('./qa/preflight.cjs');
const engine = process.env.QA_BROWSER || 'chromium';
const phaseLabels = ['기억 깨우기', '단어 익히기', '스스로 떠올리기', '문장 만들기'];
const currentPhase = { warmup: 0, learn: 1, en: 2, ko: 2, sentence: 3 };
const stageTitles = { warmup: '기억 깨우기', learn: '단어 익히기', en: '영어 → 뜻', ko: '뜻 → 영어', sentence: '내 문장 만들기' };

(async () => {
  if (!['chromium', 'webkit'].includes(engine)) throw Error('Unsupported QA browser engine');
  const out = path.resolve('outputs/haru-session-icons', engine);
  fs.mkdirSync(out, { recursive: true });
  const report = { passed: false, engine, actualDevice: false, layouts: [], audits: [], screenshots: [], clicks: [], checks: [], errors: [], aiGenerationRequests: [] };
  let browser, page, failure;
  try {
    validateEnvironment();
    await waitForWorker();
    await requireDisabledAiStatus(base, accountHeaders('session_icons_preflight'));
    browser = await launchBrowser({ engine });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
      colorScheme: 'light', extraHTTPHeaders: accountHeaders('haru_session_icons'),
    });
    const get = async () => {
      const response = await context.request.get(base + '/api/state');
      assert.equal(response.status(), 200, await response.text());
      const value = await response.json();
      return { revision: value.revision, state: value.state };
    };
    const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
    const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
    const target = words.find(word => word.word === 'cat' && word.pos === 'n.');
    const warmup = words.find(word => word.word === 'apple' && word.pos === 'n.');
    assert.ok(target && warmup);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const previous = new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const makeSession = (day, finished) => ({
      id: crypto.randomUUID(), kind: 'daily', date: day, period: day, ids: [target.id],
      warmupIds: finished ? [] : [warmup.id], stage: finished ? 'done' : 'warmup', index: 0,
      retry: [], retryMode: false, elapsed: 0, paused: true, finished, createdAt: day + 'T01:00:00Z',
      records: { [target.id]: {
        entryId: target.id, meaning: content[target.id].meaning, material: content[target.id],
        en: finished ? 'independent' : 'unmeasured', ko: finished ? 'help' : 'unmeasured',
        sentenceStatus: finished ? 'improve' : 'unmeasured',
        sentence: finished ? 'Preserve this historical sentence.' : '', notes: finished ? 'Preserve this historical note.' : '',
      } },
    });
    const history = makeSession(previous, true), lesson = makeSession(date, false), initial = await get();
    const seeded = await context.request.put(base + '/api/state', { data: {
      revision: initial.revision,
      settings: { ...initial.state.settings, dailyGoal: 1, activeSessionId: lesson.id },
      progress: {
        [target.id]: { meaning: content[target.id].meaning, familiarity: 'uncertain', en: 'independent', ko: 'help',
          sentenceStatus: 'improve', needsReview: true, lastStudied: previous, studyDates: [previous] },
        [warmup.id]: { meaning: content[warmup.id].meaning, familiarity: 'known', lastStudied: previous, studyDates: [previous] },
      },
      sessions: { [history.id]: history, [lesson.id]: lesson },
    } });
    assert.equal(seeded.status(), 200, await seeded.text());
    const historicalRecord = (await get()).state.sessions[history.id];
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => {
      if (request.method() === 'POST' && /\/api\/(?:sentence|grammar)-feedback(?:$|\?)/.test(request.url())) {
        report.aiGenerationRequests.push(new URL(request.url()).pathname);
      }
    });
    const saved = () => page.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
    const settle = () => page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    });
    const capture = async (name, fullPage = true) => {
      await page.screenshot({ path: path.join(out, name), fullPage, animations: 'disabled' });
      report.screenshots.push(name);
    };
    const checkIcon = async (locator, size, label) => {
      assert.equal(await locator.count(), 1, label + ' has one icon');
      assert.equal(await locator.getAttribute('aria-hidden'), 'true', label + ' is decorative');
      assert.notEqual(await locator.getAttribute('focusable'), 'true', label + ' is not focusable');
      assert.ok(Number(await locator.getAttribute('tabindex') ?? -1) < 0, label + ' is outside keyboard order');
      const bounds = await locator.boundingBox();
      assert.ok(bounds && Math.abs(bounds.width - size) <= 0.5 && Math.abs(bounds.height - size) <= 0.5,
        label + ' remains ' + size + 'px: ' + JSON.stringify(bounds));
    };
    const inspect = async (name, stage, icons) => {
      const before = await get();
      for (const width of [320, 390, 430, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        for (const textSize of [100, 200]) {
          await page.evaluate(size => {
            document.documentElement.style.fontSize = size + '%';
            window.scrollTo({ top: 0, behavior: 'instant' });
          }, textSize);
          await settle();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
            name + ' fits ' + width + 'px at ' + textSize + '% text');
          if (stage) {
            const phases = page.locator('.phase-strip li');
            assert.deepEqual((await phases.allInnerTexts()).map(text => text.trim()), phaseLabels);
            assert.equal(await page.locator('.phase-strip [aria-current="step"]').count(), 1);
            for (let index = 0; index < phaseLabels.length; index++) {
              assert.equal(await phases.nth(index).getAttribute('aria-current'), index === currentPhase[stage] ? 'step' : null);
              await checkIcon(phases.nth(index).locator('svg'), 16, phaseLabels[index]);
            }
          }
          for (const [locator, size, label] of icons) await checkIcon(locator, size, label);
          const violations = await page.evaluate(async () => (await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
          report.audits.push({ name, width, textSize, violations });
          assert.deepEqual(violations, [], name + ' accessibility');
          report.layouts.push({ name, stage, width, textSize, currentPhase: stage ? phaseLabels[currentPhase[stage]] : null });
          if (textSize === 100 || width === 320) await capture(name + '-' + width + '-' + textSize + '.png');
        }
      }
      await page.evaluate(() => document.documentElement.style.fontSize = '100%');
      await page.setViewportSize({ width: 390, height: 844 });
      await settle();
      assert.deepEqual(await get(), before, name + ' inspection does not save or grade input');
    };
    const clickAfterScroll = async (button, name) => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await button.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await settle();
        const bounds = await button.boundingBox();
        assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, name + ' touch target at ' + width);
        const navigation = await page.getByRole('tablist', { name: '학습 화면', exact: true }).boundingBox();
        assert.ok(bounds.y >= 0 && (!navigation || bounds.y + bounds.height <= navigation.y), name + ' clears fixed navigation at ' + width);
        assert.equal(await button.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          return !!hit && (hit === element || element.contains(hit));
        }), true, name + ' is not covered at ' + width);
        await capture('action-' + name + '-' + width + '.png', false);
        const result = { name, viewport: width, unobstructed: true, clicked: false };
        report.clicks.push(result);
        if (width === 320) {
          await button.click();
          result.clicked = true;
        }
      }
    };
    const waitStage = async stage => {
      await page.locator('.session-step-row').getByRole('heading', { name: stageTitles[stage], exact: true }).waitFor();
      await saved();
      assert.deepEqual((await get()).state.sessions[history.id], historicalRecord, 'historical scores stay unchanged');
    };
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await saved();
    await button('중단한 학습 이어서').click();
    await waitStage('warmup');
    await page.addScriptTag({ path: axePath });
    await inspect('warmup', 'warmup', [[button('뜻 확인').locator('svg'), 17, '뜻 확인']]);
    await page.getByLabel('떠오르는 한국어 뜻', { exact: true }).fill(content[warmup.id].meaning);
    await clickAfterScroll(button('뜻 확인'), 'warmup-reveal');
    await saved();
    assert.equal(await page.getByLabel('떠오르는 한국어 뜻', { exact: true }).inputValue(), content[warmup.id].meaning);
    assert.equal(await button('스스로 떠올렸어요').isEnabled(), true);
    await clickAfterScroll(button('스스로 떠올렸어요'), 'warmup-grade');
    await waitStage('learn');
    assert.equal((await get()).state.sessions[lesson.id].warmupResults[warmup.id], 'independent');
    report.checks.push('warmup keeps the typed answer and stores its independent result separately');

    const edit = page.locator('.session-panel summary').filter({ hasText: '표현·예문 수정하기' });
    await edit.focus();
    await edit.press('Enter');
    const example = 'The cat stays at home.', translation = '고양이는 집에 있어요.';
    await page.getByLabel('영어 예문', { exact: true }).fill(example);
    await page.getByLabel('예문의 한국어 해석', { exact: true }).fill(translation);
    await inspect('learn', 'learn', [
      [page.locator('.session-panel .example-label svg'), 15, '자료 출처'],
      [edit.locator('svg'), 15, '표현·예문 수정하기'],
      [button('뜻 저장하고 계속').locator('svg'), 17, '뜻 저장하고 계속'],
    ]);
    assert.equal(await page.getByLabel('영어 예문', { exact: true }).inputValue(), example);
    assert.equal(await page.getByLabel('예문의 한국어 해석', { exact: true }).inputValue(), translation);
    await clickAfterScroll(button('뜻 저장하고 계속'), 'learn-continue');
    await waitStage('en');
    assert.equal((await get()).state.sessions[lesson.id].records[target.id].material.example, example);
    assert.equal((await get()).state.sessions[lesson.id].records[target.id].material.translation, translation);
    report.checks.push('the native edit summary opens by keyboard and existing example inputs save through the original action');

    for (const [stage, label, answer] of [['en', '한국어 뜻 입력', content[target.id].meaning], ['ko', '영어 단어 입력', target.word]]) {
      await waitStage(stage);
      const input = page.getByLabel(label, { exact: true });
      await input.fill(answer);
      await inspect('recall-' + stage, stage, [[button('내 답 확인').locator('svg'), 17, '내 답 확인']]);
      assert.equal(await input.inputValue(), answer);
      await clickAfterScroll(button('내 답 확인'), 'recall-' + stage + '-reveal');
      await saved();
      assert.equal(await input.evaluate(element => element.readOnly), true);
      assert.equal(await button('도움 없이 맞혔어요').isEnabled(), true);
      await clickAfterScroll(button('도움 없이 맞혔어요'), 'recall-' + stage + '-grade');
      await waitStage(stage === 'en' ? 'ko' : 'sentence');
      assert.equal((await get()).state.sessions[lesson.id].records[target.id][stage], 'independent');
    }
    report.checks.push('both recall directions retain their labelled inputs and the same current phase; typed answers remain independently gradable');

    const sentence = 'This is my cat.', note = 'Keep this spoken practice note.';
    await page.getByLabel('내 영어 문장', { exact: true }).fill(sentence);
    await page.getByLabel('보완할 점', { exact: false }).fill(note);
    const spoken = page.getByRole('checkbox', { name: '내 문장을 소리 내어 말해 봤어요', exact: true });
    assert.equal(await spoken.evaluate(element => element.tagName === 'INPUT' && element.type === 'checkbox'), true);
    await spoken.focus();
    for (const checked of [true, false, true]) {
      await spoken.press('Space');
      assert.equal(await spoken.isChecked(), checked, 'Space toggles the existing self-report checkbox');
    }
    await inspect('sentence', 'sentence', [
      [page.locator('.session-panel .check-label svg'), 16, '소리 내어 말하기 확인'],
      [button('문장을 완성했어요').locator('svg'), 17, '문장을 완성했어요'],
    ]);
    assert.equal(await spoken.isChecked(), true);
    assert.equal(await page.getByLabel('내 영어 문장', { exact: true }).inputValue(), sentence);
    assert.equal(await page.getByLabel('보완할 점', { exact: false }).inputValue(), note);
    report.checks.push('the spoken icon supplements the original labelled native checkbox; keyboard toggling preserves sentence and notes');

    const beforeFailure = await get();
    await page.route('**/api/state', route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, json: { error: '검사용 저장하지 못했어요. 현재 입력을 보존한 뒤 다시 시도해 주세요.' } })
      : route.continue());
    await clickAfterScroll(button('문장을 완성했어요'), 'sentence-complete');
    await page.getByRole('heading', { name: '기록 저장을 확인하고 있어요.', exact: true }).waitFor();
    assert.equal(await page.locator('.session-summary .success-icon').count(), 0);
    assert.deepEqual(await get(), beforeFailure, 'a failed final save cannot change the server revision or records');
    await inspect('summary-pending', null, [[page.locator('.summary-pending-icon svg'), 24, '저장 미확인 요약']]);
    assert.equal((await get()).state.sessions[lesson.id].finished, false);
    await page.unroute('**/api/state');
    await clickAfterScroll(button('다시 시도'), 'save-retry');
    await page.getByRole('heading', { name: '학습 기록을 저장했어요', exact: true }).waitFor();
    await saved();
    assert.equal(await page.locator('.summary-pending-icon').count(), 0);
    const confirmed = await get(), recorded = confirmed.state.sessions[lesson.id].records[target.id];
    assert.equal(confirmed.state.sessions[lesson.id].finished, true);
    assert.equal(recorded.sentence, sentence);
    assert.equal(recorded.notes, note);
    assert.equal(recorded.spoken, true);
    assert.equal(recorded.sentenceStatus, 'written');
    assert.deepEqual(confirmed.state.sessions[history.id], historicalRecord);
    await inspect('summary-saved', null, [[page.locator('.session-summary .success-icon svg'), 24, '저장 확인 요약']]);
    report.checks.push('503 keeps a neutral unconfirmed summary and unchanged server data; retry confirms storage, spoken practice and the original historical record');
    assert.deepEqual(report.aiGenerationRequests, []);
    assert.deepEqual(report.errors, []);
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
    if (browser) {
      try { await closeBrowser(browser); }
      catch (error) { report.cleanupError = error.message; failure ||= error; }
    }
    if (failure) report.passed = false;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ passed: true, engine, layouts: report.layouts.length, screenshots: report.screenshots.length, checks: report.checks }));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
