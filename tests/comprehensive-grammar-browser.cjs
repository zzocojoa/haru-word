// Built Worker + synthetic D1 only. The counted mode requires a Worker with
// an intercepted provider. Other modes mock the feedback response in-browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build}=require('esbuild');
const {base,accountHeaders,launchBrowser,closeBrowser}=require('./qa/runtime.cjs');
const {emptyState}=require('./fixtures/backup-history.cjs');
const mode=process.argv[2]||'review';assert.ok(['review','recovery','whitespace','explanation','counted'].includes(mode));
const counted = mode === 'counted';
if (counted) assert.ok(process.send && process.env.QA_COUNTED_SYNTHETIC_ORIGIN === base,
 'Run counted mode through the isolated synthetic Worker harness.');
const submitted = counted ? 'Two luggage block the aisle.' : 'I likes books.';
const correction = counted ? 'Two pieces of luggage block the aisle.' : 'I like books.';
const countExplanation = /luggage는 셀 수 없는 명사예요/;
const engine=process.env.QA_BROWSER||'chromium',out=path.resolve(process.env.QA_ARTIFACT_ROOT||'outputs/comprehensive-remediation-browser','grammar-'+mode,engine);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 await build({entryPoints:['lib/grammar/practice.ts','lib/grammar/content-v4.ts','lib/grammar/model.ts'],outdir:path.join(out,'modules'),bundle:true,format:'cjs',platform:'node',outExtension:{'.js':'.cjs'},logLevel:'silent'});
 const {newLessonProgress,completeLesson}=require(path.join(out,'modules/practice.cjs'));
 const {PRACTICE_LESSONS_V4}=require(path.join(out,'modules/content-v4.cjs'));
 const {grammarProgressSchema}=require(path.join(out,'modules/model.cjs'));
 const lesson=PRACTICE_LESSONS_V4.noun,stamp='2026-11-01T00:00:00.000Z';
 const answer=q=>({first:q.answer,latest:q.answer,helped:false,attempts:1});
 const seed=completeLesson({...newLessonProgress('noun',stamp,4),observation:answer(lesson.observation),answers:Object.fromEntries(lesson.questions.map((q,i)=>['q'+(i+1),answer(q)])),sentence:'I like books.',check:'appropriate',checks:{meaning:'appropriate',form:'appropriate'}},'2026-11-01',stamp);
 seed.schedule={passed:2,lastDate:'2026-11-03',nextSet:'a',used:{a:1,b:1}};
 seed.review={contentVersion:4,questionIds:lesson.reviews.b.map(q=>q.id),setId:'b',mode:'scheduled',startedOn:'2026-11-03',reused:false,index:3,answers:Object.fromEntries(lesson.reviews.b.map((q,i)=>['q'+(i+1),answer(q)])),completedAt:'2026-11-03T00:00:00.000Z'};
 if(mode==='whitespace'){seed.sentence=' \tI like books.\n ';seed.stage=5;}
 const browser=await launchBrowser({engine}),identity=accountHeaders('remediation_grammar'),context=await browser.newContext({extraHTTPHeaders:identity,viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
 let providerPosts=0,mockedRequests=0,grammarRequests=0;const errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url()===base+'/api/state'&&r.request().method()==='PUT')writes.push(r.status());});
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base)return route.abort();
  if(r.method()==='POST'&&u.pathname==='/api/grammar-feedback'){
   if (counted) {
    grammarRequests++;
    assert.equal(r.postDataJSON().sentence, submitted);
    return route.continue();
   }
   mockedRequests++;const body=r.postDataJSON();
   return route.fulfill({json:{feedback:{original:body.sentence.trim(),correctedSentence:'I like books.',meaningUsage:'appropriate',grammar:mode==='whitespace'?'natural':'needs_work',explanation:'합성 문법 참고 의견',model:body.expectedModelId,provider:'openai',requestedModel:body.expectedModelId,promptVersion:'reference-v7',validationVersion:'judgment-v6',contextFingerprint:body.expectedContextFingerprint,createdAt:new Date().toISOString()},receipt:{requestId:body.requestId,state:'completed',persisted:true}}});
  }
  if(r.method()==='POST'&&/feedback|ai-eval|automation/.test(u.pathname)){providerPosts++;return route.abort();}return route.continue();});
 const snapshot=async()=>{const r=await context.request.get(base+'/api/state',{headers:{'X-Study-Grammar':'5','X-Study-AI-Contract':'4'}});assert.equal(r.status(),200);return r.json();};
 async function savedSentence(sentence){for(const end=Date.now()+10000;Date.now()<end;){const s=await snapshot();if(s.state.grammar.noun.sentence===sentence)return s.state.grammar.noun;await new Promise(ok=>setTimeout(ok,50));}throw Error('Expected sentence was not persisted');}
 const preserved = progress => {
  assert.deepEqual(progress.observation, seed.observation);
  assert.deepEqual(progress.answers, seed.answers);
  assert.deepEqual(progress.review, seed.review);
  assert.deepEqual(progress.schedule, seed.schedule);
  assert.equal(progress.completedAt, seed.completedAt);
  assert.equal(grammarProgressSchema.safeParse(progress).success, true);
 };
 try{
  const initial=await snapshot(),r=await context.request.post(base+'/api/state/restore',{headers:{'X-Study-Grammar':'5','X-Study-Revision':String(initial.revision)},data:{format:'haru-words-v1',exportedAt:new Date().toISOString(),state:{...emptyState(),grammar:{noun:seed}}}});assert.equal(r.status(),200,await r.text());
  if(mode==='recovery')await page.addInitScript(owner=>{
   const question=JSON.stringify(['noun',4,5]),instanceId=crypto.randomUUID(),key='haru-words:local-input:v1:'+encodeURIComponent(owner)+':'+instanceId+':'+encodeURIComponent(question);
   localStorage.setItem('haru-words:local-input-owner:v1',owner);
   localStorage.setItem(key,JSON.stringify({version:1,kind:'grammar',question,instanceId,epoch:'initial',updatedAt:Date.now(),base:{sentence:'Earlier synthetic baseline.'},values:{sentence:'Recovered unfinished sentence.'}}));
  },identity['oai-authenticated-user-id']);
  async function open(){await page.goto(base);await page.getByText('저장됨',{exact:true}).first().waitFor();await page.getByRole('tab',{name:'단어장',exact:true}).click();await page.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();await page.locator('.grammar-tile').first().click();}
  await open();if(mode!=='whitespace')await page.getByRole('button',{name:'내 문장 보완',exact:true}).click();
  const input=page.getByRole('textbox',{name:'내 문장',exact:true});
  if(mode==='whitespace'){
   assert.equal(await input.inputValue(),seed.sentence);await page.getByRole('button',{name:'AI 참고 의견 요청',exact:true}).click();
   for(const end=Date.now()+10000;Date.now()<end;){if((await snapshot()).state.grammar.noun.feedback?.original===seed.sentence.trim())break;await new Promise(ok=>setTimeout(ok,50));}
   const p=(await snapshot()).state.grammar.noun;preserved(p);assert.equal(p.feedback.original,seed.sentence.trim());assert.equal(p.sentence,seed.sentence);
   assert.equal(await input.inputValue(),seed.sentence);assert.ok(writes.length>0&&writes.every(x=>x===200));assert.equal(mockedRequests,1);assert.equal(providerPosts,0);assert.deepEqual(errors,[]);
   const result={passed:true,engine,mode,rawInputPreserved:true,trimmedFeedbackSaved:true,reviewSchedulePreserved:true,writes,mockedRequests,actualProviderCalls:0};
   fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;
  }
  if(mode==='recovery'){
   await page.locator('summary').filter({hasText:'이 기기에 남은 다른 입력 확인'}).click();
   await page.getByRole('button',{name:'현재 입력과 비교',exact:true}).first().click();
   await page.getByRole('button',{name:'비교한 입력으로 이어쓰기',exact:true}).click();
   preserved(await savedSentence('Recovered unfinished sentence.'));assert.equal(await input.inputValue(),'Recovered unfinished sentence.');
  }
  await input.fill('I like books and music.');preserved(await savedSentence('I like books and music.'));
  if(mode==='explanation'){
   const savedStage=async(stage)=>{for(const end=Date.now()+10000;Date.now()<end;){const p=(await snapshot()).state.grammar.noun;if(p.stage===stage){preserved(p);return;}await new Promise(ok=>setTimeout(ok,50));}throw Error('Expected stage '+stage+' was not persisted');};
   await page.getByRole('button',{name:'설명 다시 보기',exact:true}).click();await savedStage(1);
   await page.getByRole('button',{name:'예문 다시 보기',exact:true}).click();await savedStage(0);
   await page.getByRole('button',{name:'수업 목록',exact:true}).click();await page.locator('.grammar-tile').first().waitFor();
   await page.reload();await page.getByText('저장됨',{exact:true}).first().waitFor();
   const p=(await snapshot()).state.grammar.noun;preserved(p);assert.equal(p.stage,0);assert.equal(p.sentence,'I like books and music.');
   assert.ok(writes.length>=3&&writes.every(x=>x===200));assert.equal(mockedRequests,0);assert.equal(providerPosts,0);assert.deepEqual(errors,[]);
   const result={passed:true,engine,mode,explanationAndExampleSaved:true,listNavigationAndReload:true,reviewScheduleCompletionDatePreserved:true,writes,actualProviderCalls:0,productionWrites:0};
   fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await page.screenshot({path:path.join(out,'preserved.png')});return;
  }
  assert.equal((await context.request.get(base+'/api/state',{headers:{'X-Study-Grammar':'4'}})).status(),426);
  await open();assert.equal(await input.inputValue(),'I like books and music.');preserved((await snapshot()).state.grammar.noun);
  await input.fill(submitted);preserved(await savedSentence(submitted));
  const feedbackResponse = counted && page.waitForResponse(response =>
   response.url() === base + '/api/grammar-feedback' && response.request().method() === 'POST');
  await page.getByRole('button',{name:'AI 참고 의견 요청',exact:true}).click();
  if (feedbackResponse) {
   const response = await feedbackResponse;
   assert.equal(response.status(), 200);
   const { feedback, receipt } = await response.json();
   assert.equal(feedback.original, submitted);
   assert.equal(feedback.correctedSentence, correction);
   assert.match(feedback.explanation, countExplanation);
   assert.equal(receipt.state, 'completed');
   const readback = await context.request.get(base + '/api/feedback-requests/' + receipt.requestId,
    { headers: { 'X-Study-Grammar': '5', 'X-Study-AI-Contract': '4' } });
   assert.equal(readback.status(), 200);
   assert.deepEqual((await readback.json()).feedback, feedback);
   await page.getByText(countExplanation).waitFor();
   for (const deadline = Date.now() + 10000; Date.now() < deadline;) {
    if ((await snapshot()).state.grammar.noun.feedback?.contextFingerprint === feedback.contextFingerprint) break;
    await new Promise(resolve => setTimeout(resolve, 50));
   }
   const saved = (await snapshot()).state.grammar.noun;
   assert.deepEqual(saved.feedback, feedback);
   preserved(saved);
   await open();
   await page.getByText(countExplanation).waitFor();
   assert.deepEqual((await snapshot()).state.grammar.noun.feedback, feedback);
  }
  await page.getByRole('button',{name:'AI 제안으로 문장 바꾸기',exact:true}).click();
  await page.getByRole('button',{name:'비교한 제안으로 바꾸기',exact:true}).click();preserved(await savedSentence(correction));
  await page.getByRole('button',{name:'교정 적용 되돌리기',exact:true}).click();preserved(await savedSentence(submitted));
  await input.fill(seed.sentence);preserved(await savedSentence(seed.sentence));
  for(const group of await page.locator('.grammar-self-checks fieldset').all())await group.getByRole('radio',{name:'확인했어요',exact:true}).check();
  await page.getByRole('button',{name:'수업 마치기',exact:true}).click();await page.getByText('수업을 마쳤어요.',{exact:true}).waitFor();
  for(const end=Date.now()+10000;Date.now()<end;){const p=(await snapshot()).state.grammar.noun;if(p.stage===6){preserved(p);break;}await new Promise(ok=>setTimeout(ok,50));}
  assert.equal((await snapshot()).state.grammar.noun.stage,6);assert.ok(writes.length>0&&writes.every(x=>x===200));assert.equal(providerPosts,0);assert.deepEqual(errors,[]);
  assert.deepEqual([mockedRequests, grammarRequests], counted ? [0, 1] : [1, 0]);
  const result={passed:true,engine,mode,manualEditReloadAiApplyUndoRecomplete:true,independentPassed:2,reviewScheduleCompletionDatePreserved:true,firstAnswersPreserved:true,oldClient426:true,writes,providerPosts,mockedRequests,grammarRequests,countExplanationReloaded:counted,productionWrites:0};
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await page.screenshot({path:path.join(out,'preserved.png')});
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
