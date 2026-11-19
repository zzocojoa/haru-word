const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {base,launchBrowser,closeBrowser,accountHeaders}=require('./qa/runtime.cjs');
const baseline=process.env.ASTRYX_CAPTURE_BASELINE==='true',engine=process.env.QA_BROWSER||'chromium',out=path.resolve(process.env.ASTRYX_QA_OUTPUT||'outputs/astryx-library',engine);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await launchBrowser(),snapshots=[],errors=[];
 try{
  const c=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce',extraHTTPHeaders:accountHeaders('astryx_library')});
  await c.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));let ai=0;
  p.on('request',r=>{if(r.method()==='POST'&&/\/api\/(sentence|grammar)-feedback/.test(r.url()))ai++;});
  const get=async()=>(await c.request.get(base+'/api/state')).json();
  await p.goto(base);await p.getByText('저장됨',{exact:true}).waitFor();const before=await get();
  await p.getByRole('tab',{name:'단어장',exact:true}).click();
  const capture=async(view,scope)=>{
   for(const width of [390,1440]){
    await p.setViewportSize({width,height:900});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const styles=await p.locator(scope).evaluate(root=>['h2','h3','p','th','td','input','textarea','button'].flatMap(selector=>[...root.querySelectorAll(selector)].filter(e=>e.getClientRects().length&&!e.matches('[type=hidden]')).slice(0,selector==='td'?10:20).map((e,index)=>{
     const visual=e.matches('input,textarea')?(e.closest('.haru-field-control')??e):e,s=getComputedStyle(visual);
     return{selector,index,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,border:s.border,radius:s.borderRadius,decoration:s.textDecorationLine,height:Math.round(visual.getBoundingClientRect().height*100)/100};
    })));
    snapshots.push({view,width,styles});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.screenshot({path:path.join(out,view+'-'+width+'.png'),fullPage:true});
   }
   await p.setViewportSize({width:390,height:900});
  };
  await capture('library','.library-panel');
  if(!baseline){
   assert.equal(await p.locator('.library-search .astryx-text-input').count(),1);
   const search=p.getByLabel('단어 또는 한국어 뜻 검색',{exact:true});await search.fill('arrive');await p.getByRole('button',{name:'필터 초기화',exact:true}).click();
   assert.equal(await search.inputValue(),'');assert.equal(await search.evaluate(e=>e===document.activeElement),true);assert.deepEqual(await get(),before);
   assert.equal(await p.locator('table.astryx-table.word-table').count(),1);
   for(const name of ['품사 필터','단어장 수준 필터','친숙도 필터','페이지당 단어 수'])assert.equal(await p.getByRole('combobox',{name,exact:true}).count(),1);
  }
  await p.locator('.word-link').first().click();await p.getByRole('dialog').waitFor();await p.getByLabel('학습할 뜻',{exact:true}).waitFor();await capture('editor','.word-dialog');
  const original=await p.getByLabel('학습할 뜻',{exact:true}).inputValue();assert.equal(await p.getByLabel('학습할 뜻',{exact:true}).getAttribute('readonly'),'');assert.equal(await p.getByLabel('학습할 뜻',{exact:true}).getAttribute('maxlength'),'2000');
  if(!baseline){
   const sense=p.getByRole('combobox',{name:'학습할 뜻 선택',exact:true});assert.equal(await sense.count(),1);
   assert.equal(await p.getByRole('dialog').getByText('뜻마다 성적을 따로 저장해요.',{exact:true}).count(),1);
   await p.getByRole('button',{name:'다른 뜻 추가',exact:true}).click();await p.getByLabel('학습할 뜻',{exact:true}).fill('합성 새 뜻');
   await sense.click();await p.getByRole('option',{name:original,exact:true}).click();assert.equal(await p.getByLabel('학습할 뜻',{exact:true}).inputValue(),original);
   await sense.click();await p.getByRole('option',{name:'새로운 뜻 · 초안',exact:true}).click();assert.equal(await p.getByLabel('학습할 뜻',{exact:true}).inputValue(),'합성 새 뜻');
  }
  await p.getByRole('button',{name:'닫기',exact:true}).click();if(!baseline)await p.getByRole('alertdialog').getByRole('button',{name:'변경 버리고 닫기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),before);
  await p.getByRole('button',{name:'개인 단어 추가',exact:true}).click();await p.getByRole('dialog').waitFor();await p.getByLabel('영어 단어',{exact:true}).waitFor();await capture('personal','.word-dialog');
  assert.equal(await p.getByLabel('영어 단어',{exact:true}).getAttribute('maxlength'),'80');assert.equal(await p.getByLabel('학습할 한국어 뜻',{exact:true}).getAttribute('maxlength'),'2000');
  if(!baseline)assert.equal(await p.getByRole('combobox',{name:'개인 단어 품사',exact:true}).count(),1);
  await p.getByRole('button',{name:'닫기',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await get(),before);assert.equal(ai,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,baseline,ai,errors,snapshots},null,2));console.log(JSON.stringify({passed:true,baseline,views:6,ai}));
 }finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
