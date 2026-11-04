import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

mkdirSync('work/feedback-tests',{recursive:true});
await build({entryPoints:['lib/openai-feedback.ts','lib/validation.ts'],outdir:'work/feedback-tests',bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
await build({entryPoints:['app/api/sentence-feedback/route.ts'],outfile:'work/feedback-tests/route.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent',plugins:[{
 name:'test-server-boundaries',setup(b){
  b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/store)$/},a=>({path:a.path,namespace:'test-boundaries'}));
  b.onLoad({filter:/.*/,namespace:'test-boundaries'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.testRuntime.env':a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>globalThis.testRuntime.user':'export const database=()=>globalThis.testRuntime.db',loader:'js'}));
 }
}]});
await build({entryPoints:['db/feedback.ts'],outfile:'work/feedback-tests/feedback-store.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const {generateStructuredOpenAiFeedback:generateOpenAiFeedback}=await import('../work/feedback-tests/openai-feedback.mjs');
const generateSentenceFeedback=(key,input,fetcher)=>generateOpenAiFeedback({apiKey:key,modelId:'gpt-6.1-sol',allowedModels:'gpt-6.1-sol'},input,'Trusted test prompt. ',fetcher);
const {recordFeedbackAttempt}=await import('../work/feedback-tests/feedback-store.mjs');
const {saveSchema}=await import('../work/feedback-tests/validation.mjs');
const input={word:'arrive',pos:'v.',meaning:'도착하다',sentence:'I arrive home yesterday.'};
const content={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence:'I arrived home yesterday.',explanation:'어제 일어난 일이므로 arrive를 arrived로 바꿔요.',structure:{status:'unavailable',translation:'',parts:[],note:'합성 검사입니다.'}};
const wrap=payload=>Response.json({status:'completed',model:'gpt-6.1-sol',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(payload)}]}]});
const success=()=>wrap(content);

test('word adapter uses the selected OpenAI model and only the trusted study input',async t=>{
 t.mock.method(console,'info',()=>{});let request;const feedback=await generateSentenceFeedback('test-secret',input,async(url,init)=>{request={url,init};return success()});assert.equal(feedback.original,input.sentence);assert.equal(feedback.grammar,'needs_work');assert.equal(feedback.meaningUsage,'appropriate');assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(request.init.headers.Authorization,'Bearer test-secret');const sent=JSON.parse(request.init.body);assert.deepEqual(JSON.parse(sent.input[0].content),input);assert.equal(sent.max_output_tokens,4096);assert.equal(sent.store,false);assert.ok(!sent.tools);assert.ok(request.init.signal);
});


test('429 is a recoverable limit with no automatic provider retries or raw error disclosure',async()=>{
 let calls=0;await assert.rejects(generateSentenceFeedback('test-secret',input,async()=>{calls++;return new Response('secret upstream body',{status:429})}),e=>e.status===429&&!e.message.includes('secret'));
 assert.equal(calls,1);
});
test('bad credentials and unavailable providers return safe Korean errors',async()=>{
 for(const status of [400,401,403,404,500,503])await assert.rejects(generateSentenceFeedback('test-secret',input,async()=>new Response('sensitive',{status})),e=>e.status===503&&!e.message.includes('sensitive'));
 await assert.rejects(generateSentenceFeedback('test-secret',input,async()=>{throw new Error('network credentials')}),e=>e.status===503&&!e.message.includes('credentials'));
});
test('blocked, truncated, malformed and out-of-schema OpenAI replies cannot become feedback',async()=>{
 for(const body of [{},{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},{status:'completed',model:'gpt-6.1-sol',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'PRIVATE'}]}]}])await assert.rejects(generateSentenceFeedback('key',input,async()=>Response.json(body)),e=>e.status===502);
 await assert.rejects(generateSentenceFeedback('key',input,async()=>wrap({...content,grammar:'pass'})),e=>e.status===502);
});

