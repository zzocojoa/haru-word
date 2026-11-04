// Current read-only local dashboard, isolated headless browsers; no production or AI requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),pw=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const complete=process.argv[2]==='--complete';assert.ok(process.argv.length===2||(process.argv.length===3&&complete));
const expected={parents:complete?18:17,children:complete?49:46,R4:complete?'검증 통과':'활성화 보류'};
const url='http://127.0.0.1:4318',checks=[];
for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true});
 try{for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url+'/'))external.push(r.url());});
  await page.goto(url+'/?plan=judgment-remediation-2026-11-03');await page.locator('#leaf-done').filter({hasText:String(expected.children)}).waitFor();
  assert.equal(await page.locator('#parent-done').textContent(),String(expected.parents));assert.equal(await page.locator('#parent-total').textContent(),'18');
  assert.equal(await page.locator('#leaf-total').textContent(),'49');
  assert.equal(await page.locator('[data-gate="R3"] [data-gate-result]').textContent(),'검증 통과');
  assert.equal(await page.locator('[data-gate="R4"] [data-gate-result]').textContent(),expected.R4);
  if(complete)assert.equal(await page.locator('#overall-percent').textContent(),'100');
  assert.ok((await page.locator('#plan-budget').innerText()).includes('5.625315'));
  const context=await page.locator('#plan-context').innerText();assert.ok(context.includes('30/30')&&context.includes('백업'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  checks.push({engine,width,parentsDone:expected.parents,childrenDone:expected.children,totalParents:18,totalChildren:49,R3:'passed',R4:complete?'passed':'held',overflow:false,externalRequests:0,pageErrors:0});
  await page.close();
 }}finally{await browser.close();}
}
const proof={passed:true,checkedAt:new Date().toISOString(),checks,scope:'Current local dashboard state and mobile layout only; no user-browser control, production access or paid calls.'};
writeFileSync('outputs/judgment-remediation-v4-evaluation/'+(complete?'dashboard-complete-verification.json':'dashboard-current-verification.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:checks.length}));
