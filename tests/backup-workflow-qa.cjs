// Backup UI lifecycle and cross-device consistency; only synthetic local accounts.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {launchBrowser,closeBrowser,base,accountHeaders,waitForWorker,axePath}=require('./qa/runtime.cjs');
const {history}=require('./fixtures/backup-history.cjs');
const words=JSON.parse(fs.readFileSync('data/words.json','utf8'));
const out='outputs/backup-workflow';fs.mkdirSync(out,{recursive:true});
(async()=>{
 await waitForWorker();const browser=await launchBrowser(),checks=[],errors=[];
 try{
 const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:accountHeaders('restore_workflow')});
 await c.route('**/api/study-clock',r=>r.fulfill({json:{serverTime:Date.now()}}));
 const get=async()=>{const r=await c.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json();};
 const put=async(payload)=>{const r=await c.request.put(base+'/api/state',{data:payload});assert.equal(r.status(),200,await r.text());};
 const state=history(2),session=Object.values(state.sessions)[0],wid=session.ids[0];
 session.stage='ko';session.finished=false;session.records[wid].ko='unmeasured';session.records[wid].sentenceStatus='unmeasured';session.records[wid].draft={answer:'partly typed',revealed:false,hinted:false,stage:'ko',retry:false};state.settings.activeSessionId=session.id;
 const raw=JSON.stringify({format:'haru-words-v1',exportedAt:'2026-09-24T00:00:00.000Z',state});
 const initial=await get();const seed=await c.request.post(base+'/api/state/restore',{headers:{'x-study-revision':String(initial.revision),'Content-Type':'application/json'},data:raw});assert.equal(seed.status(),200,await seed.text());
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));let downloads=0,deletes=0,commits=0;p.on('download',()=>downloads++);p.on('request',r=>{if(r.method()==='DELETE')deletes++;if(r.url().endsWith('/commit'))commits++;});
 const saved=()=>p.getByText('서버에 저장됨',{exact:true}).waitFor();
 const open=async()=>{await p.getByRole('tab',{name:'학습 기록',exact:true}).click();await p.getByRole('button',{name:'기록 관리',exact:true}).click();await p.getByRole('menuitem',{name:'백업 가져오기',exact:true}).click();await p.locator('[data-backup-step]').filter({hasText:'1/6'}).waitFor();};
 const select=async()=>{await p.waitForFunction(()=>document.querySelector('input[type=file]')&&!document.querySelector('input[type=file]').disabled);await p.locator('input[type=file]').setInputFiles({name:'any-name.json',mimeType:'application/json',buffer:Buffer.from(raw)});await p.locator('[data-safety-preview]').filter({hasText:'복원 가능'}).waitFor();};
 const safety=async()=>{const download=p.waitForEvent('download');await p.getByRole('button',{name:'현재 기록 먼저 백업받기',exact:true}).focus();await p.keyboard.press('Enter');await download;await p.getByRole('checkbox').focus();await p.keyboard.press('Space');};
 const prepare=()=>p.getByRole('button',{name:'이 백업으로 복원',exact:true}).click();
 await p.goto(base);await saved();await open();await select();assert.equal(downloads,0);assert.match(await p.locator('[data-safety-preview]').innerText(),/MB.*단어.*회차.*복원 가능/);assert.match(await p.locator('[data-backup-step]').innerText(),/2\/6/);
 // At 200% text size the body can scroll, while close/action and keyboard focus stay usable.
 for(const width of [320,390,1440])for(const fontSize of ['16px','32px']){
  await p.setViewportSize({width,height:844});await p.evaluate(size=>document.documentElement.style.fontSize=size,fontSize);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await p.locator('.dialog-scroll').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  assert.equal(await p.locator('.dialog-actions').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}),true);
 }
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>document.documentElement.style.fontSize='16px');
 await safety();for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>!!document.activeElement.closest('[role=dialog]')),true);}
 await p.addScriptTag({path:axePath});assert.deepEqual(await p.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)),[]);
 checks.push('safety size/count/restorability precede downloading; keyboard download/acknowledgment, focus trap, 200% text and 320–1440 px work');
 // Another device changes the revision after safety approval, before creating a job.
 let current=await get();await put({revision:current.revision,settings:{...current.state.settings,dailyGoal:4},progress:{},sessions:{}});await prepare();await p.getByRole('button',{name:'서버 기록 확인하기',exact:true}).waitFor();assert.match(await p.locator('[data-backup-step]').innerText(),/최신 기록/);assert.equal(await p.getByRole('alertdialog').count(),0);await p.getByRole('button',{name:'서버 기록 확인하기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await get()).state.settings.dailyGoal,4);
 // A revision change after upload must also discard only obsolete staging and reload.
 await open();await select();await safety();let altered=false;
 await p.route('**/api/state/restore/jobs/*/chunks/*',async route=>{await p.locator('[data-backup-step]').filter({hasText:'3/6'}).waitFor();await route.continue();});
 await p.route('**/api/state/restore/jobs/*/validate',async route=>{await p.locator('[data-backup-step]').filter({hasText:'4/6'}).waitFor();if(!altered){altered=true;const now=await get();await put({revision:now.revision,settings:{...now.state.settings,dailyGoal:6},progress:{},sessions:{}});}await route.continue();});
 await prepare();await p.getByRole('button',{name:'서버 기록 확인하기',exact:true}).waitFor();await p.getByRole('button',{name:'서버 기록 확인하기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await p.unroute('**/api/state/restore/jobs/*/validate');assert.equal((await get()).state.settings.dailyGoal,6);assert.equal((await(await c.request.get(base+'/api/state/restore/jobs')).json()).job,null);
 checks.push('revision conflicts before and after upload lead to a fresh server snapshot and discard obsolete staging only');
 // Force both the commit response and receipt lookup to fail: cancellation is forbidden until reload.
 await open();await select();await safety();await prepare();const deleteBefore=deletes;
 await p.route('**/api/state/restore/jobs/*/commit',async route=>{const response=await route.fetch();assert.equal(response.status(),200);await route.abort('failed');});
 await p.route(/\/api\/state\/restore\/jobs\/[^/]+$/,route=>route.abort('failed'));
 await p.getByRole('button',{name:'기록 교체 · 복원',exact:true}).click();await p.getByRole('button',{name:'서버 기록 확인하기',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'기존 복원 작업 취소'}).isDisabled(),true);assert.equal(deletes,deleteBefore);await p.getByRole('button',{name:'서버 기록 확인하기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual((await get()).state,state);assert.equal(commits,1);await p.unroute('**/api/state/restore/jobs/*/commit');await p.unroute(/\/api\/state\/restore\/jobs\/[^/]+$/);
 checks.push('an uncertain commit disables cancellation/replacement; server reload confirms the saved result without another commit');
 // A later save between commit and reload must win over the uploaded snapshot.
 await open();await select();await safety();await prepare();const extra=words.find(w=>!state.progress[w.id]).id;
 await p.route('**/api/state/restore/jobs/*/commit',async route=>{const response=await route.fetch();assert.equal(response.status(),200);const now=await get();await put({revision:now.revision,progress:{[extra]:{notes:'saved after commit'}},sessions:{}});await route.fulfill({response});});
 await p.getByRole('button',{name:'기록 교체 · 복원',exact:true}).click();await p.getByRole('heading',{name:'백업을 복원했어요.',exact:true}).waitFor();assert.match(await p.getByRole('dialog').innerText(),/21개 단어 기록/);assert.equal((await get()).state.progress[extra].notes,'saved after commit');assert.deepEqual((await get()).state.sessions,state.sessions);assert.match(await p.locator('[data-backup-step]').innerText(),/6\/6/);
 checks.push('post-commit saves are included in the reloaded state and success counts; sentences, scores, settings and incomplete drafts survive');
 await p.screenshot({path:out+'/complete-mobile.png'});assert.deepEqual(errors,[]);const result={passed:true,checks,errors};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1});
