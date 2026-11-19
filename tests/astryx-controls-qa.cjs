// Built Worker + synthetic route. This test never calls a provider or writes user data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchBrowser,closeBrowser,base,accountHeaders,axePath}=require('./qa/runtime.cjs');
const out=path.resolve(process.env.ASTRYX_QA_OUTPUT||'outputs/astryx-controls',process.env.QA_BROWSER||'chromium');
fs.mkdirSync(out,{recursive:true});const checks=[],errors=[],requests=[];
(async()=>{const browser=await launchBrowser({headless:true});let p;try{
 const c=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce',extraHTTPHeaders:accountHeaders('astryx_controls')});
 await c.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
 p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET')requests.push({method:r.method(),path:new URL(r.url()).pathname});});
 assert.equal((await p.goto(base+'/astryx-foundation')).status(),200);await p.getByRole('heading',{name:'공통 조작 계약 확인'}).waitFor();
 const word=p.getByRole('textbox',{name:/필수 입력 계약/}),note=p.getByRole('textbox',{name:/한국어 의도 계약/}),submit=p.getByRole('button',{name:'폼 제출 계약',exact:true});
 const count=(a,s,b)=>p.getByText(`계약 실행: ${a} · 제출: ${s} · 대기: ${b?'예':'아니오'}`,{exact:true}).waitFor();
 assert.equal(await word.getAttribute('required'),'');assert.equal(await note.getAttribute('required'),'');assert.equal(await word.getAttribute('maxlength'),'4');assert.equal(await note.getAttribute('maxlength'),'4');assert.equal(await note.getAttribute('lang'),'ko');
 await submit.click();await count(0,0,false);assert.equal(await word.evaluate(e=>e.validity.valueMissing),true);
 for(const [el,prefix] of [[word,'input'],[note,'textarea']]){await el.fill('');await el.pressSequentially('😀abc');assert.equal(await el.inputValue(),'😀ab');await p.getByText(`계약 이벤트: ${prefix}:😀ab`,{exact:true}).waitFor();assert.equal(await el.evaluate(e=>getComputedStyle(e).fontSize),'16px');}
 for(const [name,el] of [['입력 초점 계약',word],['문장 초점 계약',note],['제출 초점 계약',submit]]){await p.getByRole('button',{name,exact:true}).click();assert.equal(await el.evaluate(e=>document.activeElement===e),true);}
 const data=await p.locator('#haru-contract').evaluate(e=>Object.fromEntries(new FormData(e)));assert.deepEqual(data,{contractWord:'😀ab',contractNote:'😀ab',readOnlyWord:'읽기 전용',kind:'sentence'});
 assert.equal(await p.getByRole('textbox',{name:'읽기 전용 계약',exact:true}).evaluate(e=>e.readOnly),true);assert.equal(await p.getByRole('textbox',{name:'비활성 입력 계약',exact:true}).getAttribute('aria-disabled'),'true');
 const selector=p.getByRole('combobox',{name:'선택 계약',exact:true});assert.ok((await selector.boundingBox()).height>=44);await selector.click();await p.getByRole('option',{name:'질문',exact:true}).click();assert.equal(await p.locator('input[name=kind]').inputValue(),'question');
 const ro=p.getByRole('combobox',{name:'읽기 전용 선택 계약',exact:true});await ro.focus();await p.keyboard.press('Enter');assert.equal(await ro.getAttribute('aria-expanded'),'false');
 checks.push('native required/UTF-16 maxlength/labels/lang/events/refs/FormData/readOnly/disabled and selector value contracts');
 await submit.click();await count(0,1,false);await word.focus();await p.keyboard.press('Enter');await count(0,2,false);
 for(const name of ['비활성 제출 계약','비활성 아이콘 계약']){const b=p.getByRole('button',{name,exact:true});await b.click({force:true});await b.focus();await p.keyboard.press('Enter');await p.keyboard.press('Space');}
 await count(0,2,false);
 const run=p.getByRole('button',{name:'연속 실행 계약',exact:true});await run.evaluate(e=>{e.click();e.click();e.click();});await count(1,2,true);
 for(const b of [run,submit]){assert.equal(await b.getAttribute('aria-disabled'),'true');await b.click({force:true});await b.focus();await p.keyboard.press('Enter');await p.keyboard.press('Space');}
 await word.focus();await p.keyboard.press('Enter');await count(1,2,true);await p.getByRole('button',{name:'대기 해제 계약',exact:true}).click();await count(1,2,false);
 await run.focus();await p.keyboard.press('Space');await count(2,2,true);await p.getByRole('button',{name:'대기 해제 계약',exact:true}).click();await count(2,2,false);
 checks.push('click/Enter/Space/implicit submit and synchronous rapid clicks: disabled/loading zero actions or submits, one pending action only');
 const notice=p.locator('.haru-notice.error-banner');assert.ok(await notice.getByRole('alert').isVisible());assert.equal(await notice.locator('[aria-expanded]').count(),0);assert.ok(await notice.getByRole('button',{name:'복구 계약'}).isVisible());
 await p.getByRole('button',{name:'복구 계약'}).click();await count(3,2,false);assert.equal(await word.inputValue(),'😀ab');assert.equal(await note.inputValue(),'😀ab');
 assert.equal(await p.getByRole('progressbar',{name:'아직 측정하지 않은 진행'}).getAttribute('aria-valuenow'),'0');assert.equal((await p.getByRole('progressbar',{name:'아직 측정하지 않은 진행'}).boundingBox()).height,4);assert.equal((await p.getByRole('progressbar',{name:'기록 완료 진행'}).boundingBox()).height,8);assert.equal(await p.getByRole('progressbar',{name:'기록 완료 진행'}).getAttribute('aria-valuenow'),'100');
 assert.ok(await p.getByText('미측정 · 독립 회상 아님',{exact:true}).isVisible());assert.ok(await p.getByText('기록 완료 · 독립 회상 아님',{exact:true}).isVisible());
 checks.push('long error and recovery action remain expanded; retry preserves input; 0/100 progress and unmeasured/completion semantics stay separate');
 for(const width of [320,390,430,768,1440]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);assert.ok(await notice.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.screenshot({path:path.join(out,'controls-'+width+'.png'),fullPage:true});}
 await p.setViewportSize({width:768,height:900});await p.evaluate(()=>document.body.style.zoom='2');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.evaluate(()=>document.body.style.zoom='');
 await p.addScriptTag({path:axePath});const axe=await p.evaluate(async()=> (await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));assert.deepEqual(axe,[]);
 const ssr=await browser.newContext({javaScriptEnabled:false,extraHTTPHeaders:accountHeaders('astryx_controls_ssr')});const sp=await ssr.newPage();await sp.goto(base+'/astryx-foundation');assert.equal(await sp.locator('textarea[name=contractNote]').getAttribute('maxlength'),'4');assert.equal(await sp.locator('textarea[name=contractNote]').getAttribute('required'),'');await ssr.close();
 const home=await c.newPage();home.on('pageerror',e=>errors.push(e.message));await home.goto(base);await home.getByText('저장됨',{exact:true}).waitFor();const saveStyles=[];for(const width of [390,1440]){await home.setViewportSize({width,height:900});saveStyles.push(await home.locator('.save-state').evaluate(e=>{const s=getComputedStyle(e);return {font:s.fontSize,color:s.color,display:s.display};}));}assert.deepEqual(saveStyles,[{font:'12px',color:'rgb(98, 103, 92)',display:'flex'},{font:'12px',color:'rgb(98, 103, 92)',display:'flex'}]);checks.push('real home saved status preserves 12px/caption/flex on mobile and desktop');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);checks.push('320–1440/200%, WCAG axe, server-rendered constraints and zero mutations/AI requests');
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,errors,requests,axe},null,2));console.log(JSON.stringify({checks:checks.length,details:checks}));
 }catch(e){if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,checks,errors,requests},null,2));throw e;}finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
