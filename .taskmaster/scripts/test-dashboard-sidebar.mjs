import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {PROJECT_ROOT,readDashboardSnapshot} from './openai-dashboard-data.mjs';

const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const out=resolve(process.env.QA_OUTPUT_DIR||resolve(PROJECT_ROOT,'outputs/dashboard-sidebar-20261106/browser'));
const url='http://127.0.0.1:4318/',checks=[],browsers=[];
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const registry=JSON.parse(await readFile(resolve(PROJECT_ROOT,'.taskmaster/docs/dashboard-plans.json'),'utf8'));
const paths=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest)];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,await sha(resolve(PROJECT_ROOT,p))])));
const before=await hashes(),snapshot=await readDashboardSnapshot(PROJECT_ROOT);
const current=registry.defaultPlanId,old=registry.plans.find(p=>p.id!==current).id;
const noOverflow=async(page,label)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label);
const openMenu=async page=>{if(!await page.locator('#plan-sidebar').isVisible())await page.locator('#sidebar-toggle').click();};
await mkdir(out,{recursive:true});
try{
 for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true});browsers.push(browser);
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('file:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto(url);await page.locator('#plan-buttons button').first().waitFor();
  assert.equal(await page.locator('#plan-buttons [data-plan-id]').count(),registry.plans.length);
  assert.equal(await page.locator('#plan-buttons button').first().getAttribute('data-plan-id'),current);
  assert.equal(await page.locator('#plan-buttons [aria-current="page"]').count(),1);
  const geometry=await page.evaluate(()=>({sidebar:document.getElementById('plan-sidebar').getBoundingClientRect().toJSON(),content:document.getElementById('dashboard-content').getBoundingClientRect().toJSON()}));
  assert.equal(geometry.sidebar.x,0);assert.ok(geometry.content.x>=geometry.sidebar.width);assert.ok(geometry.sidebar.width>=220);
  assert.equal(await page.locator('main #plan-buttons').count(),0);
  await page.evaluate(()=>scrollTo(0,1100));assert.equal((await page.locator('#plan-sidebar').boundingBox()).y,0);await page.evaluate(()=>scrollTo(0,0));
  pass(engine+': fixed left navigation, current plan first, selected marker, independent detail pane and unchanged plan count');
  for(const entry of registry.plans){
   await page.locator('[data-plan-id="'+entry.id+'"]').click();
   const item=snapshot.planSnapshots[entry.id],leaves=item.tasks.flatMap(t=>t.subtasks);
   assert.equal(await page.locator('#plan-tag').textContent(),item.source.tag);assert.equal(await page.locator('#parent-total').textContent(),String(item.tasks.length));assert.equal(await page.locator('#leaf-total').textContent(),String(leaves.length));
   assert.equal(await page.locator('#plan-budget').textContent(),item.plan.budget);assert.equal(await page.locator('[aria-current="page"]').getAttribute('data-plan-id'),entry.id);
   for(const gate of item.plan.gates)if(gate.result)assert.equal(await page.locator('[data-gate="'+gate.id+'"] [data-gate-detail]').textContent(),gate.result.detail);
  }
  await page.locator('[data-plan-id="'+current+'"]').click();await page.getByRole('searchbox',{name:'작업 검색'}).fill('1.1');
  await page.locator('[data-plan-id="'+old+'"]').click();assert.equal(await page.getByRole('searchbox',{name:'작업 검색'}).inputValue(),'');
  await page.locator('[data-plan-id="'+current+'"]').click();assert.equal(await page.getByRole('searchbox',{name:'작업 검색'}).inputValue(),'1.1');await page.locator('#reset').click();
  pass(engine+': all plan counts/budgets/gate details match source; selection keeps plan-specific filters');
  await page.locator('#sidebar-close').click();assert.equal(await page.locator('#plan-sidebar').isVisible(),false);assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'sidebar-toggle');assert.equal((await page.locator('#dashboard-content').boundingBox()).x,0);
  await page.reload();assert.equal(await page.locator('#plan-sidebar').isVisible(),false);await page.locator('#sidebar-toggle').click();assert.equal(await page.locator('#plan-sidebar').isVisible(),true);
  await page.reload();assert.equal(await page.locator('#plan-sidebar').isVisible(),true);await page.screenshot({path:resolve(out,engine+'-desktop.png')});
  pass(engine+': desktop close/open, focus restoration and reload preference work without changing source state');
  for(const width of [768,884,1050,1440])for(const scale of [1,2]){
   await page.setViewportSize({width,height:1000});await page.evaluate(s=>document.documentElement.style.fontSize=14*s+'px',scale);await noOverflow(page,engine+' desktop '+width+'/'+scale);
   assert.ok((await page.locator('#dashboard-content').boundingBox()).x>=220);
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:884,height:884});await page.screenshot({path:resolve(out,engine+'-884.png')});
  pass(engine+': persistent navigation at768/884/1050/1440px,100/200percent text without page overflow');
  for(const width of [320,390,760])for(const scale of [1,2]){
   await page.setViewportSize({width,height:884});await page.locator('#plan-sidebar').waitFor({state:'hidden'});await page.evaluate(s=>document.documentElement.style.fontSize=14*s+'px',scale);
   assert.equal(await page.locator('#plan-sidebar').isVisible(),false);await noOverflow(page,engine+' mobile closed '+width+'/'+scale);
   await page.locator('#sidebar-toggle').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#plan-sidebar').getAttribute('role'),'dialog');assert.equal(await page.locator('#plan-sidebar').getAttribute('aria-modal'),'true');assert.equal(await page.evaluate(()=>document.getElementById('dashboard-content').inert),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'sidebar-close');
   await noOverflow(page,engine+' mobile open '+width+'/'+scale);
   const first=page.locator('#plan-sidebar a').first(),last=page.locator('#plan-buttons button').last();await last.focus();await page.keyboard.press('Tab');assert.equal(await first.evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Shift+Tab');assert.equal(await last.evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#plan-sidebar').isVisible(),false);assert.equal(await page.evaluate(()=>document.getElementById('dashboard-content').inert),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'sidebar-toggle');
  }
  pass(engine+':320/390/760px at100/200percent; modal menu, inert background, keyboard trap and Escape/focus restoration');
  await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:390,height:844});await openMenu(page);await page.screenshot({path:resolve(out,engine+'-mobile-menu.png')});
  await page.locator('[data-plan-id="'+old+'"]').click();assert.equal(await page.locator('#plan-sidebar').isVisible(),false);assert.equal(await page.locator('#plan-tag').textContent(),snapshot.planSnapshots[old].source.tag);assert.equal(await page.evaluate(()=>document.getElementById('dashboard-content').inert),false);
  await openMenu(page);await page.mouse.click(380,140);assert.equal(await page.locator('#plan-sidebar').isVisible(),false);
  await openMenu(page);await page.setViewportSize({width:884,height:884});await page.waitForFunction(()=>document.getElementById('sidebar-backdrop').hidden&&!document.getElementById('dashboard-content').inert);assert.equal(await page.locator('#plan-sidebar').isVisible(),true);assert.equal(await page.locator('#sidebar-backdrop').isVisible(),false);assert.equal(await page.evaluate(()=>document.getElementById('dashboard-content').inert),false);
  await page.setViewportSize({width:390,height:844});await page.locator('#plan-sidebar').waitFor({state:'hidden'});assert.equal(await page.locator('#plan-sidebar').isVisible(),false);
  pass(engine+': mobile selection/backdrop close and mobile↔desktop resizing leave detail pane usable');
  await page.setViewportSize({width:1440,height:1000});await page.goto(pathToFileURL(resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/index.html')).href);
  await openMenu(page);await page.locator('[data-plan-id="'+old+'"]').click();assert.equal(await page.locator('#plan-tag').textContent(),snapshot.planSnapshots[old].source.tag);assert.equal(await page.locator('#connection-mode').textContent(),'저장된 HTML 사본');
  await page.locator('[data-plan-id="'+current+'"]').click();assert.equal(await page.locator('#plan-tag').textContent(),snapshot.planSnapshots[current].source.tag);
  await page.goto(url+'?plan='+old);assert.equal(await page.locator('[aria-current="page"]').getAttribute('data-plan-id'),old);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass(engine+': query selection and standalone HTML navigation work; no page errors/external requests');
  await browser.close();
 }
 assert.deepEqual(await hashes(),before);pass('Task Master tasks/catalog/all manifests byte-identical after navigation QA');
}catch(e){checks.push({name:e.message,passed:false});console.error(e);process.exitCode=1;}
finally{for(const b of browsers)await b.close().catch(()=>{});await writeFile(resolve(out,'results.json'),JSON.stringify({at:new Date().toISOString(),passed:checks.every(c=>c.passed),exitCode:process.exitCode||0,checks,sourceHashes:before,physicalDevice:false,axeExecuted:false,scope:'Local dashboard navigation only; no learner records, AI or production writes.'},null,2)+'\n');console.log(JSON.stringify({passed:checks.every(c=>c.passed),groups:checks.length,exitCode:process.exitCode||0}));}
