// Built LOCAL Worker only. Synthetic history; no production data or AI calls.
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:8787', out = 'outputs/journal-navigation';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const items = words.filter(w => w.level === 'A1' && content[w.id]).slice(0, 10);
const ids = items.map(w => w.id), checks = [], errors = [], accessibility = [];
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const state = { settings: { level: 'A1', dailyGoal: 10, assessments: {}, activeSessionId: null }, progress: {}, sessions: {} };
for (let day = 0; day < 23; day++) {
  const dayDate = new Date(Date.parse(date + 'T12:00:00Z') - day * 86400000).toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const records = Object.fromEntries(ids.map((wordId, i) => [wordId, {
    entryId: wordId, meaning: content[wordId].meaning, material: content[wordId], familiarity: 'uncertain',
    en: i === 2 ? 'unmeasured' : 'independent', ko: i === 1 ? 'help' : i === 2 || i === 3 ? 'unmeasured' : 'independent',
    sentenceStatus: i === 1 ? 'improve' : i === 2 || i === 3 ? 'unmeasured' : 'written',
    sentence: i === 2 || i === 3 ? '' : content[wordId].example, notes: i === 2 ? '' : '보존할 보완점 ' + i,
    learnedOn: dayDate, spoken: i === 0, ...(i === 1 ? { retryKo: 'independent' } : {}),
  }]));
  records[ids[0]].aiFeedback = { original: records[ids[0]].sentence, correctedSentence: records[ids[0]].sentence, meaningUsage: 'appropriate', grammar: 'natural', explanation: '저장한 교정 설명', model: 'gemini-3.1-flash-lite', createdAt: dayDate + 'T01:00:00.000Z' };
  state.sessions[id] = { id, kind: day === 1 ? 'weekly' : 'daily', date: dayDate, period: dayDate,
    ids, records, warmupIds: ids.slice(0, 2), warmupResults: { [ids[0]]: 'independent', [ids[1]]: 'help' }, stage: day === 1 ? 'en' : 'done', index: 0,
    retry: [], retryMode: false, elapsed: 900, finished: day !== 1, paused: true, createdAt: dayDate + 'T01:00:00.000Z' };
}

