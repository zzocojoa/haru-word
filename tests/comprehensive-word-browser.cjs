// UI-1/UI-2 built-Worker regressions using synthetic local D1 only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const source = path.resolve(__dirname, '..');
process.chdir(source);
const req = createRequire(path.join(source, 'package.json'));
const { build } = req('esbuild');
const { base, accountHeaders, launchBrowser, closeBrowser } = req('./tests/qa/runtime.cjs');
const { emptyState } = req('./tests/fixtures/backup-history.cjs');
const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const mode = process.argv[2];
assert.ok(['recall-help', 'draft-capacity'].includes(mode));
const out = path.join(source, 'outputs/comprehensive-remediation-browser/word', mode, process.env.QA_BROWSER||'chromium');
fs.mkdirSync(out, { recursive: true });
(async () => {
  await build({ entryPoints: ['lib/study-draft.ts'], outfile: path.join(out, 'study-draft.cjs'), bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { studyQuestionKey, restoreStudyDraft } = require(path.join(out, 'study-draft.cjs'));
  const identity = accountHeaders('targeted_word');
  const browser = await launchBrowser();
  const context = await browser.newContext({ extraHTTPHeaders: identity, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], aiPosts = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', route => {
    const r = route.request(), url = new URL(r.url());
    if (url.origin !== base) return route.abort();
    if (r.method() === 'POST' && /feedback|ai-eval|automation/.test(url.pathname)) { aiPosts.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  const get = async () => { const r = await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '4' } }); assert.equal(r.status(), 200); return r.json(); };
  try {
    const initial = await get();
    const clock = await (await context.request.get(base + '/api/study-clock')).json();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(clock.serverTime));
    const state = { ...emptyState(), grammar: {} }, assessmentIds = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
    state.settings.assessments.A1 = { ids: assessmentIds, index: 20, marks: Object.fromEntries(assessmentIds.map(id => [id, 'uncertain'])), completed: true };
    const ids = words.filter(w => w.level === 'A1').slice(0, mode === 'draft-capacity' ? 21 : 1).map(w => w.id), sid = randomUUID();
    const session = { id: sid, kind: 'practice', date, period: date, ids, warmupIds: [], stage: mode === 'draft-capacity' ? 'sentence' : 'en', index: 0,
      records: Object.fromEntries(ids.map(id => [id, { entryId: id, meaning: content[id].meaning, material: content[id], en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' }])),
      retry: [], retryMode: false, elapsed: 0, paused: true, finished: false, createdAt: new Date(clock.serverTime).toISOString(),
      ...(mode === 'draft-capacity' ? { practiceMode: 'sentence' } : {}) };
    state.sessions[sid] = session; state.settings.activeSessionId = sid;
    if (mode === 'recall-help') {
      session.records[ids[0]].draft = { answer: '', hinted: true, revealed: true, stage: 'en', retry: false };
      session.records[ids[0]].hintEn = true;
    }
    const restored = await context.request.post(base + '/api/state/restore', { headers: { 'X-Study-Grammar': '4', 'X-Study-Revision': String(initial.revision) },
      data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(restored.status(), 200, await restored.text());
    if (mode === 'recall-help') {
      const serverDraft = restoreStudyDraft(session, ids[0], content[ids[0]]), before = { ...serverDraft, hint: false, revealed: false, answer: '' };
      const rowId = randomUUID(), question = studyQuestionKey(session, ids[0]);
      await page.addInitScript(({ owner, instanceId, question, baseValues }) => {
        const row = { version: 1, kind: 'word', question, instanceId, epoch: 'initial', updatedAt: Date.now(), base: baseValues,
          values: { ...baseValues, answer: 'Earlier draft before help.' } };
        localStorage.setItem('haru-words:local-input-owner:v1', owner);
        localStorage.setItem('haru-words:local-input:v1:' + encodeURIComponent(owner) + ':' + instanceId + ':' + encodeURIComponent(question), JSON.stringify(row));
      }, { owner: identity['oai-authenticated-user-id'], instanceId: rowId, question, baseValues: before });
    }
    await page.goto(base); await page.getByText('저장됨', { exact: true }).first().waitFor();
    // The journal supports every saved session kind; the home resume action is
    // intentionally restricted to today's daily session.
    await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    await page.locator('.journal-day-trigger').first().click();
    await page.locator('.journal-session-trigger').first().click();
    await page.getByRole('button', { name: '이어서 학습', exact: false }).click();
    await page.locator('.session-panel').waitFor();
    await page.locator('.save-state').getByText('저장됨', { exact: true }).waitFor();
    if (mode === 'recall-help') {
      await page.getByRole('button', { name: '도움 없이 맞혔어요', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '도움 없이 맞혔어요', exact: true }).isDisabled(), true);
      await page.locator('summary').filter({ hasText: '이 기기에 남은 다른 입력 확인' }).click();
      await page.getByRole('button', { name: '현재 입력과 비교', exact: true }).first().click();
      await page.getByRole('button', { name: '비교한 입력으로 이어쓰기', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: '한국어 뜻 입력', exact: true }).inputValue(), '');
      assert.equal(await page.getByRole('button', { name: '도움 없이 맞혔어요', exact: true }).isDisabled(), true);
      const undo=page.getByRole('button',{name:'복구한 입력 되돌리기',exact:true});if(await undo.count()){await undo.click();assert.equal(await page.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).isDisabled(),true);}
      await page.getByRole('button', { name: '도움이 필요했어요', exact: true }).click();
      let after;
      for (let i = 0; i < 100; i++) { after = await get(); if (after.state.sessions[sid].records[ids[0]].en === 'help') break; await page.waitForTimeout(100); }
      const record = after.state.sessions[sid].records[ids[0]];
      assert.equal(record.en, 'help'); assert.equal(record.hintEn, true); assert.equal(record.enAnswer,'');
      fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed:true, mode, boundary: 'built app + real synthetic D1 saves', initialHint: true,
        initialRevealed: true, initiallyIndependentDisabled: true, recoveredIndependentEnabled: false, savedResult: record.en, savedHint: record.hintEn, errors, aiPosts }, null, 2));
    } else {
      let capacityWarning = false;
      for (let i = 0; i < ids.length; i++) {
        const sentence = 'Synthetic saved sentence ' + (i + 1) + '.';
        const input = page.getByRole('textbox', { name: '내 영어 문장', exact: true });
        await input.fill(sentence);
        await page.waitForFunction(value => Object.keys(localStorage).some(key => key.startsWith('haru-words:local-input:v1:') && localStorage.getItem(key).includes(value)), sentence);
        await page.getByRole('button', { name: '문장을 완성했어요', exact: false }).click();
        for (let j = 0; j < 100; j++) { const current = await get(); if (current.state.sessions[sid].records[ids[i]].sentence === sentence) break; await page.waitForTimeout(100); }
      }
      const after = await get();
      const rows = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('haru-words:local-input:v1:')).map(key => JSON.parse(localStorage.getItem(key))));
      const wordRows = rows.filter(row => row.kind === 'word');
      assert.equal(Object.values(after.state.sessions[sid].records).filter(r => r.sentenceStatus === 'written').length, 21);
      assert.equal(after.state.sessions[sid].finished, true);
      assert.equal(wordRows.length, 0); assert.equal(capacityWarning, false);
      assert.ok(wordRows.every(row => Object.values(after.state.sessions[sid].records).some(record => record.sentence === row.values.sentence)));
      fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed:true, mode, boundary: 'built app + real synthetic D1 saves', savedCompletedSentences: 21,
        remainingCompletedQuestionRows: wordRows.length, capacityWarning, allRowsMatchSavedCompletedSentences: true, errors, aiPosts }, null, 2));
    }
    assert.deepEqual(errors, []); assert.deepEqual(aiPosts, []);
    await page.screenshot({ path: path.join(out, 'observed.png'), fullPage: true }); console.log(fs.readFileSync(path.join(out, 'result.json'), 'utf8'));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'probe-failure.json'), JSON.stringify({ error: error.message, stack: error.stack, errors, text: await page.locator('body').innerText({ timeout: 1000 }).catch(() => '') }, null, 2));
    throw error;
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
