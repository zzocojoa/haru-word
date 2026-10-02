import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { collectPilot, validatePilotConfig } from '../scripts/evaluate-reasoning-pilot.mjs';
globalThis.__reasoningEnv = {};
const compiled = await build({ stdin: { contents: `export * from './lib/reasoning-pilot-evaluation'; export {POST} from './app/api/english-accuracy-evaluation/route';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'fake-env', setup(b) { b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fake'})); b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const env=globalThis.__reasoningEnv;',loader:'js'})); } }] });
const h = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const plan = JSON.parse(readFileSync('data/evaluations/reasoning-pilot-plan.json', 'utf8'));
const wire = { meaningUsage: 'uncertain', grammar: 'uncertain', correctedSentence: '', explanation: '문맥 확인 필요', structure: { status: 'unavailable', translation: '', parts: [], note: '문맥 확인 필요' } };
const envelope = (provider, text) => provider === 'google' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 20, totalTokenCount: 320 } } : { model: h.accuracyModels.groq, choices: [{ finish_reason: 'stop', message: { content: text } }], usage: { prompt_tokens: 100, completion_tokens: 220, completion_tokens_details: { reasoning_tokens: 20 }, total_tokens: 320 } };
test('pilot freezes20 distinct slots, five authored cases, unchanged prior806 and models', async () => {
  assert.equal(plan.previousCalls, 806); assert.equal(plan.maximumCalls, 20); assert.equal(plan.maximumTotalCalls, 826);
  assert.deepEqual(plan.caseIds, h.reasoningPilotCases.map(c => c.id));
  assert.equal(h.reasoningPilotSchedule().length, 20); assert.equal(new Set(h.reasoningPilotSchedule().map(JSON.stringify)).size, 20);
  assert.deepEqual(plan.models, h.accuracyModels);
  const digest = file => createHash('sha256').update(readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
  assert.equal(digest(plan.priorReport), plan.priorReportContentHash); assert.equal(digest('tests/fixtures/english-accuracy.json'), plan.fixtureContentHash);
});
test('only reasoning differs between actual operating requests; hashes exclude keys', async () => {
  for (const provider of ['google','groq']) for (const sample of h.reasoningPilotCases) {
    const requests = [], results = [];
    for (const variant of ['current','high']) {
      results.push(await h.evaluateReasoningPilotCase({google_api:'private-marker',groq_api:'private-marker'}, provider, sample, variant, async (_url, init) => {
        requests.push(JSON.parse(init.body)); return Response.json(envelope(provider, JSON.stringify(wire)));
      }));
      const profile = await h.reasoningPilotProfile(sample, provider, variant);
      assert.equal(profile.requestHash, results.at(-1).requestHash);
      assert.match(profile.promptHash, /^[a-f0-9]{64}$/);
      assert.equal(results.at(-1).feedback.original, sample.sentence); assert.equal(results.at(-1).usage.reasoningTokens, 20);
    }
    const [current, high] = requests;
    if (provider === 'google') { assert.equal(current.generationConfig.thinkingConfig, undefined); assert.deepEqual(high.generationConfig.thinkingConfig,{thinkingLevel:'HIGH'}); delete high.generationConfig.thinkingConfig; }
    else { assert.equal(current.reasoning_effort,'low'); assert.equal(high.reasoning_effort,'high'); high.reasoning_effort='low'; }
    assert.deepEqual(current, high); assert.notEqual(results[0].requestHash, results[1].requestHash);
    assert.doesNotMatch(JSON.stringify(results), /private-marker/);
  }
});
test('HTTP failure is one call and contains numeric quota, exact hash and no raw errors', async () => {
  for (const provider of ['google','groq']) {
    let calls = 0;
    await assert.rejects(h.evaluateReasoningPilotCase({google_api:'fake',groq_api:'fake'},provider,h.reasoningPilotCases[0],'high', async () => { calls++; return Response.json({error:{status:'RESOURCE_EXHAUSTED',message:'private-marker'}},{status:429,headers:{'x-ratelimit-remaining-tokens':'0'}}); }), e => {
      assert.ok(e instanceof h.ReasoningPilotError); assert.match(e.evidence.requestHash,/^[a-f0-9]{64}$/); assert.deepEqual(e.evidence.quota,{remainingTokens:0}); assert.doesNotMatch(JSON.stringify(e),/private-marker/); return true;
    }); assert.equal(calls,1);
  }
});
const config = {origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',token:'a'.repeat(64),sourceCommit:'b'.repeat(40)};
const auth = {comparison:'reasoning-pilot-v1',approvedCalls:20,previousCalls:806,maximumTotalCalls:826,sourceCommit:config.sourceCommit,planHash:'c'.repeat(64),freeTierConfirmation:'human-user-existing-accounts',humanAuthorization:'human-user-2026-10-02-proceed-reasoning-comparison',runInitialized:false,approvedAt:new Date(Date.now()-1000).toISOString()};
test('approval rejects old120, consumed/reset runs and other origins', () => {
  assert.doesNotThrow(()=>validatePilotConfig(config,auth,config.sourceCommit,auth.planHash));
  for(const changed of [{approvedCalls:120},{previousCalls:735},{runInitialized:true},{comparison:'relational-evidence-v1'},{planHash:'d'.repeat(64)},{humanAuthorization:'old-approval'}]) assert.throws(()=>validatePilotConfig(config,{...auth,...changed},config.sourceCommit,auth.planHash));
  assert.throws(()=>validatePilotConfig({...config,origin:'https://example.com'},auth,config.sourceCommit,auth.planHash));
});
test('endpoint exact profile, origin, token, expiry, fixedcase and variant precede any provider HTTP', async () => {
  const env = globalThis.__reasoningEnv, original = globalThis.fetch; let calls=0;
  const body={comparison:'reasoning-pilot-v1',caseId:'grammar-45',provider:'google',variant:'high'};
  const request=(value=body,headers={})=>new Request(config.origin+'/api/english-accuracy-evaluation',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json','X-English-Accuracy-Token':config.token,...headers},body:JSON.stringify(value)});
  try {
    globalThis.fetch=async()=>{calls++;return Response.json({error:{status:'RESOURCE_EXHAUSTED',message:'private-marker'}},{status:429});};
    assert.equal((await h.POST(request())).status,404);
    Object.assign(env,{english_accuracy_token:config.token,english_accuracy_expires:new Date(Date.now()+3600000).toISOString(),english_accuracy_profile:'reasoning-pilot-v1',google_api:'fake',groq_api:'fake'});
    for (const [req,status] of [[request({...body,caseId:'word-01'}),400],[request({...body,variant:'medium'}),400],[request({...body,sentence:'arbitrary'}),400],[request({...body,comparison:'relational-evidence-v1'}),400],[request(body,{'X-English-Accuracy-Token':'z'.repeat(64)}),401],[request(body,{Origin:'https://example.com'}),403]]) assert.equal((await h.POST(req)).status,status);
    assert.equal(calls,0);
    const value=await (await h.POST(request())).json(); assert.equal(calls,1); assert.equal(value.variant,'high'); assert.match(value.requestHash,/^[a-f0-9]{64}$/); assert.doesNotMatch(JSON.stringify(value),/private-marker/);
    env.english_accuracy_expires=new Date(Date.now()-1000).toISOString();assert.equal((await h.POST(request())).status,404);assert.equal(calls,1);
  } finally { globalThis.fetch=original; for(const key of Object.keys(env)) delete env[key]; }
});
test('collector consumes durable slots before HTTP, stops quota providers and never retries or resumes', async () => {
  const schedule=h.reasoningPilotSchedule(),profiles=Object.fromEntries(schedule.map(row=>[`${row.caseId}/${row.provider}/${row.variant}`,{requestHash:'a'.repeat(64),promptHash:'b'.repeat(64)}]));
  const ledger={attempts:[],completed:false};let calls=0,saved=0;
  await collectPilot({ledger,schedule,profiles,helper:h,config},{save:()=>{saved=ledger.attempts.length;},wait:async()=>{},fetcher:async(_url,init)=>{
    calls++; assert.equal(saved,calls);const row=JSON.parse(init.body);return Response.json({...row,requestHash:'a'.repeat(64),durationMs:1,usage:{},code:row.provider==='google'?'provider_limit':'groq_limit',providerStatus:429},{status:429});
  }});
  assert.equal(calls,2);assert.equal(ledger.completed,true);assert.equal(ledger.attempts.length,2);assert.equal(ledger.providerStops.length,2);
  await assert.rejects(collectPilot({ledger,schedule,profiles,helper:h,config},{save:()=>{},fetcher:async()=>{throw Error('No calls');}}));
});
test('collector transport/protocol failure consumes its slot then stops all calls', async()=>{
  const ledger={attempts:[],completed:false},schedule=h.reasoningPilotSchedule(),profiles=Object.fromEntries(schedule.map(row=>[`${row.caseId}/${row.provider}/${row.variant}`,{requestHash:'a'.repeat(64),promptHash:'b'.repeat(64)}]));let calls=0;
  await collectPilot({ledger,schedule,profiles,helper:h,config},{save:()=>{},wait:async()=>{},fetcher:async()=>{calls++;throw Error('private-marker');}});
  assert.equal(calls,1);assert.equal(ledger.attempts.length,1);assert.equal(ledger.attempts[0].code,'collector_transport_or_protocol');assert.doesNotMatch(JSON.stringify(ledger),/private-marker/);
});
test('collector records all20 successful parsed responses, no extra HTTP, no provider details in blind records', async()=>{
  const ledger={attempts:[],completed:false},schedule=h.reasoningPilotSchedule(),profiles=Object.fromEntries(schedule.map(row=>[`${row.caseId}/${row.provider}/${row.variant}`,{requestHash:'a'.repeat(64),promptHash:'b'.repeat(64)}]));let calls=0;
  await collectPilot({ledger,schedule,profiles,helper:h,config},{save:()=>{},wait:async()=>{},fetcher:async(_url,init)=>{
    calls++;assert.equal(init.redirect,'error');const row=JSON.parse(init.body),sample=h.reasoningPilotCases.find(c=>c.id===row.caseId);
    return Response.json({...row,requestHash:'a'.repeat(64),promptHash:'b'.repeat(64),durationMs:1,usage:{totalTokens:320,raw:'private-marker'},feedback:{...wire,original:sample.sentence,model:h.accuracyModels[row.provider],createdAt:new Date().toISOString()}});
  }});
  assert.equal(calls,20);assert.equal(ledger.attempts.length,20);assert.equal(ledger.completed,true);assert.equal(ledger.attempts.filter(a=>a.status==='response').length,20);assert.doesNotMatch(JSON.stringify(ledger),/private-marker/);
});
test('upstream network uncertainty stops globally; interruption during pacing leaves terminal counted slots', async()=>{
  for (const mode of ['network','interrupted']) {
    const ledger={attempts:[],completed:false},schedule=h.reasoningPilotSchedule(),profiles=Object.fromEntries(schedule.map(row=>[`${row.caseId}/${row.provider}/${row.variant}`,{requestHash:'a'.repeat(64),promptHash:'b'.repeat(64)}]));let calls=0;const stop=new AbortController();
    await collectPilot({ledger,schedule,profiles,helper:h,config},{save:()=>{},signal:stop.signal,wait:async()=>{stop.abort(Error('Interrupted'));},fetcher:async(_url,init)=>{
      calls++;const row=JSON.parse(init.body);return Response.json({...row,requestHash:'a'.repeat(64),durationMs:1,usage:{},code:mode==='network'?'provider_network':'provider_limit',providerStatus:mode==='network'?503:429},{status:mode==='network'?503:429});
    }});
    assert.equal(calls,1);assert.equal(ledger.attempts.length,1);assert.equal(ledger.completed,true);assert.ok(ledger.finishedAt);assert.equal(ledger.endpointStop,mode==='network'?'upstream_network_uncertain':'interrupted');
  }
});
