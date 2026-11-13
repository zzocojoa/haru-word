import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync,appendFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {digest} from './ai-quality-v147-budget.mjs';
import {loadDiagnosticEnvelopeV2,compileDiagnosticEnvelopeV2,validateDiagnosticApprovalV2} from './ai-quality-v147-diagnostic-envelope-v2.mjs';
import {runSyntheticDiagnosticEnvelopeV2,runAuthorizedDiagnosticEnvelopeV2,inspectDiagnosticEnvelopeRunV2} from './ai-quality-v147-diagnostic-live-v2.mjs';
const p=loadDiagnosticEnvelopeV2(),bundle=compileDiagnosticEnvelopeV2(p,'synthetic'),KEY='synthetic-credential-not-real';
const approval=b=>({sessionUserApproved:false,authorizationSource:'synthetic-fixture',officialLimitsAndRatesRechecked:true,runId:b.spec.runId,bundleHash:b.hash,amountMicros:'5000000',evidenceHash:digest('offline-only')});
const payload=()=>({goldCaseId:'G12',witnessId:'N04',assessments:p.prepared.data.questions.map(q=>({questionId:q.id,verdict:'not-established',sourceEvidence:[],feedbackQuotes:[],rationale:'Synthetic diagnostic only; no English qualification.'})),originalGrammar:'uncertain',declaredUsageScope:'',exactOriginalSupport:'not-established',categoricalGoldRecommendation:'hold',remainingUncertainty:['Synthetic fixture.']});
const response=(modelId,input=1200,output=250)=>({status:200,contentType:'application/json',responseRaw:JSON.stringify({model:modelId,service_tier:'default',status:'completed',usage:{input_tokens:input,output_tokens:output,total_tokens:input+output,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload())}]}]})});
if(process.argv[2]==='--child'){
 const root=resolve(process.argv[3]),fault=process.argv[4];try{await runSyntheticDiagnosticEnvelopeV2({p,bundle,sessionApproval:approval(bundle),runtimeRoot:root,loadExistingKey:()=>KEY,transport:async({modelId})=>{appendFileSync(resolve(root,'calls.jsonl'),JSON.stringify({modelId})+'\n');return response(modelId);},testFault:s=>{if(s===fault)process.exit(91);}});process.exit(0);}catch{process.exit(75);}
}
const out=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(out,{recursive:false});const rows=[],save=(n,x)=>writeFileSync(resolve(out,n),JSON.stringify(x,null,2)+'\n',{flag:'wx'}),passed=name=>rows.push({name,passed:true});
const options=(name,more={})=>({p,bundle,sessionApproval:approval(bundle),runtimeRoot:resolve(out,name),loadExistingKey:()=>KEY,transport:async({modelId})=>response(modelId),...more});
const child=(root,fault='none')=>new Promise((done,fail)=>{const c=spawn(process.execPath,[fileURLToPath(import.meta.url),'--child',root,fault],{windowsHide:true,stdio:['ignore','pipe','pipe']});let err='';c.stderr.on('data',x=>err+=x);c.on('error',fail);c.on('close',code=>done({code,err}));});
test('six original model/layout roles are retained; cache-only extension and exact conservative prices',()=>{
 assert.equal(bundle.requests.length,6);assert.equal(bundle.requestedApprovalMicros,'5000000');assert.deepEqual(bundle.perRequest.map(r=>r.maximumMicros),['2062192','2062192','4124384','4124384','20621920','20621920']);
 for(const r of bundle.requests){const body=JSON.parse(r.requestRaw);assert.deepEqual(body.prompt_cache_options,{mode:'explicit'});delete body.prompt_cache_options;assert.equal(JSON.stringify(body),r.canonicalRequestRaw);}
 save('six-role-bounds.json',{perRequest:bundle.perRequest,cacheWritesDisabled:true,tokenCountMeasured:false,allSixGuaranteed:false});passed('six unchanged roles/cache/no byte-token assumption');
});
test('owned HTTP collects four and holds Astra before reservation or transport',{timeout:120000},async()=>{
 const observed=[],server=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);observed.push(body);const r=response(body.model);res.writeHead(r.status,{'content-type':r.contentType});res.end(r.responseRaw);});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 let r;try{r=await runSyntheticDiagnosticEnvelopeV2(options('http',{transport:async({requestRaw})=>{const v=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',body:requestRaw});return {status:v.status,contentType:v.headers.get('content-type'),responseRaw:await v.text()};}}));}finally{await new Promise(done=>server.close(done));}
 assert.equal(observed.length,4);assert.deepEqual(observed.map(x=>x.model),['gpt-6.1-terra','gpt-6.1-terra','gpt-6.1-sol','gpt-6.1-sol']);assert.equal(r.failureCode,'DL2_INSUFFICIENT_NEXT_REQUEST');assert.equal(r.diagnostic.denominator,6);assert.equal(r.diagnostic.missingKeys.length,2);assert.equal(r.account.slots,4);assert.ok(BigInt(r.account.upperMicros)<5000000n);assert.equal(r.actualEnglishQualityQualified,false);save('four-collected-astra-held.json',r);passed('owned HTTP four/remaining two held');
});
test('large settled inputs stop before the next request can overrun five dollars',async()=>{
 const r=await runSyntheticDiagnosticEnvelopeV2(options('large',{transport:async({modelId})=>response(modelId,922000,4096)}));assert.equal(r.clientDispatches,2);assert.equal(r.account.upperMicros,'4124384');assert.equal(r.account.overBudget,false);assert.equal(r.account.slots,2);save('high-input-stop.json',r);passed('high usage stops under cap');
});
test('unknown network outcome retains full consumed reservation and never retries',async()=>{
 const r=await runSyntheticDiagnosticEnvelopeV2(options('unknown',{transport:async()=>{throw Error(KEY);}}));assert.equal(r.clientDispatches,1);assert.equal(r.account.upperMicros,'2062192');assert.equal(r.failureCode,'DL2_IO_OR_TRANSPORT');assert.ok(!JSON.stringify(r).includes(KEY));save('unknown-stop.json',r);passed('unknown money retained/no retry');
});
test('unsupported cache policy and malformed usage hold captured responses at full reservation',async()=>{
 const failures=[];for(const kind of ['cache-write','cache-missing','total','wrong-model','http400']){const r=await runSyntheticDiagnosticEnvelopeV2(options('fault-'+kind,{transport:async({modelId})=>{const r=response(modelId),v=JSON.parse(r.responseRaw);if(kind==='cache-write')v.usage.input_tokens_details.cache_write_tokens=1;if(kind==='cache-missing')delete v.usage.input_tokens_details;if(kind==='total')v.usage.total_tokens++;if(kind==='wrong-model')v.model='unexpected';if(kind==='http400')r.status=400;r.responseRaw=JSON.stringify(v);return r;}}));assert.equal(r.clientDispatches,1);assert.equal(r.account.upperMicros,'2062192');assert.equal(r.status,'held');failures.push({kind,failureCode:r.failureCode});}save('response-faults.json',failures);passed('five response faults');
});
test('exact five dollar approval required before any file/key/transport action',async()=>{
 const b=compileDiagnosticEnvelopeV2(p);let reads=0;for(const a of [null,{...approval(b),amountMicros:'133000000'},{...approval(b),amountMicros:'0'},approval(b)])assert.throws(()=>validateDiagnosticApprovalV2(b,a),/DE2_USER_APPROVAL_REQUIRED/);
 await assert.rejects(runAuthorizedDiagnosticEnvelopeV2({p,bundle:b,sessionApproval:null,runtimeRoot:resolve(out,'forbidden'),loadExistingKey:()=>{reads++;return KEY;}}),/DE2_USER_APPROVAL_REQUIRED/);assert.equal(reads,0);assert.equal(existsSync(resolve(out,'forbidden')),false);passed('approval gate before key/files');
});
test('post-consumption body mutation stops transport with reservation retained',async()=>{
 const b=structuredClone(bundle);let calls=0;const r=await runSyntheticDiagnosticEnvelopeV2(options('mutated',{bundle:b,sessionApproval:approval(b),transport:async()=>{calls++;throw Error('forbidden');},testFault:s=>{if(s==='after-consume')b.requests[0].requestRaw+=' ';}}));assert.equal(calls,0);assert.equal(r.account.upperMicros,'2062192');passed('body mutation held');
});
test('revoked approval after HTTP preserves response without releasing uncertain money',async()=>{
 const a=approval(bundle),root=resolve(out,'revoked'),r=await runSyntheticDiagnosticEnvelopeV2(options('revoked',{sessionApproval:a,testFault:s=>{if(s==='after-transport')a.amountMicros='0';}}));assert.equal(r.clientDispatches,1);assert.equal(r.account.upperMicros,'2062192');assert.equal(existsSync(resolve(root,'captures-'+bundle.spec.runId,'0-response.json')),true);passed('revocation capture/money retained');
});
test('physical response tampering cannot release consumed reservation',async()=>{
 const root=resolve(out,'tampered'),r=await runSyntheticDiagnosticEnvelopeV2(options('tampered',{testFault:s=>{if(s==='after-capture')writeFileSync(resolve(root,'captures-'+bundle.spec.runId,'0-response.json'),'{}');}}));assert.equal(r.failureCode,'DL2_CAPTURE_READBACK');assert.equal(r.account.upperMicros,'2062192');passed('physical capture integrity');
});
test('credential echo never enters any runtime file',async()=>{
 const root=resolve(out,'echo'),r=await runSyntheticDiagnosticEnvelopeV2(options('echo',{transport:async()=>({status:401,contentType:'application/json',responseRaw:JSON.stringify({error:KEY})})}));function scan(p){for(const f of readdirSync(p,{withFileTypes:true})){const q=resolve(p,f.name);if(f.isDirectory())scan(q);else assert.ok(!readFileSync(q,'utf8').includes(KEY));}}scan(root);assert.equal(r.failureCode,'DL2_CREDENTIAL_ECHO_HELD');passed('secret echo privacy');
});
test('two actual processes cannot duplicate the five dollar run',{timeout:120000},async()=>{
 const root=resolve(out,'race'),r=await Promise.all([child(root),child(root)]);assert.deepEqual(r.map(x=>x.code).sort((a,b)=>a-b),[0,75]);assert.ok(r.every(x=>x.err===''));assert.equal(readFileSync(resolve(root,'calls.jsonl'),'utf8').trim().split('\n').length,4);save('process-race.json',r);passed('owned process race');
});
test('real process exit after consume/capture is terminal and cannot resend',{timeout:120000},async()=>{
 const result=[];for(const stage of ['after-consume','after-capture']){const root=resolve(out,stage),a=await child(root,stage);assert.equal(a.code,91);const before=inspectDiagnosticEnvelopeRunV2({bundle,runtimeRoot:root});assert.equal(before.account.upperMicros,'2062192');const b=await child(root);assert.equal(b.code,75);const file=resolve(root,'calls.jsonl'),calls=existsSync(file)?readFileSync(file,'utf8').trim().split('\n').length:0;assert.equal(calls,stage==='after-capture'?1:0);result.push({stage,a,b,calls});}save('process-exit-no-resend.json',result);passed('two real exits/no resend');
});
test.after(()=>save('five-dollar-results.json',{passed:rows.length===12,groups:rows.length,rows,nodeVersion:process.version,approvalMicros:'5000000',planned:6,normalSyntheticCollected:4,actualProviderCalls:0,actualKeyReads:0,actualCountCalls:0,actualEnglishQualityQualified:false}));
