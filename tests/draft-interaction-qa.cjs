// Built local Worker, synthetic accounts only; never calls Google.
const { launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const fs = require('node:fs'), assert = require('node:assert/strict');
const base = require('./qa/runtime.cjs').base, out = 'outputs/draft-refactor';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const selected = ['apple', 'book'].map(name => words.find(w => w.word === name && w.pos === 'n.'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const checks = [], errors = [], requests = []; let serial = 0, activePage;
const saved = p => p.getByText('서버에 저장됨', { exact: true }).waitFor();
const get = async c => (await c.request.get(base + '/api/state')).json();
(async () => {
  const browser = await launchBrowser();
  async function fresh(stage, retry = false) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'oai-authenticated-user-id': require('./qa/runtime.cjs').account('draft_') + '_' + serial++, 'oai-authenticated-user-email': 'qa@example.test' } });
    const initial = await get(c), id = crypto.randomUUID(), first = selected[0].id;
    const s = { id, kind: 'daily', date, period: date, ids: selected.map(w => w.id), warmupIds: stage === 'warmup' ? [first] : [], stage, index: 0,
      records: Object.fromEntries(selected.map(w => [w.id, { meaning: content[w.id].meaning, material: content[w.id], en: retry ? 'help' : 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' }])),
      retry: retry ? [{ id: first, direction: stage }] : [], retryMode: retry, elapsed: 12, finished: false, paused: false, createdAt: new Date().toISOString() };
    assert.equal((await c.request.put(base + '/api/state', { data: { revision: initial.revision, settings: { ...initial.state.settings, activeSessionId: id }, progress: {}, sessions: { [id]: s } } })).status(), 200);
    const p = await c.newPage(); activePage = p;
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if (/\/api\/(state|study-clock)$/.test(new URL(r.url()).pathname)) requests.push({ method: r.request().method(), path: new URL(r.url()).pathname, status: r.status() }); });
    await p.goto(base); await saved(p); await p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(p);
    const field = p.getByRole('textbox', { name: stage === 'warmup' ? '떠오르는 한국어 뜻' : stage === 'en' ? '한국어 뜻 입력' : '영어 단어 입력', exact: true });
    const reveal = p.getByRole('button', { name: stage === 'warmup' ? /^뜻 확인/ : /^내 답 확인/ });
    const grade = p.getByRole('button', { name: stage === 'warmup' ? '스스로 떠올렸어요' : '도움 없이 맞혔어요', exact: true });
    return { c, p, s, first, field, reveal, grade };
  }
  try {
    for (const [stage, retry] of [['warmup', false], ['en', false], ['ko', false], ['ko', true]]) {
      const { c, p, s, first, field, reveal, grade } = await fresh(stage, retry);
      const answer = stage === 'ko' ? 'apple' : '내가 쓴 뜻';
      await field.fill(answer);
      let held;
      await p.route('**/api/state', route => { if (route.request().method() === 'PUT') held = route; else return route.continue(); });
      await reveal.click(); await p.getByText('저장 중', { exact: true }).waitFor();
      assert.equal(await grade.isDisabled(), true); assert.equal(await field.inputValue(), answer);
      assert.equal(await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).isDisabled(), true);
      assert.deepEqual((await get(c)).state.sessions[s.id].records, s.records);
      assert.ok(held);
      if (stage === 'en') {
        await held.fulfill({ status: 503, json: { error: '검사 저장 실패' } });
        await p.getByRole('alert').filter({ hasText: '검사 저장 실패' }).waitFor();
        assert.equal(await grade.isDisabled(), true); assert.equal(await field.inputValue(), answer);
        await p.unroute('**/api/state'); await p.getByRole('button', { name: '다시 시도', exact: true }).click();
      } else {
        await held.fulfill({ response: await held.fetch() }); await p.unroute('**/api/state');
      }
      await saved(p); await grade.click({ trial: true });
      const stored = (await get(c)).state.sessions[s.id];
      const snapshot = stage === 'warmup' ? stored.warmupDraft : stored.records[first].draft;
      assert.equal(snapshot.answer, answer); assert.equal(snapshot.hinted, false); assert.equal(snapshot.revealed, true);
      assert.equal(stored.records[first].en, s.records[first].en); assert.equal(stored.records[first].ko, s.records[first].ko);
      await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(p);
      await p.reload(); await saved(p); await p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(p);
      assert.equal(await field.inputValue(), answer); await grade.click({ trial: true });
      assert.notEqual(await field.getAttribute('readonly'), null);
      checks.push(`${stage}${retry ? ' retry' : ''}: pending/failed save blocks grading; acknowledged save unlocks, preserves ungraded draft and resumes revealed answer`);
      await c.close();
    }
    const hinted = await fresh('en'); await hinted.reveal.click(); await saved(hinted.p);
    assert.equal(await hinted.grade.isDisabled(), true);
    await hinted.p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(hinted.p);
    await hinted.p.reload(); await saved(hinted.p); await hinted.p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(hinted.p);
    assert.equal(await hinted.grade.isDisabled(), true);
    assert.equal((await get(hinted.c)).state.sessions[hinted.s.id].records[hinted.first].draft.hinted, true);
    checks.push('empty-answer reveal stays hinted after reload and never enables independent success');
    await hinted.c.close();
    const clock = await fresh('en'); await clock.field.fill('사과'); await clock.reveal.click(); await saved(clock.p); await clock.grade.click({ trial: true });
    let heldClock;
    await clock.p.route('**/api/study-clock', r => { heldClock = r; });
    const clockRequest = clock.p.waitForRequest('**/api/study-clock');
    await clock.p.evaluate(() => window.dispatchEvent(new Event('focus'))); await clockRequest;
    assert.equal(await clock.grade.isDisabled(), true); assert.equal(await clock.field.inputValue(), '사과');
    await heldClock.fulfill({ response: await heldClock.fetch() }); await clock.p.unroute('**/api/study-clock');
    await clock.grade.click({ trial: true }); assert.equal(await clock.field.inputValue(), '사과');
    checks.push('clock resynchronization independently blocks grading, then unlocks without resetting the answer');
    await clock.c.close();
    assert.deepEqual(errors, []);
    const result = { passed: true, checks, pageErrors: errors, requests, realGoogleCalls: 0 };
    fs.writeFileSync(out + '/interaction-verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } catch (error) {
    const diagnostic = { checks, errors, requests, error: String(error) };
    if (activePage && !activePage.isClosed()) {
      diagnostic.status = await activePage.locator('.save-state').allTextContents();
      diagnostic.alerts = await activePage.getByRole('alert').allTextContents();
      diagnostic.stage = await activePage.locator('.session-step-row').allTextContents();
      diagnostic.answer = await activePage.locator('#recall-answer').inputValue().catch(() => null);
      await activePage.screenshot({ path: out + '/interaction-failure.png' });
    }
    fs.writeFileSync(out + '/interaction-failure.json', JSON.stringify(diagnostic, null, 2)); throw error;
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
