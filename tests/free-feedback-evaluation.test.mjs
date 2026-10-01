import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateFreeComparison, collectFreeComparison } from '../scripts/evaluate-free-feedback.mjs';
import { originalComparisonFixture } from '../scripts/evaluate-original-feedback.mjs';

globalThis.freeEvalEnv={};
await build({entryPoints:{helper:'lib/free-feedback-evaluation.ts',wire:'lib/chunked-feedback.ts',route:'app/api/english-accuracy-evaluation/route.ts',production:'lib/feedback-fallback.ts',grammar:'lib/grammar/feedback.ts',content:'lib/grammar/content.ts',v3:'lib/grammar/content-v3.ts',errors:'lib/provider-feedback-error.ts'},outdir:'work/free-evaluation-tests',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent',plugins:[{name:'synthetic-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const env=globalThis.freeEvalEnv',loader:'js'}));}}]});
const helper=await import('../work/free-evaluation-tests/helper.mjs'),wire=await import('../work/free-evaluation-tests/wire.mjs'),route=await import('../work/free-evaluation-tests/route.mjs'),production=await import('../work/free-evaluation-tests/production.mjs'),grammar=await import('../work/free-evaluation-tests/grammar.mjs'),errors=await import('../work/free-evaluation-tests/errors.mjs');
const {LESSON_MAP}=await import('../work/free-evaluation-tests/content.mjs'),{lessonForVersion}=await import('../work/free-evaluation-tests/v3.mjs');
const {accuracyCases:cases,accuracyModels:models}=helper,comparison='chunked-free-v1',digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const published=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-01-original-first.json'));
const profiles={};for(const sample of cases)profiles[sample.id]={domain:sample.domain,...await helper.freeAccuracyHashes(sample)};
const expected={...originalComparisonFixture(readFileSync('tests/fixtures/english-accuracy.json','utf8'),published.fixtureHash),sourceCommit:'a'.repeat(40),profiles,models};
const previous=[1,2,3].flatMap(round=>cases.flatMap(sample=>['google','groq'].map(provider=>({round,caseId:sample.id,provider,fixtureHash:expected.fixtureHash,expectedModel:models[provider],status:'failure'})))).map((v,i)=>({...v,number:i+1}));
const fresh=()=>({comparison,approvedCalls:120,freeTierConfirmation:'human-user',previousHash:digest(previous),...structuredClone(expected),providerStops:{},attempts:[]});
const context=ledger=>({previous,ledger,cases,config:{origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',evaluationToken:'b'.repeat(64)},expected,safeCodes:Object.keys(helper.FEEDBACK_ISSUES),validationStages:helper.FEEDBACK_VALIDATION_STAGES,diagnostics:helper.FEEDBACK_DIAGNOSTICS,parseFeedback:helper.parseOriginalAccuracyFeedback});
const content=(sentence,parts=[{wordCount:sentence.trim().split(/\s+/).length,role:'X',explanation:'합성 검증용 성분'}])=>({meaningUsage:'appropriate',grammar:'natural',correctedSentence:sentence,explanation:'합성 출력 검증 자료입니다.',structure:{status:'available',translation:'합성 번역입니다.',parts,note:''}});
const providerResponse=(sample,provider,value=content(sample.sentence),headers={})=>Response.json(provider==='google'?{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}:{model:models.groq,choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]},{headers});
const result=(sample,provider)=>({comparison,caseId:sample.id,provider,...profiles[sample.id],feedback:{...wire.parseChunkedFeedback(JSON.stringify(content(sample.sentence)),sample.sentence,models[provider])}});

test('word counts reconstruct exact contiguous text, including inner spaces, punctuation and question order',()=>{
 const sentence='Does  Maya read books?';
 const parts=[{wordCount:1,role:'V',explanation:'의문문의 조동사'},{wordCount:1,role:'S',explanation:'주어'},{wordCount:1,role:'V',explanation:'본동사'},{wordCount:1,role:'O',explanation:'목적어'}];
 const feedback=wire.parseChunkedFeedback(JSON.stringify(content(sentence,parts)),sentence,models.google);
 assert.deepEqual(feedback.structure.parts.map(p=>p.text),['Does','Maya','read','books?']);assert.equal('wordCount' in feedback.structure.parts[0],false);
 const phrase='The  very tall girl reads.';
 const grouped=wire.parseChunkedFeedback(JSON.stringify(content(phrase,[{wordCount:4,role:'S',explanation:'전체 명사구 주어'},{wordCount:1,role:'V',explanation:'동사'}])),phrase,models.groq);
 assert.equal(grouped.structure.parts[0].text,'The  very tall girl');
 assert.equal(wire.parseChunkedFeedback(JSON.stringify(content('Open the door.')), 'Open the door.',models.google).correctedSentence,'Open the door.');
});
test('missing, excess, fractional, zero and extra-key chunks are rejected without weakening original judgment',()=>{
 const sentence='I read books.';
 for(const counts of [[1,1],[4],[0,3],[-1,4],[1.5,1.5]])assert.throws(()=>wire.parseChunkedFeedback(JSON.stringify(content(sentence,counts.map(wordCount=>({wordCount,role:'X',explanation:'검증'})))),sentence,models.google));
 const extra=content(sentence);extra.structure.parts[0].text='PRIVATE';assert.throws(()=>wire.parseChunkedFeedback(JSON.stringify(extra),sentence,models.google),e=>e.stage==='fields'&&e.diagnostic==='wire_fields');
 assert.throws(()=>wire.parseChunkedFeedback(JSON.stringify(content('I read apples.')),sentence,models.google),e=>e.stage==='judgment');
 const unavailable={...content(''),meaningUsage:'uncertain',grammar:'uncertain',structure:{status:'unavailable',translation:'',parts:[],note:'맥락이 부족합니다.'}};
 assert.equal(wire.parseChunkedFeedback(JSON.stringify(unavailable),'read book',models.google).structure.status,'unavailable');
});
test('all60 candidate requests match activated word/grammar production while flag-off retains text wire',async()=>{
 for(const sample of cases){let sent;
  const fetcher=async(_url,init)=>{sent=JSON.parse(init.body);return providerResponse(sample,'google');};
  const request=helper.freeAccuracyRequest(sample),config={google_api:'test-only',feedback_chunked_enabled:'true'};
  if(sample.domain==='word')await production.generateSentenceFeedbackWithFallback(config,request.input,fetcher);
  else await grammar.generateGrammarFeedback(config,lessonForVersion(LESSON_MAP.get(sample.lessonId),3),sample.sentence,fetcher);
  assert.deepEqual(JSON.parse(sent.contents[0].parts[0].text),request.input);assert.ok(sent.systemInstruction.parts[0].text.startsWith(request.instruction));
  assert.deepEqual(sent.generationConfig.responseJsonSchema,wire.chunkedFeedbackContract.schema);
  assert.equal('expected' in request.input,false);if(sample.domain==='grammar')assert.deepEqual(Object.keys(request.input),['sentence','target','role']);
 }
 let sent;const sample=cases[0];
 await production.generateSentenceFeedbackWithFallback({google_api:'test-only',feedback_chunked_enabled:'false'},helper.freeAccuracyRequest(sample).input,async(_url,init)=>{sent=JSON.parse(init.body);return providerResponse(sample,'google',{meaningUsage:'appropriate',grammar:'natural',correctedSentence:sample.sentence,explanation:'합성 검증'});});
 assert.ok(sent.generationConfig.responseJsonSchema.properties.structure.properties.parts.items.properties.text);
 assert.equal(sent.generationConfig.responseJsonSchema.properties.structure.properties.parts.items.properties.wordCount,undefined);
});
test('new production contract supports Google to Groq fallback and direct comparison never retries',async()=>{
 const sample=cases[0],input=helper.freeAccuracyRequest(sample).input;let calls=0;
 const feedback=await production.generateSentenceFeedbackWithFallback({google_api:'test-only',groq_api:'test-only',feedback_chunked_enabled:'true'},input,async(url,init)=>{
  calls++;if(url.includes('googleapis'))return new Response('PRIVATE_ERROR',{status:503});
  const sent=JSON.parse(init.body);assert.deepEqual(sent.response_format.json_schema.schema,wire.chunkedFeedbackContract.schema);return providerResponse(sample,'groq');
 });assert.equal(feedback.model,models.groq);assert.equal(calls,2);
 for(const provider of ['google','groq']){calls=0;await assert.rejects(helper.evaluateFreeAccuracyCase({google_api:'test-only',groq_api:'test-only'},provider,sample,async()=>{calls++;return new Response('PRIVATE_ERROR',{status:503});}));assert.equal(calls,1);}
});
test('safe quota headers and region diagnostic never copy error text or account identifiers',async()=>{
 const sample=cases[0],value=await helper.evaluateFreeAccuracyCase({groq_api:'test-only'},'groq',sample,async()=>providerResponse(sample,'groq',content(sample.sentence),{'x-ratelimit-remaining-tokens':'42','x-ratelimit-reset-tokens':'12.4s','x-request-id':'PRIVATE_ID'}));
 assert.deepEqual(value.quota,{remainingTokens:42,resetTokensSeconds:13});assert.doesNotMatch(JSON.stringify(value),/PRIVATE_ID/);
 for(const message of ['Gemini API free tier is not available in your country. Please enable billing. PRIVATE_KEY','Other precondition PRIVATE_KEY']){
  const error=errors.providerHttpError(400,{error:{status:'FAILED_PRECONDITION',message}},null);assert.equal(error.code,'provider_precondition');assert.equal(error.diagnostic,message.startsWith('Gemini')?'free_tier_region':undefined);assert.doesNotMatch(JSON.stringify(error),/PRIVATE_KEY|enable billing/);
 }
});
test('candidate POST requires token expiry and isolated profile, rejects learner input and old rounds before calls',async()=>{
 const original=globalThis.fetch,token='c'.repeat(64);let calls=0;
 const request=(body,secret=token)=>new Request('https://study.example/api/english-accuracy-evaluation',{method:'POST',headers:{origin:'https://study.example','content-type':'application/json','x-english-accuracy-token':secret},body:JSON.stringify(body)});
 const body={comparison,caseId:cases[0].id,provider:'google'};
 try{
  globalThis.fetch=async()=>{calls++;throw Error('unexpected');};assert.equal((await route.POST(request(body))).status,404);
  Object.assign(freeEvalEnv,{english_accuracy_token:token,english_accuracy_expires:new Date(Date.now()+3600_000).toISOString()});assert.equal((await route.POST(request(body))).status,404);
  freeEvalEnv.english_accuracy_profile=comparison;assert.equal((await route.POST(request(body,'d'.repeat(64)))).status,401);
  for(const invalid of [{caseId:cases[0].id,provider:'google',round:2},{...body,comparison:'original-first'},{...body,sentence:'PRIVATE'},{...body,round:4}])assert.equal((await route.POST(request(invalid))).status,400);
  assert.equal((await route.POST(request({...body,caseId:'preflight-invalid-case'}))).status,400);assert.equal(calls,0);
  Object.assign(freeEvalEnv,{google_api:'test-only',groq_api:'test-only'});
  for(const provider of ['google','groq']){
   globalThis.fetch=async()=>{calls++;return providerResponse(cases[0],provider);};const response=await route.POST(request({...body,provider})),data=await response.json();
   assert.equal(response.status,200);assert.equal(data.promptHash,profiles[cases[0].id].promptHash);assert.equal(data.requestHash,profiles[cases[0].id].requestHash);assert.equal(data.feedback.structure.parts[0].text,cases[0].sentence);
  }
  globalThis.fetch=async()=>Response.json({error:{status:'FAILED_PRECONDITION',message:'Gemini API free tier is not available in your country PRIVATE'}},{status:400});
  const failure=await (await route.POST(request(body))).json();assert.equal(failure.diagnostic,'free_tier_region');assert.doesNotMatch(JSON.stringify(failure),/PRIVATE/);
  freeEvalEnv.english_accuracy_expires=new Date(Date.now()-1).toISOString();assert.equal((await route.POST(request(body))).status,404);
 }finally{globalThis.fetch=original;for(const key of Object.keys(freeEvalEnv))delete freeEvalEnv[key];}
});
test('collector saves before each request, consumes max120, preserves360 and completed recovery makes no calls',async()=>{
 const ledger=fresh(),parent=digest(previous),saved=[];let calls=0;
 await collectFreeComparison(context(ledger),{save:v=>saved.push(structuredClone(v)),pause:async()=>{},fetcher:async(_url,init)=>{
  calls++;const body=JSON.parse(init.body),sample=cases.find(c=>c.id===body.caseId);assert.equal(saved.at(-1).attempts.at(-1).status,'started');assert.equal(saved.at(-1).attempts.at(-1).number,360+calls);return Response.json(result(sample,body.provider));
 }});
 assert.equal(calls,120);assert.equal(ledger.completed,true);assert.equal(digest(previous),parent);assert.doesNotThrow(()=>validateFreeComparison(previous,ledger,expected));
 await collectFreeComparison(context(ledger),{fetcher:async()=>{throw Error('no HTTP');},save:()=>{throw Error('no save');}});
 for(const change of [{approvedCalls:240},{freeTierConfirmation:'assumed'},{previousHash:'other'},{providerStops:{google:'provider_limit'}},{completed:true,attempts:[]}])assert.throws(()=>validateFreeComparison(previous,{...ledger,...change},expected));
 const extra=structuredClone(ledger);extra.attempts.push({...extra.attempts[0],number:481});assert.throws(()=>validateFreeComparison(previous,extra,expected));
});
test('quota/precondition stops only affected provider and stop cannot be removed or bypassed on resume',async()=>{
 const ledger=fresh();let calls=0;
 await collectFreeComparison(context(ledger),{save:()=>{},pause:async()=>{},fetcher:async(_url,init)=>{calls++;const body=JSON.parse(init.body);return body.provider==='google'?Response.json({code:'provider_precondition',providerStatus:400,diagnostic:'free_tier_region',message:'PRIVATE'},{status:503}):Response.json(result(cases.find(c=>c.id===body.caseId),body.provider));}});
 assert.equal(calls,61);assert.equal(ledger.completed,true);assert.deepEqual(ledger.providerStops,{google:'provider_precondition'});assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE/);
 assert.throws(()=>validateFreeComparison(previous,{...ledger,providerStops:{}},expected));
 const bypass=structuredClone(ledger);bypass.attempts[1]={...bypass.attempts[0],number:362,caseId:cases[1].id,...profiles[cases[1].id]};assert.throws(()=>validateFreeComparison(previous,bypass,expected));
});
test('malformed output and private diagnostics consume failures, abort prevents any further request',async()=>{
 const ledger=fresh(),stop=new AbortController();let calls=0;
 await assert.rejects(collectFreeComparison(context(ledger),{signal:stop.signal,save:()=>{},pause:async()=>{stop.abort();},fetcher:async()=>{calls++;return Response.json({code:'PRIVATE',diagnostic:'PRIVATE',validationStage:'PRIVATE',feedback:{unexpected:'PRIVATE'}});}}));
 assert.equal(calls,1);assert.equal(ledger.attempts[0].status,'failure');assert.equal(ledger.attempts[0].code,'evaluation_invalid_response');assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE/);
 assert.throws(()=>validateFreeComparison(previous,{...ledger,completed:true},expected));
});
test('outer HTTP429 or402 stops even with non-JSON body, including recovery with no network',async()=>{
 for(const status of [429,402]){
  const ledger=fresh();let calls=0;
  await collectFreeComparison(context(ledger),{save:()=>{},pause:async()=>{},fetcher:async()=>{calls++;return new Response('PRIVATE_EDGE_ERROR',{status});}});
  assert.equal(calls,2);assert.equal(ledger.completed,true);assert.equal(Object.keys(ledger.providerStops).length,2);assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE_EDGE_ERROR/);
  await collectFreeComparison(context(ledger),{fetcher:async()=>{throw Error('no HTTP');},save:()=>{throw Error('no save');}});
 }
});
test('CLI refuses calls without explicit free confirmation, exact120 approval, and outside-CI execution',()=>{
 for(const [args,ci] of [[[], ''],[['--live','--approved-calls','120'],''],[['--live','--confirmed-free-tier','--approved-calls','240'],''],[['--live','--confirmed-free-tier','--approved-calls','120'],'true']])assert.throws(()=>execFileSync(process.execPath,['scripts/evaluate-free-feedback.mjs',...args],{env:{...process.env,CI:ci},stdio:['ignore','pipe','pipe']}),e=>e.status===1&&e.stderr.toString().includes('Free comparison stopped'));
});
test('upstream402 translated to API503 still stops through the real provider evaluator and collector',async()=>{
 const ledger=fresh();let upstreamCalls=0;
 await collectFreeComparison(context(ledger),{save:()=>{},pause:async()=>{},fetcher:async(_url,init)=>{
  const {provider,caseId}=JSON.parse(init.body),sample=cases.find(c=>c.id===caseId);
  try{await helper.evaluateFreeAccuracyCase({google_api:'test-only',groq_api:'test-only'},provider,sample,async()=>{upstreamCalls++;return Response.json({error:{message:'PRIVATE_BILLING'}},{status:402});});throw Error('Expected provider rejection');}
  catch(error){return Response.json({code:error.code,providerStatus:error.issue.providerStatus},{status:error.status});}
 }});
 assert.equal(upstreamCalls,2);assert.deepEqual(ledger.providerStops,{google:'provider_precondition',groq:'groq_billing'});assert.equal(ledger.completed,true);assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE_BILLING/);
 await collectFreeComparison(context(ledger),{fetcher:async()=>{throw Error('no HTTP');},save:()=>{throw Error('no save');}});
});
