const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8787',out='outputs/review-calendar';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch();const checks=[],errors=[];try{
 const c=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'oai-authenticated-user-id':'calendar_'+Date.now(),'oai-authenticated-user-email':'qa@example.test'}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
 const get=async()=>(await c.request.get(base+'/api/state')).json();let data=await get();
 const sessions={},progress={};for(const [i,date] of ['2024-01-01','2025-12-31'].entries()){
  const w=words[i],id=crypto.randomUUID(),meaning=content[w.id].meaning;
  sessions[id]={id,kind:'daily',date,period:date,createdAt:date+'T00:00:00Z',ids:[w.id],warmupIds:[],stage:'done',index:0,records:{[w.id]:{entryId:w.id,meaning,learnedOn:date,material:content[w.id],en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Saved sentence.',notes:''}},retry:[],retryMode:false,elapsed:0,paused:true,finished:true};
  progress[w.id]={meaning,studyDates:[date],lastStudied:date,en:'independent',ko:'independent',sentenceStatus:'written'};
 }
 assert.equal((await c.request.put(base+'/api/state',{data:{revision:data.revision,progress,sessions}})).status(),200);
 const original=await get();await p.goto(base);await p.getByText('서버에 저장됨',{exact:true}).waitFor();await p.getByRole('tab',{name:'주간·월말 점검',exact:true}).click();
 const week=p.getByRole('combobox',{name:'주간 점검 기간',exact:true}),month=p.getByRole('combobox',{name:'월말 점검 기간',exact:true});
 await week.focus();await p.keyboard.press('End');await p.keyboard.press('Enter');
 assert.equal(await week.inputValue(),'2024-01-01');assert.equal(await p.locator('[data-review-kind=weekly] .review-count b').innerText(),'1');
 await week.click();await p.keyboard.press('Escape');assert.equal(await week.inputValue(),'2024-01-01');assert.ok(await week.evaluate(el=>el===document.activeElement));
 checks.push('native period selection supports keyboard End/Enter and Escape, keeps the selected oldest week and focus');
 await month.selectOption('2025-12');assert.equal(await month.inputValue(),'2025-12');assert.equal(await p.locator('[data-review-kind=monthly] .review-count b').innerText(),'1');
 await p.getByRole('tab',{name:'전체 단어장',exact:true}).click();await p.getByRole('tab',{name:'주간·월말 점검',exact:true}).click();assert.equal(await month.inputValue(),'2025-12');assert.equal(await week.inputValue(),'2024-01-01');
 checks.push('historical monthly targets and explicit period selections survive tab changes without modifying saved history');
 await p.addScriptTag({path:'work/axe/package/axe.min.js'});
 for(const control of [week,month]){
  await control.focus();await p.keyboard.press('Home');await p.keyboard.press('Enter');
  const result=await p.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.equal(result.violations.length,0,JSON.stringify(result.violations));
 }
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:out+'/historical-periods-mobile.png'});assert.deepEqual(await get(),original);assert.deepEqual(errors,[]);
 checks.push('both period selection states have zero axe violations; 390px layout fits and all interactions are read-only; OS picker UI is outside axe coverage');
 fs.writeFileSync(out+'/verification.json',JSON.stringify({passed:true,checks,axeStates:2,pageErrors:errors},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