(async () => {
  const browser = await chromium.launch();
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: {
      'oai-authenticated-user-id': 'journal_' + Date.now(), 'oai-authenticated-user-email': 'journal@example.test',
    } });
    const get = async () => (await c.request.get(base + '/api/state')).json();
    const initial = await get();
    const response = await c.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(initial.revision), 'content-type': 'application/json' }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(response.status(), 200, await response.text());
    const before = await get();
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    let writes = 0;
    p.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'GET') writes++; });
    await p.goto(base); await p.getByText('서버에 저장됨', { exact: true }).waitFor();
    await p.getByRole('tab', { name: '학습 기록', exact: true }).click();
    const panel = p.getByRole('tabpanel', { name: '학습 기록', exact: true });
    const sessions = panel.locator('.journal-session'), triggers = panel.locator('.journal-session-trigger');
    const height = await panel.locator('.journal-list').evaluate(el => el.getBoundingClientRect().height);
    if (process.env.JOURNAL_BASELINE) {
      fs.writeFileSync(out + '/before.json', JSON.stringify({ height, sessions: await sessions.count() }, null, 2));
      await p.screenshot({ path: out + '/before-mobile.png' });
      console.log(JSON.stringify({ baselineHeight: height })); return;
    }
    assert.equal(await sessions.count(), 10);
    assert.equal(await panel.locator('.journal-session-trigger[aria-expanded=true]').count(), 0);
    assert.equal(await panel.locator('.record-card').count(), 0);
    assert.match(await triggers.first().innerText(), /10개 · 완료 7개 · 회차 종료/);
    const old = fs.existsSync(out + '/before.json') ? JSON.parse(fs.readFileSync(out + '/before.json', 'utf8')) : null;
    assert.ok(height < 1800, 'ten collapsed session summaries must stay compact');
    if (old) assert.ok(height < old.height * .25, 'collapsed journal must be at least 75% shorter');
    await p.screenshot({ path: out + '/collapsed-mobile.png', fullPage: true });
    checks.push('ten collapsed session summaries show actual completion counts and stay compact');

    const axe = async label => {
      await p.addScriptTag({ path: 'work/axe/package/axe.min.js' });
      const violations = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      accessibility.push({ label, violations }); assert.deepEqual(violations, [], label);
    };
    await axe('collapsed mobile journal');
    await triggers.first().focus(); await p.keyboard.press('Enter');
    assert.equal(await triggers.first().getAttribute('aria-expanded'), 'true');
    const first = sessions.first(), rows = first.locator('.journal-word-trigger');
    assert.equal(await rows.count(), 11); // ten targets plus warmup
    assert.equal(await first.locator('.record-card:visible').count(), 0);
    for (const label of ['완료', '보완 필요', '미측정', '진행 중']) assert.ok((await first.locator('.journal-mobile').innerText()).includes(label));
    const targetRows = first.locator('.journal-word .journal-word-trigger');
    await targetRows.nth(0).click();
    let detail = first.locator('.record-card:visible');
    for (const text of ['처음 표시', '영어→뜻', '뜻→영어', '내 문장', '말하기', '보완점', '다음 할 일', '보존할 보완점 0']) assert.ok((await detail.innerText()).includes(text));
    await detail.getByText('저장한 AI 교정 의견', { exact: true }).click();
    assert.ok((await detail.innerText()).includes('저장한 교정 설명'));
    await targetRows.nth(1).click();
    assert.equal(await first.locator('.record-card:visible').count(), 1);
    assert.match(await first.locator('.record-card:visible').innerText(), /재시도 독립 성공/);
    assert.equal(await targetRows.nth(0).getAttribute('aria-expanded'), 'false');
    await axe('expanded mobile record');
    await first.screenshot({ path: out + '/expanded-mobile.png' });
    await rows.first().click();
    assert.match(await first.locator('.record-card:visible').innerText(), /기억 깨우기 기록/);
    checks.push('keyboard disclosure, one-word expansion, all outcomes, notes, saved AI feedback and warmup remain reachable');

    await p.getByRole('tab', { name: '전체 단어장', exact: true }).click();
    await p.getByRole('tab', { name: '학습 기록', exact: true }).click();
    assert.equal(await triggers.first().getAttribute('aria-expanded'), 'true');
    await triggers.nth(1).click();
    assert.equal(await triggers.first().getAttribute('aria-expanded'), 'false');
    assert.ok(await sessions.nth(1).getByRole('button', { name: '이어서 학습', exact: false }).isEnabled());
    await triggers.nth(1).click();
    assert.equal(await triggers.nth(1).getAttribute('aria-expanded'), 'false');
    checks.push('switching tabs preserves the open session; opening another session closes the previous one and exposes resume');

    await panel.getByRole('button', { name: '이전 기록 더 보기' }).click(); assert.equal(await sessions.count(), 20);
    await panel.getByRole('button', { name: '이전 기록 더 보기' }).click(); assert.equal(await sessions.count(), 23);
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '주간 점검', exact: true }).click();
    assert.equal(await sessions.count(), 1); assert.equal(await triggers.first().getAttribute('aria-expanded'), 'false');
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '월말 쓰기', exact: true }).click();
    assert.ok(await panel.getByRole('heading', { name: '이 종류의 학습 기록이 아직 없어요.' }).isVisible());
    assert.equal(await sessions.count(), 0);
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '모든 학습 기록', exact: true }).click();
    assert.equal(await sessions.count(), 10);
    checks.push('all 23 sessions remain reachable and filtering resets expansion and the ten-session display limit');

    const downloadText = async name => {
      const pending = p.waitForEvent('download'); await panel.getByRole('button', { name, exact: true }).click();
      const d = await pending; return fs.readFileSync(await d.path(), 'utf8');
    };
    const backup = JSON.parse(await downloadText('전체 백업'));
    assert.deepEqual(backup.state, before.state);
    const csv = await downloadText('CSV 받기');
    assert.ok(csv.includes(Object.values(state.sessions).at(-1).date));
    assert.ok(csv.includes('보존할 보완점 0'));
    assert.deepEqual(await get(), before); assert.equal(writes, 0);
    checks.push('collapsed and unloaded records are included in exports; browsing does not write or alter the server state');

    await triggers.first().click();
    for (const width of [320, 390, 820, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'viewport ' + width);
      if (width === 320) {
        await targetRows.first().click();
        await p.addStyleTag({ content: 'html {font-size:200% !important}' });
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '200% text');
        await p.addStyleTag({ content: 'html {font-size:100% !important}' });
      }
    }
    assert.ok(await first.locator('.journal-desktop').isVisible());
    assert.equal(await first.locator('.log-table tbody tr').count(), 10);
    await axe('expanded desktop journal');
    await p.screenshot({ path: out + '/expanded-desktop.png', fullPage: true });
    checks.push('320–1440 px, 200% text, reduced motion and desktop comparison table remain usable');
    assert.deepEqual(errors, []);
    const result = { passed: true, checks, accessibility, listHeight: { before: old?.height, after: height, reductionPercent: old ? Math.round((1 - height / old.height) * 100) : undefined }, browserErrors: errors };
    fs.writeFileSync(out + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
