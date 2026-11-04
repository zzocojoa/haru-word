import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { PROJECT_ROOT, readDashboardSnapshot } from './openai-dashboard-data.mjs';
import { createDashboardServer } from './serve-openai-dashboard.mjs';

const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const {runCase}=require(resolve(PROJECT_ROOT,'tests/qa/process.cjs'));
const NEW='integration-remediation-2026-11-04',MID='judgment-remediation-2026-11-03',OLD='openai-api-migration-2026-11-03';
const TAG='integration-remediation',out=resolve(PROJECT_ROOT,'outputs/integration-remediation-plan');
await mkdir(out,{recursive:true});
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=await readJson(resolve(PROJECT_ROOT,'.taskmaster/tasks/tasks.json'));
const registry=await readJson(resolve(PROJECT_ROOT,'.taskmaster/docs/dashboard-plans.json'));
const manifest=await readJson(resolve(PROJECT_ROOT,'.taskmaster/docs/integration-remediation-manifest.json'));
const preservation=await readJson(resolve(out,'preservation.json'));
const checks=[],commands=[],browsers=[];
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
const childCount=tasks=>tasks.reduce((n,t)=>n+t.subtasks.length,0);
const historicalHashes=()=>Object.fromEntries(Object.keys(preservation.oldTagHashes).map(k=>[k,hash(JSON.stringify(source[k]))]));
const protectedFiles=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest),'package.json','package-lock.json','.openai/hosting.json'];
const hashFiles=async()=>Object.fromEntries(await Promise.all(protectedFiles.map(async p=>[p,hash(await readFile(resolve(PROJECT_ROOT,p)))])));
const before=await hashFiles();
const fixture=await mkdtemp(join(resolve(PROJECT_ROOT,'.sites-runtime'),'integration-remediation-qa-'));
const files=[...protectedFiles,'README.md'];
for(const dir of ['dashboard','scripts'])for(const file of await readdir(resolve(PROJECT_ROOT,'.taskmaster',dir)))files.push('.taskmaster/'+dir+'/'+file);
for(const file of new Set(files)){await mkdir(dirname(resolve(fixture,file)),{recursive:true});await copyFile(resolve(PROJECT_ROOT,file),resolve(fixture,file));}
await mkdir(resolve(fixture,'outputs/judgment-remediation-v4-evaluation'),{recursive:true});
const {server}=createDashboardServer({projectRoot:fixture});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const local='http://127.0.0.1:'+server.address().port,actual='http://127.0.0.1:4318';
const fixtureTasks=resolve(fixture,'.taskmaster/tasks/tasks.json');
try{
  assert.equal(registry.defaultPlanId,NEW);assert.equal(registry.plans.length,3);
  assert.equal(manifest.planId,NEW);assert.equal(manifest.tag,TAG);
  assert.equal(manifest.executionStarted,false);assert.equal(manifest.authorization.implementationApproved,false);
  assert.equal(manifest.authorization.paidEvaluationApproved,false);assert.equal(manifest.authorization.deploymentIncludedAndApproved,false);
  assert.equal(source[TAG].tasks.length,12);assert.equal(childCount(source[TAG].tasks),41);
  const tasks=source[TAG].tasks,ids=new Set(tasks.map(t=>Number(t.id)));
  assert.equal(ids.size,12);
  const visiting=new Set(),visited=new Set();
  const visit=id=>{assert.ok(ids.has(id));assert.ok(!visiting.has(id),'Task dependency cycle');if(visited.has(id))return;visiting.add(id);for(const dep of tasks.find(t=>Number(t.id)===id).dependencies)visit(Number(dep));visiting.delete(id);visited.add(id);};
  for(const task of tasks){
    for(const key of ['title','description','details','testStrategy'])assert.ok(task[key]?.trim(),key);
    assert.ok(['high','medium','low'].includes(task.priority));
    assert.equal(task.status,Number(task.id)===12?'deferred':'pending');
    visit(Number(task.id));
    const childIds=new Set(task.subtasks.map(s=>Number(s.id)));assert.equal(childIds.size,task.subtasks.length);
    for(const child of task.subtasks){assert.ok(child.title&&child.description&&child.details);assert.equal(child.status,task.status);for(const dep of child.dependencies)assert.ok(childIds.has(Number(dep))&&Number(dep)<Number(child.id));}
  }
  assert.deepEqual(tasks.filter(t=>t.status==='pending'&&t.dependencies.length===0).map(t=>Number(t.id)),[1]);
  assert.deepEqual(manifest.tasks.map(t=>Number(t.id)),tasks.map(t=>Number(t.id)));
  for(const t of manifest.tasks)assert.equal(t.subtaskCount,tasks.find(x=>Number(x.id)===t.id).subtasks.length);
  for(const r of [...manifest.requirements,...manifest.gates])for(const id of r.tasks)assert.ok(ids.has(id));
  assert.equal(manifest.gates.at(-1).result.status,'held');
  pass('new12/41, required fields, pending/deferred, manifest mapping, acyclic dependencies and no implementation/payment/deployment approval');

  assert.deepEqual(historicalHashes(),preservation.oldTagHashes);
  for(const [p,h]of Object.entries(preservation.protectedFileHashes))assert.equal(hash(await readFile(resolve(PROJECT_ROOT,p))),h,p);
  for(const [p,h]of Object.entries(preservation.productFileHashes))assert.equal(hash(await readFile(resolve(PROJECT_ROOT,p))),h,p);
  const health=await(await fetch(actual+'/api/health')).json();assert.equal(health.projectKey,preservation.existingDashboard.projectKey);
  const live=await(await fetch(actual+'/api/tasks')).json(),direct=await readDashboardSnapshot(PROJECT_ROOT);
  assert.equal(live.plan.id,NEW);assert.equal(live.source.hash,direct.source.hash);assert.equal(live.tasks.length,12);assert.equal(childCount(live.tasks),41);
  const middle=live.planSnapshots[MID],old=live.planSnapshots[OLD];
  assert.equal(old.tasks.length,15);assert.equal(childCount(old.tasks),35);assert.ok(old.tasks.every(t=>t.status==='done'));
  assert.equal(old.plan.gates.find(g=>g.id==='G4').result.status,'held');
  assert.equal(middle.tasks.length,18);assert.equal(childCount(middle.tasks),49);assert.ok(middle.tasks.every(t=>t.status==='done'));
  assert.ok(middle.plan.gates.every(g=>g.result.status==='passed'));assert.match(middle.plan.budget,/5\.625315.*7.*1\.374685/);
  assert.match(old.plan.budget,/4\.879124/);assert.match(live.plan.budget,/승인 없음.*US\$0/);
  pass('actual4318 root/default and three independent snapshots match source; old tags/manifests/product bytes unchanged; old gates/costs preserved');
  assert.equal((await fetch(local+'/api/tasks?plan=__proto__')).status,400);
  assert.equal((await fetch(local+'/api/tasks?plan=unknown')).status,400);
  assert.equal((await fetch(local+'/api/tasks',{method:'POST'})).status,405);
  pass('fixture plan selection rejects prototype/unknown IDs and writes');

  for(const engine of ['chromium','webkit']){
    await writeFile(fixtureTasks,JSON.stringify(source));
    const browser=await pw[engine].launch({headless:true});browsers.push(browser);
    const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(![actual+'/',local+'/', 'file:','data:'].some(prefix=>r.url().startsWith(prefix)))external.push(r.url());});
    await page.goto(actual+'/');await page.locator('#leaf-total').filter({hasText:'41'}).waitFor();
    assert.equal(await page.locator('[data-plan-id]').count(),3);assert.equal(await page.locator('#parent-total').textContent(),'12');assert.equal(await page.locator('#overall-percent').textContent(),'0');
    assert.equal(await page.locator('#plan-tag').textContent(),TAG);assert.match(await page.locator('#plan-budget').textContent(),/승인 없음/);
    assert.equal(await page.locator('[data-gate="IR-G7"] [data-gate-result]').textContent(),'활성화 보류');
    await page.locator('[data-plan-id="'+OLD+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),'35');assert.equal(await page.locator('#leaf-done').textContent(),'35');
    assert.equal(await page.locator('[data-gate="G4"] [data-gate-result]').textContent(),'활성화 보류');
    await page.locator('[data-plan-id="'+MID+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),'49');assert.equal(await page.locator('#leaf-done').textContent(),'49');
    assert.equal(await page.locator('[data-gate="R4"] [data-gate-result]').textContent(),'검증 통과');assert.match(await page.locator('#plan-budget').textContent(),/평가 종료.*5\.625315/);
    await page.locator('[data-plan-id="'+NEW+'"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#leaf-done').textContent(),'0');
    await page.getByRole('searchbox',{name:'작업 검색'}).fill('익명');assert.ok(await page.locator('.task').count()>0);
    await page.locator('[data-plan-id="'+MID+'"]').click();assert.equal(await page.getByRole('searchbox',{name:'작업 검색'}).inputValue(),'');
    await page.locator('[data-plan-id="'+NEW+'"]').click();assert.equal(await page.getByRole('searchbox',{name:'작업 검색'}).inputValue(),'익명');
    await page.locator('#reset').click();
    pass(engine+': actual new/default and both historical plans, gates, costs, keyboard/search isolation verified');

    for(const width of [320,390,768,1440])for(const size of [100,200]){
      await page.setViewportSize({width,height:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,100),right:e.getBoundingClientRect().right}))}));
      if(layout.overflow){await writeFile(resolve(out,'overflow-'+engine+'.json'),JSON.stringify(layout,null,2));await page.screenshot({path:resolve(out,'overflow-'+engine+'.png'),fullPage:true});}
      assert.equal(layout.overflow,false,engine+'/'+width+'/'+size);
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:390,height:844});
    if(process.env.AXE_CORE_PATH){await page.addScriptTag({path:process.env.AXE_CORE_PATH});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>v.id));assert.deepEqual(violations,[]);}
    await page.screenshot({path:resolve(out,'dashboard-'+engine+'.png'),fullPage:true});
    pass(engine+': all three plan controls fit320/390/768/1440 at100/200percent; keyboard and axe remain usable');

    await page.goto(local+'/');await page.locator('#leaf-total').filter({hasText:'41'}).waitFor();
    const changed=structuredClone(source);changed[TAG].tasks[0].status='in-progress';changed[TAG].tasks[0].subtasks[0].status='done';
    await writeFile(fixtureTasks,JSON.stringify(changed));
    await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='1',{},{timeout:10000});
    assert.equal(await page.locator('#overall-percent').textContent(),'2');
    changed[TAG].tasks[0].subtasks[1].status='done';await writeFile(fixtureTasks,JSON.stringify(changed));
    await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='2');
    await page.locator('[data-plan-id="'+MID+'"]').click();assert.equal(await page.locator('#leaf-done').textContent(),'49');
    await page.locator('[data-plan-id="'+NEW+'"]').click();assert.equal(await page.locator('#leaf-done').textContent(),'2');
    await writeFile(fixtureTasks,'{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('#leaf-done').textContent(),'2');
    await writeFile(fixtureTasks,JSON.stringify(source));await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='0');
    await page.reload();await page.locator('#leaf-total').filter({hasText:'41'}).waitFor();assert.equal(await page.locator('#overall-percent').textContent(),'0');
    pass(engine+': isolated source auto-refresh/manual-refresh/reload/error recovery preserve41 versus old49/35 without mutating actual tasks');

    await page.goto(pathToFileURL(resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/index.html')).href);await page.locator('#leaf-total').filter({hasText:'41'}).waitFor();
    assert.equal(await page.locator('#connection-mode').textContent(),'저장된 HTML 사본');
    for(const [id,count]of [[OLD,'35'],[MID,'49'],[NEW,'41']]){await page.locator('[data-plan-id="'+id+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),count);}
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await page.close();await browser.close();
    pass(engine+': standalone existing HTML selects all three plans; no external requests or renderer errors');
  }

  // Run the historical suites from byte-identical copies. Their output paths
  // remain inside the disposable fixture, preserving prior QA/evaluation evidence.
  for(const [name,script,args]of [['historical-master','test-openai-dashboard.mjs',[]],['historical-multi','test-multi-plan-dashboard.mjs',[]],['historical-v143','verify-remediation-v4-dashboard.mjs',['--complete']]]){
    const absolute=resolve(fixture,'.taskmaster/scripts',script),oldCwd=process.cwd();
    assert.equal(hash(await readFile(absolute)),hash(await readFile(resolve(PROJECT_ROOT,'.taskmaster/scripts',script))));
    let result;try{process.chdir(fixture);result=await runCase([absolute,...args],{logPath:resolve(out,name+'.log'),timeoutMs:180000});}finally{process.chdir(oldCwd);}
    commands.push({name,script,code:result.code,timedOut:result.timedOut,isolatedOutput:true});assert.equal(result.code,0,name);assert.equal(result.timedOut,false);
    pass(name+': registered historical regression source passes with prior outputs preserved');
  }
  assert.deepEqual(await hashFiles(),before);const afterTasks=await readJson(resolve(PROJECT_ROOT,'.taskmaster/tasks/tasks.json'));
  for(const [tag,h]of Object.entries(preservation.oldTagHashes))assert.equal(hash(JSON.stringify(afterTasks[tag])),h);
  pass('actual sources/new task states and all historical tag/manifest/product bytes remain unchanged after dashboard QA');
}catch(error){checks.push({name:error.message,passed:false});console.error(error);process.exitCode=1;}
finally{
  for(const browser of browsers)await browser.close().catch(()=>{});
  await new Promise(ok=>server.close(ok));
  await writeFile(resolve(out,'verification.json'),JSON.stringify({passed:checks.every(c=>c.passed),checkedAt:new Date().toISOString(),planId:NEW,tag:TAG,parents:12,subtasks:41,checks,commands,existingDashboard:actual,isolatedFixture:fixture,productCodeChanged:false,implementationStarted:false,paidAiCalls:0,productionWrites:0},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.every(c=>c.passed),checks:checks.length,commands:commands.length}));
}
