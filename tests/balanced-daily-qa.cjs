// Local built Worker and synthetic account only. No live learner or AI writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launchBrowser, closeBrowser, base, accountHeaders, axePath } = require('./qa/runtime.cjs');
const out = 'outputs/balanced-daily'; fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const oldDate = new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);

(async () => {
  const browser = await launchBrowser(), checks = [], errors = [], audits = [];
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('balanced') });
    const get = async () => (await c.request.get(base + '/api/state')).json();
    const initial = await get(), pool = words.filter(w => w.level === 'A1');
    const old = pool.filter((w, i) => pool.findIndex(x => x.headword === w.headword) === i).slice(0, 10).map(w => w.id);
    const sample = pool.slice(0, 20).map(w => w.id), sid = crypto.randomUUID(), mid = crypto.randomUUID();
    const progress = Object.fromEntries(pool.map(w => [w.id, { familiarity: 'uncertain' }]));
    const records = Object.fromEntries(old.map(id => [id, { entryId: id, meaning: content[id].meaning, familiarity: 'known', en: 'independent', ko: 'help', sentenceStatus: 'written', sentence: 'A preserved sentence.', notes: 'Keep this note.', learnedOn: oldDate }]));
    for (const id of old) progress[id] = { familiarity: 'known', meaning: content[id].meaning, en: 'independent', ko: 'help', sentenceStatus: 'written', needsReview: true, studyDates: [oldDate], lastStudied: oldDate };
    const previous = { id: sid, kind: 'daily', date: oldDate, period: oldDate, ids: old, records, warmupIds: [], stage: 'done', index: 0, retry: [], retryMode: false, elapsed: 900, finished: true, paused: true, createdAt: oldDate + 'T01:00:00Z' };
    const monthly = { ...structuredClone(previous), id: mid, kind: 'monthly', period: oldDate.slice(0, 7), stage: 'ko', finished: false,
      records: Object.fromEntries(old.map(id => [id, { entryId: id, meaning: content[id].meaning, en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' }])) };
    const state = { ...initial.state, settings: { ...initial.state.settings, dailyGoal: 3, assessments: { A1: { ids: sample, index: 20, marks: Object.fromEntries(sample.map(id => [id, 'uncertain'])), completed: true } } }, progress, sessions: { [sid]: previous, [mid]: monthly } };
    const restored = await c.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(initial.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(restored.status(), 200, await restored.text());
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    let aiCalls = 0; p.on('request', r => { if (r.url().includes('/api/sentence-feedback')) aiCalls++; });
    const saved = () => p.getByText('서버에 저장됨', { exact: true }).waitFor();
    const openSettings = async () => { await p.getByRole('button', { name: '학습 설정', exact: true }).click(); };
    const closeSettings = async () => { await p.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); await p.getByRole('dialog').waitFor({ state: 'hidden' }); };
    const setGoal = async n => { await p.getByRole('combobox', { name: '하루 목표', exact: true }).click(); await p.getByRole('option', { name: n === 3 ? '3개 · 기본 목표' : n + '개', exact: true }).click(); await saved(); };
    const split = async (n, r) => assert.equal(await p.locator('.daily-allocation').innerText(), `새 학습 ${n}개 · 이전 학습·복습 ${r}개`);
    await p.goto(base, { waitUntil: 'domcontentloaded' }); await saved();
    for (let n = 1; n <= 10; n++) {
      await openSettings(); await setGoal(n);
      const rule = await p.locator('.goal-allocation').innerText();
      assert.ok(rule.includes(n === 1 ? '번갈아' : `새 단어 ${Math.ceil(n / 2)}개 · 복습 ${Math.floor(n / 2)}개`));
      // Yesterday's legacy round introduced words, so a one-word day reviews.
      await closeSettings(); await split(n === 1 ? 0 : Math.ceil(n / 2), n === 1 ? 1 : Math.floor(n / 2));
    }
    checks.push('settings and today previews agree for all goals 1–10 while a monthly session remains open');
    await p.locator('.pending-daily-review summary').click();
    await p.getByRole('list', { name: '대기 중인 복습 단어' }).locator('li').first().waitFor();
    assert.equal(await p.getByRole('list', { name: '대기 중인 복습 단어' }).locator('li').count(), 5);
    for (const width of [320, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.addScriptTag({ path: axePath });
      const issues = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      audits.push({ width, issues }); assert.deepEqual(issues, []);
      if (width === 390) await p.screenshot({ path: out + '/balanced-mobile.png', fullPage: true });
    }
    checks.push('pending review remains inspectable; four viewport widths have no overflow or automated accessibility violations');
    await openSettings(); await p.getByRole('checkbox', { name: '신규 단어 잠시 쉬기 · 이월만 배정' }).check(); await saved();
    assert.match(await p.locator('.goal-allocation').innerText(), /복습만 최대 10개/);
    await closeSettings(); await split(0, 10);
    await openSettings(); await p.getByRole('checkbox', { name: '신규 단어 잠시 쉬기 · 이월만 배정' }).uncheck(); await saved(); await setGoal(3); await closeSettings(); await split(2, 1);
    checks.push('new-word pause overrides the balanced rule and unpausing restores it');
    await p.getByRole('button', { name: '오늘의 학습 시작', exact: true }).click(); await saved();
    let data = await get(); const firstId = data.state.settings.activeSessionId, first = data.state.sessions[firstId];
    assert.equal(first.ids.length, 3); assert.equal(Object.values(first.records).filter(r => r.dailyOrigin === 'new').length, 2);
    for (let i = 0; i < first.warmupIds.length; i++) {
      await p.getByLabel('떠오르는 한국어 뜻', { exact: true }).fill('뜻'); await p.getByRole('button', { name: '뜻 확인', exact: false }).click();
      await p.getByRole('button', { name: '스스로 떠올렸어요', exact: true }).click(); await saved();
    }
    for (let i = 0; i < first.ids.length; i++) { await p.getByRole('button', { name: '뜻을 확인했어요', exact: false }).click(); await saved(); }
    await p.getByLabel('한국어 뜻 입력', { exact: true }).fill('보존할 임시 답');
    await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved();
    await p.reload({ waitUntil: 'domcontentloaded' }); await saved(); await split(2, 1);
    await openSettings(); await setGoal(10); await closeSettings();
    assert.match(await p.locator('.planned-allocation').innerText(), /새 학습 3개 · 복습 4개/);
    await p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved();
    assert.equal(await p.getByLabel('한국어 뜻 입력', { exact: true }).inputValue(), '보존할 임시 답');
    data = await get(); assert.deepEqual(data.state.sessions[firstId].ids, first.ids);
    checks.push('saved origins and recall draft survive reload and raising the goal; the unfinished round is never replaced');
    // The existing top-up QA exercises the full grading flow. Here finish this
    // synthetic fixture so the balanced seven-word allocation can be inspected.
    const finished = { ...data.state.sessions[firstId], finished: true, stage: 'done', index: 0, paused: true,
      records: Object.fromEntries(Object.entries(data.state.sessions[firstId].records).map(([id, r]) => { const next = { ...r, en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'Keep original work.', notes: 'Keep original note.' }; delete next.draft; return [id, next]; })) };
    const put = await c.request.put(base + '/api/state', { data: { revision: data.revision, progress: {}, sessions: { [firstId]: finished } } }); assert.equal(put.status(), 200, await put.text());
    await p.reload({ waitUntil: 'domcontentloaded' }); await saved();
    await p.getByRole('button', { name: '추가 7개 학습하기', exact: true }).click(); await saved();
    data = await get(); const extraId = data.state.settings.activeSessionId, extra = data.state.sessions[extraId];
    assert.equal(extra.ids.length, 7); assert.equal(Object.values(extra.records).filter(r => r.dailyOrigin === 'new').length, 3);
    assert.equal(Object.values(extra.records).filter(r => r.dailyOrigin === 'returning').length, 4);
    assert.deepEqual(data.state.sessions[firstId], finished); assert.deepEqual(data.state.sessions[sid], previous); assert.deepEqual(data.state.sessions[mid], monthly);
    await p.reload({ waitUntil: 'domcontentloaded' }); await saved(); await split(5, 5);
    await openSettings(); await setGoal(1); await closeSettings(); await split(5, 5);
    assert.deepEqual((await get()).state.sessions[extraId].ids, extra.ids);
    checks.push('3 → 10 adds new3/review4, totals new5/review5, and goal reduction preserves all ten targets and prior daily/monthly records');
    assert.equal(aiCalls, 0); assert.deepEqual(errors, []);
    const result = { passed: true, checks, audits, browserErrors: errors, aiCalls };
    fs.writeFileSync(out + '/validation.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
