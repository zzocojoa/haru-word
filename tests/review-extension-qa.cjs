// Local built Worker only; synthetic accounts, no real learner records or AI calls.
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8787',out='outputs/review-extension';fs.mkdirSync(out,{recursive:true});
const words=JSON.parse(fs.readFileSync('data/words.json','utf8')),content=JSON.parse(fs.readFileSync('data/content.json','utf8'));
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const weekday=new Date(date+'T12:00:00Z');weekday.setUTCDate(weekday.getUTCDate()-(weekday.getUTCDay()+6)%7);const week=weekday.toISOString().slice(0,10);
const firstIds=['arrive','busy','breakfast'].map(term=>words.find(w=>w.word===term).id),more=words.filter(w=>w.level==='A1'&&!firstIds.includes(w.id)).slice(0,7).map(w=>w.id);
const record=id=>({entryId:id,meaning:content[id].meaning,material:content[id],familiarity:'known',en:'independent',ko:'independent',sentenceStatus:'written',sentence:'My original sentence.',notes:'keep source record',learnedOn:date});
const daily=ids=>{const id=crypto.randomUUID();return {id,kind:'daily',date,period:date,ids,warmupIds:[],stage:'done',index:0,records:Object.fromEntries(ids.map(id=>[id,record(id)])),retry:[],retryMode:false,elapsed:900,finished:true,paused:true,createdAt:date+'T01:00:00Z'}};
const checks=[],errors=[];
(async()=>{const browser=await chromium.launch();try{
 for(const kind of ['weekly','monthly']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'oai-authenticated-user-id':'review_extension_'+Date.now()+'_'+kind,'oai-authenticated-user-email':'test@example.test'}});
  const get=async()=>{const r=await ctx.request.get(base+'/api/state');assert.equal(r.status(),200);return r.json()};let data=await get();
  const source=daily(firstIds),sid=crypto.randomUUID(),period=kind==='weekly'?week:date.slice(0,7);
  const review={...daily(firstIds),id:sid,kind,period,stage:'ko',index:1,finished:false,elapsed:120,records:Object.fromEntries(firstIds.map((id,i)=>[id,{...record(id),ko:i===0?'independent':'unmeasured',sentenceStatus:'unmeasured',sentence:'',notes:'keep review note',...(i===1?{draft:{answer:'kept answer',stage:'ko',retry:false,hinted:false,revealed:false}}:{})}])),...(kind==='monthly'?{batchSize:15,batchStart:0}:{})};
  const progress=Object.fromEntries(firstIds.map(id=>[id,{meaning:content[id].meaning,familiarity:'known',studyDates:[date],lastStudied:date,en:'independent',ko:'independent',sentenceStatus:'written'}]));
  let response=await ctx.request.put(base+'/api/state',{data:{revision:data.revision,settings:data.state.settings,progress,sessions:{[source.id]:source,[sid]:review}}});assert.equal(response.status(),200);
  let p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));const saved=()=>p.getByText('서버에 저장됨',{exact:true}).waitFor();
  await p.goto(base);await saved();let region=p.getByRole('region',{name:'이어서 할 점검',exact:true});await region.getByText('전체 3개 · 미점검 '+(kind==='weekly'?3:2)+'개',{exact:true}).waitFor();
  await p.getByRole('button',{name:'학습 설정',exact:true}).click();await p.getByRole('combobox',{name:'하루 목표',exact:true}).click();await p.getByRole('option',{name:'10개',exact:true}).click();await saved();await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
  await region.getByText('전체 3개 · 미점검 '+(kind==='weekly'?3:2)+'개',{exact:true}).waitFor();checks.push(kind+': changing the goal alone does not invent studied targets');
  data=await get();const extra=daily(more);response=await ctx.request.put(base+'/api/state',{data:{revision:data.revision,progress:{},sessions:{[extra.id]:extra}}});assert.equal(response.status(),200);
  await p.reload();await saved();region=p.getByRole('region',{name:'이어서 할 점검',exact:true});await region.getByText('전체 10개 · 미점검 '+(kind==='weekly'?10:9)+'개',{exact:true}).waitFor();await region.getByText('추가 7개 · 기존 진행 뒤에 연결',{exact:true}).waitFor();assert.equal((await get()).state.sessions[sid].ids.length,3);await region.screenshot({path:out+'/'+kind+'-pending-ten.png'});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push(kind+': the card includes seven additions before resume without altering stored answers');
  await p.route('**/api/state',r=>r.request().method()==='PUT'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'테스트 저장 실패'})}):r.continue());
  await region.getByRole('button',{name:period+' '+(kind==='weekly'?'주간 점검':'월말 쓰기')+' 이어서',exact:true}).click();await p.getByRole('alert').waitFor();assert.equal((await get()).state.sessions[sid].ids.length,3);
  await p.unroute('**/api/state');await p.getByRole('button',{name:'다시 시도',exact:true}).click();await saved();data=await get();const expanded=data.state.sessions[sid];assert.equal(expanded.ids.length,10);assert.equal(expanded.reviewEnd,3);assert.equal(expanded.index,1);assert.equal(expanded.stage,'ko');for(const id of firstIds)assert.deepEqual(expanded.records[id],review.records[id]);
  // Old bundles must not advance a new-format review with their outdated stage logic.
  response=await ctx.request.put(base+'/api/state',{data:{revision:data.revision,progress:{},sessions:{[sid]:expanded}}});assert.equal(response.status(),426);assert.equal((await get()).revision,data.revision);
  await p.reload();await saved();await p.getByRole('region',{name:'이어서 할 점검',exact:true}).getByRole('button').click();await saved();assert.equal(await p.getByLabel('영어 단어 입력',{exact:true}).inputValue(),'kept answer');checks.push(kind+': failed expansion retries once, reload preserves the cursor and draft, and old clients are prevented from skipping new stages');
  let visited=[],steps=0;
  while(!(data=await get()).state.sessions[sid].finished){
   assert.ok(steps++<90);const s=data.state.sessions[sid];
   if(s.stage==='checkpoint'){await p.getByRole('button',{name:'다음 묶음 계속',exact:true}).click();await saved();continue;}
   const id=s.ids[s.index];visited.push([id,s.stage]);
   if(s.stage==='sentence'){await p.getByLabel('내 영어 문장',{exact:true}).fill('I use this word.');await p.getByRole('button',{name:'문장을 완성했어요',exact:false}).click();await saved();}
   else{await p.getByLabel(s.stage==='en'?'한국어 뜻 입력':'영어 단어 입력',{exact:true}).fill(s.stage==='en'?s.records[id].meaning:words.find(w=>w.id===(s.records[id].entryId||id)).word);await p.getByRole('button',{name:'내 답 확인',exact:false}).click();await p.getByRole('button',{name:'도움 없이 맞혔어요',exact:true}).click();await saved();}
  }
  for(const id of more)assert.deepEqual(visited.filter(([target])=>target===id).map(([,stage])=>stage),kind==='weekly'?['en','ko','sentence']:['ko','sentence']);
  assert.deepEqual(data.state.sessions[source.id],source);assert.deepEqual(data.state.sessions[extra.id],extra);for(const id of more){const r=data.state.sessions[sid].records[id];assert.equal(r.ko,'independent');if(kind==='weekly')assert.equal(r.en,'independent')}
  await p.getByRole('button',{name:'학습 홈으로',exact:false}).click();assert.equal(await p.getByRole('region',{name:'이어서 할 점검',exact:true}).count(),0);
  checks.push(kind+': all ten finish, every added recall direction is measured, original daily records remain unchanged and the pending card clears');await ctx.close();
 }
 assert.deepEqual(errors,[]);const result={passed:true,checks,browserErrors:errors};fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
