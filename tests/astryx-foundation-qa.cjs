// Real built Worker + synthetic account. The profile must opt in explicitly.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchBrowser,closeBrowser,base,accountHeaders}=require('./qa/runtime.cjs');
const {grammarWorker}=require('./qa/worker-profile.cjs');
const out=path.resolve(process.env.ASTRYX_QA_OUTPUT||'outputs/astryx-foundation',process.env.QA_BROWSER||'chromium');
fs.mkdirSync(out,{recursive:true});const checks=[],errors=[],requests=[];
(async()=>{
 const browser=await launchBrowser({headless:true});let disabled;
 try{
  const headers=accountHeaders('astryx_foundation');
  const context=await browser.newContext({viewport:{width:390,height:900},colorScheme:'dark',reducedMotion:'reduce',extraHTTPHeaders:headers});
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET')requests.push({method:r.method(),path:new URL(r.url()).pathname});});
  const response=await p.goto(base+'/astryx-foundation',{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await p.getByRole('button',{name:'내용 확인',exact:true}).waitFor();
  const read=()=>p.getByRole('button',{name:'내용 확인',exact:true}).evaluate(e=>{const s=getComputedStyle(e);return{padding:parseFloat(s.paddingInlineStart),height:e.getBoundingClientRect().height,font:s.fontSize,background:s.backgroundColor,color:s.color,outline:s.outlineColor,fontFamily:s.fontFamily};});
  const styles=await read();assert.ok(styles.padding>=12,JSON.stringify(styles));assert.ok(styles.height>=48);assert.equal(styles.font,'16px');assert.equal(styles.background,'rgb(217, 249, 95)');assert.equal(styles.color,'rgb(36, 38, 33)');assert.match(styles.fontFamily,/DM Sans.*Noto Sans KR/);
  assert.equal(await p.getByRole('textbox',{name:'확인할 단어',exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'16px');
  assert.equal(await p.getByRole('textbox',{name:'전달하려는 뜻',exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'16px');
  assert.equal(await p.getByText('입력·선택·오류 상태를 확인하는 로컬 검증 화면입니다.',{exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'14px');
  assert.ok((await p.getByRole('button',{name:'다시 시도',exact:true}).boundingBox()).height>=44);
  assert.doesNotMatch(await p.locator('body').innerText(),/Loading|Dismiss|Optional|Select an option/);
  checks.push('light palette, inherited fonts, 16px inputs/primary, 48px primary and 44px secondary retain nonzero padding under legacy CSS');
  const before=await context.request.get(base+'/api/state');const initial=await before.json();
  const word=p.getByRole('textbox',{name:'확인할 단어',exact:true}),note=p.getByRole('textbox',{name:'전달하려는 뜻',exact:true});
  await word.fill('journey');assert.ok((await p.getByText('입력 이벤트: journey',{exact:true}).count())>0);
  await note.fill('길게 쓴 한국어 문장도 줄바꿈과 입력값을 유지합니다.');await p.getByText('입력 이벤트: 길게 쓴 한국어 문장도 줄바꿈과 입력값을 유지합니다.',{exact:true}).waitFor();
  await p.getByRole('button',{name:'단어로 돌아가기',exact:true}).click();assert.equal(await word.evaluate(e=>document.activeElement===e),true);
  await p.getByRole('button',{name:'뜻으로 돌아가기',exact:true}).click();assert.equal(await note.evaluate(e=>document.activeElement===e),true);
  await p.getByRole('combobox',{name:'단어 수준',exact:true}).click();await p.getByRole('option',{name:'A2',exact:true}).click();
  await p.getByText('실행 횟수: 0 · 재시도 횟수: 0 · 선택: A2',{exact:true}).waitFor();
  checks.push('value/event agreement, input/textarea refs and Korean selector work after hydration');
  for(const name of ['확인할 내용 없음','확인 중']){const b=p.getByRole('button',{name,exact:true});assert.equal(await b.getAttribute('aria-disabled'),'true');await b.click({force:true});await b.focus();await p.keyboard.press('Enter');await p.keyboard.press('Space');}
  await p.getByText('실행 횟수: 0 · 재시도 횟수: 0 · 선택: A2',{exact:true}).waitFor();
  await p.getByRole('button',{name:'내용 확인',exact:true}).click();await p.getByText('실행 횟수: 1 · 재시도 횟수: 0 · 선택: A2',{exact:true}).waitFor();
  assert.ok(await p.getByText('입력한 내용은 그대로 있어요. 연결을 확인한 뒤 다시 시도해 주세요.',{exact:true}).isVisible());
  await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.getByText('실행 횟수: 1 · 재시도 횟수: 1 · 선택: A2',{exact:true}).waitFor();
  assert.equal(await word.inputValue(),'journey');assert.equal(await note.inputValue(),'길게 쓴 한국어 문장도 줄바꿈과 입력값을 유지합니다.');
  assert.deepEqual(await(await context.request.get(base+'/api/state')).json(),initial);assert.deepEqual(requests,[]);
  checks.push('disabled/loading click + Enter/Space invoke zero actions; error/retry always visible, values and server state preserved, no mutations/AI requests');
  await p.getByRole('button',{name:'내용 확인',exact:true}).focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');
  const focus=await p.getByRole('button',{name:'내용 확인',exact:true}).evaluate(e=>({color:getComputedStyle(e).outlineColor,width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));assert.equal(focus.color,'rgb(36, 38, 33)');assert.notEqual(focus.width,'0px');
  const primary=p.getByRole('button',{name:'내용 확인',exact:true}),contrast=[];
  for(const state of ['focus','hover','press']){
    if(state==='hover')await primary.hover();if(state==='press')await p.mouse.down();
    contrast.push(await primary.evaluate((e,state)=>{
      const s=getComputedStyle(e),rgb=v=>(v.match(/[\d.]+/g)||[]).map(Number),fg=rgb(s.color),bg=rgb(s.backgroundColor),overlay=s.backgroundImage.match(/rgba?\([^)]+\)/);
      if(overlay){const o=rgb(overlay[0]),a=o[3]??1;for(let i=0;i<3;i++)bg[i]=o[i]*a+bg[i]*(1-a);}
      const lum=c=>c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0),a=lum(fg),b=lum(bg);
      return{state,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),background:s.backgroundColor,overlay:s.backgroundImage};
    },state));
    if(state==='press')await p.mouse.up();
  }
  assert.ok(contrast.every(s=>s.ratio>=4.5),JSON.stringify(contrast));
  for(const width of [320,390,430,768,1440]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);const long=p.getByRole('button',{name:'연결을 확인한 뒤 입력한 내용을 유지하고 다시 확인하기',exact:true});assert.ok(await long.evaluate(e=>e.scrollWidth<=e.clientWidth),'long Korean action must wrap without clipping');await p.screenshot({path:path.join(out,'foundation-'+width+'.png'),fullPage:true,animations:'disabled'});}
  await p.setViewportSize({width:768,height:900});await p.evaluate(()=>document.body.style.zoom='2');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% overflow');await p.screenshot({path:path.join(out,'foundation-200-percent.png'),fullPage:true,animations:'disabled'});await p.evaluate(()=>document.body.style.zoom='');
  await p.addScriptTag({path:process.env.AXE_CORE_PATH});const axe=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));});assert.deepEqual(axe,[]);
  checks.push('keyboard focus, 320/390/430/768/1440, 200%, dark OS/light theme, reduced motion and WCAG axe pass');
  await p.setViewportSize({width:390,height:900});const injected=await p.addStyleTag({content:'button.astryx-button {padding:0 !important}'});assert.equal((await read()).padding,0,'negative reset must be detected');await injected.evaluate(e=>e.remove());assert.ok((await read()).padding>=12);checks.push('negative reset control detects padding=0 and clean state is restored');
  const ssr=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900},extraHTTPHeaders:headers});await ssr.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));const sp=await ssr.newPage();await sp.goto(base+'/astryx-foundation',{waitUntil:'networkidle'});const computed=await sp.getByRole('button',{name:'내용 확인',exact:true}).evaluate(e=>({bg:getComputedStyle(e).backgroundColor,padding:getComputedStyle(e).paddingInlineStart}));assert.equal(computed.bg,styles.background);assert.ok(parseFloat(computed.padding)>=12);checks.push('SSR with JavaScript disabled already paints Haru theme and padding without hydration/FOUC');await ssr.close();
  disabled=await grammarWorker(2);assert.equal((await context.request.get(disabled.base+'/astryx-foundation')).status(),404);checks.push('ordinary profile returns 404; developer screen is opt-in only');
  const home=await context.newPage();home.on('pageerror',e=>errors.push(e.message));await home.goto(disabled.base);await home.getByText('저장됨',{exact:true}).waitFor();const homeCss=await home.evaluate(()=>[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>e.getAttribute('href')).filter(Boolean));assert.ok(homeCss.some(url=>/layout\./.test(url)));assert.equal(await home.locator('.astryx-app-shell.haru-frame').count(),1,'ordinary home now renders the migrated shell');
  const foundationCss=fs.readdirSync('dist/client/_next/static/css').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(path.join('dist/client/_next/static/css',f),'utf8')).find(css=>css.includes('astryx-base'));
  assert.ok(foundationCss,'use the real compiled route CSS for lazy coexistence');const coexist=[];
  const compareCascade=async label=>{
    await home.waitForLoadState('networkidle');
    const read=()=>home.evaluate(()=>[...document.querySelectorAll('button,input,textarea,select,h1,h2,h3,[role=dialog],.dialog-scroll,.dialog-actions,.session-panel,.grammar-catalog')].filter(e=>e.getClientRects().length).map(e=>{const s=getComputedStyle(e);return{tag:e.tagName,cls:e.className,font:s.fontFamily,size:s.fontSize,padding:s.padding,border:s.border,color:s.color,background:s.backgroundColor,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,position:s.position,overflow:s.overflow,outline:s.outline};}));
    const before=await read(),style=await home.addStyleTag({content:foundationCss});const after=await read();assert.deepEqual(after,before,label+' changes under late Astryx CSS');await home.screenshot({path:path.join(out,'coexist-'+label+'.png'),fullPage:true,animations:'disabled'});await style.evaluate(e=>e.remove());coexist.push({label,elements:before.length,identical:true});
  };
  await home.getByRole('tab',{name:'단어장',exact:true}).click();await home.getByRole('button',{name:'a, an 부정관사',exact:true}).click();await home.getByRole('dialog').waitFor();await compareCascade('word-editor');await home.getByRole('button',{name:'닫기',exact:true}).click();await home.getByRole('dialog').waitFor({state:'hidden'});
  await home.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();await home.getByRole('heading',{name:'품사와 문장 연습',exact:true}).waitFor();await compareCascade('grammar');
  await home.getByRole('tab',{name:'학습 기록',exact:true}).click();await home.getByRole('button',{name:'기록 관리',exact:true}).click();await home.getByRole('menuitem',{name:'백업으로 복원',exact:true}).click();await home.getByRole('dialog').waitFor();await compareCascade('backup-restore');await home.getByRole('button',{name:'닫기',exact:true}).click();await home.getByRole('dialog').waitFor({state:'hidden'});
  // A fresh learner's first action opens assessment, not a daily session.
  // Seed the existing synthetic resume fixture to inspect the actual lazy session.
  const fixture=require('./fixtures/backup-history.cjs').history(2),session=Object.values(fixture.sessions)[0];session.stage='ko';session.finished=false;session.paused=true;fixture.settings.activeSessionId=session.id;
  session.date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());session.period=session.date;session.records[session.ids[0]].ko='unmeasured';session.records[session.ids[0]].sentenceStatus='unmeasured';
  const snapshot=await(await context.request.get(disabled.base+'/api/state')).json();
  const seeded=await context.request.post(disabled.base+'/api/state/restore',{headers:{'x-study-revision':String(snapshot.revision),'Content-Type':'application/json'},data:{format:'haru-words-v1',exportedAt:'2026-09-24T00:00:00.000Z',state:fixture}});assert.equal(seeded.status(),200);
  await home.reload();await home.getByText('저장됨',{exact:true}).waitFor();await home.getByRole('tab',{name:'오늘 학습',exact:true}).click();await home.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await home.locator('.session-panel').waitFor();await home.getByText('저장됨',{exact:true}).waitFor();await compareCascade('learning');
  checks.push('lazy word editor, grammar, backup/restore and learning computed styles remain identical under real late Astryx CSS');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,styles,focus,contrast,homeCss,coexist,axe,errors,requests},null,2));console.log(JSON.stringify({checks:checks.length,details:checks},null,2));
 }finally{if(disabled)await disabled.stop();await closeBrowser(browser);}
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,checks,errors,requests},null,2));console.error(e);process.exitCode=1;});
