// A separate free-account-confirmed cohort. Never extend or rewrite old ledgers.
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { originalComparisonFixture, verifyOriginalComparisonSource } from './evaluate-original-feedback.mjs';
import { reviewBundle } from './evaluate-english-accuracy.mjs';
const comparison = 'chunked-free-v1', approvedCalls = 120, previousCalls = 360, round = 4;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const atomicJson = (path, value) => { writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path); };
const stops = new Set(['provider_limit', 'provider_minute_limit', 'provider_daily_limit', 'groq_limit', 'groq_billing', 'provider_precondition', 'provider_key_invalid', 'provider_key_blocked', 'provider_permission', 'groq_key_invalid', 'groq_permission']);
export function validateFreeComparison(previous, ledger, expected) {
  if (previous.length !== previousCalls || hash(previous) !== ledger.previousHash || ledger.comparison !== comparison || ledger.approvedCalls !== approvedCalls
      || ledger.freeTierConfirmation !== 'human-user' || ledger.attempts.length > approvedCalls) throw Error('Invalid free cohort context.');
  for (const key of ['fixtureHash', 'fixtureContentHash', 'sourceCommit', 'profiles', 'models']) if (hash(ledger[key]) !== hash(expected[key])) throw Error('Free cohort profile changed.');
  if (!/^[a-f0-9]{40}$/.test(expected.sourceCommit) || !/^[a-f0-9]{64}$/.test(expected.fixtureHash) || !/^[a-f0-9]{64}$/.test(expected.fixtureContentHash) || Object.keys(expected.profiles).length !== 60) throw Error('Invalid source/fixture.');
  for (const p of Object.values(expected.profiles)) if (!['word','grammar'].includes(p.domain) || !/^[a-f0-9]{64}$/.test(p.promptHash) || !/^[a-f0-9]{64}$/.test(p.requestHash)) throw Error('Invalid request profile.');
  const seen = new Set();
  for (const [i, a] of previous.entries()) {
    if (a.number !== i + 1 || ![1,2,3].includes(a.round) || !expected.profiles[a.caseId] || !['google','groq'].includes(a.provider)
        || a.expectedModel !== expected.models[a.provider] || a.fixtureHash !== expected.fixtureHash || !['response','failure'].includes(a.status) || seen.has(`${a.round}:${a.caseId}:${a.provider}`)) throw Error('Invalid parent ledger.');
    seen.add(`${a.round}:${a.caseId}:${a.provider}`);
  }
  seen.clear();
  for (const [i, a] of ledger.attempts.entries()) {
    const p = expected.profiles[a.caseId], key = `${a.caseId}:${a.provider}`;
    if (!p || a.number !== previousCalls+i+1 || a.round !== round || a.comparison !== comparison || !['google','groq'].includes(a.provider)
        || a.domain !== p.domain || a.expectedModel !== expected.models[a.provider] || a.promptHash !== p.promptHash || a.requestHash !== p.requestHash
        || a.fixtureHash !== expected.fixtureHash || a.fixtureContentHash !== expected.fixtureContentHash || seen.has(key) || !['started','response','failure'].includes(a.status)) throw Error('Invalid free cohort attempt.');
    seen.add(key);
  }
  const derivedStops = {};
  for (const a of ledger.attempts) {
    if (derivedStops[a.provider]) throw Error('Attempt after provider stop.');
    if (a.status === 'failure' && stops.has(a.code)) derivedStops[a.provider] = a.code;
  }
  if (hash(derivedStops) !== hash(ledger.providerStops)) throw Error('Invalid provider stop.');
  if (ledger.completed !== undefined && typeof ledger.completed !== 'boolean') throw Error('Invalid completion.');
  if (ledger.completed && !Object.keys(expected.profiles).every(id=>['google','groq'].every(provider=>seen.has(`${id}:${provider}`)||derivedStops[provider]))) throw Error('Incomplete cohort marked complete.');
}
const endpoint = '/api/english-accuracy-evaluation';
const init = (config, body, signal) => ({ method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json',Origin:config.origin,'X-English-Accuracy-Token':config.evaluationToken,
  ...(config.siteToken ? {'OAI-Sites-Authorization':config.siteToken.startsWith('Bearer ')?config.siteToken:`Bearer ${config.siteToken}`} : {})},body:JSON.stringify(body) });
