const {build} = require('esbuild');
const { launchBrowser, closeBrowser } = require('./qa/runtime.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs');
const out = 'outputs/clock-reliability'; fs.mkdirSync(out, {recursive:true});
(async()=>{
 await build({entryPoints:['tests/study-clock-harness.tsx'],outfile:out+'/harness.js',bundle:true,format:'iife',platform:'browser',logLevel:'silent',define:{'process.env.NODE_ENV':'"development"'}});
 const browser=await launchBrowser();
 try {
  const page=await browser.newPage(); await page.setContent('<html lang="ko"><body><div id="root"></div></body></html>'); await page.addScriptTag({path:out+'/harness.js'});
  await page.waitForFunction(()=>window.clockHarness?.count()===1); await page.evaluate(()=>window.clockHarness.fail(0)); await page.waitForFunction(()=>window.clockHarness.clock.error);
  // Repeated taps were independently starting concurrent requests on the retry button.
  await page.getByRole('button',{name:'refresh',exact:true}).click(); await page.getByRole('button',{name:'refresh',exact:true}).click();
  const count=await page.evaluate(()=>window.clockHarness.count());
  if(process.env.CLOCK_BASELINE){
   assert.equal(count,3);
   await page.evaluate(()=>window.clockHarness.resolve(2, Date.parse('2026-09-22T15:01:00Z'))); await page.waitForFunction(()=>window.clockHarness.clock.ready);
   await page.evaluate(()=>window.clockHarness.fail(1)); await page.waitForFunction(()=>window.clockHarness.clock.error);
   const state=await page.locator('#clock-state').innerText(); assert.equal(JSON.parse(state).ready,false);
   const result={reproduced:true,requests:count,finalState:JSON.parse(state),reason:'An older retry failure overwrote a newer successful clock synchronization and disabled learning again.'};
   fs.writeFileSync(out+'/before.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result)); return;
  }
  assert.equal(count,2,'overlapping refreshes must reuse the active request without resetting its deadline');
  await page.evaluate(()=>window.clockHarness.resolve(1,Date.parse('2026-09-22T15:01:00Z'))); await page.waitForFunction(()=>window.clockHarness.clock.ready);
  assert.equal(await page.evaluate(()=>window.clockHarness.clock.date),'2026-09-23');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus'))); await page.waitForFunction(()=>window.clockHarness.count()===3);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'))});
  assert.equal(await page.evaluate(()=>window.clockHarness.count()),3);
  await page.evaluate(()=>window.clockHarness.resolve(2)); await page.waitForFunction(()=>window.clockHarness.clock.ready);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus'))); await page.waitForFunction(()=>window.clockHarness.count()===4);
  await page.evaluate(()=>window.clockHarness.visibility('hidden')); await page.waitForFunction(()=>!window.clockHarness.clock.ready);
  assert.equal(await page.evaluate(()=>window.clockHarness.aborted(3)),true);
  await page.evaluate(()=>window.clockHarness.visibility('visible')); await page.waitForFunction(()=>window.clockHarness.count()===5);
  await page.evaluate(()=>window.clockHarness.resolve(4,Date.parse('2026-09-22T15:01:00Z'))); await page.waitForFunction(()=>window.clockHarness.clock.ready);
  await page.evaluate(()=>window.clockHarness.fail(3));
  assert.deepEqual(await page.evaluate(()=>({date:window.clockHarness.clock.date,ready:window.clockHarness.clock.ready,error:window.clockHarness.clock.error})),{date:'2026-09-23',ready:true,error:false});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus'))); await page.waitForFunction(()=>window.clockHarness.count()===6);
  await page.evaluate(()=>{window.clockHarness.visibility('hidden');window.clockHarness.visibility('visible')}); await page.waitForFunction(()=>window.clockHarness.count()===7);
  await page.evaluate(()=>window.clockHarness.resolve(6,Date.parse('2026-09-22T15:01:00Z'))); await page.waitForFunction(()=>window.clockHarness.clock.ready);
  await page.evaluate(()=>window.clockHarness.resolve(5,Date.parse('2026-09-20T00:00:00Z')));
  assert.equal(await page.evaluate(()=>window.clockHarness.clock.date),'2026-09-23');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus'))); await page.waitForFunction(()=>window.clockHarness.count()===8);
  await page.evaluate(()=>window.clockHarness.unmount()); assert.equal(await page.evaluate(()=>window.clockHarness.aborted(7)),true);
  await page.evaluate(()=>window.clockHarness.resolve(7)); assert.equal(await page.locator('#clock-state').count(),0);
  const result={passed:true,checks:['overlapping manual refreshes share one request','wake event bursts do not reset the request timeout','successful synchronization clears errors and applies the Korean midnight date','hiding cancels a pending clock request; waking synchronizes before enabling writes','late failures and stale dates cannot overwrite a newer wake synchronization','unmount cancels the request and ignores its late response']};
  fs.writeFileSync(out+'/after.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
 }finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exit(1)});
