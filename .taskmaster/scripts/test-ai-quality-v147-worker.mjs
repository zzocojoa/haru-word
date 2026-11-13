import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {startSyntheticWorker} from './ai-quality-v147-worker.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),read=async p=>JSON.parse(await readFile(p,'utf8'));
const manifest=await read(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json')),ROOT=manifest.baseline.existingDashboardRoot;
const out=resolve(process.env.QA_OUTPUT_DIR||resolve(SOURCE,'outputs/ai-quality-v147-worker-'+randomUUID()));await mkdir(out,{recursive:false});
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const save=(name,value)=>writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const MODELS=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'],wordSentence='Give help.',grammarSentence='They is studying.';
const word=(await read(resolve(SOURCE,'data/words.json'))).find(w=>w.word==='help'&&w.pos==='n.');assert.ok(word);
const material=(await read(resolve(SOURCE,'data/content.json')))[word.id];assert.ok(material);
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const checks=[],profiles=[],observations=[],browserObservations=[];let step='start';
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
function headers(base,owner){return {'Content-Type':'application/json',Origin:base,'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'ai-quality@example.test','X-Study-Owner':owner,'X-Study-AI-Contract':'4','X-Study-Grammar':'5','X-Study-Feedback-Structure':'1'};}
async function api(profile,owner,path,method='GET',body,extra={}){
 const response=await fetch(profile.base+path,{method,headers:{...headers(profile.base,owner),...extra},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45_000)});
 const value=await response.json();return {status:response.status,value};
}
function session(id){return {id,kind:'daily',date,period:date,ids:[word.id],warmupIds:[],records:{[word.id]:{entryId:word.id,meaning:material.meaning,familiarity:'uncertain',en:'independent',ko:'independent',enAnswer:'Synthetic first English answer.',koAnswer:'합성 첫 한국어 답',sentenceStatus:'unmeasured',sentence:wordSentence,notes:'',learnedOn:date,lastPracticedOn:date,material}},stage:'sentence',index:0,retry:[],retryMode:false,elapsed:10,finished:false,paused:false,createdAt:new Date().toISOString()};}
const grammar=()=>{const answer={first:'합성 첫 답',latest:'합성 마지막 답',helped:false,attempts:1};return {stage:5,sentence:grammarSentence,answers:{q1:answer,q2:answer,q3:answer},contentVersion:4,questionIds:[1,2,3].map(n=>'auxiliary:4:base:q'+n),observation:answer,updatedAt:new Date().toISOString()};};
function respond(body){
 const input=JSON.parse(body.input[0].content),isWord=input.sentence===wordSentence;
 const wire={meaningUsage:isWord?'appropriate':'needs_work',grammar:isWord?'natural':'needs_work',correctedSentence:isWord?wordSentence:'They are studying.',targetReason:'합성 목표 의견',grammarReason:'합성 문법 의견',correctionReason:isWord?'':'합성 수 일치 보완',contextNeeded:'none'};
 return {status:'completed',model:body.model,usage:{input_tokens:100,output_tokens:80,output_tokens_details:{reasoning_tokens:10}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(wire)}]}]};
}
async function seed(profile,model,domain,owner='aiq-v147-'+model+'-'+domain){
 const initial=await api(profile,owner,'/api/state');assert.equal(initial.status,200,'initial state');const id=randomUUID(),s=session(id),g=grammar();
 const change={revision:initial.value.revision,settings:{...initial.value.state.settings,level:word.level,dailyGoal:1,aiModelId:model,activeSessionId:domain==='word'?id:null},progress:{},sessions:domain==='word'?{[id]:s}:{},grammar:domain==='grammar'?{auxiliary:g}:{}};
 const seeded=await api(profile,owner,'/api/state','PUT',change);assert.equal(seeded.status,200,'seed state');return {owner,sessionId:id,grammar:g,session:s};
}
async function exercise(profile,model,domain){
 step=profile.proof.label+'/'+model+'/'+domain;const seeded=await seed(profile,model,domain),owner=seeded.owner,path='/api/'+(domain==='word'?'sentence':'grammar')+'-feedback';
 const body={...(domain==='word'?{sessionId:seeded.sessionId,entryId:word.id,sentence:wordSentence}:{lessonId:'auxiliary',sentence:grammarSentence}),expectedModelId:model,requestId:randomUUID(),requestStartedAt:Date.now()},before=profile.providerRecords.length;
 const old=await api(profile,owner,path,'POST',body,{'X-Study-AI-Contract':'3'});assert.equal(old.status,426);assert.equal(profile.providerRecords.length,before);
 const wrong=await api(profile,owner,path,'POST',{...body,expectedModelId:MODELS.find(m=>m!==model)});assert.equal(wrong.status,409);assert.equal(profile.providerRecords.length,before);
 const excessive=await api(profile,owner,path,'POST',{...body,sentence:'x'.repeat(2001)});assert.equal(excessive.status,400);assert.equal(profile.providerRecords.length,before);
 const result=await api(profile,owner,path,'POST',body);assert.equal(result.status,200,'generation response');assert.equal(profile.providerRecords.length,before+1);assert.equal(result.value.receipt.requestId,body.requestId);assert.equal(result.value.receipt.state,'completed');assert.equal(result.value.receipt.persisted,true);
 const recovered=await api(profile,owner,'/api/feedback-requests/'+body.requestId);assert.equal(recovered.status,200);assert.deepEqual(recovered.value.feedback,result.value.feedback);
 const replay=await api(profile,owner,path,'POST',body);assert.equal(replay.status,200);assert.deepEqual(replay.value.feedback,result.value.feedback);assert.equal(profile.providerRecords.length,before+1,'same UUID cannot dispatch again');
 const other=await api(profile,'aiq-v147-other-owner','/api/feedback-requests/'+body.requestId);assert.ok([404,409].includes(other.status));assert.ok(!other.value.feedback);assert.equal(profile.providerRecords.length,before+1);
 const snapshot=await api(profile,owner,'/api/state'),state=snapshot.value.state,feedback=recovered.value.feedback;
 assert.equal(feedback.model,model);assert.equal(feedback.requestedModel,model);assert.equal(feedback.provider,'openai');assert.equal(feedback.validationVersion,'judgment-v6');assert.equal(feedback.promptVersion,profile.proof.label==='baseline'?'reference-v5':'reference-v6');
 if(domain==='word'){
  assert.equal(feedback.grammar,profile.proof.label==='baseline'?'uncertain':'natural');const beforeAnswer=state.sessions[seeded.sessionId].records[word.id].enAnswer;
  state.sessions[seeded.sessionId].records[word.id].aiFeedback=feedback;
  const stored=await api(profile,owner,'/api/state','PUT',{revision:snapshot.value.revision,progress:{},sessions:{[seeded.sessionId]:state.sessions[seeded.sessionId]}});assert.equal(stored.status,200,'word feedback save');
  const reread=await api(profile,owner,'/api/state');assert.deepEqual(reread.value.state.sessions[seeded.sessionId].records[word.id].aiFeedback,feedback);assert.equal(reread.value.state.sessions[seeded.sessionId].records[word.id].enAnswer,beforeAnswer);
 }else{
  assert.equal(feedback.correctedSentence,'They are studying.');const beforeAnswers=structuredClone(state.grammar.auxiliary.answers);state.grammar.auxiliary.feedback=feedback;
  const stored=await api(profile,owner,'/api/state','PUT',{revision:snapshot.value.revision,progress:{},sessions:{},grammar:state.grammar});assert.equal(stored.status,200,'grammar feedback save');
  const reread=await api(profile,owner,'/api/state');assert.deepEqual(reread.value.state.grammar.auxiliary.feedback,feedback);assert.deepEqual(reread.value.state.grammar.auxiliary.answers,beforeAnswers);
 }
 const provider=profile.providerRecords.at(-1),outbound=JSON.parse(provider.body);assert.equal(outbound.model,model);assert.equal(outbound.max_output_tokens,4096);assert.equal(outbound.store,false);assert.equal(outbound.stream,false);
 const observation={profile:profile.proof.label,model,domain,owner,sessionId:seeded.sessionId,requestId:body.requestId,apiBodySha256:sha(body),providerBodySha256:provider.bodySha256,responseSha256:sha(result.value),feedback,receiptRecovered:true,duplicateProviderDispatches:0,storedAndReread:true,preDispatch426409400:true};observations.push(observation);
 pass(step+': full API→workerd→synthetic provider→parser→D1 receipt/state; UUID recovery,replay,ownership,426/409/400 and first-answer preservation');
}
async function browserDisplay(profile,engine){
 const require=createRequire(import.meta.url),playwright=require(process.env.QA_PLAYWRIGHT_PATH||'playwright'),browser=await playwright[engine].launch({headless:true});
 try{for(const domain of ['word','grammar']){
  step='browser/'+profile.proof.label+'/'+engine+'/'+domain;const observation=observations.find(o=>o.profile===profile.proof.label&&o.model===MODELS[0]&&o.domain===domain),owner=observation.owner;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',extraHTTPHeaders:headers(profile.base,owner)}),page=await context.newPage(),errors=[],blocked=[],responses=[],failed=[];
  page.setDefaultTimeout(15_000);page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{if(!route.request().url().startsWith(profile.base+'/')){blocked.push(new URL(route.request().url()).origin);return route.abort();}return route.continue();});
  page.on('response',r=>responses.push({path:new URL(r.url()).pathname,status:r.status()}));page.on('requestfailed',r=>failed.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  try{
   const initial=await api(profile,owner,'/api/state');const before=profile.providerRecords.length;
   await page.goto(profile.base);await page.getByText('저장됨',{exact:true}).first().waitFor();
   let panel;
   if(domain==='word'){
    await page.getByRole('button',{name:'중단한 학습 이어서',exact:false}).click();await page.getByLabel('내 영어 문장',{exact:true}).waitFor();panel=page.locator('section[aria-label="AI 참고 의견"]');
   }else{
    await page.getByRole('tab',{name:'단어장',exact:true}).click();await page.getByRole('tab',{name:'품사와 문장 연습',exact:true}).click();const tile=page.locator('.grammar-tile').filter({hasText:'기본 조동사'});if(!await tile.isVisible())await page.locator('details.grammar-group').filter({hasText:'동사를 돕는 표현'}).locator('summary').click();await tile.click();await page.getByRole('textbox',{name:'내 문장',exact:true}).waitFor();panel=page.locator('.ai-feedback-result').first();
   }
   await panel.waitFor();for(const summary of await panel.locator('details.record-text > summary').all())await summary.click();
   const text=await panel.innerText();assert.ok(text.includes(observation.feedback.original),'visible original');if(observation.feedback.correctedSentence)assert.ok(text.includes(observation.feedback.correctedSentence),'visible correction');assert.ok(text.includes(observation.feedback.explanation),'visible reviewed explanation');
   assert.equal(profile.providerRecords.length,before,'opening stored feedback must not call AI');
   let uiRecovery=null;
   if(engine==='chromium'&&domain==='word'){
    let interrupted=false,requestId,postCount=0;
    await page.route('**/api/sentence-feedback',async route=>{
     if(route.request().method()!=='POST'||interrupted)return route.continue();interrupted=true;postCount++;requestId=route.request().postDataJSON().requestId;
     const actual=await route.fetch();assert.equal(actual.status(),200);await route.fulfill({status:200,contentType:'application/json',body:'{"feedback":'});
    });
    await panel.getByRole('button',{name:'AI 참고 의견 다시 요청',exact:true}).click();await panel.getByRole('button',{name:'이전 AI 요청 결과 확인',exact:true}).waitFor();assert.ok(requestId);assert.equal(profile.providerRecords.length,before+1);
    const recovered=page.waitForResponse(r=>r.url()===profile.base+'/api/feedback-requests/'+requestId&&r.status()===200);
    await panel.getByRole('button',{name:'이전 AI 요청 결과 확인',exact:true}).click();await recovered;
    for(const end=Date.now()+10_000;;){const saved=await api(profile,owner,'/api/state'),f=saved.value.state.sessions[observation.sessionId].records[word.id].aiFeedback;
     if(f?.createdAt!==observation.feedback.createdAt){assert.equal(f.original,wordSentence);break;}assert.ok(Date.now()<end,'recovered feedback was not stored');await new Promise(ok=>setTimeout(ok,50));
    }
    assert.equal(postCount,1);assert.equal(profile.providerRecords.length,before+1);uiRecovery={requestId,postCount,providerCalls:1,recoveredFromActualD1Receipt:true};
   }
   const after=await api(profile,owner,'/api/state');if(domain==='word'){
    const beforeRecord=initial.value.state.sessions[observation.sessionId].records[word.id],afterRecord=after.value.state.sessions[observation.sessionId].records[word.id];for(const key of ['enAnswer','koAnswer','en','ko','familiarity'])assert.equal(afterRecord[key],beforeRecord[key],'first answer/independent grade preservation');
   }else{assert.deepEqual(after.value.state.grammar.auxiliary.answers,initial.value.state.grammar.auxiliary.answers);assert.deepEqual(after.value.state.grammar.auxiliary.observation,initial.value.state.grammar.auxiliary.observation);}
   assert.deepEqual(errors,[]);await page.screenshot({path:resolve(out,profile.proof.label+'-'+engine+'-'+domain+'.png'),fullPage:true});
   browserObservations.push({profile:profile.proof.label,engine,domain,visibleFeedback:true,firstAnswersPreserved:true,uiRecovery,blockedNonLoopbackOrigins:[...new Set(blocked)],pageErrors:0});pass(step+': actual built UI displays D1 feedback;'+(uiRecovery?' truncated real API response recovers same UUID with1 provider dispatch;':' no automatic generation;')+' first answers preserved');
  }catch(error){await save('browser-failure.json',{step,errors,blocked,responses,failed,syntheticBodyText:(await page.locator('body').innerText()).slice(0,5000)});await page.screenshot({path:resolve(out,'browser-failure.png'),fullPage:true});throw error;}finally{await context.close();}
 }}finally{await browser.close();}
}
try{
 for(const [label,buildSourceRoot]of [['baseline',resolve(ROOT,'work/provider-network-publish-20261105')],['candidate',SOURCE]]){
  step='start/'+label;const profile=await startSyntheticWorker({label,buildSourceRoot,workspaceRoot:SOURCE,allowedSentences:[wordSentence,grammarSentence],respond});profiles.push(profile);
  assert.equal((await fetch(profile.base+'/api/study-clock')).status,200);assert.equal((await fetch(profile.base+'/api/state')).status,401);
  for(const model of MODELS)for(const domain of ['word','grammar'])await exercise(profile,model,domain);
  assert.equal(profile.providerRecords.length,6);pass(label+': exactly6 synthetic provider dispatches for6 distinct request UUIDs');
 }
 const [baseline,candidate]=profiles;await seed(baseline,MODELS[0],'word','aiq-v147-isolation-only');const other=await api(candidate,'aiq-v147-isolation-only','/api/state');assert.deepEqual(other.value.state.sessions,{});assert.deepEqual(other.value.state.progress,{});pass('baseline and candidate have different local D1 namespaces even for the same synthetic identity');
 for(const profile of profiles)for(const engine of ['chromium','webkit'])await browserDisplay(profile,engine);
 for(const profile of profiles)assert.equal(profile.providerRecords.length,7);
 await save('observations.json',observations);await save('browser-observations.json',browserObservations);await save('provider-requests.json',profiles.map(p=>({profile:p.proof.label,requests:p.providerRecords})));await save('runtime-events.json',profiles.map(p=>({profile:p.proof.label,events:p.events})));
}catch(error){await save('failure.json',{step,name:error.name,message:error.message});throw error;}
finally{
 const stopped=await Promise.allSettled(profiles.map(p=>p.stop()));await save('lifecycle.json',{profiles:profiles.map(p=>p.proof),stopped:stopped.map(s=>({status:s.status,...(s.status==='rejected'?{error:s.reason.message}:{})}))});for(const s of stopped)if(s.status==='rejected')throw s.reason;
}
pass('both owned workerd processes and loopback listeners closed; local D1 evidence retained');
await save('results.json',{passed:true,checks,profiles:profiles.map(p=>p.proof),syntheticProviderCalls:profiles.reduce((n,p)=>n+p.providerRecords.length,0),actualProviderCalls:0,productionRowsRead:0,productionRowsWritten:0,newSites:0,scope:'Actual full built Vinext API/local D1 plus Chromium/WebKit UI and two lost-response/receipt recoveries. Synthetic provider only; no real provider,production or physical-device claim.'});
console.log(JSON.stringify({passed:true,groups:checks.length,syntheticProviderCalls:14,actualProviderCalls:0,output:out}));
