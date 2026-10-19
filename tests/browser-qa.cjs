const {markFamiliarity}=require('./familiarity-actions.cjs');
const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await launchBrowser({headless:true});const errors=[];const account=require('./qa/runtime.cjs').account('qa_');
 try{
  const context=await browser.newContext({viewport:{width:1366,height:900},extraHTTPHeaders:{'oai-authenticated-user-id':account,'oai-authenticated-user-email':account+'@example.test'}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(require('./qa/runtime.cjs').base + '/');await page.getByText('저장됨',{exact:true}).waitFor();
  const initial=await (await context.request.get(require('./qa/runtime.cjs').base + '/api/state')).json();assert.equal(Object.keys(initial.state.progress).length,0);
  await page.getByRole('button',{name:'단어 20개 친숙도 확인',exact:true}).click();for(let i=0;i<20;i++){await markFamiliarity(page,'uncertain');await page.getByText('저장됨',{exact:true}).waitFor();}await page.getByRole('button',{name:'이 수준에서 학습하기'}).click();await page.getByRole('heading',{name:'단어 익히기',exact:true}).waitFor();
  let model=await (await context.request.get(require('./qa/runtime.cjs').base + '/api/state')).json();const session=model.state.sessions[model.state.settings.activeSessionId];const catalog=JSON.parse(fs.readFileSync('data/words.json','utf8'));const data=JSON.parse(fs.readFileSync('data/content.json','utf8'));const targetWords=session.ids.map(id=>catalog.find(w=>w.id===id).word);for(let i=0;i<3;i++){await page.getByRole('button',{name:'뜻 저장하고 계속'}).click();await page.getByText('저장됨',{exact:true}).waitFor();}
  await page.getByRole('heading',{name:'영어 → 뜻',exact:true}).waitFor();assert.equal(await page.locator('.answer-box').count(),0);
  for(let i=0;i<3;i++){await page.getByLabel('한국어 뜻 입력').fill(data[session.ids[i]].meaning);await page.getByRole('button',{name:'내 답 확인'}).click();await page.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).click();await page.getByText('저장됨',{exact:true}).waitFor();}
  await page.getByRole('heading',{name:'뜻 → 영어',exact:true}).waitFor();let visible=await page.locator('[role=tabpanel]:not([hidden])').innerText();assert.ok(!visible.includes(targetWords[0]),'English answer must be hidden during Korean cue');
  await page.getByRole('button',{name:'생각이 안 나요'}).click();assert.ok(await page.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).isDisabled());await page.getByRole('button',{name:'도움이 필요했어요',exact:true}).click();await page.getByText('저장됨',{exact:true}).waitFor();
  for(const word of targetWords.slice(1)){await page.getByLabel('영어 단어 입력').fill(word);await page.getByRole('button',{name:'내 답 확인'}).click();await page.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).click();await page.getByText('저장됨',{exact:true}).waitFor();}
  await page.getByRole('heading',{name:'다시 떠올리기',exact:true}).waitFor();await page.getByLabel('영어 단어 입력').fill(targetWords[0]);await page.getByRole('button',{name:'내 답 확인'}).click();await page.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).click();await page.getByText('저장됨',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'내 문장 만들기',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'문장을 완성했어요'}).isDisabled());
  for(const sentence of session.ids.map(id=>data[id].example)){await page.getByLabel('내 영어 문장',{exact:true}).fill(sentence);await page.getByRole('button',{name:'문장을 완성했어요'}).click();await page.getByText('저장됨',{exact:true}).waitFor();}
  await page.getByRole('heading',{name:'학습 기록을 저장했어요',exact:true}).waitFor();
  await page.reload();await page.getByText('저장됨',{exact:true}).waitFor();const after=await (await context.request.get(require('./qa/runtime.cjs').base + '/api/state')).json();assert.equal(Object.keys(after.state.progress).length,20);assert.equal(Object.values(after.state.sessions).filter(s=>s.finished).length,1);
  await page.getByRole('tab',{name:'복습 점검'}).click();assert.equal(await page.getByRole('button',{name:'전체 점검 시작'}).count(),2);
  await page.getByRole('tab',{name:'단어장'}).click();await page.getByLabel('단어 또는 한국어 뜻 검색').fill('book');assert.ok(await page.getByRole('button',{name:/^book/}).count()>=2);
  await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'오늘 학습'}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'work/qa-mobile.png',fullPage:true});
  // API isolation, revision conflicts, validation, and cross-origin rejection.
  const unauthorized=await browser.newContext();assert.equal((await unauthorized.request.get(require('./qa/runtime.cjs').base + '/api/state')).status(),401);await unauthorized.close();
  const other=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':account+'_other','oai-authenticated-user-email':'other@example.test'}});const otherState=await (await other.request.get(require('./qa/runtime.cjs').base + '/api/state')).json();assert.equal(Object.keys(otherState.state.progress).length,0);await other.close();
  assert.equal((await context.request.put(require('./qa/runtime.cjs').base + '/api/state',{data:{revision:0,progress:{},sessions:{}}})).status(),409);
  assert.equal((await context.request.put(require('./qa/runtime.cjs').base + '/api/state',{data:{revision:after.revision,progress:{bad:{}},sessions:{}}})).status(),400);
  assert.equal((await context.request.put(require('./qa/runtime.cjs').base + '/api/state',{headers:{Origin:'https://different.example'},data:{revision:after.revision,progress:{},sessions:{}}})).status(),403);
  assert.deepEqual(errors,[]);const report={passed:true,checks:['daily study','answers hidden','hints cannot pass independently','sentence required','delayed retry','server reload','weekly and monthly targets','all-word search','mobile overflow','anonymous rejection','account isolation','optimistic conflict','input validation','origin rejection'],browserErrors:errors};fs.writeFileSync('work/browser-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exit(1)});
