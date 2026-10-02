import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {restoreAnnotatedLedger,validateAnnotatedLedger,collectAnnotatedEvidence,annotatedReviewBundle,validateAnnotatedAuthorization,validateAnnotatedParents,assertAnnotatedLiveArguments} from '../scripts/evaluate-annotated-evidence.mjs';

// One module graph keeps provider/parser error identity intact. No live fetch.
globalThis.__annotatedEvidenceTestEnv={};
const compiled = await build({stdin:{contents:`export * from './lib/annotated-evidence-evaluation';
export {POST} from './app/api/english-accuracy-evaluation/route';
export {countedEvidenceUnits} from './lib/counted-evidence-feedback';
export {freeAccuracyRequest} from './lib/free-feedback-evaluation';
export {tokenEvidenceHashes} from './lib/token-evidence-evaluation';
export {annotatedEvidenceFeedbackContract} from './lib/annotated-evidence-feedback';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'synthetic-env',setup(b){
  b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'synthetic'}));
  b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const env=globalThis.__annotatedEvidenceTestEnv;',loader:'js'}));
}}]});
const helper = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const plan = helper.annotatedEvidencePlan;
const contentHash = file => createHash('sha256').update(readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const cases = helper.annotatedEvidenceCases;
const envelope = provider => provider==='google' ? {candidates:[{finishReason:'STOP',content:{parts:[{text:'{"analysis":{"grammar":"uncertain"}}'}]}}]}
  : {model:helper.accuracyModels.groq,choices:[{finish_reason:'stop',message:{content:'{"analysis":{"grammar":"uncertain"}}'}}]};

test('full120 plan covers all original17 defects plus both observed gloss omissions without changing publication gates', async () => {
  assert.equal(plan.previousCalls,735); assert.equal(plan.maximumCalls,120); assert.equal(plan.maximumTotalCalls,855);
  assert.deepEqual(plan.parentCounts,[240,120,120,60,115,20,26,34]);
  assert.equal(cases.length,60); assert.equal(new Set(cases.map(c=>c.id)).size,60);
  assert.equal(cases.filter(c=>c.domain==='word').length,40); assert.equal(cases.filter(c=>c.domain==='grammar').length,20);
  const fixture=JSON.parse(readFileSync('tests/fixtures/english-accuracy.json','utf8'));
  assert.deepEqual([...cases.map(c=>c.id)].sort(),fixture.cases.map(c=>c.id).sort());
  const priorPlan=JSON.parse(readFileSync('data/evaluations/token-evidence-plan.json','utf8'));
  assert.deepEqual(plan.caseIds.slice(0,17),priorPlan.caseIds);
  assert.equal(plan.references.length,7); assert.equal(plan.parentLedgerHashes.length,8);
  assert.deepEqual(plan.parentLedgerHashes.slice(0,7),priorPlan.parentLedgerHashes);
  assert.deepEqual(plan.references.slice(0,6),priorPlan.references);
  const priorResult=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-02-token.json','utf8'));
  assert.equal(plan.parentLedgerHashes[7],priorResult.ledgerHash);
  assert.equal(priorResult.totalCalls,plan.previousCalls);
  const schedule=helper.annotatedEvidenceSchedule(); assert.equal(schedule.length,120);
  const registrations=JSON.parse(readFileSync('data/evaluations/accuracy-cause-plan.json','utf8')).cases;
  assert.equal(registrations.flatMap(c=>c.failures).length,17);
  for(const c of registrations) for(const f of c.failures) assert.equal(schedule.filter(s=>s.caseId===c.caseId&&s.provider===f.provider).length,1);
  for(const id of ['word-02','word-15']) assert.equal(cases.filter(c=>c.id===id).length,1);
  assert.equal(plan.gates.fullCohortRequired,true); assert.equal(plan.gates.casesPerProvider,60);
  assert.equal(plan.gates.minimumOverallPasses,54); assert.equal(plan.gates.historicalFailuresToResolve,17);
  assert.equal(plan.gates.criticalFailures,0); assert.equal(plan.gates.criticalUnavailable,0); assert.equal(plan.gates.newRegressions,0);
  assert.deepEqual(plan.gates.historicalMinimumPasses,{google:44,groq:34});
  assert.equal(contentHash('tests/fixtures/english-accuracy.json'),plan.fixtureContentHash);
  for(const reference of plan.references) assert.equal(contentHash(reference.path),reference.hash);
  for(const sample of cases) {
    const request=helper.annotatedEvidenceRequest(sample), hashes=await helper.annotatedEvidenceHashes(sample);
    const {originalUnits,...legacy}=request.input;
    assert.deepEqual(legacy,helper.freeAccuracyRequest(sample).input);
    assert.deepEqual(originalUnits,helper.countedEvidenceUnits(sample.sentence).map(u=>u.text));
    assert.doesNotMatch(JSON.stringify(request),/"(?:expected|critical|correction|caseId|id|examples)"\s*:/);
    assert.match(hashes.promptHash,/^[a-f0-9]{64}$/); assert.match(hashes.requestHash,/^[a-f0-9]{64}$/);
    assert.deepEqual(hashes,await helper.annotatedEvidenceHashes(sample));
    assert.notEqual(hashes.requestHash,(await helper.tokenEvidenceHashes(sample)).requestHash);
  }
});

test('both transports actually apply the new flat-analysis guard and reject a supplied subject-only assertion without retries', async () => {
  const sample=cases.find(c=>c.id==='grammar-57');
  const wire={analysis:{grammar:'natural',target:{reason:'matched',originalSpan:sample.sentence,observedUse:'검사용 명사'},
    structure:{status:'available',translation:'검사용 해석',parts:[{units:[sample.sentence],function:'subject',meaning:'검사용 명사'}]}}};
  for(const provider of ['google','groq']) {
    let calls=0;
    const value=provider==='google'?{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(wire)}]}}]}
      :{model:helper.accuracyModels.groq,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}]};
    await assert.rejects(helper.evaluateAnnotatedEvidenceCase({google_api:'synthetic',groq_api:'synthetic'},provider,sample,async()=>{calls++;return Response.json(value);}),error=>{
      assert.equal(error.validationStage,'structure'); assert.equal(error.validationDetail.reason,'structure_contract');
      assert.ok(error instanceof helper.TokenEvidenceEvaluationError); return true;
    });
    assert.equal(calls,1);
  }
});

test('both domains use the existing provider transports exactly once with literal-unit input and the new contract', async () => {
  for(const sample of [cases.find(c=>c.domain==='word'),cases.find(c=>c.domain==='grammar')]) for(const provider of ['google','groq']) {
    const calls=[];
    const result=await helper.evaluateAnnotatedEvidenceCase({google_api:'synthetic',groq_api:'synthetic'},provider,sample,async(url,init)=>{
      calls.push(JSON.parse(init.body)); return Response.json(envelope(provider),{headers:{'x-ratelimit-remaining-tokens':'8000','x-ratelimit-remaining-requests':'50','x-ratelimit-reset-tokens':'7.66s','x-ratelimit-reset-requests':'2m59.56s'}});
    });
    assert.equal(calls.length,1); assert.equal(result.feedback.original,sample.sentence); assert.equal(result.feedback.model,helper.accuracyModels[provider]);
    assert.deepEqual(result.quota,{remainingTokens:8000,remainingRequests:50,resetTokensSeconds:8,resetRequestsSeconds:180});
    const sent=provider==='google'?JSON.parse(calls[0].contents[0].parts[0].text):JSON.parse(calls[0].messages[1].content);
    assert.deepEqual(sent,helper.annotatedEvidenceRequest(sample).input);
    assert.deepEqual(provider==='google'?calls[0].generationConfig.responseJsonSchema:calls[0].response_format.json_schema.schema,helper.annotatedEvidenceFeedbackContract.schema);
    assert.deepEqual({promptHash:result.promptHash,requestHash:result.requestHash},await helper.annotatedEvidenceHashes(sample));
    // Withheld mock output tests transport, never claims the authored English is uncertain.
    assert.equal(result.feedback.grammar,'uncertain');
  }
  let calls=0;
  await assert.rejects(helper.evaluateAnnotatedEvidenceCase({google_api:'synthetic'},'google',{...cases[0],id:'not-planned'},async()=>{calls++;}));
  assert.equal(calls,0);
});

test('HTTP failures retain bounded quota and retry delay without raw headers or provider text and never retry', async () => {
  for(const provider of ['google','groq']) {
    let calls=0;
    await assert.rejects(helper.evaluateAnnotatedEvidenceCase({google_api:'synthetic',groq_api:'synthetic'},provider,cases[0],async()=>{
      calls++; return Response.json({error:{status:'RESOURCE_EXHAUSTED',message:'private-synthetic-marker'}},{status:429,
        headers:{'retry-after':'30.2','x-ratelimit-remaining-tokens':'0','x-ratelimit-reset-tokens':'1m2.5s','x-ratelimit-remaining-requests':'99','x-private':'private-synthetic-marker'}});
    }),error=>{
      assert.ok(error instanceof helper.TokenEvidenceEvaluationError); assert.equal(error.issue.retryAfterSeconds,31);
      assert.equal(error.code,provider==='google'?'provider_limit':'groq_limit');
      assert.deepEqual(error.quota,{remainingTokens:0,remainingRequests:99,resetTokensSeconds:63});
      assert.doesNotMatch(JSON.stringify(error),/private-synthetic-marker|x-private/); return true;
    });
    assert.equal(calls,1);
  }
  await assert.rejects(helper.evaluateAnnotatedEvidenceCase({google_api:'synthetic'},'google',cases[0],async()=>Response.json({error:{status:'FAILED_PRECONDITION',message:'free tier is not available in your country private-synthetic-marker'}},{status:400})),error=>{
    assert.equal(error.code,'provider_precondition'); assert.equal(error.diagnostic,'free_tier_region');
    assert.deepEqual(error.quota,{}); assert.doesNotMatch(JSON.stringify(error),/private-synthetic-marker/); return true;
  });
});

test('safe quota accepts only bounded numbers and literal-unit diagnostics reveal no rejected values', () => {
  assert.deepEqual(helper.parseTokenEvidenceQuota({remainingTokens:0,resetTokensSeconds:604800,remainingRequests:1_000_000_000}),{remainingTokens:0,resetTokensSeconds:604800,remainingRequests:1_000_000_000});
  for(const value of [null,[],{raw:'private-synthetic-marker'},{remainingTokens:'100'},{remainingTokens:-1},{remainingRequests:1.5},{remainingTokens:1_000_000_001},{resetTokensSeconds:0},{resetTokensSeconds:604801}]) assert.equal(helper.parseTokenEvidenceQuota(value),undefined);
  for(const value of ['NaN','Infinity','-1s','8d','1s2m','1ms','private-synthetic-marker','0s','1'.repeat(65)+'s']) assert.deepEqual(helper.tokenEvidenceQuotaHeaders(new Headers({'x-ratelimit-reset-tokens':value})),{});
  assert.deepEqual(helper.tokenEvidenceQuotaHeaders(new Headers({'x-ratelimit-reset-tokens':'1h2m3.1s'})),{resetTokensSeconds:3724});
  const wire={analysis:{grammar:'natural',target:{reason:'absent'},structure:{status:'available',translation:'검사용 번역',parts:[{units:[{secret:'private-synthetic-marker'}],function:'subject',meaning:'검사용 뜻'}]}}};
  assert.throws(()=>helper.annotatedEvidenceFeedbackContract.parse(JSON.stringify(wire),cases[0].sentence,helper.accuracyModels.google),error=>{
    assert.equal(error.validationDetail.issues[0].field,'analysis.structure.parts[].units[]');
    assert.doesNotMatch(JSON.stringify(error),/private-synthetic-marker|secret/); return true;
  });
});

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const helpers={cases,parseFeedback:helper.parseAnnotatedEvidenceAccuracyFeedback,parseValidationDetail:helper.parseFeedbackValidationDetail,parseQuota:helper.parseTokenEvidenceQuota,
  safeCodes:Object.keys(helper.FEEDBACK_ISSUES),validationStages:helper.FEEDBACK_VALIDATION_STAGES,diagnostics:helper.FEEDBACK_DIAGNOSTICS};
const profiles={}; for(const sample of cases) profiles[sample.id]={domain:sample.domain,...await helper.annotatedEvidenceHashes(sample)};
const expected={fixtureHash:'1'.repeat(64),fixtureContentHash:plan.fixtureContentHash,previousHash:'2'.repeat(64),planHash:hash(plan),referenceHashes:plan.references,
  sourceCommit:'a'.repeat(40),profiles,models:helper.accuracyModels,schedule:helper.annotatedEvidenceSchedule()};
const config={origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',evaluationToken:'f'.repeat(64),sourceCommit:expected.sourceCommit};
const fresh=()=>restoreAnnotatedLedger({},undefined,structuredClone(expected),helpers);
const context=ledger=>({ledger,expected,helpers,config});
const clock=()=>{let time=Date.parse('2026-10-02T00:00:00Z');const waits=[];return {now:()=>time,pause:async ms=>{waits.push(ms);time+=ms;},waits};};
const failure=row=>({...row,code:row.provider==='google'?'provider_invalid_response':'groq_invalid_response',quota:{},validationStage:'fields',diagnostic:'wire_fields'});

test('new approval and frozen735 history are required; old34 approval and CI cannot start the collector', () => {
  const approval={schemaVersion:1,comparison:'annotated-evidence-v1',approvedCalls:120,previousCalls:735,cumulativeMaximum:855,sourceCommit:expected.sourceCommit,
    planHash:expected.planHash,humanAuthorization:'additional-120-free-annotated-calls',confirmedFreeProviders:['google','groq'],approvedAt:new Date(Date.now()-1000).toISOString()};
  validateAnnotatedAuthorization(approval,expected.sourceCommit,expected.planHash);
  for(const mutate of [v=>v.approvedCalls=34,v=>v.previousCalls=675,v=>v.comparison='counted-evidence-v1',v=>v.humanAuthorization='additional-120-free-counted-calls',v=>v.sourceCommit='b'.repeat(40)]) {
    const bad=structuredClone(approval);mutate(bad);assert.throws(()=>validateAnnotatedAuthorization(bad,expected.sourceCommit,expected.planHash));
  }
  assertAnnotatedLiveArguments(['--live','--confirmed-free-tier','--approved-calls','120']);
  assert.throws(()=>assertAnnotatedLiveArguments(['--live','--confirmed-free-tier','--approved-calls','34']));
  assert.throws(()=>assertAnnotatedLiveArguments(['--live','--confirmed-free-tier','--approved-calls','120'],'1'));
  assert.throws(()=>restoreAnnotatedLedger({runInitialized:true},undefined,expected,helpers));
  const parents=plan.parentCounts.map((count,cohort)=>Array.from({length:count},(_,i)=>({cohort,number:i+1})));
  const syntheticPlan={...plan,parentLedgerHashes:parents.map(hash),combinedParentHash:hash(parents.flat())};
  validateAnnotatedParents(parents,syntheticPlan);parents[7][0].number=999;assert.throws(()=>validateAnnotatedParents(parents,syntheticPlan));
  try {execFileSync(process.execPath,['scripts/evaluate-annotated-evidence.mjs','--live','--confirmed-free-tier','--approved-calls','120'],{env:{...process.env,CI:'1'},encoding:'utf8',stdio:'pipe',timeout:15000});assert.fail('CI must reject');}
  catch(error){assert.equal(error.status,1);assert.match(String(error.stderr),/consumed slots and frozen history preserved/u);}
});

test('collector durably spends each unique slot once, stops at120 and never repeats completed or started attempts', async () => {
  const ledger=fresh(),timer=clock(),saved=[],posted=[];
  await collectAnnotatedEvidence(context(ledger),{...timer,save:value=>saved.push(structuredClone(value)),fetcher:async(_url,init)=>{
    const row=JSON.parse(init.body),slot=ledger.attempts.at(-1);assert.equal(saved.at(-1).attempts.at(-1).status,'started');
    assert.equal(slot.status,'started');posted.push(row);return Response.json(failure(row),{status:502});
  }});
  assert.equal(posted.length,120);assert.equal(new Set(posted.map(r=>r.caseId+r.provider)).size,120);assert.equal(ledger.completed,true);
  assert.deepEqual(ledger.attempts.map(a=>a.number),Array.from({length:120},(_,i)=>736+i));assert.ok(timer.waits.every(ms=>ms<=30000));
  validateAnnotatedLedger(ledger,expected,helpers);const blind=annotatedReviewBundle(ledger.attempts);
  assert.deepEqual(annotatedReviewBundle(ledger.attempts,blind),blind);blind.blinded[0].code='tampered';assert.throws(()=>annotatedReviewBundle(ledger.attempts,blind));
  let extra=0;await collectAnnotatedEvidence(context(ledger),{...timer,fetcher:async()=>{extra++;}});assert.equal(extra,0);
  const interrupted=fresh();interrupted.attempts=[{...saved[0].attempts[0]}];const remaining=[];
  await collectAnnotatedEvidence(context(interrupted),{...clock(),fetcher:async(_url,init)=>{const row=JSON.parse(init.body);remaining.push(row);return Response.json(failure(row),{status:502});}});
  assert.equal(remaining.length,119);assert.equal(remaining.some(r=>r.caseId===posted[0].caseId&&r.provider===posted[0].provider),false);
  const diskFailure=fresh();let calls=0;
  await assert.rejects(collectAnnotatedEvidence(context(diskFailure),{save:()=>{throw Error('synthetic disk failure');},fetcher:async()=>{calls++;}}));assert.equal(calls,0);
});

test('quota and retry delay survive provider stops and recovery; unsafe metadata closes evaluation without saving raw values', async () => {
  const ledger=fresh();let calls=0;
  await collectAnnotatedEvidence(context(ledger),{...clock(),fetcher:async(_url,init)=>{calls++;const row=JSON.parse(init.body);
    return Response.json({...row,code:row.provider==='google'?'provider_precondition':'groq_limit',providerStatus:row.provider==='google'?400:429,
      retryAfterSeconds:31,quota:{remainingTokens:0,resetTokensSeconds:63}},{status:row.provider==='google'?503:429});
  }});
  assert.equal(calls,2);assert.equal(ledger.completed,true);assert.equal(ledger.attempts[0].retryAfterSeconds,31);
  assert.deepEqual(ledger.attempts[1].quota,{remainingTokens:0,resetTokensSeconds:63});validateAnnotatedLedger(ledger,expected,helpers);
  for(const mutate of [a=>a.retryAfterSeconds=0,a=>a.retryAfterSeconds=604801,a=>a.quota.raw='private-synthetic-marker',a=>a.quota.remainingTokens=1.5]) {
    const bad=structuredClone(ledger);mutate(bad.attempts[0]);assert.throws(()=>validateAnnotatedLedger(bad,expected,helpers));
  }
  const unsafe=fresh();calls=0;
  await collectAnnotatedEvidence(context(unsafe),{...clock(),fetcher:async(_url,init)=>{calls++;return Response.json({...failure(JSON.parse(init.body)),quota:{raw:'private-synthetic-marker'}},{status:502});}});
  assert.equal(calls,1);assert.equal(unsafe.endpointStop,'evaluation_invalid_response');assert.doesNotMatch(JSON.stringify(unsafe),/private-synthetic-marker/);
});

test('API keeps the new profile disabled and case-scoped, and passes bounded HTTP failure metadata through without raw data', async () => {
  const env=globalThis.__annotatedEvidenceTestEnv,originalFetch=globalThis.fetch;let calls=0;
  const body={caseId:'word-02',provider:'google',comparison:'annotated-evidence-v1'};
  const request=(value=body,token=config.evaluationToken,origin=config.origin)=>new Request(config.origin+'/api/english-accuracy-evaluation',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-English-Accuracy-Token':token},body:JSON.stringify(value)});
  globalThis.fetch=async()=>{calls++;return Response.json(envelope('google'));};
  try {
    assert.equal((await helper.POST(request())).status,404);
    Object.assign(env,{english_accuracy_token:config.evaluationToken,english_accuracy_expires:new Date(Date.now()+600000).toISOString(),google_api:'synthetic',groq_api:'synthetic'});
    assert.equal((await helper.POST(request())).status,404);env.english_accuracy_profile='counted-evidence-v1';assert.equal((await helper.POST(request())).status,400);
    env.english_accuracy_profile='annotated-evidence-v1';assert.equal((await helper.POST(request(body,'e'.repeat(64)))).status,401);
    assert.equal((await helper.POST(request(body,config.evaluationToken,'https://other.invalid'))).status,403);
    assert.equal((await helper.POST(request({...body,caseId:'not-planned'}))).status,400);
    assert.equal((await helper.POST(request({...body,sentence:'private-synthetic-marker'}))).status,400);assert.equal(calls,0);
    for(const provider of ['google','groq']) {
      globalThis.fetch=async()=>{calls++;return Response.json({error:{status:'RESOURCE_EXHAUSTED',message:'private-synthetic-marker'}},{status:429,headers:{'retry-after':'30.2','x-ratelimit-remaining-tokens':'0','x-ratelimit-reset-tokens':'2m59.56s'}});};
      const response=await helper.POST(request({...body,provider})),safe=await response.json();
      assert.equal(response.status,429);assert.equal(safe.retryAfterSeconds,31);assert.deepEqual(safe.quota,{remainingTokens:0,resetTokensSeconds:180});
      assert.equal(safe.comparison,'annotated-evidence-v1');assert.doesNotMatch(JSON.stringify(safe),/private-synthetic-marker|RESOURCE_EXHAUSTED/);
    }
    const before=calls;env.english_accuracy_expires=new Date(Date.now()-1000).toISOString();assert.equal((await helper.POST(request())).status,404);
    env.english_accuracy_expires=new Date(Date.now()+86500000).toISOString();assert.equal((await helper.POST(request())).status,404);assert.equal(calls,before);
  } finally {globalThis.fetch=originalFetch;for(const key of Object.keys(env))delete env[key];}
});

test('collector preserves known Google minute/day limit codes instead of replacing them with a generic429', async () => {
  for(const code of ['provider_minute_limit','provider_daily_limit']) {
    const ledger=fresh();let calls=0;
    await collectAnnotatedEvidence(context(ledger),{...clock(),fetcher:async(_url,init)=>{calls++;const row=JSON.parse(init.body);
      return Response.json({...row,code:row.provider==='google'?code:'groq_limit',providerStatus:429,retryAfterSeconds:60,quota:{}},{status:429});
    }});
    assert.equal(calls,2);assert.equal(ledger.providerStops.google,code);assert.equal(ledger.attempts[0].code,code);validateAnnotatedLedger(ledger,expected,helpers);
  }
});
