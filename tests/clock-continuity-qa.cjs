// Local built Worker only. Synthetic account, controlled server clock; no Google calls.
const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=require('./qa/runtime.cjs').base,out='outputs/clock-continuity';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const yesterday=new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const headers={'oai-authenticated-user-id':require('./qa/runtime.cjs').account('clock_continuity_'),'oai-authenticated-user-email':'qa@example.test'};
const checks=[],errors=[];
(async()=>{const browser=await launchBrowser();try{
 const a=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:headers}),p=await a.newPage();
 p.on('pageerror',e=>errors.push(e.message));
 const get=async c=>(await c.request.get(base+'/api/state')).json(),saved=()=>p.getByText('저장됨',{exact:true}).waitFor();
 let data=await get(a);const w=words.find(w=>w.word==='arrive'&&w.pos==='v.'),sid=crypto.randomUUID(),meaning=content[w.id].meaning;
 const record={entryId:w.id,meaning,material:content[w.id],learnedOn:yesterday,familiarity:'known',en:'unmeasured',ko:'unmeasured',sentenceStatus:'unmeasured',sentence:'',notes:''};
 const session={id:sid,kind:'daily',date:yesterday,period:yesterday,ids:[w.id],warmupIds:[],stage:'en',index:0,records:{[w.id]:record},retry:[],retryMode:false,elapsed:0,finished:false,paused:true,createdAt:yesterday+'T14:50:00Z'};
 assert.equal((await a.request.put(base+'/api/state',{data:{revision:data.revision,settings:{...data.state.settings,activeSessionId:sid},progress:{[w.id]:{familiarity:'known',meaning,studyDates:[yesterday],lastStudied:yesterday,needsReview:true}},sessions:{[sid]:session}}})).status(),200);
 let time=yesterday+'T14:59:55Z',held,clockCalls=0,hold=false;
 await p.route('**/api/study-clock',r=>{clockCalls++;if(hold){held=r;return}return r.fulfill({json:{serverTime:Date.parse(time)}})});
 // Seed through the real API before installing the page's deliberately incorrect device clock.
 await p.clock.install({time:new Date('2030-01-01T00:00:00Z')});
 await p.goto(base,{waitUntil:'domcontentloaded'});await saved();await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();
 const field=p.getByLabel('한국어 뜻 입력');const answer='나만의 비공개 답 123';await field.fill(answer);
 hold=true;const request=p.waitForRequest('**/api/study-clock');await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await request;
 const initialCalls=clockCalls;
 await p.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'))});
 await p.getByRole('status').filter({hasText:'한국 시간을 확인하고 있어요'}).waitFor();assert.equal(clockCalls,initialCalls);
 await p.clock.fastForward(10_050);await p.getByRole('button',{name:'시간 다시 확인',exact:true}).waitFor();assert.equal(clockCalls,initialCalls);
 assert.equal(await field.inputValue(),answer);assert.ok(await p.getByRole('button',{name:'내 답 확인',exact:true}).isDisabled());
 for(const name of ['단어장','복습 점검','학습 기록']){await p.getByRole('tab',{name,exact:true}).click();await p.getByRole('button',{name:'시간 다시 확인',exact:true}).waitFor()}
 await p.screenshot({path:out+'/clock-recovery-mobile.png'});
 checks.push('clock request times out once after 10 seconds; repeated wake events share its deadline and recovery is available on every tab');
 await p.getByRole('button',{name:'학습 설정',exact:true}).click();await p.getByText('문제가 생겼을 때',{exact:true}).click();
 const download=p.waitForEvent('download');await p.getByRole('button',{name:'문제 진단 기록 받기',exact:true}).click();const diagnostic=fs.readFileSync(await(await download).path(),'utf8');const events=JSON.parse(diagnostic).events;
 assert.ok(events.some(e=>e.operation==='clock'&&e.outcome==='timeout'));assert.ok(events.some(e=>e.gates?.clockReady===false));
 for(const secret of [answer,sid,w.id,headers['oai-authenticated-user-id'],headers['oai-authenticated-user-email']])assert.ok(!diagnostic.includes(secret));
 await p.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 // Audit the recovery screen after the closing modal/overlay animation has left the DOM.
 // Otherwise WebKit can sample foreground text through the fading modal overlay.
 await p.locator('[data-slot="dialog-content"]').waitFor({state:'hidden'});
 await p.locator('[data-slot="dialog-overlay"]').waitFor({state:'hidden'});
 await p.addScriptTag({path:require('./qa/runtime.cjs').axePath});const axe=await p.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.equal(axe.violations.length,0,JSON.stringify(axe.violations));
 checks.push('manual diagnostic export identifies the blocking clock without answers, account IDs, word IDs or session IDs; recovery screen has no axe violations');
 await held.abort().catch(()=>{});hold=false;time=date+'T00:01:00Z';await p.getByRole('button',{name:'시간 다시 확인',exact:true}).click();
 await p.getByRole('tab',{name:'오늘 학습',exact:true}).click();assert.equal(await field.inputValue(),answer);
 await p.getByText(yesterday+'에 시작한 회차를 이어가고 있어요. 오늘 입력한 결과는 '+date+' 연습으로 기록돼요.').waitFor();
 await p.getByRole('button',{name:'내 답 확인',exact:true}).click();await saved();data=await get(a);assert.equal(data.state.sessions[sid].date,yesterday);assert.equal(data.state.sessions[sid].records[w.id].draft.answer,answer);
 checks.push('midnight plus reconnect preserves the unfinished answer and original learning day; saving resumes without refresh or duplicate requests');
 const b=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:headers}),q=await b.newPage();q.on('pageerror',e=>errors.push(e.message));
 await q.route('**/api/study-clock',r=>r.fulfill({json:{serverTime:Date.parse(time)}}));await q.goto(base,{waitUntil:'domcontentloaded'});await q.getByText('저장됨',{exact:true}).waitFor();
 await q.getByRole('tab',{name:'학습 기록',exact:true}).click();await q.locator('.journal-day-trigger').click();await q.locator('.journal-session-trigger').click();await q.getByRole('button',{name:'이어서 학습',exact:true}).click();await q.getByText('저장됨',{exact:true}).waitFor();
 assert.equal(await q.getByLabel('한국어 뜻 입력').inputValue(),answer);await q.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).click();await q.getByText('저장됨',{exact:true}).waitFor();
 const remote=await get(b);assert.equal(remote.state.sessions[sid].records[w.id].lastPracticedOn,date);assert.equal(remote.state.sessions[sid].records[w.id].learnedOn,yesterday);
 await p.getByRole('button',{name:'도움이 필요했어요',exact:true}).click();await p.getByRole('alert').filter({hasText:'다른 기기'}).waitFor();assert.deepEqual(await get(a),remote);
 const backup=p.waitForEvent('download');await p.getByRole('button',{name:'현재 입력 백업',exact:true}).click();const pending=JSON.parse(fs.readFileSync(await(await backup).path(),'utf8'));assert.equal(pending.sessions[sid].records[w.id].enAnswer,answer);
 await p.getByRole('button',{name:'최신 기록 불러오기',exact:true}).click();await p.getByRole('alertdialog').getByRole('button',{name:'최신 기록 불러오기',exact:true}).click();await saved();assert.deepEqual(await get(a),remote);
 checks.push('a second device resumes the saved draft; stale-device grading cannot overwrite it, current input remains exportable, and explicit refresh reconciles the latest state');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/verification.json',JSON.stringify({passed:true,checks,pageErrors:errors,axeViolations:0,realGoogleCalls:0},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await closeBrowser(browser)}})().catch(e=>{fs.writeFileSync(out+'/failure.json',JSON.stringify({checks,error:String(e)},null,2));console.error(e);process.exit(1)});
