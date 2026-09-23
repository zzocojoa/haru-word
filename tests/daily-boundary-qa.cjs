// Built local Worker only. Synthetic account and clock; no production or AI calls.
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8787', out = 'outputs/daily-boundary';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const prior = new Date(today + 'T12:00:00Z'); prior.setUTCDate(prior.getUTCDate() - 1);
const yesterday = prior.toISOString().slice(0, 10), ids = ['arrive', 'busy', 'breakfast'].map(name => words.find(w => w.word === name).id);
const label = date => { const [y, m, d] = date.split('-').map(Number); return `${y}년 ${m}월 ${d}일`; };
const heading = date => { const [, m, d] = date.split('-').map(Number); return `${m}월 ${d}일 목표 단어`; };
const checks = [], errors = [], aiRequests = [], audits = [];
const saved = p => p.getByText('서버에 저장됨', { exact: true }).waitFor();
const get = async c => { const r = await c.request.get(base + '/api/state'); assert.equal(r.status(), 200); return r.json(); };
const put = async (c, data) => { const r = await c.request.put(base + '/api/state', { data }); assert.equal(r.status(), 200, await r.text()); };
const record = (id, learned = true) => ({ meaning: content[id].meaning, material: content[id], ...(learned ? { learnedOn: yesterday } : {}),
  en: learned ? 'independent' : 'unmeasured', ko: learned ? 'independent' : 'unmeasured', sentenceStatus: learned ? 'written' : 'unmeasured', sentence: learned ? 'Preserved sentence.' : '', notes: '' });
const makeSession = kind => ({ id: crypto.randomUUID(), kind, date: yesterday, period: kind === 'monthly' ? yesterday.slice(0, 7) : yesterday,
  ids, warmupIds: [], stage: kind === 'daily' ? 'done' : 'ko', index: 0, records: Object.fromEntries(ids.map(id => [id, record(id, kind === 'daily')])),
  retry: [], retryMode: false, elapsed: 300, paused: true, finished: kind === 'daily', createdAt: yesterday + 'T01:00:00Z' });

