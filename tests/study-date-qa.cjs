// Built local Worker only: synthetic accounts and controlled clock responses.
const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=require('./qa/runtime.cjs').base,out='outputs/study-date';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const prior=new Date(now+'T12:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);const yesterday=prior.toISOString().slice(0,10),dayLabel=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',timeZone:'Asia/Seoul'}).format(new Date(now+'T12:00:00Z')),selected=words.filter(w=>w.level==='A1').slice(0,10);
const checks=[],errors=[],layouts=[];let serial=0;
async function checkDialogLayout(page, phase) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320,390,430,768,1440]) {
    for (const scale of [1,2]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${16 * scale}px`; }, scale);
      const geometry = await page.locator('.study-date-dialog').evaluate(dialog => {
        const body = dialog.querySelector('.dialog-scroll');
        const input = body.querySelector('input[type=date]');
        const box = element => { const r = element.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
        body.scrollLeft = 1000;
        const horizontalMovement = body.scrollLeft;
        body.scrollLeft = 0;
        body.scrollTop = body.scrollHeight;
        const verticalMovement = body.scrollTop;
        body.scrollTop = 0;
        const b = box(body);
        return { body:b, input:box(input), clientWidth:body.clientWidth, scrollWidth:body.scrollWidth, horizontalMovement, verticalMovement,
          needsVerticalScroll:body.scrollHeight > body.clientHeight,
          clippedChildren:[...body.children].filter(child => { const c = box(child); return c.left < b.left - 1 || c.right > b.right + 1; }).map(child => child.tagName),
          actions:[...dialog.querySelectorAll('.dialog-actions button,[data-slot=dialog-close]')].map(box) };
      });
      const label = `${phase} ${width}px ${scale * 100}%`;
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${label}: internal overflow`);
      assert.equal(geometry.horizontalMovement, 0, `${label}: horizontal scrolling`);
      assert.deepEqual(geometry.clippedChildren, [], `${label}: clipped content`);
      assert.ok(geometry.input.width >= 44 && geometry.input.height >= 44, label);
      if (geometry.needsVerticalScroll) assert.ok(geometry.verticalMovement > 0, `${label}: vertical scrolling blocked`);
      for (const button of geometry.actions) assert.ok(button.width >= 44 && button.height >= 44 && button.left >= -1 && button.right <= width + 1 && button.top >= -1 && button.bottom <= 845, `${label}: inaccessible action`);
      layouts.push({phase,width,scale,...geometry});
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width:390, height:844 });
  checks.push(`${phase}: 320–1440px and 200% text, dialog body and native date field fit; vertical scroll and actions remain usable`);
}
(async()=>{const browser=await launchBrowser();
 const fresh=async()=>{const c=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'oai-authenticated-user-id':require('./qa/runtime.cjs').account('dates_')+'_'+serial++,'oai-authenticated-user-email':'dates@example.test'}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p}};
 const state=async c=>(await c.request.get(base+'/api/state')).json();
 const saved=async p=>p.getByText('저장됨',{exact:true}).waitFor();
 const seed=async(c,date=now,needsReview=true)=>{const data=await state(c),sid=crypto.randomUUID();const progress=Object.fromEntries(words.filter(w=>w.level==='A1').map(w=>[w.id,{familiarity:'uncertain'}]));
  const records=Object.fromEntries(selected.map(w=>[w.id,{meaning:content[w.id].meaning,material:content[w.id],learnedOn:date,lastPracticedOn:date,en:'independent',ko:needsReview?'help':'independent',sentenceStatus:'written',sentence:'Preserved sentence.',notes:'Preserved note.'}]));
  for(const w of selected)progress[w.id]={...progress[w.id],meaning:content[w.id].meaning,studyDates:[date],lastStudied:date,en:'independent',ko:needsReview?'help':'independent',sentenceStatus:'written',needsReview};
  const session={id:sid,kind:'daily',date,period:date,ids:selected.map(w=>w.id),warmupIds:[],stage:'done',index:10,records,retry:[],retryMode:false,elapsed:900,finished:true,paused:true,createdAt:date+'T01:00:00Z'};
  const r=await c.request.put(base+'/api/state',{data:{revision:data.revision,settings:{...data.state.settings,dailyGoal:10,activeSessionId:sid,assessments:{A1:require('./qa/fixtures.cjs').completedAssessment(words, 'A1')}},progress,sessions:{[sid]:session}}});assert.equal(r.status(),200,await r.text());return session;
 };
 const clock=async(p,value=now+'T02:00:00Z')=>p.route('**/api/study-clock',r=>r.fulfill({json:{serverTime:Date.parse(value)}}));
 const open=async(p)=>{await p.goto(base);await saved(p);await p.locator('.daily-label').filter({hasText:dayLabel}).waitFor({state:'attached'})};
 try{
  // Reproduce the reported stored-day mismatch and recover without changing scores.
  const {c,p}=await fresh(),source=await seed(c);await p.clock.install({time:new Date('2030-01-01T00:00:00Z')});await clock(p);await open(p);await p.getByRole('heading',{name:'오늘 회차를 마쳤어요'}).waitFor();
  await p.getByRole('button',{name:'학습일 수정'}).click();await p.getByRole('dialog').waitFor();assert.equal(await p.getByLabel('실제로 공부한 날').inputValue(),yesterday);
  await checkDialogLayout(p,'ready');
  await p.screenshot({path:out+'/date-correction.png',fullPage:true});
  await p.route('**/api/state',r=>r.request().method()==='PUT'?r.fulfill({status:503,json:{error:'테스트 저장하지 못했어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.'}}):r.continue());
  await p.getByRole('button',{name:'학습일 수정하기',exact:true}).click();await p.getByRole('dialog').getByRole('alert').waitFor();assert.equal((await state(c)).state.sessions[source.id].date,now);
  await checkDialogLayout(p,'save failure');
  await p.unroute('**/api/state');await p.getByRole('button',{name:'날짜 저장 다시 시도',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await saved(p);
  let next=(await state(c)).state;assert.equal(next.sessions[source.id].date,yesterday);assert.equal(next.sessions[source.id].createdAt,source.createdAt);
  for(const id of source.ids)assert.deepEqual(next.sessions[source.id].records[id],{...source.records[id],learnedOn:yesterday,lastPracticedOn:yesterday});
  await p.getByRole('button',{name:'오늘의 학습 시작',exact:true}).waitFor();assert.equal(await p.getByRole('heading',{name:'오늘 회차를 마쳤어요'}).count(),0);await p.reload();await saved(p);await p.getByRole('button',{name:'오늘의 학습 시작',exact:true}).waitFor();await p.screenshot({path:out+'/today-reopened.png',fullPage:true});
  const guarded=await state(c),bad={...source,id:crypto.randomUUID(),date:yesterday,period:yesterday};const refused=await c.request.put(base+'/api/state',{headers:{'X-Study-Server-Clock':'1'},data:{revision:guarded.revision,progress:{},sessions:{[bad.id]:bad}}});assert.equal(refused.status(),409);assert.deepEqual(await state(c),guarded);checks.push('server refuses a new daily session with a stale study date without changing any records');
  checks.push('reported ten-word completed-day case: correction, failed save, retry, reload, all results preserved; carryover remains explicit');
  await c.close();
  // Fully learned words no longer consume the corrected day's budget.
  const complete=await fresh(),known=await seed(complete.c,now,false);await complete.p.clock.install({time:new Date('2030-01-01T00:00:00Z')});await clock(complete.p);await open(complete.p);await complete.p.getByRole('button',{name:'학습일 수정'}).click();await complete.p.getByRole('button',{name:'학습일 수정하기',exact:true}).click();await complete.p.getByRole('dialog').waitFor({state:'hidden'});await saved(complete.p);
  await complete.p.getByRole('button',{name:'오늘의 학습 시작',exact:true}).click();await saved(complete.p);next=(await state(complete.c)).state;const freshSession=Object.values(next.sessions).find(s=>s.date===now&&s.kind==='daily');assert.ok(freshSession);assert.equal(freshSession.ids.length,10);assert.ok(freshSession.ids.every(id=>!known.ids.includes(id)));assert.equal(freshSession.createdAt.slice(0,10),now);checks.push('incorrect device date cannot affect a new session day or creation time; ten new words available after fully learned historical lesson');await complete.c.close();
  // A completed summary still open at midnight must give way to today's home.
  const midnight=await fresh(),old=await seed(midnight.c,yesterday,false);let data=await state(midnight.c);const ongoing={...old,finished:false,paused:false,stage:'sentence',index:9};assert.equal((await midnight.c.request.put(base+'/api/state',{data:{revision:data.revision,progress:{},sessions:{[old.id]:ongoing}}})).status(),200);
  await midnight.p.clock.install({time:new Date('2010-01-01T00:00:00Z')});await clock(midnight.p,yesterday+'T14:59:55Z');await midnight.p.goto(base);await saved(midnight.p);await midnight.p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved(midnight.p);await midnight.p.getByRole('button',{name:'문장 쓰기는 다음에',exact:true}).click();await midnight.p.getByRole('heading',{name:'학습 기록을 저장했어요',exact:true}).waitFor();await midnight.p.clock.fastForward(70000);await midnight.p.locator('.daily-label').filter({hasText:dayLabel}).waitFor({state:'attached'});await midnight.p.getByRole('button',{name:'오늘의 학습 시작',exact:true}).waitFor();assert.equal((await state(midnight.c)).state.sessions[old.id].date,yesterday);checks.push('midnight replaces an open completed summary with today’s home without rewriting yesterday');await midnight.c.close();
  const draft=await fresh(),unfinished=await seed(draft.c,yesterday,false);data=await state(draft.c);assert.equal((await draft.c.request.put(base+'/api/state',{data:{revision:data.revision,progress:{},sessions:{[unfinished.id]:{...unfinished,finished:false,paused:false,stage:'en',index:0}}}})).status(),200);
  await draft.p.clock.install({time:new Date('2010-01-01T00:00:00Z')});await clock(draft.p,yesterday+'T14:59:55Z');await draft.p.goto(base);await saved(draft.p);await draft.p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved(draft.p);await draft.p.getByLabel('한국어 뜻 입력').fill('보존할 답');await draft.p.clock.fastForward(70000);assert.equal(await draft.p.getByLabel('한국어 뜻 입력').inputValue(),'보존할 답');await draft.p.getByText(yesterday+'에 시작한 회차를 이어가고 있어요. 오늘 입력한 결과는 '+now+' 연습으로 기록돼요.').waitFor();checks.push('midnight preserves an unfinished answer and labels the historical session');await draft.c.close();
  const failure=await fresh();await seed(failure.c);await failure.p.route('**/api/study-clock',r=>r.fulfill({status:503,json:{error:'clock unavailable'}}));await failure.p.goto(base);await saved(failure.p);await failure.p.getByRole('button',{name:'시간 다시 확인'}).waitFor();await failure.p.unroute('**/api/study-clock');await clock(failure.p);await failure.p.getByRole('button',{name:'시간 다시 확인'}).click();await failure.p.getByRole('button',{name:'학습일 수정'}).click();await failure.p.getByRole('dialog').waitFor();data=await state(failure.c);assert.equal((await failure.c.request.put(base+'/api/state',{data:{revision:data.revision,progress:{},sessions:{}}})).status(),200);await failure.p.getByRole('button',{name:'학습일 수정하기',exact:true}).click();await failure.p.getByRole('dialog').getByRole('alert').filter({hasText:'다른 기기'}).waitFor();assert.equal(Object.values((await state(failure.c)).state.sessions)[0].date,now);checks.push('clock fetch failure is recoverable; revision conflict prevents date overwrite');
  await checkDialogLayout(failure.p,'conflict');
  await failure.p.addScriptTag({path:require('./qa/runtime.cjs').axePath});const axe=await failure.p.evaluate(async()=>axe.run(document.querySelector('[role="dialog"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.equal(axe.violations.length,0,JSON.stringify(axe.violations));assert.equal(await failure.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push('390px correction dialog: no horizontal overflow and zero axe violations');await failure.c.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/verification.json',JSON.stringify({checks,pageErrors:errors,layouts,passed:true},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
 }catch(e){fs.writeFileSync(out+'/verification.json',JSON.stringify({checks,pageErrors:errors,error:String(e)},null,2));throw e}finally{await closeBrowser(browser)}
})();
