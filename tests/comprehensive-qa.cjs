// Production-built Worker only. Every mutation uses an isolated local test account.
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const base='http://127.0.0.1:8787',out='outputs/comprehensive-audit';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const record=id=>({meaning:content[id].meaning,en:'independent',ko:'independent',sentenceStatus:'written',sentence:'A saved example.',notes:'preserve this note',learnedOn:date});
(async()=>{const browser=await chromium.launch();const checks=[],errors=[];let serial=0;
 const context=async()=>browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'oai-authenticated-user-id':'full_audit_'+Date.now()+'_'+serial++,'oai-authenticated-user-email':'audit@example.test'}});
 const state=async ctx=>(await ctx.request.get(base+'/api/state')).json();
 const page=async ctx=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return p};
 const saved=async p=>p.getByText('서버에 저장됨',{exact:true}).waitFor();
 try{
  for(const count of [120,310]){
   const ctx=await context();let data=await state(ctx);
   const progress=Object.fromEntries(words.slice(0,count).map(w=>[w.id,{meaning:content[w.id].meaning,studyDates:[date],lastStudied:date,en:'independent',ko:'independent',sentenceStatus:'written',needsReview:false}]));
   const seed=await ctx.request.put(base+'/api/state',{data:{revision:data.revision,progress,sessions:{}}});assert.equal(seed.status(),200,await seed.text());
   const p=await page(ctx);await p.goto(base);await saved(p);await p.getByRole('tab',{name:'주간·월말 점검'}).click();await p.getByRole('button',{name:'전체 점검 시작',exact:true}).click();await saved(p);
   await p.getByRole('heading',{name:'뜻 → 영어',exact:true}).waitFor();
   data=await state(ctx);const session=data.state.sessions[data.state.settings.activeSessionId];assert.equal(session.ids.length,count);assert.ok(Object.values(data.state.progress).every(p=>p.needsReview));assert.ok(Object.values(session.records).every(r=>r.ko==='unmeasured'));
   await p.getByLabel('영어 단어 입력').fill('saved monthly draft');await p.getByRole('button',{name:'오늘 종료 · 저장'}).click();await saved(p);
   await p.reload();await saved(p);await p.getByRole('button',{name:date.slice(0,7)+' 월말 쓰기 이어서',exact:true}).click();await saved(p);assert.equal(await p.getByLabel('영어 단어 입력').inputValue(),'saved monthly draft');
   if(count===120)await p.screenshot({path:out+'/monthly-after.png',fullPage:true});
   const before=await state(ctx);const stale=await ctx.request.put(base+'/api/state',{data:{revision:0,progress,sessions:{}}});assert.equal(stale.status(),409);assert.deepEqual(await state(ctx),before);
   checks.push(count+'-word monthly review starts atomically, preserves unmeasured outcomes, resumes its draft and rejects stale large writes');await ctx.close();
  }
  for(const initial of ['2026-09-27T14:59:55Z','2026-09-30T14:59:55Z']){
   const ctx=await context(),p=await page(ctx);await p.clock.install({time:new Date(initial)});await p.goto(base);await saved(p);await p.getByRole('tab',{name:'주간·월말 점검'}).click();
   const before=await p.locator('.daily-label').innerText();await p.clock.fastForward(70000);await p.evaluate(()=>window.dispatchEvent(new Event('focus')));
   assert.notEqual(await p.locator('.daily-label').innerText(),before);
   if(initial.includes('09-27'))assert.match(await p.getByRole('combobox',{name:'주간 점검 기간'}).innerText(),/2026-09-28/);
   else{assert.match(await p.getByRole('combobox',{name:'월말 점검 기간'}).innerText(),/2026-10/);await p.getByRole('tab',{name:'오늘의 학습'}).click();await p.screenshot({path:out+'/midnight-after.png',fullPage:true});}
   checks.push('open page refreshes Korean date and default review period at '+initial);await ctx.close();
  }
  const historic=await context(),hp=await page(historic),historicState=await state(historic);assert.equal((await historic.request.put(base+'/api/state',{data:{revision:historicState.revision,progress:{[words[0].id]:{meaning:content[words[0].id].meaning,studyDates:['2026-08-01'],lastStudied:'2026-08-01'}},sessions:{}}})).status(),200);
  await hp.clock.install({time:new Date('2026-09-30T14:59:55Z')});await hp.goto(base);await saved(hp);await hp.getByRole('tab',{name:'주간·월말 점검'}).click();
  await hp.getByRole('combobox',{name:'월말 점검 기간'}).click();await hp.getByRole('option',{name:'2026-08',exact:true}).click();await hp.getByRole('combobox',{name:'월말 점검 기간'}).click();await hp.getByRole('option',{name:'2026-09',exact:true}).click();await hp.clock.fastForward(70000);
  assert.match(await hp.getByRole('combobox',{name:'월말 점검 기간'}).innerText(),/2026-09/);await hp.getByRole('combobox',{name:'월말 점검 기간'}).click();assert.equal(await hp.getByRole('option',{name:'2026-09',exact:true}).count(),1);assert.equal(await hp.getByRole('option',{name:'2026-10',exact:true}).count(),1);await historic.close();
  checks.push('a deliberately chosen historical month remains selectable after midnight');
  // An open session must not lose an unsaved answer when the date hook updates.
  const ctx=await context();let data=await state(ctx);const sid=crypto.randomUUID(),id=words[0].id;
  const s={id:sid,kind:'daily',date:'2026-09-30',period:'2026-09-30',ids:[id],warmupIds:[],stage:'en',index:0,records:{[id]:{...record(id),en:'unmeasured',ko:'unmeasured',sentenceStatus:'unmeasured',sentence:''}},retry:[],retryMode:false,elapsed:0,finished:false,paused:false,createdAt:'2026-09-30T14:50:00Z'};
  assert.equal((await ctx.request.put(base+'/api/state',{data:{revision:data.revision,settings:{...data.state.settings,activeSessionId:sid},progress:{},sessions:{[sid]:s}}})).status(),200);
  const p=await page(ctx);await p.clock.install({time:new Date('2026-09-30T14:59:55Z')});await p.goto(base);await saved(p);await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved(p);await p.getByLabel('한국어 뜻 입력').fill('자정에도 남겨야 할 답');await p.clock.fastForward(70000);assert.equal(await p.getByLabel('한국어 뜻 입력').inputValue(),'자정에도 남겨야 할 답');assert.equal((await state(ctx)).state.settings.activeSessionId,sid);checks.push('midnight does not reset the active lesson or unsaved answer');
  // Boundary protections and isolation cover the new set-based database path.
  data=await state(ctx);
  const cross=await ctx.request.put(base+'/api/state',{headers:{'sec-fetch-site':'cross-site'},data:{revision:data.revision,progress:{},sessions:{}}});assert.equal(cross.status(),403);
  const oversized=await p.evaluate(async()=>{const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:'가'.repeat(610000)})});return response.status});assert.equal(oversized,413);
  assert.deepEqual(await state(ctx),data);const other=await context();assert.equal(Object.keys((await state(other)).state.progress).length,0);await other.close();
  checks.push('cross-site requests, oversized UTF-8 payloads and stale revisions cannot modify another account or partially save records');
  // Static assets, source downloads and secrets stay separate from the client.
  const assetPage=await page(ctx);await assetPage.goto(base);await saved(assetPage);const paths=await assetPage.locator('link[rel*=icon]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  for(const path of [...new Set([...paths,'/sources/oxford-source.pdf','/sources/learning-data.json','/sources/content-attribution.txt'])])assert.equal((await ctx.request.get(base+path)).status(),200,path);
  const assets=await assetPage.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));for(const url of assets){const text=await(await ctx.request.get(base+url)).text();assert.doesNotMatch(text,/AIza[0-9A-Za-z_-]{35}/);assert.doesNotMatch(text,/x-goog-api-key/);}
  checks.push('icons and source downloads return successfully and client entry scripts contain no Google key or server key header');
  for(const width of [320,390,768,1440]){await assetPage.setViewportSize({width,height:900});for(const label of ['오늘의 학습','전체 단어장','주간·월말 점검','학습 기록']){await assetPage.getByRole('tab',{name:label,exact:true}).click();assert.equal(await assetPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' at '+width);}}
  await assetPage.setViewportSize({width:640,height:720});await assetPage.evaluate(()=>document.documentElement.style.fontSize='200%');for(const label of ['오늘의 학습','전체 단어장','주간·월말 점검','학습 기록']){await assetPage.getByRole('tab',{name:label,exact:true}).click();assert.equal(await assetPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' at 200% text');}
  checks.push('all four views fit 320–1440px and 200% root text sizing without document overflow');await ctx.close();
  assert.deepEqual(errors,[]);const result={passed:true,checks,browserErrors:errors};fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
