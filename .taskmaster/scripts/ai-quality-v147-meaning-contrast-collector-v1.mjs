// New run of the preregistered v6/v7 comparison. The prior paid collector stays frozen.
import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, mkdirSync, existsSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { digest, PROTOCOL, PLAN, validateSpec, slotKey, costUpperMicros, account } from './ai-quality-v147-budget.mjs';
import { createBudgetStore, transactBudgetStore, readBudgetStore } from './ai-quality-v147-budget-store.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';
import { parseTargetMeaningPayloadV1 } from './ai-quality-v147-target-meaning-v1.mjs';
import { parseTargetMeaningPayloadV2 } from './ai-quality-v147-target-meaning-v2.mjs';
import { prepareMeaningContrastV1, meaningContrastBudgetV1, inspectMeaningContrastV1 } from './ai-quality-v147-meaning-contrast-v1.mjs';
import { observedCacheModelUpperV1 } from './ai-quality-v147-cache-reconciliation-v1.mjs';
import { prepareEvaluationBudgetV3, evaluationBudgetContextV3, openEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';

export const MEANING_CONTRAST_COLLECTOR_V1 = 'ai-quality-v147-meaning-contrast-collector-v1';
export const SYNTHETIC_KEY = 'synthetic-meaning-contrast-key';
const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN = 'c384abf1-a53f-45a5-8d0c-6ad34ecdbb61';
const CALLS = 36, RESERVE = 4283592n, COUNT_ALLOWANCE = 1260000n;
const PROFILE = '.taskmaster/docs/ai-quality-v147-meaning-contrast-budget-profile-v1.json';
const AUTH = '.taskmaster/docs/ai-quality-v147-additional-budget-authorization-20261108.json';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const fileSha = file => sha(readFileSync(file));
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const check = (value, code) => { if (!value) throw new Error('MCC1_' + code); };
const safe = e => /^(?:MCC1|MC1|EB3|LS1|CR1|EX1|CB1|CBP1|W3|PF2|ES1|AC1|TM1|TM2|EB2)_[A-Z0-9_]+$/.test(e?.message ?? '') ? e.message : 'MCC1_LOCAL_OR_TRANSPORT_HELD';

function durable(file, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value) + '\n';
  const fd = openSync(file, 'wx');
  try { writeFileSync(fd, raw, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  check(fileSha(file) === sha(raw), 'DURABLE_READBACK');
}
function plain(file) {
  const stat = lstatSync(file);
  check(realpathSync(file) === file && stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'FILE_PATH');
}

export function prepareMeaningContrastCollectorV1(sourceRoot = HERE, mode = 'evaluation', syntheticLegacyRoot = null) {
  check(['synthetic', 'evaluation'].includes(mode) && (mode === 'synthetic') === (syntheticLegacyRoot !== null), 'MODE');
  const money = prepareEvaluationBudgetV3(sourceRoot, syntheticLegacyRoot);
  const { sourceRoot: source, root } = money;
  const evidenceRoot = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  const sealed = resolve(evidenceRoot, 'phase90/prepared.json');
  const proof = resolve(evidenceRoot, 'phase90/verification.json');
  plain(sealed);
  plain(proof);
  check(fileSha(sealed) === 'dfe9301c2ae5d5e62c19b47860a31ff1a21a999dcfd82476c7704149100aeacd' &&
    fileSha(proof) === 'd664c0909374f4dca5d899d5687a475f334922c7fb2d074abfb7d945906ac2fa', 'PREREGISTRATION');
  const study = prepareMeaningContrastV1(evidenceRoot);
  const frozen = read(sealed);
  check(study.hash === frozen.hash && digest(frozen.plan) === frozen.hash, 'PREREGISTERED_WIRES');

  const funding = read(resolve(source, PROFILE));
  check(funding.runId === RUN && funding.studyPlanHash === study.hash &&
    funding.expectedModelCalls === CALLS && funding.expectedCountCalls === CALLS &&
    funding.reservationMicros === String(RESERVE) && funding.countAllowanceMicros === String(COUNT_ALLOWANCE) &&
    funding.collectorProtocol === MEANING_CONTRAST_COLLECTOR_V1 && funding.successStatus === 'collected-meaning-contrast' &&
    funding.priceEvidenceSha256 === study.plan.priceEvidenceSha256 &&
    digest(funding.rates) === digest(study.plan.rates), 'FUNDING_SCOPE');
  const bindings = new Set([AUTH, PROFILE, 'docs/AI_QUALITY_V147_MEANING_CONTRAST_PREREG_20261109.md']);
  function scan(file) {
    if (bindings.has(file)) return;
    bindings.add(file);
    for (const match of readFileSync(resolve(source, file), 'utf8').matchAll(/from\s+['"](.\/[^'"]+\.mjs)['"]/g)) {
      scan('.taskmaster/scripts/' + match[1].slice(2));
    }
  }
  scan('.taskmaster/scripts/ai-quality-v147-meaning-contrast-collector-v1.mjs');
  const sourceBindings = Object.fromEntries([...bindings].map(file => {
    const absolute = resolve(source, file);
    plain(absolute);
    return [file, fileSha(absolute)];
  }));
  const { requests, rates, countCeiling, outputCeiling } = study.plan;
  check(requests.length === CALLS && requests.every(r => {
    const body = JSON.parse(r.requestRaw);
    return body.max_output_tokens === outputCeiling && body.store === false && body.stream === false &&
      !['prompt_cache_options', 'prompt_cache_retention', 'tools', 'previous_response_id'].some(k => Object.hasOwn(body, k));
  }), 'REQUESTS');
  const plan = {
    protocol: MEANING_CONTRAST_COLLECTOR_V1, runId: RUN, scopeHash: study.hash, mode,
    sourceBindings, requests, rates, countCeiling, outputCeiling,
    runtimeDirectoryName: funding.runtimeDirectoryName, reservedMicros: String(RESERVE),
    countAllowanceMicros: String(COUNT_ALLOWANCE), recoveryPlanHash: money.hash,
    preregisteredPreparedSha256: fileSha(sealed), automaticRetry: false, mainDispatchAuthorized: false,
  };
  return { sourceRoot: source, root, syntheticLegacyRoot, plan, hash: digest(plan), recovery: money, study };
}

function contrastBudget(p, receipts) {
  const priced = meaningContrastBudgetV1(p.study, receipts.map(c => ({
    key: c.key, inputTokens: c.inputTokens, countRequestSha256: c.requestSha256, requestSha256: c.generationSha256,
  })));
  const quote = {
    kind: p.plan.mode === 'evaluation' ? 'verified-price' : 'synthetic-test', evidenceHash: digest(p.plan.rates),
    regionalNumerator: '11', regionalDenominator: '10', inputFactorNumerator: '5', inputFactorDenominator: '4',
    models: Object.fromEntries(Object.entries(p.plan.rates).map(([model, [input, output]]) => [model, {
      inputMicrosPerMillion: String(input * 1e6), outputMicrosPerMillion: String(output * 1e6),
    }])),
  };
  const batches = p.plan.requests.map((request, i) => {
    const receipt = receipts[i];
    check(receipt.index === i, 'RECEIPT_INDEX');
    const caseId = 'meaning-contrast-' + i;
    return { id: caseId, requests: [{
      phase: 'calibration', caseId, targetModelId: request.model, modelId: request.model, role: 'calibration',
      repetition: 1, inputTokenMax: Math.ceil(receipt.inputTokens * 5 / 4), outputTokenMax: p.plan.outputCeiling,
      inputBoundHash: digest(receipt), bodyCommitment: request.requestSha256,
    }] };
  });
  const spec = { schemaVersion: 1, protocol: PROTOCOL, planId: PLAN, runId: RUN, mode: p.plan.mode, sourceSeal: p.hash, quote, batches };
  validateSpec(spec);
  const maximum = batches.reduce((sum, batch) => sum + BigInt(costUpperMicros(spec, batch.requests[0])), 0n);
  check(maximum === BigInt(priced.generationMicros) && maximum + COUNT_ALLOWANCE === BigInt(priced.totalMicros) &&
    maximum + COUNT_ALLOWANCE <= RESERVE, 'RESERVATION_CAP');
  return { specs: [spec], generationMaximumMicros: String(maximum), countAllowanceMicros: String(COUNT_ALLOWANCE), totalMaximumMicros: priced.totalMicros };
}

export function meaningContrastRuntimeRootV1(p, context) {
  check(p.hash === digest(p.plan) && p.plan.mode === context.mode, 'RUNTIME_CONTEXT');
  const file = resolve(p.sourceRoot, PROFILE);
  check(fileSha(file) === p.plan.sourceBindings[PROFILE] && read(file).runtimeDirectoryName === p.plan.runtimeDirectoryName, 'RUNTIME_PROFILE');
  return context.mode === 'evaluation' ? resolve(p.root, 'outputs', p.plan.runtimeDirectoryName) : resolve(context.directory, 'runtime-' + RUN);
}

async function officialTransport({kind,requestRaw,apiKey}){
 const response=await fetch('https://api.openai.com/v1/responses'+(kind==='count'?'/input_tokens':''),{method:'POST',headers:{Connection:'close',Authorization:'Bearer '+apiKey,'Content-Type':'application/json',Accept:'application/json'},body:requestRaw,redirect:'error',signal:AbortSignal.timeout(180000)}),reader=response.body?.getReader();check(reader,'BODY');const chunks=[];let bytes=0;while(true){const x=await reader.read();if(x.done)break;bytes+=x.value.length;if(bytes>262144){await reader.cancel();throw Error('MCC1_RESPONSE_SIZE');}chunks.push(Buffer.from(x.value));}return{status:response.status,contentType:response.headers.get('content-type')??'',responseRaw:Buffer.concat(chunks).toString('utf8')};
}
function freezePlan(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freezePlan(v);}return value;}
async function collect({prepared:p,runtimeRoot,loadExistingKey,transport,recoveryContext,claimFile,testFault},live){
 check(p.plan.mode===(live?'evaluation':'synthetic')&&digest(p.plan)===p.hash,'PREPARED');p=freezePlan(structuredClone(p));const expectedHash=p.hash,pins=structuredClone(p.plan.sourceBindings);check(prepareMeaningContrastCollectorV1(p.sourceRoot,p.plan.mode,p.syntheticLegacyRoot).hash===expectedHash,'SOURCE_DRIFT');const verify=()=>{check(p.hash===expectedHash,'SOURCE_DRIFT');for(const [f,h]of Object.entries(pins))check(fileSha(resolve(p.sourceRoot,f))===h,'SOURCE_DRIFT');};verify();

 const money=prepareEvaluationBudgetV3(p.sourceRoot,p.syntheticLegacyRoot);check(money.hash===p.plan.recoveryPlanHash,'RECOVERY_PLAN');const session=openEvaluationBudgetV3({prepared:money,context:recoveryContext});try{
 if(!existsSync(recoveryContext.claimFile))session.initialize({testFault:s=>testFault?.(s)});
 const initial=session.current();check(initial.reservedMicros==='0'&&!initial.ledger.allocations.some(x=>x.runId===RUN)&&BigInt(initial.availableMicros)>=RESERVE,'GRANT_AVAILABLE');
 if(live)check(initial.usedUpperMicros==='26421533'&&initial.availableMicros==='8578467','PREREGISTERED_BALANCE');
 const runtime=resolve(runtimeRoot);check(runtime===meaningContrastRuntimeRootV1(p,recoveryContext)&&realpathSync(dirname(runtime))===dirname(runtime)&&!existsSync(runtime),'RUNTIME_ONCE');mkdirSync(runtime);check(realpathSync(runtime)===runtime,'RUNTIME_PATH');
 const claim={protocol:MEANING_CONTRAST_COLLECTOR_V1,runId:RUN,planHash:p.hash,reservedMicros:String(RESERVE),recoveryPlanHash:money.hash,additionalAuthorizedCapMicros:'35000000',noAutomaticRetry:true};durable(claimFile,claim);durable(resolve(runtime,'ONCE.json'),claim);
 let profileFile=resolve(p.sourceRoot,PROFILE);if(!live){profileFile=resolve(recoveryContext.directory,'scope-input-'+RUN+'.json');durable(profileFile,read(resolve(p.sourceRoot,PROFILE)));}const reserved=session.reserve({profileFile,collectorPlanHash:p.hash,runtimeRoot:runtime});durable(resolve(runtime,'grant-reservation.json'),reserved);
 let keyReads=0,countAttempts=0,modelAttempts=0,failureCode=null,context=null,state=null,contexts=[],budget=null,currentKey=null;const receipts=[],records=[],ids=new Set();const point=async(s,i=null)=>{await testFault?.(s,i);};const tx=operation=>state=transactBudgetStore({...context,operation});
 const verifyReserved=()=>{verify();check(digest(session.verify().ledger)===digest(reserved.ledger),'RESERVATION_CHANGED');check(digest(read(claimFile))===digest(claim),'CLAIM_CHANGED');for(const c of receipts){check(digest(read(resolve(runtime,'count-'+c.index+'-receipt.json')))===digest(c),'RECEIPT_CHANGED');check(fileSha(resolve(runtime,'count-'+c.index+'-response.json'))===c.responseSha256&&fileSha(resolve(runtime,'count-'+c.index+'-request.json'))===c.requestSha256,'COUNT_CHANGED');}if(budget)check(digest(read(resolve(runtime,'measured-budget.json')))===digest(budget),'BUDGET_CHANGED');};
 async function capture(kind,index,requestRaw,key){verifyReserved();const prefix=resolve(runtime,kind+'-'+index);durable(prefix+'-request.json',requestRaw);durable(prefix+'-intent.json',{kind,index,requestId:randomUUID(),requestSha256:sha(requestRaw),consumedBeforeTransport:true});await point(kind+'-after-consume',index);verifyReserved();check(fileSha(prefix+'-request.json')===sha(requestRaw),'WIRE_CHANGED');if(kind==='count')countAttempts++;else modelAttempts++;
  const result=await transport({kind,index,requestRaw,apiKey:key});await point(kind+'-after-transport',index);check(result&&Number.isInteger(result.status)&&typeof result.contentType==='string'&&typeof result.responseRaw==='string'&&Buffer.byteLength(result.responseRaw)<=262144,'TRANSPORT_SHAPE');const secretEcho=result.responseRaw.includes(key)||result.contentType.includes(key),persist=result.status===200&&/^application\/json(?:\s*;|$)/i.test(result.contentType)&&!secretEcho;
  if(persist)durable(prefix+'-response.json',result.responseRaw);durable(prefix+'-capture.json',{kind,index,status:result.status,secretEcho,rawPersisted:persist,requestSha256:sha(requestRaw),responseSha256:sha(result.responseRaw)});await point(kind+'-after-capture',index);check(persist,secretEcho?'SECRET_ECHO':'HTTP_HELD');verifyReserved();return parseV3Json(result.responseRaw);
 }
 try{await point('before-key');verifyReserved();const key=await loadExistingKey();keyReads++;check(typeof key==='string'&&key.length>0&&(live||key===SYNTHETIC_KEY),'KEY');
  for(let i=0;i<CALLS;i++){const r=p.plan.requests[i],v=await capture('count',i,r.countRequestRaw,key);check(Object.keys(v).sort().join('|')==='input_tokens|object'&&v.object==='response.input_tokens'&&Number.isSafeInteger(v.input_tokens)&&v.input_tokens>0,'COUNT_SHAPE');const c={index:i,key:r.key,inputTokens:v.input_tokens,requestSha256:sha(r.countRequestRaw),generationSha256:sha(r.requestRaw),responseSha256:fileSha(resolve(runtime,'count-'+i+'-response.json'))};durable(resolve(runtime,'count-'+i+'-receipt.json'),c);receipts.push(c);check(c.inputTokens<=p.plan.countCeiling,'COUNT_LIMIT');}
  budget=contrastBudget(p,receipts);durable(resolve(runtime,'measured-budget.json'),budget);for(const spec of budget.specs){context={directory:resolve(runtime,spec.runId),allowedRoot:runtime,spec};contexts.push(context);const maximum=spec.batches.reduce((n,b)=>n+BigInt(costUpperMicros(spec,b.requests[0])),0n).toString();state=createBudgetStore({...context,approval:{schemaVersion:1,protocol:PROTOCOL,runId:spec.runId,specHash:digest(spec),kind:live?'user-approval':'synthetic-test',amountMicros:maximum,evidenceHash:fileSha(resolve(p.sourceRoot,AUTH))}});for(const b of spec.batches)tx({kind:'reserve',batchId:b.id});}
  for(let i=0;i<CALLS;i++){const r=p.plan.requests[i];context=contexts[0];currentKey=slotKey(context.spec.batches[i].requests[0]);tx({kind:'consume',key:currentKey});const v=await capture('model',i,r.requestRaw,key),u=v.usage;
   check(v.model===r.model&&v.service_tier==='default'&&Number.isSafeInteger(u?.input_tokens)&&u.input_tokens>0&&u.input_tokens<=Math.ceil(receipts[i].inputTokens*5/4)&&Number.isSafeInteger(u.output_tokens)&&u.output_tokens>=0&&u.output_tokens<=1024&&u.total_tokens===u.input_tokens+u.output_tokens&&Number.isSafeInteger(u.input_tokens_details?.cached_tokens)&&u.input_tokens_details.cached_tokens>=0&&u.input_tokens_details.cached_tokens<=u.input_tokens&&Number.isSafeInteger(u.input_tokens_details?.cache_write_tokens??0)&&(u.input_tokens_details.cache_write_tokens??0)>=0&&(u.input_tokens_details.cache_write_tokens??0)<=u.input_tokens&&u.input_tokens_details.cached_tokens+(u.input_tokens_details.cache_write_tokens??0)<=u.input_tokens,'USAGE');if(u.output_tokens_details?.reasoning_tokens!==undefined)check(Number.isSafeInteger(u.output_tokens_details.reasoning_tokens)&&u.output_tokens_details.reasoning_tokens>=0&&u.output_tokens_details.reasoning_tokens<=u.output_tokens,'REASONING_USAGE');
   tx({kind:'settle',key:currentKey,state:'completed',usage:{inputTokens:u.input_tokens,outputTokens:u.output_tokens},evidenceHash:fileSha(resolve(runtime,'model-'+i+'-response.json'))});currentKey=null;await point('after-settle',i);
   check(v.status==='completed'&&/^resp_[A-Za-z0-9_-]{1,150}$/.test(v.id)&&!ids.has(v.id)&&Array.isArray(v.output)&&v.output.every(x=>['reasoning','message'].includes(x.type)),'STATUS');ids.add(v.id);const texts=v.output.flatMap(x=>x.type==='message'&&Array.isArray(x.content)?x.content.filter(c=>c.type==='output_text').map(c=>c.text):[]);check(texts.length===1&&typeof texts[0]==='string','PAYLOAD');const parse=r.version===6?parseTargetMeaningPayloadV1:parseTargetMeaningPayloadV2;parse({requestRaw:r.requestRaw,payloadRaw:texts[0]});records.push({key:r.key,requestRaw:r.requestRaw,payloadRaw:texts[0],providerResponseId:v.id,countedInputTokens:receipts[i].inputTokens,actualInputTokens:u.input_tokens,inputCountDelta:u.input_tokens-receipts[i].inputTokens,inputCountDifferenceRecorded:u.input_tokens!==receipts[i].inputTokens});
  }
 }catch(e){failureCode=safe(e);if(context&&currentKey)try{if(readBudgetStore(context).ledger.slots[currentKey]?.state==='consumed')tx({kind:'settle',key:currentKey,state:'unknown',usage:null,evidenceHash:null});}catch{failureCode='MCC1_STORE_HELD';}}
 let financial=null,inspection=null,used=modelAttempts===0&&contexts.length===0?COUNT_ALLOWANCE:RESERVE;try{if(contexts.length){const segments=[];for(const c of contexts){context=c;if(!readBudgetStore(context).ledger.closed)tx({kind:'close'});state=readBudgetStore(context);segments.push({runId:context.spec.runId,...account(context.spec,state.ledger)});}financial={segments,upperMicros:segments.reduce((n,x)=>n+BigInt(x.upperMicros),0n).toString()};used=COUNT_ALLOWANCE+BigInt(financial.upperMicros);}if(records.length===CALLS)inspection=inspectMeaningContrastV1(p.study,records);}catch(e){failureCode??=safe(e);if(!financial)used=RESERVE;}check(used<=RESERVE,'TOTAL_CAP');
 let cacheAccounting = null;
 if (!failureCode && records.length === CALLS && financial) {
   const legacy = BigInt(financial.upperMicros);
   let observed = null, fallbackCode = null;
   try {
     let sum = 0n;
     for (let i = 0; i < CALLS; i++) sum += observedCacheModelUpperV1(read(resolve(runtime, 'model-' + i + '-response.json')));
     observed = sum;
   } catch (error) {
     // Optional cache details cannot invalidate already captured and journaled responses.
     // Retain the entire reservation if we cannot verify the cache calculation.
     fallbackCode = safe(error);
   }
   const chosen = observed === null ? RESERVE - COUNT_ALLOWANCE : observed < legacy ? observed : legacy;
   cacheAccounting = {
     legacyAllInputUpperMicros: String(legacy), observedCacheUpperMicros: observed === null ? null : String(observed),
     accountingModelUpperMicros: String(chosen), fallbackCode, fullReservationRetained: observed === null,
     unknownWriteTtlUses12hUpper: true, tenPercentMarginRetained: true,
   };
   used = COUNT_ALLOWANCE + chosen;
 }
 check(used <= RESERVE, 'ACCOUNTING_CAP');
 const terminal={protocol:MEANING_CONTRAST_COLLECTOR_V1,planHash:p.plan.scopeHash,collectorPlanHash:p.hash,status:failureCode?'held':'collected-meaning-contrast',failureCode,actualProviderCalls:live?modelAttempts:0,actualCountApiCalls:live?countAttempts:0,actualKeyReads:live?keyReads:0,clientCountAttempts:countAttempts,clientModelAttempts:modelAttempts,records,receipts,financial,inspection,stageUsedUpperMicros:String(used),supplementalUsedUpperMicros:String(BigInt(initial.usedUpperMicros)+used),priorSupplementalUsedMicros:initial.usedUpperMicros,countAllowanceRetainedMicros:String(COUNT_ALLOWANCE),cacheAccounting,pastUnbilledContingencyMicros:'1000000',invoiceVerified:false,countTariffVerified:false,automaticRetry:false,automaticResume:false,oldLedgerReopened:false,englishTruthCertified:false,releaseVerdict:'held'};
 durable(resolve(runtime,'terminal.json'),terminal);const final=session.settle({runId:RUN,runtimeTerminalFile:resolve(runtime,'terminal.json'),usedUpperMicros:String(used),held:!!failureCode});durable(resolve(runtime,'grant-settlement.json'),final);return terminal;
 }finally{session.release();}
}

export async function runSyntheticMeaningContrastV1(args){const context=evaluationBudgetContextV3(args.prepared.recovery,'synthetic',args.budgetRoot);return collect({...args,recoveryContext:context,runtimeRoot:resolve(args.budgetRoot,'runtime-'+RUN),claimFile:resolve(args.budgetRoot,'study-claim.json')},false);}
export async function runAuthorizedMeaningContrastV1({prepared:p,loadExistingKey}){check(p.plan.mode==='evaluation'&&process.version==='v24.22.1','LIVE_RUNTIME');const recoveryContext=evaluationBudgetContextV3(p.recovery,'evaluation');return collect({prepared:p,recoveryContext,runtimeRoot:meaningContrastRuntimeRootV1(p,recoveryContext),loadExistingKey,transport:officialTransport,claimFile:resolve(p.root,'outputs/ai-quality-v147-meaning-contrast-claim-20261109.json')},true);}
