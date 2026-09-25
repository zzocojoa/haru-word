const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const assert=require('node:assert/strict');const fs=require('node:fs');
const base=require('./qa/runtime.cjs').base,out='outputs/daily-topup';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json','utf8'));const content=JSON.parse(fs.readFileSync('data/content.json','utf8'));
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const checks=[],errors=[],saveEvents=[];
function observe(page){
 const starts=new WeakMap();
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/state')starts.set(request,performance.now())});
 page.on('requestfinished',async request=>{if(!starts.has(request))return;const response=await request.response();saveEvents.push({method:request.method(),status:response?.status(),durationMs:Math.round(performance.now()-starts.get(request))})});
 page.on('requestfailed',request=>{if(starts.has(request))saveEvents.push({method:request.method(),failure:request.failure()?.errorText,durationMs:Math.round(performance.now()-starts.get(request))})});
 page.on('pageerror',error=>errors.push(error.message));
}
(async()=>{const browser=await launchBrowser({headless:true});let p;
 try{
  const headers={'oai-authenticated-user-id':require('./qa/runtime.cjs').account('topup_'),'oai-authenticated-user-email':'topup@example.test'};
  const ctx=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:390,height:844}});
  const get=async()=> (await ctx.request.get(base+'/api/state')).json();let data=await get();
  const ids=['arrive','busy','breakfast'].map(term=>words.find(w=>w.word===term).id);const sid=crypto.randomUUID();
  const records=Object.fromEntries(ids.map(id=>[id,{meaning:content[id].meaning,familiarity:'uncertain',en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Original sentence.',notes:'Original note.',learnedOn:date}]));
  const first={id:sid,kind:'daily',date,period:date,ids,warmupIds:[],stage:'done',index:0,records,retry:[],retryMode:false,elapsed:840,finished:true,paused:true,createdAt:date+'T01:00:00.000Z'};
  const pool=words.filter(w=>w.level==='A1').slice(0,80);const sample=pool.slice(0,20).map(w=>w.id);
  const progress=Object.fromEntries(pool.map(w=>[w.id,{familiarity:'uncertain'}]));
  for(const id of ids)progress[id]={meaning:content[id].meaning,familiarity:'known',en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Original sentence.',notes:'Original note.',lastStudied:date,studyDates:[date]};
  const settings={...data.state.settings,activeSessionId:sid,assessments:{A1:{ids:sample,index:20,marks:Object.fromEntries(sample.map(id=>[id,'uncertain'])),completed:true}}};
  assert.equal((await ctx.request.put(base+'/api/state',{data:{revision:data.revision,settings,progress,sessions:{[sid]:first}}})).status(),200);
  p=await ctx.newPage();observe(p);const saved=async()=>{try{await p.getByText('서버에 저장됨',{exact:true}).waitFor()}catch(error){fs.writeFileSync(out+'/save-wait-failure.json',JSON.stringify({saveEvents,browserErrors:errors,status:await p.locator('.save-state').innerText(),alerts:await p.getByRole('alert').allTextContents(),stage:await p.locator('.session-step-row').allTextContents()},null,2));throw error}};
  async function goal(value){await p.getByRole('button',{name:'학습 설정',exact:true}).click();await p.getByRole('combobox',{name:'하루 목표',exact:true}).click();await p.getByRole('option',{name:value+'개',exact:true}).click();await saved();await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});}
  await p.goto(base);await saved();await goal(10);
  await p.getByRole('button',{name:'추가 7개 학습하기',exact:true}).waitFor();assert.equal((await p.locator('.daily-metrics b').first().innerText()).replace(/\s/g,''),'10단어');assert.equal(await p.locator('.today-words>.today-word-row').count(),3);
  const action=await p.getByRole('button',{name:'추가 7개 학습하기',exact:true}).boundingBox();const nav=await p.getByRole('tablist').boundingBox();assert.ok(action.y+action.height<=nav.y);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:out+'/01-add-seven.png',animations:'disabled'});
  checks.push('raising a completed three-word day to ten shows an accessible add-seven action and retains the original cards');

  // A second device keeps a stale revision for the concurrency check.
  const other=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:1366,height:1000}});const stale=await other.newPage();observe(stale);await stale.goto(base);await stale.getByText('서버에 저장됨',{exact:true}).waitFor();
  await p.route('**/api/state',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'테스트 저장 실패'})}):route.continue());
  await p.getByRole('button',{name:'추가 7개 학습하기',exact:true}).click();await p.getByRole('alert').waitFor();assert.deepEqual((await get()).state.sessions,{[sid]:first});assert.ok(await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).isDisabled());
  await p.unroute('**/api/state');await p.getByRole('button',{name:'다시 시도',exact:true}).click();await saved();
  data=await get();const topupId=data.state.settings.activeSessionId;let extra=data.state.sessions[topupId];
  assert.equal(extra.ids.length,7);assert.equal(extra.warmupIds.length,0);assert.ok(extra.ids.every(id=>!ids.includes(id)));assert.equal(Object.keys(data.state.sessions).length,2);assert.deepEqual(data.state.sessions[sid],first);
  checks.push('failed allocation retries the same seven-word session without duplicating it or modifying the completed session');
  await stale.getByRole('button',{name:'추가 7개 학습하기',exact:true}).click();await stale.getByRole('alert').filter({hasText:'다른 기기'}).waitFor();assert.equal(Object.keys((await get()).state.sessions).length,2);
  checks.push('a stale second device cannot allocate a duplicate session because the server rejects its revision');

  await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();
  for(let i=0;i<7;i++){await p.getByRole('button',{name:'뜻을 확인했어요',exact:false}).click();await saved();}
  await p.getByLabel('한국어 뜻 입력',{exact:true}).fill('추가 학습 임시 답');await p.getByRole('button',{name:'오늘 종료 · 저장',exact:true}).click();await saved();
  const resume=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:1366,height:1000}});p=await resume.newPage();observe(p);await p.goto(base);await saved();await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();assert.equal(await p.getByLabel('한국어 뜻 입력',{exact:true}).inputValue(),'추가 학습 임시 답');
  await goal(1);assert.equal((await get()).state.sessions[topupId].ids.length,7);await goal(10);
  checks.push('the additional session and recall draft resume across devices, and lowering the goal does not remove assigned work');
  extra=(await get()).state.sessions[topupId];
  for(const direction of ['en','ko'])for(const id of extra.ids){await p.getByLabel(direction==='en'?'한국어 뜻 입력':'영어 단어 입력',{exact:true}).fill(direction==='en'?extra.records[id].meaning:words.find(w=>w.id===id).word);await p.getByRole('button',{name:'내 답 확인',exact:false}).click();await p.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).click();await saved();}
  for(const id of extra.ids){await p.getByLabel('내 영어 문장',{exact:true}).fill('I use '+words.find(w=>w.id===id).word+' in a sentence.');await p.getByRole('button',{name:'문장을 완성했어요',exact:false}).click();await saved();}
  await p.getByRole('heading',{name:'오늘의 기록을 남겼어요.',exact:true}).waitFor();data=await get();assert.ok(data.state.sessions[topupId].finished);assert.deepEqual(data.state.sessions[sid],first);
  await p.getByRole('button',{name:'학습 홈으로',exact:false}).click();assert.equal(await p.getByRole('button',{name:/추가 \d+개 학습하기/}).count(),0);assert.equal(await p.locator('.today-words>.today-word-row').count(),10);
  await p.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click();await p.getByRole('combobox',{name:'다시 볼 단어 선택'}).click();assert.equal(await p.getByRole('option').count(),10);await p.keyboard.press('Escape');await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
  await p.getByRole('tab',{name:'주간·월말 점검',exact:true}).click();assert.deepEqual(await p.locator('.review-count>b').allTextContents(),['10','10']);
  checks.push('finishing the extra seven yields ten unique daily targets, all ten review cards and weekly/monthly targets, with the original results unchanged');

  // Settings opened from the finished session should return to the home action.
  // A separate small fixture checks the summary transition without completing another full ten-word lesson.
  const shortHeaders={'oai-authenticated-user-id':headers['oai-authenticated-user-id']+'_summary','oai-authenticated-user-email':'summary@example.test'};
  const small=await browser.newContext({extraHTTPHeaders:shortHeaders,viewport:{width:390,height:844}});const blank=await (await small.request.get(base+'/api/state')).json();const last={...first,finished:false,stage:'sentence',index:2,paused:false};
  assert.equal((await small.request.put(base+'/api/state',{data:{revision:blank.revision,settings,progress,sessions:{[sid]:last}}})).status(),200);
  p=await small.newPage();observe(p);await p.goto(base);await saved();await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();await p.getByLabel('내 영어 문장',{exact:true}).fill('I eat breakfast.');await p.getByRole('button',{name:'문장을 완성했어요',exact:false}).click();await saved();await p.getByRole('heading',{name:'오늘의 기록을 남겼어요.',exact:true}).waitFor();await goal(10);await p.getByRole('button',{name:'추가 7개 학습하기',exact:true}).waitFor();
  checks.push('raising the goal from the just-finished summary returns to the home with the add-seven action');
  await p.getByRole('button',{name:'오늘 단어 다시 학습',exact:true}).click();await saved();await goal(1);
  await p.getByLabel('오늘 공부할 뜻',{exact:false}).fill('진행 중인 재학습의 임시 뜻');await goal(10);
  assert.equal(await p.getByLabel('오늘 공부할 뜻',{exact:false}).inputValue(),'진행 중인 재학습의 임시 뜻');
  checks.push('raising the goal during optional repeat study keeps its current screen and unsaved input');
  assert.deepEqual(errors,[]);const result={passed:true,checks,browserErrors:errors,saveEvents};fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){
  // Capture failures outside saved(), including a disabled grading button.
  fs.writeFileSync(out+'/interaction-failure.json',JSON.stringify({checks,saveEvents,browserErrors:errors,error:String(error),status:p?await p.locator('.save-state').innerText():null,alerts:p?await p.getByRole('alert').allTextContents():[],stage:p?await p.locator('.session-step-row').allTextContents():[],answer:p?await p.locator('#recall-answer').inputValue().catch(()=>null):null,hint:p?await p.getByText('답을 먼저 확인했으므로 이번 결과는 ‘도움 필요’로 기록해요.').count():null},null,2));
  if(p)await p.screenshot({path:out+'/interaction-failure.png'});throw error;
 }finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exit(1)});
