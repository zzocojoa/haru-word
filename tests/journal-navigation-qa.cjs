// Built LOCAL Worker only. Synthetic history; no production data or AI calls.
const { launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = require('./qa/runtime.cjs').base, out = 'outputs/journal-navigation';
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
// Four separate attempts on the latest date must share one date heading.
const original = Object.values(state.sessions)[0];
for (let attempt = 1; attempt <= 3; attempt++) {
  const id = crypto.randomUUID();
  const targetIds = attempt === 1 ? ids.slice(0, 3) : attempt === 3 ? ids.slice(0, 2) : ids;
  state.sessions[id] = { ...original, id, ids: targetIds,
    records: Object.fromEntries(targetIds.map(id => [id, original.records[id]])),
    kind: attempt === 1 ? 'daily' : 'practice', ...(attempt > 1 ? { practiceMode: attempt === 2 ? 'repeat' : 'ko' } : {}),
    createdAt: date + `T0${attempt + 1}:00:00.000Z`, warmupIds: [], warmupResults: {},
    stage: attempt === 3 ? 'ko' : 'done', finished: attempt !== 3,
  };
}

(async () => {
  const browser = await launchBrowser();
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: {
      'oai-authenticated-user-id': require('./qa/runtime.cjs').account('journal_'), 'oai-authenticated-user-email': 'journal@example.test',
    } });
    const get = async () => (await c.request.get(base + '/api/state')).json();
    const initial = await get();
    const response = await c.request.post(base + '/api/state/restore', { headers: { 'x-study-revision': String(initial.revision), 'content-type': 'application/json' }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
    assert.equal(response.status(), 200, await response.text());
    const before = await get();
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    let writes = 0;
    p.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'GET') writes++; });
    await p.goto(base); await p.getByText('저장됨', { exact: true }).waitFor();
    await p.getByRole('tab', { name: '학습 기록', exact: true }).click();
    const panel = p.getByRole('tabpanel', { name: '학습 기록', exact: true });
    const days = panel.locator('.journal-day'), dayTriggers = panel.locator('.journal-day-trigger');
    const sessions = days.first().locator('.journal-session'), triggers = days.first().locator('.journal-session-trigger');
    const height = await panel.locator('.journal-list').evaluate(el => el.getBoundingClientRect().height);
    if (process.env.JOURNAL_BASELINE) {
      fs.writeFileSync(out + '/before.json', JSON.stringify({ height, dates: await days.count() }, null, 2));
      await p.screenshot({ path: out + '/before-mobile.png' });
      console.log(JSON.stringify({ baselineHeight: height })); return;
    }
    assert.equal(await days.count(), 10);
    assert.equal(await dayTriggers.locator('time[datetime="' + date + '"]').count(), 1);
    assert.equal(await panel.locator('.journal-day-trigger[aria-expanded=true]').count(), 0);
    assert.equal(await panel.locator('.journal-session').count(), 0);
    assert.equal(await panel.locator('.record-card').count(), 0);
    assert.match(await dayTriggers.first().innerText(), /4회차/);
    assert.match(await dayTriggers.first().innerText(), /일일 학습 2/);
    assert.match(await dayTriggers.first().innerText(), /다시 학습 1/);
    assert.ok(height < 1800, 'ten collapsed date summaries must stay compact');
    await p.screenshot({ path: out + '/collapsed-mobile.png', fullPage: true });
    checks.push('same-day attempts share one date heading, with accurate attempt and type counts and no double-counted word total');

    const axe = async label => {
      await p.addScriptTag({ path: require('./qa/runtime.cjs').axePath });
      const violations = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      accessibility.push({ label, violations }); assert.deepEqual(violations, [], label);
    };
    await axe('collapsed mobile journal');
    await dayTriggers.first().focus(); await p.keyboard.press('Enter');
    assert.equal(await dayTriggers.first().getAttribute('aria-expanded'), 'true');
    assert.equal(await sessions.count(), 4);
    assert.equal(await panel.locator('.journal-session-trigger[aria-expanded=true]').count(), 0);
    assert.deepEqual(await sessions.locator('.journal-session-number').allTextContents(), ['4회차', '3회차', '2회차', '1회차']);
    const first = sessions.last(), rows = first.locator('.journal-word-trigger');
    const firstTrigger = first.locator('.journal-session-trigger');
    assert.match(await firstTrigger.innerText(), /10개 · 학습 기록함 8 · 도움 없이 성공 7 · 회차 마침/);
    await firstTrigger.focus(); await p.keyboard.press('Enter');
    assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await rows.count(), 11); // ten targets plus warmup
    assert.equal(await first.locator('.record-card:visible').count(), 0);
    for (const label of ['도움 없이 성공', '보완 필요', '아직 확인 안 함', '진행 중']) assert.ok((await first.locator('.journal-mobile').innerText()).includes(label));
    const targetRows = first.locator('.journal-word .journal-word-trigger');
    await targetRows.nth(0).click();
    let detail = first.locator('.record-card:visible');
    for (const text of ['처음 확인한 친숙도', '영어→뜻', '뜻→영어', '내 문장', '말하기', '보완점', '다음 할 일', '보존할 보완점 0']) assert.ok((await detail.innerText()).includes(text));
    await detail.getByText('저장한 AI 참고 의견', { exact: true }).click();
    assert.ok((await detail.innerText()).includes('저장한 교정 설명'));
    await targetRows.nth(1).click();
    assert.equal(await first.locator('.record-card:visible').count(), 1);
    assert.match(await first.locator('.record-card:visible').innerText(), /재시도 도움 없이 성공/);
    assert.equal(await targetRows.nth(0).getAttribute('aria-expanded'), 'false');
    await axe('expanded mobile record');
    await days.first().screenshot({ path: out + '/expanded-mobile.png' });
    await rows.first().click();
    assert.match(await first.locator('.record-card:visible').innerText(), /기억 깨우기 기록/);
    checks.push('keyboard disclosure, one-word expansion, all outcomes, notes, saved AI feedback and warmup remain reachable');

    await p.getByRole('tab', { name: '단어장', exact: true }).click();
    await p.getByRole('tab', { name: '학습 기록', exact: true }).click();
    assert.equal(await dayTriggers.first().getAttribute('aria-expanded'), 'true');
    assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'true');
    await triggers.first().click();
    assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'false');
    assert.ok(await sessions.first().getByRole('button', { name: '이어서 학습', exact: false }).isEnabled());
    await dayTriggers.nth(1).click();
    assert.equal(await dayTriggers.first().getAttribute('aria-expanded'), 'false');
    assert.equal(await panel.locator('.journal-session-trigger[aria-expanded=true]').count(), 0);
    await days.nth(1).locator('.journal-session-trigger').click();
    assert.ok(await days.nth(1).getByRole('button', { name: '이어서 학습', exact: false }).isEnabled());
    await dayTriggers.nth(1).click();
    assert.equal(await dayTriggers.nth(1).getAttribute('aria-expanded'), 'false');
    checks.push('tab return preserves both disclosures; changing date closes its attempts; the correct practice and weekly resume actions remain reachable');

    await panel.getByRole('button', { name: '이전 기록 더 보기' }).click(); assert.equal(await days.count(), 20);
    await panel.getByRole('button', { name: '이전 기록 더 보기' }).click(); assert.equal(await days.count(), 23);
    assert.match(await panel.locator('.section-heading').innerText(), /23일 · 26회차/);
    assert.equal(await panel.getByRole('status').count(), 0); // The range hint disappears once all dates are visible.
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '주간 점검', exact: true }).click();
    assert.equal(await days.count(), 1); assert.equal(await dayTriggers.first().getAttribute('aria-expanded'), 'false');
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '일일 학습', exact: true }).click();
    assert.match(await dayTriggers.first().innerText(), /2회차/);
    await dayTriggers.first().click();
    assert.deepEqual(await sessions.locator('.journal-session-number').allTextContents(), ['2회차', '1회차']);
    assert.match(await panel.getByRole('status').innerText(), /22일 · 23회차/);
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '월말 쓰기', exact: true }).click();
    assert.ok(await panel.getByRole('heading', { name: '이 종류의 학습 기록이 아직 없어요.' }).isVisible());
    assert.equal(await days.count(), 0);
    await panel.getByRole('combobox', { name: '기록 종류 필터' }).click(); await p.getByRole('option', { name: '모든 학습 기록', exact: true }).click();
    assert.equal(await days.count(), 10);
    checks.push('pagination keeps dates whole; all 23 dates and 26 attempts remain reachable; filtering updates counts and preserves original attempt numbers');

    const downloadText = async name => {
      await panel.getByRole('button', { name: '기록 관리', exact: true }).click();
      const pending = p.waitForEvent('download'); await p.getByRole('menuitem', { name, exact: true }).click();
      if (name === '전체 백업') await p.getByRole('button', { name: '백업 파일 다운로드', exact: true }).click();
      const d = await pending; return fs.readFileSync(await d.path(), 'utf8');
    };
    const backup = JSON.parse(await downloadText('전체 백업'));
    assert.deepEqual(backup.state, {...before.state,grammar:{}});
    const csv = await downloadText('학습 기록 CSV 받기');
    assert.ok(csv.includes(Object.values(state.sessions)[22].date));
    assert.ok(csv.includes('보존할 보완점 0'));
    assert.deepEqual(await get(), before); assert.equal(writes, 0);
    checks.push('collapsed and unloaded records are included in exports; browsing does not write or alter the server state');

    await dayTriggers.first().click();
    await firstTrigger.click();
    for (const width of [320, 390, 820, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'viewport ' + width);
      if (width === 320) {
        await targetRows.first().click();
        await p.addStyleTag({ content: 'html {font-size:200% !important}' });
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {const r=el.getBoundingClientRect();return r.width && r.right>innerWidth+1}).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width})))));
        await p.addStyleTag({ content: 'html {font-size:100% !important}' });
      }
    }
    assert.ok(await first.locator('.journal-desktop').isVisible());
    assert.equal(await first.locator('.log-table tbody tr:not(.journal-feedback-row)').count(), 10);
    const feedbackRows = first.locator('.journal-feedback-row');
    assert.equal(await feedbackRows.count(), 1);
    assert.equal(await feedbackRows.locator('td').getAttribute('colspan'), '6');
    await axe('expanded desktop journal');
    await p.screenshot({ path: out + '/expanded-desktop.png', fullPage: true });
    checks.push('320–1440 px, 200% text, reduced motion and desktop comparison table remain usable');

    const previousDate = Object.values(state.sessions)[1].date;
    await first.getByRole('button', { name: `${date} 10개 학습일 수정`, exact: true }).click();
    await p.getByLabel('실제로 공부한 날').fill(previousDate);
    await p.getByRole('button', { name: '학습일 수정하기', exact: true }).click();
    await p.getByRole('dialog').waitFor({ state: 'hidden' });
    await p.getByText('저장됨', { exact: true }).waitFor();
    await p.getByRole('tab', { name: '학습 기록', exact: true }).click();
    assert.match(await dayTriggers.first().innerText(), /3회차/);
    assert.match(await dayTriggers.nth(1).innerText(), /2회차/);
    const afterCorrection = await get();
    assert.equal(afterCorrection.revision, before.revision + 1);
    assert.equal(Object.keys(afterCorrection.state.sessions).length, 26);
    assert.equal(afterCorrection.state.sessions[original.id].date, previousDate);
    for (const id of original.ids) assert.deepEqual(afterCorrection.state.sessions[original.id].records[id], { ...original.records[id], learnedOn: previousDate });
    for (const s of Object.values(state.sessions)) if (s.id !== original.id) assert.deepEqual(afterCorrection.state.sessions[s.id], s);
    await p.reload(); await p.getByText('저장됨', { exact: true }).waitFor();
    await p.getByRole('tab', { name: '학습 기록', exact: true }).click();
    assert.match(await dayTriggers.first().innerText(), /3회차/);
    assert.match(await dayTriggers.nth(1).innerText(), /2회차/);
    checks.push('correcting a date from the grouped journal moves only the chosen attempt; date counts update immediately and after reload while scores and other attempts remain intact');
    assert.deepEqual(errors, []);
    const result = { passed: true, checks, accessibility, fixture: { dates: 23, sessions: 26, sameDayAttempts: 4 }, listHeight: height, browserErrors: errors };
    fs.writeFileSync(out + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exit(1); });
