import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {PROJECT_ROOT,readDashboardSnapshot} from './openai-dashboard-data.mjs';
import {createDashboardServer} from './serve-openai-dashboard.mjs';

const TAG='astryx-adoption',PLAN='astryx-adoption-2026-11-18';
const dataOnly=process.argv.includes('--data-only');
assert(process.argv.slice(2).every(a=>a==='--data-only'),'Unknown option');
const json=async p=>JSON.parse(await readFile(resolve(PROJECT_ROOT,p),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const objectHash=value=>sha(JSON.stringify(value));
const out=resolve(PROJECT_ROOT,process.env.QA_OUTPUT_DIR||'outputs/astryx-adoption-plan-20261118');
await mkdir(out,{recursive:true});
const checks=[],browsers=[];let server;
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
try{
 const manifest=await json('.taskmaster/docs/astryx-adoption-manifest.json');
 const registry=await json('.taskmaster/docs/dashboard-plans.json');
 const source=await json('.taskmaster/tasks/tasks.json');
 const inputPaths=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest)];
 const hashes=async()=>Object.fromEntries(await Promise.all(inputPaths.map(async p=>[p,sha(await readFile(resolve(PROJECT_ROOT,p)))])));
 const before=await hashes(),tasks=source[TAG].tasks,ids=new Set(tasks.map(t=>String(t.id)));
 assert.equal(manifest.planId,PLAN);assert.equal(manifest.tag,TAG);
 assert.equal(registry.defaultPlanId,PLAN);assert.equal(registry.plans.length,Object.keys(manifest.baseline.priorTagHashes).length+1);
 assert.equal(tasks.length,18);assert.equal(tasks.flatMap(t=>t.subtasks).length,62);assert.equal(ids.size,tasks.length);
 assert.equal(source[TAG].metadata.taskCount,tasks.length);
 for(const task of tasks){
  assert(task.description&&task.details&&task.testStrategy);
  const children=new Set(task.subtasks.map(s=>String(s.id)));assert.equal(children.size,task.subtasks.length);
  for(const dependency of task.dependencies)assert(ids.has(String(dependency))&&Number(dependency)<Number(task.id),'Invalid/cyclic parent dependency');
  for(const child of task.subtasks){assert(child.details&&child.description);for(const dependency of child.dependencies)assert(children.has(String(dependency))&&Number(dependency)<Number(child.id),'Invalid/cyclic child dependency');}
  const planned=manifest.tasks.find(t=>String(t.id)===String(task.id));assert(planned);assert.equal(planned.subtaskCount,task.subtasks.length);
 }
 assert(tasks.find(t=>Number(t.id)===3).dependencies.map(Number).includes(2),'Fixture must precede install');
 for(const dep of [2,3,4,5])assert(tasks.find(t=>Number(t.id)===6).dependencies.map(Number).includes(dep),'Foundation dependency missing');
 assert(tasks.find(t=>Number(t.id)===7).dependencies.map(Number).includes(6));
 assert(tasks.find(t=>Number(t.id)===15).dependencies.map(Number).includes(14));
 assert(tasks.find(t=>Number(t.id)===16).dependencies.map(Number).includes(15));
 assert(tasks.find(t=>Number(t.id)===18).dependencies.map(Number).includes(17));
 const covered=new Set(manifest.requirements.flatMap(r=>r.tasks.map(String)));assert.deepEqual([...covered].sort(),[...ids].sort());
 assert.equal(manifest.tasks.filter(t=>t.phase===1).reduce((n,t)=>n+t.subtaskCount,0),20);
 assert.equal(manifest.tasks.filter(t=>t.phase===2).reduce((n,t)=>n+t.subtaskCount,0),42);
 if(!manifest.executionStarted){assert(tasks.every(t=>t.status==='pending'&&t.subtasks.every(s=>s.status==='pending')));assert.equal(source[TAG].metadata.completedCount,0);}
 assert.equal(manifest.authorization.paidEvaluationApproved,false);assert.equal(manifest.authorization.newPaidEvaluationMaxUsdBeforeTax,0);
 if(manifest.authorization.deploymentIncludedAndApproved){
  assert.equal(manifest.authorization.githubCommitPushPrApproved,true);
  assert.equal(manifest.authorization.productionQaWritesApproved,false);
  assert.equal(manifest.authorization.publicationApproval.reply,'승인 — GitHub 반영·기존 Site 게시 진행');
  assert.equal(manifest.authorization.publicationApproval.source,'explicit user reply in this chat');
  assert.equal(manifest.authorization.publicationApproval.review,'outputs/astryx-t9-t18-20261118/t18-preapproval-readiness.json');
 }else assert.equal(manifest.authorization.deploymentIncludedAndApproved,false);
 const deviceGate=manifest.gates.find(g=>g.id==='AX-IOS').result.status;
 if(deviceGate==='passed'){
  const implementation=await json('.taskmaster/docs/astryx-adoption-t9-t18-implementation.json'),manual=implementation.phases['17'].manualAccess,final=manual.finalManualValidation;
  assert.equal(manual.actualIphone,true);assert.equal(manual.fullDeviceValidation,true);
  for(const id of ['M0','M1','M2','M3','M4','M5','M6','M7'])assert.equal(manual.checks[id].status,'passed',id+' device check incomplete');
  assert.equal(manual.openFindings.length,0);assert.equal(manual.resolvedFindings.length,3);
  assert(manual.resolvedFindings.every(f=>f.status==='resolved-user-device-confirmed'));
  assert.equal(final.status,'passed');assert.equal(final.agentDirectDeviceObservation,false);
  assert.equal(final.source,'t17-iphone2-source.json');assert.equal(final.finalReadyEquivalence,'t17-ready-format-verification.json');
  assert.equal(Object.keys(final.finalChecks).length,5);assert(Object.values(final.finalChecks).every(c=>c.status==='passed'));
  assert.equal(final.temporaryGateway.stoppedAfterChecks,true);assert.equal(manual.temporaryServersStopped,true);
  assert.equal(final.paidAiCalls,0);assert.equal(final.productionQaWrites,0);
  assert.equal(tasks.find(t=>Number(t.id)===17).status,'done');
 }else assert.equal(deviceGate,'held');
 const publicationGate=manifest.gates.find(g=>g.id==='AX-PUB').result.status;
 if(publicationGate==='passed'){
  const publication=(await json('.taskmaster/docs/astryx-adoption-t9-t18-implementation.json')).phases['18'];
  assert.equal(manifest.authorization.deploymentIncludedAndApproved,true);
  assert.equal(publication.nativeDeployment.status,'succeeded');assert(Number.isInteger(publication.nativeDeployment.versionNumber));
  assert.equal(publication.github.merged,true);assert.equal(publication.github.requiredCiPassed,true);
  assert.equal(publication.archive.verified,true);assert.match(publication.archive.sha256,/^[a-f0-9]{64}$/);
  assert.equal(publication.productionReadOnlyVerification.passed,true);
  assert.equal(manifest.execution.publicationStatus,'published');
 }else assert.equal(publicationGate,'held');
 pass('18 parents/62 children, phase20/42, prerequisite graph, coverage and evidence-backed separate quality/device/publication gates');
 for(const [tag,hash]of Object.entries(manifest.baseline.priorTagHashes))assert.equal(objectHash(source[tag]),hash,'Historical task/tag changed: '+tag);
 for(const [file,hash]of Object.entries(manifest.baseline.priorManifestHashes))assert.equal(sha(await readFile(resolve(PROJECT_ROOT,file))),hash,'Historical manifest changed: '+file);
 const old=source['ai-quality-v147'].tasks;assert.equal(old.filter(t=>t.status==='done').length,30);assert.equal(old.flatMap(t=>t.subtasks).filter(t=>t.status==='done').length,103);
 assert.equal(source.master.tasks.flatMap(t=>t.subtasks).length,35);
 pass('all five historical task objects and manifests unchanged, including AI30/40 and103/133');
 const direct=await readDashboardSnapshot(PROJECT_ROOT),live=await(await fetch('http://127.0.0.1:4318/api/tasks')).json();
 const health=await(await fetch('http://127.0.0.1:4318/api/health')).json();
 assert.equal(health.projectKey,sha(resolve(PROJECT_ROOT)).slice(0,20));assert.equal(live.source.hash,direct.source.hash);
 assert.equal(live.plan.id,PLAN);assert.equal(live.tasks.length,18);assert.equal(live.tasks.flatMap(t=>t.subtasks).length,62);
 assert.equal(live.catalog.plans.length,6);assert.match(live.plan.budget,/US\$0/);assert.doesNotMatch(live.plan.budget,/undefined|NaN/);
 for(const entry of registry.plans){const item=live.planSnapshots[entry.id];assert.equal(item.tasks.length,source[item.source.tag].tasks.length);assert.equal(item.tasks.flatMap(t=>t.subtasks).length,source[item.source.tag].tasks.flatMap(t=>t.subtasks).length);}
 assert.equal(live.planSnapshots['openai-api-migration-2026-11-03'].plan.gates.find(g=>g.id==='G4').result.status,'held');
 pass('actual4318 serves this ROOT and new default18/62, all6 independent counts/budgets/gates match source');
 if(!dataOnly){
  const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
  const fixture=await mkdtemp(join(resolve(PROJECT_ROOT,'.sites-runtime'),'astryx-dashboard-'));
  for(const file of inputPaths){await mkdir(dirname(resolve(fixture,file)),{recursive:true});await copyFile(resolve(PROJECT_ROOT,file),resolve(fixture,file));}
  ({server}=createDashboardServer({projectRoot:fixture}));await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  const url='http://127.0.0.1:'+server.address().port;
  const write=async(file,value)=>writeFile(resolve(fixture,file),typeof value==='string'?value:JSON.stringify(value));
  const oldRegistry=structuredClone(registry);oldRegistry.plans=oldRegistry.plans.filter(p=>p.id!==PLAN);oldRegistry.defaultPlanId=manifest.baseline.priorDefaultPlanId;oldRegistry.plans.find(p=>p.id===oldRegistry.defaultPlanId).kind='current';
  const doneBefore=tasks.flatMap(t=>t.subtasks).filter(t=>t.status==='done').length;
  const percentBefore=String(Math.round(doneBefore/62*100));
  for(const engine of ['chromium','webkit']){
   await write('.taskmaster/docs/dashboard-plans.json',oldRegistry);await write('.taskmaster/tasks/tasks.json',source);
   const browser=await pw[engine].launch({headless:true});browsers.push(browser);
   const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);assert.equal(await page.locator('[data-plan-id]').count(),5);
   await write('.taskmaster/docs/dashboard-plans.json',registry);
   await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelectorAll('[data-plan-id]').length===6);
   await page.locator('[data-plan-id="'+PLAN+'"]').click();assert.equal(await page.locator('#leaf-total').textContent(),'62');assert.equal(await page.locator('#parent-total').textContent(),'18');assert.equal(await page.locator('#overall-percent').textContent(),percentBefore);assert.equal(await page.locator('#integrity-warning').isVisible(),false);
   const changed=structuredClone(source),target=changed[TAG].tasks.find(t=>t.subtasks.some(s=>s.status!=='done'))||changed[TAG].tasks[0];
   const child=target.subtasks.find(s=>s.status!=='done')||target.subtasks[0],nextDone=doneBefore+(child.status==='done'?-1:1);
   target.status='in-progress';child.status=child.status==='done'?'pending':'done';
   await write('.taskmaster/tasks/tasks.json',changed);await page.locator('#refresh').click();await page.waitForFunction(n=>document.getElementById('leaf-done').textContent===String(n),nextDone);assert.equal(await page.locator('#overall-percent').textContent(),String(Math.round(nextDone/62*100)));
   await page.locator('[data-plan-id="'+manifest.baseline.priorDefaultPlanId+'"]').click();assert.equal(await page.locator('#leaf-done').textContent(),'103');assert.equal(await page.locator('#leaf-total').textContent(),'133');
   await page.locator('[data-plan-id="'+PLAN+'"]').click();assert.equal(await page.locator('#leaf-done').textContent(),String(nextDone));
   await write('.taskmaster/tasks/tasks.json','{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('#leaf-done').textContent(),String(nextDone));
   await write('.taskmaster/tasks/tasks.json',source);await page.locator('#refresh').click();await page.waitForFunction(n=>document.getElementById('leaf-done').textContent===String(n),doneBefore);
   for(const entry of registry.plans){await page.locator('[data-plan-id="'+entry.id+'"]').click();const item=direct.planSnapshots[entry.id];assert.equal(await page.locator('#parent-total').textContent(),String(item.tasks.length));assert.equal(await page.locator('#leaf-total').textContent(),String(item.tasks.flatMap(t=>t.subtasks).length));}
   await page.goto(pathToFileURL(resolve(PROJECT_ROOT,'outputs/openai-migration-dashboard/index.html')).href);assert.equal(await page.locator('#plan-tag').textContent(),TAG);assert.equal(await page.locator('[data-plan-id]').count(),6);assert.equal(await page.locator('#leaf-total').textContent(),'62');assert.equal(await page.locator('#connection-mode').textContent(),'저장된 HTML 사본');
   await page.screenshot({path:resolve(out,engine+'-new-plan.png')});assert.deepEqual(errors,[]);await browser.close();
   pass(engine+': existing page refresh5→6, exact new/old counts, fixture-only progress/error/recovery, standalone HTML');
  }
 }
 assert.deepEqual(await hashes(),before);pass('QA changed only isolated fixtures; canonical tasks/registry/all manifests unchanged');
 const result={passed:true,mode:dataOnly?'data-only':'data-and-browser',planId:PLAN,tag:TAG,parents:18,subtasks:62,previousPlans:5,registeredPlans:6,implementationStarted:manifest.executionStarted,paidModelCalls:0,sourceHashes:before,checks};
 const validationFile=manifest.dashboardValidationFile??(manifest.executionStarted?'.taskmaster/docs/astryx-adoption-dashboard-validation.json':'.taskmaster/docs/astryx-adoption-validation.json');
 await writeFile(resolve(PROJECT_ROOT,validationFile),JSON.stringify(result,null,2)+'\n');
 await writeFile(resolve(out,dataOnly?'data-results.json':'plan-dashboard-results.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks:checks.length,mode:result.mode}));
}catch(error){console.error(error);await writeFile(resolve(out,'failed-check.json'),JSON.stringify({message:error.message,checks},null,2)+'\n');process.exitCode=1;}
finally{for(const b of browsers)await b.close().catch(()=>{});if(server)await new Promise(ok=>server.close(ok));}
