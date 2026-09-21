import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

mkdirSync('work/feedback-tests',{recursive:true});
await build({entryPoints:['lib/gemini-feedback.ts','lib/validation.ts'],outdir:'work/feedback-tests',bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
await build({entryPoints:['app/api/sentence-feedback/route.ts'],outfile:'work/feedback-tests/route.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent',plugins:[{
 name:'test-server-boundaries',setup(b){
  b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/store)$/},a=>({path:a.path,namespace:'test-boundaries'}));
  b.onLoad({filter:/.*/,namespace:'test-boundaries'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.testRuntime.env':a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>globalThis.testRuntime.user':'export const database=()=>globalThis.testRuntime.db',loader:'js'}));
 }
}]});
const {generateSentenceFeedback,FEEDBACK_QUOTA_SQL}=await import('../work/feedback-tests/gemini-feedback.mjs');
const {saveSchema}=await import('../work/feedback-tests/validation.mjs');
const input={word:'arrive',pos:'v.',meaning:'도착하다',sentence:'I arrive home yesterday.'};
const content={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence:'I arrived home yesterday.',explanation:'어제 일어난 일이므로 arrive를 arrived로 바꿔요.'};
const success=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(content)}]}}]});

test('server calls only the fixed model and separates meaning from grammar without sending account data',async()=>{
 let request;
 const feedback=await generateSentenceFeedback('test-secret',input,async(url,init)=>{request={url,init};return success()});
 assert.equal(feedback.original,input.sentence);assert.equal(feedback.meaningUsage,'appropriate');assert.equal(feedback.grammar,'needs_work');
 assert.match(request.url,/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.1-flash-lite:generateContent$/);
 assert.ok(!request.url.includes('test-secret'));assert.equal(request.init.headers['x-goog-api-key'],'test-secret');
 const sent=JSON.parse(request.init.body);assert.deepEqual(JSON.parse(sent.contents[0].parts[0].text),input);assert.equal(sent.generationConfig.maxOutputTokens,1536);assert.ok(!sent.tools);assert.ok(request.init.signal);
});
test('429 is a recoverable limit with no automatic provider retries or raw error disclosure',async()=>{
 let calls=0;await assert.rejects(generateSentenceFeedback('test-secret',input,async()=>{calls++;return new Response('secret upstream body',{status:429})}),e=>e.status===429&&!e.message.includes('secret'));
 assert.equal(calls,1);
});
test('bad credentials and unavailable providers return safe Korean errors',async()=>{
 for(const status of [400,401,403,404,500,503])await assert.rejects(generateSentenceFeedback('test-secret',input,async()=>new Response('sensitive',{status})),e=>e.status===503&&!e.message.includes('sensitive'));
 await assert.rejects(generateSentenceFeedback('test-secret',input,async()=>{throw new Error('network credentials')}),e=>e.status===503&&!e.message.includes('credentials'));
});
test('blocked, truncated, malformed, and out-of-schema responses cannot become feedback',async()=>{
 for(const body of [{},{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(content)}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'invalid'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...content,grammar:'pass'})}]}}]}])await assert.rejects(generateSentenceFeedback('key',input,async()=>Response.json(body)),e=>e.status===502);
});

