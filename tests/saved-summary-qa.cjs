// Real store + local API, synthetic users, held/failing saves, and a test-only WebMCP registrar.
const fs=require('node:fs'),assert=require('node:assert/strict'),{build}=require('esbuild');
const {base,accountHeaders,launchBrowser,closeBrowser,waitForWorker}=require('./qa/runtime.cjs');
const engine=process.env.QA_BROWSER||'chromium',out='outputs/saved-summary/'+engine;
const caps={'X-Study-AI-Contract':'4','X-Study-Grammar':'4','X-Study-Feedback-Structure':'1','X-Study-Sense-Keys':'1'};
const init=()=>{
 window.summaryTools=new Map();
 Object.defineProperty(document,'modelContext',{configurable:true,value:{registerTool(tool,{signal}){
  window.summaryTools.set(tool.name,tool);signal.addEventListener('abort',()=>{if(window.summaryTools.get(tool.name)===tool)window.summaryTools.delete(tool.name);},{once:true});
 }}});
};
const summary=page=>page.evaluate(()=>window.summaryTools.get('get_learning_summary').execute({}));
const wait=async condition=>{const end=Date.now()+10000;while(Date.now()<end){if(await condition())return;await new Promise(r=>setTimeout(r,20));}throw Error('Summary test condition did not settle');};
(async()=>{
 await waitForWorker();fs.mkdirSync(out,{recursive:true});const browser=await launchBrowser(),checks=[],errors=[];
 try{
  for(const status of [503,409,200]){
   const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{...accountHeaders('saved_summary'),...caps}});
   await context.addInitScript(init);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const read=async()=>{const r=await context.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json();};
   try{
    await page.goto(base);await page.locator('.topbar').getByText('저장됨',{exact:true}).waitFor();
    assert.equal((await summary(page)).dailyGoal,3);const before=await read();let held;
    await page.route('**/api/state',route=>route.request().method()==='PUT'?(held=route,undefined):route.continue());
    await page.getByRole('button',{name:'학습 설정',exact:true}).click();await page.getByRole('combobox',{name:'하루 목표',exact:true}).click();
    await page.getByRole('option',{name:'6개',exact:true}).click();await wait(()=>!!held);
    assert.equal((await summary(page)).dailyGoal,3,'pending optimistic input must not be described as saved');
    assert.match(await page.getByRole('combobox',{name:'하루 목표',exact:true}).innerText(),/6개/);
    if(status===200){await held.continue();await page.locator('.topbar').getByText('저장됨',{exact:true}).waitFor();}
    else{await held.fulfill({status,json:{error:'Synthetic summary save failure',...(status===409?{conflict:true}:{})}});await page.getByText('Synthetic summary save failure',{exact:true}).first().waitFor();}
    assert.equal((await summary(page)).dailyGoal,status===200?6:3);
    const after=await read();assert.equal(after.state.settings.dailyGoal,status===200?6:3);assert.equal(after.revision,before.revision+(status===200?1:0));
    assert.match(await page.getByRole('combobox',{name:'하루 목표',exact:true}).innerText(),/6개/,'failed input remains on screen');
    checks.push('pending and '+status+' save: confirmed summary/server agree while latest input is retained');
   }finally{await context.close();}
  }

  await build({entryPoints:['tests/saved-summary-harness.tsx'],outfile:'work/saved-summary-harness.js',bundle:true,format:'iife',platform:'browser',logLevel:'silent',define:{'process.env.NODE_ENV':'"development"'}});
  const context=await browser.newContext({extraHTTPHeaders:{...accountHeaders('summary_restore'),...caps}});await context.addInitScript(init);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const read=async()=>{const r=await context.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json();};
  let held;
  await page.route(base+'/',route=>route.fulfill({contentType:'text/html',body:'<html lang="ko"><body><div id="root"></div></body></html>'}));
  await page.route('**/api/state',route=>route.request().method()==='GET'?(held=route,undefined):route.continue());
  await page.goto(base);await page.addScriptTag({path:'work/saved-summary-harness.js'});await wait(()=>!!held);
  await page.waitForFunction(()=>window.summaryTools?.has('get_learning_summary'));
  assert.equal(await page.evaluate(()=>{try{window.summaryTools.get('get_learning_summary').execute({});return false;}catch{return true;}}),true,'unconfirmed defaults must not be described as saved');
  await held.continue();await page.waitForFunction(()=>!window.savedSummaryHarness.store.loading);
  await page.unroute('**/api/state');assert.equal((await summary(page)).dailyGoal,3);
  assert.equal(await page.evaluate(()=>{const copy=window.savedSummaryHarness.store.readSavedState();copy.settings.dailyGoal=10;return window.savedSummaryHarness.store.readSavedState().settings.dailyGoal;}),3,'read boundary must not expose a mutable saved reference');
  await page.getByRole('button',{name:'restore eight',exact:true}).click();await page.waitForFunction(()=>!window.savedSummaryHarness.store.restoring&&window.savedSummaryHarness.store.state.settings.dailyGoal===8);
  assert.equal((await summary(page)).dailyGoal,8);let stored=await read();assert.equal(stored.state.settings.dailyGoal,8);
  const write=await context.request.put(base+'/api/state',{data:{revision:stored.revision,settings:{...stored.state.settings,dailyGoal:4},progress:{},sessions:{}}});assert.equal(write.status(),200);
  held=null;await page.route('**/api/state',route=>route.request().method()==='GET'?(held=route,undefined):route.continue());
  await page.getByRole('button',{name:'read server',exact:true}).click();await wait(()=>!!held);assert.equal((await summary(page)).dailyGoal,8);
  await held.continue();await page.waitForFunction(()=>!window.savedSummaryHarness.store.loading&&window.savedSummaryHarness.store.state.settings.dailyGoal===4);await page.unroute('**/api/state');
  assert.equal((await summary(page)).dailyGoal,4);stored=await read();
  await page.route('**/api/state/restore',route=>route.fulfill({status:503,json:{error:'Synthetic restore failure'}}));
  await page.getByRole('button',{name:'restore eight',exact:true}).click();await page.waitForFunction(()=>window.savedSummaryHarness.store.conflict);
  assert.equal((await summary(page)).dailyGoal,4);assert.deepEqual(await read(),stored);
  checks.push('initial unknown/read/restore/reload/failure use only confirmed snapshots and expose immutable copies');
  const before=await read();let mutations=0;page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())&&new URL(r.url()).pathname.startsWith('/api/'))mutations++;});
  await page.evaluate(()=>window.summaryTools.get('show_learning_view').execute({view:'library'}));assert.equal(mutations,0);assert.deepEqual(await read(),before);
  await page.evaluate(()=>{window.retiredSummaryTool=window.summaryTools.get('get_learning_summary');window.savedSummaryHarness.unmount();});
  assert.equal(await page.evaluate(()=>{try{window.retiredSummaryTool.execute({});return false;}catch{return true;}}),true,'retired tool references must not reveal an old account snapshot');
  checks.push('tool navigation causes no save/generation/completion and aborted registrations reject retired callbacks');
  assert.deepEqual(errors,[]);await context.close();
  fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,engine,checks,pageErrors:errors,registration:'synthetic modelContext',realAiCalls:0},null,2));console.log(JSON.stringify({passed:true,engine,checks}));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
