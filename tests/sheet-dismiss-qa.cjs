// Synthetic local accounts only; WebKit is not a physical iPhone test.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, waitForWorker, axePath } = require('./qa/runtime.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/sheet-dismiss-${engine}`;
fs.mkdirSync(out, { recursive: true });
(async () => {
  await waitForWorker(); const browser = await launchBrowser({ engine });
  const checks = [], errors = []; let p;
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, extraHTTPHeaders: accountHeaders('sheet') });
    const get = async () => (await c.request.get(base + '/api/state')).json();
    const words = JSON.parse(fs.readFileSync('data/words.json')), content = JSON.parse(fs.readFileSync('data/content.json'));
    const w = words.find(w => w.word === 'work' && w.pos === 'v.');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const sample = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id), first = await get(), id = crypto.randomUUID();
    const session = { id, kind: 'daily', date, period: date, ids: [w.id], warmupIds: [], records: { [w.id]: { meaning: content[w.id].meaning, material: content[w.id], en: 'independent', ko: 'independent', sentenceStatus: 'written', sentence: 'I work here.', notes: '' } }, stage: 'done', index: 0, retry: [], retryMode: false, elapsed: 600, finished: true, paused: true, createdAt: new Date().toISOString() };
    assert.equal((await c.request.put(base + '/api/state', { data: { revision: first.revision, settings: { ...first.state.settings, dailyGoal: 1, assessments: { A1: { ids: sample, index: 20, marks: Object.fromEntries(sample.map(id => [id, 'uncertain'])), completed: true } } }, progress: {}, sessions: { [id]: session } } })).status(), 200);
    p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(base); await p.getByText('서버에 저장됨', { exact: true }).waitFor();
    const before = await get(), dialog = p.getByRole('dialog');
    const saved = () => p.getByText('서버에 저장됨', { exact: true }).waitFor();
    const tab = name => p.getByRole('tab', { name, exact: true }).click();
    const gesture = async ({ dx = 0, dy = 160, cancel = false, region = 'handle', multiple = false, resize = false } = {}) => {
      await p.waitForTimeout(220); // Wait for the real entrance/spring animation.
      const result = await p.evaluate(({ dx, dy, cancel, region, multiple, resize }) => {
        const el = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].filter(el => el.getClientRects().length && !el.closest('[aria-hidden=true]')).at(-1);
        const target = region === 'body' ? el.querySelector('.dialog-scroll') : region === 'alert' ? el.querySelector('h2') : ['back','header'].includes(region) ? el.querySelector('[data-slot=dialog-header]') : el.querySelector('[data-sheet-handle]');
        const box = target.getBoundingClientRect(), x = region === 'back' ? 5 : box.x + box.width / 2, y = box.y + Math.min(22, box.height / 2);
        const chrome = () => ['.topbar', '.main-nav'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; });
        const chromeBefore = chrome(), position = history.length;
        const fire = (type, x, y, multiple = false) => {
          const event = new Event(type, { bubbles: true, cancelable: true }), point = { identifier: 7, clientX: x, clientY: y };
          Object.defineProperties(event, { touches: { value: /end|cancel/.test(type) ? [] : multiple ? [point, { identifier: 8, clientX: x+10, clientY: y+10 }] : [point] }, changedTouches: { value: [point] } });
          target.dispatchEvent(event); return event.defaultPrevented;
        };
        fire('touchstart', x, y); fire('touchmove', x+dx, y+dy, multiple);
        const moved = el.hasAttribute('data-sheet-dragging'), offset = el.style.getPropertyValue('--sheet-offset');
        const chromeDuring = chrome(); if (resize) window.dispatchEvent(new Event('resize'));
        fire(cancel ? 'touchcancel' : 'touchend', x+dx, y+dy);
        return { moved, offset, chromeBefore, chromeDuring, position };
      }, { dx, dy, cancel, region, multiple, resize });
      assert.deepEqual(result.chromeBefore, result.chromeDuring); assert.equal(await p.evaluate(() => history.length), result.position);
      await p.waitForTimeout(210); return result;
    };
    const down = () => gesture();
    const gone = () => dialog.waitFor({ state: 'hidden' });
    const settings = () => p.getByRole('button', { name: '학습 설정', exact: true }).click();
    const audit = async () => {
      await p.locator('[role=dialog],[role=alertdialog],[data-slot=alert-dialog-overlay]').evaluateAll(els=>Promise.all(els.flatMap(el=>el.getAnimations()).map(a=>a.finished.catch(()=>{}))));
      await p.addScriptTag({ path: axePath }); assert.deepEqual(await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))), []);
    };
    await settings();
    for (const options of [{dy:30},{dy:-150},{dx:150,dy:10},{cancel:true},{multiple:true},{resize:true},{region:'body',dy:-150}]) { await gesture(options); assert.ok(await dialog.isVisible()); }
    await p.emulateMedia({ reducedMotion:'reduce' }); const reduced = await gesture({cancel:true}); assert.equal(reduced.offset,'0px'); await p.emulateMedia({ reducedMotion:'no-preference' });
    for (const width of [320,390,430,768,1440]) for (const size of [100,200]) {
      await p.setViewportSize({width,height:844}); await p.evaluate(size => document.documentElement.style.fontSize = `${size}%`,size);
      await dialog.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth),false);
      assert.equal(await p.locator('.sheet-handle').isVisible(),width<=640);
      assert.ok((await dialog.getByRole('button',{name:'Close',exact:true}).boundingBox()).height>=44);
    }
    await p.evaluate(() => document.documentElement.style.fontSize='100%'); await p.setViewportSize({width:1440,height:1000});
    await gesture({region:'back',dx:0,dy:160}); assert.ok(await dialog.isVisible()); await p.screenshot({path:`${out}/desktop-settings.png`});
    await p.setViewportSize({width:390,height:844}); await dialog.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))); await p.screenshot({path:`${out}/mobile-settings.png`}); await audit(); await down(); await gone();
    if (engine === 'chromium') {
      await settings(); await p.locator('.sheet-handle').waitFor(); await dialog.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))); const client = await c.newCDPSession(p), handle = await p.locator('.sheet-handle').boundingBox(), x=handle.x+handle.width/2,y=handle.y+22;
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}); await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+160}]});
      assert.equal(await dialog.getAttribute('data-sheet-dragging'),''); await p.screenshot({path:`${out}/dragging.png`});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await gone(); await client.detach();
    }
    await settings(); await gesture({region:'header'}); await gone();
    await settings(); await gesture({dy:0}); assert.ok(await dialog.isVisible());
    await p.locator('.sheet-handle').click(); assert.ok(await dialog.isVisible());
    await dialog.getByRole('button',{name:'Close',exact:true}).focus(); await p.keyboard.press('Enter'); await gone();
    checks.push('settings: cancel/short/up/horizontal/multitouch/resize and upward body gestures excluded; reduced motion, fixed chrome, 5 widths and 200% text; desktop unchanged');
    await p.getByRole('button',{name:'학습 방식·출처',exact:true}).click(); await down(); await gone();
    await p.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click(); await down(); await gone();
    await p.getByRole('button',{name:'학습일 수정',exact:true}).click(); await down(); await gone();
    await tab('전체 단어장'); const search=p.getByLabel('단어 또는 한국어 뜻 검색'); await search.fill('work');
    const openWord=()=>p.getByRole('button',{name:'work 동사',exact:true}).click();
    await openWord(); await down(); await gone(); assert.equal(await search.inputValue(),'work');
    await p.getByRole('button',{name:'개인 단어 추가',exact:true}).click(); await down(); await gone();
    await p.getByRole('button',{name:'work 동사 도움말',exact:true}).click(); await down(); await gone();
    await p.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='work 동사 도움말');
    const recordTool=async name=>{await tab('학습 기록');await p.getByRole('button',{name:'기록 관리',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();await dialog.waitFor();};
    await recordTool('전체 백업'); await down(); await gone(); await recordTool('백업 가져오기'); await down(); await gone();
    assert.deepEqual(await get(),before); checks.push('all 9 sheets dismiss without changing learner state; focus/filter restored');

    await tab('전체 단어장'); await openWord(); const expression=()=>dialog.getByLabel('함께 익힐 표현',{exact:true}); await expression().fill('work with my team');
    await down(); await p.getByRole('alertdialog').waitFor(); await audit(); await p.getByRole('button',{name:'계속 편집',exact:true}).tap();
    assert.equal(await expression().inputValue(),'work with my team');
    await gesture({region:'back',dx:180,dy:0}); await p.getByRole('alertdialog').waitFor(); await p.getByRole('button',{name:'계속 편집',exact:true}).tap();
    await p.getByRole('alertdialog').waitFor({state:'hidden'}); await p.waitForTimeout(200); assert.equal(await expression().inputValue(),'work with my team');
    await dialog.getByRole('button',{name:'Close',exact:true}).click(); await p.getByRole('button',{name:'변경 버리고 닫기',exact:true}).click(); await gone();
    assert.deepEqual(await get(),before); checks.push('downward, horizontal Back and X share discard confirmation; cancel stays usable during horizontal guard; no discarded edits saved');

    await p.getByRole('button',{name:'개인 단어 추가',exact:true}).click(); await dialog.getByLabel('영어 단어',{exact:true}).fill('commute');
    await p.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-300});visualViewport.dispatchEvent(new Event('resize'));});
    await p.locator('.shell[data-keyboard=open]').waitFor(); assert.equal((await down()).moved,false); assert.ok(await dialog.isVisible());
    await p.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));}); await down(); await p.getByRole('button',{name:'계속 편집',exact:true}).click();
    assert.equal(await dialog.getByLabel('영어 단어',{exact:true}).inputValue(),'commute'); await p.keyboard.press('Escape'); await p.getByRole('button',{name:'변경 버리고 닫기',exact:true}).click(); await gone();
    checks.push('keyboard-open gesture does not dismiss personal draft; Escape uses the same protection');

    await openWord(); await expression().fill('work after retry'); let held;
    await p.route('**/api/state',route=>route.request().method()==='PUT'?held=route:route.continue());
    await dialog.getByRole('button',{name:'기록 저장',exact:true}).click(); await p.getByText('저장 중',{exact:true}).waitFor();
    assert.equal((await down()).moved,false); await dialog.getByRole('button',{name:'Close',exact:true}).click(); await p.keyboard.press('Escape'); assert.ok(await dialog.isVisible());
    await held.fulfill({status:503,json:{error:'테스트 저장 실패'}}); await p.getByText('테스트 저장 실패',{exact:true}).waitFor(); assert.equal(await expression().inputValue(),'work after retry');
    await p.unroute('**/api/state'); await dialog.getByRole('button',{name:'Close',exact:true}).click();
    if(await p.getByRole('alertdialog').count())await p.getByRole('button',{name:'변경 버리고 닫기',exact:true}).click();
    await gone(); await p.getByRole('button',{name:'다시 시도',exact:true}).click(); await saved(); await openWord(); assert.equal(await expression().inputValue(),'work after retry'); await down(); await gone();
    assert.deepEqual((await get()).state.sessions,before.state.sessions); checks.push('saving blocks gesture/X/Escape; failure retains input; retry preserves historical grades');

    await tab('오늘의 학습'); await p.getByRole('button',{name:'학습일 수정',exact:true}).click();
    const earlier=new Date(Date.parse(date+'T12:00:00Z')-2*86400000).toISOString().slice(0,10); await p.getByLabel('실제로 공부한 날').fill(earlier); await down(); await p.getByRole('button',{name:'계속 편집',exact:true}).click(); assert.equal(await p.getByLabel('실제로 공부한 날').inputValue(),earlier);
    await p.route('**/api/state',route=>route.request().method()==='PUT'?held=route:route.continue());
    await p.getByRole('button',{name:'학습일 수정하기',exact:true}).click(); await p.getByText('저장 중',{exact:true}).first().waitFor(); await down(); assert.ok(await dialog.isVisible()); await held.continue(); await p.unroute('**/api/state'); await gone(); await saved();
    checks.push('date edit confirms discard and blocks dismissal until its submitted save finishes');

    const backup={format:'haru-words-v1',exportedAt:new Date().toISOString(),state:(await get()).state};
    await recordTool('백업 가져오기'); await p.waitForFunction(()=>document.querySelector('input[type=file]')&&!document.querySelector('input[type=file]').disabled);
    await p.locator('input[type=file]').setInputFiles({name:'sheet.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))}); await p.locator('[data-safety-preview]').filter({hasText:'복원 가능'}).waitFor();
    const download=p.waitForEvent('download'); await p.getByRole('button',{name:'현재 기록 먼저 백업받기',exact:true}).click(); await download; await p.getByRole('checkbox').check(); await p.getByRole('button',{name:'이 백업으로 복원',exact:true}).click(); await p.getByRole('alertdialog').waitFor();
    await gesture({region:'alert'}); assert.ok(await p.getByRole('alertdialog').isVisible());
    await p.route('**/api/state/restore/jobs/*/commit',route=>{held=route;}); await p.getByRole('button',{name:'기록 교체 · 복원',exact:true}).click(); await p.locator('[data-backup-step]').filter({hasText:'서버에 반영 중'}).waitFor();
    assert.equal(await p.locator('.sheet-handle').getAttribute('data-disabled'),'true'); await down(); assert.ok(await dialog.isVisible()); assert.equal(await dialog.getByRole('button',{name:'Close',exact:true}).count(),0);
    await held.continue(); await p.getByRole('heading',{name:'백업을 복원했어요.',exact:true}).waitFor(); await p.unroute('**/api/state/restore/jobs/*/commit'); await down(); await gone();
    assert.deepEqual((await get()).state,backup.state); checks.push('restore confirmation excluded; server commit cannot dismiss; completed restore can close with exact data preserved');
    assert.deepEqual(errors,[]); const report={passed:true,engine,checks}; fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  } catch(error) { if(p) await p.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{}); throw error; }
  finally {await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