const sqlite=new DatabaseSync(':memory:');
for(const path of ['drizzle/0000_worthless_doctor_faustus.sql','drizzle/0001_ai_daily_usage.sql'])sqlite.exec(readFileSync(path,'utf8'));
const db={prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)??null}}}}}};
globalThis.testRuntime={env:{google_api:'test-secret',google_ai_enabled:'true'},user:{userId:'owner',email:'owner@example.test'},db};
const route=await import('../work/feedback-tests/route.mjs');
const words=JSON.parse(readFileSync('data/words.json','utf8'));const word=words.find(w=>w.word==='arrive'&&w.pos==='v.');
const sid=crypto.randomUUID();
const record={meaning:input.meaning,familiarity:'known',en:'independent',ko:'help',sentenceStatus:'unmeasured',sentence:'',notes:''};
const session={id:sid,kind:'daily',date:'2026-09-21',period:'2026-09-21',ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:record},retry:[],retryMode:false,elapsed:10,finished:false,paused:false,createdAt:new Date().toISOString()};
const insertSession=s=>sqlite.prepare('INSERT OR REPLACE INTO study_sessions VALUES (?,?,?)').run('owner',sid,JSON.stringify(s));insertSession(session);
const body={sessionId:sid,entryId:word.id,sentence:input.sentence};
const req=(data=body,headers={})=>new Request('https://study.example/api/sentence-feedback',{method:'POST',headers:{'content-type':'application/json','origin':'https://study.example',...headers},body:JSON.stringify(data)});
let calls=0;globalThis.fetch=async()=>{calls++;return success()};
test('route requires authentication and rejects cross-origin requests',async()=>{
 testRuntime.user=null;assert.equal((await route.GET()).status,401);assert.equal((await route.POST(req())).status,401);testRuntime.user={userId:'owner'};
 assert.equal((await route.POST(req(body,{origin:'https://other.example'}))).status,403);
 assert.equal((await route.POST(req(body,{'sec-fetch-site':'cross-site'}))).status,403);assert.equal(calls,0);
});
test('configuration endpoint exposes availability, never the secret; disabled mode blocks provider calls',async()=>{
 const response=await route.GET();const text=await response.text();assert.ok(!text.includes('test-secret'));assert.equal(JSON.parse(text).available,true);
 testRuntime.env.google_ai_enabled='false';assert.equal((await route.POST(req())).status,503);assert.equal(calls,0);testRuntime.env.google_ai_enabled='true';
});
test('empty, oversized, and injected request parameters fail before provider access',async()=>{
 for(const data of [{...body,sentence:''},{...body,sentence:'x'.repeat(2001)},{...body,model:'other'},{...body,sessionId:'not-a-session'}])assert.equal((await route.POST(req(data))).status,400);
 assert.equal((await route.POST(req({...body,sentence:'x'.repeat(13000)}))).status,413);assert.equal(calls,0);
});
test('another user cannot request feedback for an owned session; recall stage cannot expose corrections',async()=>{
 testRuntime.user={userId:'other'};assert.equal((await route.POST(req())).status,404);testRuntime.user={userId:'owner'};
 insertSession({...session,stage:'ko'});assert.equal((await route.POST(req())).status,409);insertSession(session);assert.equal(calls,0);
});
test('valid feedback consumes one durable reservation without changing proficiency or session records',async()=>{
 const response=await route.POST(req());assert.equal(response.status,200);const data=await response.json();assert.equal(data.remaining,29);assert.equal(data.feedback.original,input.sentence);assert.equal(calls,1);
 assert.deepEqual(JSON.parse(sqlite.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?').get('owner',sid).document),session);
 assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:{...session,records:{[word.id]:{...record,aiFeedback:data.feedback}}}}}).success,true);
 assert.equal((await route.POST(req())).status,429);assert.equal(calls,1);
});
test('daily quota rejects concurrent-style extra reservations, resets by day, and separates users',()=>{
 const reserve=(user,day,now)=>sqlite.prepare(FEEDBACK_QUOTA_SQL).get(user,day,now,30,now-10000);
 for(let i=0;i<30;i++)assert.equal(reserve('quota','2026-09-21',i*10001).request_count,i+1);
 assert.equal(reserve('quota','2026-09-21',500000),undefined);assert.equal(reserve('quota','2026-09-22',500000).request_count,1);assert.equal(reserve('different','2026-09-21',500000).request_count,1);
 assert.equal(reserve('different','2026-09-21',500000),undefined);
});
test('sense targets resolve the owned entry and send the recorded sense to the provider',async()=>{
 const target='target_'+crypto.randomUUID();const r={...record,entryId:word.id,meaning:'목적지에 도착하다'};
 const s={...session,kind:'monthly',period:'2026-09',ids:[target],records:{[target]:r}};
 assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:s}}).success,true);
 assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:{[sid]:{...s,records:{[target]:record}}}}).success,false);
 insertSession(s);sqlite.exec('DELETE FROM ai_daily_usage');let sent;
 globalThis.fetch=async(url,init)=>{sent=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);return success()};
 assert.equal((await route.POST(req({...body,entryId:target}))).status,200);assert.equal(sent.word,'arrive');assert.equal(sent.meaning,r.meaning);
});
