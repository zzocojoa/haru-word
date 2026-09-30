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
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const get=async()=>(await context.request.get(base+'/api/state')).json();
  const initial=await get();const id=crypto.randomUUID();
  const sample=words.filter(w=>w.level==='A1').slice(0,20).map(w=>w.id);
  const record={entryId:word.id,meaning:content[word.id].meaning,material:content[word.id],learnedOn:date,en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Please close this door.',notes:'',dailyOrigin:'new'};
  const session={id,kind:'daily',date,period:date,ids:[word.id],records:{[word.id]:record},stage:'done',index:0,warmupIds:[],retry:[],retryMode:false,elapsed:60,paused:true,finished:true,createdAt:new Date().toISOString()};
  const state={...initial.state,settings:{...initial.state.settings,dailyGoal:1,assessments:{A1:{ids:sample,index:20,marks:Object.fromEntries(sample.map(x=>[x,'uncertain'])),completed:true}}},sessions:{[id]:session}};
  async function restore(next){const now=await get();const response=await context.request.post(base+'/api/state/restore',{headers:{'x-study-revision':String(now.revision),'X-Study-Grammar':'3'},data:{format:'haru-words-v1',exportedAt:new Date().toISOString(),state:next}});assert.equal(response.status(),200,await response.text());}
  const saved=()=>page.getByText('서버에 저장됨',{exact:true}).waitFor();
  async function pronunciation(){await page.locator('.word-pronunciation').getByText('/kloʊz/',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'미국식 사전 발음 듣기',exact:true}).getAttribute('href'),'https://dictionary.cambridge.org/us/pronunciation/english/close');assert.equal(await page.getByRole('button',{name:/close 기기 음성 듣기/}).count(),0);}
  async function layout(label){for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const size of [100,200]){await page.evaluate(x=>document.documentElement.style.fontSize=x+'%',size);assert.equal(await page.locator('.dictionary-audio').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),14*size/100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label} ${width}/${size}`);}await page.evaluate(()=>document.documentElement.style.fontSize='100%');}await page.setViewportSize({width:390,height:844});await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(x=>x.id)),[],label);checks.push(label);}
  await restore(state);await page.goto(base);await saved();const before=await get();
  await page.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click();await pronunciation();await layout('completed snapshot pronunciation');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),before);
  await page.getByRole('tab',{name:'전체 단어장',exact:true}).click();await page.getByLabel('단어 또는 한국어 뜻 검색').fill('close');await page.getByRole('button',{name:'close 동사 · close1',exact:true}).click();await pronunciation();await layout('editor reviewed pronunciation');
  await page.getByRole('button',{name:'다른 뜻 추가',exact:true}).click();await page.getByLabel('오늘의 뜻',{exact:true}).fill('마감하다');await page.getByRole('link',{name:'사전에서 발음 확인',exact:true}).waitFor();assert.equal(await page.locator('.word-pronunciation .phonetic').count(),0);await page.keyboard.press('Escape');await page.getByRole('button',{name:'변경 버리고 닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),before);
  checks.push('edited sense removes guessed IPA and discard preserves records');
  for(const stage of ['learn','sentence']){
   await restore({...state,settings:{...state.settings,activeSessionId:id},sessions:{[id]:{...session,stage,finished:false}}});await page.goto(base);await saved();
   await page.getByRole('button',{name:/학습 이어서/}).click();await pronunciation();await layout(stage+' pronunciation');
   const link=page.getByRole('link',{name:'미국식 사전 발음 듣기',exact:true});await link.focus();assert.equal(await link.evaluate(el=>document.activeElement===el),true);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify({engine,checks,errors,actualIPhoneAudio:false},null,2));console.log(JSON.stringify({engine,checks}));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
