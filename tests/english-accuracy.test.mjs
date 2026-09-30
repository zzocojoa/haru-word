import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { evaluationBudget, evaluationProfiles, evaluationNeedsCalls, blindAttempt, reviewBundle } from '../scripts/evaluate-english-accuracy.mjs';
mkdirSync('work/accuracy-tests', { recursive: true });
await build({entryPoints:['lib/english-accuracy.ts','app/api/english-accuracy-evaluation/route.ts'],outdir:'work/accuracy-tests',entryNames:'[name]',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'environment',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const env=globalThis.accuracyEnv',loader:'js'}));}}]});
const helper=await import('../work/accuracy-tests/english-accuracy.mjs');
globalThis.accuracyEnv={};
const route=await import('../work/accuracy-tests/route.mjs');
const fixture=JSON.parse(readFileSync('tests/fixtures/english-accuracy.json','utf8'));
test('preregistered synthetic set has exact distribution, official references and semantic criteria',()=>{
 const counts={word:0,grammar:0,natural:0,needs_work:0,uncertain:0},seen=new Set();
 for(const c of fixture.cases){counts[c.domain]++;counts[c.category]++;assert.ok(!seen.has(c.id));seen.add(c.id);
  assert.ok(c.references.length);for(const ref of c.references)assert.equal(new URL(ref.url).hostname,'dictionary.cambridge.org');
  assert.ok(c.expected.correction.conditions.length);assert.ok(c.expected.structure.conditions.length);
  if(c.category==='uncertain'){assert.equal(c.expected.correction.policy,'withhold');assert.deepEqual(c.expected.structure.status,['unavailable']);}
  else assert.ok(c.expected.structure.facts.length);
 }
 assert.deepEqual(counts,{word:40,grammar:20,natural:30,needs_work:20,uncertain:10});assert.equal(seen.size,60);
});
test('grammar request extraction preserves published baseline instruction exactly',async()=>{
 // Recorded against the shipped v85 grammar instruction + structure instruction.
 for(const c of helper.accuracyCases.filter(c=>c.domain==='grammar'))assert.equal(await helper.accuracyPromptHash(helper.accuracyRequest(c).instruction),'027d4bc9a41dcb665aafe9023c42ca8c2954dcc028e1bced1862fe73dd636dd5');
 for(const c of helper.accuracyCases){const r=helper.accuracyRequest(c);assert.equal(r.input.sentence,c.sentence);assert.equal('expected' in r.input,false);assert.equal('references' in r.input,false);}
});
test('direct comparison uses a single selected provider even when it fails',async()=>{
 for(const provider of ['google','groq']){let calls=0;
  await assert.rejects(helper.evaluateAccuracyCase({google_api:'test-only',groq_api:'test-only'},provider,helper.accuracyCases[0],async(url)=>{calls++;assert.equal(url.includes('googleapis'),provider==='google');return new Response('{}',{status:429});}));
  assert.equal(calls,1);
 }
});
test('budget counts failed/started attempts, allows only one full second round, never retries',()=>{
 const records=Array.from({length:120},()=>({round:1,status:'failure'}));
 assert.throws(()=>evaluationBudget(records,1));assert.doesNotThrow(()=>evaluationBudget(records,2));
 assert.equal(evaluationNeedsCalls(records,1),false);assert.equal(evaluationNeedsCalls(records,2),true);
 assert.throws(()=>evaluationBudget(records.slice(0,119),2));assert.throws(()=>evaluationBudget([...records,...Array.from({length:120},()=>({round:2,status:'started'}))],2));
 assert.throws(()=>execFileSync(process.execPath,['scripts/evaluate-english-accuracy.mjs'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}),error=>error.status===1 && error.stderr.includes('Evaluation stopped'));
});
test('evaluation endpoint is disabled by default, expiring, authenticated and fixed-input only',async()=>{
 let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('must not call');};
 const token='a'.repeat(64),req=(body={caseId:'word-01',provider:'google',round:1},secret=token)=>new Request('https://study.example/api/english-accuracy-evaluation',{method:'POST',headers:{origin:'https://study.example','content-type':'application/json','x-english-accuracy-token':secret},body:JSON.stringify(body)});
 try{
  assert.equal((await route.POST(req())).status,404);
  for(const expires of ['invalid',new Date(Date.now()-1000).toISOString(),new Date(Date.now()+90_000_000).toISOString()]){accuracyEnv.english_accuracy_token=token;accuracyEnv.english_accuracy_expires=expires;assert.equal((await route.POST(req())).status,404);}
  accuracyEnv.english_accuracy_expires=new Date(Date.now()+3600_000).toISOString();assert.equal((await route.POST(req(undefined,'b'.repeat(64)))).status,401);
  for(const body of [{caseId:'other',provider:'google',round:1},{caseId:'word-01',provider:'unknown',round:1},{caseId:'word-01',provider:'google',round:3},{caseId:'word-01',provider:'google',round:1,sentence:'arbitrary'}])assert.equal((await route.POST(req(body))).status,400);
  assert.equal((await route.POST(req())).status,503);assert.equal(calls,0);
 }finally{globalThis.fetch=original;delete globalThis.accuracyEnv;}
});
test('resume pins fixture, domain prompt and models; second round requires a real revision',()=>{
 const profiles={word:{promptHash:'word',models:{google:'g',groq:'q'}},grammar:{promptHash:'grammar',models:{google:'g',groq:'q'}}};
 const record={round:1,domain:'word',provider:'google',fixtureHash:'fixture',promptHash:'word',expectedModel:'g'};
 assert.doesNotThrow(()=>evaluationProfiles([record],1,'fixture',profiles));
 assert.throws(()=>evaluationProfiles([record],1,'different',profiles));
 for(const changed of [{promptHash:'changed'},{expectedModel:'changed'}])assert.throws(()=>evaluationProfiles([{...record,...changed}],1,'fixture',profiles));
 assert.throws(()=>evaluationProfiles([record],2,'fixture',profiles));
 assert.throws(()=>evaluationProfiles([record],2,'fixture',{...profiles,word:{promptHash:'revision',models:{google:'changed',groq:'q'}}}));
 assert.doesNotThrow(()=>evaluationProfiles([record],2,'fixture',{...profiles,word:{...profiles.word,promptHash:'revision'}}));
});
test('blinded records omit provider identifiers, model, time and provider failure codes',()=>{
 const feedback={original:'I walk.',model:'google-model',createdAt:'2026-09-30T01:00:00Z'};
 const blind=blindAttempt({number:1,caseId:'word-01',status:'response',provider:'google',feedback});
 assert.deepEqual(blind.feedback,{original:'I walk.'});assert.equal('provider' in blind,false);
 const failure=blindAttempt({number:2,caseId:'word-01',status:'failure',provider:'groq',code:'groq_limit',startedAt:'time'});
 assert.equal(failure.code,'transport_or_provider_failure');assert.equal('startedAt' in failure,false);assert.equal('model' in feedback,true);
});
test('complete-round recovery reuses one authoritative blind/mapping bundle without reshuffling',()=>{
 const attempts=[{round:1,number:1,caseId:'word-01',provider:'google',status:'failure'},{round:1,number:2,caseId:'word-01',provider:'groq',status:'failure'}];
 const bundle=reviewBundle(attempts,1);assert.equal(reviewBundle(attempts,1,bundle),bundle);
 for(const row of bundle.blinded){const mapped=bundle.mapping.find(m=>m.label===row.label);assert.equal(attempts.find(a=>a.number===mapped.number).caseId,row.caseId);assert.equal('number' in row,false);}
 assert.notEqual(reviewBundle([...attempts,{round:1,number:3,caseId:'word-02',status:'failure'}],1,bundle).ledgerHash,bundle.ledgerHash);
});
test('CLI restores complete baseline after prompt changes without project files or any HTTP',()=>{
 const directory=mkdtempSync(join(tmpdir(),'haru-accuracy-test-')),store=join(directory,'.sites-runtime','english-accuracy');mkdirSync(store,{recursive:true});
 const attempts=Array.from({length:120},(_,i)=>({number:i+1,round:1,caseId:`case-${i}`,status:'failure',fixtureHash:'old',promptHash:'old'}));
 writeFileSync(join(store,'ledger.json'),JSON.stringify({attempts}));
 const guard=join(directory,'no-http.mjs');writeFileSync(guard,"globalThis.fetch=()=>{throw Error('No HTTP allowed during recovery')};");
 try{
  const output=execFileSync(process.execPath,['--import',pathToFileURL(guard).href,resolve('scripts/evaluate-english-accuracy.mjs'),'--live','--round','1'],{cwd:directory,encoding:'utf8',input:JSON.stringify({origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',evaluationToken:'a'.repeat(64)})+'\n'});
  assert.equal(JSON.parse(output).complete,true);assert.equal(JSON.parse(readFileSync(join(store,'blind-round-1.json'),'utf8')).length,120);
  assert.deepEqual(JSON.parse(readFileSync(join(store,'ledger.json'),'utf8')).attempts,attempts);
 }finally{assert.ok(realpathSync(directory).startsWith(realpathSync(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
