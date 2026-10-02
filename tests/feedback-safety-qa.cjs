// Loopback + synthetic learners + frozen AI responses. Never call a provider.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {base,launchBrowser,closeBrowser,accountHeaders,axePath}=require('./qa/runtime.cjs');
const engine=process.env.QA_BROWSER||'chromium',out=`outputs/feedback-safety-${engine}`;
const cap={'X-Study-Grammar':'3','X-Study-Feedback-Structure':'1'};
const rows=JSON.parse(fs.readFileSync('data/evaluations/english-accuracy-2026-10-02-annotated.json','utf8')).rows;
const frozen=(id,provider)=>structuredClone(rows.find(r=>r.caseId===id&&r.provider===provider).feedback);
const word=JSON.parse(fs.readFileSync('data/words.json','utf8')).find(w=>w.word==='arrive'&&w.pos==='v.');
const badWord=frozen('word-32','groq'),badGrammar=frozen('grammar-45','google');
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await launchBrowser({engine}),context=await browser.newContext({extraHTTPHeaders:accountHeaders('feedback_safety'),viewport:{width:390,height:844},reducedMotion:'reduce'});
  let page,calls=0;const errors=[],checks=[];
  try{
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
      if(/\/api\/(sentence|grammar)-feedback$/.test(url.pathname)&&route.request().method()==='POST'){
        calls++;return route.fulfill({status:422,json:{code:'analysis_conflict',error:'AI의 문장 성분 설명에 모순이 있어 교정과 설명을 보류했어요.'}});
      }
      return route.continue();
    });
    const state=async()=> (await context.request.get(base+'/api/state',{headers:cap})).json();
    const data=await state(),sid=crypto.randomUUID(),now=new Date().toISOString();
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const rec={meaning:'도착하다',en:'independent',ko:'independent',sentenceStatus:'unmeasured',sentence:badWord.original,notes:'',aiFeedback:badWord};
    const session={id:sid,kind:'daily',date,period:date,ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:rec},retry:[],retryMode:false,elapsed:0,finished:false,paused:true,createdAt:now};
    const grammar={auxiliary:{stage:5,sentence:badGrammar.original,answers:Object.fromEntries(['q1','q2','q3'].map(k=>[k,{first:'a',latest:'a',attempts:1,helped:false}])),feedback:badGrammar,updatedAt:now}};
    assert.equal((await context.request.put(base+'/api/state',{headers:cap,data:{revision:data.revision,settings:{...data.state.settings,activeSessionId:sid},progress:{},sessions:{[sid]:session},grammar}})).status(),200);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const saved=()=>page.getByText('서버에 저장됨',{exact:true}).waitFor();
    await page.goto(base);await saved();await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();
    const panel=page.locator('.ai-feedback-panel');
    await panel.getByText('AI 설명 확인 필요',{exact:true}).waitFor();
    assert.equal(await panel.locator('.sentence-structure-parts').count(),0);
    assert.equal(await panel.getByRole('button',{name:'교정 제안을 내 문장에 적용',exact:true}).count(),0);
    assert.equal(await page.getByLabel('내 영어 문장',{exact:true}).inputValue(),badWord.original);
    assert.deepEqual((await state()).state.sessions[sid].records[word.id].aiFeedback,badWord);
    assert.equal(calls,0);checks.push('saved unsafe word analysis is hidden without an API call or source rewrite');
    for(const width of [320,390,1440])for(const size of [100,200]){
      await page.setViewportSize({width,height:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',size);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}/${size}`);
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await panel.scrollIntoViewIfNeeded();await panel.screenshot({path:out+'/word-withheld.png'});
    await page.addScriptTag({path:axePath});assert.deepEqual(await page.evaluate(async()=> (await axe.run('.feedback-safety-notice',{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(v=>v.id)),[]);
    const retry=page.getByRole('button',{name:'문장 설명 다시 점검',exact:true});
    await retry.focus();await page.keyboard.press('Enter');await panel.locator('.feedback-issue-notice').waitFor().catch(()=>page.getByRole('alert').waitFor());
    assert.equal(calls,1);assert.equal(await page.getByLabel('내 영어 문장',{exact:true}).inputValue(),badWord.original);
    assert.deepEqual((await state()).state.sessions[sid].records[word.id].aiFeedback,badWord);
    await page.reload();await saved();await page.getByRole('button',{name:'중단한 학습 이어서',exact:true}).click();await saved();
    await page.locator('.ai-feedback-panel').getByText('AI 설명 확인 필요',{exact:true}).waitFor();assert.equal(calls,1);
    checks.push('explicit keyboard retry + 422 + reload retains draft and feedback without automatic retries');
    await page.getByRole('button',{name:'문장을 완성했어요',exact:true}).click();await saved();
    await page.getByRole('tab',{name:'학습 기록',exact:true}).click();await page.locator('.journal-day-trigger').first().click();await page.locator('.journal-session-trigger').first().click();
    await page.locator('.journal-mobile .journal-word-trigger').click();await page.locator('.journal-mobile').getByText('저장한 AI 교정 의견',{exact:true}).click();
    await page.locator('.journal-mobile').getByText('AI 설명 확인 필요',{exact:true}).waitFor();
    assert.equal(await page.locator('.journal-mobile .sentence-structure-parts').count(),0);checks.push('completed history also withholds unsafe analysis');
    await page.getByRole('tab',{name:'전체 단어장',exact:true}).click();await page.getByRole('tab',{name:'품사·문장 연습',exact:true}).click();
    const group=page.locator('.grammar-group').filter({has:page.locator('h3',{hasText:'동사를 돕는 표현'})});
    if(await group.getAttribute('open')===null)await group.locator('summary').click();
    await page.locator('.grammar-tile').filter({has:page.locator('b',{hasText:'기본 조동사'})}).click();
    await page.locator('.grammar-feedback').getByText('AI 설명 확인 필요',{exact:true}).waitFor();
    assert.equal(await page.locator('.grammar-feedback .sentence-structure-parts').count(),0);
    assert.equal(await page.locator('.grammar-writing textarea').inputValue(),badGrammar.original);
    await page.locator('.grammar-feedback').screenshot({path:out+'/grammar-withheld.png'});
    await page.getByRole('button',{name:'AI로 문장 점검',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.equal(calls,2);assert.equal(await page.locator('.grammar-writing textarea').inputValue(),badGrammar.original);
    assert.deepEqual((await state()).state.grammar.auxiliary.feedback,badGrammar);
    checks.push('grammar legacy progress shares protection and failure preserves first answers and feedback');
    assert.deepEqual((await state()).state.grammar.auxiliary.answers,grammar.auxiliary.answers);assert.deepEqual(errors,[]);
    fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,engine,checks,mockedCalls:calls,providerCalls:0,errors},null,2));console.log(JSON.stringify({passed:true,engine,checks,providerCalls:0}));
  }catch(e){if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e;}
  finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1});
