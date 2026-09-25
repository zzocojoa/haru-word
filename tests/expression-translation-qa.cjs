// Local built Worker only: isolated accounts, no hosted records or Google calls.
const { launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const fs = require('node:fs'), assert = require('node:assert/strict');
const base = require('./qa/runtime.cjs').base, out = 'outputs/expression-translation';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
const selected = ['arrive', 'busy', 'breakfast'].map(name => words.find(w => w.word === name));
const [arrive] = selected, date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const checks = [], errors = [], aiRequests = [], axe = [];
const saved = p => p.getByText('서버에 저장됨', { exact: true }).waitFor();
const get = async c => { const r = await c.request.get(base + '/api/state'); assert.equal(r.status(), 200); return r.json(); };
const oldContent = id => { const { expressionTranslation, ...old } = content[id]; return old; };
(async () => {
 const browser = await launchBrowser();
 const headers = { 'oai-authenticated-user-id': require('./qa/runtime.cjs').account('expression_'), 'oai-authenticated-user-email': 'qa@example.test' };
 try {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: headers });
  const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
  p.on('request', r => { if (/sentence-feedback|generativelanguage/.test(r.url())) aiRequests.push(r.url()); });
  await p.goto(base); await saved(p); const initial = await get(c), sid = crypto.randomUUID();
  const s = { id: sid, kind: 'daily', date, period: date, ids: selected.map(w => w.id), warmupIds: [], stage: 'done', index: 2, retry: [], retryMode: false, elapsed: 800, paused: true, finished: true, createdAt: new Date().toISOString(),
   records: Object.fromEntries(selected.map(w => [w.id, { meaning: content[w.id].meaning, material: oldContent(w.id), learnedOn: date, en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'My saved sentence.', notes: 'Keep my note.' }])) };
  const progress = Object.fromEntries(selected.map(w => [w.id, { meaning: content[w.id].meaning, expression: content[w.id].expression, example: content[w.id].example, translation: content[w.id].translation, en: 'independent', ko: 'independent', sentenceStatus: 'written', studyDates: [date], lastStudied: date }]));
  assert.equal((await c.request.put(base + '/api/state', { data: { revision: initial.revision, settings: { ...initial.state.settings, dailyGoal: 3, activeSessionId: sid }, progress, sessions: { [sid]: s } } })).status(), 200);
  await p.reload(); await saved(p); const before = await get(c);
  await p.getByRole('button', { name: '오늘 단어 다시 보기', exact: true }).click(); let dialog = p.getByRole('dialog');
  const selectReplay = async w => { await dialog.getByRole('combobox', { name:'다시 볼 단어 선택', exact:true }).click(); await p.getByRole('option').filter({hasText: `${w.word} ·`}).click(); };
  for (const w of selected) {
   await selectReplay(w);
   assert.equal(await dialog.locator('.expression-translation').innerText(), content[w.id].expressionTranslation);
   assert.equal(await dialog.locator('.example-box .translation').innerText(), content[w.id].translation);
  }
  assert.deepEqual(await get(c), before); checks.push('legacy completed records backfill only the phrase gloss without rewriting records, results or revision');
  await selectReplay(arrive);
  for (const width of [320, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.screenshot({ path: out + '/completed-mobile.png' });
  async function audit(name) {
   await p.addScriptTag({ path: require('./qa/runtime.cjs').axePath });
   const result = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
   axe.push({ name, violations: result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) });
   assert.equal(result.violations.length, 0, JSON.stringify(axe.at(-1)));
  }
  await audit('completed phrase');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await p.getByRole('tab', { name: '전체 단어장', exact: true }).click();
  await p.getByLabel('단어 또는 한국어 뜻 검색', { exact: true }).fill('arrive');
  await p.getByRole('button', { name: 'arrive 동사', exact: true }).click(); dialog = p.getByRole('dialog');
  const phrase = dialog.getByLabel('함께 익힐 표현', { exact: true }), gloss = dialog.getByLabel('표현의 한국어 뜻', { exact: true });
  assert.equal(await gloss.inputValue(), '집에 도착하다');
  await phrase.fill(' arrive home '); assert.equal(await gloss.inputValue(), '집에 도착하다');
  await phrase.fill('arrive at school'); assert.equal(await gloss.inputValue(), '');
  await gloss.fill('학교에 도착하다'); await audit('editable phrase gloss'); await p.screenshot({ path: out + '/editor-mobile.png' });
  await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await saved(p); await dialog.waitFor({ state: 'hidden' });
  const custom = await get(c); assert.equal(custom.state.progress[arrive.id].expressionTranslation, '학교에 도착하다');
  assert.equal(custom.state.progress[arrive.id].senses[content[arrive.id].meaning].expressionTranslation, '학교에 도착하다');
  assert.deepEqual(custom.state.sessions[sid], s); checks.push('editing English clears the old gloss; saving retains a custom gloss in the active sense without changing historical material');
  await p.reload(); await saved(p); await p.getByRole('tab', { name: '전체 단어장', exact: true }).click();
  await p.getByLabel('단어 또는 한국어 뜻 검색', { exact: true }).fill('arrive'); await p.getByRole('button', { name: 'arrive 동사', exact: true }).click(); dialog = p.getByRole('dialog');
  assert.equal(await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '학교에 도착하다');
  await dialog.getByRole('button', { name: '다른 뜻 추가', exact: true }).click();
  assert.equal(await dialog.getByLabel('함께 익힐 표현', { exact: true }).inputValue(), '');
  assert.equal(await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '');
  await dialog.getByLabel('학습할 뜻 선택', { exact: true }).selectOption(content[arrive.id].meaning);
  assert.equal(await dialog.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '학교에 도착하다');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  checks.push('reload and switching learning senses preserve the matching gloss and never inherit another sense');
  await p.getByRole('tab', { name: '오늘의 학습', exact: true }).click(); await p.getByRole('button', { name: '오늘 단어 다시 학습', exact: true }).click(); await saved(p);
  assert.equal(await p.locator('.expression-translation').innerText(), '집에 도착하다');
  await p.getByText('표현·예문 수정하기', { exact: true }).click();
  await p.getByLabel('오늘 공부할 뜻', { exact: false }).fill('다다르다');
  assert.equal(await p.getByLabel('표현의 한국어 뜻', { exact: true }).inputValue(), '');
  await p.getByLabel('함께 익힐 표현', { exact: true }).fill('arrive at the station');
  await p.getByLabel('표현의 한국어 뜻', { exact: true }).fill('역에 다다르다');
  await p.screenshot({ path: out + '/learn-mobile.png' }); await audit('learning phrase gloss');
  await p.getByRole('button', { name: '오늘 종료 · 저장', exact: true }).click(); await saved(p);
  const paused = await get(c), repeat = Object.values(paused.state.sessions).find(x => x.practiceMode === 'repeat');
  assert.equal(repeat.records[arrive.id].material.expressionTranslation, '역에 다다르다');
  assert.deepEqual(paused.state.sessions[sid], s);
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: headers }), p2 = await c2.newPage();
  await p2.goto(base); await saved(p2); await p2.getByRole('button', { name: /다시 학습 이어서/, exact: false }).first().click(); await saved(p2);
  assert.equal(await p2.locator('.expression-translation').innerText(), '역에 다다르다');
  checks.push('repeat learning retains its historical phrase, edits clear stale glosses, and pause/resume restores on a separate browser context');
  for (let i = 0; i < selected.length; i++) { await p2.getByRole('button', { name: /뜻을 확인했어요/ }).click(); await saved(p2); }
  await p2.getByRole('textbox', { name: '한국어 뜻 입력', exact: true }).waitFor();
  assert.equal(await p2.locator('.expression-line').count(), 0);
  assert.equal(await p2.getByText('역에 다다르다', { exact: true }).count(), 0);
  checks.push('recall still hides phrase translations until the learner checks the answer');
  const exported = await (await c.request.get(base + '/sources/learning-data.json')).json();
  assert.equal(exported.records.filter(r => r.expressionTranslation?.trim()).length, 3809);
  assert.deepEqual(aiRequests, []); assert.deepEqual(errors, []);
  checks.push('all 3809 downloadable glosses are available with zero AI requests and zero browser errors');
  fs.writeFileSync(out + '/browser.json', JSON.stringify({ passed: true, checks, axe, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, axe, errors }));
 } finally { await closeBrowser(browser); }
})().catch(e => { console.error(e); process.exitCode = 1; });
