// Local built Worker and synthetic accounts only. Never grades real user work.
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8787', out = 'outputs/monthly-carryover-repair';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const prior = new Date(date + 'T12:00:00Z'); prior.setUTCDate(prior.getUTCDate() - 1); const yesterday = prior.toISOString().slice(0, 10);
const ids = ['travel', 'want', 'breakfast'].map(name => words.find(w => w.word === name).id);
const checks = [], errors = [], aiRequests = [], audits = [];
const get = async c => { const r = await c.request.get(base + '/api/state'); assert.equal(r.status(), 200); return r.json(); };
const put = async (c, data) => { const r = await c.request.put(base + '/api/state', { data }); assert.equal(r.status(), 200, await r.text()); };
const saved = p => p.getByText('서버에 저장됨', { exact: true }).waitFor();
const plain = id => ({ entryId: id, meaning: content[id].meaning, familiarity: 'known', en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' });
const pass = id => ({ ...plain(id), en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'Existing sentence.', notes: 'Existing notes.', learnedOn: yesterday, material: content[id] });
const session = (kind, day) => ({ id: crypto.randomUUID(), kind, date: day, period: kind === 'monthly' ? yesterday.slice(0, 7) : day,
  ids, records: Object.fromEntries(ids.map(id => [id, plain(id)])), warmupIds: [], stage: kind === 'monthly' ? 'ko' : 'learn', index: 0,
  retry: [], retryMode: false, paused: true, finished: false, elapsed: 42, createdAt: day + 'T01:00:00Z' });
(async () => {
  const browser = await chromium.launch();
  try {
    async function fixture(suffix, draft = false) {
      const headers = { 'oai-authenticated-user-id': 'monthly_repair_' + Date.now() + suffix, 'oai-authenticated-user-email': 'qa@example.test' };
      const c = await browser.newContext({ extraHTTPHeaders: headers, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
      p.on('request', r => { if (/sentence-feedback|generativelanguage/.test(r.url())) aiRequests.push(r.url()); });
      const old = session('daily', yesterday), monthly = session('monthly', yesterday), current = session('daily', date);
      old.finished = true; old.stage = 'done'; old.createdAt = yesterday + 'T02:00:00Z'; old.records = Object.fromEntries(ids.map(id => [id, pass(id)]));
      if (draft) current.records[ids[0]].material = { ...content[ids[0]], expression: 'My edited expression', expressionTranslation: '내가 저장한 해석' };
      const snapshot = await get(c), progress = Object.fromEntries(words.filter(w => w.level === 'A1').map(w => [w.id, { familiarity: 'uncertain' }]));
      for (const id of ids) progress[id] = { familiarity: 'known', meaning: content[id].meaning, en: 'independent', ko: 'independent', sentenceStatus: 'written',
        sentence: 'Existing sentence.', notes: 'Existing notes.', lastStudied: yesterday, studyDates: [yesterday], needsReview: true };
      await put(c, { revision: snapshot.revision, progress, settings: { ...snapshot.state.settings, dailyGoal: 3, activeSessionId: monthly.id,
        assessments: { A1: { ids: [], index: 0, marks: {}, completed: true } } }, sessions: { [old.id]: old, [monthly.id]: monthly, [current.id]: current } });
      await p.goto(base); await saved(p); await p.getByRole('region', { name: '중복 배정 바로잡기', exact: true }).waitFor();
      return { c, p, headers, old, monthly, current };
    }
    const { c, p, headers, old, monthly, current } = await fixture('main');
    const original = await get(c);
    const legacy = await c.request.put(base + '/api/state', { data: { revision: original.revision, progress: {}, sessions: { [monthly.id]: monthly } } });
    assert.equal(legacy.status(), 426); assert.deepEqual(await get(c), original);
    checks.push('old monthly clients are rejected without writes so they cannot recreate the false carryover flags');
    await p.getByText('잘못된 복습 표시 3건 · 오늘 교체할 단어 3개', { exact: true }).waitFor();
    assert.deepEqual(await get(c), original);
    for (const width of [320, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    await p.setViewportSize({ width: 320, height: 900 }); await p.addStyleTag({ content: 'html{font-size:200%}' });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await p.reload(); await saved(p); await p.setViewportSize({ width: 390, height: 844 });
    async function audit(name) {
      await p.addScriptTag({ path: 'work/axe/package/axe.min.js' });
      const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      audits.push({ name, violations: r.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) });
      assert.equal(r.violations.length, 0, JSON.stringify(audits));
    }
    await audit('repair notice'); await p.screenshot({ path: out + '/before-mobile.png', fullPage: true });
    checks.push('repair preview is read-only, fits 320–1440px/200% text, and passes axe');
    const staleContext = await browser.newContext({ extraHTTPHeaders: headers });
    const stale = await staleContext.newPage(); await stale.goto(base); await saved(stale);
    await p.route('**/api/state', r => r.request().method() === 'PUT' ? r.fulfill({ status: 503, json: { error: '테스트 저장 실패' } }) : r.continue());
    await p.getByRole('button', { name: '오늘 배정 바로잡기', exact: true }).click(); await p.getByRole('alert').waitFor();
    assert.deepEqual(await get(c), original);
    await p.unroute('**/api/state'); await p.getByRole('button', { name: '다시 시도', exact: true }).click(); await saved(p);
    const repaired = await get(c), round = repaired.state.sessions[current.id];
    assert.equal(repaired.revision, original.revision + 1);
    assert.equal(Object.keys(repaired.state.sessions).length, 3); assert.equal(round.ids.length, 3);
    assert.ok(round.ids.every(id => !ids.includes(id)));
    assert.deepEqual(repaired.state.sessions[old.id], old); assert.deepEqual(repaired.state.sessions[monthly.id], monthly);
    for (const id of ids) {
      assert.equal(repaired.state.progress[id].needsReview, false);
      for (const field of ['en', 'ko', 'sentenceStatus', 'sentence', 'notes', 'lastStudied', 'studyDates', 'familiarity'])
        assert.deepEqual(repaired.state.progress[id][field], original.state.progress[id][field]);
    }
    assert.equal(await p.getByRole('button', { name: '오늘 배정 바로잡기', exact: true }).count(), 0);
    checks.push('failed repair saves nothing; retry atomically replaces only unstarted targets and clears false flags without changing old scores/monthly progress');
    await stale.getByRole('button', { name: '오늘 배정 바로잡기', exact: true }).click();
    await stale.getByRole('alert').filter({ hasText: '다른 기기' }).waitFor();
    assert.deepEqual(await get(c), repaired); await staleContext.close();
    checks.push('a stale second device cannot overwrite a successful repair');
    await p.reload(); await saved(p); assert.deepEqual(await get(c), repaired);
    const c2 = await browser.newContext({ extraHTTPHeaders: headers }), p2 = await c2.newPage(); await p2.goto(base); await saved(p2);
    assert.equal(await p2.getByRole('button', { name: '오늘 배정 바로잡기', exact: true }).count(), 0);
    assert.deepEqual(await p2.locator('.today-words b').allTextContents(), round.ids.map(id => words.find(w => w.id === id).word));
    await c2.close(); await audit('repaired today'); await p.screenshot({ path: out + '/after-mobile.png', fullPage: true });
    checks.push('reload and another browser restore the corrected targets without repeating the repair');
    await p.getByRole('region', { name: '이어서 할 점검', exact: true }).getByRole('button', { name: /월말 쓰기 이어서/ }).click(); await saved(p);
    await p.getByLabel('영어 단어 입력', { exact: true }).fill('saved monthly draft');
    await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(p);
    await p.getByRole('button', { name: '학습 홈으로', exact: false }).click();
    const paused = await get(c);
    assert.deepEqual(paused.state.progress, repaired.state.progress);
    assert.deepEqual(paused.state.sessions[current.id], round);
    assert.equal(paused.state.sessions[monthly.id].records[ids[0]].draft.answer, 'saved monthly draft');
    assert.equal(paused.state.sessions[monthly.id].records[ids[0]].ko, 'unmeasured');
    checks.push('pausing monthly review again preserves its draft and unmeasured status without reintroducing daily carryover');
    const partial = await fixture('partial', true);
    await partial.p.getByText('잘못된 복습 표시 2건 · 오늘 교체할 단어 2개', { exact: true }).waitFor();
    await partial.p.getByRole('button', { name: '오늘 배정 바로잡기', exact: true }).click(); await saved(partial.p);
    const partialState = (await get(partial.c)).state;
    assert.deepEqual(partialState.sessions[partial.current.id].records[ids[0]], partial.current.records[ids[0]]);
    assert.equal(partialState.sessions[partial.current.id].ids[0], ids[0]);
    assert.equal(partialState.sessions[partial.current.id].ids.filter(id => ids.includes(id)).length, 1);
    await partial.p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(partial.p);
    assert.equal(await partial.p.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), 'My edited expression');
    checks.push('an edited learning card survives partial correction and resumes with its saved expression');
    await partial.c.close();
    assert.deepEqual(errors, []); assert.deepEqual(aiRequests, []);
    const result = { passed: true, checks, audits, errors, aiRequests };
    fs.writeFileSync(out + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