const sqlite=new DatabaseSync(':memory:');
for(const path of ['drizzle/0000_worthless_doctor_faustus.sql','drizzle/0001_ai_daily_usage.sql','drizzle/0003_bright_zarda.sql'])sqlite.exec(readFileSync(path,'utf8'));
const db={prepare(sql){return {bind(...args){return {sql,args,async first(){return sqlite.prepare(sql).get(...args)??null}}}}},async batch(statements){return statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.args)}))}};
globalThis.testRuntime={env:{google_api:'test-secret',google_ai_enabled:'true',OPENAI_API_KEY:'test-secret',OPENAI_ALLOWED_MODELS:'gpt-6.1-sol',ai_feedback_enabled:'true'},user:{userId:'owner',email:'owner@example.test'},db};
const route=await import('../work/feedback-tests/route.mjs');
const words=JSON.parse(readFileSync('data/words.json','utf8'));const word=words.find(w=>w.word==='arrive'&&w.pos==='v.');
const sid=crypto.randomUUID();
const record={meaning:input.meaning,familiarity:'known',en:'independent',ko:'help',sentenceStatus:'unmeasured',sentence:'',notes:''};
const session={id:sid,kind:'daily',date:'2026-09-21',period:'2026-09-21',ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:record},retry:[],retryMode:false,elapsed:10,finished:false,paused:false,createdAt:new Date().toISOString()};
const insertSession=s=>sqlite.prepare('INSERT OR REPLACE INTO study_sessions VALUES (?,?,?)').run('owner',sid,JSON.stringify(s));insertSession(session);
for(const user of ['owner','other'])sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user,JSON.stringify({level:'A1',dailyGoal:3,assessments:{},activeSessionId:null}),'initial');
const body={sessionId:sid,entryId:word.id,sentence:input.sentence,expectedModelId:'gpt-6.1-sol'};
const req=(data=body,headers={})=>new Request('https://study.example/api/sentence-feedback',{method:'POST',headers:{'content-type':'application/json','origin':'https://study.example','X-Study-AI-Contract':'2',...headers},body:JSON.stringify(data)});
let calls=0;globalThis.fetch=async()=>{calls++;return success()};
test('route requires authentication and rejects cross-origin requests',async()=>{
 testRuntime.user=null;assert.equal((await route.GET()).status,401);assert.equal((await route.POST(req())).status,401);testRuntime.user={userId:'owner'};
 assert.equal((await route.POST(req(body,{origin:'https://other.example'}))).status,403);
 assert.equal((await route.POST(req(body,{'sec-fetch-site':'cross-site'}))).status,403);assert.equal(calls,0);
});
test('configuration endpoint exposes availability, never the secret; disabled mode blocks provider calls',async()=>{
 const response=await route.GET(new Request('https://study.example/api/sentence-feedback',{headers:{'X-Study-AI-Contract':'2'}}));const text=await response.text();assert.ok(!text.includes('test-secret'));assert.equal(JSON.parse(text).available,true);assert.equal(Object.hasOwn(JSON.parse(text),'dailyLimit'),false);
 testRuntime.env.ai_feedback_enabled='false';assert.equal((await route.POST(req())).status,503);assert.equal(calls,0);testRuntime.env.ai_feedback_enabled='true';
});
test('empty, oversized, and injected request parameters fail before provider access',async()=>{
 for(const data of [{...body,sentence:''},{...body,sentence:'x'.repeat(2001)},{...body,model:'other'},{...body,sessionId:'not-a-session'}])assert.equal((await route.POST(req(data))).status,400);
 assert.equal((await route.POST(req({...body,sentence:'x'.repeat(13000)}))).status,413);assert.equal(calls,0);
});
test('another user cannot request feedback for an owned session; recall stage cannot expose corrections',async()=>{
 testRuntime.user={userId:'other'};assert.equal((await route.POST(req())).status,404);testRuntime.user={userId:'owner'};
 insertSession({...session,stage:'ko'});assert.equal((await route.POST(req())).status,409);insertSession(session);assert.equal(calls,0);
});
test('valid feedback records usage without an artificial balance or cooldown and preserves learning records',async()=>{
 const response=await route.POST(req());assert.equal(response.status,200);const data=await response.json();assert.equal(Object.hasOwn(data,'remaining'),false);assert.equal(data.feedback.original,input.sentence);assert.equal(calls,1);
 assert.deepEqual(JSON.parse(sqlite.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?').get('owner',sid).document),session);
 assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:{...session,records:{[word.id]:{...record,aiFeedback:data.feedback}}}}}).success,true);
 assert.equal((await route.POST(req())).status,200);assert.equal(calls,2);
 assert.equal(sqlite.prepare('SELECT request_count FROM ai_daily_usage WHERE user_id=?').get('owner').request_count,2);
});
test('usage counters allow more than 30 immediate attempts and keep days and users separate',async()=>{
 const count=async(user,day,now)=>{await recordFeedbackAttempt(db,user,day,now);return sqlite.prepare('SELECT request_count FROM ai_daily_usage WHERE user_id=? AND day=?').get(user,day)};
 for(let i=0;i<65;i++)assert.equal((await count('usage','2026-09-21',1000)).request_count,i+1);
 assert.equal((await count('usage','2026-09-22',1000)).request_count,1);assert.equal((await count('different','2026-09-21',1000)).request_count,1);
 assert.equal((await count('different','2026-09-21',1000)).request_count,2);
});
test('existing30-use accounts reach OpenAI without cooldown and retry only on a new explicit action',async()=>{
 sqlite.prepare('UPDATE ai_daily_usage SET request_count=30,last_request_at=? WHERE user_id=?').run(Date.now(),'owner');const originalFetch=globalThis.fetch;let providerCalls=0;globalThis.fetch=async()=>{providerCalls++;return providerCalls===1?new Response('PRIVATE',{status:429}):success()};
 try{const limited=await route.POST(req());assert.equal(limited.status,429);const error=await limited.json();assert.equal(error.code,'provider_limit');assert.equal(error.previous,undefined);assert.doesNotMatch(error.error,/PRIVATE|30회|10초|내일/);assert.equal(providerCalls,1);assert.equal((await route.POST(req())).status,200);assert.equal(providerCalls,2);assert.equal(sqlite.prepare('SELECT request_count FROM ai_daily_usage WHERE user_id=?').get('owner').request_count,32);assert.deepEqual(JSON.parse(sqlite.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?').get('owner',sid).document),session);}finally{globalThis.fetch=originalFetch}
});
test('sense targets resolve the owned entry and send the recorded sense to the provider',async()=>{
 const target='target_'+crypto.randomUUID();const r={...record,entryId:word.id,meaning:'목적지에 도착하다'};
 const s={...session,kind:'monthly',period:'2026-09',ids:[target],records:{[target]:r}};
 assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:s}}).success,true);
 assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:{...s,records:{[target]:record}}}}).success,false);
 insertSession(s);sqlite.exec('DELETE FROM ai_daily_usage');let sent;
 globalThis.fetch=async(url,init)=>{sent=JSON.parse(JSON.parse(init.body).input[0].content);return success()};
 assert.equal((await route.POST(req({...body,entryId:target}))).status,200);assert.equal(sent.word,'arrive');assert.equal(sent.meaning,r.meaning);
});