export async function collectFreeComparison(context, options) {
  const {previous,ledger,cases,config,expected,safeCodes,validationStages,diagnostics,parseFeedback}=context;
  const {save,fetcher=fetch,signal,progress=()=>{},pause=ms=>new Promise(r=>setTimeout(r,ms))}=options;
  validateFreeComparison(previous,ledger,expected);
  if (ledger.completed) return;
  for(const sample of cases) for(const provider of ['google','groq']) {
    signal?.throwIfAborted();
    if(ledger.providerStops[provider] || ledger.attempts.some(a=>a.caseId===sample.id&&a.provider===provider))continue;
    if(ledger.attempts.length>=approvedCalls)throw Error('Free cohort budget exhausted.');
    const p=expected.profiles[sample.id],a={number:previousCalls+ledger.attempts.length+1,round,comparison,caseId:sample.id,provider,domain:sample.domain,
      fixtureHash:expected.fixtureHash,fixtureContentHash:expected.fixtureContentHash,expectedModel:expected.models[provider],promptHash:p.promptHash,requestHash:p.requestHash,status:'started',startedAt:new Date().toISOString()};
    ledger.attempts.push(a);save(ledger);
    let delay=3000;
    try {
      const response=await fetcher(config.origin+endpoint,init(config,{caseId:sample.id,provider,comparison},signal?AbortSignal.any([AbortSignal.timeout(30000),signal]):AbortSignal.timeout(30000)));
      a.httpStatus=response.status;let result,feedback;
      try { result=await response.json();feedback=response.ok?parseFeedback(result?.feedback):undefined; }
      catch { result={}; }
      if(response.ok&&result?.comparison===comparison&&result.caseId===sample.id&&result.provider===provider&&result.promptHash===p.promptHash&&result.requestHash===p.requestHash&&feedback?.original===sample.sentence&&feedback.model===a.expectedModel){
        a.status='response';a.feedback=feedback;
        const q=result.quota;
        if(Number.isInteger(q?.remainingTokens)&&q.remainingTokens>=0&&q.remainingTokens<1e9){a.quota={remainingTokens:q.remainingTokens};
          if(q.remainingTokens<6000)delay=60000;
          if(Number.isInteger(q.resetTokensSeconds)&&q.resetTokensSeconds>0&&q.resetTokensSeconds<=86400){a.quota.resetTokensSeconds=q.resetTokensSeconds;if(q.remainingTokens<6000)delay=Math.min(60000,q.resetTokensSeconds*1000);}}
      }else{a.status='failure';a.code=response.status===429?(provider==='groq'?'groq_limit':'provider_limit')
          :(response.status===402||result?.providerStatus===402)?(provider==='groq'?'groq_billing':'provider_precondition')
          :safeCodes.includes(result?.code)?result.code:'evaluation_invalid_response';
        if(Number.isInteger(result?.providerStatus)&&result.providerStatus>=100&&result.providerStatus<=599)a.providerStatus=result.providerStatus;
        if(validationStages.includes(result?.validationStage))a.validationStage=result.validationStage;
        if(diagnostics.includes(result?.diagnostic))a.diagnostic=result.diagnostic;
        if(stops.has(a.code))ledger.providerStops[provider]=a.code;
      }
    }catch{a.status='failure';a.code='evaluation_transport';}
    a.finishedAt=new Date().toISOString();save(ledger);progress({attempts:ledger.attempts.length,responses:ledger.attempts.filter(a=>a.status==='response').length,providerStops:ledger.providerStops});
    // No retry of a consumed slot. A stopped provider remains stopped on resume.
    while(delay>0){signal?.throwIfAborted();const slice=Math.min(delay,30000);await pause(slice);delay-=slice;}
  }
  ledger.completed=Object.keys(expected.profiles).every(id=>['google','groq'].every(provider=>ledger.providerStops[provider]||ledger.attempts.some(a=>a.caseId===id&&a.provider===provider)));save(ledger);
}
async function main(){
  if(!process.argv.includes('--live')||!process.argv.includes('--confirmed-free-tier')||process.argv[process.argv.indexOf('--approved-calls')+1]!=='120'||process.env.CI)throw Error('Approved free cohort required outside CI.');
  if(process.stdin.isTTY){process.stdin.setRawMode(true);console.log('Ready for free comparison JSON on stdin (input is hidden).');}
  const rl=createInterface({input:process.stdin,terminal:false});let config;
  try{config=JSON.parse(await new Promise((ok,no)=>{rl.once('line',ok);rl.once('close',()=>no(Error('Missing configuration.')));}));}finally{rl.close();if(process.stdin.isTTY)process.stdin.setRawMode(false);}
  if(new URL(config.origin).origin!=='https://wordgrain-oxford-study.hoihou-o.chatgpt.site'||!/^[a-f0-9]{64}$/.test(config.evaluationToken)||!/^[a-f0-9]{40}$/.test(config.sourceCommit))throw Error('Invalid configuration.');
  config.origin=new URL(config.origin).origin;
  const root=resolve('.sites-runtime/english-accuracy'),directory=resolve(root,comparison);mkdirSync(directory,{recursive:true});
  const lockPath=resolve(root,'running.lock'),lock=openSync(lockPath,'wx'),stop=new AbortController(),interrupt=()=>stop.abort(Error('Interrupted'));
  process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
  try{
    writeFileSync(lock,JSON.stringify({pid:process.pid,comparison,startedAt:new Date().toISOString()}));
    const legacy=JSON.parse(readFileSync(resolve(root,'ledger.json'))).attempts,original=JSON.parse(readFileSync(resolve(root,'original-first/ledger.json'))).attempts;
    const published=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-01-original-first.json'));
    if(hash(legacy)!==published.previousLedgerHash||hash(original)!==published.ledgerHash)throw Error('Parent history changed.');
    const previous=[...legacy,...original],ledgerPath=resolve(directory,'ledger.json');let ledger=existsSync(ledgerPath)?JSON.parse(readFileSync(ledgerPath)):undefined;
    if(!ledger?.completed){
      verifyOriginalComparisonSource(config.sourceCommit);
      const path=resolve(directory,'requests.mjs');await build({entryPoints:['lib/free-feedback-evaluation.ts'],outfile:path,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
      const helper=await import(pathToFileURL(path).href),profiles={};for(const sample of helper.accuracyCases)profiles[sample.id]={domain:sample.domain,...await helper.freeAccuracyHashes(sample)};
      const expected={...originalComparisonFixture(readFileSync('tests/fixtures/english-accuracy.json','utf8'),published.fixtureHash),sourceCommit:config.sourceCommit,profiles,models:helper.accuracyModels};
      ledger??={comparison,approvedCalls,freeTierConfirmation:'human-user',previousHash:hash(previous),...expected,providerStops:{},attempts:[]};validateFreeComparison(previous,ledger,expected);
      const preflight=await fetch(config.origin+endpoint,init(config,{caseId:'preflight-invalid-case',provider:'google',comparison},AbortSignal.timeout(15000)));
      if(preflight.status!==400||(await preflight.json()).code!=='evaluation_invalid_case')throw Error('Free endpoint not ready.');
      await collectFreeComparison({previous,ledger,cases:helper.accuracyCases,config,expected,safeCodes:[...Object.keys(helper.FEEDBACK_ISSUES),'evaluation_disabled','evaluation_unauthorized','evaluation_invalid_request','evaluation_invalid_case','evaluation_key_missing','evaluation_internal'],validationStages:helper.FEEDBACK_VALIDATION_STAGES,diagnostics:helper.FEEDBACK_DIAGNOSTICS,parseFeedback:helper.parseOriginalAccuracyFeedback},
        {save:v=>atomicJson(ledgerPath,v),signal:stop.signal,progress:v=>console.log(JSON.stringify(v))});
    }else validateFreeComparison(previous,ledger,{fixtureHash:ledger.fixtureHash,fixtureContentHash:ledger.fixtureContentHash,sourceCommit:config.sourceCommit,profiles:ledger.profiles,models:ledger.models});
    const reviewPath=resolve(directory,'review-bundle.json'),existing=existsSync(reviewPath)?JSON.parse(readFileSync(reviewPath)):undefined,review=reviewBundle(ledger.attempts,round,existing);
    atomicJson(reviewPath,review);atomicJson(resolve(directory,'blind.json'),review.blinded);
    console.log(JSON.stringify({complete:true,comparison,attempts:ledger.attempts.length,totalAttempts:previousCalls+ledger.attempts.length,providerStops:ledger.providerStops}));
  }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);closeSync(lock);unlinkSync(lockPath);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Free comparison stopped. Keep all ledgers; never repeat consumed slots or change billing.');process.exitCode=1;});
