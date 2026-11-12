// P054–P080: approved icons on real local screens, with synthetic records only.
// Restoration stops at preview/confirmation cancellation; no learner data is replaced.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createIconQa } = require('./qa/haru-icon-helpers.cjs');
const { feedbackReceipt } = require('./qa/openai-fixture.cjs');

const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const appDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const selected = [['cat', 'n.'], ['apple', 'n.'], ['book', 'n.'], ['busy', 'adj.']]
  .map(([word, pos]) => words.find(item => item.word === word && item.pos === pos));
assert.ok(selected.every(Boolean), 'Synthetic catalog fixtures exist');
const envelope = state => JSON.stringify({ format: 'haru-words-v1', exportedAt: new Date().toISOString(), state });
const grades = record => Object.fromEntries(['familiarity', 'en', 'ko', 'sentenceStatus'].map(key => [key, record[key]]));

(async () => {
  const qa = await createIconQa('haru-record-icons');
  const { page, context, base, report } = qa;
  let failure;
  let releaseAi;
  try {
    // Native controls and the real app stay in place. Only device audio and a
    // short-lived worker/request delay are synthetic, so no sound or AI is sent.
    await context.addInitScript(() => {
      const audio = {
        voices: [{ lang: 'en-US' }], calls: 0, utterance: null, paused: false,
        getVoices() { return this.voices; }, cancel() {}, resume() { this.paused = false; },
        speak(utterance) { this.utterance = utterance; this.calls++; },
      };
      window.__recordIconAudio = audio;
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: audio });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true, value: class { constructor(text) { this.text = text; } },
      });
      const NativeWorker = window.Worker;
      const pendingImports = [];
      window.__holdRecordIconImport = false;
      window.__releaseRecordIconImport = () => {
        window.__holdRecordIconImport = false;
        pendingImports.splice(0).forEach(send => send());
      };
      window.Worker = class extends NativeWorker {
        postMessage(...args) {
          if (window.__holdRecordIconImport && args[0]?.kind === 'import') {
            pendingImports.push(() => super.postMessage(...args));
          } else super.postMessage(...args);
        }
      };
    });

    const button = name => page.getByRole('button', { name, exact: true });
    const menuItem = name => page.getByRole('menuitem', { name, exact: true });
    const recordTab = () => page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    const reviewTab = () => page.getByRole('tab', { name: '복습 점검', exact: true }).click();
    const openMenu = async () => {
      await qa.click(button('기록 관리'), 'record-menu');
      await page.getByRole('menu').waitFor();
    };
    const chooseMenu = async (name, label) => {
      await openMenu();
      await qa.click(menuItem(name), label);
    };
    const download = async (action, filename) => {
      const event = page.waitForEvent('download');
      await action();
      const item = await event;
      assert.equal(await item.failure(), null, filename + ' downloads successfully');
      const destination = path.join(qa.out, filename);
      await item.saveAs(destination);
      return fs.readFileSync(destination, 'utf8');
    };
    const assertBackup = (raw, snapshot, label) => {
      const backup = JSON.parse(raw);
      assert.equal(backup.format, 'haru-words-v1', label + ' uses the supported envelope');
      assert.deepEqual(backup.state, { ...snapshot.state, grammar: snapshot.state.grammar ?? {} }, label + ' preserves the complete snapshot');
    };
    const assertUnchanged = async (snapshot, label) => assert.deepEqual(await qa.getState(), snapshot, label);

    const empty = await qa.getState();
    assert.equal(Object.keys(empty.state.sessions).length, 0, 'The account is a fresh synthetic owner');
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await qa.saved();
    await recordTab();
    await page.getByRole('heading', { name: '첫 학습 기록을 기다리고 있어요.', exact: true }).waitFor();
    await qa.inspect('record-empty', { icons: [
      [page.locator('.empty-state > svg'), 32, 'P061 record-empty'],
      [button('기록 관리').locator('svg'), 18, 'P063 record menu'],
    ] });

    const results = [
      { familiarity: 'known', en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'A synthetic sentence to preserve.', spoken: true },
      { familiarity: 'uncertain', en: 'help', ko: 'help', sentenceStatus: 'improve', sentence: 'A synthetic sentence needing work.', spoken: false },
      { familiarity: 'new', en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', spoken: false },
      { familiarity: 'uncertain', en: 'independent', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', spoken: false },
    ];
    const historyId = randomUUID();
    const records = Object.fromEntries(selected.map((word, index) => [word.id, {
      entryId: word.id, meaning: content[word.id].meaning, material: content[word.id],
      ...results[index], notes: 'Synthetic preserved note ' + index, learnedOn: appDate,
    }]));
    const history = {
      id: historyId, kind: 'daily', date: appDate, period: appDate, ids: selected.map(word => word.id),
      records, warmupIds: [], stage: 'done', index: 0, retry: [], retryMode: false,
      elapsed: 240, finished: true, paused: true, createdAt: new Date().toISOString(),
    };
    const progress = Object.fromEntries(selected.map((word, index) => [word.id, {
      meaning: content[word.id].meaning, ...grades(results[index]), sentence: results[index].sentence, notes: records[word.id].notes,
      lastStudied: appDate, studyDates: [appDate],
    }]));
    await qa.seed({
      settings: { ...empty.state.settings, dailyGoal: 4, activeSessionId: null },
      progress, sessions: { [historyId]: history },
    });
    await page.reload();
    await qa.saved();
    await recordTab();
    const preserved = await qa.getState();
    const preservedHistory = structuredClone(preserved.state.sessions[historyId]);
    await qa.click(page.locator('.journal-day-trigger').first(), 'record-day');
    await qa.click(page.locator('.journal-session-trigger').first(), 'record-session');
    const badges = page.locator('.journal-mobile .status-badge');
    await badges.first().waitFor();
    assert.deepEqual((await badges.allTextContents()).map(value => value.trim()),
      ['도움 없이 성공', '보완 필요', '아직 확인 안 함', '진행 중']);
    const badgeIcons = ['success', 'needs-help', 'unassessed', 'in-progress']
      .map((name, index) => [badges.nth(index).locator('svg'), 14, 'P062 ' + name]);
    await qa.inspect('record-statuses-mobile', { widths: [320, 390, 430], icons: badgeIcons });
    await qa.inspect('record-statuses-desktop', { widths: [768, 1440], icons: [
      [button('기록 관리').locator('svg'), 18, 'P063 record menu'],
    ] });
    // Exercise the real overflowing desktop table through native keyboard input.
    await page.setViewportSize({ width: 768, height: 844 });
    await qa.settle();
    const recordScroller = page.getByRole('region', { name: '단어별 학습 기록 가로 스크롤', exact: true });
    const recordTable = recordScroller.getByRole('table', { name: '단어별 학습 기록', exact: true });
    assert.equal(await recordTable.getByRole('columnheader').count(), 6, 'The native table keeps all six column headers');
    assert.equal(await recordScroller.getAttribute('tabindex'), '0');
    assert.equal(await recordScroller.evaluate(element => element.scrollWidth > element.clientWidth + 1), true,
      'The 768px fixture exercises actual horizontal overflow');
    await recordScroller.evaluate(element => { element.scrollLeft = 0; });
    await page.locator('.journal-session-actions').getByRole('button', { name: '단어 다시 보기', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await recordScroller.evaluate(element => document.activeElement === element), true,
      'Tab reaches the named scroll region from the preceding action');
    assert.equal(await recordScroller.evaluate(element => element.matches(':focus-visible')), true,
      'Keyboard focus remains visibly indicated');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.journal-desktop [data-slot="table-container"]')?.scrollLeft > 0);
    const rightOffset = await recordScroller.evaluate(element => element.scrollLeft);
    await qa.capture('record-table-keyboard-768.png', false);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(offset => document.querySelector('.journal-desktop [data-slot="table-container"]')?.scrollLeft < offset, rightOffset);
    assert.equal(await page.evaluate(() => window.scrollX), 0, 'Arrow keys scroll the table instead of the page');
    await page.keyboard.press('Tab');
    assert.equal(await recordScroller.evaluate(element => document.activeElement === element), false,
      'Tab leaves the scroll region without trapping keyboard focus');
    await recordScroller.evaluate(element => { element.scrollLeft = 0; });
    await page.setViewportSize({ width: 390, height: 844 });
    await qa.settle();
    await assertUnchanged(preserved, 'Expanding records and inspecting every badge does not grade or save them');
    report.checks.push('P061/P062: empty state and all four record labels preserve the original outcome criteria; 14px mobile badges and desktop records pass layout/a11y matrices');
    report.checks.push('The named record-table region is reachable by Tab, scrolls with native left/right arrow keys, preserves table/header semantics and saved records, and lets Tab continue normally');

    await openMenu();
    const menuIcons = [
      ['학습 기록 CSV 받기', 'P064 download'], ['전체 백업', 'P065 backup-archive'],
      ['백업으로 복원', 'P066 restore-file'], ['AI 튜터용 안내·최근 기록 받기', 'P067 tutor-export'],
    ].map(([name, label]) => [menuItem(name).locator('svg'), 16, label]);
    await qa.inspect('record-actions', { icons: menuIcons });
    const csv = await download(() => qa.click(menuItem('학습 기록 CSV 받기'), 'record-csv'), 'synthetic-records.csv');
    assert.ok(csv.includes(records[selected[0].id].sentence) && csv.includes(records[selected[1].id].notes));
    const tutor = await download(() => chooseMenu('AI 튜터용 안내·최근 기록 받기', 'record-tutor'), 'synthetic-tutor.txt');
    assert.ok(tutor.includes(selected[0].word) && tutor.includes(selected[1].word));
    await assertUnchanged(preserved, 'CSV and tutor exports preserve server state and revision');

    await chooseMenu('전체 백업', 'backup-export-open');
    await page.getByText('현재 앱에서 복원 가능한 백업이에요.', { exact: true }).waitFor();
    await qa.inspect('backup-export', { icons: [[button('백업 파일 다운로드').locator('svg'), 16, 'P068 download']] });
    const whole = await download(() => qa.click(button('백업 파일 다운로드'), 'backup-download'), 'synthetic-backup.json');
    assertBackup(whole, preserved, 'Whole backup');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await assertUnchanged(preserved, 'Whole backup is read-only');

    // The archive-only branch is a failed capability check, not a destructive restore.
    await page.route('**/api/state/restore', route => route.request().method() === 'GET'
      ? route.fulfill({ status: 503, json: { error: 'Synthetic capability check unavailable.' } }) : route.continue());
    try {
      await chooseMenu('전체 백업', 'backup-archive-open');
      await button('원본 보관용 다운로드').waitFor();
      await qa.inspect('backup-archive-fallback', { widths: [320, 1440], icons: [
        [button('원본 보관용 다운로드').locator('svg'), 16, 'P069 archive download'],
      ] });
      const archive = await download(() => qa.click(button('원본 보관용 다운로드'), 'archive-download'), 'synthetic-archive.json');
      assertBackup(archive, preserved, 'Archive-only backup');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    } finally { await page.unroute('**/api/state/restore'); }
    await assertUnchanged(preserved, 'The archive-only branch is read-only');
    report.checks.push('P063–P069: every menu action keeps its accessible name and handler; CSV, tutor, normal JSON and archive-only downloads preserve complete synthetic records');

    await chooseMenu('백업으로 복원', 'restore-open');
    const dialog = page.getByRole('dialog', { name: '백업으로 기록 복원', exact: true });
    await dialog.waitFor();
    const fileInput = dialog.locator('input[type=file]');
    await page.waitForFunction(() => { const input = document.querySelector('input[type=file]'); return input && !input.disabled; });
    const incoming = {
      settings: { ...preserved.state.settings, dailyGoal: 1, activeSessionId: null },
      progress: {}, sessions: {}, grammar: {},
    };
    await page.evaluate(() => { window.__holdRecordIconImport = true; });
    await fileInput.setInputFiles({ name: 'synthetic-empty-preview.json', mimeType: 'application/json', buffer: Buffer.from(envelope(incoming)) });
    const reading = dialog.getByRole('status').filter({ hasText: '파일을 확인하고 있어요.' });
    await reading.waitFor();
    await qa.checkIcon(reading.locator('svg'), 16, 'P070 import loading');
    assert.equal(await fileInput.isDisabled(), true, 'Native file input remains locked while reading');
    await qa.capture('restore-reading.png', false);
    await page.evaluate(() => window.__releaseRecordIconImport());
    await dialog.getByRole('table', { name: '현재 기록과 복원할 기록', exact: true }).waitFor();
    await page.locator('[data-safety-preview]').filter({ hasText: '복원 가능' }).waitFor();
    const safety = button('현재 기록 먼저 백업받기');
    const restore = button('이 백업으로 복원');
    const acknowledgment = dialog.getByRole('checkbox');
    assert.equal(await acknowledgment.isDisabled(), true);
    assert.equal(await acknowledgment.isChecked(), false);
    assert.equal(await restore.isDisabled(), true);
    await qa.inspect('restore-preview-disabled', { icons: [
      [safety.locator('svg'), 16, 'P071 safety backup'], [restore.locator('svg'), 16, 'P072 restore'],
      [acknowledgment.locator('svg:visible'), 14, 'P100 disabled empty checkbox'],
    ] });
    const safetyCopy = await download(() => qa.click(safety, 'restore-safety-download'), 'synthetic-safety-backup.json');
    assertBackup(safetyCopy, preserved, 'Safety backup');
    assert.equal(await acknowledgment.isEnabled(), true);
    await acknowledgment.focus();
    await page.keyboard.press('Space');
    assert.equal(await acknowledgment.isChecked(), true);
    await qa.checkIcon(acknowledgment.locator('svg:visible'), 14, 'P100 checked checkbox');
    assert.equal(await restore.isEnabled(), true);
    await page.keyboard.press('Space');
    assert.equal(await acknowledgment.isChecked(), false);
    await qa.checkIcon(acknowledgment.locator('svg:visible'), 14, 'P100 unchecked checkbox');
    assert.equal(await restore.isDisabled(), true);
    await page.keyboard.press('Space');
    assert.equal(await acknowledgment.isChecked(), true);
    await qa.inspect('restore-preview-approved', { widths: [320, 1440], icons: [
      [acknowledgment.locator('svg:visible'), 14, 'P100 checked checkbox'],
      [restore.locator('svg'), 16, 'P072 enabled restore'],
    ] });
    await assertUnchanged(preserved, 'Preview, safety download and keyboard acknowledgment preserve records');
    await qa.click(restore, 'restore-prepare');
    const confirmation = page.getByRole('alertdialog');
    await confirmation.waitFor();
    await qa.inspect('restore-confirm-cancel', { widths: [320, 1440] });
    // Inspect the actual enlarged targets before returning to the normal-size
    // cancellation flow. Neither target is activated by these geometry checks.
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await qa.settle();
      for (const name of ['기록 교체 · 복원', '취소']) {
        const target = confirmation.getByRole('button', { name, exact: true });
        await target.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await qa.settle();
        const bounds = await target.boundingBox(), frame = await confirmation.boundingBox();
        assert.ok(bounds && frame && bounds.width >= 44 && bounds.height >= 44
          && bounds.x >= frame.x && bounds.x + bounds.width <= frame.x + frame.width + 0.5
          && bounds.y >= frame.y && bounds.y + bounds.height <= frame.y + frame.height + 0.5
          && bounds.x >= 0 && bounds.x + bounds.width <= width + 0.5
          && bounds.y >= 0 && bounds.y + bounds.height <= 844.5,
        'Enlarged restore confirmation target is complete: ' + JSON.stringify({ name, width, bounds, frame }));
        assert.equal(await target.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          return !!hit && (hit === element || element.contains(hit));
        }), true, name + ' is not covered at 200% text');
      }
      await qa.capture('restore-confirm-targets-' + width + '-200.png', false);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
    await page.setViewportSize({ width: 390, height: 844 });
    await qa.settle();
    await qa.click(confirmation.getByRole('button', { name: '취소', exact: true }), 'restore-confirmation-cancel');
    await confirmation.waitFor({ state: 'hidden' });
    await assertUnchanged(preserved, 'Canceling final restore confirmation preserves every record and revision');
    const cancelJob = button('기존 복원 작업 취소');
    if (await cancelJob.isVisible()) {
      await qa.click(cancelJob, 'restore-staging-cancel');
      await cancelJob.waitFor({ state: 'hidden' });
    }
    const pendingJob = await context.request.get(base + '/api/state/restore/jobs');
    assert.equal(pendingJob.status(), 200);
    assert.equal((await pendingJob.json()).job, null);
    await qa.click(dialog.getByRole('button', { name: '닫기', exact: true }), 'restore-close');
    await dialog.waitFor({ state: 'hidden' });
    // Radix unmount and the app's view restoration return focus asynchronously.
    // Resolve the current trigger so a React replacement cannot leave a stale handle.
    try {
      await page.waitForFunction(() => {
        const trigger = document.querySelector('[data-backup-trigger]');
        return !!trigger && document.activeElement === trigger;
      });
    } catch (error) {
      report.restoreCloseFocus = await page.evaluate(() => {
        const describe = element => element ? {
          tag: element.tagName, id: element.id, role: element.getAttribute('role'),
          label: element.getAttribute('aria-label'), text: element.textContent?.trim().slice(0, 120),
          connected: element.isConnected, visible: element.getClientRects().length > 0,
        } : null;
        return {
          active: describe(document.activeElement),
          trigger: describe(document.querySelector('[data-backup-trigger]')),
          triggerCount: document.querySelectorAll('[data-backup-trigger]').length,
          dialogs: [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].map(describe),
        };
      });
      throw error;
    }
    assert.equal(await button('기록 관리').evaluate(element => document.activeElement === element), true);
    await assertUnchanged(preserved, 'Closing restore and returning focus preserve all synthetic records');
    assert.equal(report.requests.filter(request => request.path.endsWith('/commit')).length, 0, 'No restore commit is issued');
    report.checks.push('P070–P072/P100: real file preview, safety-copy gating, native file input, 14px checkbox Space toggles, final confirmation cancel and staging cancel preserve state/revision; no commit occurs');

    await reviewTab();
    const weekly = page.locator('[data-review-kind=weekly]');
    const monthly = page.locator('[data-review-kind=monthly]');
    const weeklyAction = () => weekly.locator('button.primary-button');
    const monthlyAction = () => monthly.locator('button.primary-button');
    const practice = mode => page.locator('.practice-options').getByRole('button', {
      name: mode === 'known' ? /^아는 단어 다시 확인/ : mode === 'ko' ? /^뜻→영어 추가 연습/ : /^문장 보완 연습/,
    });
    await weeklyAction().waitFor();
    for (const width of [320, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const textSize of [100, 200]) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, textSize);
        await qa.settle();
        assert.equal(await weekly.locator('.review-icon').isVisible(), false, 'P059 stays hidden at ' + width + '/' + textSize);
        assert.equal(await monthly.locator('.review-icon').isVisible(), false, 'P060 stays hidden at ' + width + '/' + textSize);
      }
      assert.equal(await weekly.locator('.review-icon svg').getAttribute('width'), '24');
      assert.equal(await monthly.locator('.review-icon svg').getAttribute('width'), '24');
    }
    await qa.inspect('review-desk', { icons: [
      [weeklyAction().locator('svg'), 17, 'P054 weekly start'],
      [monthlyAction().locator('svg'), 17, 'P055 monthly start'],
      [practice('known').locator('svg'), 18, 'P056 known practice'],
      [practice('ko').locator('svg'), 18, 'P057 Korean-to-English practice'],
      [practice('sentence').locator('svg'), 18, 'P058 sentence practice'],
    ] });
    const preserveGrades = async label => {
      const current = (await qa.getState()).state;
      assert.deepEqual(current.sessions[historyId], preservedHistory, label + ' keeps the historical session intact');
      for (const word of selected) assert.deepEqual(grades(current.progress[word.id]), grades(preserved.state.progress[word.id]), label + ' does not grade ' + word.word);
      return current;
    };
    const returnHome = async () => {
      await button('저장하고 나가기').click();
      await page.getByRole('heading', { name: '학습 기록을 저장했어요', exact: true }).waitFor();
      await qa.saved();
      await page.getByRole('button', { name: /^학습 홈으로/ }).click();
      await reviewTab();
    };
    for (const [kind, action] of [['weekly', weeklyAction], ['monthly', monthlyAction]]) {
      await qa.click(action(), kind + '-start');
      await page.locator('.session-panel').waitFor();
      await qa.saved();
      let current = await preserveGrades(kind + ' start');
      const sessionId = current.settings.activeSessionId;
      assert.equal(current.sessions[sessionId].kind, kind);
      await returnHome();
      assert.match(await action().innerText(), /중단한 점검 이어서/);
      await qa.click(action(), kind + '-resume');
      await page.locator('.session-panel').waitFor();
      await qa.saved();
      current = await preserveGrades(kind + ' resume');
      assert.equal(current.settings.activeSessionId, sessionId, 'Continue resumes the same review');
      await returnHome();
    }
    for (const mode of ['known', 'ko', 'sentence']) {
      await qa.click(practice(mode), 'practice-' + mode);
      await page.locator('.session-panel').waitFor();
      await qa.saved();
      const current = await preserveGrades(mode + ' practice start');
      assert.equal(current.sessions[current.settings.activeSessionId].kind, 'practice');
      assert.equal(current.sessions[current.settings.activeSessionId].practiceMode, mode);
      if (mode !== 'sentence') await returnHome();
    }
    report.checks.push('P054–P060: weekly/monthly start and same-session resume plus all three practice handlers work; hidden card glyphs stay hidden and existing grades/history are unchanged');

    // The final sentence practice supplies the real pronunciation/timer/AI panel.
    await page.getByRole('heading', { name: '내 문장 만들기', exact: true }).waitFor();
    const audio = page.locator('.word-pronunciation .speak-wrap');
    const listen = audio.getByRole('button', { name: /기기 음성 듣기$/ });
    await listen.waitFor();
    const timer = page.locator('.session-panel .timer');
    assert.equal(await timer.getAttribute('aria-label'), '타이머 일시 정지');
    await qa.saved();
    const selfCheckSummary = page.locator('.session-panel details.notes-details > summary')
      .filter({ hasText: /^스스로 점검하기$/ });
    await selfCheckSummary.click();
    const dictionary = audio.getByRole('link', { name: '사전 발음', exact: true });
    const oxford = page.locator('.session-panel .dictionary-links').getByRole('link', { name: 'Oxford 발음·용례', exact: true });
    const korean = page.locator('.session-panel .dictionary-links').getByRole('link', { name: '영한사전', exact: true });
    const feedbackPanel = page.getByRole('region', { name: 'AI 참고 의견', exact: true });
    await qa.inspect('pronunciation-timer-feedback', { icons: [
      [listen.locator('svg'), 18, 'P073 device speech'], [dictionary.locator('svg'), 14, 'P074 dictionary audio'],
      [oxford.locator('svg'), 13, 'P075 Oxford link'], [korean.locator('svg'), 13, 'P076 Korean dictionary'],
      [timer.locator('svg'), 15, 'P078 timer pause'], [feedbackPanel.locator('h3 svg'), 17, 'P079 AI reference'],
    ] });
    for (const link of [dictionary, oxford, korean]) {
      assert.match(await link.getAttribute('href'), /^https:\/\//);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /noreferrer/);
    }
    // Pausing intentionally replaces the sentence subtree with the pause view.
    await qa.click(timer, 'timer-pause');
    await page.locator('.pause-overlay').waitFor();
    assert.equal(await timer.getAttribute('aria-label'), '타이머 계속');
    await qa.checkIcon(timer.locator('svg'), 15, 'P077 timer continue');
    assert.equal(await page.getByLabel('내 영어 문장', { exact: true }).isVisible(), false);
    assert.equal(await feedbackPanel.isVisible(), false);
    await qa.saved();
    await qa.click(timer, 'timer-continue');
    assert.equal(await timer.getAttribute('aria-label'), '타이머 일시 정지');
    await listen.waitFor();
    await qa.saved();
    await preserveGrades('Timer toggles');

    const beforeAudio = await qa.getState();
    await qa.click(listen, 'device-speech');
    assert.equal(await page.evaluate(() => window.__recordIconAudio.calls), 1);
    await page.evaluate(() => window.__recordIconAudio.utterance.onstart?.());
    await audio.getByRole('status').filter({ hasText: '재생 중' }).waitFor();
    await page.evaluate(() => window.__recordIconAudio.utterance.onend?.());
    await assertUnchanged(beforeAudio, 'Listening does not save or grade a record');

    const sentenceInput = page.getByLabel('내 영어 문장', { exact: true });
    const spoken = page.getByLabel('내 문장을 소리 내어 말해 봤어요', { exact: true });
    const active = (await qa.getState()).state;
    const activeId = active.settings.activeSessionId;
    const activeRecordId = active.sessions[activeId].ids[active.sessions[activeId].index];
    const originalGrades = grades(active.sessions[activeId].records[activeRecordId]);
    await sentenceInput.fill('I like this apple.');
    const aiGate = new Promise(resolve => { releaseAi = resolve; });
    let syntheticAiCalls = 0;
    await page.route('**/api/sentence-feedback', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      syntheticAiCalls++;
      await aiGate;
      await route.fulfill({ status: 429, json: {
        error: 'Synthetic provider limit; no AI generation occurred.', code: 'provider_limit', providerStatus: 429,
        receipt: feedbackReceipt(route, 'failed'),
      } });
    });
    await qa.click(feedbackPanel.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }), 'ai-reference-request');
    await feedbackPanel.locator('svg.spin').waitFor();
    assert.notEqual(await sentenceInput.getAttribute('readonly'), null);
    assert.equal(await spoken.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: /^문장을 완성했어요/ }).isDisabled(), true);
    await qa.inspect('ai-reference-pending', { widths: [320, 1440], readOnly: false, icons: [
      [feedbackPanel.locator('h3 svg'), 17, 'P079 AI reference'], [feedbackPanel.locator('svg.spin'), 16, 'P080 request loading'],
    ] });
    releaseAi();
    await page.getByRole('alert').filter({ hasText: 'OpenAI 사용 한도로 점검하지 못했어요' }).waitFor();
    assert.equal(await sentenceInput.inputValue(), 'I like this apple.');
    assert.equal(await sentenceInput.getAttribute('readonly'), null);
    assert.equal(await spoken.isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: /^문장을 완성했어요/ }).isEnabled(), true);
    assert.equal(syntheticAiCalls, 1);
    await page.unroute('**/api/sentence-feedback');
    await returnHome();
    const final = await preserveGrades('Synthetic AI failure');
    assert.deepEqual(grades(final.sessions[activeId].records[activeRecordId]), originalGrades, 'AI reference requests do not complete or grade a sentence');
    report.checks.push('P073–P080: speech events, external-link attributes, play/pause and AI pending controls retain their handlers/labels; a synthetic provider failure keeps the sentence and original grades, with no real AI generation');
  } catch (error) { failure = error; }
  finally { releaseAi?.(); }
  await qa.finish(failure);
})().catch(error => { console.error(error); process.exitCode = 1; });
