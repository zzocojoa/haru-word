// Local built Worker, synthetic users and explicit 401 faults. No hosted sign-in.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {base,accountHeaders,launchBrowser,closeBrowser,waitForWorker}=require('./qa/runtime.cjs');
const engine=process.env.QA_BROWSER||'chromium',out='outputs/auth-boundary/'+engine;
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const caps={'X-Study-AI-Contract':'4','X-Study-Grammar':'4','X-Study-Feedback-Structure':'1','X-Study-Sense-Keys':'1'};
(async()=>{
 await waitForWorker();fs.mkdirSync(out,{recursive:true});const browser=await launchBrowser(),checks=[],errors=[];
 try{
  const guest=await browser.newContext({viewport:{width:390,height:844}}),page=await guest.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  for(let attempt=0;attempt<2;attempt++){
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/state');
   if(attempt)await page.reload({waitUntil:'domcontentloaded'});else await page.goto(base,{waitUntil:'domcontentloaded'});
   assert.equal((await pending).status(),401);
   await page.getByRole('link',{name:'로그인하고 학습하기',exact:true}).waitFor({timeout:5000});
   assert.equal(await page.getByText('저장됨',{exact:true}).count(),0);
  }
  checks.push('anonymous first entry and reload keep a real top-level sign-in link after401, without a saved claim');
  await page.screenshot({path:out+'/anonymous.png',fullPage:true});await guest.close();
  const identity=accountHeaders('auth_boundary'),context=await browser.newContext({extraHTTPHeaders:{...identity,...caps},viewport:{width:390,height:844}});
  const read=async()=>{const response=await context.request.get(base+'/api/state');assert.equal(response.status(),200);return response.json();};
  const initial=await read(),word=words.find(w=>w.word==='work'&&w.pos==='v.'),id=word.id,sid=crypto.randomUUID();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const session={id:sid,kind:'daily',date,period:date,ids:[id],warmupIds:[],stage:'sentence',index:0,records:{[id]:{meaning:content[id].meaning,en:'independent',ko:'independent',sentenceStatus:'unmeasured',sentence:'',notes:''}},retry:[],retryMode:false,elapsed:0,finished:false,paused:false,createdAt:new Date().toISOString()};
  const seeded=await context.request.put(base+'/api/state',{data:{
   revision:initial.revision,settings:{...initial.state.settings,activeSessionId:sid},
   progress:{[id]:{meaning:content[id].meaning}},sessions:{[sid]:session},
  }});
  assert.equal(seeded.status(),200);
  const learner=await context.newPage();learner.on('pageerror',e=>errors.push(e.message));
  await learner.goto(base);await learner.getByText('저장됨',{exact:true}).waitFor();
  await learner.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await learner.getByText('저장됨',{exact:true}).waitFor();
  const marker='Synthetic private draft.';await learner.getByLabel('내 영어 문장',{exact:true}).fill(marker);
  await learner.waitForFunction(marker=>Object.values(localStorage).some(value=>value.includes(marker)),marker);
  const before=await read();
  await learner.route('**/api/study-clock',route=>route.fulfill({status:401,json:{error:'synthetic expired account'}}));
  await learner.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await learner.getByRole('alert').getByText('로그인 상태를 다시 확인해야 해요. 새로고침해 현재 계정의 기록을 불러와 주세요.',{exact:true}).waitFor();
  assert.equal(await learner.locator('input,textarea,[role="tabpanel"]').count(),0);
  assert.equal(await learner.getByText(marker,{exact:true}).count(),0);
  await learner.getByRole('link',{name:'로그인하고 학습하기',exact:true}).waitFor();
  assert.deepEqual(await read(),before);
  checks.push('authenticated401 hides private drafts/forms while retaining explicit sign-in/reload controls and unchanged server history');
  const other=accountHeaders('auth_other');await context.setExtraHTTPHeaders({...other,...caps});await learner.unroute('**/api/study-clock');
  await learner.reload();await learner.getByText('저장됨',{exact:true}).waitFor();
  const otherState=await read();assert.equal(Object.keys(otherState.state.sessions).length,0);assert.equal(await learner.getByText(marker,{exact:true}).count(),0);
  await context.setExtraHTTPHeaders({...identity,...caps});await learner.reload();await learner.getByText('저장됨',{exact:true}).waitFor();
  assert.deepEqual(await read(),before);assert.equal(await learner.getByText(marker,{exact:true}).count(),0);
  checks.push('A→B→A keeps server histories separate and never renders the prior account private draft');
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,engine,checks,pageErrors:errors,realChatGptSignIn:false},null,2));
  console.log(JSON.stringify({passed:true,engine,checks}));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
