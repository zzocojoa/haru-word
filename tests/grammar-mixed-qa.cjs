// Loopback + synthetic accounts only. Network failure is injected; no AI calls.
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath } = require('./qa/runtime.cjs');
(async()=>{
 await build({entryPoints:['lib/grammar/content-v2.ts','lib/grammar/practice.ts','lib/grammar/model.ts'],outdir:'work/grammar-mixed-qa',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'},logLevel:'silent'});
 const {PRACTICE_LESSONS}=require('../work/grammar-mixed-qa/content-v2.cjs');
 const {newLessonProgress}=require('../work/grammar-mixed-qa/practice.cjs');
 const {recordAnswer}=require('../work/grammar-mixed-qa/model.cjs');
 const p=newLessonProgress('auxiliary'),l=PRACTICE_LESSONS.auxiliary;
 p.stage=4;p.observation=recordAnswer(undefined,l.observation.answer);
 p.answers={q1:recordAnswer(undefined,l.questions[0].answer),q2:recordAnswer(undefined,l.questions[1].answer),q3:recordAnswer(undefined,'I am now reading.')};
 const browser=await launchBrowser({engine:process.env.QA_ENGINE||'chromium'}),context=await browser.newContext({extraHTTPHeaders:accountHeaders('grammar_mixed'),viewport:{width:390,height:844}}),page=await context.newPage();
 const snapshot=async()=>(await context.request.get(base+'/api/state',{headers:{'X-Study-Grammar':'3'}})).json();
 const until=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('persistence timeout');};
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const library=async()=>{await page.getByRole('tab',{name:'단어장',exact:true}).click();await page.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();};
 let fail=false;
 await page.route('**/api/state',async route=>{if(fail&&route.request().method()==='PUT'){fail=false;return route.fulfill({status:503,json:{error:'테스트 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.'}});}return route.continue();});
 try{
  const s=await snapshot();assert.equal((await context.request.put(base+'/api/state',{headers:{'X-Study-Grammar':'3'},data:{revision:s.revision,progress:{},sessions:{},grammar:{auxiliary:p,noun:{stage:0,answers:{},sentence:'',updatedAt:new Date().toISOString()}}}})).status(),200);
  await page.goto(base);await library();
  const group=page.locator('.grammar-group').filter({has:page.locator('h3',{hasText:'동사를 돕는 표현'})});await group.locator('summary').click();
  await page.locator('.grammar-tile').filter({has:page.locator('b',{hasText:/^기본 조동사$/})}).click();
  assert.match(await page.locator('.grammar-feedback').innerText(),/처음엔 오답/);assert.match(await page.locator('.grammar-feedback').innerText(),/I am now reading/);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  await page.setViewportSize({width:320,height:900});const zoom=await page.addStyleTag({content:'html{font-size:200%!important}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa']})).violations.map(v=>v.id)),[]);
  await page.getByRole('button',{name:'다음',exact:true}).focus();await page.keyboard.press('Enter');await zoom.evaluate(el=>el.remove());
  const sentence=page.getByRole('textbox',{name:'내 문장',exact:true});await until(async()=>(await snapshot()).state.grammar.auxiliary.stage===5);
  fail=true;await sentence.fill('I am now reading a book.');await page.getByRole('button',{name:'다시 저장',exact:true}).waitFor();assert.equal(await sentence.inputValue(),'I am now reading a book.');
  await click('다시 저장');await until(async()=>(await snapshot()).state.grammar.auxiliary.sentence==='I am now reading a book.');
  await page.reload();await library();await page.locator('.grammar-group').filter({has:page.locator('h3',{hasText:'동사를 돕는 표현'})}).locator('summary').click();await page.locator('.grammar-tile').filter({has:page.locator('b',{hasText:/^기본 조동사$/})}).click();assert.equal(await sentence.inputValue(),'I am now reading a book.');
  const saved=(await snapshot()).state.grammar.auxiliary;assert.equal(saved.contentVersion,2);assert.deepEqual(saved.answers,p.answers);assert.equal(saved.schedule,undefined);
  await click('수업 목록');await page.locator('.grammar-tile').filter({has:page.locator('b',{hasText:/^명사$/})}).click();await page.getByRole('button',{name:'생각한 뒤 설명 확인',exact:true}).waitFor();assert.equal((await snapshot()).state.grammar.noun.contentVersion,undefined);
  for(const [text,width] of [['I am reading now.',320],['Now I am reading.',390],['I am now reading.',1440]]){
   const latest=await snapshot(),modern={...structuredClone(p),contentVersion:3,questionIds:p.questionIds.map(id=>id.replace(':2:',':3:'))};delete modern.answers.q3;
   assert.equal((await context.request.put(base+'/api/state',{headers:{'X-Study-Grammar':'3'},data:{revision:latest.revision,progress:{},sessions:{},grammar:{auxiliary:modern}}})).status(),200);
   await page.reload();await library();await page.locator('.grammar-group').filter({has:page.locator('h3',{hasText:'동사를 돕는 표현'})}).locator('summary').click();await page.locator('.grammar-tile').filter({has:page.locator('b',{hasText:/^기본 조동사$/})}).click();
   await page.setViewportSize({width,height:900});
   for(const token of text.slice(0,-1).split(' '))await page.locator('.grammar-options button').filter({hasText:new RegExp('^'+token+'$','i')}).click();
   assert.equal(await page.locator('.grammar-order-answer').innerText(),text);
   const large=width===320?await page.addStyleTag({content:'html{font-size:200%!important}'}):undefined;
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.getByRole('button',{name:'내 답 확인',exact:true}).focus();await page.keyboard.press('Enter');
   await page.locator('.grammar-feedback[data-tone="success"]').waitFor();await until(async()=>(await snapshot()).state.grammar.auxiliary.answers.q3?.first===text);
   if(width===320){await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa']})).violations.map(v=>v.id)),[]);}
   await large?.evaluate(el=>el.remove());
  }
  console.log('PASS v3 three now positions, final punctuation/casing, 320/390/1440/200%, keyboard/axe and persisted first answers');
  console.log('PASS v1/v2 pinned, legacy now explanation, 320/390/1440/200%, keyboard/axe, failed save retry and reconnect');
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
