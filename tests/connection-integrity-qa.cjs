const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launchBrowser, closeBrowser, base, accountHeaders, waitForWorker } = require('./qa/runtime.cjs');
const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const word = words.find(w => w.word === 'work' && w.pos === 'v.');
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const out = 'outputs/connection-integrity'; fs.mkdirSync(out, { recursive: true });
const results = [], errors = [];
const saved = page => page.getByText('서버에 저장됨', { exact: true }).waitFor();
function session() {
  return { id: crypto.randomUUID(), kind: 'daily', date, period: date, ids: [word.id], warmupIds: [],
    records: { [word.id]: { entryId: word.id, meaning: content[word.id].meaning, familiarity: 'uncertain', en: 'independent', ko: 'independent', sentenceStatus: 'unmeasured', sentence: '', notes: '', learnedOn: date, lastPracticedOn: date, material: content[word.id] } },
    stage: 'sentence', index: 0, retry: [], retryMode: false, elapsed: 10, finished: false, paused: false, createdAt: new Date().toISOString() };
}
(async () => {
  await waitForWorker(); const browser = await launchBrowser();
  try {
    async function setup(label, stage = 'sentence') {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders(label) });
      const get = async () => (await context.request.get(base + '/api/state')).json();
      const initial = await get(), s = session(); s.stage = stage;
      if (stage === 'warmup') s.warmupIds = [word.id];
      if (stage === 'learn') {
        delete s.records[word.id].learnedOn; delete s.records[word.id].lastPracticedOn;
        s.records[word.id].en = s.records[word.id].ko = 'unmeasured';
      }
      const seeded = await context.request.put(base + '/api/state', { data: { revision: initial.revision,
        settings: { ...initial.state.settings, dailyGoal: 1, activeSessionId: s.id }, sessions: { [s.id]: s },
        progress: { [word.id]: { meaning: content[word.id].meaning, familiarity: 'uncertain', en: 'independent', ko: 'independent', needsReview: true, studyDates: [date], lastStudied: date } } } });
      assert.equal(seeded.status(), 200);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base, { waitUntil: 'domcontentloaded' }); await saved(page);
      await page.getByRole('button', { name: '중단한 학습 이어서', exact: false }).click(); await saved(page);
      await (stage === 'learn' ? page.getByLabel('오늘 공부할 뜻', { exact: false }) : page.getByLabel(
        stage === 'en' ? '한국어 뜻 입력' : stage === 'ko' ? '영어 단어 입력' : stage === 'warmup' ? '떠오르는 한국어 뜻' : '내 영어 문장', { exact: true })).waitFor();
      return { context, page, get, s };
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { context, page, get, s } = await setup('audit_transition');
      await page.getByLabel('내 영어 문장', { exact: true }).fill('I work near my home.');
      await page.getByLabel('보완할 점', { exact: false }).fill('unsaved sentence note');
      await page.getByRole('tab', { name: '주간·월말 점검', exact: true }).click();
      await page.locator('[data-review-kind="monthly"]').getByRole('button', { name: '전체 점검 시작', exact: false }).click(); await saved(page);
      const switched = await get(); assert.notEqual(switched.state.settings.activeSessionId, s.id);
      await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(page);
      await page.getByRole('button', { name: '학습 홈으로', exact: false }).click();
      await page.getByRole('button', { name: '중단한 학습 이어서', exact: false }).click(); await saved(page);
      const actual = await page.getByLabel('내 영어 문장', { exact: true }).inputValue();
      assert.equal(actual, 'I work near my home.');
      assert.equal((await get()).state.sessions[s.id].records[word.id].sentence, actual);
      await page.reload(); await saved(page);
      await page.getByRole('button', { name: '중단한 학습 이어서', exact: false }).click(); await saved(page);
      assert.equal(await page.getByLabel('내 영어 문장', { exact: true }).inputValue(), actual);
      results.push({ case: 'switch-session-preserves-draft', attempt, expected: 'I work near my home.', actual, savedSentence: (await get()).state.sessions[s.id].records[word.id].sentence });
      if (attempt === 1) await page.screenshot({ path: out + '/switch-session-draft.png', fullPage: true });
      await context.close();
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { context, page, get, s } = await setup('audit_pause');
      let held; await page.route('**/api/state', route => {
        if (route.request().method() === 'PUT') { held = route; return; }
        return route.continue();
      });
      await page.getByLabel('내 영어 문장', { exact: true }).fill('I work today.');
      await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click();
      await page.getByText('저장 중', { exact: true }).waitFor();
      const input = page.getByLabel('내 영어 문장', { exact: true });
      const visibleDuringSave = await input.isVisible();
      results.push({ case: 'pause-save-input-availability', attempt, visibleDuringSave });
      await held.continue(); await saved(page); await context.close();
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { context, page, get, s } = await setup('audit_library_conflict', 'learn');
      const original = content[word.id].expression;
      await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
      await page.getByRole('button', { name: 'work 동사', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('work from home');
      await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).fill('집에서 일하다');
      await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await saved(page); await dialog.waitFor({ state: 'hidden' });
      const edited = (await get()).state.progress[word.id]; assert.equal(edited.expression, 'work from home');
      await page.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
      await page.getByRole('button', { name: '뜻을 확인했어요', exact: false }).click(); await saved(page);
      const reverted = (await get()).state.progress[word.id]; assert.equal(reverted.expression, 'work from home'); assert.equal(reverted.expressionTranslation, '집에서 일하다'); assert.notEqual(reverted.expression, original);
      results.push({ case: 'lesson-preserves-saved-library-edit', attempt, edited: edited.expression, afterLesson: reverted.expression,
        editedTranslation: edited.expressionTranslation, afterLessonTranslation: reverted.expressionTranslation });
      await context.close();
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { context, page, get } = await setup('audit_monthly_skip');
      await page.getByRole('tab', { name: '주간·월말 점검', exact: true }).click();
      await page.locator('[data-review-kind="monthly"]').getByRole('button', { name: '전체 점검 시작', exact: false }).click(); await saved(page);
      const monthlyId = (await get()).state.settings.activeSessionId;
      await page.getByRole('button', { name: '미측정으로 남기고 다음에', exact: true }).click(); await saved(page);
      await page.getByRole('button', { name: '문장은 선택 · 쓰기 점검만 기록', exact: true }).click(); await saved(page);
      const monthly = (await get()).state.sessions[monthlyId];
      assert.equal(monthly.finished, false); assert.equal(monthly.stage, 'checkpoint'); assert.equal(monthly.records[word.id].ko, 'unmeasured');
      await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(page);
      await page.getByRole('button', { name: '학습 홈으로', exact: false }).click();
      const pendingCount = await page.getByRole('region', { name: '이어서 할 점검', exact: true }).count();
      await page.getByRole('tab', { name: '주간·월말 점검', exact: true }).click();
      const card = page.locator('[data-review-kind="monthly"]');
      const hasRestart = await card.getByRole('button', { name: '다시 점검하기', exact: false }).count();
      assert.equal(pendingCount, 1); assert.equal(hasRestart, 0);
      await card.getByRole('button', { name: '중단한 점검 이어서', exact: false }).click(); await saved(page);
      await page.getByRole('button', { name: '다음 묶음 계속', exact: true }).click(); await saved(page);
      assert.equal((await get()).state.sessions[monthlyId].stage, 'ko');
      results.push({ case: 'monthly-skip-retains-resume', attempt, finished: monthly.finished, ko: monthly.records[word.id].ko, pendingCount, hasRestart,
        remaining: monthly.ids.filter(id => monthly.records[id].ko === 'unmeasured').length });
      await context.close();
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('audit_repair') });
      const get = async () => (await context.request.get(base + '/api/state')).json();
      const initial = await get();
      const prior = new Date(date + 'T00:00:00Z'); prior.setUTCDate(prior.getUTCDate() - 1); const previous = prior.toISOString().slice(0, 10);
      const old = session(); old.date = old.period = previous; old.stage = 'done'; old.finished = true; old.paused = true;
      old.createdAt = previous + 'T01:00:00.000Z';
      Object.assign(old.records[word.id], { learnedOn: previous, lastPracticedOn: previous, sentenceStatus: 'written', sentence: 'I work today.' });
      const monthly = session(); monthly.kind = 'monthly'; monthly.period = previous.slice(0, 7); monthly.stage = 'ko'; monthly.paused = true;
      monthly.records[word.id] = { entryId: word.id, meaning: content[word.id].meaning, familiarity: 'known', en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' };
      const seeded = await context.request.put(base + '/api/state', { data: { revision: initial.revision, settings: { ...initial.state.settings, dailyGoal: 1 },
        sessions: { [old.id]: old, [monthly.id]: monthly }, progress: { [word.id]: { ...content[word.id], source: undefined, ipa: undefined, attribution: undefined, url: undefined,
          familiarity: 'known', en: 'independent', ko: 'independent', sentenceStatus: 'written', needsReview: false, studyDates: [previous], lastStudied: previous } } } });
      assert.equal(seeded.status(), 200);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(base); await saved(page);
      await page.getByRole('tab', { name: '전체 단어장', exact: true }).click(); await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
      await page.getByRole('button', { name: 'work 동사', exact: true }).click();
      const dialog = page.getByRole('dialog'); await dialog.getByText('친숙도·학습 우선순위', { exact: true }).click();
      await dialog.getByRole('button', { name: '조금 헷갈려요', exact: true }).click();
      await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await saved(page); await dialog.waitFor({ state: 'hidden' });
      const before = (await get()).state.progress[word.id]; assert.equal(before.needsReview, true);
      await page.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '오늘 배정 바로잡기', exact: true }).count(), 0);
      const after = (await get()).state.progress[word.id]; assert.equal(after.needsReview, true); assert.equal(after.familiarity, 'uncertain');
      results.push({ case: 'repair-preserves-new-familiarity-difficulty', attempt, beforeNeedsReview: before.needsReview, afterNeedsReview: after.needsReview, familiarity: after.familiarity });
      await context.close();
    }
    for (const stage of ['warmup', 'en', 'ko', 'learn']) {
      const { context, page, get, s } = await setup('connected_draft_' + stage, stage);
      if (stage === 'learn') {
        await page.getByText('표현·예문 수정하기', { exact: true }).click();
        await page.getByLabel('함께 익힐 표현', { exact: true }).fill('work here');
        await page.getByLabel('표현의 한국어 뜻', { exact: true }).fill('여기에서 일하다');
      } else await page.getByLabel(stage === 'en' ? '한국어 뜻 입력' : stage === 'ko' ? '영어 단어 입력' : '떠오르는 한국어 뜻', { exact: true }).fill('draft before switching');
      await page.getByRole('tab', { name: '주간·월말 점검', exact: true }).click();
      await page.locator('[data-review-kind="monthly"]').getByRole('button', { name: '전체 점검 시작', exact: false }).click(); await saved(page);
      const snapshot = await get(), record = snapshot.state.sessions[s.id].records[word.id];
      assert.notEqual(snapshot.state.settings.activeSessionId, s.id);
      if (stage === 'learn') {
        assert.equal(record.material.expression, 'work here');
        assert.equal(snapshot.state.progress[word.id].expression, 'work here');
        assert.equal(record.learnedOn, undefined);
      } else assert.equal((stage === 'warmup' ? snapshot.state.sessions[s.id].warmupDraft : record.draft).answer, 'draft before switching');
      assert.equal(record.en, s.records[word.id].en); assert.equal(record.ko, s.records[word.id].ko);
      results.push({ case: 'switch-preserves-each-draft', stage }); await context.close();
    }
    {
      const { context, page, get, s } = await setup('connected_failure');
      await page.getByLabel('내 영어 문장', { exact: true }).fill('My draft survives failure.');
      await page.route('**/api/state', route => route.request().method() === 'PUT'
        ? route.fulfill({ status: 503, json: { error: '검사 저장 실패' } }) : route.continue());
      await page.getByRole('tab', { name: '주간·월말 점검', exact: true }).click();
      await page.locator('[data-review-kind="monthly"]').getByRole('button', { name: '전체 점검 시작', exact: false }).click();
      await page.getByRole('alert').filter({ hasText: '검사 저장 실패' }).waitFor();
      assert.equal((await get()).state.settings.activeSessionId, s.id);
      assert.equal(Object.keys((await get()).state.sessions).length, 1);
      await page.unroute('**/api/state'); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await saved(page);
      assert.equal((await get()).state.sessions[s.id].records[word.id].sentence, 'My draft survives failure.');
      results.push({ case: 'failed-flush-prevents-switch-and-retry-preserves-draft' }); await context.close();
    }
    {
      const { context, page, get, s } = await setup('connected_material_conflict', 'learn');
      await page.getByText('표현·예문 수정하기', { exact: true }).click();
      await page.getByLabel('함께 익힐 표현', { exact: true }).fill('work abroad');
      await page.getByLabel('표현의 한국어 뜻', { exact: true }).fill('해외에서 일하다');
      await page.getByRole('tab', { name: '전체 단어장', exact: true }).click();
      await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
      await page.getByRole('button', { name: 'work 동사', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('함께 익힐 표현', { exact: true }).fill('work from home');
      await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).fill('집에서 일하다');
      await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await saved(page); await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('tab', { name: '오늘의 학습', exact: true }).click();
      await page.getByRole('button', { name: '뜻을 확인했어요', exact: false }).click();
      await page.getByRole('alert').filter({ hasText: '단어장에서 같은 자료가 바뀌었어요' }).waitFor();
      assert.equal((await get()).state.sessions[s.id].stage, 'learn');
      assert.equal(await page.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'work abroad');
      await page.getByRole('button', { name: '단어장 최신 내용 적용', exact: true }).click();
      assert.equal(await page.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'work from home');
      await page.getByLabel('함께 익힐 표현', { exact: true }).fill('work here');
      await page.getByLabel('표현의 한국어 뜻', { exact: true }).fill('여기서 일하다');
      await page.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(page);
      await page.reload(); await saved(page);
      await page.getByRole('button', { name: '중단한 학습 이어서', exact: false }).click(); await saved(page);
      await page.getByRole('button', { name: '뜻을 확인했어요', exact: false }).click(); await saved(page);
      assert.equal((await get()).state.progress[word.id].expression, 'work here');
      assert.equal((await get()).state.progress[word.id].expressionTranslation, '여기서 일하다');
      results.push({ case: 'conflicting-edits-require-resolution-and-paused-edits-survive-reconnect' }); await context.close();
    }
    {
      const { context, page, get, s } = await setup('connected_assessment');
      await page.getByLabel('내 영어 문장', { exact: true }).fill('Saved before familiarity.');
      await page.getByRole('button', { name: '학습 설정', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: '친숙도 다시 확인하기', exact: true }).click(); await saved(page);
      const snapshot = await get();
      assert.equal(snapshot.state.sessions[s.id].records[word.id].sentence, 'Saved before familiarity.');
      assert.equal(snapshot.state.settings.assessments.A1.index, 0);
      assert.equal(snapshot.state.settings.assessments.A1.ids.length, 20);
      results.push({ case: 'familiarity-start-flushes-lesson-draft' }); await context.close();
    }
    for (const malformed of ['assessment-cursor', 'missing-active-session', 'personal-without-definition', 'mismatched-sense-key']) {
      const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('audit_boundary') });
      const get = async () => (await context.request.get(base + '/api/state')).json();
      const initial = await get(), settings = initial.state.settings, progress = {};
      if (malformed === 'assessment-cursor') settings.assessments.A1 = { ids: [word.id], index: 1, marks: {}, completed: false };
      if (malformed === 'missing-active-session') settings.activeSessionId = crypto.randomUUID();
      if (malformed === 'personal-without-definition') progress['personal_' + crypto.randomUUID()] = { meaning: '테스트' };
      if (malformed === 'mismatched-sense-key') progress[word.id] = { senses: { '의미 A': { meaning: '의미 B' } } };
      const response = await context.request.put(base + '/api/state', { data: { revision: initial.revision, settings, progress, sessions: {} } });
      const snapshot = await get();
      const restore = await context.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(snapshot.revision) },
        data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state: snapshot.state } });
      assert.equal(response.status(), 400); assert.equal(snapshot.revision, initial.revision); assert.equal(restore.status(), 200);
      results.push({ case: 'save-restore-boundaries-agree', malformed, saveStatus: response.status(), restoreStatus: restore.status(), restoreMessage: (await restore.json()).error });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/browser-findings.json', JSON.stringify({ date, results, errors }, null, 2));
    console.log(JSON.stringify({ results, errors }));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });

