// Final product backup/restore qualification against the selected full build.
// Original tests are retained. Owned adapters change only output/require paths,
// block nonloopback browser requests and disable AI in a copied local harness.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(resolve(SOURCE,'package.json'));
const manifest=JSON.parse(await readFile(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')),ROOT=manifest.baseline.existingDashboardRoot;
const BUILD=resolve(process.env.QA_PRODUCT_BUILD_ROOT??SOURCE);assert.ok(BUILD===SOURCE||BUILD.startsWith(resolve(ROOT,'work')+'\\'));
const out=resolve(process.env.QA_OUTPUT_DIR);await mkdir(out,{recursive:false});
const sha=x=>createHash('sha256').update(x).digest('hex'),save=(name,v)=>writeFile(resolve(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const helperFile=resolve(SOURCE,'.taskmaster/scripts/ai-quality-v147-worker.mjs'),helper=await readFile(helperFile,'utf8'),needle="ai_feedback_enabled:'true'";
assert.equal(helper.split(needle).length,2);assert.equal(helper.split("from 'miniflare'").length,2);
const disabled=helper.replace(needle,"ai_feedback_enabled:'false'").replace("from 'miniflare'","from '"+pathToFileURL(require.resolve('miniflare')).href+"'"),adapter=resolve(out,'disabled-worker-adapter.mjs');await writeFile(adapter,disabled,{flag:'wx'});
const {startSyntheticWorker}=await import(pathToFileURL(adapter));
const axe=resolve(ROOT,'work/axe/package/axe.min.js'),axeBytes=await readFile(axe),axePackage=JSON.parse(await readFile(resolve(dirname(axe),'package.json'),'utf8'));
assert.equal(sha(axeBytes),'c24f097bd2f451d4f933e8bc7d8d539f8672a2ebcb5cc9f9f3eec8ca9470a0c1');
const originalFile=resolve(SOURCE,'tests/backup-qa.cjs'),original=await readFile(originalFile,'utf8'),observations=[];let attemptedEgress=0,profile;
const engines=process.env.QA_PRODUCT_ENGINE?[process.env.QA_PRODUCT_ENGINE]:['chromium','webkit'];assert.ok(engines.every(x=>['chromium','webkit'].includes(x)));
function child(script,engine,log){
 const env={};for(const key of ['Path','PATH','PATHEXT','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC'])if(process.env[key]!==undefined)env[key]=process.env[key];
 Object.assign(env,{QA_BASE_URL:profile.base,QA_BROWSER:engine,QA_PLAYWRIGHT_PATH:'C:/Users/user/.agents/skills/gstack/node_modules/playwright',AXE_CORE_PATH:axe,CI:'1'});
 const cp=spawn(process.execPath,[script],{cwd:SOURCE,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';cp.stdout.on('data',x=>stdout+=x.toString());cp.stderr.on('data',x=>stderr+=x.toString());
 return new Promise((yes,no)=>{const timer=setTimeout(()=>{cp.kill();no(Error('PRODUCT_QA_CHILD_TIMEOUT'));},180000);cp.once('error',no);cp.once('exit',async exitCode=>{clearTimeout(timer);await writeFile(log,stdout+stderr,{flag:'wx'});yes({exitCode,logSha256:sha(stdout+stderr)});});});
}
try{
 profile=await startSyntheticWorker({label:'candidate',buildSourceRoot:BUILD,workspaceRoot:SOURCE,allowedSentences:['Synthetic disabled QA input.'],respond:()=>{attemptedEgress++;throw Error('AI_FORBIDDEN_IN_PRODUCT_QA');}});
 const preflight=await fetch(profile.base+'/api/sentence-feedback',{headers:{'oai-authenticated-user-id':'synthetic-product-preflight','oai-authenticated-user-email':'qa@example.test','X-Study-AI-Contract':'4'}});assert.equal(preflight.status,200);assert.equal((await preflight.json()).enabled,false);
 for(const engine of engines){
  const folder=resolve(out,engine);await mkdir(folder);let code=original;assert.equal(code.split("out='outputs/backup-restore'").length,2);
  code=code.replace("out='outputs/backup-restore'",'out='+JSON.stringify(folder));
  code=code.replace(/require\('(\.\/qa\/[^']+)'\)/g,(_,path)=>'require('+JSON.stringify(resolve(SOURCE,'tests',path))+')');
  const marker='const p=await c.newPage();';assert.equal(code.split(marker).length,2);
  code=code.replace(marker,"await c.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===base||['data:','blob:'].includes(u.protocol)?route.fallback():route.abort('blockedbyclient')});"+marker);
  const originalClose="const close=async p=>{await p.getByRole('button',{name:'학습 기록 확인하기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await p.locator('[data-backup-trigger]:focus').waitFor({state:'visible',timeout:3000})};";
  assert.equal(code.split(originalClose).length,2);
  code=code.replace(originalClose,"const close=async p=>{await p.getByRole('button',{name:'학습 기록 확인하기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});try{await p.locator('[data-backup-trigger]:focus').waitFor({state:'visible',timeout:3000})}catch(error){const focus=await p.evaluate(()=>({hasFocus:document.hasFocus(),visibility:document.visibilityState,activeTag:document.activeElement?.tagName,activeBackup:document.activeElement?.hasAttribute('data-backup-trigger'),buttons:[...document.querySelectorAll('[data-backup-trigger]')].map(b=>({connected:b.isConnected,disabled:b.disabled,tabIndex:b.tabIndex,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,hidden:!!b.closest('[aria-hidden=true]')})),trace:globalThis.__backupFocusTrace}));fs.writeFileSync(out+'/focus-timeout.json',JSON.stringify(focus,null,2));await p.screenshot({path:out+'/focus-timeout.png'});throw error;}};");
  const finish='assert.equal(aiCalls,0);assert.deepEqual(errors,[]);';assert.equal(code.split(finish).length,2);
  code=code.replace(finish,"for(const method of ['close','download']){await p.getByRole('button',{name:'기록 관리',exact:true}).click();await p.getByRole('menuitem',{name:'전체 백업',exact:true}).click();await p.getByRole('heading',{name:'전체 백업',exact:true}).waitFor();if(method==='close'){await axe(p,'export dialog');await p.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();}else{const download=p.waitForEvent('download');await p.getByRole('button',{name:'백업 파일 다운로드',exact:true}).click();await download;}await p.getByRole('dialog').waitFor({state:'hidden'});await p.locator('[data-backup-trigger]:focus').waitFor({state:'visible',timeout:3000});checks.push('actual export '+method+' returns focus to the retained record-management button');}"+finish);
  code=code.replace(finish,"await c.unroute('**/api/state/restore');const capability=await c.request.get(base+'/api/state/restore');assert.equal(capability.status(),200);assert.equal((await capability.json()).enabled,true);const jobIncoming=sample(),jobBefore=await get(c);let jobCommits=0;await p.route('**/api/state/restore/jobs/*/commit',async route=>{jobCommits++;const response=await route.fetch();assert.equal(response.status(),200);await route.abort('failed');});await preview(p,envelope(jobIncoming));await acknowledge(p);await confirm(p);await success(p);assert.equal(jobCommits,1);const jobAfter=await get(c);assert.equal(jobAfter.revision,jobBefore.revision+1);assert.deepEqual(jobAfter.state,jobIncoming);await p.unroute('**/api/state/restore/jobs/*/commit');await close(p);checks.push('actual enabled restore job reconciles a lost commit response once, preserves draft and returns focus');"+finish);
  const script=resolve(folder,'backup-qa-owned.cjs');await writeFile(script,code,{flag:'wx'});const result=await child(script,engine,resolve(folder,'backup-qa.log'));
  assert.equal(result.exitCode,0,engine+' backup/restore failed;inspect owned log');const report=JSON.parse(await readFile(resolve(folder,'browser.json'),'utf8'));assert.equal(report.passed,true);assert.equal(report.aiCalls,0);assert.deepEqual(report.browserErrors,[]);assert.ok(report.a11y.length>=4&&report.a11y.every(x=>x.violations.length===0));assert.ok(report.performance.some(x=>x.bytes>3000000));
  observations.push({engine,...result,checks:report.checks.length,axeChecks:report.a11y.length,restoreRequests:report.restoreRequests,aiCalls:report.aiCalls,originalTestSha256:sha(original),adapterSha256:sha(code),performance:report.performance});console.log('PASS '+engine+': actual built UI/Worker/D1 backup,restore,revision/lost-response/650records and axe'+report.a11y.length);
 }
 assert.equal(attemptedEgress,0);await profile.stop();
  await save('product-qualification.json',{passed:true,observations,buildRoot:BUILD,worker:{...profile.proof,stopped:true,aiEnabled:false,attemptedEgress,realProviderEgress:0},helperOriginalSha256:sha(helper),helperAdapterSha256:sha(disabled),allowedHelperChanges:['ai_feedback_enabled true→false','miniflare module resolution only'],allowedTestChanges:['absolute output path','absolute original require paths','block nonloopback browser network','focus diagnostics only;original3000ms focus assertion retained','two actual export close/download focus checks','small actual enabled restore job with one lost commit response and focus assertion'],axeVersion:axePackage.version,axeSha256:sha(axeBytes),actualProviderCalls:0,actualKeyReads:0,physicalIphoneVoiceOver:false,scope:'Selected-engine actual built product backup/restore/export and accessibility. Other relevant flows retain their hash-verified earlier evidence.'});
 console.log(JSON.stringify({passed:true,engines:observations.length,functionalChecks:observations.reduce((n,x)=>n+x.checks,0),axeChecks:observations.reduce((n,x)=>n+x.axeChecks,0),actualProviderCalls:0,exitCode:0}));
}catch(error){
 await save('product-qualification-failure.json',{passed:false,observations,attemptedEgress,actualProviderCalls:0,code:'PRODUCT_QUALIFICATION_FAILURE'});throw error;
}finally{if(profile)await profile.stop();}
assert.ok((await readdir(out)).includes('product-qualification.json'));
