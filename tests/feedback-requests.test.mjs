import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {FEEDBACK_RESPONSE_TTL,FEEDBACK_RECEIPT_TTL,FEEDBACK_PENDING_WINDOW} from '../lib/feedback-receipt.ts';
mkdirSync('work/feedback-request-tests',{recursive:true});
await build({entryPoints:['db/feedback-requests.ts','db/feedback.ts','app/api/feedback-requests/[id]/route.ts','app/api/sentence-feedback/route.ts','app/api/grammar-feedback/route.ts'],outdir:'work/feedback-request-tests',outbase:'.',bundle:true,format:'esm',platform:'node',logLevel:'silent',outExtension:{'.js':'.mjs'},plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},a=>({path:a.path,namespace:'receipt-env'}));
 b.onLoad({filter:/.*/,namespace:'receipt-env'},()=>({loader:'js',contents:'export const env=globalThis.receiptRuntime.env'}));
 b.onResolve({filter:/^@\/(app\/chatgpt-auth|db\/store)$/},a=>({path:a.path,namespace:'receipt-boundary'}));
 b.onLoad({filter:/.*/,namespace:'receipt-boundary'},a=>({loader:'js',contents:a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>globalThis.receiptRuntime.user':'export const database=()=>globalThis.receiptRuntime.db'}));
}}]});
const {withFeedbackRequest,getFeedbackRequest}=await import('../work/feedback-request-tests/db/feedback-requests.mjs');
const {recordFeedbackAttempt}=await import('../work/feedback-request-tests/db/feedback.mjs');
const route=await import('../work/feedback-request-tests/app/api/feedback-requests/[id]/route.mjs');
const receiptEnv={};globalThis.receiptRuntime={env:receiptEnv};
const wordRoute=await import('../work/feedback-request-tests/app/api/sentence-feedback/route.mjs'),grammarRoute=await import('../work/feedback-request-tests/app/api/grammar-feedback/route.mjs');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of ['0000_worthless_doctor_faustus','0001_ai_daily_usage','0002_old_golden_guardian','0003_bright_zarda','0006_feedback_request_receipts'])sqlite.exec(readFileSync(`drizzle/${file}.sql`,'utf8'));
let fail=null;
function statement(sql,args=[]){return {sql,args,bind(...values){return statement(sql,values);},async first(){if(fail?.test(sql))throw Error('private injected storage error');return sqlite.prepare(sql).get(...args)??null;},async all(){if(fail?.test(sql))throw Error('private injected storage error');return {results:sqlite.prepare(sql).all(...args)};},async run(){if(fail?.test(sql))throw Error('private injected storage error');return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}
const db={prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(/^SELECT/.test(s.sql)?await s.all():await s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
const now=Date.now(),scope={domain:'word',targetId:'session',revision:0,fingerprint:['synthetic sentence','gpt-6.1-sol','reference-v2']};
const input=()=>({requestId:crypto.randomUUID(),requestStartedAt:now});
const answer=()=>Response.json({feedback:{original:'Synthetic input.',correctedSentence:'Synthetic input.',explanation:'합성 설명'}});
beforeEach(()=>{fail=null;sqlite.exec('DELETE FROM feedback_requests; DELETE FROM study_sessions; DELETE FROM grammar_progress; DELETE FROM learner_states; DELETE FROM ai_daily_usage;');for(const user of ['owner','other'])sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user,'{}','initial');Object.assign(receiptEnv,{ai_feedback_enabled:'true',grammar_enabled:'true',feedback_judgment_enabled:'true',OPENAI_ALLOWED_MODELS:'gpt-6.1-sol',OPENAI_API_KEY:'SYNTHETIC_NEVER_REAL'});globalThis.receiptRuntime={db,user:{userId:'owner'},env:receiptEnv};});
after(()=>{sqlite.close();delete globalThis.receiptRuntime;});

test('concurrent duplicate POSTs and later status retrieval execute the provider callback exactly once',async()=>{
 const req=input();let calls=0,finish;
 const running=withFeedbackRequest(db,'owner',req,scope,async()=>{calls++;await new Promise(resolve=>{finish=resolve;});return answer();},now);
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 const pending=await withFeedbackRequest(db,'owner',req,scope,async()=>{calls++;return answer();},now);
 assert.equal(pending.status,202);assert.equal((await pending.json()).receipt.state,'pending');assert.equal(calls,1);
 finish();const completed=await running;assert.equal(completed.status,200);assert.equal((await completed.json()).receipt.persisted,true);
 const replay=await withFeedbackRequest(db,'owner',req,scope,async()=>{calls++;return answer();},now);
 assert.equal(replay.status,200);assert.equal((await replay.json()).feedback.original,'Synthetic input.');assert.equal(calls,1);
 const result=await getFeedbackRequest(db,'owner',req.requestId,now);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal((await result.json()).receipt.state,'completed');
});
test('same UUID cannot be rebound to different input, target, model, profile, timestamp or domain',async()=>{
 const req=input();await withFeedbackRequest(db,'owner',req,scope,async()=>answer(),now);let calls=0;
 for(const [request,changed] of [[req,{...scope,fingerprint:['changed']}],[req,{...scope,targetId:'other'}],[req,{...scope,domain:'grammar'}],[{...req,requestStartedAt:now+1},scope]]){
  const result=await withFeedbackRequest(db,'owner',request,changed,async()=>{calls++;return answer();},now);assert.equal(result.status,409);assert.equal((await result.json()).code,'receipt_conflict');
 }assert.equal(calls,0);
});
test('requests and recovery are owner scoped, including route auth and malformed IDs',async()=>{
 const req=input();await withFeedbackRequest(db,'owner',req,scope,async()=>answer(),now);
 assert.equal((await getFeedbackRequest(db,'other',req.requestId,now)).status,404);
 globalThis.receiptRuntime.user={userId:'other'};
 assert.equal((await route.GET(new Request('https://study.example/api/feedback-requests/'+req.requestId),{params:Promise.resolve({id:req.requestId})})).status,404);
 globalThis.receiptRuntime.user=null;assert.equal((await route.GET(new Request('https://study.example'),{params:Promise.resolve({id:req.requestId})})).status,401);
 globalThis.receiptRuntime.user={userId:'owner'};assert.equal((await route.GET(new Request('https://study.example'),{params:Promise.resolve({id:'bad'})})).status,400);
});
test('claim, cleanup and revision failures occur before a provider attempt',async()=>{
 let calls=0;const run=async()=>{calls++;return answer();};
 for(const pattern of [/INSERT INTO feedback_requests/,/UPDATE feedback_requests SET response=NULL/]){fail=pattern;await assert.rejects(withFeedbackRequest(db,'owner',input(),scope,run,now));}
 fail=null;sqlite.prepare('UPDATE learner_states SET revision=1 WHERE user_id=?').run('owner');
 assert.equal((await withFeedbackRequest(db,'owner',input(),scope,run,now)).status,409);assert.equal(calls,0);
});
test('failed attempts and old pending attempts never take over or automatically resend',async()=>{
 let calls=0;const req=input(),run=async()=>{calls++;throw Error('private provider body');};
 assert.equal((await withFeedbackRequest(db,'owner',req,scope,run,now)).status,503);
 assert.equal((await withFeedbackRequest(db,'owner',req,scope,run,now)).status,503);assert.equal(calls,1);
 const second=input();sqlite.prepare("INSERT INTO feedback_requests VALUES(?,?,?,?,?,'pending',?,?,?,NULL,NULL)").run('owner',second.requestId,'hash','word','session',now,now+FEEDBACK_RECEIPT_TTL,now+FEEDBACK_RESPONSE_TTL);
 const unknown=await getFeedbackRequest(db,'owner',second.requestId,now+FEEDBACK_PENDING_WINDOW+1);assert.equal(unknown.status,409);assert.equal((await unknown.json()).receipt.state,'unknown');
});
test('body TTL and tombstone TTL expire separately; expired IDs with original timestamps cannot be rerun',async()=>{
 const req=input();await withFeedbackRequest(db,'owner',req,scope,async()=>answer(),now);
 assert.equal((await getFeedbackRequest(db,'owner',req.requestId,now+FEEDBACK_RESPONSE_TTL)).status,410);
 assert.equal(sqlite.prepare('SELECT response FROM feedback_requests WHERE request_id=?').get(req.requestId).response,null);
 assert.equal((await withFeedbackRequest(db,'owner',req,scope,async()=>{throw Error('must not run');},now+FEEDBACK_RESPONSE_TTL)).status,410);
 assert.equal((await withFeedbackRequest(db,'owner',req,scope,async()=>{throw Error('must not run');},now+FEEDBACK_RECEIPT_TTL)).status,410);
 await getFeedbackRequest(db,'owner',req.requestId,now+FEEDBACK_RECEIPT_TTL);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM feedback_requests').get().n,0);
});
test('completion storage failure is explicit and leaves a non-rerunnable pending claim',async()=>{
 const req=input();let calls=0;fail=/UPDATE feedback_requests SET status=/;
 const result=await withFeedbackRequest(db,'owner',req,scope,async()=>{calls++;return answer();},now);
 assert.equal(result.status,200);assert.equal((await result.json()).receipt.persisted,false);fail=null;
 assert.equal((await withFeedbackRequest(db,'owner',req,scope,async()=>{calls++;return answer();},now)).status,202);assert.equal(calls,1);
});
test('target deletion invalidates completed and in-flight results atomically; rollback restores receipts',async()=>{
 for(const [domain,table,key] of [['word','study_sessions','session_id'],['grammar','grammar_progress','lesson_id']]){
  sqlite.prepare(`INSERT INTO ${table}(user_id,${key},document) VALUES(?,?,?)`).run('owner','session','{}');
  const req=input(),sc={...scope,domain};await withFeedbackRequest(db,'owner',req,sc,async()=>answer(),now);
  sqlite.exec('BEGIN');sqlite.prepare(`DELETE FROM ${table} WHERE user_id=?`).run('owner');
  assert.equal(sqlite.prepare('SELECT status FROM feedback_requests WHERE request_id=?').get(req.requestId).status,'invalidated');sqlite.exec('ROLLBACK');
  assert.equal((await getFeedbackRequest(db,'owner',req.requestId,now)).status,200);
  const req2=input();const completion=await withFeedbackRequest(db,'owner',req2,sc,async()=>{sqlite.prepare(`DELETE FROM ${table} WHERE user_id=?`).run('owner');return answer();},now);
  assert.equal(completion.status,409);assert.equal((await getFeedbackRequest(db,'owner',req.requestId,now)).status,409);
 }
});
test('profile deletion cascades receipts and operational counter errors do not block generation',async()=>{
 const req=input();fail=/INSERT INTO ai_daily_usage/;await recordFeedbackAttempt(db,'owner','2026-11-03',now);fail=null;
 assert.equal((await withFeedbackRequest(db,'owner',req,scope,async()=>answer(),now)).status,200);
 sqlite.prepare('DELETE FROM learner_states WHERE user_id=?').run('owner');assert.equal(sqlite.prepare('SELECT count(*) AS n FROM feedback_requests').get().n,0);
});

test('actual word and grammar routes claim once, ignore counter failures, and recover with AI disabled',async t=>{
 const word=JSON.parse(readFileSync('data/words.json','utf8')).find(w=>w.word==='arrive'&&w.pos==='v.');
 const sessionId=crypto.randomUUID(),sentence='She arrives home.',answer={first:'a',latest:'a',attempts:1,helped:false};
 sqlite.prepare('INSERT INTO study_sessions VALUES(?,?,?)').run('owner',sessionId,JSON.stringify({id:sessionId,ids:[word.id],stage:'sentence',index:0,retryMode:false,records:{[word.id]:{meaning:'도착하다'}}}));
 sqlite.prepare('INSERT INTO grammar_progress VALUES(?,?,?)').run('owner','auxiliary',JSON.stringify({stage:5,sentence,answers:{q1:answer,q2:answer,q3:answer},updatedAt:new Date().toISOString()}));
 let calls=0;t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');calls++;const sent=JSON.parse(init.body);
  return Response.json({status:'completed',model:sent.model,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({meaningUsage:'appropriate',grammar:'natural',correctedSentence:sentence,targetReason:'합성 목표 설명',grammarReason:'합성 문법 설명',correctionReason:'',contextNeeded:'none'})}]}]});
 });
 fail=/INSERT INTO ai_daily_usage/;
 for(const [domain,api] of [['word',wordRoute],['grammar',grammarRoute]]){
  const meta=input(),body={...meta,sentence,expectedModelId:'gpt-6.1-sol',...(domain==='word'?{sessionId,entryId:word.id}:{lessonId:'auxiliary'})};
  const req=()=>new Request('https://study.example/api/'+domain,{method:'POST',headers:{Origin:'https://study.example','Content-Type':'application/json','X-Study-AI-Contract':'4','X-Study-Feedback-Structure':'1','X-Study-Grammar':'4'},body:JSON.stringify(body)});
  const response=await api.POST(req());assert.equal(response.status,200);const first=await response.json();assert.equal(first.receipt.persisted,true);
  const replay=await api.POST(req());assert.equal(replay.status,200);assert.deepEqual(await replay.json(),first);
  globalThis.receiptRuntime.env.ai_feedback_enabled='false';
  assert.equal((await route.GET(new Request('https://study.example/api/feedback-requests/'+meta.requestId,{headers:{'X-Study-AI-Contract':'4'}}),{params:Promise.resolve({id:meta.requestId})})).status,200);
  globalThis.receiptRuntime.env.ai_feedback_enabled='true';
 }assert.equal(calls,2);
});
