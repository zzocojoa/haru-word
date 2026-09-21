// Local built Worker only. Isolated test identities never touch hosted learner records.
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const words=JSON.parse(fs.readFileSync('data/words.json','utf8')),content=JSON.parse(fs.readFileSync('data/content.json','utf8'));
const base='http://127.0.0.1:8787',out='outputs/a1-content-review';fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[];const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':'a1content_'+Date.now(),'oai-authenticated-user-email':'a1@example.test'}});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));const saved=()=>p.getByText('서버에 저장됨',{exact:true}).waitFor();
 const get=async()=>{const r=await context.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json()};
 await p.goto(base);await saved();const initial=await get();
 await p.getByRole('tab',{name:'전체 단어장',exact:true}).click();
 for(const [term,pos] of [['bar','n.'],['favorite','n.'],['some','pron.'],['when','pron.'],['lesson','n.'],['line','n.'],['play','v.'],['yes','exclam.']]){
  const w=words.find(w=>w.level==='A1'&&w.word===term&&w.pos===pos),c=content[w.id];
  await p.getByLabel('단어 또는 한국어 뜻 검색',{exact:true}).fill(term);
  const posName={'n.':'명사','v.':'동사','pron.':'대명사','exclam.':'감탄사'}[pos];
  await p.getByRole('button',{name:new RegExp('^'+term+'\\s'+posName+'$')}).click();const dialog=p.getByRole('dialog');
  assert.equal(await dialog.getByLabel('오늘의 뜻',{exact:true}).inputValue(),c.meaning);
  assert.equal(await dialog.getByRole('textbox',{name:'영어 예문',exact:true}).inputValue(),c.example);
  assert.equal(await dialog.getByRole('textbox',{name:'한국어 해석',exact:true}).inputValue(),c.translation);
  assert.equal(await dialog.getByLabel('함께 익힐 표현',{exact:true}).inputValue(),c.expression);
  assert.match(await dialog.innerText(),new RegExp(c.source));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(term==='some')await p.screenshot({path:out+'/corrected-pronoun-mobile.png'});
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});
 }
 assert.deepEqual(await get(),initial);checks.push('eight corrected sense/POS cards show the published fields without saving or changing learner data');
 const exported=await (await context.request.get(base+'/sources/learning-data.json')).json();
 assert.equal(exported.records.length,3809);for(const w of words.filter(w=>w.level==='A1'))assert.deepEqual(exported.records.find(r=>r.id===w.id),{...w,...content[w.id]});
 checks.push('all 1077 A1 entries in the downloadable source match the built catalog');
 const w=words.find(w=>w.word==='bar'&&w.pos==='n.'&&w.level==='A1'),sid=crypto.randomUUID();
 const old={meaning:'막대·덩어리',expression:'a gold bar',example:'This is a gold bar.',translation:'이것은 금괴예요.',source:'학습용 작성 예문'};
 const record={entryId:w.id,learnedOn:date,material:old,meaning:old.meaning,familiarity:'uncertain',en:'independent',ko:'help',sentenceStatus:'improve',sentence:'My saved sentence.',notes:'보존할 메모'};
 const s={id:sid,kind:'daily',date,period:date,ids:[w.id],warmupIds:[],stage:'done',index:0,records:{[w.id]:record},retry:[],retryMode:false,elapsed:800,finished:true,paused:true,createdAt:new Date().toISOString()};
 let data=await get();assert.equal((await context.request.put(base+'/api/state',{data:{revision:data.revision,settings:{...data.state.settings,dailyGoal:1,activeSessionId:sid},progress:{[w.id]:{meaning:old.meaning,lastStudied:date,studyDates:[date],en:'independent',ko:'help',sentenceStatus:'improve'}},sessions:{[sid]:s}}})).status(),200);
 await p.reload();await saved();const before=await get();await p.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click();let dialog=p.getByRole('dialog');
 assert.equal(await dialog.locator('.review-meaning').innerText(),old.meaning);assert.ok((await dialog.innerText()).includes(old.example));assert.ok(!(await dialog.innerText()).includes(content[w.id].example));
 await p.screenshot({path:out+'/historical-material-preserved.png'});await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(await get(),before);
 checks.push('a completed pre-correction sense keeps its material, sentence, results and server revision');
 await p.getByRole('tab',{name:'전체 단어장',exact:true}).click();await p.getByLabel('단어 또는 한국어 뜻 검색',{exact:true}).fill('bar');await p.getByRole('button',{name:/^bar\s명사$/}).click();dialog=p.getByRole('dialog');
 assert.equal(await dialog.getByLabel('오늘의 뜻',{exact:true}).inputValue(),old.meaning);
 for(const label of ['영어 예문','한국어 해석','함께 익힐 표현'])assert.equal(await dialog.getByRole('textbox',{name:label,exact:true}).inputValue(),'');
 assert.match(await dialog.innerText(),/이 뜻의 예문은 사전에서 확인/);checks.push('legacy progress without material never receives the new unrelated sense example');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await p.getByRole('tab',{name:'오늘의 학습',exact:true}).click();await p.getByRole('button',{name:'오늘 단어 다시 학습',exact:true}).click();await saved();
 assert.equal(await p.getByLabel('오늘 공부할 뜻',{exact:false}).inputValue(),old.meaning);assert.ok((await p.locator('.learning-panel').innerText()).includes(old.example));
 assert.deepEqual((await get()).state.sessions[sid],s);checks.push('repeat learning starts from the old snapshot and does not overwrite the source session');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/browser.json',JSON.stringify({passed:true,checks,browserErrors:errors},null,2));console.log(JSON.stringify({passed:true,checks,browserErrors:errors}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
