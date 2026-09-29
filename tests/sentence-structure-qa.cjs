// Synthetic local learner and mocked providers only; no production data or keys.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath, waitForWorker } = require('./qa/runtime.cjs');
const { original, feedback } = require('./fixtures/sentence-structure.cjs');
const engine = process.env.QA_BROWSER || 'chromium', out = `outputs/sentence-structure-${engine}`;
const cap = { 'X-Study-Feedback-Structure':'1', 'X-Study-Grammar':'2' };
const legacy = { ...feedback }; delete legacy.structure;
const word = JSON.parse(fs.readFileSync('data/words.json')).find(w => w.word === 'trip' && w.pos === 'n.');
fs.mkdirSync(out, { recursive:true });
(async () => {
  await waitForWorker(); const browser = await launchBrowser({ engine }); let page; const errors=[],checks=[];
  try {
    const context = await browser.newContext({ extraHTTPHeaders:accountHeaders('structure'),viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce' });
    const state = async (headers=cap) => (await context.request.get(base+'/api/state',{headers})).json();
    let data = await state(); const sid=crypto.randomUUID(),now=new Date().toISOString();
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const rec={meaning:'여행',en:'independent',ko:'independent',sentenceStatus:'unmeasured',sentence:original,notes:'',aiFeedback:legacy};
    const session={id:sid,kind:'daily',date,period:date,ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:rec},retry:[],retryMode:false,elapsed:0,finished:false,paused:true,createdAt:now};
    const grammar={noun:{stage:5,sentence:original,answers:Object.fromEntries(['q1','q2','q3'].map(k=>[k,{first:'a',latest:'a',attempts:1,helped:false}])),feedback:legacy,updatedAt:now}};
    assert.equal((await context.request.put(base+'/api/state',{headers:cap,data:{revision:data.revision,settings:{...data.state.settings,activeSessionId:sid},progress:{},sessions:{[sid]:session},grammar}})).status(),200);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const saved=()=>page.getByText('서버에 저장됨',{exact:true}).waitFor();
    await page.goto(base);await saved();await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();
    await page.getByText('이전 교정에는 문장 구조 설명이 없어요.',{exact:true}).waitFor();
    const before=(await state()).state; let calls=0;
    await page.route('**/api/sentence-feedback',async route=>{calls++;assert.equal(route.request().headers()['x-study-feedback-structure'],'1');await route.fulfill({json:{feedback}})});
    await page.getByRole('button',{name:'문장 구조 포함해 다시 점검',exact:true}).click();
    await page.locator('.ai-feedback-panel .sentence-structure').waitFor();await saved();assert.equal(calls,1);
    data=await state();assert.deepEqual(data.state.sessions[sid].records[word.id].aiFeedback.structure,feedback.structure);
    assert.deepEqual(data.state.progress,before.progress);assert.equal(data.state.sessions[sid].records[word.id].sentenceStatus,'unmeasured');assert.equal(data.state.settings.dailyGoal,before.settings.dailyGoal);
    assert.deepEqual((await state({})).state.sessions[sid].records[word.id].aiFeedback,legacy);
    const oldData=await state({});
    assert.equal((await context.request.put(base+'/api/state',{data:{revision:oldData.revision,progress:{},sessions:oldData.state.sessions}})).status(),426);
    assert.deepEqual((await state()).state,data.state,'legacy save may not erase the new structure');
    const oldBackup={format:'haru-words-v1',exportedAt:now,state:oldData.state};
    assert.equal((await context.request.post(base+'/api/state/restore',{headers:{'X-Study-Revision':String(data.revision)},data:oldBackup})).status(),426);
    checks.push('legacy feedback can be explicitly upgraded; old readers work and old writes/restores cannot erase structure');
    const backup={format:'haru-words-v1',exportedAt:now,state:data.state};
    assert.equal((await context.request.post(base+'/api/state/restore',{headers:{...cap,'X-Study-Revision':String(data.revision)},data:backup})).status(),200);
    await page.reload();await saved();await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();
    const view=page.locator('.ai-feedback-panel .sentence-structure');await view.waitFor();assert.equal(await view.locator('li').count(),5);assert.equal(calls,1);
    await view.getByText('부분별 설명',{exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await view.locator('details').getAttribute('open'),'');
    for(const role of ['S · 주어 Subject','V · 동사 Verb','O · 목적어 Object','M · 수식어 Modifier'])assert.ok((await view.innerText()).includes(role));
    for(const width of [320,390,768,1440])for(const size of [100,200]){
      await page.setViewportSize({width,height:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
      assert.equal(await view.evaluate(el=>el.scrollWidth>el.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1),false,`${width}/${size}`);
    }
    await view.getByText('부분별 설명',{exact:true}).click();
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await view.scrollIntoViewIfNeeded();await view.screenshot({path:`${out}/desktop.png`});
    await page.setViewportSize({width:390,height:844});await view.scrollIntoViewIfNeeded();await view.screenshot({path:`${out}/mobile.png`});
    await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=> (await axe.run('.ai-feedback-panel',{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>v.id)),[]);
    checks.push('save/reload/backup restore keeps role cards without another AI call; 320–1440px, 200% and axe');
    await page.getByRole('button',{name:'문장을 완성했어요',exact:true}).click();await page.getByRole('heading',{name:'오늘의 기록을 남겼어요.',exact:true}).waitFor();await saved();
    await page.getByRole('tab',{name:'학습 기록',exact:true}).click();await page.locator('.journal-day-trigger').first().click();await page.locator('.journal-session-trigger').first().click();
    await page.locator('.journal-mobile .journal-word-trigger').click();await page.locator('.journal-mobile').getByText('저장한 AI 교정 의견',{exact:true}).click();await page.locator('.journal-mobile .sentence-structure').waitFor();checks.push('completed learning history renders the same saved structure');
    await page.getByRole('tab',{name:'전체 단어장',exact:true}).click();await page.getByRole('tab',{name:'품사·문장 연습',exact:true}).click();await page.locator('.grammar-tile').first().click();
    let grammarCalls=0;await page.route('**/api/grammar-feedback',async route=>{grammarCalls++;assert.equal(route.request().headers()['x-study-feedback-structure'],'1');await route.fulfill({json:{feedback:{...feedback,model:'openai/gpt-oss-120b'}}})});
    await page.getByRole('button',{name:'AI로 문장 점검',exact:true}).click();await page.locator('.grammar-feedback .sentence-structure').waitFor();await saved();
    await page.getByText('Groq로 점검',{exact:true}).waitFor();data=await state();assert.deepEqual(data.state.grammar.noun.feedback.structure,feedback.structure);assert.equal(grammarCalls,1);
    // A failed refresh of feedback retains the previous analysis and the draft.
    await page.unroute('**/api/grammar-feedback');await page.route('**/api/grammar-feedback',route=>route.fulfill({status:429,json:{code:'groq_limit',error:'현재 사용 한도',providerStatus:429}}));
    await page.getByRole('button',{name:'AI로 문장 점검',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('.grammar-writing textarea').inputValue(),original);assert.equal(await page.locator('.grammar-feedback .sentence-structure').isVisible(),true);
    checks.push('grammar writing uses the same cards, preserves provider attribution and keeps draft/results on quota failure');
    assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({passed:true,engine,checks},null,2));console.log(JSON.stringify({passed:true,engine,checks}));
    await context.close();
  }catch(e){if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e}
  finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exitCode=1});
