const assert=require('node:assert/strict'),{build}=require('esbuild');
const {base,launchBrowser,closeBrowser,accountHeaders}=require('./qa/runtime.cjs');
(async()=>{
 await build({entryPoints:['lib/grammar/content-v4.ts','lib/grammar/practice.ts','lib/grammar/model.ts'],outdir:'work/v4-compat',bundle:true,format:'cjs',platform:'node',outExtension:{'.js':'.cjs'},logLevel:'silent'});
 const {PRACTICE_LESSONS_V4}=require('../work/v4-compat/content-v4.cjs'),{newLessonProgress,completeLesson}=require('../work/v4-compat/practice.cjs'),{recordAnswer}=require('../work/v4-compat/model.cjs');
 const expected=Number(process.env.QA_NEW_GRAMMAR_VERSION||4),date=new Date().toISOString(),p=newLessonProgress('verb',date,4);
 p.stage=1;p.observation=recordAnswer(undefined,PRACTICE_LESSONS_V4.verb.observation.answer);
 const old=newLessonProgress('noun',date,3);old.observation=recordAnswer(undefined,'일이라는 대상');old.answers=Object.fromEntries(['teacher','bag','I like music.'].map((a,i)=>['q'+(i+1),recordAnswer(undefined,a)]));old.sentence='I like music.';old.checks={meaning:'appropriate',form:'appropriate'};old.check='appropriate';
 const done=completeLesson(old,'2026-10-03',date),before=structuredClone(done);
 const browser=await launchBrowser(),context=await browser.newContext({extraHTTPHeaders:accountHeaders('v4_compat')}),page=await context.newPage();
 let calls=0;await page.route('**/api/grammar-feedback',route=>{calls++;return route.fulfill({status:500,json:{code:'provider_failure'}});});
 const snapshot=async()=>(await context.request.get(base+'/api/state',{headers:{'X-Study-Grammar':'4'}})).json();
 const until=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('persistence timeout');};
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const library=async()=>{await page.getByRole('tab',{name:'단어장',exact:true}).click();await page.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();};
 const open=async title=>{const tile=page.locator('.grammar-tile').filter({has:page.locator('b',{hasText:new RegExp('^'+title+'$')})});const group=page.locator('.grammar-group').filter({has:tile});if(await group.getAttribute('open')===null)await group.locator('summary').click();await tile.click();};
 try{
  const initial=await snapshot();
  assert.equal((await context.request.put(base+'/api/state',{headers:{'X-Study-Grammar':'4'},data:{revision:initial.revision,progress:{},sessions:{},grammar:{verb:p,noun:done}}})).status(),200);
  await page.goto(base);await library();await open('동사');await page.getByText('교재 예문 분석',{exact:true}).first().waitFor();assert.equal(await page.locator('.sentence-structure').count(),2);assert.match(await page.locator('.grammar-reviewed-examples').innerText(),/책이었어요/);
  await click('수업 목록');await open('명사');await click('다른 3문제로 확인');await until(async()=>!!(await snapshot()).state.grammar.noun.review);const next=(await snapshot()).state.grammar.noun;
  assert.equal(next.contentVersion,3);assert.equal(next.review.contentVersion,expected);assert.deepEqual(next.answers,before.answers);assert.deepEqual(next.schedule,before.schedule);
  await page.reload();await library();await open('명사');assert.equal((await snapshot()).state.grammar.noun.review.contentVersion,expected);
  await click('수업 목록');await open('부사');await click('다정한 정도');await click('답 확인');await until(async()=>!!(await snapshot()).state.grammar.adverb?.observation);assert.equal((await snapshot()).state.grammar.adverb.contentVersion,expected);
  assert.equal(calls,0);console.log('PASS flag new='+expected+' existing4 resumes, mixed review retains first answers/schedule, reconnect, provider0');
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
