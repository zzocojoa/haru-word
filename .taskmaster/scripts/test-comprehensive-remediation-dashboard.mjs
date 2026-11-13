import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,mkdtemp,copyFile } from 'node:fs/promises';
import { resolve,dirname,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT,readDashboardSnapshot,normalizeDashboard } from './openai-dashboard-data.mjs';
import { createDashboardServer } from './serve-openai-dashboard.mjs';

const TAG='comprehensive-remediation',PLAN='comprehensive-remediation-2026-11-05';
const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const manifest=await json(resolve(PROJECT_ROOT,'.taskmaster/docs/comprehensive-remediation-manifest.json'));
const root=resolve(manifest.baseline.existingDashboardRoot),url='http://127.0.0.1:4318';
const evidenceRoot=manifest.execution.publicationEvidenceRoot??'outputs/comprehensive-remediation-implementation-20261105';
const output=resolve(process.env.QA_OUTPUT_DIR||resolve(root,evidenceRoot,'dashboard'));
await mkdir(output,{recursive:true});await mkdir(resolve(PROJECT_ROOT,'.sites-runtime'),{recursive:true});
const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json'));
const paths=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest),'.taskmaster/dashboard/dashboard.js','.taskmaster/scripts/openai-dashboard-data.mjs'];
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async file=>[file,await hash(resolve(root,file))])));
const before=await hashes(),source=await json(resolve(root,paths[0]));
const leaves=source[TAG].tasks.flatMap(t=>t.subtasks),percent=String(Math.round(leaves.filter(t=>t.status==='done').length/leaves.length*100));
const pending=structuredClone(source);for(const t of pending[TAG].tasks){t.status='pending';for(const child of t.subtasks)child.status='pending';}
const fixture=await mkdtemp(join(resolve(PROJECT_ROOT,'.sites-runtime'),'comprehensive-plan-dashboard-'));
for(const file of paths){await mkdir(dirname(resolve(fixture,file)),{recursive:true});await copyFile(resolve(root,file),resolve(fixture,file));}
const {server}=createDashboardServer({projectRoot:fixture});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const local='http://127.0.0.1:'+server.address().port,checks=[],knownLimits=[],browsers=[];
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
const write=async(file,value)=>writeFile(resolve(fixture,file),typeof value==='string'?value:JSON.stringify(value));
try{
  const live=await(await fetch(url+'/api/tasks?plan='+PLAN)).json(),direct=await readDashboardSnapshot(root,PLAN);
  assert.equal(live.source.hash,direct.source.hash);assert.equal(live.plan.id,PLAN);assert.equal(live.source.tag,TAG);
  assert.equal(live.catalog.plans.length,registry.plans.length);
  assert.equal(live.tasks.length,33);assert.equal(live.tasks.flatMap(t=>t.subtasks).length,81);
  assert.match(live.plan.budget,/US\$0/);assert.doesNotMatch(live.plan.budget,/undefined|NaN/);
  assert.equal(live.planSnapshots['openai-api-migration-2026-11-03'].plan.gates.find(g=>g.id==='G4').result.status,'held');
  assert.match(live.planSnapshots['openai-api-migration-2026-11-03'].plan.budget,/4\.879124/);
  assert.match(live.planSnapshots['judgment-remediation-2026-11-03'].plan.budget,/5\.625315.*7.*1\.374685/);
  pass('actual ROOT4318 snapshot/counts/new0usd and historical quality/budgets match');

  for(const engine of ['chromium','webkit']){
    const browser=await pw[engine].launch({headless:true});browsers.push(browser);
    const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[],external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(![url+'/',local+'/','file:','data:'].some(prefix=>request.url().startsWith(prefix)))external.push(request.url());});
    await page.goto(url+'/?plan='+PLAN);await page.waitForFunction(()=>document.getElementById('leaf-total').textContent==='81');
    assert.equal(await page.locator('[data-plan-id]').count(),registry.plans.length);
    assert.equal(await page.locator('#overall-percent').textContent(),percent);assert.equal(await page.locator('#parent-total').textContent(),'33');
    assert.equal(await page.locator('#plan-tag').textContent(),TAG);
    assert.equal(await page.locator('#integrity-warning').isVisible(),false);
    pass(engine+': explicit comprehensive query shows33/81,current-percent,catalog-count, no integrity warning');
    for(const [id,tag,p,c]of [
      ['openai-api-migration-2026-11-03','master',15,35],
      ['judgment-remediation-2026-11-03','judgment-remediation',18,49],
      ['integration-remediation-2026-11-04','integration-remediation',12,41],
      [PLAN,TAG,33,81],
    ]){
      await page.locator('[data-plan-id="'+id+'"]').click();
      await page.waitForFunction(tag=>document.getElementById('plan-tag').textContent===tag,tag);
      assert.equal(await page.locator('#parent-total').textContent(),String(p));assert.equal(await page.locator('#leaf-total').textContent(),String(c));
      assert.equal(await page.locator('#overall-percent').textContent(),id===PLAN?percent:'100');
      assert.equal(await page.locator('#integrity-warning').isVisible(),false);
    }
    await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
    assert.equal(await page.locator('#leaf-total').textContent(),'81');
    pass(engine+': historical plan selections retain separate counts/statuses; new-plan refresh stable');
    await page.getByRole('searchbox',{name:'작업 검색'}).fill('UI-4');
    assert.ok(await page.locator('#task-7').count());
    await page.getByRole('searchbox',{name:'작업 검색'}).fill('');
    for(const width of [320,390,1440])for(const scale of [1,2]){
      await page.setViewportSize({width,height:1000});await page.evaluate(s=>document.documentElement.style.fontSize=14*s+'px',scale);
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('body *')].map(e=>({id:e.id,tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,text:e.textContent.slice(0,60)})).filter(e=>e.right>innerWidth+1).slice(0,15)}));
      if(layout.scroll>layout.width+1)await page.screenshot({path:resolve(output,engine+'-layout-failure.png')});
      assert.ok(layout.scroll<=layout.width+1,engine+' layout '+width+'/'+scale+' '+JSON.stringify(layout));
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:1440,height:1100});
    if(process.env.AXE_CORE_PATH){await page.addScriptTag({path:process.env.AXE_CORE_PATH});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(x=>x.id)),[]);}
    await page.screenshot({path:resolve(output,engine+'-'+registry.plans.length+'plans.png'),fullPage:false});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    pass(engine+': audit search,320/390/1440 at100/200percent,accessibility,no external requests/page errors');
    await page.goto(pathToFileURL(resolve(root,'outputs/openai-migration-dashboard/index.html')).href+'?plan='+PLAN);
    await page.waitForFunction(()=>document.getElementById('leaf-total').textContent==='81');
    assert.equal(await page.locator('[data-plan-id]').count(),registry.plans.length);assert.equal(await page.locator('#connection-mode').innerText(),'저장된 HTML 사본');
    await page.locator('[data-plan-id="openai-api-migration-2026-11-03"]').click();assert.equal(await page.locator('#leaf-total').textContent(),'35');
    pass(engine+': regenerated standalone HTML contains new and historical plans');

    // Isolated fixture: distinguish known catalog-refresh defect from a bad registration.
    const historical=structuredClone(registry);historical.plans=historical.plans.filter(p=>p.id!==PLAN);historical.defaultPlanId='integration-remediation-2026-11-04';
    await write(paths[1],historical);await write(paths[0],pending);
    await page.goto(local);assert.equal(await page.locator('[data-plan-id]').count(),registry.plans.length-1);
    await write(paths[1],registry);
    const response=page.waitForResponse(r=>r.url().includes('/api/tasks'));
    await page.locator('#refresh').click();assert.equal((await(await response).json()).catalog.plans.length,registry.plans.length);
    await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
    assert.equal(await page.locator('[data-plan-id]').count(),registry.plans.length);
    await page.goto(local+'/?plan='+PLAN);assert.equal(await page.locator('[data-plan-id]').count(),registry.plans.length);assert.equal(await page.locator('#leaf-total').textContent(),'81');
    knownLimits.push({id:'DASH-1',engine,serverPlans:registry.plans.length,alreadyOpenPagePlansAfterRefresh:registry.plans.length,fullReloadPlans:registry.plans.length,fixed:true});
    pass(engine+': registration valid after reload; DASH-1 live catalog refresh matches source');

    const changed=structuredClone(pending);changed[TAG].tasks[0].subtasks[0].status='done';
    await write(paths[0],changed);await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='1');
    assert.equal(await page.locator('#overall-percent').textContent(),'1');
    await write(paths[0],'{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});
    assert.equal(await page.locator('#leaf-done').textContent(),'1');
    await write(paths[0],pending);await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='0'&&document.getElementById('data-warning').hidden);
    pass(engine+': isolated status refresh,malformed-source retention/recovery; originals never modified');
    await browser.close();
  }
  assert.throws(()=>normalizeDashboard({tasks:source.master.tasks},manifest),/missing_tasks/);
  assert.equal(normalizeDashboard({planId:PLAN,tasks:source[TAG].tasks},manifest).tasks.length,33);
  knownLimits.push({id:'DASH-3',evidenceLevel:'actual normalizer in Node; not browser reproduction',bareMasterAdoptedByNamedPlan:false,fixed:true});
  pass('DASH-3 named source fails closed; matching explicit provenance remains accepted');
  assert.deepEqual(await hashes(),before);
  pass('all original tasks/registry/manifests/dashboard runtime bytes unchanged by QA');
}catch(error){checks.push({name:error.message,passed:false});console.error(error);process.exitCode=1;}
finally{
  for(const browser of browsers)await browser.close().catch(()=>{});
  server.closeAllConnections();await new Promise(ok=>server.close(ok));
  const report={checkedAt:new Date().toISOString(),passed:checks.every(c=>c.passed),exitCode:process.exitCode||0,checks,knownLimits,sourceHashes:before,scope:'local read-only dashboard, synthetic isolated fixture only; no learner DB, paid AI, deployment, iPhone or VoiceOver'};
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:checks.length,knownLimits:knownLimits.length,exitCode:report.exitCode}));
}