(async () => {
  const browser = await chromium.launch();
  try {
    const headers = { 'oai-authenticated-user-id': 'daily_boundary_' + Date.now(), 'oai-authenticated-user-email': 'qa@example.test' };
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: headers, reducedMotion: 'reduce' });
    const initial = await get(c), daily = makeSession('daily'), monthly = makeSession('monthly');
    daily.records[ids[0]].ko = 'help';
    const progress = Object.fromEntries(words.filter(w => w.level === 'A1').map(w => [w.id, { familiarity: 'uncertain' }]));
    for (const id of ids) progress[id] = { familiarity: 'known', meaning: content[id].meaning, lastStudied: yesterday, studyDates: [yesterday],
      en: 'independent', ko: id === ids[0] ? 'help' : 'independent', sentenceStatus: 'written', needsReview: id === ids[0] };
    await put(c, { revision: initial.revision, progress, settings: { ...initial.state.settings, activeSessionId: monthly.id, dailyGoal: 3,
      assessments: { A1: { ids: [], index: 0, marks: {}, completed: true } } }, sessions: { [daily.id]: daily, [monthly.id]: monthly } });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => { if (/sentence-feedback|generativelanguage/.test(r.url())) aiRequests.push(r.url()); });
    await p.clock.install({ time: new Date(yesterday + 'T14:59:55Z') });
    await p.route('**/api/study-clock', r => r.fulfill({ json: { serverTime: Date.parse(yesterday + 'T14:59:55Z') } }));
    await p.goto(base); await saved(p);
    await p.locator('.today-date time').filter({ hasText: label(yesterday) }).waitFor();
    await p.getByRole('heading', { name: heading(yesterday), exact: true }).waitFor();
    assert.match(await p.locator('.daily-metrics > div').nth(1).innerText(), /3\s*\/ 3개/);
    await p.clock.fastForward(70_000);
    await p.locator('.today-date time').filter({ hasText: label(today) }).waitFor();
    await p.getByRole('heading', { name: heading(today), exact: true }).waitFor();
    await p.getByText('시작 전 · 배정 예정', { exact: true }).waitFor();
    await p.getByText('새 학습 2개 · 이전 학습·복습 1개', { exact: true }).waitFor();
    assert.match(await p.locator('.daily-metrics > div').nth(1).innerText(), /0\s*\/ 3개/);
    const unchanged = (await get(c)).state.sessions;
    assert.deepEqual(unchanged, { [daily.id]: daily, [monthly.id]: monthly });
    checks.push('Korean midnight changes date heading, dated target list and completion count; pending monthly review and yesterday records stay unchanged');
    await p.getByRole('button', { name: '오늘의 학습 시작', exact: true }).click(); await saved(p);
    let state = (await get(c)).state;
    const started = state.sessions[state.settings.activeSessionId];
    assert.equal(started.date, today); assert.equal(started.ids.length, 3); assert.equal(started.ids[0], ids[0]);
    assert.equal(started.ids.filter(id => !ids.includes(id)).length, 2);
    assert.deepEqual(state.sessions[monthly.id], monthly);
    await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(p);
    await p.getByRole('button', { name: '학습 홈으로', exact: false }).click();
    await p.locator('.home-panel').waitFor();
    checks.push('today starts while monthly review remains unfinished, assigning one carryover plus two new words within the goal');

    // Finish this synthetic daily record to focus the remaining checks on top-up UI.
    let snapshot = await get(c);
    const complete = { ...snapshot.state.sessions[started.id], stage: 'done', finished: true, paused: true, index: 0 };
    const learned = {};
    for (const id of complete.ids) {
      complete.records[id] = { ...record(id), learnedOn: today };
      learned[id] = { ...snapshot.state.progress[id], familiarity: 'known', meaning: content[id].meaning, en: 'independent', ko: 'independent',
        sentenceStatus: 'written', needsReview: false, lastStudied: today, studyDates: [...new Set([...(snapshot.state.progress[id]?.studyDates || []), today])], senses: {} };
    }
    await put(c, { revision: snapshot.revision, progress: learned, sessions: { [complete.id]: complete } });
    await p.unroute('**/api/study-clock');
    await p.route('**/api/study-clock', r => r.fulfill({ json: { serverTime: Date.parse(today + 'T02:00:00Z') } }));
    await p.reload(); await saved(p);
    async function setting(action) {
      await p.getByRole('button', { name: '학습 설정', exact: true }).click();
      await action(); await saved(p);
      await p.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      await p.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await setting(async () => {
      await p.getByRole('combobox', { name: '하루 목표', exact: true }).click();
      await p.getByRole('option', { name: '10개', exact: true }).click();
    });
    await p.getByRole('button', { name: '추가 7개 학습하기', exact: true }).waitFor();
    await p.getByText(/목표까지 7개는 아직 배정 전/).waitFor();
    await setting(() => p.getByRole('checkbox', { name: /신규 단어 잠시 쉬기/ }).check());
    assert.equal(await p.getByRole('button', { name: '추가 7개 학습하기', exact: true }).count(), 0);
    await setting(() => p.getByRole('checkbox', { name: /신규 단어 잠시 쉬기/ }).uncheck());
    await p.getByRole('button', { name: '추가 7개 학습하기', exact: true }).click(); await saved(p);
    await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(p);
    await p.getByRole('button', { name: '학습 홈으로', exact: false }).click();
    await p.locator('.home-panel').waitFor();
    const rows = p.locator('.today-words > div');
    assert.equal(await rows.count(), 10);
    assert.equal(await rows.getByText('오늘 학습 완료', { exact: true }).count(), 3);
    assert.equal(await rows.getByText('오늘 진행 중', { exact: true }).count(), 7);
    assert.match(await p.locator('.daily-metrics > div').nth(1).innerText(), /3\s*\/ 10개/);
    state = (await get(c)).state;
    const topup = state.sessions[state.settings.activeSessionId];
    assert.equal(topup.ids.length, 7); assert.ok(topup.ids.every(id => !complete.ids.includes(id)));
    assert.deepEqual(state.sessions[complete.id], complete); assert.deepEqual(state.sessions[daily.id], daily);
    assert.deepEqual(state.sessions[monthly.id], monthly);
    checks.push('goal 3→10 shows all ten dated targets while seven are unfinished; manual pause still controls new words, and all earlier records survive');
    for (const width of [320, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    await p.setViewportSize({ width: 320, height: 900 }); await p.addStyleTag({ content: 'html{font-size:200%}' });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await p.reload(); await saved(p); await p.setViewportSize({ width: 390, height: 844 });
    await p.addScriptTag({ path: 'work/axe/package/axe.min.js' });
    const axeResult = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    audits.push({ name: 'dated all-round daily goals with periodic review', violations: axeResult.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) });
    assert.equal(axeResult.violations.length, 0, JSON.stringify(audits));
    await p.screenshot({ path: out + '/today-ten-mobile.png', fullPage: true });
    checks.push('320–1440px and 200% text fit without horizontal overflow; axe reports no violations');
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: headers });
    const p2 = await c2.newPage(); await p2.goto(base); await saved(p2);
    assert.equal(await p2.locator('.today-words > div').count(), 10);
    await p2.getByRole('heading', { name: heading(today), exact: true }).waitFor();
    assert.match(await p2.locator('.daily-metrics > div').nth(1).innerText(), /3\s*\/ 10개/);
    await p2.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(p2);
    const resumed = (await get(c2)).state;
    assert.equal(resumed.settings.activeSessionId, topup.id); assert.deepEqual(resumed.sessions[topup.id].ids, topup.ids);
    assert.equal(resumed.sessions[topup.id].index, topup.index); assert.equal(resumed.sessions[topup.id].stage, topup.stage);
    await c2.close();
    checks.push('another browser restores the whole-day overview and resumes only the unfinished seven-word round');
    const practiceContext = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { ...headers,
      'oai-authenticated-user-id': headers['oai-authenticated-user-id'] + '_practice' } });
    const practiceInitial = await get(practiceContext), practice = makeSession('practice');
    practice.ids = [ids[0]]; practice.records = { [ids[0]]: { ...record(ids[0], false), ko: 'help' } };
    const practiceProgress = Object.fromEntries(words.filter(w => w.level === 'A1').map(w => [w.id, { familiarity: 'uncertain' }]));
    practiceProgress[ids[0]] = { familiarity: 'known', meaning: content[ids[0]].meaning, ko: 'help', needsReview: true };
    await put(practiceContext, { revision: practiceInitial.revision, progress: practiceProgress, sessions: { [practice.id]: practice },
      settings: { ...practiceInitial.state.settings, dailyGoal: 3, assessments: { A1: { ids: [], index: 0, marks: {}, completed: true } } } });
    const practicePage = await practiceContext.newPage();
    practicePage.on('pageerror', e => errors.push(e.message));
    practicePage.on('request', r => { if (/sentence-feedback|generativelanguage/.test(r.url())) aiRequests.push(r.url()); });
    await practicePage.goto(base); await saved(practicePage);
    const origins = () => practicePage.getByText('새 학습 2개 · 이전 학습·복습 1개', { exact: true }).waitFor();
    await origins();
    await practicePage.getByRole('button', { name: '오늘의 학습 시작', exact: true }).click(); await saved(practicePage);
    await practicePage.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(practicePage);
    await practicePage.getByRole('button', { name: '학습 홈으로', exact: false }).click(); await origins();
    await practicePage.reload(); await saved(practicePage); await origins();
    assert.deepEqual((await get(practiceContext)).state.sessions[practice.id], practice);
    await practiceContext.close();
    checks.push('actual practice failures remain returning vocabulary before assignment, after pause and on reload without altering the practice record');
    assert.deepEqual(errors, []); assert.deepEqual(aiRequests, []);
    const result = { passed: true, checks, audits, errors, aiRequests };
    fs.writeFileSync(out + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
