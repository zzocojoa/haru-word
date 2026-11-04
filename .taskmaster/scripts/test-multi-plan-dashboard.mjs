import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createDashboardServer } from './serve-openai-dashboard.mjs';
import { PROJECT_ROOT, buildDashboard } from './openai-dashboard-data.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const NEW='judgment-remediation-2026-11-03',OLD='openai-api-migration-2026-11-03';
const out=resolve(PROJECT_ROOT,'outputs/judgment-remediation-plan/qa');await mkdir(out,{recursive:true});
const registry=JSON.parse(await readFile(resolve(PROJECT_ROOT,'.taskmaster/docs/dashboard-plans.json'),'utf8'));
const paths=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest)];
const protectedPaths=[...paths,'.taskmaster/dashboard/dashboard.js','.taskmaster/dashboard/dashboard.css','.taskmaster/dashboard/index.template.html','.taskmaster/scripts/openai-dashboard-data.mjs','.taskmaster/scripts/serve-openai-dashboard.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(protectedPaths.map(async p=>[p,createHash('sha256').update(await readFile(resolve(PROJECT_ROOT,p))).digest('hex')])));
const before=await hashes(),source=JSON.parse(await readFile(resolve(PROJECT_ROOT,paths[0]),'utf8'));
await mkdir(resolve(PROJECT_ROOT,'.sites-runtime'),{recursive:true});
const fixture=await mkdtemp(join(resolve(PROJECT_ROOT,'.sites-runtime'),'multi-plan-qa-'));
for(const p of paths){await mkdir(dirname(resolve(fixture,p)),{recursive:true});await writeFile(resolve(fixture,p),await readFile(resolve(PROJECT_ROOT,p)));}
// Keep this historical two-plan scenario explicit as new default plans are added.
const fixtureRegistry=structuredClone(registry);fixtureRegistry.defaultPlanId=NEW;
for(const entry of fixtureRegistry.plans){entry.kind=entry.id===NEW?'current':'previous';if(entry.id===NEW){entry.context='수정 계획 작성 완료 · 구현 미착수.';entry.budget='새 평가 추가 US$5 승인 · 현재 사용 US$0 · 과거 평가 예산과 별도';}}
await writeFile(resolve(fixture,paths[1]),JSON.stringify(fixtureRegistry));
for(const task of source['judgment-remediation'].tasks){task.status='pending';for(const child of task.subtasks)child.status='pending';}
const fixtureManifest=JSON.parse(await readFile(resolve(fixture,paths[3]),'utf8'));fixtureManifest.executionStarted=false;delete fixtureManifest.execution.currentEvaluation;await writeFile(resolve(fixture,paths[3]),JSON.stringify(fixtureManifest));
const tasksPath=resolve(fixture,paths[0]);
const writeTasks=async x=>writeFile(tasksPath,typeof x==='string'?x:JSON.stringify(x));
const {server}=createDashboardServer({projectRoot:fixture});await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const url='http://127.0.0.1:'+server.address().port,checks=[],browsers=[];
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
try{
  const current=await(await fetch(url+'/api/tasks')).json(),old=await(await fetch(url+'/api/tasks?plan='+OLD)).json();
  assert.equal(current.plan.id,NEW);assert.equal(current.tasks.length,18);assert.equal(current.tasks.flatMap(t=>t.subtasks).length,49);
  assert.equal(old.plan.id,OLD);assert.equal(old.tasks.length,15);assert.equal(old.plan.gates.find(g=>g.id==='G4').result.status,'held');
  assert.equal((await fetch(url+'/api/tasks?plan=../../.env')).status,400);
  assert.equal((await fetch(url+'/api/tasks?plan=__proto__')).status,400);
  assert.equal((await fetch(url+'/api/tasks?plan=unknown')).status,400);
  assert.equal((await fetch(url+'/api/tasks',{method:'POST'})).status,405);
  pass('API default/new/old select exact tags; unknown/prototype/path plan IDs and writes rejected');
  fixtureManifest.executionStarted=true;
  fixtureManifest.execution.dashboardContext='평가 종료 / 배포 보류 · 후속 후보 유료 미평가';
  fixtureManifest.authorization.newEvaluationUsedUsdBeforeTax=4.417706;
  await writeFile(resolve(fixture,paths[3]),JSON.stringify(fixtureManifest));
  const held=await(await fetch(url+'/api/tasks')).json();
  assert.equal(held.plan.context,'평가 종료 / 배포 보류 · 후속 후보 유료 미평가');
  assert.ok(held.plan.budget.includes('4.417706'));
  assert.equal((await(await fetch(url+'/api/tasks?plan='+OLD)).json()).plan.budget,old.plan.budget);
  fixtureManifest.execution.currentEvaluation={approvedMaxUsd:7,usedUsd:0.123456};
  await writeFile(resolve(fixture,paths[3]),JSON.stringify(fixtureManifest));
  const active=await(await fetch(url+'/api/tasks')).json();
  assert.ok(active.plan.budget.includes('US$7')&&active.plan.budget.includes('0.123456'));
  assert.ok(active.plan.budget.includes('이전 종료 원장과 별도')&&!active.plan.budget.includes('4.417706'));
  assert.equal((await(await fetch(url+'/api/tasks?plan='+OLD)).json()).plan.budget,old.plan.budget);
  fixtureManifest.executionStarted=false;
  await writeFile(resolve(fixture,paths[3]),JSON.stringify(fixtureManifest));
  pass('closed evaluation context and current cost refresh without altering prior-plan budget');
  fixtureManifest.executionStarted=true;fixtureManifest.execution.currentEvaluation={approvedMaxUsd:7,usedUsd:5.078656,closed:true};fixtureManifest.execution.nextEvaluationProposal={maxUsdBeforeTax:7,approved:false,preparationReady:true};
  await writeFile(resolve(fixture,paths[3]),JSON.stringify(fixtureManifest));
  const proposed=await(await fetch(url+'/api/tasks')).json();assert.ok(proposed.plan.budget.includes('직전 평가 종료')&&proposed.plan.budget.includes('5.078656')&&proposed.plan.budget.includes('제안(미승인)'));
  assert.equal((await(await fetch(url+'/api/tasks?plan='+OLD)).json()).plan.budget,old.plan.budget);
  fixtureManifest.executionStarted=false;await writeFile(resolve(fixture,paths[3]),JSON.stringify(fixtureManifest));pass('a new unapproved proposal is distinct from the closed evaluation allowance and spend');
  for(const engine of ['chromium','webkit']){
    await writeTasks(source);
    const browser=await pw[engine].launch({headless:true});browsers.push(browser);
    const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url());});
    await page.goto(url);await page.locator('#leaf-total').filter({hasText:'49'}).waitFor();
    assert.equal(await page.locator('[data-plan-id][aria-pressed="true"]').getAttribute('data-plan-id'),NEW);
    assert.equal(await page.locator('#overall-percent').textContent(),'0');assert.equal(await page.locator('#parent-total').textContent(),'18');
    assert.equal(await page.locator('#plan-tag').textContent(),'judgment-remediation');assert.ok((await page.locator('#plan-context').innerText()).includes('구현 미착수'));
    assert.ok((await page.locator('#plan-budget').innerText()).includes('추가 US$5'));assert.equal(await page.locator('[data-gate="R4"]').count(),1);
    pass(engine+': new18/49 default0percent, separate tag, new5usd and deployment gate visible');
    await page.locator('[data-plan-id="'+OLD+'"]').click();await page.waitForFunction(()=>document.getElementById('overall-percent').textContent==='100');
    assert.equal(await page.locator('#leaf-total').textContent(),'35');assert.equal(await page.locator('#parent-total').textContent(),'15');
    assert.equal(await page.locator('#plan-tag').textContent(),'master');assert.equal(await page.locator('[data-gate="G4"] [data-gate-result]').innerText(),'활성화 보류');
    assert.equal(await page.locator('[data-gate="R4"]').count(),0);assert.ok((await page.locator('#plan-budget').innerText()).includes('4.879124'));
    pass(engine+': prior15/35 remains100percent with G4held and historical budget');
    await page.getByRole('searchbox',{name:'작업 검색'}).fill('15.2');assert.equal(await page.locator('.task').count(),1);
    await page.locator('[data-plan-id="'+NEW+'"]').click();assert.equal(await page.getByRole('searchbox',{name:'작업 검색'}).inputValue(),'');assert.equal(await page.locator('.task').count(),18);
    await page.locator('#task-18 > summary').click();await page.locator('#task-18').getByRole('button',{name:'선행 작업 17 보기',exact:true}).click();
    assert.ok((await page.locator('#task-17 .task-name').innerText()).includes('US$5'));assert.equal(await page.locator('#task-17').getAttribute('open'),'');
    await page.locator('[data-plan-id="'+OLD+'"]').click();assert.equal(await page.getByRole('searchbox',{name:'작업 검색'}).inputValue(),'15.2');assert.equal(await page.locator('.task').count(),1);
    await page.locator('[data-plan-id="'+NEW+'"]').click();assert.equal(await page.locator('#task-17').getAttribute('open'),'');
    pass(engine+': plan-specific search/expansion persists and dependency jumps use selected plan');
    await page.locator('#import-file').setInputFiles({name:'old-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({master:source.master}))});
    await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('#leaf-total').textContent(),'49');assert.equal(await page.locator('#overall-percent').textContent(),'0');
    await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'hidden'});
    const imported=structuredClone(source);imported['judgment-remediation'].tasks[0].title='<img src=x onerror="window.planAttack=1">';
    await page.locator('#import-file').setInputFiles({name:'both-tags.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction(()=>document.getElementById('connection-mode').textContent==='불러온 JSON 사본');
    assert.equal(await page.locator('#task-1 .task-name').textContent(),imported['judgment-remediation'].tasks[0].title);assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.planAttack),undefined);
    await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('connection-mode').textContent.includes('원본 연결'));
    pass(engine+': wrong-tag import rejected; both-tag import selects current and escapes executable content');
    const changed=structuredClone(source);changed['judgment-remediation'].tasks[0].status='in-progress';changed['judgment-remediation'].tasks[0].subtasks[0].status='done';
    await writeTasks(changed);await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='1');
    assert.equal(await page.locator('#overall-percent').textContent(),'2');
    await page.locator('[data-plan-id="'+OLD+'"]').click();assert.equal(await page.locator('#overall-percent').textContent(),'100');
    await page.locator('[data-plan-id="'+NEW+'"]').click();assert.equal(await page.locator('#leaf-done').textContent(),'1');
    await writeTasks('{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('#leaf-done').textContent(),'1');
    await writeTasks(source);await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='0');
    pass(engine+': refresh/progress/error retention/recovery never mixes old and new completion');
    for(const selected of [NEW,OLD]){
      await page.locator('[data-plan-id="'+selected+'"]').click();
      for(const width of [320,390,768,1440])for(const scale of [1,2]){
        await page.setViewportSize({width,height:1000});await page.evaluate(s=>document.documentElement.style.fontSize=14*s+'px',scale);
        const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.equal(layout.overflow,false,engine+' '+selected+' '+width+'/'+scale+' '+JSON.stringify(layout));
      }
      await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:1440,height:1050});
      if(process.env.AXE_CORE_PATH){await page.addScriptTag({path:process.env.AXE_CORE_PATH});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[]);}
    }
    await page.locator('[data-plan-id="'+NEW+'"]').click();await page.locator('[data-plan-id="'+OLD+'"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#plan-tag').textContent(),'master');
    await page.locator('[data-plan-id="'+NEW+'"]').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#plan-tag').textContent(),'judgment-remediation');
    await page.screenshot({path:resolve(out,'new-plan-'+engine+'.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,'new-plan-mobile-'+engine+'.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    pass(engine+': both plans fit320/390/768/1440 at100/200percent, axe clean, keyboard selection, no external/error');
    await page.close();await browser.close();
  }
  await buildDashboard();
  for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true});browsers.push(browser);const page=await browser.newPage();await page.goto(pathToFileURL(resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/index.html')).href+'?plan='+NEW);await page.locator('#leaf-total').filter({hasText:'49'}).waitFor();assert.equal(await page.locator('#connection-mode').innerText(),'저장된 HTML 사본');await page.locator('[data-plan-id="'+OLD+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),'35');await page.locator('[data-plan-id="'+NEW+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),'49');await browser.close();pass(engine+': standalone existing HTML contains and switches both plans without a server');}
  assert.deepEqual(await hashes(),before);pass('all original Task Master/manifest/catalog sources byte-identical after QA');
}catch(e){checks.push({name:e.message,passed:false});console.error(e);process.exitCode=1;}
finally{for(const b of browsers)await b.close().catch(()=>{});await new Promise(ok=>server.close(ok));const report={passed:checks.every(c=>c.passed),checks,sourceHashes:before,scope:'Local two-plan dashboard; isolated fixture; no paid or production calls.'};await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.length}));}
