// Local built Worker only, synthetic account; no production data or AI requests.
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8787', out = 'outputs/today-status';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const selected = ['arrive', 'busy', 'breakfast'].map(name => words.find(w => w.word === name));
const ids = selected.map(w => w.id), date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const checks = [], errors = [], aiRequests = [], axeResults = [];
const saved = p => p.getByText('서버에 저장됨', { exact: true }).waitFor();
const get = async c => { const r = await c.request.get(base + '/api/state'); assert.equal(r.status(), 200); return r.json(); };
const rawRecord = (id, measured = false) => ({ meaning: content[id].meaning, material: content[id], learnedOn: date,
  en: measured ? 'independent' : 'unmeasured', ko: measured ? 'independent' : 'unmeasured',
  sentenceStatus: measured ? 'written' : 'unmeasured', sentence: measured ? 'My saved sentence.' : '', notes: '' });
const makeSession = kind => { const id = crypto.randomUUID(); return { id, kind, date, period: kind === 'monthly' ? date.slice(0, 7) : date,
  ids, warmupIds: [], stage: kind === 'monthly' ? 'ko' : 'learn', index: 0, retry: [], retryMode: false,
  elapsed: 200, paused: true, finished: false, createdAt: date + 'T01:00:00Z', records: Object.fromEntries(ids.map(id => [id, rawRecord(id)])) }; };
(async () => {
  const browser = await chromium.launch();
  try {
    const headers = { 'oai-authenticated-user-id': 'today_status_' + Date.now(), 'oai-authenticated-user-email': 'qa@example.test' };
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: headers });
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => { if (/sentence-feedback|generativelanguage/.test(r.url())) aiRequests.push(r.url()); });
    await p.goto(base); await saved(p);
    const initial = await get(c), daily = makeSession('daily'), monthly = makeSession('monthly');
    daily.records[ids[0]] = rawRecord(ids[0], true);
    daily.records[ids[2]] = { ...rawRecord(ids[2], true), ko: 'help', sentenceStatus: 'improve' };
    const progress = Object.fromEntries(ids.map(id => { const r = daily.records[id]; return [id, {
      meaning: r.meaning, en: r.en, ko: r.ko, sentenceStatus: r.sentenceStatus, needsReview: true,
      studyDates: [date], lastStudied: date, familiarity: 'known',
    }]; }));
    const seed = { revision: initial.revision, settings: { ...initial.state.settings, dailyGoal: 3, activeSessionId: monthly.id },
      progress, sessions: { [daily.id]: daily, [monthly.id]: monthly } };
    const put = async value => { const r = await c.request.put(base + '/api/state', { data: value }); assert.equal(r.status(), 200, await r.text()); };
    await put(seed); await p.reload(); await saved(p);
    const before = await get(c);
    const rows = p.locator('.today-words > div'), home = p.locator('.home-panel');
    assert.match(await rows.nth(0).innerText(), /오늘 학습 완료/);
    assert.match(await rows.nth(0).innerText(), /월말 점검 대기/);
    assert.equal(await rows.nth(0).locator('.status-warn').count(), 0);
    assert.match(await rows.nth(1).innerText(), /오늘 진행 중/);
    assert.match(await rows.nth(2).innerText(), /재학습 필요/);
    assert.match(await rows.nth(2).innerText(), /문장 보완 필요/);
    assert.equal(await rows.getByText('이월', { exact: true }).count(), 0);
    await home.getByText(/이번 회차 3개 중 2개의 회상·문장 결과/).waitFor();
    await p.getByRole('region', { name: '이어서 할 점검', exact: true }).getByText('전체 3개 · 미점검 3개', { exact: true }).waitFor();
    assert.deepEqual(await get(c), before);
    checks.push('today progress, completed records, real difficulties and monthly waiting are distinct; read-only rendering preserves all saved data');
    for (const width of [320, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    await p.setViewportSize({ width: 320, height: 900 });
    await p.addStyleTag({ content: 'html{font-size:200%}' });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await p.reload(); await saved(p); await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({ path: out + '/in-progress-mobile.png', fullPage: true });
    async function audit(name) {
      await p.addScriptTag({ path: 'work/axe/package/axe.min.js' });
      const result = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      axeResults.push({ name, violations: result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) });
      assert.equal(result.violations.length, 0, JSON.stringify(axeResults.at(-1)));
    }
    await audit('today progress and monthly pending');
    checks.push('status rows fit 320–1440px and 200% text without horizontal overflow; progress screen passes axe');
    daily.finished = true; daily.stage = 'done'; daily.index = 0;
    daily.records[ids[1]] = rawRecord(ids[1], true);
    const updated = await get(c);
    await put({ revision: updated.revision, settings: { ...updated.state.settings, newWordsPaused: true }, progress: {}, sessions: { [daily.id]: daily } });
    await p.reload(); await saved(p);
    await p.getByRole('heading', { name: '오늘의 작은 성취를 쌓았어요.', exact: true }).waitFor();
    assert.equal(await rows.getByText('오늘 학습 완료', { exact: true }).count(), 3);
    assert.equal(await rows.getByText('월말 점검 대기', { exact: true }).count(), 3);
    await home.getByText(/신규 단어 쉬기 설정도 켜져 있어/).waitFor();
    await p.getByRole('button', { name: '오늘 단어 다시 보기', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'arrive', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await audit('today complete with pending monthly review');
    await p.screenshot({ path: out + '/completed-mobile.png', fullPage: true });
    checks.push('finishing today preserves a separate monthly wait, explains both pause reasons and retains completed lesson review');
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: headers });
    const p2 = await c2.newPage(); await p2.goto(base); await saved(p2);
    assert.equal(await p2.locator('.today-word-status').getByText('오늘 학습 완료', { exact: true }).count(), 3);
    assert.equal(await p2.locator('.today-word-status').getByText('월말 점검 대기', { exact: true }).count(), 3);
    await c2.close();
    checks.push('a separate browser restores the same daily-complete and monthly-waiting statuses');
    const completedBefore = (await get(c)).state.sessions[daily.id];
    monthly.finished = true; monthly.stage = 'done'; monthly.records = Object.fromEntries(ids.map(id => [id, { ...rawRecord(id), ko: 'independent' }]));
    const after = await get(c);
    await put({ revision: after.revision, progress: {}, sessions: { [monthly.id]: monthly } });
    await p.reload(); await saved(p);
    assert.equal(await rows.getByText('월말 점검 대기', { exact: true }).count(), 0);
    assert.equal(await p.getByRole('region', { name: '이어서 할 점검', exact: true }).count(), 0);
    await home.getByText(/설정에서 신규 단어 쉬기를 켜 두었어요/).waitFor();
    assert.deepEqual((await get(c)).state.sessions[daily.id], completedBefore);
    checks.push('finishing monthly review removes its waiting labels without rewriting daily completion; manual pause remains explicit');
    assert.deepEqual(errors, []); assert.deepEqual(aiRequests, []);
    const result = { passed: true, checks, axe: axeResults, errors, aiRequests };
    fs.writeFileSync(out + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
