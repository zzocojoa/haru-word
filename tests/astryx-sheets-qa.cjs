// Real built loopback UI; synthetic records only. WebKit is not an iPhone.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {base,launchBrowser,closeBrowser,accountHeaders,waitForWorker}=require('./qa/runtime.cjs');
const engine=process.env.QA_BROWSER||'chromium',baseline=process.env.ASTRYX_CAPTURE_BASELINE==='true';
const out=process.env.ASTRYX_QA_OUTPUT?path.join(process.env.ASTRYX_QA_OUTPUT,engine):`outputs/astryx-sheets-${engine}`;
fs.mkdirSync(out,{recursive:true});
(async()=>{
 await waitForWorker();const browser=await launchBrowser({engine});let page;
 const checks=[],geometry=[],errors=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',extraHTTPHeaders:accountHeaders('astryx_sheets')});
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  const get=async()=>(await context.request.get(base+'/api/state')).json(),initial=await get();
  const words=JSON.parse(fs.readFileSync('data/words.json')),content=JSON.parse(fs.readFileSync('data/content.json'));
  const word=words.find(w=>w.word==='work'&&w.pos==='v.');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),id=crypto.randomUUID();
  const sample=words.filter(w=>w.level==='A1').slice(0,20).map(w=>w.id);
  const session={id,kind:'daily',date,period:date,ids:[word.id],warmupIds:[],records:{[word.id]:{meaning:content[word.id].meaning,material:content[word.id],en:'independent',ko:'independent',sentenceStatus:'written',sentence:'I work here.',notes:''}},stage:'done',index:0,retry:[],retryMode:false,elapsed:600,finished:true,paused:true,createdAt:new Date().toISOString()};
  const seeded=await context.request.put(base+'/api/state',{data:{revision:initial.revision,settings:{...initial.state.settings,level:'A1',dailyGoal:1,assessments:{A1:{ids:sample,index:20,marks:Object.fromEntries(sample.map(x=>[x,'uncertain'])),completed:true}}},progress:{},sessions:{[id]:session}}});
  assert.equal(seeded.status(),200,await seeded.text());
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByText('저장됨',{exact:true}).waitFor();
  const before=await get(),dialog=page.getByRole('dialog');
  const tab=name=>page.getByRole('tab',{name,exact:true}).click(),button=name=>page.getByRole('button',{name,exact:true});
  const recordTool=async name=>{await tab('학습 기록');await button('기록 관리').click();await page.getByRole('menuitem',{name,exact:true}).click();};
  const kinds=[
   {id:'settings',open:async()=>{await tab('오늘 학습');await button('학습 설정').click();},ready:()=>dialog.getByRole('combobox',{name:'하루 목표',exact:true}).waitFor()},
   {id:'source',open:async()=>{await tab('오늘 학습');await button('학습 방식·출처').click();}},
   {id:'completed',open:async()=>{await tab('오늘 학습');await button('오늘 단어 다시 보기').click();},ready:()=>dialog.getByRole('combobox',{name:'다시 볼 단어 선택',exact:true}).waitFor()},
   {id:'date',open:async()=>{await tab('오늘 학습');await button('학습일 수정').click();},ready:()=>dialog.getByLabel('실제로 공부한 날').waitFor()},
   {id:'editor',open:async()=>{await tab('단어장');await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');await button('work 동사').click();},ready:async()=>{await dialog.getByLabel('함께 익힐 표현',{exact:true}).waitFor();await dialog.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));}},
   {id:'personal',open:async()=>{await tab('단어장');await button('개인 단어 추가').click();},ready:()=>dialog.getByLabel('영어 단어',{exact:true}).waitFor()},
   {id:'grammar-help',open:async()=>{await tab('단어장');await page.getByLabel('단어 또는 한국어 뜻 검색').fill('work');await button('work 동사 도움말').click();}},
   {id:'export',open:()=>recordTool('전체 백업'),ready:async()=>{const button=dialog.getByRole('button',{name:/다운로드$/});await button.waitFor();const element=await button.elementHandle();try{await page.waitForFunction(el=>!el.disabled&&!el.closest('[aria-disabled=true]'),element);}finally{await element.dispose();}}},
   {id:'restore',open:()=>recordTool('백업으로 복원'),ready:async()=>{const input=dialog.locator('input[type=file]');await input.waitFor();const element=await input.elementHandle();try{await page.waitForFunction(el=>!el.disabled,element);}finally{await element.dispose();}},overlayVeto:true},
   {id:'image',open:async()=>{await tab('오늘 학습');await button('이미지 연습').click();},close:'연습 닫기',ready:async()=>{
    await dialog.locator('.image-practice-navigation').waitFor();
    await page.waitForFunction(()=>{const image=document.querySelector('[role=dialog] .image-practice-picture');return image?.complete&&image.naturalWidth>0;});
   }},
  ];
  const selected=process.env.ASTRYX_SHEET_KINDS?.split(',')||kinds.map(k=>k.id);
  assert(selected.length&&selected.every(id=>kinds.some(k=>k.id===id)),'known nonempty sheet kinds');
  if(selected.some(kind=>['image','editor'].includes(kind))){
   const hashes=new Set(JSON.parse(fs.readFileSync('data/word-image-ui.json')).entries.map(row=>row[1]));
   const assetRoot=process.env.QA_WORD_IMAGE_ASSET_ROOT||'public/word-images-pilot';
   await context.route('**/word-images/v1/*.webp',route=>{
    const file=path.basename(new URL(route.request().url()).pathname),hash=file.replace(/\.webp$/,'');assert(hashes.has(hash),'known approved QA image');
    return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(assetRoot,file))});
   });
  }
  const settle=async()=>{await dialog.waitFor();await dialog.evaluate(el=>Promise.allSettled(el.getAnimations().map(a=>a.finished)));};
  if(!baseline)for(const kind of kinds.filter(k=>selected.includes(k.id)&&['image','personal'].includes(k.id))){
   await kind.open();await settle();await kind.ready?.();
   const close=dialog.locator(kind.id==='image'?'.image-practice-close':'.haru-sheet-close');
   assert.equal(await close.evaluate(el=>document.activeElement===el),true,'native initial close focus retained');
   assert.equal(await close.evaluate(el=>getComputedStyle(el).outlineStyle),'none','pointer opening has no keyboard outline');
   await page.keyboard.press('Tab');await close.focus();
   assert.equal(await close.evaluate(el=>el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle==='solid'&&parseFloat(getComputedStyle(el).outlineWidth)>=2),true,'keyboard close focus remains visible');
   await close.click();await dialog.waitFor({state:'hidden'});checks.push(kind.id+'/pointer-keyboard-focus');
  }
  for(const kind of kinds.filter(k=>selected.includes(k.id))){
   // T8 captures the original five paths; touch-backdrop interoperability is a new regression check.
   for(const method of baseline?['escape','x','overlay','back','swipe']:['escape','x','overlay','overlay-touch','back','swipe']){
    await kind.open();await settle();await kind.ready?.();
    if(!baseline)assert.equal(await dialog.evaluate(el=>el instanceof HTMLDialogElement&&el.open&&el.matches(':modal')),true,kind.id+' uses the native modal top layer');
    if(!baseline&&kind.id==='personal'){
     const area=dialog.getByRole('textbox',{name:'영어 예문',exact:true});
     await dialog.locator('.haru-editor-area>label').filter({hasText:'영어 예문'}).click();assert.equal(await area.evaluate(el=>el===document.activeElement),true,'visible editor label focuses its Core textarea');
     assert.equal(await area.getAttribute('maxlength'),'2000');assert.equal(await area.getAttribute('rows'),'2');
    }
    assert.ok(await dialog.getAttribute('aria-labelledby'),kind.id+' labelled');
    if(!baseline&&method==='escape'){
     const box=await dialog.boundingBox(),element=await dialog.elementHandle();
     try{await page.mouse.click(box.x+2,box.y+box.height/2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      assert.equal(await element.evaluate(el=>el.isConnected&&el.open&&el.getAttribute('data-state')==='open'),true,kind.id+' inside padding must not dismiss the sheet');
     }finally{await element.dispose();}
    }
    if(!baseline&&kind.id==='completed'&&method==='escape'){
     const selector=dialog.getByRole('combobox',{name:'다시 볼 단어 선택',exact:true});await selector.click();const popup=page.getByRole('listbox');await popup.waitFor();
     await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.ok(await dialog.isVisible(),'replay option Escape keeps its native parent open');
     assert.equal(await selector.evaluate(el=>el===document.activeElement),true,'replay option Escape returns focus to its trigger');
    }
    if(method==='escape'){
     for(const width of [390,1440])for(const size of [100,200]){
      await page.setViewportSize({width,height:844});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);await page.evaluate(()=>document.fonts.ready);
      await dialog.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const sample=await dialog.evaluate((el,kind)=>{
       const css=e=>{if(!e)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();return{rect:[r.x,r.y,r.width,r.height].map(x=>+x.toFixed(2)),font:s.fontFamily,size:s.fontSize,line:s.lineHeight,color:s.color,padding:s.padding,gap:s.gap,border:s.border,radius:s.borderRadius,overflow:s.overflow};};
       const detail=e=>{const s=getComputedStyle(e);return{...css(e),tag:e.tagName,cls:e.className,label:e.textContent.trim().slice(0,90),weight:s.fontWeight,display:s.display,whiteSpace:s.whiteSpace,minHeight:s.minHeight,margin:s.margin,boxSizing:s.boxSizing};};
       let dateCloseLines;
       if(kind==='date'){
        const button=el.querySelector('.dialog-actions button:last-child'),walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT),tops=[];
        for(let node=walker.nextNode();node;node=walker.nextNode())if(node.textContent.trim()==='닫기'){const range=document.createRange();range.selectNodeContents(node);tops.push(...[...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>Math.round(r.top)));}
        dateCloseLines=new Set(tops).size;
       }
       return{root:css(el),header:css(el.querySelector('[data-slot=dialog-header]')),body:css(el.querySelector('.dialog-scroll')),caption:css(el.querySelector('.haru-sheet-frame>.text-sm')||el.querySelector(':scope>.text-sm')),actions:css(el.querySelector('.dialog-actions')),close:css(el.querySelector('.haru-sheet-close')||el.querySelector(':scope>[data-slot=dialog-close]')||el.querySelector('.image-practice-close')),overflow:el.scrollWidth>el.clientWidth||document.documentElement.scrollWidth>innerWidth,
        ...(kind==='date'?{dateCloseLines}:{}),...(['date','export','restore'].includes(kind)?{leaves:[...el.querySelectorAll('.dialog-scroll p,.dialog-scroll input,.dialog-actions button')].map(e=>({...detail(e),children:[...e.children].map(detail)}))}:{})};
      },kind.id);
      assert.equal(sample.overflow,false,kind.id+'/'+width+'/'+size+' overflow');
      if(!baseline&&kind.id==='date')assert.equal(sample.dateCloseLines,1,'date Close label remains on one line at '+width+'/'+size);
      geometry.push({kind:kind.id,width,size,...sample});
      await page.screenshot({path:path.join(out,`${kind.id}-${width}-${size}.png`)});
     }
     await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:390,height:844});
     if(kind.id==='restore')await dialog.locator('input[type=file]').focus();
     await page.keyboard.press('Escape');
    }else if(method==='x')await (kind.close?dialog.getByRole('button',{name:kind.close,exact:true}):dialog.locator('[data-slot=dialog-close]').last()).click();
    else if(method==='overlay'||method==='overlay-touch'){
     assert.ok((await dialog.boundingBox()).y>1,'backdrop coordinate is outside sheet');
     if(!baseline&&kind.id==='settings'&&method==='overlay-touch')for(const cancel of [true,false]){
      await dialog.evaluate((el,cancel)=>{
       for(const [type,x]of [['touchstart',1],...(cancel?[['touchcancel',1]]:[['touchmove',40],['touchend',40]])]){
        const event=new Event(type,{bubbles:true,cancelable:true}),touch={identifier:9,clientX:x,clientY:1};Object.defineProperties(event,{touches:{value:/end|cancel/.test(type)?[]:[touch]},changedTouches:{value:[touch]}});el.dispatchEvent(event);
       }
      },cancel);
      assert.equal(await dialog.getAttribute('data-state'),'open','cancelled or moved backdrop touch cannot become a click');checks.push('settings/backdrop-touch-'+(cancel?'cancel':'move'));
     }
     if(method==='overlay-touch')await page.touchscreen.tap(1,1);else await page.mouse.click(1,1);
     if(kind.overlayVeto){
      assert.ok(await dialog.isVisible(),'restore backdrop must remain vetoed');
      if(baseline)await dialog.getByRole('button',{name:'닫기',exact:true}).click();
      else{
       const box=await dialog.boundingBox();
       if(method==='overlay-touch')await page.touchscreen.tap(box.x+2,box.y+box.height/2);else await page.mouse.click(box.x+2,box.y+box.height/2);
       assert.ok(await dialog.isVisible(),'inside sheet padding is not backdrop');
       await dialog.evaluate(el=>el.dispatchEvent(new Event('cancel',{cancelable:true})));await dialog.waitFor({state:'hidden'});checks.push('restore/native-cancel-after-'+method);
      }
     }
    }else if(method==='back')await dialog.evaluate(el=>{
     const header=el.querySelector('[data-slot=dialog-header]'),r=header.getBoundingClientRect();
     for(const [type,dx]of [['touchstart',0],['touchmove',180],['touchend',180]]){const event=new Event(type,{bubbles:true,cancelable:true}),touch={identifier:8,clientX:5+dx,clientY:r.y+10};Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[touch]},changedTouches:{value:[touch]}});header.dispatchEvent(event);}
    });
    else await dialog.evaluate(el=>{
     const handle=el.querySelector('[data-sheet-handle]'),r=handle.getBoundingClientRect();assertHandle();
     function assertHandle(){if(!r.width||!r.height)throw Error('visible swipe handle required');}
     for(const [type,dy]of [['touchstart',0],['touchmove',160],['touchend',160]]){const event=new Event(type,{bubbles:true,cancelable:true}),touch={identifier:7,clientX:r.x+r.width/2,clientY:r.y+22+dy};Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[touch]},changedTouches:{value:[touch]}});handle.dispatchEvent(event);}
    });
    await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),false,kind.id+'/'+method+' returns focus outside sheet');
    if(kind.id==='grammar-help'){
     const trigger=await button('work 동사 도움말').elementHandle();
     try{await page.waitForFunction(element=>document.activeElement===element,trigger);}finally{await trigger.dispose();}
    }
    assert.deepEqual(await get(),before,kind.id+'/'+method+' preserves state and revision');checks.push(kind.id+'/'+method);console.log(JSON.stringify({passed:kind.id+'/'+method}));
   }
  }
  if(selected.includes('export')){
   await kinds.find(k=>k.id==='export').open();await settle();
   const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'백업 파일 다운로드',exact:true}).click();
   const backup=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));assert.equal(backup.format,'haru-words-v1');assert.ok(Number.isFinite(Date.parse(backup.exportedAt)));
   for(const key of ['sessions','progress'])assert.deepEqual(backup.state[key],before.state[key],'export preserves '+key);
   for(const key of ['level','dailyGoal','reviewDay'])assert.equal(backup.state.settings[key],before.state.settings[key],'export preserves setting '+key);
   await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('[data-backup-trigger]'));
   assert.deepEqual(await get(),before,'export download never mutates records or revision');checks.push('export/download');
  }
  if(selected.includes('grammar-help')){
   await kinds.find(k=>k.id==='grammar-help').open();await settle();await dialog.getByRole('button',{name:'이 품사 배우기',exact:true}).click();await dialog.waitFor({state:'hidden'});
   const heading=page.locator('.grammar-lesson h2').first();await heading.waitFor();const element=await heading.elementHandle();
   try{await page.waitForFunction(el=>el===document.activeElement,element);}finally{await element.dispose();}
   assert.deepEqual(await get(),before,'help-to-lesson transition preserves records and revision');checks.push('grammar-help/lesson-focus');
  }
  assert.deepEqual(errors,[]);const report={passed:true,engine,baseline,kinds:selected,checks,geometry,errors,actualIphone:false};
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,engine,kinds:selected,closeChecks:checks.length,views:geometry.length}));
 }catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({checks,geometry,errors,url:page?.url()},null,2));if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{await closeBrowser(browser);}
})().catch(error=>{console.error(error);process.exitCode=1;});
