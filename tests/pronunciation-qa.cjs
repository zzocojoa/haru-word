// Local synthetic records only. Dictionary links are inspected without opening external audio.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {base,launchBrowser,closeBrowser,accountHeaders,axePath,waitForWorker}=require('./qa/runtime.cjs');
const engine=process.env.QA_BROWSER||'chromium',out=`outputs/pronunciation-${engine}`;
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const word=words.find(w=>w.word==='close'&&w.pos==='v.');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{
 await waitForWorker();const browser=await launchBrowser({engine});fs.mkdirSync(out,{recursive:true});
 const checks=[],errors=[];
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:accountHeaders('pronunciation')});
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const writes=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(request.method()))writes.push(request.method());});
  const get=async()=>(await context.request.get(base+'/api/state')).json();
  const initial=await get();const id=crypto.randomUUID();
  const sample=words.filter(w=>w.level==='A1').slice(0,20).map(w=>w.id);
  const record={entryId:word.id,meaning:content[word.id].meaning,material:content[word.id],learnedOn:date,en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Please close this door.',notes:'',dailyOrigin:'new'};
  const session={id,kind:'daily',date,period:date,ids:[word.id],records:{[word.id]:record},stage:'done',index:0,warmupIds:[],retry:[],retryMode:false,elapsed:60,paused:true,finished:true,createdAt:new Date().toISOString()};
  const state={...initial.state,settings:{...initial.state.settings,dailyGoal:1,assessments:{A1:{ids:sample,index:20,marks:Object.fromEntries(sample.map(x=>[x,'uncertain'])),completed:true}}},sessions:{[id]:session}};
  async function restore(next){const now=await get();const response=await context.request.post(base+'/api/state/restore',{headers:{'x-study-revision':String(now.revision),'X-Study-Grammar':'3'},data:{format:'haru-words-v1',exportedAt:new Date().toISOString(),state:next}});assert.equal(response.status(),200,await response.text());}
  const saved=()=>page.getByText('저장됨',{exact:true}).waitFor();
  async function pronunciation(){await page.locator('.word-ipa').getByText('/kloʊz/',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'미국식 사전 발음 듣기',exact:true}).getAttribute('href'),'https://dictionary.cambridge.org/us/pronunciation/english/close');assert.equal(await page.getByRole('button',{name:/close 기기 음성 듣기/}).count(),0);}
  async function layout(label){for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const size of [100,200]){await page.evaluate(x=>document.documentElement.style.fontSize=x+'%',size);assert.equal(await page.locator('.dictionary-audio').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),14*size/100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label} ${width}/${size}`);}await page.evaluate(()=>document.documentElement.style.fontSize='100%');}await page.setViewportSize({width:390,height:844});await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(x=>x.id)),[],label);checks.push(label);}
  await restore({...state,progress:{[word.id]:{meaning:'현재 편집한 다른 뜻'}}});await page.goto(base);await saved();const snapshotBefore=await get();
  assert.equal(await page.locator('.word-ipa').count(),0,'home does not display IPA');
  await page.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click();await pronunciation();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),snapshotBefore);
  checks.push('completed snapshot uses its recorded meaning, not the current edited sense');
  await restore(state);await page.goto(base);await saved();const before=await get();
  await page.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click();await pronunciation();await layout('completed snapshot pronunciation');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),before);
  await page.getByRole('tab',{name:'단어장',exact:true}).click();await page.getByLabel('단어 또는 한국어 뜻 검색').fill('close');await page.getByRole('button',{name:'close 동사 · close1',exact:true}).click();await pronunciation();await layout('editor reviewed pronunciation');
  await page.getByRole('button',{name:'다른 뜻 추가',exact:true}).click();await page.getByLabel('학습할 뜻',{exact:true}).fill('마감하다');await page.getByRole('link',{name:'사전에서 발음 확인',exact:true}).waitFor();assert.equal(await page.locator('.word-ipa .phonetic').count(),0);await page.keyboard.press('Escape');await page.getByRole('button',{name:'변경 버리고 닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),before);
  checks.push('edited sense removes guessed IPA and discard preserves records');
  const expectedIpa=JSON.parse(fs.readFileSync('data/american-ipa-ui.json')).entries;
  for(const name of ['read','a, an','quickly']){
   const entry=words.find(w=>w.word===name),search=page.getByLabel('단어 또는 한국어 뜻 검색');
   await search.fill(name);assert.equal(await page.locator('.word-ipa').count(),0,'library list has no IPA');
   const trigger=page.locator('.word-link').filter({has:page.locator('b',{hasText:new RegExp('^'+name+'$')})}).first();
   await trigger.click();const dialog=page.getByRole('dialog');await dialog.locator('.word-ipa').waitFor();
   assert.deepEqual(await dialog.locator('.phonetic').allTextContents(),expectedIpa[entry.id].map(v=>v[0]));
   if(expectedIpa[entry.id].length>1)assert.deepEqual((await dialog.locator('.ipa-usage').allTextContents()).map(x=>x.trim()),expectedIpa[entry.id].map(v=>v[1]));
   assert.equal(await dialog.locator('.dialog-scroll > .word-ipa:first-child').count(),1,'IPA follows the fixed title in the scrollable body');
   if(name==='quickly')assert.equal(await dialog.getByRole('button',{name:'quickly 기기 음성 듣기',exact:true}).count(),1);
   for(const width of [320,390,1440])for(const size of [100,200]){
    await page.setViewportSize({width,height:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
    assert.equal(await dialog.locator('.word-ipa').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,`${name} IPA overflow ${width}/${size}`);
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:390,height:844});
   if(name==='read'){
    await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(x=>x.id)),[]);
    await page.screenshot({path:out+'/read-editor.png'});
    await dialog.getByRole('button',{name:'다른 뜻 추가',exact:true}).click();
    await dialog.getByLabel('학습할 뜻',{exact:true}).fill('변경한 뜻');await page.waitForFunction(()=>document.querySelectorAll('.word-ipa').length===0);
    await dialog.getByLabel('학습할 뜻',{exact:true}).fill(content[entry.id].meaning);await dialog.locator('.word-ipa').waitFor();
    await dialog.getByLabel('학습할 뜻 선택',{exact:true}).selectOption(content[entry.id].meaning);await dialog.locator('.word-ipa').waitFor();
   }
   await page.keyboard.press('Escape');
   if(name==='read')await page.getByRole('button',{name:'변경 버리고 닫기',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   // Dialog dismissal and history traversal schedule restoration independently.
   // Await the observable focus result instead of guessing its animation frame.
   await page.waitForFunction(el=>document.activeElement===el,await trigger.elementHandle(),{timeout:2000});
   assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,'editor focus returns to its word');
   assert.deepEqual(await get(),before);
  }
  checks.push('read/article conditions, ordinary device speech, editor IPA hide/restore, 320/390/1440 and 200% text, focus return');
  await page.getByRole('button',{name:'학습 방식·출처',exact:true}).click();
  const sourceLink=page.getByRole('link',{name:'발음 데이터·출처·라이선스',exact:true});assert.equal(await sourceLink.getAttribute('href'),'/sources/american-ipa.json');
  const publicData=await context.request.get(base+'/sources/american-ipa.json');assert.equal(publicData.status(),200);assert.equal((await publicData.json()).entries.length,3809);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.deepEqual(writes,[],'viewing IPA, editing/discarding and reading sources do not write');
  for(const stage of ['learn','sentence']){
   await restore({...state,settings:{...state.settings,activeSessionId:id},sessions:{[id]:{...session,stage,finished:false}}});await page.goto(base);await saved();
   await page.getByRole('button',{name:/학습 이어서/}).click();await pronunciation();await saved();
   // Resuming intentionally persists the session. Observe IPA-only actions after that save.
   const resumed=await get(),writeCount=writes.length;await layout(stage+' pronunciation');
   const link=page.getByRole('link',{name:'미국식 사전 발음 듣기',exact:true});await link.focus();assert.equal(await link.evaluate(el=>document.activeElement===el),true);
   assert.equal(writes.length,writeCount,'displaying IPA does not write');assert.deepEqual(await get(),resumed);
  }
  await restore({...state,settings:{...state.settings,activeSessionId:id},sessions:{[id]:{...session,stage:'sentence',finished:false,records:{[word.id]:{...record,meaning:''}}}}});
  await page.goto(base);await saved();await page.getByRole('button',{name:/학습 이어서/}).click();
  await page.getByLabel('내 영어 문장',{exact:true}).waitFor();await page.getByRole('link',{name:'사전에서 발음 확인',exact:true}).waitFor();await saved();
  assert.equal(await page.locator('.word-ipa').count(),0,'an explicitly blank sentence sense never falls back to textbook IPA');
  assert.equal((await get()).state.sessions[id].records[word.id].meaning,'');
  checks.push('explicitly empty sentence sense stays empty and has no guessed IPA');
  for(const stage of ['en','ko']){
   await restore({...state,settings:{...state.settings,activeSessionId:id},sessions:{[id]:{...session,stage,finished:false}}});await page.goto(base);await saved();
   await page.getByRole('button',{name:/학습 이어서/}).click();await page.locator('.recall').waitFor();assert.equal(await page.locator('.word-ipa').count(),0,'recall never exposes IPA');
  }
  checks.push('both recall directions keep IPA hidden; public source data available without application writes');
  const sessionResumeWrites=writes.length;
  await restore({...state,settings:{...state.settings,activeSessionId:null,assessments:{}},sessions:{},progress:{}});
  await page.goto(base);await saved();await page.getByRole('button',{name:'단어 20개 친숙도 확인',exact:true}).click();
  await page.locator('.familiarity-card').waitFor();await saved();assert.equal(await page.locator('.word-ipa').count(),0);
  checks.push('familiarity checks do not reveal IPA');
  const report={engine,checks,errors,sessionResumeWrites,familiarityStartWrites:writes.length-sessionResumeWrites,actualIPhoneAudio:false};
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
