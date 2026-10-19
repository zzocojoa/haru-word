// Built local Worker only. Synthetic learner; viewport keyboard is simulated.
const { launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = require('./qa/runtime.cjs').base, out = 'outputs/ui-refresh';
fs.mkdirSync(out, { recursive: true });
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const date = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const ids = ['arrive','busy','breakfast'].map(term=>words.find(w=>w.word===term).id);
const record = id => ({entryId:id,meaning:content[id].meaning,material:content[id],learnedOn:date,en:'unmeasured',ko:'unmeasured',sentenceStatus:'unmeasured',sentence:'',notes:''});
const session = (kind, time) => {const id=crypto.randomUUID();return {id,kind,date,period:kind==='monthly'?date.slice(0,7):date,ids,warmupIds:[],records:Object.fromEntries(ids.map(id=>[id,record(id)])),stage:kind==='monthly'?'ko':'learn',index:0,retry:[],retryMode:false,elapsed:0,paused:true,finished:false,createdAt:date+'T'+time+':00:00Z'};};

(async()=>{
 const browser=await launchBrowser();const checks=[],errors=[],audits=[];
 try {
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':require('./qa/runtime.cjs').account('ui_refresh_'),'oai-authenticated-user-email':'qa@example.test'}});
  const get=async()=> (await c.request.get(base+'/api/state')).json();
  const initial=await get(), daily=session('daily','01'), older=session('monthly','02'), latest=session('monthly','03');
  Object.assign(daily.records[ids[0]],{en:'independent',ko:'independent',sentenceStatus:'written',sentence:'I arrive home.'});
  Object.assign(daily.records[ids[2]],{en:'independent',ko:'help',sentenceStatus:'improve',sentence:'My breakfast.'});
  const state={settings:{...initial.state.settings,activeSessionId:daily.id,dailyGoal:3},progress:Object.fromEntries(ids.map(id=>[id,{meaning:content[id].meaning,familiarity:'uncertain',studyDates:[date],lastStudied:date}])),sessions:{[daily.id]:daily,[older.id]:older,[latest.id]:latest}};
  const restore=await c.request.post(base+'/api/state/restore',{headers:{'x-study-revision':String(initial.revision)},data:{format:'haru-words-v1',exportedAt:new Date().toISOString(),state}});
  assert.equal(restore.status(),200,await restore.text());
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base, { waitUntil: 'domcontentloaded' });await p.getByText('저장됨',{exact:true}).waitFor();
  const before=await get(), rows=p.locator('.today-word-row');
  assert.equal(await rows.count(),3);
  await p.getByRole('button',{name:'남은 단어 1',exact:true}).click();
  assert.equal(await rows.count(),1);assert.match(await rows.innerText(),/busy/);
  await p.getByRole('tab',{name:'단어장',exact:true}).click();
  await p.getByLabel('단어 또는 한국어 뜻 검색').fill('arrive');
  await p.getByRole('button',{name:'필터 초기화',exact:true}).click();
  assert.equal(await p.getByLabel('단어 또는 한국어 뜻 검색').inputValue(),'');
  assert.ok(await p.getByLabel('단어 또는 한국어 뜻 검색').evaluate(el=>document.activeElement===el));
  await p.getByRole('tab',{name:'오늘 학습',exact:true}).click();
  assert.equal(await p.getByRole('button',{name:'남은 단어 1',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await rows.count(),1);
  await p.getByRole('button',{name:'전체 3',exact:true}).click();
  checks.push('remaining filter persists across tabs; reset clears library filters and restores search focus');
  await p.getByRole('tab',{name:'복습 점검',exact:true}).click();
  assert.equal(await p.getByRole('tabpanel',{name:'복습 점검',exact:true}).locator('.pending-reviews article').count(),1);
  assert.equal(await p.locator('[data-review-kind=monthly]').getByRole('button',{name:/이어서/}).count(),1);
  assert.deepEqual(await get(),before);
  checks.push('selected monthly session appears once; a separate older session for the same month remains reachable without writes');
  const audit=async name=>{await p.addScriptTag({path:require('./qa/runtime.cjs').axePath});const violations=await p.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));audits.push({name,violations});assert.deepEqual(violations,[],name);};
  for(const width of [320,390,430,600,601,620,640,641,768,1440]){
   await p.setViewportSize({width,height:900});
   for(const name of ['오늘 학습','단어장','복습 점검','학습 기록']){
    await p.getByRole('tab',{name,exact:true}).click();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' '+width);
    const labels=await p.getByRole('tablist',{name:'학습 화면',exact:true}).locator('[role=tab]').evaluateAll(tabs=>tabs.map(tab=>[...tab.querySelectorAll('.nav-label-wide,.nav-label-compact')].filter(label=>label.getClientRects().length>0).map(label=>label.className)));
    assert.deepEqual(labels,Array.from({length:4},()=>[width<=640?'nav-label-compact':'nav-label-wide']),'one visible label per tab at '+width);
    if(width===390){await audit(name);await p.screenshot({path:out+'/'+name+'.png'});}
   }
  }
  await p.setViewportSize({width:320,height:900});
  const zoom=await p.addStyleTag({content:'html{font-size:200% !important}'});
  for(const name of ['오늘 학습','단어장','복습 점검','학습 기록']){
   await p.getByRole('tab',{name,exact:true}).click();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' 200%');
  }
  await zoom.evaluate(el=>el.remove());
  checks.push('all four tabs fit ten widths and 200% text; breakpoint labels stay unique; four populated mobile views pass axe');
  await p.setViewportSize({width:390,height:844});
  await p.getByRole('button',{name:'기록 관리',exact:true}).click();await audit('record menu');
  await p.keyboard.press('Escape');assert.ok(await p.getByRole('button',{name:'기록 관리',exact:true}).evaluate(el=>document.activeElement===el));
  await p.getByRole('tab',{name:'단어장',exact:true}).click();
  await p.getByRole('button',{name:'개인 단어 추가',exact:true}).click();
  assert.ok((await p.getByRole('combobox',{name:'개인 단어 품사'}).boundingBox()).height>=44);
  for(const width of [320,390,430,768,1440]){
   await p.setViewportSize({width,height:844});
   assert.equal(await p.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,'personal form '+width);
  }
  await p.setViewportSize({width:390,height:844});await audit('personal word dialog');
  await p.getByRole('button',{name:'닫기',exact:true}).click();
  await p.getByRole('button',{name:'학습 방식·출처',exact:true}).click();
  await audit('source dialog');assert.equal(await p.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await p.getByRole('button',{name:'닫기',exact:true}).click();
  checks.push('personal form uses a 44px part-of-speech control and fits five widths; personal and source dialogs pass axe');
  await p.getByRole('tab',{name:'오늘 학습',exact:true}).click();
  await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();
  await p.waitForFunction(()=>document.activeElement?.tagName==='H2'&&!!document.activeElement.closest('.session-panel'));
  const input=p.getByLabel('학습할 뜻',{exact:false});await input.fill('키보드 입력 보존');
  assert.ok(await input.evaluate(el=>document.activeElement===el));
  // Emulate only the visual viewport shrink. Real iOS keyboard is a manual check.
  await p.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-320});visualViewport.dispatchEvent(new Event('resize'));});
  try { await p.locator('.shell[data-keyboard=open]').waitFor(); }
  catch(error) {
   console.error(JSON.stringify({keyboard:await p.evaluate(()=>({innerHeight,viewportHeight:visualViewport.height,activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,focusWithinSession:!!document.activeElement?.closest('.session-panel'),shell:document.querySelector('.shell')?.getAttribute('data-keyboard')})),errors}));
   throw error;
  }
  assert.equal(await p.getByRole('tablist',{name:'학습 화면',includeHidden:true}).isVisible(),false);
  assert.equal(await p.locator('.study-actions').evaluate(el=>getComputedStyle(el).position),'static');
  assert.equal(await input.inputValue(),'키보드 입력 보존');
  await p.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
  await p.getByRole('tablist',{name:'학습 화면'}).waitFor();
  await p.getByRole('button',{name:'저장하고 나가기',exact:true}).click();
  await p.getByRole('heading',{name:'학습 기록을 저장했어요',exact:true}).waitFor();
  assert.equal(await p.locator('.session-summary .record-card').count(),0);
  assert.equal(await p.locator('.session-summary .journal-word').count(),3);
  await p.locator('.session-summary .journal-word-trigger').first().click();
  assert.equal(await p.locator('.session-summary .record-card').count(),1);
  await audit('compact completion summary');
  const after=(await get()).state;
  assert.deepEqual(after.sessions[older.id],older);assert.deepEqual(after.sessions[latest.id],latest);
  assert.equal(after.sessions[daily.id].records[ids[0]].en,'independent');
  checks.push('menu Escape returns focus; simulated keyboard releases sticky actions and preserves input; summary expands one record and keeps prior scores');
  assert.deepEqual(errors,[]);
  const report={passed:true,checks,audits,errors};fs.writeFileSync(out+'/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
