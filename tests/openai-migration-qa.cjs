// Built loopback Worker and synthetic accounts. All AI POSTs are browser fixtures;
// the local Worker's ai_feedback_enabled stays false, with a synthetic key only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { launchBrowser, closeBrowser, accountHeaders, base, axePath, waitForWorker } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium';
const out = path.resolve('outputs/openai-migration/browser', engine);
const caps = { 'X-Study-AI-Contract': '4', 'X-Study-Grammar': '4', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1', 'X-Study-Monthly-Carryover': '1' };
const modelNames = { 'gpt-6.1-sol': 'GPT-6.1 Sol', 'gpt-6.1-terra': 'GPT-6.1 Terra', 'gpt-6-astra': 'GPT-6 Astra' };
const original = 'I arrive home yesterday.', correction = 'I arrived home yesterday.';
const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const word = words.find(w => w.word === 'arrive' && w.pos === 'v.');
// const unusedUnavailable = { status: 'unavailable', translation: '', parts: [], note: '합성 연결 검사용입니다.' };
const feedback = (sentence, model, explanation = '과거 표현을 확인하는 합성 의견입니다.', context = {}) => ({
  original: sentence, correctedSentence: sentence === original ? correction : sentence,
  meaningUsage: 'appropriate', grammar: sentence === original ? 'needs_work' : 'natural', explanation,
  provider: 'openai', requestedModel: model, model, promptVersion: 'reference-v5', validationVersion: 'judgment-v5', contextFingerprint: context.expectedContextFingerprint, ...(context.contextNote ? {contextNote:context.contextNote}: {}), createdAt: new Date().toISOString(),
});
const checks = [], errors = [], audits = [], postBodies = [];
let observedAiPosts = 0;
let release;

(async () => {
  fs.mkdirSync(out, { recursive: true }); await waitForWorker(base);
  const browser = await launchBrowser();
  try {
    const contexts = [];
    async function context(prefix) {
      const c = await browser.newContext({ extraHTTPHeaders: { ...accountHeaders(prefix), ...caps }, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      // Keep external fonts/assets out of this local functional QA.
      await c.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
      c.on('request', request => { if (request.method() === 'POST' && /\/api\/(?:sentence|grammar)-feedback$/.test(request.url())) observedAiPosts++; });
      contexts.push(c); return c;
    }
    const a = await context('openai_a'), b = await context('openai_b');
    async function snapshot(c) { const r = await c.request.get(base + '/api/state'); assert.equal(r.status(), 200); return r.json(); }
    async function persistedSnapshot(c,condition){const until=Date.now()+10000;let value;do{value=await snapshot(c);if(condition(value))return value;await new Promise(resolve=>setTimeout(resolve,50));}while(Date.now()<until);assert.fail('Expected AI feedback to reach the revision-protected server snapshot');}
    async function save(c, state) { const current = await snapshot(c); const r = await c.request.put(base + '/api/state', { data: { revision: current.revision, ...state } }); assert.equal(r.status(), 200, await r.text()); }
    const page = await a.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/sentence-feedback', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON(); postBodies.push({ domain: 'word', ...body });
      assert.equal(body.expectedModelId, 'gpt-6.1-terra');
      await new Promise(resolve => { release = resolve; });
      assert.ok(body.requestId);assert.ok(body.requestStartedAt);
      await route.fulfill({ json: { feedback: feedback(body.sentence, body.expectedModelId,undefined,body),receipt:{requestId:body.requestId,state:'completed',persisted:true} } });
    });
    await page.route('**/api/grammar-feedback', async route => {
      const body = route.request().postDataJSON(); postBodies.push({ domain: 'grammar', ...body });
      assert.equal(body.expectedModelId, 'gpt-6-astra'); assert.equal(body.lessonId, 'noun');
      assert.ok(body.requestId);assert.ok(body.requestStartedAt);
      await route.fulfill({ json: { feedback: feedback(body.sentence, body.expectedModelId, '명사 목표를 확인하는 합성 의견입니다.',body),receipt:{requestId:body.requestId,state:'completed',persisted:true} } });
    });
    const saved = () => page.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
    const settingsButton = () => page.getByRole('button', { name: '학습 설정', exact: true });
    const initial = await snapshot(a);
    assert.equal((await (await a.request.get(base + '/api/sentence-feedback')).json()).enabled, false, 'real provider calls must stay disabled in browser QA');
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await saved();
    await settingsButton().click();
    const dialog = page.getByRole('dialog'), choice = dialog.getByRole('combobox', { name: 'AI 모델', exact: true });
    await choice.waitFor(); await choice.isEnabled().then(async enabled => { if (!enabled) await page.waitForFunction(() => !document.querySelector('[aria-label="AI 모델"]')?.disabled); });
    assert.equal((await snapshot(a)).revision, initial.revision); assert.equal(postBodies.length, 0);
    assert.match(await choice.innerText(), /GPT-6.1 Sol/);
    checks.push('opening settings and interpreting a missing model neither writes state nor generates AI');
    await choice.click(); await page.getByRole('option', { name: modelNames['gpt-6.1-terra'], exact: true }).click(); await saved();
    assert.equal((await snapshot(a)).state.settings.aiModelId, 'gpt-6.1-terra');
    assert.equal((await snapshot(b)).state.settings.aiModelId, undefined); assert.equal(postBodies.length, 0);
    await page.reload(); await saved(); await settingsButton().click();
    assert.match(await choice.innerText(), /GPT-6.1 Terra/);
    checks.push('a real revision-protected choice survives reload and stays isolated from the other account');
    await dialog.getByText('모델별 API 요금', { exact: true }).click();
    assert.match(await dialog.innerText(), /GPT-6 Astra: \$10 \/ \$50/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const font of [100, 200]) {
        const style = await page.addStyleTag({ content: `html{font-size:${font}% !important}` });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${font} page overflow`);
        assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${width}/${font} dialog overflow`);
        const small = await dialog.locator('button,summary,a,[role="combobox"]').evaluateAll(nodes => nodes.filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && (r.width < 43.9 || r.height < 43.9); }).map(el => el.textContent));
        assert.deepEqual(small, [], `${width}/${font} touch targets`);
        await style.evaluate(el => el.remove());
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
    audits.push({ screen: 'model-settings', violations }); assert.deepEqual(violations, []);
    await choice.focus(); await page.keyboard.press('ArrowDown'); await page.getByRole('listbox').waitFor();
    await page.keyboard.press('Escape'); assert.ok(await dialog.isVisible());
    await page.screenshot({ path: path.join(out, 'model-settings.png'), fullPage: true });
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    checks.push('prices, 320/390/768/1440px at100/200%, 44px targets, keyboard and axe pass');

    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const sid = randomUUID(), record = { meaning: '도착하다', familiarity: 'known', en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: '', notes: '', enAnswer: 'first answer', retryEn: 'help' };
    const session = { id: sid, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], stage: 'sentence', index: 0, records: { [word.id]: record }, retry: [], retryMode: false, elapsed: 0, finished: false, paused: false, createdAt: new Date().toISOString() };
    let current = await snapshot(a);
    await save(a, { settings: { ...current.state.settings, activeSessionId: sid }, progress: { [word.id]: { familiarity: 'known', en: 'independent', ko: 'help' } }, sessions: { [sid]: session } });
    await page.reload(); await saved();
    await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click(); await saved();
    await page.getByLabel('내 영어 문장', { exact: true }).fill(original);
    await page.getByText('AI에 전달할 문맥 추가 · 선택',{exact:true}).click();
    await page.getByRole('combobox',{name:'문장의 형식',exact:true}).selectOption('reply');
    await page.getByRole('textbox',{name:'문장 상황',exact:true}).fill('어제 집에 도착한 일을 설명해요.');
    assert.equal(postBodies.length,0);
    await page.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click();
    await page.getByRole('button', { name: '문장을 확인하고 있어요', exact: false }).waitFor();
    if (await settingsButton().isEnabled()) {
      await settingsButton().click(); assert.ok(await choice.isDisabled());
      await dialog.getByText('AI 의견을 요청하는 동안에는 모델을 바꿀 수 없어요.', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    }
    assert.equal(postBodies.length, 1); release(); release = undefined;
    await page.getByText('과거 표현을 확인하는 합성 의견입니다.', { exact: true }).waitFor(); await saved();
    current = await snapshot(a); const stored = structuredClone(current.state.sessions[sid].records[word.id]);
    assert.equal(stored.aiFeedback.model, 'gpt-6.1-terra'); assert.equal(stored.sentenceStatus, 'unmeasured'); assert.equal(stored.enAnswer, record.enAnswer);
    assert.equal(current.state.progress[word.id].ko, 'help'); assert.equal(current.state.progress[word.id].familiarity, 'known');
    assert.equal(stored.aiFeedback.contextNote,'어제 집에 도착한 일을 설명해요.');assert.equal(stored.aiFeedback.contextFingerprint,postBodies[0].expectedContextFingerprint);
    assert.equal(postBodies[0].contextKind,'reply');
    checks.push('one explicit word request binds explicit context and model, locks selection and preserves independent outcomes');
    const sentenceField=page.getByLabel('내 영어 문장',{exact:true}),apply=page.getByRole('button',{name:'AI 제안으로 문장 바꾸기',exact:true});
    await apply.click();assert.equal(await sentenceField.inputValue(),original);await page.getByRole('button',{name:'비교한 제안으로 바꾸기',exact:true}).click();
    assert.equal(await sentenceField.inputValue(),correction);await page.getByRole('button',{name:'교정 적용 되돌리기',exact:true}).click();assert.equal(await sentenceField.inputValue(),original);await saved();
    await sentenceField.fill('My newer sentence.');assert.equal(await apply.count(),0);await sentenceField.fill(original);await saved();
    checks.push('current proposals require comparison; undo preserves the original and stale edits hide apply without another request');

    await settingsButton().click(); let failSave = true;
    await page.route('**/api/state', route => route.request().method() === 'PUT' && failSave
      ? route.fulfill({ status: 503, json: { error: '합성 저장 실패 · 현재 입력을 보존해요.' } }) : route.continue());
    await choice.click(); await page.getByRole('option', { name: modelNames['gpt-6-astra'], exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '합성 저장 실패' }).first().waitFor();
    assert.equal((await snapshot(a)).state.settings.aiModelId, 'gpt-6.1-terra'); assert.match(await choice.innerText(), /GPT-6 Astra/);
    assert.equal(postBodies.length, 1); failSave = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await saved();
    current = await snapshot(a); assert.equal(current.state.settings.aiModelId, 'gpt-6-astra');
    assert.deepEqual(current.state.sessions[sid].records[word.id], stored); assert.equal(postBodies.length, 1);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click(); await page.unroute('**/api/state');
    checks.push('failed model persistence retains the choice and retries saving without regenerating old feedback');

    const answer = { first: 'first', latest: 'latest', helped: true, attempts: 2 };
    const grammar = { stage: 5, answers: { q1: answer, q2: answer, q3: answer }, sentence: 'I like music.', updatedAt: new Date().toISOString() };
    await save(a, { grammar: { noun: grammar }, progress: {}, sessions: {} });
    await page.reload(); await saved(); await page.getByRole('tab', { name: '단어장', exact: true }).click();
    await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click();
    await page.locator('.grammar-tile').filter({ has: page.getByText('명사', { exact: true }) }).click();
    await page.getByRole('textbox', { name: '내 문장', exact: true }).waitFor();
    await page.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click();
    await page.getByText('명사 목표를 확인하는 합성 의견입니다.', { exact: true }).waitFor(); await saved();
    current = await persistedSnapshot(a,value=>value.state.grammar.noun.feedback?.model==='gpt-6-astra'); assert.equal(current.state.grammar.noun.feedback.model, 'gpt-6-astra');
    assert.deepEqual(current.state.grammar.noun.answers, grammar.answers); assert.deepEqual(current.state.sessions[sid].records[word.id], stored); assert.equal(postBodies.length, 2);
    checks.push('grammar uses the next saved model and preserves legacy first answers and prior word opinions');

    await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    await page.locator('[data-backup-trigger]').click(); await page.getByRole('menuitem', { name: '전체 백업', exact: true }).click();
    const exportDialog = page.getByRole('dialog'); await exportDialog.getByText('현재 앱에서 복원 가능한 백업이에요.', { exact: true }).waitFor();
    const pendingDownload = page.waitForEvent('download'); await exportDialog.getByRole('button', { name: '백업 파일 다운로드', exact: true }).click();
    const download = await pendingDownload, backupPath = path.join(out, 'mixed-backup.json'); await download.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.equal(backup.format, 'haru-words-v1'); assert.equal(backup.state.settings.aiModelId, 'gpt-6-astra');
    assert.equal(backup.state.sessions[sid].records[word.id].aiFeedback.model, 'gpt-6.1-terra'); assert.equal(backup.state.grammar.noun.feedback.model, 'gpt-6-astra');
    assert.equal(postBodies.length, 2);
    const other = await b.newPage(); other.on('pageerror', e => errors.push(e.message));
    await other.goto(base); await other.getByText('저장됨', { exact: true }).waitFor();
    const sentinelKey=await other.evaluate(()=>{
      const owner=localStorage.getItem('haru-words:local-input-owner:v1'),instanceId=crypto.randomUUID(),question='synthetic-restore-sentinel';
      const key='haru-words:local-input:v1:'+encodeURIComponent(owner)+':'+instanceId+':'+encodeURIComponent(question);
      const values={meaning:'',expression:'',expressionTranslation:'',example:'',translation:'',answer:'Synthetic before restore.',sentence:'',notes:'',spoken:false,revealed:false,hint:false};
      localStorage.setItem(key,JSON.stringify({version:1,kind:'word',question,instanceId,epoch:localStorage.getItem('haru-words:local-input-clear:v1:'+encodeURIComponent(owner))??'initial',updatedAt:Date.now(),base:{...values,answer:''},values}));return key;
    });
    await other.getByRole('tab', { name: '학습 기록', exact: true }).click(); await other.locator('[data-backup-trigger]').click();
    await other.getByRole('menuitem', { name: '백업으로 복원', exact: true }).click();
    const restoreDialog = other.getByRole('dialog');
    await other.waitForFunction(() => { const input = document.querySelector('.backup-file input'); return !!input && !input.disabled; });
    await restoreDialog.locator('input[type=file]').setInputFiles(backupPath);
    await restoreDialog.getByRole('button', { name: '현재 기록 먼저 백업받기', exact: true }).waitFor();
    const safety = other.waitForEvent('download'); await restoreDialog.getByRole('button', { name: '현재 기록 먼저 백업받기', exact: true }).click(); await safety;
    await restoreDialog.getByRole('checkbox').check(); await restoreDialog.getByRole('button', { name: '이 백업으로 복원', exact: true }).click();
    await other.getByRole('alertdialog').getByRole('button', { name: '기록 교체 · 복원', exact: true }).click();
    await restoreDialog.getByText('백업을 복원했어요.', { exact: true }).waitFor();
    assert.deepEqual((await snapshot(b)).state, backup.state);
    assert.equal(await other.evaluate(key=>localStorage.getItem(key),sentinelKey),null,'committed restore clears device drafts so stale AI/input cannot override the restored backup');
    await restoreDialog.getByRole('button', { name: '학습 기록 확인하기', exact: true }).click();
    assert.equal(postBodies.length, 2);
    const legacyGet = await b.request.get(base + '/api/state', { headers: { 'X-Study-AI-Contract': '' } });
    assert.equal(legacyGet.status(), 426);
    checks.push('real browser export and staged restore preserve mixed models; legacy GET is426 without data loss or AI');

    await other.getByRole('button', { name: '학습 설정', exact: true }).click();
    const otherChoice = other.getByRole('combobox', { name: 'AI 모델', exact: true }); assert.match(await otherChoice.innerText(), /GPT-6 Astra/);
    const before = await snapshot(b); await save(b, { settings: { ...before.state.settings, aiModelId: 'gpt-6.1-sol' }, progress: {}, sessions: {} });
    await otherChoice.click(); await other.getByRole('option', { name: modelNames['gpt-6.1-terra'], exact: true }).click();
    await other.getByRole('button', { name: '현재 입력 백업', exact: true }).waitFor();
    assert.match(await otherChoice.innerText(), /GPT-6.1 Terra/); assert.equal((await snapshot(b)).state.settings.aiModelId, 'gpt-6.1-sol');
    const pendingConflictDownload = other.waitForEvent('download'); await other.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
    const conflictDownload = await pendingConflictDownload, conflictPath = path.join(out, 'conflict-backup.json'); await conflictDownload.saveAs(conflictPath);
    const conflictBackup = JSON.parse(fs.readFileSync(conflictPath, 'utf8'));
    const conflictState = conflictBackup.state ?? conflictBackup;
    assert.equal(conflictState.settings.aiModelId, 'gpt-6.1-terra');
    assert.deepEqual(conflictState.sessions[sid].records[word.id], stored);
    assert.equal(postBodies.length, 2); assert.equal((await snapshot(a)).state.settings.aiModelId, 'gpt-6-astra');
    checks.push('another-device409 preserves the pending model in an input backup and never overwrites the acknowledged selection');
    const c = await context('openai_archival'), archival = structuredClone(backup.state), historicalId = 'future-' + 'x'.repeat(121);
    archival.settings.aiModelId = historicalId;
    Object.assign(archival.sessions[sid].records[word.id].aiFeedback, { model: historicalId, requestedModel: historicalId });
    const empty = await snapshot(c);
    const restored = await c.request.post(base + '/api/state/restore', { headers: { 'X-Study-Revision': String(empty.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state: archival } });
    assert.equal(restored.status(), 200, await restored.text());
    const archivePage = await c.newPage(); archivePage.on('pageerror', e => errors.push(e.message));
    await archivePage.goto(base); await archivePage.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
    await archivePage.getByRole('button', { name: '학습 설정', exact: true }).click();
    await archivePage.getByText('현재 선택은 사용할 수 없어요. 가능한 모델을 직접 선택해 주세요.', { exact: true }).waitFor();
    for (const width of [320, 390]) {
      await archivePage.setViewportSize({ width, height: 900 });
      const style = await archivePage.addStyleTag({ content: 'html{font-size:200% !important}' });
      assert.equal(await archivePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'archival model page overflow');
      assert.equal(await archivePage.getByRole('dialog').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, 'archival model dialog overflow');
      await style.evaluate(el => el.remove());
    }
    await archivePage.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
    await archivePage.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
    await archivePage.locator('[data-feedback-provider="OpenAI"]').waitFor();
    assert.equal(await archivePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'archival attribution overflow');
    assert.equal((await snapshot(c)).state.settings.aiModelId, historicalId);
    assert.equal((await snapshot(c)).state.sessions[sid].records[word.id].aiFeedback.model, historicalId);
    assert.equal(observedAiPosts, 2); assert.equal(postBodies.length, 2);
    checks.push('full restore and long inactive model/source display remain readable without coercion or automatic AI');
    const d = await context('openai_lost_save'), lostPage = await d.newPage(), lossBefore = await snapshot(d);
    lostPage.on('pageerror', e => errors.push(e.message));
    let catalogGets = 0;
    await lostPage.route('**/api/sentence-feedback', route => {
      assert.equal(route.request().method(), 'GET');
      return ++catalogGets === 1 ? route.fulfill({ status: 503, json: { error: 'Synthetic catalog unavailable' } }) : route.continue();
    });
    await lostPage.goto(base); await lostPage.locator('.topbar').getByText('저장됨', { exact: true }).waitFor();
    await lostPage.getByRole('button', { name: '학습 설정', exact: true }).click();
    const lossDialog = lostPage.getByRole('dialog');
    await lossDialog.getByRole('button', { name: '모델 목록 다시 확인', exact: true }).waitFor();
    assert.equal(catalogGets, 1); assert.equal((await snapshot(d)).revision, lossBefore.revision);
    assert.equal((await snapshot(d)).state.settings.aiModelId, undefined);
    await lossDialog.getByRole('button', { name: '모델 목록 다시 확인', exact: true }).click();
    await lostPage.waitForFunction(() => { const el = document.querySelector('.settings-dialog [aria-label="AI 모델"]'); return el && !el.disabled; });
    assert.equal(catalogGets, 2); assert.equal((await snapshot(d)).revision, lossBefore.revision);
    checks.push('catalog failure preserves the missing selection and retries only its read without saving or generating AI');
    let lossPuts = 0;
    await lostPage.route('**/api/state', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      if (++lossPuts !== 1) return route.continue();
      const committed = await route.fetch(); assert.equal(committed.status(), 200); await committed.body();
      await route.abort('failed');
    });
    await lossDialog.getByRole('combobox', { name: 'AI 모델', exact: true }).click();
    await lostPage.getByRole('option', { name: modelNames['gpt-6.1-terra'], exact: true }).click();
    await lossDialog.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
    assert.equal(lossPuts, 1); assert.equal((await snapshot(d)).revision, lossBefore.revision + 1);
    assert.equal((await snapshot(d)).state.settings.aiModelId, 'gpt-6.1-terra');
    await lossDialog.getByRole('button', { name: '다시 시도', exact: true }).click();
    await lossDialog.getByRole('button', { name: '현재 입력 백업', exact: true }).waitFor();
    assert.equal(lossPuts, 2); assert.equal((await snapshot(d)).revision, lossBefore.revision + 1);
    const lossDownload = lostPage.waitForEvent('download');
    await lossDialog.getByRole('button', { name: '현재 입력 백업', exact: true }).click();
    const lossBackup = JSON.parse(fs.readFileSync(await (await lossDownload).path(), 'utf8'));
    assert.equal((lossBackup.state ?? lossBackup).settings.aiModelId, 'gpt-6.1-terra');
    assert.deepEqual((await snapshot(d)).state.sessions, lossBefore.state.sessions);
    assert.deepEqual((await snapshot(d)).state.progress, lossBefore.state.progress);
    assert.equal(observedAiPosts, 2); assert.equal(postBodies.length, 2);
    checks.push('lost model-save response commits once; explicit retry returns409 and preserves an input backup without another AI request');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: true, engine, checks, audits, explicitAiPosts: postBodies.length, realProviderCalls: 0, productionWrites: 0, errors, realIphone: false }, null, 2));
    console.log(JSON.stringify({ passed: true, engine, checks: checks.length, aiFixturePosts: postBodies.length, realProviderCalls: 0 }));
  } catch (error) {
    for (const [i, page] of browser.contexts().flatMap(c => c.pages()).entries()) {
      await page.screenshot({ path: path.join(out, `failure-${i}.png`), fullPage: true }).catch(() => {});
      const alerts = await page.getByRole('alert').allTextContents().catch(() => []);
      if (alerts.length) console.error(JSON.stringify({ page: i, alerts }));
    }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: false, engine, checks, audits, error: error.message, stack: error.stack, errors }, null, 2));
    throw error;
  } finally { release?.(); await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
