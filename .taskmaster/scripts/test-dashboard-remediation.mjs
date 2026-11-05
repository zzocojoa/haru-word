import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {PROJECT_ROOT,readDashboardSnapshot,normalizeDashboard} from './openai-dashboard-data.mjs';
import {createDashboardServer} from './serve-openai-dashboard.mjs';
const pw=createRequire(import.meta.url)(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const tag='comprehensive-remediation',plan='comprehensive-remediation-2026-11-05';
const manifest=await json(resolve(PROJECT_ROOT,'.taskmaster/docs/comprehensive-remediation-manifest.json'));
const source=await json(resolve(PROJECT_ROOT,'.taskmaster/tasks/tasks.json'));
const until=async check=>{const end=Date.now()+4000;while(Date.now()<end){if(await check())return;await new Promise(ok=>setTimeout(ok,20));}throw Error('Dashboard condition not reached');};
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'haru-dashboard-remediation-'));
 const registry=await json(resolve(PROJECT_ROOT,'.taskmaster/docs/dashboard-plans.json'));
 for(const file of ['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest)]){
  await mkdir(dirname(resolve(root,file)),{recursive:true});await copyFile(resolve(PROJECT_ROOT,file),resolve(root,file));
 }
 const {server}=createDashboardServer({projectRoot:root});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {root,registry,url:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(ok=>server.close(ok));}};
}

test('DASH-3: actual Node normalizer requires matching named provenance; master legacy form remains supported',()=>{
 assert.throws(()=>normalizeDashboard({tasks:source.master.tasks},manifest),/missing_tasks/);
 assert.throws(()=>normalizeDashboard({planId:'wrong-plan',tasks:source[tag].tasks},manifest),/missing_tasks/);
 assert.equal(normalizeDashboard({planId:plan,tasks:source[tag].tasks},manifest).tasks.length,33);
 assert.equal(normalizeDashboard(source,manifest).source.tag,tag);
 assert.equal(normalizeDashboard({tasks:source.master.tasks},{...manifest,tag:'master',tasks:[{id:1,phase:1,subtaskCount:0}]}).tasks.length,1);
});

for(const engine of ['chromium','webkit']){
 test(`DASH-1 ${engine}: live refresh adds plans and updates labels/budgets without losing historical plans`,async()=>{
  const f=await fixture(),browser=await pw[engine].launch({headless:true});
  try{
   const page=await browser.newPage();const loaded=page.waitForResponse(r=>r.url().includes('/api/tasks?'));await page.goto(f.url);await loaded;await until(async()=>await page.locator('#connection-mode').textContent()==='원본 연결 · 5초 갱신');
   const before=await readDashboardSnapshot(f.root),next='synthetic-extra-plan';
   const tasks=structuredClone(source);tasks['synthetic-extra']={tasks:structuredClone(source[tag].tasks)};
   await writeFile(resolve(f.root,'.taskmaster/tasks/tasks.json'),JSON.stringify(tasks));
   const entry=f.registry.plans.find(p=>p.id===plan);entry.label='현재 표시 갱신';
   const old=f.registry.plans.find(p=>p.id!==plan);old.budget='보존 이력 예산 표시 갱신';
   f.registry.plans.push({id:next,label:'새 합성 플랜',kind:'previous',manifest:'.taskmaster/docs/synthetic-extra.json'});
   await writeFile(resolve(f.root,'.taskmaster/docs/synthetic-extra.json'),JSON.stringify({...manifest,planId:next,tag:'synthetic-extra'}));
   await writeFile(resolve(f.root,'.taskmaster/docs/dashboard-plans.json'),JSON.stringify(f.registry));
   const changed=await readDashboardSnapshot(f.root);assert.notEqual(changed.source.hash,before.source.hash);
   await page.locator('#refresh').click();await page.getByRole('button',{name:/새 합성 플랜/}).waitFor();
   assert.match(await page.locator(`[data-plan-id="${plan}"]`).textContent(),/현재 표시 갱신/);
   assert.equal(await page.locator('[data-plan-id]').count(),f.registry.plans.length);
   await page.locator(`[data-plan-id="${old.id}"]`).click();await until(async()=>await page.locator('#plan-budget').textContent()===old.budget);
   assert.equal(await page.locator('[data-plan-id][aria-pressed="true"]').getAttribute('data-plan-id'),old.id);
   // Registry-only changes must invalidate the source hash as well.
   const previous=await readDashboardSnapshot(f.root);entry.label='라벨만 변경';
   await writeFile(resolve(f.root,'.taskmaster/docs/dashboard-plans.json'),JSON.stringify(f.registry));
   assert.notEqual((await readDashboardSnapshot(f.root)).source.hash,previous.source.hash);
   await page.locator('#refresh').click();await until(async()=>/라벨만 변경/.test(await page.locator(`[data-plan-id="${plan}"]`).textContent()));
  }finally{await browser.close();await f.close();}
 });
 test(`DASH-2 ${engine}: imported copy survives an earlier live reply; explicit resume returns to original`,async()=>{
  const f=await fixture(),browser=await pw[engine].launch({headless:true});
  try{
   const page=await browser.newPage();const loaded=page.waitForResponse(r=>r.url().includes('/api/tasks?'));await page.goto(f.url);await loaded;await until(async()=>await page.locator('#connection-mode').textContent()==='원본 연결 · 5초 갱신');
   let held,release;const arrived=new Promise(ok=>held=ok),gate=new Promise(ok=>release=ok);
   await page.route('**/api/tasks?*',async route=>{held();await gate;await route.fulfill({json:await readDashboardSnapshot(f.root)});});
   await page.locator('#refresh').click();await arrived;
   const imported=structuredClone(source);for(const task of imported[tag].tasks){task.status='done';for(const sub of task.subtasks)sub.status='done';}
   await page.locator('#import-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
   await until(async()=>/불러온 JSON 사본/.test(await page.locator('#connection-mode').textContent()));
   const count=await page.locator('#leaf-done').textContent();assert.equal(count,'81');const replied=page.waitForResponse(response=>response.url().includes('/api/tasks?'));release();
   await replied;
   await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
   assert.match(await page.locator('#connection-mode').textContent(),/불러온 JSON 사본/);assert.equal(await page.locator('#leaf-done').textContent(),count);
   await page.unroute('**/api/tasks?*');await page.locator('.data-menu summary').click();await page.locator('#resume-live').click();
   await until(async()=>await page.locator('#connection-mode').textContent()==='원본 연결 · 5초 갱신');
   assert.equal(await page.locator('#leaf-done').textContent(),String(source[tag].tasks.flatMap(t=>t.subtasks).filter(t=>t.status==='done').length));
  }finally{await browser.close();await f.close();}
 });
}
