const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const assert=require('node:assert/strict');const fs=require('node:fs');
const words=JSON.parse(fs.readFileSync('data/words.json','utf8'));
const base=require('./qa/runtime.cjs').base,out='outputs/daily-goal';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await launchBrowser({headless:true});const checks=[],errors=[];
 try{
  const headers={'oai-authenticated-user-id':require('./qa/runtime.cjs').account('goal_'),'oai-authenticated-user-email':'goal@example.test'};
  const ctx=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:390,height:844}});
  const get=async()=> (await ctx.request.get(base+'/api/state')).json();let data=await get();
  const sample=words.filter(w=>w.level==='A1').slice(0,20).map(w=>w.id);
  const progress=Object.fromEntries(words.filter(w=>w.level==='A1').slice(0,90).map(w=>[w.id,{familiarity:'uncertain'}]));
  const settings={...data.state.settings,assessments:{A1:{ids:sample,index:20,marks:Object.fromEntries(sample.map(id=>[id,'uncertain'])),completed:true}}};
  assert.equal((await ctx.request.put(base+'/api/state',{data:{revision:data.revision,settings,progress,sessions:{}}})).status(),200);
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));const saved=()=>p.getByText('저장됨',{exact:true}).waitFor();
  await p.goto(base);await saved();
  for(const goal of [1,5,10]){
   await p.getByRole('button',{name:'학습 설정',exact:true}).click();await p.getByRole('combobox',{name:'하루 목표',exact:true}).click();
   assert.equal(await p.getByRole('option').count(),10);
   await p.getByRole('option',{name:goal+'개',exact:true}).click();await saved();assert.equal((await get()).state.settings.dailyGoal,goal);
   if(goal===10)await p.screenshot({path:out+'/settings-10.png',animations:'disabled'});
   await p.getByRole('button',{name:'닫기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(await p.locator('.today-words>.today-word-row').count(),goal);
  }
  await p.reload();await saved();assert.equal((await get()).state.settings.dailyGoal,10);assert.equal(await p.locator('.today-word-number').last().innerText(),'10');
  checks.push('settings exposes all 1–10 choices; 1, 5 and 10 persist and the home displays the entire selected list');
  await p.setViewportSize({width:320,height:740});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.setViewportSize({width:390,height:844});
  await p.getByRole('button',{name:'오늘의 학습 시작',exact:true}).click();await saved();
  data=await get();let session=data.state.sessions[data.state.settings.activeSessionId];const sid=session.id;
  assert.equal(session.ids.length,10);assert.equal(Object.keys(session.records).length,10);
  for(let i=0;i<10;i++){await p.getByRole('button',{name:'뜻 저장하고 계속',exact:false}).click();await saved();}
  await p.getByRole('heading',{name:'영어 → 뜻',exact:true}).waitFor();
  await p.getByLabel('한국어 뜻 입력',{exact:true}).fill('열 단어 학습의 임시 답');await p.getByRole('button',{name:'저장하고 나가기',exact:true}).click();await saved();
  session=(await get()).state.sessions[sid];assert.equal(session.ids.length,10);assert.equal(session.records[session.ids[0]].draft.answer,'열 단어 학습의 임시 답');
  checks.push('a new daily session contains ten records and advances through all ten learning cards before recall; pausing saves the draft');
  await p.getByRole('button',{name:'학습 홈으로',exact:false}).click();await p.getByRole('button',{name:'학습 설정',exact:true}).click();
  await p.getByRole('combobox',{name:'하루 목표',exact:true}).click();await p.getByRole('option',{name:'1개',exact:true}).click();await saved();await p.getByRole('button',{name:'닫기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
  assert.deepEqual((await get()).state.sessions[sid],session);assert.equal(await p.locator('.today-words>.today-word-row').count(),10);
  const device=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:1366,height:1000}});const second=await device.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(base);await second.getByText('저장됨',{exact:true}).waitFor();await second.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await second.getByText('저장됨',{exact:true}).waitFor();assert.equal(await second.getByLabel('한국어 뜻 입력',{exact:true}).inputValue(),'열 단어 학습의 임시 답');assert.equal((await get()).state.sessions[sid].ids.length,10);
  checks.push('lowering the next goal to one keeps the existing ten-word session and another device resumes the same draft');
  const before=await get();
  for(const goal of [0,11,1.5])assert.equal((await ctx.request.put(base+'/api/state',{data:{revision:before.revision,settings:{...before.state.settings,dailyGoal:goal},progress:{},sessions:{}}})).status(),400);
  const extra=words.find(w=>!session.ids.includes(w.id));const oversized={...session,ids:[...session.ids,extra.id],records:{...session.records,[extra.id]:{meaning:'테스트',en:'unmeasured',ko:'unmeasured',sentenceStatus:'unmeasured',sentence:'',notes:''}}};
  assert.equal((await ctx.request.put(base+'/api/state',{data:{revision:before.revision,progress:{},sessions:{[sid]:oversized}}})).status(),400);assert.deepEqual(await get(),before);
  checks.push('the server rejects zero, eleven, fractional goals and an eleven-word daily session without changing stored records');
  assert.deepEqual(errors,[]);const result={passed:true,checks,browserErrors:errors};fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exit(1)});
