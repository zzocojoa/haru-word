import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { originalComparisonBudget, validateOriginalComparison, collectOriginalComparison, originalComparisonPreflight, verifyOriginalComparisonSource } from '../scripts/evaluate-original-feedback.mjs';
import { evaluationBudget } from '../scripts/evaluate-english-accuracy.mjs';

globalThis.originalEvalEnv={};
await build({entryPoints:{helper:'lib/original-feedback-evaluation.ts',route:'app/api/english-accuracy-evaluation/route.ts',production:'lib/feedback-fallback.ts',grammar:'lib/grammar/feedback.ts',content:'lib/grammar/content.ts',v3:'lib/grammar/content-v3.ts'},outdir:'work/original-evaluation-tests',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent',plugins:[{name:'synthetic-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const env=globalThis.originalEvalEnv',loader:'js'}));}}]});
const helper=await import('../work/original-evaluation-tests/helper.mjs'),route=await import('../work/original-evaluation-tests/route.mjs');
const production=await import('../work/original-evaluation-tests/production.mjs'),grammar=await import('../work/original-evaluation-tests/grammar.mjs');
const {LESSON_MAP}=await import('../work/original-evaluation-tests/content.mjs'),{lessonForVersion}=await import('../work/original-evaluation-tests/v3.mjs');
const {accuracyCases:cases,accuracyModels:models}=helper;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtureHash=createHash('sha256').update(readFileSync('tests/fixtures/english-accuracy.json')).digest('hex'),sourceCommit='a'.repeat(40),profiles={};
for(const sample of cases)profiles[sample.id]={domain:sample.domain,...await helper.originalAccuracyHashes(sample)};
const expected={fixtureHash,sourceCommit,profiles,models};
const previous=[1,2].flatMap(round=>cases.flatMap(sample=>['google','groq'].map(provider=>({round,caseId:sample.id,provider,domain:sample.domain,fixtureHash,expectedModel:models[provider],status:'failure'})))).map((r,i)=>({...r,number:i+1}));
const fresh=()=>({comparison:'original-first',approvedCalls:120,previousHash:digest(previous),...structuredClone(expected),attempts:[]});
const config={origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',evaluationToken:'b'.repeat(64),sourceCommit};
const safeCodes=Object.keys(helper.FEEDBACK_ISSUES),validationStages=helper.FEEDBACK_VALIDATION_STAGES;
const context=ledger=>({previous,ledger,cases,config,expected,safeCodes,validationStages,parseFeedback:helper.parseOriginalAccuracyFeedback});
const content=sample=>({meaningUsage:'appropriate',grammar:'natural',correctedSentence:sample.sentence,explanation:'합성 출력 검증 자료입니다.'});
const google=sample=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(content(sample))}]}}]});
const groq=sample=>Response.json({model:models.groq,choices:[{finish_reason:'stop',message:{content:JSON.stringify(content(sample))}}]});

