// Real application routes and persistence; synthetic learners and fixed AI results only.
// AI_REFERENCE_OPINIONS.md: hidden structures remain stored, not a reason to request again.
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
long.explanation = '여행에 함께 가는 사람과 시간, 장소를 구체적으로 써 보세요.\n'.repeat(12);
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
    await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({status:200,body:''}));
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await saved();
    if(kind==='daily')await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();
    else {await page.getByRole('tab',{name:'단어장',exact:true}).click();await page.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();await page.locator('.grammar-tile').first().click()}
    await saved();return context;
  }
  const saved=()=>page.locator('.save-state').getByText('저장됨',{exact:true}).waitFor();
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
    await page.addScriptTag({path:axePath});check((await page.evaluate(async()=> (await axe.run('.ai-feedback-result',{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations)).length===0,`${name}: axe`);
  }
  const snapshot = async context => (await (await context.request.get(base+'/api/state',{headers:cap})).json()).state;
  async function hiddenStructure(view,result) {
    check(await view.locator('.sentence-structure').count()===0,'AI structures stay hidden');
    check(!(await view.textContent()).includes(result.structure.translation || result.structure.note),'Hidden AI structure text is absent from the result DOM');
    check(await view.getByText('AI 참고 의견 · 정답 판정은 아니에요',{exact:true}).count()===1,'Each standalone result has one caution');
  }
  async function expandExplanation(view) {
    const details=view.locator('details.record-text').filter({has:page.getByText('AI 설명 더 보기',{exact:true})});
    const summary=details.locator('summary');
    check(!await details.evaluate(el=>el.open),'Long explanation starts closed');
    check(await summary.evaluate(el=>getComputedStyle(el,'::before').content)==='"+"','Closed nested disclosure shows plus');
    await summary.focus();await page.keyboard.press('Enter');
    check(await details.evaluate(el=>el.open),'Keyboard opens the complete explanation');
    check(await summary.evaluate(el=>getComputedStyle(el,'::before').content)==='"−"','Open nested disclosure shows minus');
    assert.equal(await details.locator('p').textContent(),long.explanation);
    return details;
  }
  try {
    let context=await learner(unavailable);
    check(await page.getByRole('button',{name:'저장한 AI 참고 의견이 있어요',exact:true}).isDisabled(),'Unavailable structure alone does not enable a duplicate daily request');
    await hiddenStructure(page.locator('.ai-feedback-result'),unavailable);
    await capture(page.locator('.ai-feedback-panel'),'unavailable');
    if(!audit){let calls=0,release;const gate=new Promise(resolve=>release=resolve);
      await page.route('**/api/sentence-feedback',async r=>{calls++;await gate;await r.fulfill({status:429,json:{code:'groq_limit',error:'현재 사용 한도',providerStatus:429}})});
      const changed=unavailable.original+' Today.';
      await page.locator('#my-sentence').fill(changed);
      const retry=page.getByRole('button',{name:'AI 참고 의견 요청',exact:true});
      check(calls===0,'Editing alone never requests AI');
      await retry.click();await page.getByRole('button',{name:'문장을 확인하고 있어요',exact:true}).waitFor();
      check(await page.getByRole('button',{name:'문장을 확인하고 있어요',exact:true}).isDisabled(),'Pending retry cannot be submitted twice');
      await capture(page.locator('.ai-feedback-panel'),'pending');release();await page.getByRole('alert').waitFor();
      check(await page.locator('.ai-feedback-result').getByText(unavailable.explanation,{exact:true}).isVisible(),'Failed explicit request preserves the previous result');
      assert.equal(await page.locator('#my-sentence').inputValue(),changed);
      await hiddenStructure(page.locator('.ai-feedback-result'),unavailable);
      await capture(page.locator('.ai-feedback-panel'),'quota');await page.unroute('**/api/sentence-feedback');
      const updated={...feedback,original:changed};
      await page.route('**/api/sentence-feedback',r=>{calls++;return r.fulfill({json:{feedback:updated}})});
      await retry.click();await page.getByRole('button',{name:'저장한 AI 참고 의견이 있어요',exact:true}).waitFor();await saved();assert.equal(calls,2);
      await page.reload();await saved();await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();assert.equal(calls,2);
      await hiddenStructure(page.locator('.ai-feedback-result'),updated);
      const stored=Object.values((await snapshot(context)).sessions)[0].records[word.id].aiFeedback;
      assert.deepEqual(stored,updated);check(calls===2,'Explicit retry survives reload without auto calls or structure loss');}
    await context.close();
    context=await learner(long);let view=page.locator('.ai-feedback-panel .ai-feedback-result');await view.waitFor();
    const dailyBefore=await snapshot(context);await hiddenStructure(view,long);
    const use=page.getByRole('button',{name:'AI 제안으로 문장 바꾸기',exact:true});
    check(await use.evaluate(el=>!!(el.compareDocumentPosition([...el.closest('.ai-feedback-panel').querySelectorAll('details.record-text')].find(node=>node.querySelector('summary').textContent==='AI 설명 더 보기'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Apply action is before the long explanation');
    await expandExplanation(view);await responsive(view,'long daily result');await capture(view,'daily-long-mobile');
    await page.setViewportSize({width:1440,height:1000});await capture(view,'daily-long-desktop');
    assert.deepEqual(await snapshot(context),dailyBefore,'Reading and expanding AI feedback must not rewrite records');
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'문장을 완성했어요',exact:true}).click();await saved();
    await page.getByRole('tab',{name:'학습 기록',exact:true}).click();await page.locator('.journal-day-trigger').first().click();await page.locator('.journal-session-trigger').first().click();
    await page.locator('.journal-mobile .journal-word-trigger').click();await page.locator('.journal-mobile').getByText('저장한 AI 참고 의견',{exact:true}).click();
    view=page.locator('.journal-mobile .ai-feedback-result');await hiddenStructure(view,long);
    const historyBefore=await snapshot(context),details=await expandExplanation(view);
    await capture(view,'history-mobile');
    await capture(details,'history-explanations-mobile');
    for(const width of [320,390,430])for(const size of [100,200]){
      await page.setViewportSize({width,height:844});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
      check(await view.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'History mobile details fit');
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:1440,height:1000});
    await page.locator('.journal-desktop').getByText('AI 참고 의견',{exact:true}).click();
    view=page.locator('.journal-desktop .ai-feedback-result');await expandExplanation(view);await hiddenStructure(view,long);
    check(await view.evaluate(el=>el.getBoundingClientRect().width>=el.closest('table').getBoundingClientRect().width*0.9),'Desktop saved analysis uses the full table width');
    check(await view.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Desktop history result fits');await capture(view,'history-desktop');
    assert.deepEqual(await snapshot(context),historyBefore,'History disclosures preserve stored structure, text and grades');
    await context.close();
    context=await learner(question,'grammar');view=page.locator('.grammar-feedback .ai-feedback-result');await view.waitFor();
    const grammarBefore=await snapshot(context);await hiddenStructure(view,question);
    await responsive(view,'Question grammar');await capture(view,'grammar-question-mobile');
    assert.deepEqual(await snapshot(context),grammarBefore,'Reading grammar feedback does not rewrite saved data');
    // Editing or applying the suggestion must never leave an old analysis attached to a new draft.
    await page.getByRole('button',{name:'AI 제안으로 문장 바꾸기',exact:true}).click();await saved();
    check(await page.locator('.grammar-writing textarea').inputValue()===question.correctedSentence,'Grammar suggestion applies only on request');
    check(await page.locator('.grammar-feedback').count()===0,'Changing grammar draft removes stale feedback');
    await context.close();
    assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({engine,audit,findings},null,2));console.log(JSON.stringify({engine,audit,failed:findings.filter(x=>!x.passed),checks:findings.length}));
  }catch(e){if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});throw e}
  finally{await closeBrowser(browser)}
})().catch(e=>{console.error(e);process.exitCode=1});