test('personal word lookup stays account-scoped and never substitutes another learner definition',async()=>{
 const id='personal_'+crypto.randomUUID(),personal={id,word:'commute',headword:'commute',pos:'v.',level:'A1',page:0,personal:true};
 const s={...session,ids:[id],records:{[id]:{...record,entryId:id,meaning:'통근하다'}}};
 insertSession(s);
 sqlite.prepare('INSERT INTO word_progress VALUES (?,?,?)').run('other',id,JSON.stringify({personal}));
 let sent,count=0;
 globalThis.fetch=async(url,init)=>{count++;sent=JSON.parse(JSON.parse(init.body).input[0].content);return success()};
 const ownRequest=()=>req({...body,entryId:id,sentence:'I commute by bus.'});
 assert.equal((await route.POST(ownRequest())).status,400);assert.equal(count,0);
 sqlite.prepare('INSERT INTO word_progress VALUES (?,?,?)').run('owner',id,JSON.stringify({personal}));
 assert.equal((await route.POST(ownRequest())).status,200);assert.equal(count,1);
 assert.deepEqual(sent,{word:'commute',pos:'v.',meaning:'통근하다',sentence:'I commute by bus.'});
});

test('sentence route returns safe OpenAI failures, bounded retry evidence and configuration states',async t=>{
 insertSession(session);testRuntime.user={userId:'owner'};const logs=[];t.mock.method(console,'error',v=>logs.push(v));t.mock.method(globalThis,'fetch',async()=>Response.json({error:{message:'PRIVATE_KEY_SENTENCE'}},{status:429,headers:{'retry-after':'12'}}));
 const result=await route.POST(req()),data=await result.json();assert.equal(result.status,429);assert.equal(data.code,'provider_limit');assert.equal(data.providerStatus,429);assert.equal(data.retryAfterSeconds,12);assert.equal(data.previous,undefined);assert.doesNotMatch(JSON.stringify(data)+logs.join(''),/PRIVATE|test-secret|I arrive/);
 testRuntime.env.OPENAI_API_KEY='';assert.equal((await(await route.POST(req())).json()).code,'not_configured');testRuntime.env.OPENAI_API_KEY='test-secret';testRuntime.env.ai_feedback_enabled='false';assert.equal((await(await route.POST(req())).json()).code,'disabled');testRuntime.env.ai_feedback_enabled='true';
});

