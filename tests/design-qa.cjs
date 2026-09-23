// Run against the local built Worker, using isolated accounts only.
const {chromium}=require('./qa/runtime.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=require('./qa/runtime.cjs').base;
const out='outputs/open-design-ui';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json','utf8'));
const content=JSON.parse(fs.readFileSync('data/content.json','utf8'));
const checks=[];const errors=[];

(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':require('./qa/runtime.cjs').account('design_'),'oai-authenticated-user-email':'design@example.test'}});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  const saved=()=>p.getByText('서버에 저장됨',{exact:true}).waitFor();
  const state=async()=> (await context.request.get(base+'/api/state')).json();
  const shot=async name=>p.screenshot({path:out+'/'+name+'.png',animations:'disabled'});
  const fit=async()=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page must fit viewport');

  // Hold the initial request: show honest loading feedback before server data arrives.
  let release;const gate=new Promise(resolve=>{release=resolve});
  await p.route('**/api/state',async route=>{await gate;await route.continue()});
  await p.goto(base,{waitUntil:'domcontentloaded'});
  await p.locator('.loading-surface[aria-busy=true]').waitFor();
  assert.equal(await p.locator('.home-panel').count(),0);
  release();await saved();await p.unroute('**/api/state');
  assert.equal(await p.locator('.library-panel,.review-grid,.journal-list').count(),0);
  checks.push('initial loading is honest and unopened secondary views do not render');

  const before=await state();
  for(const width of [320,390,600,820,1440]){
   await p.setViewportSize({width,height:844});await fit();
   const start=await p.getByRole('button',{name:'20개 친숙도부터 확인',exact:true}).boundingBox();
   const nav=await p.getByRole('tablist',{name:'학습 화면'}).boundingBox();
   assert.ok(start&&start.y>=0&&start.y+start.height<=(width<=600?nav.y:844),'start action must be visible on first screen');
   for(const tab of ['전체 단어장','주간·월말 점검','학습 기록','오늘의 학습']){
    await p.getByRole('tab',{name:tab,exact:true}).click();await fit();
   }
  }
  checks.push('five viewport widths (320–1440 px) have no page overflow; the start action is above the mobile navigation');
  await p.setViewportSize({width:1440,height:1050});await shot('01-desktop-home');
  await p.setViewportSize({width:390,height:844});await shot('02-mobile-home');

  await p.getByRole('tab',{name:'전체 단어장',exact:true}).click();
  assert.ok(await p.locator('.meaning-cell').first().isVisible());
  assert.ok((await p.locator('.meaning-cell').first().innerText()).trim());
  await shot('03-mobile-library');
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  const fixed=await p.getByRole('tablist',{name:'학습 화면'}).boundingBox();
  assert.ok(fixed.y>=0&&fixed.y+fixed.height<=845);
  await p.getByRole('tab',{name:'학습 기록',exact:true}).click();
  assert.equal(await p.evaluate(()=>window.scrollY),0);
  await p.getByRole('tab',{name:'오늘의 학습',exact:true}).focus();
  await p.keyboard.press('ArrowRight');
  await p.getByRole('tabpanel',{name:'전체 단어장',exact:true}).waitFor();
  checks.push('mobile meanings remain visible, bottom navigation stays reachable after scrolling, keyboard tab navigation works');

  await p.getByLabel('단어 또는 한국어 뜻 검색').fill('work');
  await p.getByRole('tab',{name:'학습 기록',exact:true}).click();
  await p.getByRole('tab',{name:'전체 단어장',exact:true}).click();
  assert.equal(await p.getByLabel('단어 또는 한국어 뜻 검색').inputValue(),'work');
  const wordButton=p.getByRole('button',{name:'work 동사',exact:true});await wordButton.click();
  const dialog=p.getByRole('dialog');await dialog.waitFor();
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=391&&box.y+box.height<=845);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).animationName),'none');
  const save=p.getByRole('button',{name:'기록 저장',exact:true});
  for(const offset of [0,200,5000]){
   await dialog.locator('.dialog-scroll').evaluate((el,top)=>{el.scrollTop=top},offset);
   const button=await save.boundingBox();assert.ok(button.y>=box.y&&button.y+button.height<=845,'save must remain within the sheet');
  }
  await dialog.locator('.dialog-scroll').evaluate(el=>{el.scrollTop=0});await shot('04-mobile-editor');
  await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await p.waitForFunction(()=>document.activeElement?.matches('.word-link'));
  assert.ok(await wordButton.evaluate(el=>document.activeElement===el));
  assert.deepEqual(await state(),before);
  checks.push('bottom sheet fits the phone, save remains reachable during scrolling, reduced motion and focus restoration work, browsing does not change records');

  // A completed session exercises real record content without writing to a real account.
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const targets=['arrive','busy','breakfast'].map(term=>words.find(w=>w.word===term));
  const ids=targets.map(w=>w.id);const sid=crypto.randomUUID();
  const records=Object.fromEntries(ids.map((id,i)=>[id,{meaning:content[id].meaning,familiarity:'uncertain',en:'independent',ko:i?'independent':'help',sentenceStatus:i?'written':'improve',sentence:'I arrived home at seven.',notes:'전치사와 시제를 다시 확인하기',learnedOn:date}]));
  const session={id:sid,kind:'daily',date,period:date,ids,warmupIds:[],stage:'done',index:0,records,retry:[],retryMode:false,elapsed:840,finished:true,paused:true,createdAt:new Date().toISOString()};
  const progress=Object.fromEntries(ids.map(id=>{const {learnedOn,...savedRecord}=records[id];return [id,{...savedRecord,studyDates:[learnedOn],lastStudied:learnedOn}]}));
  const seed=await context.request.put(base+'/api/state',{data:{revision:before.revision,settings:{...before.state.settings,activeSessionId:sid},progress,sessions:{[sid]:session}}});
  assert.equal(seed.status(),200,await seed.text());
  await p.reload();await saved();
  for(const name of ['오늘 단어 다시 보기','오늘 단어 다시 학습']){
   const action=await p.getByRole('button',{name,exact:true}).boundingBox();const nav=await p.getByRole('tablist').boundingBox();
   assert.ok(action.y>=0&&action.y+action.height<=nav.y,'completed study actions must be above mobile navigation');
  }
  await shot('05-mobile-completed');
  await p.getByRole('tab',{name:'학습 기록',exact:true}).click();
  const journal=p.getByRole('tabpanel',{name:'학습 기록',exact:true});
  assert.equal(await journal.locator('.record-card').count(),0);
  await journal.locator('.journal-day-trigger').click();
  await journal.locator('.journal-session-trigger').click();
  assert.ok(await journal.locator('.journal-mobile').isVisible());
  await journal.locator('.journal-word-trigger').first().click();
  assert.ok(!await journal.locator('.journal-desktop').isVisible());
  const card=journal.locator('.record-card').first();
  for(const text of ['영어→뜻','뜻→영어','독립 성공','도움 필요','내 문장','보완점','전치사와 시제를 다시 확인하기'])assert.ok((await card.innerText()).includes(text));
  await fit();await shot('06-mobile-records');
  await p.setViewportSize({width:1440,height:1050});assert.ok(await journal.locator('.journal-desktop').isVisible());assert.ok(!await journal.locator('.journal-mobile').isVisible());await fit();await shot('07-desktop-records');
  checks.push('completed-study actions stay accessible; collapsed sessions and mobile word details show both recall directions, sentences and notes, while desktop retains the comparison table');

  await p.setViewportSize({width:390,height:844});await p.getByRole('tab',{name:'오늘의 학습',exact:true}).click();
  await p.getByRole('button',{name:'오늘 단어 다시 학습',exact:true}).click();await saved();
  await p.getByLabel('오늘 공부할 뜻',{exact:false}).waitFor();await fit();await shot('08-mobile-study');
  assert.ok(await p.getByRole('heading',{name:'단어 익히기',exact:true}).isVisible());
  await p.getByLabel('오늘 공부할 뜻',{exact:false}).fill('탭을 바꿔도 유지할 초안');
  await p.getByRole('tab',{name:'전체 단어장',exact:true}).click();
  assert.ok((await p.getByRole('heading',{name:'나의 단어장',exact:true}).boundingBox()).width>100);
  await p.getByRole('tab',{name:'오늘의 학습',exact:true}).click();
  assert.equal(await p.getByLabel('오늘 공부할 뜻',{exact:false}).inputValue(),'탭을 바꿔도 유지할 초안');
  await p.getByRole('button',{name:'오늘 종료 · 저장',exact:true}).click();await saved();
  checks.push('active mobile repeat study shows the current stage and can end with a saved record');
  assert.deepEqual(errors,[]);
  const report={passed:true,checks,browserErrors:errors};fs.writeFileSync(out+'/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
