import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { request as httpRequest } from 'node:http';
import { PROJECT_ROOT, readDashboardSnapshot, normalizeDashboard, renderDashboard, buildDashboard } from './openai-dashboard-data.mjs';
import { createDashboardServer } from './serve-openai-dashboard.mjs';

const require = createRequire(import.meta.url);
const checks = [], browsers = [], errors = [];
const output = resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/qa');
await mkdir(output,{recursive:true});
const actualPaths = ['.taskmaster/tasks/tasks.json','.taskmaster/docs/openai-migration-manifest.json','README.md','package.json','package-lock.json','.openai/hosting.json'];
const hashFiles = async () => Object.fromEntries(await Promise.all(actualPaths.map(async p=>[p,createHash('sha256').update(await readFile(resolve(PROJECT_ROOT,p))).digest('hex')])));
const before = await hashFiles();
const sourceTasks = JSON.parse(await readFile(resolve(PROJECT_ROOT,actualPaths[0]),'utf8'));
const manifest = JSON.parse(await readFile(resolve(PROJECT_ROOT,actualPaths[1]),'utf8'));
const fixtureParent = resolve(PROJECT_ROOT,'.sites-runtime'); await mkdir(fixtureParent,{recursive:true});
const fixture = await mkdtemp(join(fixtureParent,'task-dashboard-qa-'));
await mkdir(resolve(fixture,'.taskmaster/tasks'),{recursive:true});await mkdir(resolve(fixture,'.taskmaster/docs'),{recursive:true});
await writeFile(resolve(fixture,actualPaths[1]),JSON.stringify(manifest));
function initialTasks() {
  const data = structuredClone(sourceTasks);
  for(const task of data.master.tasks){const state=Number(task.id)>=12?'deferred':'pending';task.status=state;for(const s of task.subtasks||[])s.status=state;}
  return data;
}
const writeTasks = data => writeFile(resolve(fixture,actualPaths[0]), typeof data==='string'?data:JSON.stringify(data));
await writeTasks(initialTasks());
const {server} = createDashboardServer({projectRoot:fixture});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const base = 'http://127.0.0.1:'+server.address().port;
const passed = (name, detail) => {checks.push({name,passed:true,...(detail?{detail}:{})});console.log('PASS '+name);};
let playwright;
try {
  const real = await readDashboardSnapshot(PROJECT_ROOT,'openai-api-migration-2026-11-03'); assert.equal(real.tasks.length,15);assert.equal(real.tasks.flatMap(t=>t.subtasks).length,35);
  passed('actual Task Master source contains all 15 parents and 35 children');
  const html = await (await fetch(base)).text();assert.ok(html.includes('<html lang="ko">'));assert.ok(!html.includes('<!-- DASHBOARD_'));
  assert.equal((await fetch(base+'/api/tasks')).headers.get('cache-control'),'no-store');
  assert.equal((await fetch(base+'/api/tasks',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/tasks',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const wrongHostStatus=await new Promise((ok,fail)=>{const r=httpRequest(base+'/api/tasks',{headers:{Host:'untrusted.example'}},response=>{response.resume();ok(response.statusCode);});r.on('error',fail);r.end();});
  assert.equal(wrongHostStatus,403);
  for(const path of ['/.env','/.taskmaster/tasks/tasks.json','/..%2F..%2F.env','/api/write'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base,{method:'HEAD'})).status,200);
  passed('HTTP server is loopback-only, read-only, origin/host guarded, and exposes no arbitrary files');
  const malicious = structuredClone(real);malicious.tasks[0].title='</script><img src=x onerror="window.dashboardAttack=1">';
  const safe = await renderDashboard(malicious);assert.ok(!safe.includes(malicious.tasks[0].title));assert.ok(safe.includes('\\u003c/script>'));
  assert.throws(()=>normalizeDashboard({master:{tasks:[{...real.tasks[0],id:'<script>'}]}},manifest));
  passed('embedded snapshot and identifiers reject executable task content');
  playwright = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
  for(const engine of ['chromium','webkit']) {
    await writeTasks(initialTasks());
    const browser = await playwright[engine].launch({headless:true});browsers.push(browser);
    const context = await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
    const page = await context.newPage();page.setDefaultTimeout(10000);
    const external=[];page.on('pageerror',e=>errors.push(engine+': '+e.message));
    page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url());});
    await page.goto(base);await page.locator('.task').last().waitFor();
    assert.equal(await page.locator('.task').count(),15);assert.equal(await page.locator('#leaf-total').textContent(),'35');
    assert.equal(await page.locator('#overall-percent').textContent(),'0');assert.equal(await page.locator('#ready-count').textContent(),'1');assert.equal(await page.locator('#waiting-count').textContent(),'10');
    await page.locator('[data-phase="2"]').click();assert.equal(await page.locator('.task').count(),4);
    await page.locator('#reset').click();await page.locator('#status-filter').selectOption('ready');assert.equal(await page.locator('.task').count(),1);
    await page.locator('#status-filter').selectOption('waiting');assert.equal(await page.locator('.task').count(),10);
    await page.locator('#reset').click();await page.locator('#expand-all').click();assert.equal(await page.locator('.subtask:visible').count(),35);
    await page.locator('#expand-all').click();assert.equal(await page.locator('.subtask:visible').count(),0);
    await page.getByRole('searchbox',{name:'작업 검색'}).fill('4.3');assert.equal(await page.locator('.task').count(),1);assert.equal(await page.locator('#task-4').getAttribute('open'),'');
    await page.locator('#task-4').getByRole('button',{name:'선행 작업 3 보기',exact:true}).click();assert.equal(await page.locator('.task').count(),15);assert.equal(await page.locator('#task-3').getAttribute('open'),'');
    await page.getByRole('searchbox',{name:'작업 검색'}).fill('존재하지않는작업zzz');assert.equal(await page.locator('#empty-state').isVisible(),true);
    await page.locator('#empty-reset').click();
    await page.locator('#task-1>summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#task-1').getAttribute('open'),'');
    passed(engine+': phase/status/search, exact subtask ID, expand/collapse, dependency jump, empty state and keyboard');

    const advancing=initialTasks(),first=advancing.master.tasks[0];first.status='in-progress';first.subtasks[0].status='done';first.subtasks[1].status='in-progress';
    await writeTasks(advancing);await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('overall-percent').textContent==='3');
    assert.equal(await page.locator('#leaf-done').textContent(),'1');assert.equal(await page.locator('#leaf-running').textContent(),'1');
    assert.equal(await page.locator('#parent-done').textContent(),'0');assert.equal(await page.locator('#task-3').getAttribute('open'),'');
    await writeTasks('{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});
    assert.equal(await page.locator('#overall-percent').textContent(),'3');
    first.status='done';first.subtasks.forEach(s=>s.status='done');await writeTasks(advancing);
    await page.waitForFunction(()=>document.getElementById('overall-percent').textContent==='6',{},{timeout:9000});
    assert.equal(await page.locator('#data-warning').isVisible(),false);assert.equal(await page.locator('#ready-count').textContent(),'1');
    assert.equal(await page.locator('#next-task .task-number').textContent(),'#2');
    advancing.master.tasks[1].status='done';await writeTasks(advancing);await page.locator('#refresh').click();await page.locator('#integrity-warning').waitFor({state:'visible'});
    assert.equal(await page.locator('#overall-percent').textContent(),'6');
    passed(engine+': live refresh, 1/35 progress, stale source retention/recovery, next dependency and inconsistent parent warning');

    const imported=structuredClone(advancing);imported.master.tasks[1].status='pending';imported.master.tasks[1].title='<img src=x onerror="window.dashboardAttack=1">';
    await page.locator('#import-file').setInputFiles({name:'tasks.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction(()=>document.getElementById('connection-mode').textContent==='불러온 JSON 사본');
    assert.equal(await page.locator('#task-2 .task-name').textContent(),imported.master.tasks[1].title);assert.equal(await page.locator('img').count(),0);
    assert.equal(await page.evaluate(()=>window.dashboardAttack),undefined);
    await writeTasks(initialTasks());await page.waitForTimeout(5200);assert.equal(await page.locator('#overall-percent').textContent(),'6');
    await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('overall-percent').textContent==='0');
    await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
    await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('.task').count(),15);
    await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'hidden'});
    passed(engine+': JSON import pauses polling, escapes task text, resumes live data and preserves state on invalid import');

    const complete=initialTasks();for(const t of complete.master.tasks){t.status='done';for(const s of t.subtasks)s.status='done';}
    const held=structuredClone(manifest),heldGate=held.gates.find(g=>g.id==='G4');heldGate.result={status:'held',detail:'품질 미실측 · <img src=x onerror="window.dashboardAttack=1">'};
    await writeFile(resolve(fixture,actualPaths[1]),JSON.stringify(held));await writeTasks(complete);await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.getElementById('overall-percent').textContent==='100');
    assert.equal(await page.locator('[data-gate="G4"] [data-gate-result]').textContent(),'활성화 보류');
    assert.equal(await page.locator('[data-gate="G4"] [data-gate-detail]').textContent(),heldGate.result.detail);
    assert.equal(await page.locator('[data-gate="G4"] img').count(),0);assert.equal(await page.evaluate(()=>window.dashboardAttack),undefined);
    await page.setViewportSize({width:320,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='28px');
    const completeLayout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,6).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right}))}));
    assert.equal(completeLayout.overflow,false,engine+' complete layout: '+JSON.stringify(completeLayout));
    await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:1440,height:1050});
    await writeFile(resolve(fixture,actualPaths[1]),JSON.stringify(manifest));await writeTasks(initialTasks());await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.getElementById('overall-percent').textContent==='0');
    passed(engine+': all 35 implementation tasks can finish while quality activation stays held; evidence text is escaped; 100 percent fits 320px/200 percent text');

    for(const width of [320,390,768,1440])for(const scale of [1,2]){
      await page.setViewportSize({width,height:1000});await page.evaluate(scale=>document.documentElement.style.fontSize=(14*scale)+'px',scale);
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,6).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,60),right:e.getBoundingClientRect().right}))}));
      if(layout.overflow){await page.screenshot({path:resolve(output,'overflow-'+engine+'-'+width+'-'+scale+'.png'),fullPage:true});assert.fail(engine+' layout '+width+'/'+scale+': '+JSON.stringify(layout));}
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:1440,height:1050});
    await page.screenshot({path:resolve(output,'desktop-'+engine+'.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'mobile-'+engine+'.png'),fullPage:true});
    passed(engine+': 320/390/768/1440 widths at 100/200 percent text, no horizontal overflow');
    if(process.env.AXE_CORE_PATH){await page.addScriptTag({path:process.env.AXE_CORE_PATH});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));await writeFile(resolve(output,'axe-'+engine+'.json'),JSON.stringify(violations,null,2));assert.deepEqual(violations,[]);passed(engine+': axe WCAG A/AA checks');}
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    await context.close();await browser.close();
  }
  await buildDashboard();
  const browser=await playwright.chromium.launch({headless:true});browsers.push(browser);
  const page=await browser.newPage();await page.goto(pathToFileURL(resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/index.html')).href+'?plan=openai-api-migration-2026-11-03');await page.locator('.task').last().waitFor();
  assert.equal(await page.locator('#connection-mode').textContent(),'저장된 HTML 사본');assert.equal(await page.locator('.task').count(),15);
  await browser.close();passed('standalone HTML opens from disk with current snapshot and explicit snapshot label');
  assert.deepEqual(await hashFiles(),before);passed('Task Master tasks, manifest and application files remain byte-identical');
} catch(error) {checks.push({name:'failure',passed:false,detail:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1;}
finally {
  for(const browser of browsers)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
  const report={passed:!checks.some(c=>!c.passed),checks,errors,scope:'Local dashboard only; task source not edited; no AI or production data calls.'};
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.length,errors}));
}
