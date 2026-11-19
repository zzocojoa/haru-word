const { launchBrowser, closeBrowser }=require('./qa/runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
// Local synthetic learners only; test every stage at all required widths and text sizes.
const base=require('./qa/runtime.cjs').base,out=process.env.ASTRYX_QA_OUTPUT?require('node:path').join(process.env.ASTRYX_QA_OUTPUT,process.env.QA_BROWSER||'chromium'):'outputs/completion-matrix';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
const chosen=['breakfast','arrive','busy'].map(name=>words.find(w=>w.word===name));const ids=chosen.map(w=>w.id);
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{const browser=await launchBrowser();const rows=[],errors=[],issues=[];
try{
 for(const stage of ['warmup','learn','en','ko','sentence']){
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':'completion_'+stage+require('./qa/runtime.cjs').account('_'),'oai-authenticated-user-email':'qa@example.test'}});
  await c.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  const get=async()=> (await c.request.get(base+'/api/state')).json();const initial=await get(),id=crypto.randomUUID();
  const session={id,kind:'daily',date,period:date,ids,warmupIds:stage==='warmup'?[ids[0]]:[],stage,index:0,records:Object.fromEntries(ids.map(id=>[id,{meaning:content[id].meaning,material:content[id],en:'unmeasured',ko:'unmeasured',sentenceStatus:'unmeasured',sentence:'',notes:''}])),retry:[],retryMode:false,elapsed:0,paused:true,finished:false,createdAt:new Date().toISOString()};
  const res=await c.request.put(base+'/api/state',{data:{revision:initial.revision,settings:{...initial.state.settings,activeSessionId:id},progress:{},sessions:{[id]:session}}});assert.equal(res.status(),200,await res.text());
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base,{waitUntil:'domcontentloaded'});await p.getByText('저장됨',{exact:true}).waitFor();await p.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await p.getByText('저장됨',{exact:true}).waitFor();await p.locator('.session-panel').waitFor().catch(async error=>{fs.writeFileSync(out+'/failure.json',JSON.stringify({stage,body:await p.locator('body').innerText(),state:await get(),errors},null,2));throw error;});
  if(process.env.ASTRYX_CAPTURE_BASELINE!=='true'){assert.equal(await p.locator('.astryx-card.session-panel').count(),1);assert.ok(await p.locator('.session-panel .astryx-button').count());assert.ok(await p.locator('.session-panel .haru-study-field').count());for(const field of await p.locator('.haru-study-field input,.haru-study-field textarea').all())assert.equal(await field.getAttribute('maxlength'),'2000');}
  const inspect=async name=>{
   for(const width of [320,390,430,768,1440]){
    await p.setViewportSize({width,height:844});
    for(const zoom of [100,200]){
     await p.evaluate(z=>document.documentElement.style.fontSize=z+'%',zoom);
     await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));});
     const metrics=await p.evaluate(()=>({controls:[...document.querySelectorAll('.session-panel input:not([type=checkbox]),.session-panel textarea,.session-panel h2,.session-panel h3,.session-panel .primary-button,.session-panel .secondary-button')].filter(e=>e.getClientRects().length).map((e,index)=>{const v=e.matches('input,textarea')?(e.closest('.haru-field-control')??e):e,s=getComputedStyle(e),box=getComputedStyle(v);return{tag:e.tagName,index,label:e.getAttribute('aria-label')??e.id,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,color:s.color,background:box.backgroundColor,border:box.border,padding:box.padding,height:Math.round(v.getBoundingClientRect().height*100)/100};}),width:innerWidth,scroll:document.documentElement.scrollWidth,small:[...document.querySelectorAll('.session-panel button,.session-panel a,.session-panel summary')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.width<44||r.height<44)}).map(el=>({text:el.textContent.trim().slice(0,40),class:el.className,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})),overflow:[...document.querySelectorAll('.session-panel *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.right>innerWidth+1||el.scrollWidth>el.clientWidth+2)}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.trim().slice(0,40),client:el.clientWidth,scroll:el.scrollWidth}))}));
     if(name==='learn-initial'&&width===768&&zoom===200)await p.screenshot({path:out+'/learn-768-200-after.png',fullPage:true});
     const r={state:name,width,zoom,...metrics};rows.push(r);if(metrics.scroll>width||metrics.small.length){issues.push(r);await p.screenshot({path:out+'/'+name+'-'+width+'-'+zoom+'.png',fullPage:true});}
    }
   }
   if(name==='learn-initial')await p.screenshot({path:out+'/learn-desktop-after.png',fullPage:true});
   await p.evaluate(()=>document.documentElement.style.fontSize='100%');await p.setViewportSize({width:390,height:844});
  };
  await inspect(stage+'-initial');
  if(['warmup','en','ko'].includes(stage)){await p.getByRole('button',{name:stage==='warmup'?/^뜻 확인/:/^내 답 확인/}).click();await p.getByText('저장됨',{exact:true}).waitFor();await inspect(stage+'-revealed');}
  for(const record of Object.values((await get()).state.sessions[id].records)){assert.equal(record.en,'unmeasured');assert.equal(record.ko,'unmeasured');assert.equal(record.sentenceStatus,'unmeasured');}
  await c.close();
 }
 const report={passed:issues.length===0&&errors.length===0,states:[...new Set(rows.map(r=>r.state))],combinations:rows.length,issues,errors,rows};fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined}));assert.equal(report.passed,true,'study layout contract');
}finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1});