test('sentence route uses one OpenAI request even with legacy credentials restored',async t=>{
 insertSession(session);testRuntime.user={userId:'owner'};testRuntime.env.groq_api='synthetic-groq';const logs=[];t.mock.method(console,'info',v=>logs.push(v));t.mock.method(console,'error',v=>logs.push(v));let calls=0;t.mock.method(globalThis,'fetch',async(url)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');return success()});const response=await route.POST(req()),data=await response.json();assert.equal(response.status,200);assert.equal(calls,1);assert.equal(data.feedback.model,'gpt-6.1-sol');assert.equal(data.feedback.provider,'openai');assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:{...session,records:{[word.id]:{...record,aiFeedback:data.feedback}}}}}).success,true);assert.deepEqual(JSON.parse(sqlite.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?').get('owner',sid).document),session);
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('PRIVATE',{status:429,headers:{'retry-after':'7'}})});const failed=await(await route.POST(req())).json();assert.equal(failed.code,'provider_limit');assert.equal(failed.previous,undefined);assert.equal(calls,2);assert.doesNotMatch(logs.join('')+JSON.stringify(failed),/PRIVATE|synthetic-groq|I arrive/);delete testRuntime.env.groq_api;
});

test('sentence structure is negotiated at the HTTP boundary; legacy feedback shape stays readable',async()=>{
 insertSession(session);testRuntime.user={userId:'owner'};testRuntime.env.ai_feedback_enabled='true';
 const originalFetch=globalThis.fetch;
 const structure={status:'available',translation:'나는 어제 집에 도착했어요.',parts:[
  {text:'I',role:'S',explanation:'도착한 사람'}, {text:'arrived',role:'V',explanation:'과거의 동작'},
  {text:'home yesterday.',role:'M',explanation:'장소와 시간'},
 ],note:''};
 globalThis.fetch=async()=>wrap({...content,structure});
 try{
  const legacy=await (await route.POST(req())).json();assert.equal(Object.hasOwn(legacy.feedback,'structure'),false);
  const modern=await (await route.POST(req(body,{'X-Study-Feedback-Structure':'1'}))).json();assert.deepEqual(modern.feedback.structure,structure);
  assert.deepEqual(JSON.parse(sqlite.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?').get('owner',sid).document),session);
 }finally{globalThis.fetch=originalFetch}
});