test('new comparison requests exactly match the activated production profile on all 60 inputs',async()=>{
 for(const sample of cases){
  let sent;const fetcher=async(_url,init)=>{sent=JSON.parse(init.body);return google(sample);};
  const request=helper.originalAccuracyRequest(sample),providers={google_api:'test-only',feedback_original_sentence_enabled:'true'};
  if(sample.domain==='word')await production.generateSentenceFeedbackWithFallback(providers,request.input,fetcher);
  else await grammar.generateGrammarFeedback(providers,lessonForVersion(LESSON_MAP.get(sample.lessonId),3),sample.sentence,fetcher);
  assert.deepEqual(JSON.parse(sent.contents[0].parts[0].text),request.input);assert.ok(sent.systemInstruction.parts[0].text.startsWith(request.instruction));
  assert.equal('expected' in request.input,false);assert.equal('references' in request.input,false);
  if(sample.domain==='grammar')assert.deepEqual(Object.keys(request.input),['sentence','target','role']);
 }
});
test('comparison pins changed input as well as prompt and output policy',async()=>{
 const sample=cases[0],base=await helper.originalAccuracyHashes(sample),changed=await helper.originalAccuracyHashes({...sample,sentence:sample.sentence+' '});
 assert.equal(base.promptHash,changed.promptHash);assert.notEqual(base.requestHash,changed.requestHash);
 assert.match(base.requestHash,/^[a-f0-9]{64}$/);assert.equal(fixtureHash,'02a84a0c86252524e2627cbf7cd69f8d725ade70ebbf107c8aed986eabcd8e54');
});
test('direct named comparison never falls back or retries a failed selected provider',async()=>{
 for(const domain of ['word','grammar'])for(const provider of ['google','groq']){
  const sample=cases.find(c=>c.domain===domain);let calls=0;
  await assert.rejects(helper.evaluateOriginalAccuracyCase({google_api:'test-only',groq_api:'test-only'},provider,sample,async(url)=>{calls++;assert.equal(url.includes('googleapis'),provider==='google');return new Response('PRIVATE_BODY',{status:503});}));
  assert.equal(calls,1);
 }
});
test('named POST is disabled/authenticated/fixed-input and rejects mixing or extending legacy rounds',async()=>{
 const fetcher=globalThis.fetch,token='c'.repeat(64);let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not call');};
 const request=(body,secret=token)=>new Request('https://study.example/api/english-accuracy-evaluation',{method:'POST',headers:{origin:'https://study.example','content-type':'application/json','x-english-accuracy-token':secret},body:JSON.stringify(body)});
 const body={comparison:'original-first',caseId:cases[0].id,provider:'google'};
 try{
  assert.equal((await route.POST(request(body))).status,404);
  Object.assign(originalEvalEnv,{english_accuracy_token:token,english_accuracy_expires:new Date(Date.now()+3600_000).toISOString()});
  assert.equal((await route.POST(request(body,'d'.repeat(64)))).status,401);
  for(const invalid of [{...body,sentence:'PRIVATE'},{...body,round:2},{...body,comparison:'other'},{caseId:cases[0].id,provider:'google',round:3}])assert.equal((await route.POST(request(invalid))).status,400);
  assert.equal((await route.POST(request({...body,caseId:'preflight-invalid-case'}))).status,400);assert.equal((await route.POST(request(body))).status,503);assert.equal(calls,0);
 }finally{globalThis.fetch=fetcher;for(const key of Object.keys(originalEvalEnv))delete originalEvalEnv[key];}
});
test('actual named POST sends the active production profile to each direct provider and returns pinned hashes',async()=>{
 const fetcher=globalThis.fetch,token='e'.repeat(64);
 Object.assign(originalEvalEnv,{english_accuracy_token:token,english_accuracy_expires:new Date(Date.now()+3600_000).toISOString(),google_api:'test-only',groq_api:'test-only',feedback_original_sentence_enabled:'false'});
 try{
  for(const domain of ['word','grammar'])for(const provider of ['google','groq']){
   const sample=cases.find(c=>c.domain===domain);let sent,calls=0;
   globalThis.fetch=async(_url,init)=>{calls++;sent=JSON.parse(init.body);return provider==='google'?google(sample):groq(sample);};
   const response=await route.POST(new Request('https://study.example/api/english-accuracy-evaluation',{method:'POST',headers:{origin:'https://study.example','content-type':'application/json','x-english-accuracy-token':token},body:JSON.stringify({comparison:'original-first',caseId:sample.id,provider})})),value=await response.json();
   assert.equal(response.status,200);assert.equal(calls,1);assert.equal(value.comparison,'original-first');assert.equal('round' in value,false);
   assert.equal(value.promptHash,profiles[sample.id].promptHash);assert.equal(value.requestHash,profiles[sample.id].requestHash);
   const request=helper.originalAccuracyRequest(sample);assert.deepEqual(JSON.parse(provider==='google'?sent.contents[0].parts[0].text:sent.messages[1].content),request.input);
   assert.ok((provider==='google'?sent.systemInstruction.parts[0].text:sent.messages[0].content).startsWith(request.instruction));
  }
 }finally{globalThis.fetch=fetcher;for(const key of Object.keys(originalEvalEnv))delete originalEvalEnv[key];}
});
test('preserved 240-call budget cannot be extended; separate context pins all prior attempts and models',()=>{
 const ledger=fresh();assert.doesNotThrow(()=>validateOriginalComparison(previous,ledger,expected));assert.throws(()=>evaluationBudget(previous,2));assert.throws(()=>evaluationBudget(previous,3));
 for(const records of [previous.slice(1),[...previous,{...previous[0],number:241}]])assert.throws(()=>validateOriginalComparison(records,ledger,expected));
 for(const change of [{previousHash:'changed'},{fixtureHash:'changed'},{sourceCommit:'f'.repeat(40)},{approvedCalls:240},{models:{...models,google:'changed'}},{profiles:{...profiles,[cases[0].id]:{...profiles[cases[0].id],requestHash:'changed'}}}])assert.throws(()=>validateOriginalComparison(previous,{...ledger,...change},expected));
 const duplicated=structuredClone(previous);duplicated[1]={...duplicated[0],number:2};assert.throws(()=>validateOriginalComparison(duplicated,{...ledger,previousHash:digest(duplicated)},expected));
 assert.doesNotThrow(()=>originalComparisonBudget(Array.from({length:119},()=>({status:'failure'}))));
 for(const status of ['started','failure','response'])assert.throws(()=>originalComparisonBudget(Array.from({length:120},()=>({status}))));
});
test('collector persists before HTTP, caps at120, preserves parent and hides provider metadata in blind bundle',async()=>{
 const ledger=fresh(),before=digest(previous),snapshots=[];let calls=0;
 const fetcher=async(_url,init)=>{
  calls++;const request=JSON.parse(init.body),last=snapshots.at(-1).attempts.at(-1),sample=cases.find(c=>c.id===request.caseId);
  assert.equal(last.status,'started');assert.equal(last.number,240+calls);
  return Response.json({comparison:'original-first',caseId:sample.id,provider:request.provider,...profiles[sample.id],feedback:{...content(sample),original:sample.sentence,model:models[request.provider],createdAt:'2026-09-30T00:00:00.000Z'}});
 };
 await collectOriginalComparison(context(ledger),{fetcher,save:value=>snapshots.push(structuredClone(value)),pause:async()=>{}});
 assert.equal(calls,120);assert.equal(ledger.attempts.length,120);assert.equal(snapshots.length,240);assert.equal(digest(previous),before);
 await collectOriginalComparison(context(ledger),{fetcher:async()=>{throw Error('no call');},save:()=>{throw Error('no save');},pause:async()=>{}});
 assert.equal(calls,120);assert.throws(()=>originalComparisonBudget(ledger.attempts));
 const {reviewBundle}=await import('../scripts/evaluate-english-accuracy.mjs'),bundle=reviewBundle(ledger.attempts,3);
 assert.equal(bundle.blinded.length,120);assert.equal(bundle.mapping.length,120);
 for(const row of bundle.blinded){assert.equal('provider' in row,false);assert.equal('model' in row.feedback,false);assert.equal('createdAt' in row.feedback,false);assert.equal('number' in row,false);}
});
test('crashed consumed slots are skipped; failures have no retries, fallback or untrusted diagnostics',async()=>{
 const ledger=fresh(),sample=cases[0],profile=profiles[sample.id];
 ledger.attempts.push({number:241,round:3,comparison:'original-first',caseId:sample.id,domain:sample.domain,provider:'google',fixtureHash,promptHash:profile.promptHash,requestHash:profile.requestHash,expectedModel:models.google,status:'started'});
 let calls=0;
 await collectOriginalComparison({...context(ledger),cases:[sample]},{save:()=>{},pause:async()=>{},fetcher:async(_url,init)=>{calls++;assert.equal(JSON.parse(init.body).provider,'groq');return Response.json({code:'PRIVATE_BODY',providerStatus:999,validationStage:'PRIVATE_FIELD'},{status:502});}});
 assert.equal(calls,1);assert.equal(ledger.attempts.length,2);assert.equal(ledger.attempts[0].status,'started');assert.equal(ledger.attempts[1].status,'failure');assert.equal(ledger.attempts[1].code,'evaluation_invalid_response');
 assert.equal('providerStatus' in ledger.attempts[1],false);assert.equal('validationStage' in ledger.attempts[1],false);assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE/);
});
test('mismatched request/model hashes consume a failed slot and judgment remains a fixed safe failure',async()=>{
 for(const fault of ['promptHash','requestHash','model','judgment']){
  const ledger=fresh(),sample=cases[0];let calls=0;
  await collectOriginalComparison({...context(ledger),cases:[sample]},{save:()=>{},pause:async()=>{},fetcher:async(_url,init)=>{
   calls++;const provider=JSON.parse(init.body).provider;
   if(fault==='judgment')return Response.json({code:provider==='google'?'provider_invalid_response':'groq_invalid_response',providerStatus:200,validationStage:'judgment'},{status:502});
   const result={comparison:'original-first',caseId:sample.id,provider,...profiles[sample.id],feedback:{...content(sample),original:sample.sentence,model:models[provider],createdAt:'2026-09-30T00:00:00.000Z'}};
   if(fault==='model')result.feedback.model='other';else result[fault]='other';return Response.json(result);
  }});
  assert.equal(calls,2);assert.ok(ledger.attempts.every(a=>a.status==='failure'));
  if(fault==='judgment')assert.ok(ledger.attempts.every(a=>a.validationStage==='judgment'&&a.providerStatus===200));
 }
});
test('malformed successful feedback never reaches the ledger or blind review, even with matching hashes',async()=>{
 const sample=cases[0],valid={...content(sample),original:sample.sentence,model:models.google,createdAt:'2026-09-30T00:00:00.000Z'};
 for(const malformed of [{original:sample.sentence,model:models.google,unexpectedDiagnostic:'PRIVATE_OUTPUT'},
  {...valid,unexpectedDiagnostic:'PRIVATE_OUTPUT'},{...valid,grammar:'other'},{...valid,correctedSentence:'Another story.'}]){
  const ledger=fresh();let calls=0;
  await collectOriginalComparison({...context(ledger),cases:[sample]},{save:()=>{},pause:async()=>{},fetcher:async(_url,init)=>{
   calls++;const provider=JSON.parse(init.body).provider;
   return Response.json({comparison:'original-first',caseId:sample.id,provider,...profiles[sample.id],feedback:{...malformed,model:models[provider]}});
  }});
  assert.equal(calls,2);assert.ok(ledger.attempts.every(a=>a.status==='failure'&&a.code==='evaluation_invalid_response'&&!a.feedback));assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE_OUTPUT|Another story/);
 }
 for(const body of [null,[],{},'invalid-json']){
  const ledger=fresh();
  await collectOriginalComparison({...context(ledger),cases:[sample]},{save:()=>{},pause:async()=>{},fetcher:async()=>body==='invalid-json'?new Response('PRIVATE_NOT_JSON'):Response.json(body)});
  assert.ok(ledger.attempts.every(a=>a.httpStatus===200&&a.status==='failure'&&a.code==='evaluation_invalid_response'&&!a.feedback));assert.doesNotMatch(JSON.stringify(ledger),/PRIVATE_NOT_JSON/);
 }
});
test('preflight is synthetic-invalid-case only and refuses disabled or old schema before any budget slot',async()=>{
 let calls=0;
 await originalComparisonPreflight(config,async(_url,init)=>{calls++;assert.deepEqual(JSON.parse(init.body),{caseId:'preflight-invalid-case',provider:'google',comparison:'original-first'});return Response.json({code:'evaluation_invalid_case'},{status:400});});
 assert.equal(calls,1);
 for(const [status,code] of [[404,'evaluation_disabled'],[400,'evaluation_invalid_request'],[401,'evaluation_unauthorized']])await assert.rejects(originalComparisonPreflight(config,async()=>Response.json({code},{status})));
});
test('CLI requires explicit extra120 authorization and refuses actual calls in CI',()=>{
 const script=resolve('scripts/evaluate-original-feedback.mjs');
 for(const [args,env] of [[[],{...process.env,CI:''}],[['--live','--approved-additional-calls','240'],{...process.env,CI:''}],[['--live','--approved-additional-calls','120'],{...process.env,CI:'true'}]]){
  assert.throws(()=>execFileSync(process.execPath,[script,...args],{encoding:'utf8',env,stdio:['ignore','pipe','pipe']}),error=>error.status===1&&error.stderr.includes('Original comparison stopped'));
 }
});
test('incomplete live comparison requires clean local source matching the native-verified source tree',()=>{
 const directory=mkdtempSync(join(tmpdir(),'haru-eval-source-')),git=args=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git(['init']);git(['config','user.name','Synthetic Test']);git(['config','user.email','synthetic@example.test']);
  writeFileSync(join(directory,'source.txt'),'first');git(['add','source.txt']);git(['commit','-m','synthetic source']);const source=git(['rev-parse','HEAD']);
  assert.doesNotThrow(()=>verifyOriginalComparisonSource(source,directory));
  git(['commit','--allow-empty','-m','same tree']);assert.doesNotThrow(()=>verifyOriginalComparisonSource(source,directory));
  writeFileSync(join(directory,'source.txt'),'changed');assert.throws(()=>verifyOriginalComparisonSource(source,directory));
  git(['add','source.txt']);assert.throws(()=>verifyOriginalComparisonSource(source,directory));git(['commit','-m','changed tree']);assert.throws(()=>verifyOriginalComparisonSource(source,directory));
  const current=git(['rev-parse','HEAD']);writeFileSync(join(directory,'untracked.txt'),'new');assert.throws(()=>verifyOriginalComparisonSource(current,directory));
 }finally{assert.ok(realpathSync(directory).startsWith(realpathSync(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
test('complete comparison recovery reuses one blind bundle, no project files/HTTP and no parent mutation',()=>{
 const directory=mkdtempSync(join(tmpdir(),'haru-original-eval-')),root=join(directory,'.sites-runtime','english-accuracy'),store=join(root,'original-first');mkdirSync(store,{recursive:true});
 const ledger=fresh();ledger.attempts=cases.flatMap(sample=>['google','groq'].map(provider=>({round:3,comparison:'original-first',caseId:sample.id,provider,domain:sample.domain,fixtureHash,...profiles[sample.id],expectedModel:models[provider],status:'failure'}))).map((r,i)=>({...r,number:241+i}));
 const parent=JSON.stringify({attempts:previous});writeFileSync(join(root,'ledger.json'),parent);writeFileSync(join(store,'ledger.json'),JSON.stringify(ledger));
 const guard=join(directory,'no-http.mjs');writeFileSync(guard,"globalThis.fetch=()=>{throw Error('HTTP is prohibited during recovery')};");
 const run=()=>execFileSync(process.execPath,['--import',pathToFileURL(guard).href,resolve('scripts/evaluate-original-feedback.mjs'),'--live','--approved-additional-calls','120'],{cwd:directory,encoding:'utf8',env:{...process.env,CI:''},input:JSON.stringify(config)+'\n'});
 try{
  assert.equal(JSON.parse(run()).totalAttempts,360);const bundle=readFileSync(join(store,'review-bundle.json'),'utf8');
  assert.equal(JSON.parse(run()).complete,true);assert.equal(readFileSync(join(store,'review-bundle.json'),'utf8'),bundle);assert.equal(readFileSync(join(root,'ledger.json'),'utf8'),parent);
  assert.equal(JSON.parse(readFileSync(join(store,'blind.json'),'utf8')).length,120);assert.doesNotMatch(bundle,/provider_invalid|groq_|google-model/);
 }finally{assert.ok(realpathSync(directory).startsWith(realpathSync(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
