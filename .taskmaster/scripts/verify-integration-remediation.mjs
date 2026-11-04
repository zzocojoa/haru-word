// Current implementation progress; the original planning-only QA remains history.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {PROJECT_ROOT,readDashboardSnapshot,buildDashboard} from './openai-dashboard-data.mjs';
import {createDashboardServer} from './serve-openai-dashboard.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const {runCase}=require(resolve(PROJECT_ROOT,'tests/qa/process.cjs'));
const output=resolve(PROJECT_ROOT,'outputs/integration-remediation-implementation-20261104');
const NEW='integration-remediation-2026-11-04',MID='judgment-remediation-2026-11-03',OLD='openai-api-migration-2026-11-03',TAG='integration-remediation';
const readJson=async file=>JSON.parse(await readFile(file,'utf8')),sha=value=>createHash('sha256').update(value).digest('hex');
const baseline=await readJson(resolve(output,'baseline.json')),tasks=await readJson(resolve(PROJECT_ROOT,'.taskmaster/tasks/tasks.json'));
const manifest=await readJson(resolve(PROJECT_ROOT,'.taskmaster/docs/integration-remediation-manifest.json'));
const registry=await readJson(resolve(PROJECT_ROOT,'.taskmaster/docs/dashboard-plans.json'));
const children=rows=>rows.flatMap(t=>t.subtasks),done=rows=>rows.filter(t=>t.status==='done').length;
const checks=[],commands=[],browsers=[];const pass=name=>{checks.push(name);console.log('PASS '+name);};
const protectedFiles=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest),'package.json','package-lock.json','.openai/hosting.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(protectedFiles.map(async file=>[file,sha(await readFile(resolve(PROJECT_ROOT,file)))])));
const before=await hashes();await mkdir(output,{recursive:true});
await mkdir(resolve(PROJECT_ROOT,'.sites-runtime'),{recursive:true});
const fixture=await mkdtemp(join(resolve(PROJECT_ROOT,'.sites-runtime'),'implementation-dashboard-qa-'));
const copied=[...protectedFiles,'README.md'];
for(const dir of ['dashboard','scripts'])for(const file of await readdir(resolve(PROJECT_ROOT,'.taskmaster',dir)))copied.push('.taskmaster/'+dir+'/'+file);
for(const file of new Set(copied)){await mkdir(dirname(resolve(fixture,file)),{recursive:true});await copyFile(resolve(PROJECT_ROOT,file),resolve(fixture,file));}
await mkdir(resolve(fixture,'outputs/judgment-remediation-v4-evaluation'),{recursive:true});
const {server}=createDashboardServer({projectRoot:fixture});await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const local='http://127.0.0.1:'+server.address().port,actual='http://127.0.0.1:4318',fixtureTasks=resolve(fixture,'.taskmaster/tasks/tasks.json');
try{
  assert.equal(manifest.executionStarted,true);assert.equal(manifest.authorization.implementationApproved,true);
  for(const key of ['paidEvaluationApproved','deploymentIncludedAndApproved','externalPublicationApproved','productionQaWritesApproved'])assert.equal(manifest.authorization[key],false,key);
  assert.equal(registry.defaultPlanId,NEW);assert.equal(tasks[TAG].tasks.length,12);assert.equal(children(tasks[TAG].tasks).length,41);
  assert.equal(tasks[TAG].tasks[11].status,'deferred');assert.ok(tasks[TAG].tasks[11].subtasks.every(t=>t.status==='deferred'));
  assert.equal(manifest.execution.implementationDone,done(tasks[TAG].tasks));
  const visited=new Set(),visiting=new Set();
  function visit(id){assert.ok(!visiting.has(id),'dependency cycle');if(visited.has(id))return;const task=tasks[TAG].tasks.find(t=>Number(t.id)===id);assert.ok(task);visiting.add(id);for(const dep of task.dependencies)visit(Number(dep));visiting.delete(id);visited.add(id);}
  for(const task of tasks[TAG].tasks){visit(Number(task.id));if(task.status==='done'){assert.ok(task.subtasks.every(t=>t.status==='done'));for(const dep of task.dependencies)assert.equal(tasks[TAG].tasks.find(t=>Number(t.id)===Number(dep)).status,'done');}}
  if(process.argv.includes('--final')){assert.equal(done(tasks[TAG].tasks),11);assert.ok(manifest.gates.slice(0,6).every(g=>g.result.status==='passed'));}
  assert.equal(manifest.gates.at(-1).result.status,'held');
  pass('12/41 dependencies and parent/child progress match; implementation approved; publication/payment/production writes remain held');
  for(const [tag,hash]of Object.entries(baseline.oldTagHashes))assert.equal(sha(JSON.stringify(tasks[tag])),hash,tag);
  for(const [file,hash]of Object.entries({...baseline.oldEvidenceHashes,...baseline.rootSourceHashes}))assert.equal(sha(await readFile(resolve(PROJECT_ROOT,file))),hash,file);
  pass('both historical tags, 32 evaluation/evidence files and 637 original root source files unchanged');
  const live=await(await fetch(actual+'/api/tasks')).json(),direct=await readDashboardSnapshot(PROJECT_ROOT);
  assert.equal(live.source.hash,direct.source.hash);assert.equal(live.plan.id,NEW);assert.match(live.plan.budget,/승인 없음.*US\$0/);assert.doesNotMatch(live.plan.budget,/undefined|NaN/);
  for(const [id,count,total]of [[OLD,15,35],[MID,18,49]]){const old=live.planSnapshots[id];assert.equal(old.tasks.length,count);assert.equal(children(old.tasks).length,total);assert.ok(old.tasks.every(t=>t.status==='done'));}
  assert.match(live.planSnapshots[OLD].plan.budget,/4\.879124/);assert.match(live.planSnapshots[MID].plan.budget,/5\.625315.*7.*1\.374685/);
  for(const id of ['__proto__','unknown'])assert.equal((await fetch(local+'/api/tasks?plan='+id)).status,400);
  assert.equal((await fetch(local+'/api/tasks',{method:'POST'})).status,405);
  pass('actual root dashboard and no-evaluation implementation budget match source; old costs/gates and read-only API preserved');
  await buildDashboard(PROJECT_ROOT);
  for(const engine of ['chromium','webkit']){
    const browser=await pw[engine].launch({headless:true});browsers.push(browser);
    const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(![actual+'/',local+'/','file:','data:'].some(prefix=>r.url().startsWith(prefix)))external.push(r.url());});
    await page.goto(actual+'/');await page.locator('#leaf-total').filter({hasText:'41'}).waitFor();
    assert.equal(await page.locator('#leaf-done').textContent(),String(done(children(tasks[TAG].tasks))));
    assert.equal(await page.locator('#parent-done').textContent(),String(done(tasks[TAG].tasks)));
    assert.equal(await page.locator('#plan-tag').textContent(),TAG);assert.match(await page.locator('#plan-budget').textContent(),/US\$0/);
    for(const [id,total,completed]of [[OLD,35,35],[MID,49,49],[NEW,41,done(children(tasks[TAG].tasks))]]){
      await page.locator('[data-plan-id="'+id+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),String(total));assert.equal(await page.locator('#leaf-done').textContent(),String(completed));
    }
    for(const width of [320,390,768,1440])for(const size of [100,200]){await page.setViewportSize({width,height:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    if(process.env.AXE_CORE_PATH){await page.addScriptTag({path:process.env.AXE_CORE_PATH});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>v.id)),[]);}
    await page.screenshot({path:resolve(output,'dashboard-current-'+engine+'.png'),fullPage:true});
    // Mutate only the disposable fixture to prove polling, manual refresh and reload.
    const sample=structuredClone(tasks);for(const t of sample[TAG].tasks){t.status=Number(t.id)===12?'deferred':'pending';for(const s of t.subtasks)s.status=t.status;}
    await writeFile(fixtureTasks,JSON.stringify(sample));await page.goto(local+'/');await page.locator('#leaf-done').filter({hasText:'0'}).waitFor();
    sample[TAG].tasks[0].status='in-progress';sample[TAG].tasks[0].subtasks[0].status='done';await writeFile(fixtureTasks,JSON.stringify(sample));await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='1',{},{timeout:10000});
    sample[TAG].tasks[0].subtasks[1].status='done';await writeFile(fixtureTasks,JSON.stringify(sample));await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('leaf-done').textContent==='2');
    await page.reload();await page.locator('#leaf-done').filter({hasText:'2'}).waitFor();
    await writeFile(fixtureTasks,'{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('#leaf-done').textContent(),'2');
    await writeFile(fixtureTasks,JSON.stringify(tasks));await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'hidden'});
    await page.goto(pathToFileURL(resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/index.html')).href);await page.locator('#leaf-total').filter({hasText:'41'}).waitFor();assert.equal(await page.locator('#connection-mode').textContent(),'저장된 HTML 사본');
    for(const [id,total]of [[OLD,35],[MID,49],[NEW,41]]){await page.locator('[data-plan-id="'+id+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),String(total));}
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await browser.close();
    pass(engine+': current/old plans, actual counts, responsive/axe, polling/reload/error recovery and standalone HTML');
  }
  // Preserve original historical test outputs by executing byte-identical copies.
  for(const [label,script,args]of [['master','test-openai-dashboard.mjs',[]],['multi','test-multi-plan-dashboard.mjs',[]],['v143','verify-remediation-v4-dashboard.mjs',['--complete']]]){
    const scriptPath=resolve(fixture,'.taskmaster/scripts',script),oldCwd=process.cwd();assert.equal(sha(await readFile(scriptPath)),sha(await readFile(resolve(PROJECT_ROOT,'.taskmaster/scripts',script))));
    let result;try{process.chdir(fixture);result=await runCase([scriptPath,...args],{logPath:resolve(output,'dashboard-history-'+label+'.log'),timeoutMs:180000});}finally{process.chdir(oldCwd);}
    commands.push({label,...result});assert.equal(result.code,0);assert.equal(result.timedOut,false);
  }
  assert.deepEqual(await hashes(),before);pass('historical dashboard suites pass with their original evidence preserved; current source and approvals unchanged');
}catch(error){console.error(error);process.exitCode=1;}
finally{
  await Promise.allSettled(browsers.map(b=>b.close()));await new Promise(ok=>server.close(ok));
  await writeFile(resolve(output,'dashboard-verification.json'),JSON.stringify({passed:process.exitCode!==1,at:new Date().toISOString(),checks,commands,fixture,actual,paidCalls:0,productionWrites:0},null,2)+'\n');
}
