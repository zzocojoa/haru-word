const assert=require('node:assert/strict');
const fs=require('node:fs');
const {build}=require('esbuild');
const {createServer}=require('node:http');
const {launchBrowser,closeBrowser}=require('./qa/runtime.cjs');
(async()=>{
 const directory='work/feedback-correction-qa';fs.mkdirSync(directory,{recursive:true});
 await build({entryPoints:['tests/feedback-correction-harness.tsx'],outfile:directory+'/harness.js',bundle:true,format:'iife',platform:'browser',logLevel:'silent',define:{'process.env.NODE_ENV':'"development"'}});
 const server=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="ko"><body><div id="root"></div></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await launchBrowser(),page=await browser.newPage({viewport:{width:390,height:844}}),checks=[],errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/*',route=>route.request().url()===base+'/'?route.continue():route.abort());
 const pass=name=>{checks.push(name);console.log('PASS '+name);};
 const reset=async(mode='word',sentence='She sing well.',uncertain=false)=>{const previous=await page.locator('main').getAttribute('data-harness-epoch');await page.evaluate(({mode,sentence,uncertain})=>window.correctionHarness.reset(mode,sentence,uncertain),{mode,sentence,uncertain});await page.waitForFunction(old=>document.querySelector('main')?.getAttribute('data-harness-epoch')!==old,previous);await page.getByRole('textbox',{name:'내 문장',exact:true}).waitFor();await page.waitForFunction(s=>document.querySelector('textarea')?.value===s,sentence);if(mode==='word')await page.getByRole('textbox',{name:'의도한 한국어 문장',exact:true}).fill('그녀는 노래를 잘해.');};
 const field=()=>page.getByRole('textbox',{name:'내 문장',exact:true});
 const apply=()=>page.getByRole('button',{name:'AI 제안으로 문장 바꾸기',exact:true});
 const confirm=()=>page.getByRole('button',{name:'비교한 제안으로 바꾸기',exact:true});
 const undo=()=>page.getByRole('button',{name:'교정 적용 되돌리기',exact:true});
 try{
  await page.goto(base+'/');await page.addScriptTag({path:directory+'/harness.js'});await field().waitFor();await page.getByRole('textbox',{name:'의도한 한국어 문장',exact:true}).fill('그녀는 노래를 잘해.');
  assert.equal(await page.evaluate(()=>window.correctionHarness.requests()),0);
  await page.getByRole('button',{name:'AI 참고 의견 다시 요청',exact:true}).click();
  await page.waitForFunction(()=>window.correctionHarness.requests()===1);
  await page.getByRole('button',{name:'AI 참고 의견 다시 요청',exact:true}).waitFor();
  await page.getByRole('button',{name:'AI 참고 의견 다시 요청',exact:true}).click();
  await page.waitForFunction(()=>window.correctionHarness.requests()===2);pass('same-sentence legacy and uncertain feedback recheck only after explicit clicks');
  await reset();await page.evaluate(()=>window.correctionHarness.setDelay(true));
  await page.getByRole('button',{name:'AI 참고 의견 다시 요청',exact:true}).click();await page.waitForFunction(()=>window.correctionHarness.requests()===1);
  assert.equal(await page.getByRole('button',{name:'문장을 확인하고 있어요',exact:true}).isDisabled(),true);await page.evaluate(()=>window.correctionHarness.finish());
  await page.getByRole('button',{name:'AI 참고 의견 다시 요청',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.correctionHarness.requests()),1);pass('pending feedback prevents a second request and releases its lock on completion');
  for(const mode of ['word','grammar']){
   await reset(mode);await apply().click();assert.equal(await field().inputValue(),'She sing well.');await confirm().click();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='She sings well.');
   assert.equal(await undo().isVisible(),true);await undo().click();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='She sing well.');
   pass(mode+' explicit comparison and undo preserve the original');
   await reset(mode);await field().fill('My newer unsaved sentence.');assert.equal(await apply().count(),0);assert.equal(await field().inputValue(),'My newer unsaved sentence.');pass(mode+' stale input cannot apply an older proposal');
   await reset(mode);await apply().click();await field().fill('Edited after comparison.');assert.equal(await confirm().isDisabled(),true);await field().fill('She sing well.');await confirm().click();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='She sings well.');
   await field().fill('Edited after applying.');assert.equal(await undo().isDisabled(),true);assert.equal(await field().inputValue(),'Edited after applying.');pass(mode+' edits invalidate confirmation and protect later edits from undo');
  }
  await reset('word');await apply().click();await page.evaluate(()=>window.correctionHarness.changeProposal());await page.getByText('문장이나 제안이 바뀌었어요. 다시 비교해 주세요.',{exact:true}).waitFor();assert.equal(await confirm().isDisabled(),true);pass('a refreshed proposal invalidates the old confirmation');
  await reset();await apply().click();await confirm().click();await undo().waitFor();await page.waitForFunction(()=>document.activeElement?.textContent==='교정 적용 되돌리기');assert.equal(await undo().evaluate(e=>e===document.activeElement),true);
  await undo().click();await apply().waitFor();await page.waitForFunction(()=>document.activeElement?.textContent==='AI 제안으로 문장 바꾸기');assert.equal(await apply().evaluate(e=>e===document.activeElement),true);pass('keyboard focus follows apply and undo actions');
  await reset('grammar');await page.evaluate(()=>window.correctionHarness.setBusy(true));await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='AI 제안으로 문장 바꾸기')?.disabled);assert.equal(await apply().isDisabled(),true);pass('grammar corrections respect the save and request lock');
  for(const mode of ['word','grammar']){await reset(mode,'  She sings well.  ');assert.equal(await apply().count(),0);assert.equal(await field().inputValue(),'  She sings well.  ');}pass('whitespace-only differences do not offer an unnecessary rewrite');
  for(const version of [4,5]){
   for(const kind of ['time','relationship']){
    const previous=await page.locator('main').getAttribute('data-harness-epoch');
    await page.evaluate(({version,kind})=>window.correctionHarness.showReference(version,kind),{version,kind});
    await page.waitForFunction(old=>document.querySelector('main')?.getAttribute('data-harness-epoch')!==old,previous);
    await page.getByText('수업 목표는 해당 표현을 알맞게 사용했는지에 대한 의견이에요.',{exact:true}).waitFor();
    const text=await page.locator('main').innerText();
    if(version===4){assert.match(text,/보관된 v4 합성 설명과 질문을 유지합니다/);assert.doesNotMatch(text,/이미 일어난|앞뒤 내용에서/);}
    else if(kind==='time'){assert.match(text,/이미 일어난 일을 말하나요, 앞으로 일어날 일을 말하나요/);assert.match(text,/수업 목표 · 보완 필요/);}
    else{assert.match(text,/앞뒤 내용에서 각각 무슨 일이 일어나고/);assert.match(text,/수업 목표 · 문맥 확인 필요/);}
    assert.match(text,/문법 · 판단 어려움/);assert.equal(await apply().count(),0);assert.equal(await page.getByText('AI 교정 제안',{exact:true}).count(),0);
   }pass(version===4?'historical v4 explanations remain read-only without question conversion':'v5 temporal and relationship questions render separately without invented corrections');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[base+'/']);pass('no page errors, account requests or external/provider traffic');
  const out='outputs/feedback-correction';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/'+(process.env.QA_BROWSER||'chromium')+'.json',JSON.stringify({engine:process.env.QA_BROWSER||'chromium',passed:checks.length,checks,errors,networkRequests:requests.length,scope:'Isolated React interaction harness, synthetic data; not a built Worker or real iPhone test'},null,2));
 }finally{try{await closeBrowser(browser);}finally{await new Promise(resolve=>server.close(resolve));}}
})().catch(error=>{console.error(error);process.exitCode=1;});
