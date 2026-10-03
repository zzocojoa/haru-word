// Real application routes and persistence; synthetic learners and fixed AI results only.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath, waitForWorker } = require('./qa/runtime.cjs');
const { feedback } = require('./fixtures/sentence-structure.cjs');
const engine = process.env.QA_BROWSER || 'chromium', audit = process.env.QA_AUDIT === '1';
const out = `outputs/feedback-layout-${engine}-${audit ? 'before' : 'after'}`;
const cap = { 'X-Study-Feedback-Structure':'1', 'X-Study-Grammar':'2' };
const word = JSON.parse(fs.readFileSync('data/words.json')).find(w => w.word === 'trip' && w.pos === 'n.');
const unavailable = { ...feedback, structure:{status:'unavailable',translation:'',parts:[],note:'문맥이 부족해 문장 역할을 판단하기 어려워요.'} };
const question = { ...feedback, original:'Did you enjoyed the trip?', correctedSentence:'Did you enjoy the trip?', explanation:'Did 뒤에는 enjoyed 대신 동사원형 enjoy를 써요. trip은 즐긴 대상을 나타내는 명사예요.', structure:{status:'available',translation:'여행은 즐거웠나요?',note:'의문문에서는 조동사가 주어 앞에 와요.',parts:[
  {text:'Did',role:'V',explanation:'과거를 묻는 조동사예요.'},{text:'you',role:'S',explanation:'여행을 즐긴 사람이에요.'},{text:'enjoy',role:'V',explanation:'조동사 뒤의 동사원형이에요.'},{text:'the trip?',role:'O',explanation:'즐긴 대상이에요.'},
]}};
const clauses = [
  ['My girlfriend and I','will take','a trip to Nami Island','in the fall','with our friends.'],
  ['We','will bring','some sandwiches and a bottle of water','in a small bag','for lunch.'],
  ['Our friends','will take','beautiful pictures of the trees','near the river','after lunch.'],
  ['We','will share','our pictures and stories','at home','after the trip.'],
];
const long = { ...feedback, correctedSentence:clauses.flat().join(' '), structure:{status:'available',translation:'우리는 가을에 친구들과 남이섬으로 여행을 갈 거예요. 점심을 챙기고 강가에서 사진을 찍은 뒤 집에서 여행 이야기를 나눌 거예요.',note:'네 문장을 각각 주어·동사·목적어와 추가 정보로 나누었어요.',parts:clauses.flatMap(c=>c.map((text,i)=>({text,role:['S','V','O','M','M'][i],explanation:['문장에서 행동하는 사람이에요.','앞으로 할 행동을 나타내요.','행동의 대상을 설명해요.','장소나 시간을 더해요.','앞의 행동에 상황을 더해요.'][i]})))}};
fs.mkdirSync(out,{recursive:true});
(async()=>{
  await waitForWorker(); const browser=await launchBrowser({engine}), findings=[], errors=[]; let page;
  const check=(value,message)=>{findings.push({message,passed:!!value});if(!audit)assert.ok(value,message)};
  async function learner(result,kind='daily') {
    const context=await browser.newContext({extraHTTPHeaders:accountHeaders('feedback-layout'),viewport:{width:390,height:844},isMobile:engine==='webkit',hasTouch:true,reducedMotion:'reduce'});
    const data=await(await context.request.get(base+'/api/state',{headers:cap})).json();
    const sid=crypto.randomUUID(),now=new Date().toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const session={id:sid,kind:'daily',date,period:date,ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:{meaning:'여행',en:'independent',ko:'independent',sentenceStatus:'unmeasured',sentence:result.original,notes:'',aiFeedback:result}},retry:[],retryMode:false,elapsed:0,finished:false,paused:true,createdAt:now};
    const grammar={noun:{stage:5,sentence:result.original,answers:Object.fromEntries(['q1','q2','q3'].map(k=>[k,{first:'a',latest:'a',attempts:1,helped:false}])),feedback:result,updatedAt:now}};
    assert.equal((await context.request.put(base+'/api/state',{headers:cap,data:{revision:data.revision,settings:{...data.state.settings,activeSessionId:sid},progress:{},sessions:{[sid]:session},grammar}})).status(),200);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await saved();
    if(kind==='daily')await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();
    else {await page.getByRole('tab',{name:'전체 단어장',exact:true}).click();await page.getByRole('tab',{name:'품사·문장 연습',exact:true}).click();await page.locator('.grammar-tile').first().click()}
    await saved();return context;
  }
  const saved=()=>page.getByText('서버에 저장됨',{exact:true}).waitFor();
  async function capture(locator,name) {
    await locator.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
    await locator.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-80));
    await page.screenshot({path:`${out}/${name}-viewport.png`});
  }
  async function responsive(view,name) {
    for(const width of [320,375,390,430,844,1440])for(const size of [100,200]){
      await page.setViewportSize({width,height:width===844?390:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
      const overflow=await view.evaluate(el=>({self:el.scrollWidth>el.clientWidth+1,root:document.documentElement.scrollWidth>innerWidth+1}));
      check(!overflow.self&&!overflow.root,`${name}: ${width}px/${size}% no overflow`);
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await page.addScriptTag({path:axePath});check((await page.evaluate(async()=> (await axe.run('.sentence-structure',{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations)).length===0,`${name}: axe`);
  }
  try {
    let context=await learner(unavailable);
    const retry=page.getByRole('button',{name:/다시 점검/});
    check(await retry.count()===1&&await retry.isEnabled(),'Unavailable structure can be retried explicitly');
    await capture(page.locator('.ai-feedback-panel'),'unavailable');
    if(!audit){let calls=0,release;const gate=new Promise(resolve=>release=resolve);
      await page.route('**/api/sentence-feedback',async r=>{calls++;await gate;await r.fulfill({status:429,json:{code:'groq_limit',error:'현재 사용 한도',providerStatus:429}})});
      await retry.tap();await page.getByRole('button',{name:'문장을 확인하고 있어요',exact:true}).waitFor();
      check(await page.getByRole('button',{name:'문장을 확인하고 있어요',exact:true}).isDisabled(),'Pending retry cannot be submitted twice');
      await capture(page.locator('.ai-feedback-panel'),'pending');release();await page.getByRole('alert').waitFor();
      check(await page.getByText(unavailable.structure.note,{exact:false}).isVisible(),'Failed retry preserves the previous result');
      await capture(page.locator('.ai-feedback-panel'),'quota');await page.unroute('**/api/sentence-feedback');
      await page.route('**/api/sentence-feedback',r=>{calls++;return r.fulfill({json:{feedback}})});
      await retry.tap();await page.locator('.ai-feedback-panel .sentence-structure').waitFor();await saved();assert.equal(calls,2);
      await page.reload();await saved();await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();assert.equal(calls,2);
      check(await page.locator('.ai-feedback-panel .sentence-structure li').count()===5,'Explicit retry survives reload without auto calls');}
    await context.close();
    context=await learner(long);let view=page.locator('.ai-feedback-panel .sentence-structure');await view.waitFor();
    const use=page.getByRole('button',{name:'교정 제안을 내 문장에 적용',exact:true});
    check(await use.evaluate(el=>!!(el.compareDocumentPosition(el.closest('.ai-feedback-panel').querySelector('.sentence-structure'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Apply action is before the long structure explanation');
    await view.getByText('부분별 설명',{exact:true}).tap();await responsive(view,'20-part daily');await capture(view,'daily-long-mobile');
    await page.setViewportSize({width:1440,height:1000});await capture(view,'daily-long-desktop');
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'문장을 완성했어요',exact:true}).click();await saved();
    await page.getByRole('tab',{name:'학습 기록',exact:true}).click();await page.locator('.journal-day-trigger').first().click();await page.locator('.journal-session-trigger').first().click();
    await page.locator('.journal-mobile .journal-word-trigger').click();await page.locator('.journal-mobile').getByText('저장한 AI 참고 의견',{exact:true}).click();
    view=page.locator('.journal-mobile .sentence-structure');const summary=view.locator('summary');
    check(await summary.evaluate(el=>getComputedStyle(el,'::before').content)==='"+"','Closed inner disclosure shows plus inside an open result');
    await summary.tap();check(await summary.evaluate(el=>getComputedStyle(el,'::before').content)==='"−"','Open inner disclosure shows minus');
    check(await view.locator('dl > div').first().evaluate(el=>getComputedStyle(el).display)!=='grid','History explanations do not inherit record label columns');
    await capture(view,'history-mobile');
    await capture(view.locator('details'),'history-explanations-mobile');
    for(const width of [320,390,430])for(const size of [100,200]){
      await page.setViewportSize({width,height:844});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
      check(await view.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'History mobile details fit');
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:1440,height:1000});
    await page.locator('.journal-desktop').getByText('AI 참고 의견',{exact:true}).click();
    view=page.locator('.journal-desktop .sentence-structure');await view.locator('summary').focus();await page.keyboard.press('Enter');
    check(await view.evaluate(el=>el.getBoundingClientRect().width>=el.closest('table').getBoundingClientRect().width*0.9),'Desktop saved analysis uses the full table width');
    check(await view.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Desktop history structure fits');await capture(view,'history-desktop');
    await context.close();
    context=await learner(question,'grammar');view=page.locator('.grammar-feedback .sentence-structure');await view.waitFor();
    await view.locator('summary').focus();await page.keyboard.press('Enter');await responsive(view,'Question grammar');await capture(view,'grammar-question-mobile');
    // Editing or applying the suggestion must never leave an old analysis attached to a new draft.
    await page.getByRole('button',{name:'수정안 사용하기',exact:true}).tap();await saved();
    check(await page.locator('.grammar-writing textarea').inputValue()===question.correctedSentence,'Grammar suggestion applies only on request');
    check(await page.locator('.grammar-feedback').count()===0,'Changing grammar draft removes stale feedback');
    await context.close();
    assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({engine,audit,findings},null,2));console.log(JSON.stringify({engine,audit,failed:findings.filter(x=>!x.passed),checks:findings.length}));
  }catch(e){if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});throw e}
  finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exitCode=1});
