// Synthetic local accounts. Compare the same visible content before/after migration.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {base,launchBrowser,closeBrowser,accountHeaders}=require('./qa/runtime.cjs');
const {build}=require('esbuild');
const baseline=process.env.ASTRYX_CAPTURE_BASELINE==='true',engine=process.env.QA_BROWSER||'chromium';
const out=path.resolve(process.env.ASTRYX_QA_OUTPUT||'outputs/astryx-grammar',engine);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 await build({entryPoints:['lib/grammar/practice.ts','lib/grammar/model.ts','lib/grammar/content-v4.ts'],outdir:'work/astryx-grammar-fixture',bundle:true,format:'cjs',platform:'node',outExtension:{'.js':'.cjs'},logLevel:'silent'});
 const {newLessonProgress,questionsFor}=require('../work/astryx-grammar-fixture/practice.cjs');
 const {recordAnswer,newGrammarProgress}=require('../work/astryx-grammar-fixture/model.cjs');
 const {practiceForVersion}=require('../work/astryx-grammar-fixture/content-v4.cjs');
 const browser=await launchBrowser(),snapshots=[],errors=[];let ai=0;
 try{
  for(const scenario of [{view:'catalog'},{view:'question',stage:2},{view:'writing-legacy',stage:5},{view:'writing-current',stage:5,contentVersion:2},{view:'summary',stage:6}]){
   const c=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce',extraHTTPHeaders:accountHeaders('astryx_grammar')});
   await c.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
   const get=async()=>{const r=await c.request.get(base+'/api/state',{headers:{'X-Study-Grammar':'4'}});assert.equal(r.status(),200);return r.json();};
   const initial=await get(),now=new Date().toISOString();
   if(scenario.stage!==undefined){
    const progress=scenario.contentVersion?newLessonProgress('noun',now,scenario.contentVersion):newGrammarProgress(now);
    progress.stage=scenario.stage;progress.sentence=scenario.stage>=5?'I like books.':'';
    if(scenario.contentVersion)progress.observation=recordAnswer(undefined,practiceForVersion('noun',scenario.contentVersion).observation.answer);
    progress.answers=Object.fromEntries(questionsFor('noun',progress).slice(0,Math.min(3,scenario.stage-2)).map((q,i)=>['q'+(i+1),recordAnswer(undefined,q.answer)]));
    if(scenario.stage===6){progress.check='appropriate';progress.completedAt=now;}
    const r=await c.request.put(base+'/api/state',{headers:{'X-Study-Grammar':'4'},data:{revision:initial.revision,grammar:{noun:progress},progress:{},sessions:{}}});assert.equal(r.status(),200,scenario.view+': '+await r.text());
   }
   const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST'&&/\/api\/(sentence|grammar)-feedback/.test(r.url()))ai++;});
   await p.goto(base);await p.getByText('저장됨',{exact:true}).waitFor();
   await p.getByRole('tab',{name:'단어장',exact:true}).click();await p.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();
   await p.getByRole('heading',{name:'품사와 문장 연습',exact:true}).waitFor();
   const before=await get();
   if(scenario.stage!==undefined)await p.locator('.grammar-tile').first().click();
   const scope=scenario.stage===undefined?'.grammar-catalog':'.grammar-lesson';await p.locator(scope).waitFor();
   for(const width of [390,1440]){
    await p.setViewportSize({width,height:900});await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));});
    const styles=await p.locator(scope).evaluate(root=>['h2','h3','p','button','textarea','.grammar-check'].flatMap(selector=>[...root.querySelectorAll(selector)].filter(e=>e.getClientRects().length).slice(0,18).map((e,index)=>{
     const box=e.matches('textarea')?(e.closest('.haru-field-control')??e):e,s=getComputedStyle(e),b=getComputedStyle(box);
     return {selector,index,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,color:s.color,background:b.backgroundColor,border:b.border,padding:b.padding,radius:b.borderRadius,height:Math.round(box.getBoundingClientRect().height*100)/100};
    })));
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const geometry=await p.evaluate(()=>({tabs:[...document.querySelectorAll('.library-mode-tabs,.library-mode-tabs [role=tab]')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{role:e.getAttribute('role'),height:r.height,font:s.fontSize,line:s.lineHeight,border:s.border,padding:s.padding,margin:s.margin};}),radios:[...document.querySelectorAll('.grammar-check input[type=radio]')].map(e=>{const row=e.closest('.astryx-radio-list-item')??e.closest('label'),s=getComputedStyle(e),r=getComputedStyle(row);return{input:{height:e.getBoundingClientRect().height,margin:s.margin,padding:s.padding,minHeight:s.minHeight},row:{height:row.getBoundingClientRect().height,padding:r.padding,margin:r.margin}};})}));
    snapshots.push({view:scenario.view,width,styles,geometry});await p.screenshot({path:path.join(out,scenario.view+'-'+width+'.png'),fullPage:true});
   }
   if(!baseline){
    assert.equal(await p.locator(scope+'.astryx-card').count(),1);
    assert.ok(await p.locator(scope+' .astryx-button').count());
    if(scenario.stage===undefined){
     assert.equal(await p.locator('.grammar-catalog-heading .small-note').innerText(),'수업당 약 3~5분');
     assert.match(await p.locator('.grammar-catalog-count').innerText(),/0\/15/);
     assert.equal(await p.locator('.grammar-filter-result').innerText(),'하루 목표와 별도');
     await p.getByRole('group',{name:'수업 표시'}).getByRole('button',{name:/^이어 하기\s*0$/}).click();
     assert.match(await p.locator('.grammar-filter-result').innerText(),/이어 할 수업 0개/);
     assert.deepEqual(await get(),before);
    }
    if(scenario.view.startsWith('writing')){
     const field=p.getByRole('textbox',{name:'내 문장',exact:true});assert.equal(await field.getAttribute('maxlength'),'2000');assert.equal(await field.getAttribute('rows'),'4');
     assert.equal(await field.getAttribute('aria-describedby'),'grammar-sentence-count');
     assert.ok(await p.locator('.grammar-check .astryx-radio-list-item').count());
     const radio=p.getByRole('radio',{name:scenario.contentVersion?'확인했어요':'뜻과 형태를 확인했어요',exact:true}).first();
     // The native radio stays the group's only focusable control; row clicks delegate to it.
     const target=await radio.locator('xpath=ancestor::*[contains(@class,"astryx-radio-list-item")]').boundingBox();assert.ok(target.height>=44&&target.width>=44);
     await radio.focus();await p.keyboard.press('Space');assert.equal(await radio.isChecked(),true);
     assert.equal(await p.getByRole('button',{name:'수업 마치기',exact:true}).evaluate(button=>{
      const svg=button.querySelector('svg'),walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let text;
      while((text=walker.nextNode()))if(text.textContent.trim()&&!text.parentElement.closest('[aria-hidden=true],[role=status]'))break;
      return !!text&&!!svg&&!!(text.compareDocumentPosition(svg)&Node.DOCUMENT_POSITION_FOLLOWING);
     }),true,'completion retains its trailing check icon');
    }
   }
   assert.deepEqual((await get()).state.progress,before.state.progress);await c.close();
  }
  assert.equal(ai,0);assert.deepEqual(errors,[]);assert.equal(snapshots.length,10);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,baseline,ai,errors,snapshots},null,2));console.log(JSON.stringify({passed:true,baseline,views:snapshots.length,ai}));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
