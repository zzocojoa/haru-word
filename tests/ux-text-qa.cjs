// Built loopback Worker, synthetic accounts and isolated component fixture only.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { build } = require('esbuild');
const { base, launchBrowser, closeBrowser, waitForWorker, accountHeaders, axePath } = require('./qa/runtime.cjs');
const { markFamiliarity } = require('./familiarity-actions.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/ux-text/${engine}`;
const words = JSON.parse(fs.readFileSync('data/words.json'));
(async () => {
  await waitForWorker(); fs.mkdirSync(out, { recursive: true });
  const browser = await launchBrowser({ engine }), checks = [], errors = [], a11y = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('ux_copy') });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    const saved = () => page.getByText('저장됨', { exact: true }).waitFor();
    const snapshot = async () => (await context.request.get(base + '/api/state')).json();
    async function restoreGuard(message, exitLabel) {
      await page.getByRole('button', { name: exitLabel, exact: true }).waitFor();
      await saved();
      const before = await snapshot();
      await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
      await page.getByRole('button', { name: '기록 관리', exact: true }).click();
      await page.getByRole('menuitem', { name: '백업으로 복원', exact: true }).click();
      await page.getByText(message, { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: exitLabel, exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.deepEqual(await snapshot(), before, 'restore guard navigation preserves the state and revision');
    }
    await page.route('**/api/state', route => route.abort('failed'));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('기록을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.', { exact: true }).waitFor();
    assert.equal(await page.getByText('저장됨', { exact: true }).count(), 0);
    await page.unroute('**/api/state'); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await saved();
    checks.push('load network failure uses Korean recovery guidance, does not claim saved, and explicit retry recovers');

    const initial = await snapshot(), ids = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
    const seed = { revision: initial.revision, progress: {}, sessions: {}, settings: { ...initial.state.settings, assessments: { A1: { ids, index: 19, completed: false, marks: Object.fromEntries(ids.slice(0, 19).map(id => [id, 'new'])) } } } };
    assert.equal((await context.request.put(base + '/api/state', { data: seed })).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded' }); await saved();
    await page.getByRole('button', { name: '단어 20개 친숙도 확인', exact: true }).click();
    await restoreGuard('‘나중에 이어 하기’로 홈에 돌아온 뒤 백업을 복원해 주세요.', '나중에 이어 하기');
    await markFamiliarity(page, 'new');
    await page.getByRole('heading', { name: '친숙도를 확인했어요', exact: true }).waitFor();
    await saved();
    await restoreGuard('‘저장하고 나가기’를 누른 뒤 백업을 복원해 주세요.', '저장하고 나가기');
    const beforeExit = await snapshot(); let held;
    await page.route('**/api/state', route => route.request().method() === 'PUT' ? (held = route, undefined) : route.continue());
    const leave = page.getByRole('button', { name: '저장하고 나가기', exact: true });
    await leave.click(); await page.getByText('저장 중', { exact: false }).first().waitFor();
    assert.equal(await leave.isDisabled(), true); assert.ok(held);
    await held.abort('failed');
    await page.getByText('저장 결과를 확인하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: '친숙도를 확인했어요', exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('button', { name: '현재 입력 백업', exact: true }).isVisible(), true);
    assert.deepEqual((await snapshot()).state, beforeExit.state);
    assert.equal(await page.getByText('친숙도 확인을 마쳤어요. 원할 때 오늘 학습을 시작하세요.', { exact: true }).count(), 0);
    await page.unroute('**/api/state'); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await saved();
    await leave.click(); await page.getByText('친숙도 확인을 마쳤어요. 원할 때 오늘 학습을 시작하세요.', { exact: true }).waitFor(); await saved();
    assert.deepEqual((await snapshot()).state, beforeExit.state);
    checks.push('save-and-leave waits for acknowledgment, keeps assessment/drafts on failure, offers backup/retry, and exits only after success');

    await page.getByRole('button', { name: '오늘의 학습 시작', exact: true }).click();
    await page.getByRole('heading', { name: '이 단어, 얼마나 익숙한가요?', exact: true }).waitFor();
    await restoreGuard('‘학습 홈으로’ 돌아온 뒤 백업을 복원해 주세요.', '학습 홈으로');
    await page.getByRole('button', { name: '학습 홈으로', exact: true }).click();
    checks.push('restore blocked during unfinished/completed familiarity and candidate preparation names the available exit action and preserves all state/revision');

    const stable = await snapshot();
    async function layout(name) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ' viewport overflow');
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations);
      a11y.push({ name, violations: violations.map(v => v.id) }); assert.deepEqual(violations.map(v => v.id), []);
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    }
    for (const width of [320, 390]) for (const size of [100, 200]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addStyleTag({ content: `html { font-size: ${size}% !important; }` });
      for (const label of ['오늘 학습', '단어장', '복습 점검', '학습 기록']) assert.equal(await page.getByRole('tab', { name: label, exact: true }).count(), 1);
      await layout(`home-${width}-${size}`);
      await page.getByRole('button', { name: '학습 설정', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByText('변경하면 자동으로 저장해요. 상단에서 저장 상태를 확인해 주세요.', { exact: true }).waitFor();
      assert.doesNotMatch(await dialog.innerText(), /Free 상태|무료 계정 상태/);
      assert.equal(await dialog.getByRole('button', { name: '닫기', exact: true }).count(), 1);
      assert.equal(await dialog.locator('.dialog-scroll > label:not(.check-label)').first().evaluate(el => getComputedStyle(el).flexDirection), 'column', 'mobile labels must not collapse into a narrow vertical strip');
      assert.deepEqual(await dialog.locator('[data-slot=select-value]').evaluateAll(values => values.filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent)), [], 'selected settings must remain readable at 200% text');
      await layout(`settings-${width}-${size}`);
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    }
    assert.deepEqual(await snapshot(), stable, 'read-only views must not change any state or revision');
    checks.push('320/390px at 100/200%: consistent tabs, Korean close name, truthful settings, no horizontal overflow, axe and state/revision unchanged');

    const content = JSON.parse(fs.readFileSync('data/content.json')), word = words.find(w => w.id === ids[0]);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const sessionId = crypto.randomUUID(), sentence = 'Original <text> stays intact. '.repeat(15), notes = '내가 쓴 메모와 줄바꿈\n'.repeat(25);
    const meaning = '저장한 고유한 뜻과 줄바꿈\n'.repeat(20), explanation = '과거 AI 의견 원문을 그대로 보존해요.\n'.repeat(20);
    const feedback = { original: sentence, correctedSentence: 'Suggested <text> stays intact. '.repeat(15), explanation, model: 'gemini-3.1-flash-lite', createdAt: new Date().toISOString(), meaningUsage: 'appropriate', grammar: 'natural' };
    const record = { entryId: word.id, meaning, material: { ...content[word.id], meaning }, familiarity: 'known', en: 'independent', ko: 'help', sentenceStatus: 'written', sentence, notes, learnedOn: date, aiFeedback: feedback };
    const session = { id: sessionId, kind: 'daily', date, period: date, ids: [word.id], records: { [word.id]: record }, warmupIds: [], stage: 'done', index: 0, retry: [], retryMode: false, elapsed: 10, finished: true, paused: true, createdAt: new Date().toISOString() };
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: stable.revision, progress: {}, sessions: { [sessionId]: session } } })).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded' }); await saved();
    const historySnapshot = await snapshot();
    await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    await page.locator('.journal-day-trigger').first().click(); await page.locator('.journal-session-trigger').first().click();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 390) await page.locator('.journal-word-trigger').first().click();
      const view = width === 390 ? page.locator('.record-card:visible') : page.locator('.journal-desktop:visible');
      for (const [label, original] of [['저장한 뜻', meaning], ['내 문장', sentence], ['보완점', notes]]) {
        const summary = view.getByText(label + ' 더 보기', { exact: true });
        const disclosure = summary.locator('..');
        assert.equal(await disclosure.getAttribute('open'), null);
        await summary.focus(); await page.keyboard.press('Enter');
        assert.equal(await disclosure.locator('p').textContent(), original);
        assert.equal(await disclosure.locator('text').count(), 0);
      }
      const aiSummary = width === 390 ? view.getByText('저장한 AI 참고 의견', { exact: true }) : view.locator('.journal-feedback-row summary').first();
      await aiSummary.focus(); await page.keyboard.press('Enter');
      const result = view.locator('.ai-feedback-result');
      assert.equal(await result.getByText('AI 참고 의견 · 정답 판정은 아니에요', { exact: true }).count(), 1);
      for (const [label, original] of [['AI에 보낸 문장', feedback.original], ['AI 교정 제안', feedback.correctedSentence], ['AI 설명', explanation]]) {
        const summary = result.getByText(label + ' 더 보기', { exact: true });
        assert.equal(await summary.locator('..').getAttribute('open'), null);
        await summary.focus(); await page.keyboard.press('Enter');
        assert.equal(await summary.locator('..').locator('p').textContent(), original);
        assert.equal(await summary.locator('..').locator('text').count(), 0);
      }
      assert.equal(await result.locator('[data-feedback-provider="Google Gemini"]').isVisible(), true);
      await layout(`history-${width}`);
    }
    assert.deepEqual(await snapshot(), historySnapshot);
    checks.push('real saved history: mobile cards and desktop table disclose complete long meanings/sentences/notes and original AI input/suggestion/explanation with one caution/provider, without modifying state or revision');
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: '단어 다시 보기', exact: true }).click();
    const completed = page.locator('.completed-word'); await completed.waitFor();
    for (const [label, original] of [['저장한 뜻', meaning], ['내 문장', sentence], ['보완점', notes]]) {
      const summary = completed.getByText(label + ' 더 보기', { exact: true });
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await summary.locator('..').locator('p').textContent(), original);
    }
    assert.deepEqual(await snapshot(), historySnapshot);
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
    checks.push('completed lesson replay also discloses the original meaning, sentence and notes without a write');

    // Short records must keep the paragraph boundaries of the original UI too.
    const shortSentence = 'Music', shortNotes = '문장으로 다시 써 보기', shortExplanation = '완전한 문장이 필요해요.';
    const shortRecord = { ...record, sentence: shortSentence, sentenceStatus: 'improve', notes: shortNotes,
      aiFeedback: { ...feedback, original: shortSentence, correctedSentence: '', explanation: shortExplanation, meaningUsage: 'uncertain', grammar: 'uncertain' } };
    assert.equal((await context.request.put(base + '/api/state', { data: { revision: historySnapshot.revision, progress: {}, sessions: { [sessionId]: { ...session, records: { [word.id]: shortRecord } } } } })).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded' }); await saved();
    const shortSnapshot = await snapshot();
    await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    await page.locator('.journal-day-trigger').first().click(); await page.locator('.journal-session-trigger').first().click();
    async function separateLines(above, below, name) {
      const first = await above.boundingBox(), second = await below.boundingBox();
      assert.ok(first && second && second.y >= first.y + first.height - 1, name);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 390) await page.locator('.journal-word-trigger').first().click();
      const view = width === 390 ? page.locator('.record-card:visible') : page.locator('.journal-desktop:visible');
      const aiSummary = width === 390 ? view.getByText('저장한 AI 참고 의견', { exact: true }) : view.locator('.journal-feedback-row summary').first();
      await aiSummary.focus(); await page.keyboard.press('Enter');
      const result = view.locator('.ai-feedback-result');
      await result.getByText(shortExplanation, { exact: true }).waitFor();
      await separateLines(result.getByText(shortSentence, { exact: true }), result.getByText(shortExplanation, { exact: true }), 'short AI original and explanation occupy separate lines without a correction');
      if (width === 1440) await separateLines(view.locator('.status-warn'), view.getByText(shortNotes, { exact: true }), 'short note stays below the sentence-improvement status');
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: '단어 다시 보기', exact: true }).click();
    const replay = page.locator('.review-my-sentence');
    await replay.getByText(shortSentence, { exact: true }).waitFor();
    await separateLines(replay.getByText('그날 쓴 내 문장', { exact: true }), replay.getByText(shortSentence, { exact: true }), 'short replay sentence stays below its heading');
    assert.deepEqual(await snapshot(), shortSnapshot, 'reading short records must preserve state and revision');
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
    checks.push('short records: original/AI explanation without correction, replay heading/sentence, and desktop improvement/note keep separate lines without any state or revision write');

    const bundle = await build({ entryPoints: ['tests/fixtures/ux-text-harness.tsx'], bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
    await page.route('**/__qa_ux_text', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><title>문구 회귀 검사</title></head><body><div id="root"></div></body></html>' }));
    await page.goto(base + '/__qa_ux_text'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.getByText('작성 중인 내용을 먼저 저장해 주세요.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '다시 불러오기', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '저장 대기 설정' }).click();
    await page.getByText('저장·복원이 끝나면 다시 불러올 수 있어요.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '다시 불러오기', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '저장 완료 설정' }).click();
    assert.equal(await page.getByRole('button', { name: '다시 불러오기', exact: true }).isEnabled(), true);
    const disclosure = page.locator('.record-text'); assert.equal(await disclosure.getAttribute('open'), null);
    await page.getByText('내 문장 더 보기', { exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await disclosure.locator('p').textContent(), '원문 <태그>와 줄바꿈\n'.repeat(30));
    assert.equal(await disclosure.locator('태그').count(), 0);
    checks.push('isolated real components: reload explains unsaved/busy guards; keyboard disclosure restores every original character safely');
    const anonymous = await browser.newContext({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
    await anonymous.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const guest = await anonymous.newPage(); guest.on('pageerror', e => errors.push(e.message));
    await guest.goto(base, { waitUntil: 'domcontentloaded' });
    await guest.getByText('ChatGPT로 로그인하면 다른 기기에서도 기록을 이어 볼 수 있어요.', { exact: true }).waitFor();
    assert.equal(await guest.getByText('저장됨', { exact: true }).count(), 0);
    await guest.getByRole('button', { name: '학습 방식·출처', exact: true }).click();
    const sources = guest.getByRole('dialog');
    await sources.getByRole('link', { name: 'Oxford 원문 PDF 보기', exact: true }).waitFor();
    assert.match(await sources.innerText(), /CC BY 2.0/);
    assert.doesNotMatch(await sources.innerText(), /무료 계정 상태를 유지/);
    await sources.getByRole('button', { name: '닫기', exact: true }).click();
    await anonymous.close();
    checks.push('anonymous first visit has truthful sign-in guidance, no saved claim, and preserved source/license links');
    assert.deepEqual(errors, []);
    const report = { passed: true, engine, checks, a11y, browserErrors: errors, limitations: ['Browser emulation, not a physical iPhone or VoiceOver', 'Synthetic accounts, no production learner data or real AI'] };
    fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exit(1); });
