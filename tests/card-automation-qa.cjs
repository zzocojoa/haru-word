const {createServer}=require('node:http');
const {readFileSync,writeFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {launchBrowser,closeBrowser,axePath}=require('../tests/qa/runtime.cjs');
const baseline=process.argv.includes('--baseline');
const assets=path.resolve(baseline?'work/card-port-reproduce/public':'public');
async function main(){
 const {fixture,initialState,cards}=require(path.resolve('tests/qa/card-studio-fixtures.cjs'));
 const {expect}=require(process.env.QA_PLAYWRIGHT_PATH ? path.join(process.env.QA_PLAYWRIGHT_PATH,'test.js') : 'playwright/test');
 const server=createServer((req,res)=>{
  try{const url=new URL(req.url,'http://localhost'),p=path.resolve(assets,'.'+url.pathname);
   if(!p.startsWith(assets+path.sep)||url.pathname.startsWith('/api/'))throw Error();
   const ext=path.extname(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json'})[ext]||'application/octet-stream');res.end(readFileSync(p));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const report=[];
 try{for(const engine of ['chromium','webkit']){
  const browser=await launchBrowser({engine});
  try{
   const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();
   await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
   const state=initialState();state.mode='live';state.connection={status:'connected',version:1};
   await fixture(page,state);
   let view={settings:{topic:'일상 회화',base_expression:'',level:'초급',template:'expression',start_date:'2026-10-04',end_date:null,time:'08:00'},version:1,enabled:false,reason:'paused',available:true,missing:[],next_due_at:null};
   const review={natural:true,meaning:true,grammar:true,translation:false,level:true,comparison:true,issues:[]};
   const runs=[1,2].map((i)=>({id:'synthetic-'+i,day:'2026-10-04',status:'scheduled',writer:'google',reviewer:'groq',revision:1,card_id:cards[i-1].id,content:cards[i-1].content,review,public_id:'a'.repeat(64),delivery_state:null}));
   let saveFail=true,loadFail=false,holdLoad=!baseline,releaseLoad,cardReads=0,releaseEdit;
   await page.route('**/api/card-studio/**',async route=>{
    const req=route.request(),p=new URL(req.url()).pathname;
    if(p.startsWith('/api/card-studio/api/cards/')){cardReads++;await new Promise(r=>releaseEdit=r);return route.fulfill({json:cards[0]});}
    if(!p.startsWith('/api/card-studio/automation'))return route.fallback();
    if(p.endsWith('/runs'))return route.fulfill({json:runs});
    if(req.method()==='GET'&&holdLoad){holdLoad=false;await new Promise(r=>releaseLoad=r);}
    if(req.method()==='GET'&&loadFail){loadFail=false;return route.fulfill({status:503,json:{message:'합성 상태 조회 실패'}});}
    if(req.method()==='PUT'){
     if(saveFail){saveFail=false;return route.fulfill({status:503,json:{message:'합성 저장 실패'}});}
     const body=req.postDataJSON();assert.equal(body.version,view.version);view={...view,settings:body.settings,version:view.version+1,enabled:false};
    }
    if(p.endsWith('/start'))view={...view,enabled:true,reason:null,version:view.version+1};
    if(p.endsWith('/pause'))view={...view,enabled:false,reason:'paused',version:view.version+1};
    return route.fulfill({json:view});
   });
   const url=base+'/card-studio/index.html#/editor';await page.goto(url);
   const summary=page.locator('.automation-panel summary');
   if(!baseline){await expect(summary).toContainText('상태 확인 중');await expect.poll(()=>typeof releaseLoad).toBe('function');releaseLoad();}
   await summary.focus();await page.keyboard.press('Enter');
   const topic=page.getByLabel('주제',{exact:true});await expect(topic).toHaveValue('일상 회화');
   await expect(page.getByText('AI 검토 미통과',{exact:false}).first()).toBeVisible();
   await expect(page.getByText('AI 검토 통과',{exact:false})).toHaveCount(0);
   await topic.fill('여행 영어 초안');await page.getByRole('button',{name:'설정 저장',exact:true}).click();
   await expect(page.locator('.workspace > .notice')).toContainText('합성 저장 실패');await expect(topic).toHaveValue('여행 영어 초안');
   await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.getByRole('button',{name:'자동 제작 시작',exact:true})).toBeEnabled();
   await page.getByRole('button',{name:'자동 제작 시작',exact:true}).click();await expect(summary).toContainText('실행 중');
   await topic.fill('일시정지 후에도 남길 초안');await page.getByRole('button',{name:'일시정지',exact:true}).click();await expect(summary).toContainText('일시정지');
   if(baseline){await expect(topic).toHaveValue('여행 영어 초안');report.push({engine,baselinePauseDraftLossReproduced:true});continue;}
   await expect(topic).toHaveValue('일시정지 후에도 남길 초안');await expect(page.getByRole('button',{name:'자동 제작 시작',exact:true})).toBeDisabled();
   await page.evaluate(()=>location.hash='/library');await expect(page).toHaveURL(/#\/library$/);
   await page.evaluate(()=>location.hash='/editor');await summary.click();await expect(topic).toHaveValue('일시정지 후에도 남길 초안');
   await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.getByRole('button',{name:'자동 제작 시작',exact:true})).toBeEnabled();
   page.on('dialog',d=>d.accept());await page.reload();await summary.click();await expect(topic).toHaveValue('일시정지 후에도 남길 초안');
   // Simultaneous DOM clicks must produce only one edit request, and navigating
   // away while it is pending must not let a stale response reopen the editor.
   await page.getByRole('button',{name:'카드 편집',exact:true}).first().evaluate(b=>{b.click();document.querySelectorAll('.automation-runs button')[3]?.click();});
   await expect(page.getByRole('button',{name:'카드 편집',exact:true}).last()).toBeDisabled();
   await expect.poll(()=>cardReads).toBe(1);
   const cancelled=page.waitForEvent('requestfailed',r=>new URL(r.url()).pathname.startsWith('/api/card-studio/api/cards/'));
   await page.evaluate(()=>location.hash='/library');
   assert.ok((await cancelled).failure());
   releaseEdit();await expect(page).toHaveURL(/#\/library$/);
   await expect(page.getByRole('heading',{name:'카드 보관함',exact:true})).toBeVisible();
   await page.evaluate(()=>location.hash='/editor');await summary.click();
   const visuals=[];
   for(const width of [320,390,1440])for(const zoom of [1,2]){
    await page.setViewportSize({width,height:900});await page.evaluate(z=>document.documentElement.style.fontSize=`${z*100}%`,zoom);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.addScriptTag({path:axePath});const violations=await page.evaluate(()=>axe.run(document.querySelector('.automation-panel')));
    assert.deepEqual(violations.violations.map(v=>v.id),[]);visuals.push({width,zoom,axe:0});
   }
   loadFail=true;await page.reload();await expect(summary).toContainText('상태 확인 실패');await summary.click();
   await expect(page.getByRole('alert').filter({hasText:'합성 상태 조회 실패'})).toBeVisible();
   await page.getByRole('button',{name:'기록 새로고침',exact:true}).click();await expect(summary).toContainText('일시정지');
   await expect(page.getByRole('alert').filter({hasText:'합성 상태 조회 실패'})).toHaveCount(0);
   await page.screenshot({path:`work/card-port-${engine}.png`,fullPage:true});
   report.push({engine,pauseDraftPreserved:true,failedSaveRetry:true,draftAcrossNavigation:true,savedReload:true,reviewFalseNotPassed:true,editSingleFlight:true,lateEditCancelled:true,stateFailureAndRecovery:true,visuals});
  }finally{await closeBrowser(browser);}
 }}finally{await new Promise(r=>server.close(r));}
 writeFileSync(`work/card-port-browser${baseline?'-baseline':''}.json`,JSON.stringify({mockOnly:true,actualAI:0,actualKakao:0,results:report},null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
