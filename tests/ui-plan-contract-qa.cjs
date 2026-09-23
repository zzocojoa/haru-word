// Verify the approved UI contract on the built LOCAL Worker; all records are synthetic.
const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=require('./qa/runtime.cjs').base,out='outputs/ui-plan-contract';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const selected=words.filter(w=>w.level==='A1').slice(0,10),ids=selected.map(w=>w.id);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{
 const browser=await launchBrowser(),checks=[],audits=[],errors=[],touch=[];
 try{
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':require('./qa/runtime.cjs').account('ui_contract_'),'oai-authenticated-user-email':'qa@example.test'}});
  const get=async()=> (await c.request.get(base+'/api/state')).json();const before=await get();
  const state={...before.state,sessions:{},progress:{}};
  for(let i=0;i<14;i++){
   const date=new Date(Date.parse(today+'T12:00:00Z')-i*86400000).toISOString().slice(0,10),id=crypto.randomUUID();
   state.sessions[id]={id,kind:'daily',date,period:date,ids,warmupIds:[],stage:'done',index:0,retry:[],retryMode:false,elapsed:600,paused:true,finished:true,createdAt:date+'T01:00:00Z',records:Object.fromEntries(ids.map(wordId=>[wordId,{entryId:wordId,meaning:content[wordId].meaning,material:content[wordId],en:'independent',ko:'independent',sentenceStatus:'written',sentence:'Keep this sentence.',notes:'Keep this note.',learnedOn:date}]))};
  }
  const response=await c.request.post(base+'/api/state/restore',{headers:{'x-study-revision':String(before.revision)},data:{format:'haru-words-v1',exportedAt:new Date().toISOString(),state}});assert.equal(response.status(),200,await response.text());
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.getByText('서버에 저장됨',{exact:true}).waitFor();
  const initial=await get();
  const nav=name=>p.getByRole('tab',{name,exact:true}).click();
  const fit=async label=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' '+JSON.stringify(await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,x:scrollX,items:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.right>innerWidth||r.left<0||el.scrollWidth>el.clientWidth+1)}).map(el=>({tag:el.tagName,class:el.className,scroll:el.scrollWidth,client:el.clientWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,text:el.textContent.slice(0,50)}))}))));
  const checkTouch=async name=>{const small=await p.evaluate(()=>[...document.querySelectorAll('[role=dialog] button,[role=dialog] summary,[role=dialog] a')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.width<44||r.height<44)}).map(el=>({text:el.textContent.trim().slice(0,40),class:el.className,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));touch.push({name,small});assert.deepEqual(small,[],name+' 44px touch area');};
  const axe=async label=>{await p.addScriptTag({path:require('./qa/runtime.cjs').axePath});const issues=await p.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));audits.push({label,issues});assert.deepEqual(issues,[],label);};
  await nav('학습 기록');
  await p.locator('.journal-day-trigger').first().click();await p.locator('.journal-session-trigger').first().click();await p.locator('.journal-word-trigger').first().click();
  await p.evaluate(()=>window.scrollTo(0,650));const at=await p.evaluate(()=>scrollY);
  await nav('전체 단어장');await nav('학습 기록');const back=await p.evaluate(()=>scrollY);
  if(process.env.UI_AUDIT_BASELINE){
   const report={recordScrollBefore:at,recordScrollAfter:back,framedDialogs:await p.locator('.framed-dialog').count()};
   fs.writeFileSync(out+'/before.json',JSON.stringify(report,null,2));console.log(report);return;
  }
  assert.ok(Math.abs(at-back)<=2,`record position ${at} → ${back}`);
  assert.equal(await p.locator('.journal-word-trigger[aria-expanded=true]').count(),1);
  checks.push('record tab restores the expanded word and exact scroll position without resetting date/session/filter state');
  await nav('전체 단어장');await p.getByLabel('단어 또는 한국어 뜻 검색').fill('work');await p.getByRole('button',{name:'work 동사',exact:true}).click();
  const dialog=p.getByRole('dialog'),body=dialog.locator('.dialog-scroll');await body.waitFor();
  const header=dialog.locator('[data-slot=dialog-header]'),close=dialog.getByRole('button',{name:'Close',exact:true}),save=dialog.getByRole('button',{name:'기록 저장',exact:true});
  for(const width of [320,390,430,768,1440]){
   await p.setViewportSize({width,height:844});await fit('detail '+width);
   for(const scroll of [0,250,5000]){
    await body.evaluate((el,y)=>el.scrollTop=y,scroll);
    const bounds=await dialog.boundingBox(),h=await header.boundingBox(),x=await close.boundingBox(),b=await save.boundingBox(),scroller=await body.boundingBox();
    assert.ok(h.y>=bounds.y&&h.y+h.height<=scroller.y+4,'header stays outside scrolling body');
    assert.ok(x.y>=bounds.y&&x.y+x.height<=bounds.y+bounds.height,'close remains visible');
    assert.ok(b.y>=scroller.y+scroller.height-4&&b.y+b.height<=bounds.y+bounds.height,'save stays outside scrolling body');
    assert.ok(b.height>=48&&x.height>=44&&x.width>=44);
    assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
   }
  }
  await p.setViewportSize({width:390,height:844});await body.evaluate(el=>el.scrollTop=0);await axe('framed word editor');await checkTouch('word editor');await p.screenshot({path:out+'/word-editor.png'});
  await body.getByLabel('함께 익힐 표현',{exact:true}).fill('work with a friend');
  await body.getByLabel('표현의 한국어 뜻',{exact:true}).fill('친구와 함께 일하다');
  await body.getByLabel('표현의 한국어 뜻',{exact:true}).focus();
  await p.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-320});visualViewport.dispatchEvent(new Event('resize'));});
  await p.locator('.shell[data-keyboard=open]').waitFor();
  const keyboardDialog=await dialog.boundingBox();assert.ok(keyboardDialog.y>=0&&keyboardDialog.y+keyboardDialog.height<=524,'dialog fits visible viewport above keyboard');
  const keyboardSave=await save.boundingBox();assert.ok(keyboardSave.y+keyboardSave.height<=524,'save stays above keyboard');
  await p.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
  await save.click();await p.getByText('서버에 저장됨',{exact:true}).waitFor();await dialog.waitFor({state:'hidden'});
  const progress=(await get()).state.progress,work=words.find(w=>w.word==='work'&&w.pos==='v.'&&w.level==='A1');assert.equal(progress[work.id].expressionTranslation,'친구와 함께 일하다');
  assert.deepEqual((await get()).state.sessions,initial.state.sessions);
  checks.push('detail header/close/save remain visible at five widths and every body scroll position; editing saves without changing historical scores');
  await p.getByRole('button',{name:'work 동사',exact:true}).click();await body.getByLabel('표현의 한국어 뜻',{exact:true}).waitFor();assert.equal(await body.getByLabel('표현의 한국어 뜻',{exact:true}).inputValue(),'친구와 함께 일하다');await close.click();
  for(const [name,action] of [['settings',()=>p.getByRole('button',{name:'학습 설정',exact:true}).click()],['source',()=>p.getByRole('button',{name:'학습 방식·출처',exact:true}).click()],['personal',()=>p.getByRole('button',{name:'개인 단어 추가',exact:true}).click()]]){
   await action();await body.waitFor();await body.evaluate(el=>el.scrollTop=5000);const h=await header.boundingBox(),x=await close.boundingBox();assert.ok(h.y>=0&&x.y>=0&&x.y+x.height<=844,name);await axe(name);await checkTouch(name);await close.click();
  }
  await nav('오늘의 학습');await p.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).click();await body.waitFor();await body.evaluate(el=>el.scrollTop=5000);assert.ok(await header.isVisible());assert.ok(await close.isVisible());assert.ok(await dialog.getByRole('button',{name:'이 단어들 다시 학습',exact:true}).isVisible());await axe('completed cards');await close.click();
  checks.push('settings, sources, personal entry and completed cards use the same nonoverlapping frame and pass axe');
  for(const width of [320,390,430,768,1440]){
   await p.setViewportSize({width,height:844});
   for(const name of ['오늘의 학습','전체 단어장','주간·월말 점검','학습 기록']){await nav(name);await fit(name+' '+width);if(width===390)touch.push({name,small:await p.evaluate(()=>[...document.querySelectorAll('button,summary,a,[role=combobox]')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.width<44||r.height<44)}).map(el=>({text:el.textContent.trim().slice(0,40),class:el.className,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})))})}
  }
  await p.setViewportSize({width:320,height:844});const zoom=await p.addStyleTag({content:'html{font-size:200% !important}'});
  for(const name of ['오늘의 학습','전체 단어장','주간·월말 점검','학습 기록']){await nav(name);await fit(name+' 200%');}
  await zoom.evaluate(el=>el.remove());await p.setViewportSize({width:390,height:844});await nav('오늘의 학습');await p.evaluate(()=>window.scrollTo(0,0));
  const action=await p.getByRole('button',{name:'오늘 단어 다시 보기',exact:true}).boundingBox();assert.ok(action.y+action.height<=(await p.getByRole('tablist').boundingBox()).y);
  assert.equal(await p.locator('.today-word-row .help-details').count(),10);
  await p.locator('.today-word-row .help-details summary').first().click();assert.match(await p.locator('.today-word-row').first().innerText(),/새 학습 항목|이전 학습·복습 항목/);
  assert.equal(await p.locator('.today-word-row .status-badge svg').count(),10);
  await nav('전체 단어장');assert.equal(await p.locator('.meaning-cell').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await p.getByRole('button',{name:'work 동사',exact:true}).click();for(const input of await body.locator('input:not([type=checkbox]),textarea').all()){assert.ok(parseFloat(await input.evaluate(el=>getComputedStyle(el).fontSize))>=16);}
  await close.click();assert.deepEqual((await get()).state.sessions,initial.state.sessions);assert.deepEqual(errors,[]);for(const t of touch)assert.deepEqual(t.small,[],t.name+' 44px touch area');
  checks.push('all tabs fit five widths/200% text; first-screen action, 16px content/inputs and icon-labelled allocation states satisfy the plan');
  const report={passed:true,checks,audits,errors,touch};fs.writeFileSync(out+'/after.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
