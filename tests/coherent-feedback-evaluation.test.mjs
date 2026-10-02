import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {collectCoherent,validateCoherentConfig} from '../scripts/evaluate-coherent-feedback.mjs';
import {reviewBundle} from '../scripts/evaluate-english-accuracy.mjs';
globalThis.__coherentEnv={};
const compiled=await build({stdin:{contents:`export * from './lib/coherent-feedback-evaluation'; export {POST} from './app/api/english-accuracy-evaluation/route'; export {generateSentenceFeedbackWithFallback} from './lib/feedback-fallback'; export {generateGrammarFeedback} from './lib/grammar/feedback'; export {LESSON_MAP} from './lib/grammar/content'; export {lessonForVersion} from './lib/grammar/content-v3';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'fake-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const env=globalThis.__coherentEnv;',loader:'js'}));}}]});
const h=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const plan=JSON.parse(readFileSync('data/evaluations/coherent-feedback-plan.json','utf8'));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const digest=f=>createHash('sha256').update(readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const wire={analysis:{target:{reason:'ambiguous',originalSpan:''},grammar:{status:'uncertain'},structure:{status:'unavailable',note:'ambiguous'}}};
const envelope=(p)=>p==='google'?{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(wire)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:200,totalTokenCount:300}}:{model:h.accuracyModels.groq,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}};
const config={origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',token:'a'.repeat(64),sourceCommit:'b'.repeat(40)};
const auth={comparison:plan.comparison,approvedCalls:120,previousCalls:826,maximumTotalCalls:946,sourceCommit:config.sourceCommit,planHash:hash(plan),freeTierConfirmation:plan.freeTierConfirmation,humanAuthorization:plan.authorization,runInitialized:false,approvedAt:new Date(Date.now()-1000).toISOString()};
const schedule=h.coherentFeedbackSchedule(),profiles={};
for(const row of schedule)profiles[`${row.caseId}/${row.provider}`]=await h.coherentFeedbackProfile(h.coherentFeedbackCases.find(c=>c.id===row.caseId),row.provider);
test('new cohort binds60 fixed cases, unchanged826 evidence, no actual authorization and full publication gate',()=>{
  assert.equal(schedule.length,120);assert.equal(new Set(schedule.map(JSON.stringify)).size,120);assert.equal(h.coherentFeedbackCases.filter(c=>c.domain==='word').length,40);
  assert.deepEqual(plan.caseIds,h.coherentFeedbackCases.map(c=>c.id));assert.deepEqual(plan.models,h.accuracyModels);
  assert.equal(plan.previousCalls,826);assert.equal(plan.maximumTotalCalls,946);assert.equal(plan.maximumCalls,120);
  assert.equal(digest(plan.priorReport),plan.priorReportContentHash);assert.equal(digest('tests/fixtures/english-accuracy.json'),plan.fixtureContentHash);
  assert.equal(plan.publicationGate.perProviderPasses,54);assert.equal(plan.publicationGate.original17Resolved,true);
});
test('all120 synthetic evaluation requests equal enabled learner requests and preserve operating defaults',async()=>{
  for(const row of schedule){const sample=h.coherentFeedbackCases.find(c=>c.id===row.caseId),requests=[];
    const fetcher=async(url,init)=>{requests.push({url:String(url),body:JSON.parse(init.body)});return Response.json(envelope(row.provider));};
    const result=await h.evaluateCoherentFeedbackCase({google_api:'private-marker',groq_api:'private-marker'},row.provider,sample,fetcher);
    const keys={feedback_coherent_enabled:'true',...(row.provider==='google'?{google_api:'private-marker'}:{groq_api:'private-marker'})};
    if(sample.domain==='word')await h.generateSentenceFeedbackWithFallback(keys,{word:sample.word,pos:sample.pos,meaning:sample.meaning,sentence:sample.sentence},fetcher);
    else await h.generateGrammarFeedback(keys,h.lessonForVersion(h.LESSON_MAP.get(sample.lessonId),3),sample.sentence,fetcher);
    assert.deepEqual(requests[0],requests[1]);assert.equal(result.requestHash,hash(requests[0]));assert.equal(result.requestHash,profiles[`${row.caseId}/${row.provider}`].requestHash);
    assert.equal(result.promptHash,profiles[`${row.caseId}/${row.provider}`].promptHash);assert.equal(requests.length,2);
    if(row.provider==='google'){assert.equal(requests[0].body.generationConfig.thinkingConfig,undefined);assert.equal(requests[0].body.generationConfig.maxOutputTokens,4096);}
    else{assert.equal(requests[0].body.reasoning_effort,'low');assert.equal(requests[0].body.max_completion_tokens,4096);}
    assert.doesNotMatch(JSON.stringify(result),/private-marker/);
  }
});
test('coherent approval rejects old budgets, initialized runs, wrong origin and hidden-config additions',()=>{
  assert.doesNotThrow(()=>validateCoherentConfig(config,auth,config.sourceCommit,auth.planHash));
  for(const change of [{approvedCalls:20},{previousCalls:806},{maximumTotalCalls:926},{runInitialized:true},{comparison:'reasoning-pilot-v1'},{planHash:'d'.repeat(64)},{humanAuthorization:'old'}])assert.throws(()=>validateCoherentConfig(config,{...auth,...change},config.sourceCommit,auth.planHash));
  for(const change of [{origin:'https://example.com'},{extra:'private-marker'},{siteToken:'\r\nprivate-marker'},{siteToken:'a'.repeat(8193)}])assert.throws(()=>validateCoherentConfig({...config,...change},auth,config.sourceCommit,auth.planHash));
});
test('endpoint exact profile, token, origin, expiry, bounded body and fixed input guard precede HTTP',async()=>{
  const env=globalThis.__coherentEnv,original=globalThis.fetch;let calls=0;
  const body={comparison:plan.comparison,caseId:plan.caseIds[0],provider:'google'};
  const req=(value=body,headers={})=>new Request(config.origin+'/api/english-accuracy-evaluation',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json','X-English-Accuracy-Token':config.token,...headers},body:JSON.stringify(value)});
  try{globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'private-marker',status:'RESOURCE_EXHAUSTED'}},{status:429,headers:{'x-ratelimit-remaining-tokens':'0'}});};
    assert.equal((await h.POST(req())).status,404);
    Object.assign(env,{english_accuracy_token:config.token,english_accuracy_expires:new Date(Date.now()+3600000).toISOString(),google_api:'synthetic',groq_api:'synthetic'});
    assert.equal((await h.POST(req())).status,404);env.english_accuracy_profile=plan.comparison;
    for(const [request,status]of [[req({...body,caseId:'invalid'}),400],[req({...body,variant:'high'}),400],[req({...body,sentence:'arbitrary'}),400],[req({...body,sentence:'x'.repeat(1500)}),400],[req({...body,comparison:'reasoning-pilot-v1',variant:'high'}),400],[req(body,{'X-English-Accuracy-Token':'z'.repeat(64)}),401],[req(body,{Origin:'https://example.com'}),403]])assert.equal((await h.POST(request)).status,status);
    assert.equal(calls,0);const value=await(await h.POST(req())).json();assert.equal(calls,1);assert.equal(value.requestHash,profiles[`${body.caseId}/google`].requestHash);assert.equal(value.providerStatus,429);assert.deepEqual(value.quota,{remainingTokens:0});assert.doesNotMatch(JSON.stringify(value),/private-marker/);
    env.english_accuracy_expires=new Date(Date.now()-1000).toISOString();assert.equal((await h.POST(req())).status,404);assert.equal(calls,1);
  }finally{globalThis.fetch=original;for(const key of Object.keys(env))delete env[key];}
});
const fresh=()=>({attempts:[],completed:false});
test('collector validates whole schedule/profiles before consuming anything; cannot resume/reset',async()=>{
  for(const change of ['schedule','profile','extra']){const ledger=fresh(),p={...profiles},s=[...schedule];let calls=0;
    if(change==='schedule')s[119]=s[118];if(change==='profile')delete p[`${s[119].caseId}/${s[119].provider}`];if(change==='extra')p.extra=profiles[Object.keys(profiles)[0]];
    await assert.rejects(collectCoherent({ledger,schedule:s,profiles:p,helper:h,config},{save:()=>{},fetcher:async()=>{calls++;}}));assert.equal(calls,0);assert.equal(ledger.attempts.length,0);
  }
  await assert.rejects(collectCoherent({ledger:{attempts:[{}],completed:false},schedule,profiles,helper:h,config},{save:()=>{}}));
  await assert.rejects(collectCoherent({ledger:{attempts:[],completed:true},schedule,profiles,helper:h,config},{save:()=>{}}));
});
test('collector counts all120 durable synthetic responses once and blinds provider/model/time',async()=>{
  const ledger=fresh();let calls=0,saved=0;
  await collectCoherent({ledger,schedule,profiles,helper:h,config},{save:()=>{saved=ledger.attempts.length;},wait:async()=>{},fetcher:async(_url,init)=>{
    calls++;assert.equal(saved,calls);assert.equal(init.redirect,'error');const row=JSON.parse(init.body),sample=h.coherentFeedbackCases.find(c=>c.id===row.caseId);
    return Response.json({...row,...profiles[`${row.caseId}/${row.provider}`],durationMs:1,usage:{totalTokens:300,raw:'private-marker'},quota:{remainingTokens:100},feedback:{meaningUsage:'uncertain',grammar:'uncertain',correctedSentence:'',explanation:'문맥 확인 필요',structure:{status:'unavailable',translation:'',parts:[],note:'문맥 확인 필요'},original:sample.sentence,model:h.accuracyModels[row.provider],createdAt:new Date().toISOString()}});
  }});
  assert.equal(calls,120);assert.equal(ledger.attempts.filter(a=>a.status==='response').length,120);assert.equal(ledger.completed,true);assert.doesNotMatch(JSON.stringify(ledger),/private-marker/);
  const blind=reviewBundle(ledger.attempts,12);assert.equal(blind.blinded.length,120);assert.doesNotMatch(JSON.stringify(blind.blinded),/provider|model|createdAt|requestHash|promptHash/);
});
test('quota stops each provider; transport/protocol/network ambiguity and pacing interruption stop globally',async()=>{
  for(const mode of ['quota','transport','protocol','network','interrupt']){const ledger=fresh();let calls=0;const stop=new AbortController();
    await collectCoherent({ledger,schedule,profiles,helper:h,config},{save:()=>{},signal:stop.signal,wait:async()=>{if(mode==='interrupt')stop.abort();},fetcher:async(_url,init)=>{
      calls++;if(mode==='transport')throw Error('private-marker');if(mode==='protocol')return Response.json({});const row=JSON.parse(init.body);
      return Response.json({...row,requestHash:profiles[`${row.caseId}/${row.provider}`].requestHash,durationMs:1,code:mode==='network'?'provider_network':row.provider==='google'?'provider_limit':'groq_limit',providerStatus:mode==='network'?503:429,usage:{},validationDetail:{private:'private-marker'}},{status:mode==='network'?503:429});
    }});
    assert.equal(calls,mode==='quota'?2:1);assert.equal(ledger.attempts.length,calls);assert.equal(ledger.completed,true);assert.ok(ledger.finishedAt);assert.doesNotMatch(JSON.stringify(ledger),/private-marker/);
    if(mode==='interrupt')assert.equal(ledger.endpointStop,'interrupted');
  }
});

