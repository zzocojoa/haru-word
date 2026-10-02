import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const digest=v=>createHash('sha256').update(v.replace(/\r\n/g,'\n')).digest('hex');
const cohort='work/english-accuracy/coherent-feedback-v1/';
// Isolated synthetic checkout/helper: never reads actual authorizations,
// historic private ledgers or fixture payloads. All fetch is replaced locally.
function setup(){
  mkdirSync('work',{recursive:true});const dir=mkdtempSync(resolve('work/coherent-cli-'));
  const put=(path,value)=>{mkdirSync(dirname(resolve(dir,path)),{recursive:true});writeFileSync(resolve(dir,path),typeof value==='string'?value:JSON.stringify(value));};
  const get=path=>JSON.parse(readFileSync(resolve(dir,path),'utf8'));
  const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true}).trim();
  put('scripts/evaluate-coherent-feedback.mjs',readFileSync('scripts/evaluate-coherent-feedback.mjs','utf8'));
  put('scripts/evaluate-english-accuracy.mjs',readFileSync('scripts/evaluate-english-accuracy.mjs','utf8'));
  put('package.json',{type:'module'});put('.gitignore','work/\n.sites-runtime/\n');
  const fixture='{"syntheticOnly":true}',prior='{"syntheticOnly":true,"totalCalls":826}';
  put('tests/fixtures/english-accuracy.json',fixture);put('data/evaluations/synthetic-prior.json',prior);
  const plan={comparison:'coherent-feedback-v1',fixtureContentHash:digest(fixture),priorReport:'data/evaluations/synthetic-prior.json',priorReportContentHash:digest(prior)};
  put('data/evaluations/coherent-feedback-plan.json',plan);
  put('lib/coherent-feedback-evaluation.ts',`export const coherentFeedbackCases=Array.from({length:60},(_,i)=>({id:'synthetic-'+i,sentence:'Synthetic '+i+'.'}));
export const coherentFeedbackSchedule=()=>coherentFeedbackCases.flatMap(c=>['google','groq'].map(provider=>({caseId:c.id,provider})));
export const coherentFeedbackProfile=async(c,p)=>({requestHash:'a'.repeat(64),promptHash:'b'.repeat(64)});
export const accuracyModels={google:'synthetic-google',groq:'synthetic-groq'},sentenceFeedbackSchema={parse:v=>v},FEEDBACK_ISSUES={provider_limit:true,groq_limit:true},FEEDBACK_VALIDATION_STAGES=[],FEEDBACK_DIAGNOSTICS=[];
export const parseFeedbackValidationDetail=()=>undefined,parseTokenEvidenceQuota=()=>undefined;`);
  put('preload.mjs',`import{readFileSync,writeFileSync}from'node:fs';const mode=process.env.SYNTHETIC_MODE;let calls=0;
globalThis.setTimeout=(fn)=>{queueMicrotask(fn);return 1;};
globalThis.fetch=async(url,init)=>{calls++;writeFileSync('work/network.json',JSON.stringify({calls}));if(!String(url).endsWith('/api/english-accuracy-evaluation'))throw Error('No real HTTP');const row=JSON.parse(init.body);
if(row.caseId==='preflight-invalid-case')return Response.json({code:'evaluation_invalid_case'},{status:mode==='preflight'?503:400});
if(mode==='protocol')return Response.json({});if(mode==='interrupt')process.emit('SIGINT');
return Response.json({...row,requestHash:'a'.repeat(64),durationMs:1,code:row.provider==='google'?'provider_limit':'groq_limit',providerStatus:429},{status:429});};`);
  git(['init']);git(['add','.']);git(['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-m','Synthetic coherent CLI']);
  const sourceCommit=git(['rev-parse','HEAD']);
  const auth={comparison:plan.comparison,approvedCalls:120,previousCalls:826,maximumTotalCalls:946,sourceCommit,planHash:hash(plan),freeTierConfirmation:'human-user-existing-accounts',humanAuthorization:'additional-120-free-coherent-calls',approvedAt:new Date(Date.now()-1000).toISOString(),runInitialized:false};
  put(cohort+'authorization.json',auth);
  const config={origin:'https://wordgrain-oxford-study.hoihou-o.chatgpt.site',token:'f'.repeat(64),siteToken:'synthetic-private-marker',sourceCommit};
  const run=(mode='quota',args=[],ci=false)=>{const env={...process.env,SYNTHETIC_MODE:mode};if(ci)env.CI='true';else delete env.CI;
    const result=spawnSync(process.execPath,['--import','./preload.mjs','scripts/evaluate-coherent-feedback.mjs',...args],{cwd:dir,env,input:JSON.stringify(config)+'\n',encoding:'utf8',windowsHide:true,timeout:30000});
    assert.doesNotMatch(result.stdout+result.stderr,/synthetic-private-marker|"token"/);assert.equal(result.signal,null);return result;};
  return{put,get,run,auth,dir,config,git,network:()=>existsSync(resolve(dir,'work/network.json'))?get('work/network.json').calls:0};
}
test('live CLI refuses CI/arguments before network or authorization consumption',()=>{
  for(const mode of ['ci','args']){const s=setup();assert.equal(s.run('quota',mode==='args'?['--live']:[],mode==='ci').status,1);assert.equal(s.network(),0);assert.equal(s.get(cohort+'authorization.json').runInitialized,false);}
});
test('live CLI rejects old or consumed approval, changed frozen evidence and dirty source before HTTP',()=>{
  for(const mode of ['old','consumed','fixture','dirty']){const s=setup();
    if(mode==='old')s.put(cohort+'authorization.json',{...s.auth,approvedCalls:20});if(mode==='consumed')s.put(cohort+'authorization.json',{...s.auth,runInitialized:true});
    if(mode==='fixture'){s.put('tests/fixtures/english-accuracy.json','{}');s.git(['add','.']);s.git(['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-m','Changed fixture']);const sourceCommit=s.git(['rev-parse','HEAD']);s.config.sourceCommit=sourceCommit;s.put(cohort+'authorization.json',{...s.auth,sourceCommit});}
    if(mode==='dirty')s.put('package.json',{type:'module',changed:true});
    assert.equal(s.run().status,1);assert.equal(s.network(),0);
  }
});
test('exclusive global lock and existing ledger prevent reset without any HTTP',()=>{
  for(const mode of ['lock','ledger']){const s=setup();s.put(mode==='lock'?'.sites-runtime/english-accuracy/running.lock':cohort+'ledger.json',{sentinel:true});assert.equal(s.run().status,1);assert.equal(s.network(),0);assert.equal(s.get(cohort+'authorization.json').runInitialized,false);}
});
test('preflight failure consumes authorization, writes terminal zero-slot blind output and removes lock',()=>{
  const s=setup();assert.equal(s.run('preflight').status,0);assert.equal(s.network(),1);assert.equal(s.get(cohort+'authorization.json').runInitialized,true);
  const ledger=s.get(cohort+'ledger.json');assert.equal(ledger.completed,true);assert.equal(ledger.attempts.length,0);assert.equal(s.get(cohort+'blind.json').length,0);assert.equal(existsSync(resolve(s.dir,'.sites-runtime/english-accuracy/running.lock')),false);
});
test('provider stops count two calls, terminal output is blinded and rerun cannot spend more slots',()=>{
  const s=setup();assert.equal(s.run().status,0);assert.equal(s.network(),3);const ledger=s.get(cohort+'ledger.json');assert.equal(ledger.attempts.length,2);assert.equal(ledger.previousCalls,826);assert.equal(ledger.maximumCalls,120);assert.equal(ledger.completed,true);
  assert.equal(s.get(cohort+'blind.json').length,2);assert.equal(s.run().status,1);assert.equal(s.network(),3);
});
test('protocol failure or SIGINT leaves one counted terminal slot and blind output',()=>{
  for(const mode of ['protocol','interrupt']){const s=setup();assert.equal(s.run(mode).status,0);assert.equal(s.network(),2);const ledger=s.get(cohort+'ledger.json');assert.equal(ledger.attempts.length,1);assert.equal(ledger.completed,true);assert.equal(s.get(cohort+'blind.json').length,1);assert.equal(existsSync(resolve(s.dir,'.sites-runtime/english-accuracy/running.lock')),false);}
});
