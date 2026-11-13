const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createServer}=require('node:http');
const {randomUUID}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {build}=require('esbuild');
(async()=>{
 const engine=process.env.QA_BROWSER||'chromium';assert.ok(['chromium','webkit'].includes(engine));
 const playwright=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
 const dir=path.resolve('work/local-draft-qa',engine+'-'+randomUUID());fs.mkdirSync(dir,{recursive:true});
 await build({entryPoints:['tests/local-draft-harness.tsx'],outfile:path.join(dir,'harness.js'),bundle:true,format:'iife',platform:'browser',logLevel:'silent',define:{'process.env.NODE_ENV':'"development"'}});
 const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/harness.js"></script></body></html>';
 let posts=0,gets=0,loseNext=false,failLookup=false;const lookupIds=[],receipts=new Map(),checks=[],errors=[],external=[];
 const server=createServer(async(req,res)=>{
  if(req.url==='/harness.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(fs.readFileSync(path.join(dir,'harness.js')));return;}
  if(req.method==='POST'&&['/api/sentence-feedback','/api/grammar-feedback'].includes(req.url)){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);posts++;
   assert.equal(req.headers['x-study-owner'],'synthetic-owner');assert.ok(body.requestId);assert.ok(body.requestStartedAt);
   const sentence=req.url==='/api/grammar-feedback'?body.sentence.trim():body.sentence;
   const feedback={original:sentence,correctedSentence:sentence,meaningUsage:'appropriate',grammar:'natural',explanation:'복구한 합성 참고 의견',model:body.expectedModelId,provider:'openai',requestedModel:body.expectedModelId,promptVersion:'reference-v7',validationVersion:'judgment-v6',...(body.expectedContextFingerprint?{contextFingerprint:body.expectedContextFingerprint}:{}),...(body.contextNote?{contextNote:body.contextNote}:{}),createdAt:new Date().toISOString()};
   const result={feedback,receipt:{requestId:body.requestId,state:'completed',persisted:true}};receipts.set(body.requestId,result);
   if(loseNext){loseNext=false;res.writeHead(200,{'Content-Type':'application/json'});res.end('{"feedback":');return;}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
  }
  if(req.url.startsWith('/api/feedback-requests/')){gets++;const id=req.url.split('/').pop();lookupIds.push(id);if(failLookup){failLookup=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'provider_unavailable'}));return;}const body=receipts.get(id);res.writeHead(body?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify(body??{code:'receipt_unknown'}));return;}
  if(req.url.startsWith('/?')||req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 // This installed Windows WebKit loses persistent localStorage under a Korean
 // profile path. A minimal probe retained it under the host's ASCII temp root.
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'haru-draft-'+engine+'-'));
 let context,page;const pass=name=>{checks.push(name);console.log('PASS '+name);};
 async function start(){context=await playwright[engine].launchPersistentContext(profile,{headless:true,viewport:{width:390,height:844}});page=context.pages()[0]??await context.newPage();await wire(page);}
 async function wire(p){p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',route=>{if(!route.request().url().startsWith(base+'/')){external.push(route.request().url());return route.abort();}return route.continue();});p.on('dialog',d=>void(d.type()==='beforeunload'?d.accept():d.dismiss()));}
 async function open(mode='word',extra=''){await page.goto(base+'/?mode='+mode+extra);await page.getByRole('heading',{name:'합성 초안 검사'}).waitFor();await page.waitForFunction(()=>{const storage=window.draftHarness?.snapshot()?.storage;return storage?.ready&&storage.available&&storage.active;});}
 const field=()=>page.getByRole('textbox',{name:'내 문장',exact:true});
 async function value(expected){await page.waitForFunction(v=>document.querySelector('textarea')?.value===v,expected);}
 async function forceStop(){
  // Kill only this uniquely named QA profile's main browser process. No other
  // browser, user profile or server can match this absolute random directory.
  const script="$qaProfile=[IO.Path]::GetFullPath($env:HARU_QA_PROFILE); $qaOwned=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($qaProfile,[StringComparison]::OrdinalIgnoreCase) -ge 0 }); $qaMatches=@($qaOwned | Where-Object { $_.Name -match '^(chrome|chrome-headless-shell|headless_shell|MiniBrowser|Playwright)\\.exe$' -and $_.CommandLine -notmatch '--type=' }); if($qaMatches.Count -ne 1){ throw ('Expected one owned QA browser process; matched names: '+(($qaOwned | Select-Object -ExpandProperty Name) -join ',')) }; Stop-Process -Id $qaMatches[0].ProcessId -Force -ErrorAction Stop; Write-Output 'owned-qa-browser-stopped'";
  if(process.platform==='win32')assert.match(execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,env:{...process.env,HARU_QA_PROFILE:profile}}),/owned-qa-browser-stopped/);
  else{
   const matches=execFileSync('ps',['-A','-o','pid=,comm=,args='],{encoding:'utf8'}).split('\n').filter(line=>line.includes(profile)&&!/--type=/.test(line)&&/chrome|chromium|MiniBrowser|WebKit/i.test(line));
   assert.equal(matches.length,1,'one uniquely owned QA main browser process');process.kill(Number(matches[0].trim().split(/\s+/)[0]),'SIGKILL');
  }
  await context.close().catch(()=>{});context=null;
 }
 try{
  await start();
  await open('word');
  await page.getByText('문장의 형식 · 선택',{exact:true}).click();
  const contextNote=()=>page.getByRole('textbox',{name:'의도한 한국어 문장',exact:true});
  const contextKind=()=>page.getByRole('combobox',{name:'문장의 형식',exact:true});
  await contextKind().selectOption('reply');
  await contextNote().fill('질문에 대한 짧은 답변이에요.');await page.reload();
  await page.getByText('문장의 형식 · 선택',{exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(el=>el.value==='질문에 대한 짧은 답변이에요.'));
  assert.equal(await contextNote().inputValue(),'질문에 대한 짧은 답변이에요.');assert.equal(await contextKind().inputValue(),'reply');assert.equal(posts,0);
  await contextNote().fill('');await page.reload();await page.getByText('문장의 형식 · 선택',{exact:true}).click();
  assert.equal(await contextNote().inputValue(),'');assert.equal(posts,0);pass('explicit AI context and its empty clearing survive reload without an automatic AI request');
  await contextKind().selectOption('sentence');await page.reload();await page.getByText('문장의 형식 · 선택',{exact:true}).click();assert.equal(await contextKind().inputValue(),'sentence');assert.equal(await contextNote().inputValue(),'');
  const legacyKey=await page.evaluate(()=>{const owner=localStorage.getItem('haru-words:local-input-owner:v1'),instanceId=crypto.randomUUID(),question=JSON.stringify(['ai-context','word',JSON.stringify(['a1111111-1111-4111-8111-111111111111','synthetic'])]),key='haru-words:local-input:v1:'+encodeURIComponent(owner)+':'+instanceId+':'+encodeURIComponent(question);localStorage.setItem(key,JSON.stringify({version:1,kind:'grammar',question,instanceId,epoch:localStorage.getItem('haru-words:local-input-clear:v1:'+encodeURIComponent(owner))??'initial',updatedAt:Date.now(),base:{sentence:''},values:{sentence:'이전 버전의 합성 문맥'}}));return key;});
  await page.reload();await page.getByText('문장의 형식 · 선택',{exact:true}).click();await page.getByText('이전 버전의 문맥 확인',{exact:true}).click();await page.getByRole('button',{name:'빈 문맥에 가져오기',exact:true}).click();assert.equal(await contextNote().inputValue(),'이전 버전의 합성 문맥');assert.equal(await page.evaluate(key=>localStorage.getItem(key)!==null,legacyKey),true);assert.equal(posts,0);pass('intent kind persists independently; legacy context imports explicitly without deleting the original or calling AI');
  await page.evaluate(()=>window.draftHarness.clear());
  for(const mode of ['word','grammar']){
   await open(mode);const before=await page.evaluate(()=>window.draftHarness.snapshot().source);
   await field().fill('Unsaved '+mode+' sentence.');await page.waitForFunction(()=>window.draftHarness.snapshot().rows.some(r=>r.record.kind!=='request'&&r.record.values.sentence.startsWith('Unsaved ')));
   await page.reload();await value('Unsaved '+mode+' sentence.');assert.equal(posts,0);
   const after=await page.evaluate(()=>window.draftHarness.snapshot().source);
   if(mode==='word'){assert.equal(after.server.records.synthetic.enAnswer,before.server.records.synthetic.enAnswer);assert.equal(after.server.records.synthetic.en,before.server.records.synthetic.en);}else assert.deepEqual(after.progress.answers,before.progress.answers);
   pass(mode+' reload restores unsaved writing without grading, first-answer changes or AI calls');
   await field().fill('');await page.reload();await value('');pass(mode+' explicit empty input survives reload');
   await field().fill('Before forced exit '+mode+'.');await page.waitForTimeout(6000);await forceStop();await start();await open(mode);await value('Before forced exit '+mode+'.');pass(mode+' input survives forced browser process termination');
   await page.evaluate(()=>window.draftHarness.clear());await page.reload();await value('Saved synthetic sentence.');
  }
  await open('word','&stage=en');await page.getByRole('textbox',{name:'작성 중 답'}).fill('Unsubmitted recall.');await page.getByRole('checkbox',{name:'도움 사용 표시'}).check();await page.reload();await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(el=>el.value==='Unsubmitted recall.'));assert.equal(await page.getByRole('textbox',{name:'작성 중 답'}).inputValue(),'Unsubmitted recall.');assert.equal(await page.getByRole('checkbox',{name:'도움 사용 표시'}).isChecked(),true);pass('recall input and help flags recover without submitting or changing the recorded first answer');
  await page.evaluate(()=>window.draftHarness.clear());await open();await field().fill('Earlier local draft.');
  await open('word','&sentence='+encodeURIComponent('Changed server sentence.'));await value('Changed server sentence.');await page.locator('summary').filter({hasText:'이 기기에 남은 다른 입력 확인'}).click();await page.getByRole('button',{name:'현재 입력과 비교'}).first().click();await field().fill('New edit after comparison.');assert.equal(await page.getByRole('button',{name:'비교한 입력으로 이어쓰기'}).isDisabled(),true);pass('changed server baseline requires comparison and a later edit invalidates confirmation');
  await page.evaluate(()=>window.draftHarness.clear());await open();await field().fill('First tab draft.');const second=await context.newPage();await wire(second);await second.goto(base+'/?mode=word');await second.waitForFunction(()=>document.querySelector('textarea')?.value==='First tab draft.');await second.getByRole('textbox',{name:'내 문장',exact:true}).fill('Second tab draft.');await page.bringToFront();await page.waitForFunction(()=>window.draftHarness.snapshot().storage.count>=2);assert.equal(await field().inputValue(),'First tab draft.');await second.close();pass('two tabs preserve their own current edits without replacing one another');
  await page.evaluate(()=>window.draftHarness.clear());await page.reload();await value('Saved synthetic sentence.');pass('explicit deletion is not undone by a stale tab write or reload');
  await open('grammar','&requests=1');const padded=' \tI am happy.\n ';
  await field().fill(padded);const grammarBefore=await page.evaluate(()=>window.draftHarness.snapshot().source.progress),postsBefore=posts;
  await page.getByRole('button',{name:'AI 참고 의견 요청',exact:true}).click();await page.getByText('복구한 합성 참고 의견',{exact:true}).waitFor();
  const grammarAfter=await page.evaluate(()=>window.draftHarness.snapshot().source.progress);
  assert.equal(posts,postsBefore+1);assert.equal(await field().inputValue(),padded);assert.equal(grammarAfter.sentence,padded);assert.deepEqual(grammarAfter.answers,grammarBefore.answers);
  pass('grammar accepts the v5 trimmed original while preserving surrounding whitespace and first answers');
  await page.evaluate(()=>window.draftHarness.clear());
  for(const mode of ['word','grammar']){
   const requestSentence=mode==='grammar'?' \tSynthetic request grammar.\n ':'Synthetic request word.';
   await open(mode,'&requests=1');if(mode==='word')await page.getByRole('textbox',{name:'의도한 한국어 문장',exact:true}).fill('검증용 한국어 의도예요.');await field().fill(requestSentence);await page.waitForFunction(sentence=>window.draftHarness.snapshot().rows.some(row=>row.record.kind!=='request'&&row.record.values.sentence===sentence),requestSentence);const beforePosts=posts,beforeGets=gets;loseNext=true;
   await page.getByRole('button',{name:'AI 참고 의견 요청',exact:true}).click();await page.getByRole('button',{name:'이전 AI 요청 결과 확인',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('[role="alert"]').length>0||document.body.textContent.includes('연결 실패'));
   assert.equal(posts,beforePosts+1);await page.reload();await value(requestSentence);assert.equal(posts,beforePosts+1);assert.equal(gets,beforeGets);
   failLookup=true;await page.getByRole('button',{name:'이전 AI 요청 결과 확인',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('.grammar-ai-action button:disabled')&&document.body.textContent.includes('이전 AI 요청 결과 확인'));
   assert.equal(posts,beforePosts+1);assert.equal(gets,beforeGets+1);
   await page.getByRole('button',{name:'이전 AI 요청 결과 확인',exact:true}).click();await page.getByText('복구한 합성 참고 의견',{exact:true}).waitFor();assert.equal(posts,beforePosts+1);assert.equal(gets,beforeGets+2);assert.equal(lookupIds.at(-1),lookupIds.at(-2));pass(mode+' lost AI response and receipt-less503 retain the same UUID; next explicit click only looks up, never posts');
   await page.evaluate(()=>window.draftHarness.clear());
  }
  await page.evaluate(()=>window.draftHarness.clear());await open('word');
  await field().fill('First pending save.');await page.waitForFunction(()=>window.draftHarness.snapshot().rows.some(row=>row.record.values.sentence==='First pending save.'));
  await page.evaluate(()=>window.draftHarness.captureAck());await field().fill('Newer unsaved edit.');
  await page.waitForFunction(()=>window.draftHarness.snapshot().rows.some(row=>row.record.values.sentence==='Newer unsaved edit.'));
  await page.evaluate(()=>window.draftHarness.pendingAck(true));
  assert.ok((await page.evaluate(()=>window.draftHarness.snapshot().rows)).some(row=>row.record.values.sentence==='Newer unsaved edit.'));
  await page.evaluate(()=>{window.draftHarness.captureAck();window.draftHarness.pendingAck(false);});
  assert.ok((await page.evaluate(()=>window.draftHarness.snapshot().rows)).some(row=>row.record.values.sentence==='Newer unsaved edit.'));
  await page.evaluate(()=>window.draftHarness.captureAck());
  const ackTab=await context.newPage();await wire(ackTab);await ackTab.goto(base+'/?mode=word');/* Establish recovered input before testing a new tab's distinct unsaved edit. */await ackTab.waitForFunction(()=>window.draftHarness?.snapshot()?.storage?.available&&document.querySelector('textarea')?.value==='Newer unsaved edit.');await ackTab.getByRole('textbox',{name:'내 문장',exact:true}).fill('Another tab unsaved edit.');
  await ackTab.waitForFunction(()=>window.draftHarness.snapshot().rows.some(row=>row.record.values.sentence==='Another tab unsaved edit.'));
  await page.evaluate(()=>window.draftHarness.pendingAck(true));
  await page.waitForFunction(()=>!window.draftHarness.snapshot().rows.some(row=>row.record.values.sentence==='Newer unsaved edit.'));
  assert.ok((await ackTab.evaluate(()=>window.draftHarness.snapshot().rows)).some(row=>row.record.values.sentence==='Another tab unsaved edit.'));await ackTab.close();
  pass('UI-2 captured acknowledgement retains failed/newer edits and removes only the successful page instance');
  await open();await field().fill('Account A private synthetic input.');await page.evaluate(()=>window.draftHarness.switchOwner('synthetic-other'));await value('Saved synthetic sentence.');assert.equal(await page.evaluate(()=>JSON.stringify(window.draftHarness.snapshot().rows).includes('Account A private')),false);pass('account switch remounts forms and removes previous-account drafts');
  await field().fill('Logout synthetic input.');await page.getByRole('link',{name:'임시 입력을 지우고 로그아웃',exact:true}).click();await page.waitForURL('**/signout-with-chatgpt*');
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('haru-words:local-input:v1:')).length),0);assert.equal(await page.evaluate(()=>localStorage.getItem('haru-words:local-input-owner:v1')),null);pass('app logout clears device drafts before top-level sign-out navigation');
  await open();
  await page.evaluate(()=>window.draftHarness.invalidate());await page.getByRole('button',{name:'새로고침',exact:true}).waitFor();assert.equal(await page.getByRole('textbox').count(),0);pass('unverified account state hides forms and prevents further use of cached private input');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('no renderer exceptions or non-loopback requests');
  fs.mkdirSync('outputs/local-draft-qa',{recursive:true});fs.writeFileSync('outputs/local-draft-qa/'+engine+'.json',JSON.stringify({engine,passed:checks.length,checks,errors,externalRequests:external.length,syntheticPosts:posts,receiptLookups:gets,scope:'Product React hooks on a loopback synthetic server, forced owned browser termination; no built Worker or real iPhone claim'},null,2));
 }catch(error){console.error('Synthetic renderer errors: '+JSON.stringify(errors));console.error('Synthetic request counters: '+JSON.stringify({posts,gets}));if(page&&!page.isClosed())fs.writeFileSync(path.join(dir,'failed-ui.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,snapshot:window.draftHarness?.snapshot()})),null,2));throw error;}
 finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
