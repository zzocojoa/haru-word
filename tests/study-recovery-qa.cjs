// Real revision conflicts and real restore, synthetic local accounts only.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, accountHeaders, waitForWorker, base } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium';
const out = `outputs/study-recovery/${engine}`;
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const selected = ['apple', 'book'].map(name => words.find(w => w.word === name && w.pos === 'n.'));
const headers = { 'X-Study-Grammar': '2', 'X-Study-Feedback-Structure': '1', 'X-Study-Review-Resume': '1', 'X-Study-Monthly-Carryover': '1' };
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const get = async c => (await c.request.get(base + '/api/state', { headers })).json();
const saved = p => p.getByText('저장됨', { exact: true }).waitFor();
async function seed(c, stage) {
  const initial = await get(c), id = crypto.randomUUID();
  const s = { id, kind: 'daily', date, period: date, ids: selected.map(w => w.id), warmupIds: [], stage, index: 0,
    records: Object.fromEntries(selected.map(w => [w.id, { entryId: w.id, meaning: content[w.id].meaning, material: content[w.id], en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: '', notes: '', enAnswer: '최초 답', hintKo: true }])),
    retry: [], retryMode: false, elapsed: 12, finished: false, paused: false, createdAt: new Date().toISOString() };
  const response = await c.request.put(base + '/api/state', { headers, data: { revision: initial.revision, settings: { ...initial.state.settings, dailyGoal: 2, activeSessionId: id }, progress: {}, sessions: { [id]: s } } });
  assert.equal(response.status(), 200, await response.text()); return s;
}
async function backup(p, file) {
  const event = p.waitForEvent('download');
  await p.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
  await (await event).saveAs(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
(async () => {
  await waitForWorker();
  const browser = await launchBrowser({ engine }), checks = [], errors = [];
  try {
    for (const stage of ['sentence', 'learn']) {
      const c = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('study_recovery') });
      const s = await seed(c, stage), p = await c.newPage();
      p.on('pageerror', error => errors.push(error.message));
      await p.goto(base); await saved(p);
      await p.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(p);
      const selector = stage === 'sentence' ? '#my-sentence' : '#study-meaning';
      const field = p.locator(selector);
      await field.fill(stage === 'sentence' ? 'I eat an apple.' : '처음 작성한 뜻');
      let held;
      await p.route('**/api/state', route => { if (route.request().method() === 'PUT') held = route; else return route.continue(); });
      await p.getByRole('button', { name: stage === 'sentence' ? '문장을 완성했어요' : /^뜻 저장하고 계속/ }).click();
      await p.getByText('저장 중', { exact: true }).waitFor(); assert.ok(held);
      const submitted = held.request().postDataJSON();
      assert.equal(await field.isEditable(), true);
      await field.fill(stage === 'sentence' ? 'I read a book at home.' : '저장 중 쓴 뜻');
      const concurrent = await get(c);
      const otherSave = await c.request.put(base + '/api/state', { headers, data: { revision: concurrent.revision, settings: { ...concurrent.state.settings, dailyGoal: 3 }, progress: {}, sessions: {} } });
      assert.equal(otherSave.status(), 200);
      const rejected = await held.fetch(); assert.equal(rejected.status(), 409);
      await held.fulfill({ response: rejected }); await p.unroute('**/api/state');
      await p.getByRole('button', { name: '현재 입력 백업', exact: true }).waitFor();
      // Include edits after the failure, not just the draft from request start.
      const value = stage === 'sentence' ? 'I read a book every morning.' : '실패 후에도 보관할 뜻';
      await field.fill(value);
      if (stage === 'sentence') await p.locator('#sentence-note').fill('나중에 확인할 메모');
      const beforeExport = await get(c);
      const archived = await backup(p, `${out}/${stage}.json`);
      assert.deepEqual(await get(c), beforeExport, 'export must not write to the server');
      const expectedSession = structuredClone(submitted.sessions[s.id]), id = selected[1].id;
      const expectedRecord = expectedSession.records[id];
      if (stage === 'sentence') Object.assign(expectedRecord, { sentence: value, notes: '나중에 확인할 메모', spoken: false });
      else expectedRecord.material = { ...expectedRecord.material, meaning: value, expressionTranslation: '' };
      assert.deepEqual(archived.sessions[s.id], expectedSession, 'all scores, dates, cursor and other cards must stay unchanged');
      await p.screenshot({ path: `${out}/${stage}-recovery.png` });
      // Explicitly cleared input must not fall back to an old value in a second copy.
      await field.fill('');
      const cleared = await backup(p, `${out}/${stage}-cleared.json`);
      assert.equal(stage === 'sentence' ? cleared.sessions[s.id].records[id].sentence : cleared.sessions[s.id].records[id].material.meaning, '');
      await p.getByRole('button', { name: '최신 기록 불러오기', exact: true }).click();
      await p.getByRole('alertdialog').getByRole('button', { name: '최신 기록 불러오기', exact: true }).click(); await saved(p);
      await c.close();

      // Import the exact downloaded bytes through the production parser/storage,
      // then resume in a new browser context and reload once more.
      for (const suffix of ['', '-cleared']) {
        const recovered = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('study_restored') });
        const initial = await get(recovered), raw = fs.readFileSync(`${out}/${stage}${suffix}.json`, 'utf8');
        const restore = await recovered.request.post(base + '/api/state/restore', { headers: { ...headers, 'Content-Type': 'application/json', 'X-Study-Revision': String(initial.revision) }, data: raw });
        assert.equal(restore.status(), 200, await restore.text());
        assert.deepEqual((await get(recovered)).state.sessions[s.id], JSON.parse(raw).sessions[s.id]);
        const page = await recovered.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto(base); await saved(page);
        await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(page);
        assert.equal(await page.locator(selector).inputValue(), suffix ? '' : value);
        if (stage === 'sentence') assert.equal(await page.locator('#sentence-note').inputValue(), '나중에 확인할 메모');
        await page.reload(); await saved(page);
        await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved(page);
        assert.equal(await page.locator(selector).inputValue(), suffix ? '' : value);
        await recovered.close();
      }
      checks.push(`${stage}: real 409, latest/empty draft exports, real restore, resume and reload, grades/cursor preserved`);
    }
    assert.deepEqual(errors, []);
    const result = { passed: true, engine, checks, errors };
    fs.writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
