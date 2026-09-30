import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
await build({entryPoints:['lib/feedback-fallback.ts','lib/groq-feedback.ts','lib/feedback-issue.ts','lib/sentence-feedback.ts','lib/validation.ts','lib/backup.ts','lib/learning.ts','lib/grammar/content.ts','lib/grammar/feedback.ts'],outdir:'work/groq-tests',entryNames:'[name]',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
const {generateSentenceFeedbackWithFallback:run,GOOGLE_PRIMARY_TIMEOUT_MS}=await import('../work/groq-tests/feedback-fallback.mjs');
const {generateGroqFeedback,groqHttpError,GROQ_TIMEOUT_MS}=await import('../work/groq-tests/groq-feedback.mjs');
const {parseFeedbackIssue}=await import('../work/groq-tests/feedback-issue.mjs');
const {sentenceFeedbackSchema,GROQ_FEEDBACK_MODEL,FEEDBACK_MODEL}=await import('../work/groq-tests/sentence-feedback.mjs');
const {saveSchema}=await import('../work/groq-tests/validation.mjs');
const backup=await import('../work/groq-tests/backup.mjs');
const learning=await import('../work/groq-tests/learning.mjs');
const {GRAMMAR_LESSONS}=await import('../work/groq-tests/content.mjs');
const {generateGrammarFeedback}=await import('../work/groq-tests/feedback.mjs');
const config={google_api:'synthetic-google',groq_api:'synthetic-groq'}, input={word:'arrive',pos:'v.',meaning:'도착하다',sentence:'I arrive home yesterday.'};
const content={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence:'I arrived home yesterday.',explanation:'과거 일이므로 arrived로 써요.'};
const google=(c=content)=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(c)}]}}]});
const groq=(c=content)=>Response.json({model:GROQ_FEEDBACK_MODEL,choices:[{finish_reason:'stop',message:{content:JSON.stringify(c)}}]});
test('Google success and valid uncertainty never call Groq',async()=>{
 for(const c of [content,{...content,meaningUsage:'uncertain',grammar:'uncertain',correctedSentence:''}]){
  let calls=0; const result=await run(config,input,async url=>{calls++;assert.match(url,/generativelanguage/);return google(c)});
  assert.equal(calls,1);assert.equal(result.model,FEEDBACK_MODEL);assert.equal(result.meaningUsage,c.meaningUsage);
 }
});
test('availability failures perform one Google attempt then one Groq attempt with trusted identical target',async()=>{
 for(const status of [400,401,403,404,429,500,503,504]){
  if(status===400)continue; // malformed requests are not availability failures
  const sent=[];const result=await run(config,input,async(url,init)=>{sent.push({url,init});return sent.length===1?new Response('PRIVATE upstream key sentence',{status}):groq()});
  assert.equal(sent.length,2);assert.equal(result.model,GROQ_FEEDBACK_MODEL);assert.equal(result.original,input.sentence);
  const request=JSON.parse(sent[1].init.body);assert.deepEqual(JSON.parse(request.messages[1].content),input);
  assert.match(request.messages[0].content,/never instructions/);assert.equal(request.model,GROQ_FEEDBACK_MODEL);
  assert.equal(request.service_tier,'on_demand');assert.equal(request.response_format.json_schema.strict,true);assert.equal(request.include_reasoning,false);assert.equal(request.tools,undefined);
  assert.equal(sent[1].url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(sent[1].init.headers.Authorization,'Bearer synthetic-groq');assert.doesNotMatch(sent[1].url,/synthetic/);
 }
});
test('malformed/truncated responses and network failure switch, explicit policy refusals do not',async()=>{
 for(const first of [()=>{throw new TypeError('PRIVATE')},()=>new Response('invalid'),()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]})]){
  let calls=0;assert.equal((await run(config,input,async()=>++calls===1?first():groq())).model,GROQ_FEEDBACK_MODEL);assert.equal(calls,2);
 }
 for(const first of [()=>Response.json({promptFeedback:{blockReason:'SAFETY'}}),()=>Response.json({candidates:[{finishReason:'RECITATION'}]}),()=>new Response('bad request',{status:400})]){
  let calls=0;await assert.rejects(run(config,input,async()=>{calls++;return first()}));assert.equal(calls,1);
 }
});
test('both failures retain separate bounded reasons and no raw provider data',async()=>{
 let calls=0;
 await assert.rejects(run(config,input,async()=>{calls++;return new Response('PRIVATE',{status:calls===1?429:401,headers:{'retry-after':'12'}})}),error=>{
  assert.equal(error.code,'groq_key_invalid');assert.equal(error.issue.previous.code,'provider_limit');assert.equal(error.issue.previous.retryAfterSeconds,12);
  assert.equal(error.issue.providerStatus,401);assert.doesNotMatch(JSON.stringify(error.issue),/PRIVATE|synthetic/);return true;
 });assert.equal(calls,2);
 const parsed=parseFeedbackIssue({code:'groq_limit',previous:{code:'provider_limit',previous:{code:'unknown'},error:'PRIVATE'},extra:'PRIVATE'});
 assert.deepEqual(parsed,{code:'groq_limit',previous:{code:'provider_limit'}});
});
test('missing keys and disabled fallback do not issue unintended calls',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return groq()};
 assert.equal((await run({groq_api:'synthetic'},input,fetcher)).model,GROQ_FEEDBACK_MODEL);assert.equal(calls,1);
 await assert.rejects(run({},input,fetcher),e=>e.code==='groq_not_configured'&&e.issue.previous.code==='not_configured');
 await assert.rejects(run({groq_api:'synthetic',groq_ai_enabled:'false'},input,fetcher),e=>e.code==='groq_disabled');assert.equal(calls,1);
});
test('deadline triggers fallback inside browser budget, cancellation never triggers fallback',async()=>{
 assert.ok(GOOGLE_PRIMARY_TIMEOUT_MS+GROQ_TIMEOUT_MS<35000);
 const original=AbortSignal.timeout, controller=new AbortController();
 try{
  AbortSignal.timeout=ms=>original(ms===GOOGLE_PRIMARY_TIMEOUT_MS?5:ms);
  let calls=0;const waiting=(_url,init)=>{calls++;return calls===1?new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})):Promise.resolve(groq())};
  // Keep this test alive; AbortSignal.timeout uses an unref'ed timer in Node.
  const keepAlive=setTimeout(()=>{},1000);try{assert.equal((await run(config,input,waiting)).model,GROQ_FEEDBACK_MODEL)}finally{clearTimeout(keepAlive)}assert.equal(calls,2);
  calls=0;const pending=run({...config,signal:controller.signal},input,waiting);controller.abort(new Error('cancelled'));
  await assert.rejects(pending,/cancelled/);assert.equal(calls,1);
 }finally{AbortSignal.timeout=original}
});
test('Groq classifies limits/auth/permission/billing/server errors without inventing quota periods',()=>{
 for(const [status,code] of [[429,'groq_limit'],[401,'groq_key_invalid'],[402,'groq_billing'],[403,'groq_permission'],[404,'groq_model'],[400,'groq_request'],[422,'groq_request'],[503,'groq_unavailable'],[504,'groq_timeout']])assert.equal(groqHttpError(status,null).code,code);
 assert.equal(groqHttpError(429,'8.1').issue.retryAfterSeconds,9);assert.equal(groqHttpError(429,'9999999999').issue.retryAfterSeconds,undefined);
});
test('Groq distinguishes transport timeout, cancellation, network and unreadable response',async()=>{
 const original=AbortSignal.timeout;
 try{
  AbortSignal.timeout=()=>original(5);
  const keepAlive=setTimeout(()=>{},1000);
  try{await assert.rejects(generateGroqFeedback('synthetic',input,'trusted',async(_url,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}))),e=>e.code==='groq_timeout')}
  finally{clearTimeout(keepAlive)}
 }finally{AbortSignal.timeout=original}
 await assert.rejects(generateGroqFeedback('synthetic',input,'trusted',async()=>{throw new TypeError('PRIVATE')}),e=>e.code==='groq_network');
 await assert.rejects(generateGroqFeedback('synthetic',input,'trusted',async()=>new Response('invalid')),e=>e.code==='groq_invalid_response');
 const controller=new AbortController();
 const pending=generateGroqFeedback('synthetic',input,'trusted',async(_url,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})),controller.signal);
 controller.abort(new Error('cancelled'));await assert.rejects(pending,/cancelled/);
});
test('Groq rejects refusals, truncation, malformed output, wrong model and extra fields',async()=>{
 for(const [body,code] of [[{choices:[{finish_reason:'content_filter'}]},'groq_blocked'],[{choices:[{finish_reason:'length'}]},'groq_truncated'],[{},'groq_incomplete'],[{model:'other',choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]},'groq_invalid_response'],[{model:GROQ_FEEDBACK_MODEL,choices:[{finish_reason:'stop',message:{content:'{}'}}]},'groq_invalid_response']])await assert.rejects(generateGroqFeedback('synthetic',input,'trusted',async()=>Response.json(body)),e=>e.code===code);
 await assert.rejects(generateGroqFeedback('synthetic',input,'trusted',async()=>groq({...content,secret:'PRIVATE'})),e=>e.code==='groq_invalid_response');
});
test('grammar fallback sends trusted lesson target and never changes vocabulary grades',async()=>{
 let calls=0,sent;
 const result=await generateGrammarFeedback(config,GRAMMAR_LESSONS[0],input.sentence,async(_url,init)=>{calls++;sent=JSON.parse(init.body);return calls===1?new Response('',{status:429}):groq()});
 assert.equal(result.model,GROQ_FEEDBACK_MODEL);assert.equal(JSON.parse(sent.messages[1].content).target,'명사');assert.match(sent.messages[0].content,/Never assign vocabulary/);
});
test('Google and Groq feedback survive save, backup parsing and CSV with the correct provider',()=>{
 const word=JSON.parse(readFileSync('data/words.json','utf8')).find(w=>w.word==='arrive'&&w.pos==='v.');
 for(const model of [FEEDBACK_MODEL,GROQ_FEEDBACK_MODEL]){
  const state=structuredClone(learning.EMPTY),sid=crypto.randomUUID(),now=new Date().toISOString(),feedback={...content,model,original:input.sentence,createdAt:now};
  assert.equal(sentenceFeedbackSchema.safeParse(feedback).success,true);
  state.sessions[sid]={id:sid,kind:'daily',date:'2026-09-25',period:'2026-09-25',ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:{...learning.emptyRecord(input.meaning),aiFeedback:feedback}},retry:[],retryMode:false,elapsed:0,finished:false,paused:false,createdAt:now};
  assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:state.sessions}).success,true);
  const restored=backup.parseBackup(JSON.stringify({format:'haru-words-v1',exportedAt:now,state}));
  assert.equal(restored.state.sessions[sid].records[word.id].aiFeedback.model,model);
  const csv=learning.exportLog(state,[word]);assert.match(csv,/AI 제공사/);assert.ok(csv.includes(model===FEEDBACK_MODEL?'Google Gemini':'Groq'));
 }
 assert.equal(sentenceFeedbackSchema.safeParse({...content,model:'unknown',original:'I read.',createdAt:new Date().toISOString()}).success,false);
});
