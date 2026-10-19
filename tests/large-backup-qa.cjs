// Local Worker only: actual 5-year synthetic records, no production account.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('esbuild');
const {launchBrowser,closeBrowser,base,accountHeaders,waitForWorker,axePath}=require('./qa/runtime.cjs');
const {history,emptyState}=require('./fixtures/backup-history.cjs');
const out='outputs/large-backup';fs.mkdirSync(out,{recursive:true});
const envelope=state=>JSON.stringify({format:'haru-words-v1',exportedAt:'2026-09-24T00:00:00.000Z',state});
(async()=>{
 await waitForWorker();await build({entryPoints:['lib/backup-analysis.ts'],outfile:'work/large-qa-analysis.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
 const {analyzeBackup}=await import('../work/large-qa-analysis.mjs');
 const browser=await launchBrowser(),checks=[],errors=[],timings={};
 try{
  const c=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:accountHeaders('large_backup')});
  await c.addInitScript(()=>{const NativeWorker=window.Worker;window.backupWorkerTicks=[];window.Worker=class extends NativeWorker{postMessage(task,...rest){if(task?.kind==='import'){const sample={ticks:0};window.backupWorkerTicks.push(sample);const timer=setInterval(()=>sample.ticks++,10);this.addEventListener('message',()=>clearInterval(timer),{once:true});}return super.postMessage(task,...rest);}};});
  // Clock failure/retry has its own suites; keep this backup fault-injection scope deterministic.
  await c.route('**/api/study-clock',r=>r.fulfill({json:{serverTime:Date.now()}}));
  const get=async()=>{const r=await c.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json();};
  const initial=history(730),incoming=history(1825),fileRaw=JSON.stringify(JSON.parse(envelope(incoming)),null,2);assert.ok(Buffer.byteLength(fileRaw)>18_000_000);
  const first=await get();const seed=await c.request.post(base+'/api/state/restore',{headers:{'x-study-revision':String(first.revision)},data:JSON.parse(envelope(initial))});assert.equal(seed.status(),200,await seed.text());
  assert.equal((await (await c.request.get(base+'/api/state/restore')).json()).maxBytes,20_000_000);
  const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));const uploaded=[];
  page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/chunks/'))uploaded.push(Number(r.url().split('/').at(-1)));});
  const saved=()=>page.getByText('저장됨',{exact:true}).waitFor();
  const open=async()=>{await page.getByRole('tab',{name:'학습 기록',exact:true}).click();await page.getByRole('button',{name:'기록 관리',exact:true}).click();await page.getByRole('menuitem',{name:'백업으로 복원',exact:true}).click().catch(async e=>{fs.writeFileSync(out+'/open-failure.json',JSON.stringify({errors,body:await page.locator('body').innerText()}));throw e;});await page.getByRole('dialog').waitFor();};
  const select=async(text=fileRaw,name='history.json')=>{await page.waitForFunction(()=>document.querySelector('input[type=file]')&&!document.querySelector('input[type=file]').disabled);await page.locator('input[type=file]').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});await page.getByRole('table',{name:'현재 기록과 복원할 기록'}).waitFor().catch(async e=>{fs.writeFileSync(out+'/failure.json',JSON.stringify({errors,body:await page.locator('body').innerText()}));throw e;});};
  const safety=async()=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'현재 기록 먼저 백업받기',exact:true}).click();const raw=fs.readFileSync(await (await event).path(),'utf8');await page.getByRole('checkbox').check();return raw;};
  const prepare=()=>page.getByRole('button',{name:'이 백업으로 복원',exact:true}).click();
  await page.goto(base);await saved();await open();let start=Date.now();await select();timings.importPreviewMs=Date.now()-start;
  assert.match(await page.getByRole('dialog').innerText(),/최대 20 MB/);assert.ok(await page.evaluate(()=>window.backupWorkerTicks[0].ticks>0),'main-thread timers continue while the import Worker checks 18 MB');const recovery=await safety();assert.deepEqual(JSON.parse(recovery).state,{...initial,grammar:{}});
  await page.route('**/api/state/restore/jobs/*/chunks/1',r=>r.abort('failed'));await prepare();await page.getByRole('alert').filter({hasText:'연결이 끊기거나'}).waitFor();
  const pending=(await (await c.request.get(base+'/api/state/restore/jobs')).json()).job;assert.deepEqual(pending.received,[0]);assert.deepEqual((await get()).state,initial);
  await page.unroute('**/api/state/restore/jobs/*/chunks/1');await page.reload();await saved();await open();await page.getByText('이어서 할 복원 · 전송 1/'+pending.total,{exact:true}).waitFor();await select(fileRaw,'renamed-history.json');await safety();
  start=Date.now();await prepare();await page.getByRole('alertdialog').waitFor();timings.resumeAndValidationMs=Date.now()-start;
  assert.equal(uploaded.filter(i=>i===0).length,1);assert.deepEqual((await get()).state,initial);
  checks.push('18 MB+ file imports in a Web Worker; lost upload resumes after reload with a renamed identical file without resending part 0 or changing current records');
  let commits=0;await page.route('**/api/state/restore/jobs/*/commit',async r=>{commits++;const response=await r.fetch();assert.equal(response.status(),200);await r.abort('failed');});
  const before=await get();start=Date.now();await page.getByRole('button',{name:'기록 교체 · 복원',exact:true}).click();await page.getByRole('heading',{name:'백업을 복원했어요.',exact:true}).waitFor();timings.commitAndReloadMs=Date.now()-start;
  const after=await get();assert.equal(after.revision,before.revision+1);assert.deepEqual(after.state,incoming);assert.equal(commits,1);await page.unroute('**/api/state/restore/jobs/*/commit');
  await page.getByRole('button',{name:'학습 기록 확인하기',exact:true}).click();await page.reload();await saved();assert.deepEqual((await get()).state,incoming);
  checks.push('lost commit response reconciles the durable receipt; one commit, one revision increment, and all 18,250 results survive reload');
  // Ordinary export is reviewed before downloading and is itself restorable.
  await page.getByRole('tab',{name:'학습 기록',exact:true}).click();await page.getByRole('button',{name:'기록 관리',exact:true}).click();await page.getByRole('menuitem',{name:'전체 백업',exact:true}).click();
  await page.getByText('현재 앱에서 복원 가능한 백업이에요.',{exact:true}).waitFor();const download=page.waitForEvent('download');await page.getByRole('button',{name:'백업 파일 다운로드',exact:true}).click();const exported=fs.readFileSync(await (await download).path(),'utf8');assert.deepEqual((await analyzeBackup(exported)).parsed.state,{...incoming,grammar:{}});
  checks.push('whole-export preview reports size and validates all 1,825 sessions before download');
  await open();await select(recovery);await safety();await prepare();await page.getByRole('alertdialog').getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('alertdialog').waitFor({state:'hidden'});assert.match(await page.locator('[data-backup-step]').innerText(),/5\/6/);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.dialog-scroll').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);}
  await page.setViewportSize({width:390,height:844});await page.locator('[data-slot=alert-dialog-overlay]').waitFor({state:'detached'});await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.addScriptTag({path:axePath});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))})));fs.writeFileSync(out+'/accessibility.json',JSON.stringify(violations,null,2));assert.deepEqual(violations,[]);await page.screenshot({path:out+'/restore-mobile.png'});
  const cancelJob=page.getByRole('button',{name:'기존 복원 작업 취소'});
  await cancelJob.click();await cancelJob.waitFor({state:'hidden'});
  assert.equal((await (await c.request.get(base+'/api/state/restore/jobs')).json()).job,null);assert.deepEqual((await get()).state,incoming);
  checks.push('cancel removes staging only; narrow/desktop layouts and automated accessibility pass');
  // Replacing with the original safety copy restores the whole previous history.
  await prepare();await page.getByRole('button',{name:'기록 교체 · 복원',exact:true}).click();await page.getByRole('heading',{name:'백업을 복원했어요.',exact:true}).waitFor();assert.deepEqual((await get()).state,initial);
  checks.push('the pre-replacement safety copy restores every original record through the same job pipeline');
  // Near-limit content, not whitespace padding: prove real storage and reload work.
  const boundary=structuredClone(incoming),budget=19_950_000-Buffer.byteLength(envelope(boundary));let remaining=budget;
  for(const p of Object.values(boundary.progress)){const n=Math.min(1900,Math.floor((remaining-11)/3));if(n<=0)break;p.notes='가'.repeat(n);remaining-=n*3+11;}
  const boundaryRaw=envelope(boundary);assert.ok(Buffer.byteLength(boundaryRaw)>19_900_000);assert.ok(Buffer.byteLength(boundaryRaw)<=20_000_000);
  const boundaryData=await analyzeBackup(boundaryRaw),bc=await browser.newContext({extraHTTPHeaders:accountHeaders('large_boundary')});
  const revision=(await (await bc.request.get(base+'/api/state')).json()).revision;
  const post=async(path,data)=>{const r=await bc.request.post(base+path,{headers:{'Content-Type':'application/json'},data});assert.equal(r.status(),200,await r.text());return r.json();};
  start=Date.now();let bj=await post('/api/state/restore/jobs',{revision,manifest:boundaryData.manifest});
  for(let i=0;i<boundaryData.parts.length;i++){const r=await bc.request.put(base+'/api/state/restore/jobs/'+bj.id+'/chunks/'+i,{headers:{'Content-Type':'application/json'},data:boundaryData.parts[i]});assert.equal(r.status(),200,await r.text());}
  while(bj.status!=='ready')bj=await post('/api/state/restore/jobs/'+bj.id+'/validate');
  await post('/api/state/restore/jobs/'+bj.id+'/commit');const boundResponse=await bc.request.get(base+'/api/state');assert.equal(boundResponse.status(),200);assert.deepEqual((await boundResponse.json()).state,boundary);
  timings.near20MbRestoreAndLoadMs=Date.now()-start;
  const capacitySnapshot=await (await bc.request.get(base+'/api/state')).json();start=Date.now();
  const capacitySave=await bc.request.put(base+'/api/state',{data:{revision:capacitySnapshot.revision,settings:{...capacitySnapshot.state.settings,dailyGoal:4},progress:{},sessions:{}}});
  assert.equal(capacitySave.status(),200,await capacitySave.text());timings.near20MbSaveMs=Date.now()-start;
  const bp=await bc.newPage();await bp.goto(base);await bp.getByText('저장됨',{exact:true}).waitFor();await bp.getByRole('tab',{name:'학습 기록',exact:true}).click();await bp.getByRole('button',{name:'기록 관리',exact:true}).waitFor();await bc.close();
  checks.push('19.9 MB of real record content commits, loads, and renders against the local Worker');
  // API authorization/limits are verified against actual handlers, not UI controls.
  const other=await browser.newContext({extraHTTPHeaders:accountHeaders('large_other')});assert.equal((await other.request.get(base+'/api/state/restore/jobs/'+pending.id)).status(),404);await other.close();
  const invalid=await c.request.post(base+'/api/state/restore/jobs',{data:{revision:0,manifest:{}}});assert.equal(invalid.status(),400,await invalid.text());
  const denied=await c.request.post(base+'/api/state/restore/jobs',{headers:{origin:'https://other.example'},data:{}});assert.equal(denied.status(),403);
  checks.push('actual job routes reject other accounts, cross-origin mutations, and invalid manifests');
  assert.deepEqual(errors,[]);const result={passed:true,checks,timings,fileBytes:Buffer.byteLength(fileRaw),exportBytes:Buffer.byteLength(exported),errors};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
