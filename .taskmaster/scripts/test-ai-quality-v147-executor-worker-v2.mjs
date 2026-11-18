// Actual built application→D1/receipt→v2 consumed/capture→derived fake judge.
// All learners and providers are synthetic; no external provider route is used.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {executorFixtureV2} from './ai-quality-v147-executor-fixture-v2.mjs';
import {openSyntheticExecutorV2} from './ai-quality-v147-executor-v2.mjs';
import {createV2Journal,readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {MODELS,digest,slotKey} from './ai-quality-v147-budget-v2.mjs';
import {sealFreeze} from './ai-quality-v147-freeze.mjs';
import {DIMENSIONS,CRITICAL} from './ai-quality-v147-calibration.mjs';
import {startSyntheticWorker} from './ai-quality-v147-worker.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),read=async p=>JSON.parse(await readFile(p,'utf8'));
const manifest=await read(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json')),ROOT=manifest.baseline.existingDashboardRoot;
const out=resolve(process.env.QA_OUTPUT_DIR??resolve(ROOT,'outputs/executor-worker-v2-'+randomUUID()));await mkdir(out,{recursive:false});
const sha=x=>createHash('sha256').update(x).digest('hex'),recordedFile=resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106/phase6/built-worker-final/provider-requests.json');
assert.equal(sha(await readFile(recordedFile)),'4f0398601ecf65e8994a73a59d972132f8e5411cd1a119cc3f2959411d197f7c');const recorded=await read(recordedFile);
const wordSentence='Give help.',grammarSentence='They is studying.',word=(await read(resolve(SOURCE,'data/words.json'))).find(w=>w.word==='help'&&w.pos==='n.'),material=(await read(resolve(SOURCE,'data/content.json')))[word.id];
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),observations=[],lifecycle=[];let activeRaw=null,attempts=0;
const save=(name,value)=>writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
function headers(base,owner){return {'Content-Type':'application/json',Origin:base,'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'executor@example.test','X-Study-Owner':owner,'X-Study-AI-Contract':'4','X-Study-Grammar':'5','X-Study-Feedback-Structure':'1'};}
async function api(profile,owner,path,method='GET',body){const response=await fetch(profile.base+path,{method,headers:headers(profile.base,owner),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});return {status:response.status,value:await response.json()};}
function respond(body){
 attempts++;assert.equal(JSON.stringify(body),activeRaw,'actual Worker body must equal the pre-consume frozen bytes');const input=JSON.parse(body.input[0].content),isWord=input.sentence===wordSentence;
 const value={meaningUsage:isWord?'appropriate':'needs_work',grammar:isWord?'natural':'needs_work',correctedSentence:isWord?wordSentence:'They are studying.',targetReason:'합성 목표 의견',grammarReason:'합성 문법 의견',correctionReason:isWord?'':'합성 수 일치 보완',contextNeeded:'none'};
 return {status:'completed',model:body.model,usage:{input_tokens:100,output_tokens:80,output_tokens_details:{reasoning_tokens:10}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]};
}
async function seed(profile,model,domain){
 const owner='synthetic-executor-'+randomUUID(),initial=await api(profile,owner,'/api/state');assert.equal(initial.status,200);const id=randomUUID(),answer={first:'합성 첫 답',latest:'합성 마지막 답',helped:false,attempts:1};
 const session={id,kind:'daily',date,period:date,ids:[word.id],warmupIds:[],records:{[word.id]:{entryId:word.id,meaning:material.meaning,familiarity:'uncertain',en:'independent',ko:'independent',enAnswer:'Synthetic first English answer.',koAnswer:'합성 첫 한국어 답',sentenceStatus:'unmeasured',sentence:wordSentence,notes:'',learnedOn:date,lastPracticedOn:date,material}},stage:'sentence',index:0,retry:[],retryMode:false,elapsed:10,finished:false,paused:false,createdAt:new Date().toISOString()};
 const grammar={stage:5,sentence:grammarSentence,answers:{q1:answer,q2:answer,q3:answer},contentVersion:4,questionIds:[1,2,3].map(n=>'auxiliary:4:base:q'+n),observation:answer,updatedAt:new Date().toISOString()};
 const result=await api(profile,owner,'/api/state','PUT',{revision:initial.value.revision,settings:{...initial.value.state.settings,level:word.level,dailyGoal:1,aiModelId:model,activeSessionId:domain==='word'?id:null},progress:{},sessions:domain==='word'?{[id]:session}:{},grammar:domain==='grammar'?{auxiliary:grammar}:{}});assert.equal(result.status,200);return {owner,id,session,grammar};
}
function bundleFor(label,model,domain,profile){
 const base=executorFixtureV2(),generation=base.spec.batches[0].requests[0],judge=base.spec.batches[0].requests[1],oldJudge=slotKey(judge),oldTemplate=base.wires[oldJudge].templateRaw;
 const raw=recorded.find(p=>p.profile===label).requests.find(r=>{const b=JSON.parse(r.body);return b.model===model&&JSON.parse(b.input[0].content).sentence===(domain==='word'?wordSentence:grammarSentence);}).body;
 generation.phase=label;generation.caseId='worker-'+domain;generation.targetModelId=model;generation.modelId=model;generation.bodyCommitment=digest(JSON.parse(raw));
 judge.phase=label;judge.caseId=generation.caseId;judge.targetModelId=model;judge.modelId=MODELS[(MODELS.indexOf(model)+1)%3];
 const template=JSON.parse(oldTemplate);template.model=judge.modelId;const content=JSON.parse(template.input[0].content);content.domain=domain;content.input.sentence=domain==='word'?wordSentence:grammarSentence;template.input[0].content=JSON.stringify(content);const templateRaw=JSON.stringify(template);judge.bodyCommitment=sha(templateRaw);
 const g=slotKey(generation),j=slotKey(judge);base.spec.wirePolicies={[g]:{kind:'static',bodySha256:sha(raw),templateHash:null,parentKey:null,maximumBytes:65536},[j]:{kind:'derived',bodySha256:null,templateHash:sha(templateRaw),parentKey:g,maximumBytes:65536}};base.wires={[g]:{raw},[j]:{templateRaw}};
 base.current.schedule=[{key:g,modelId:model,role:'generation',kind:'static',maximumBytes:65536,outputTokenMax:4096,bodySha256:sha(raw),bodyDigest:generation.bodyCommitment,parentKey:null,recipeHash:null},{key:j,modelId:judge.modelId,role:'judge',kind:'derived',maximumBytes:65536,outputTokenMax:4096,bodySha256:null,bodyDigest:null,parentKey:g,recipeHash:sha(templateRaw)}];base.current.order=[g,j];
 base.current.environment.compatibilityDate=profile.proof.compatibilityDate;base.current.environment.compatibilityFlags=profile.proof.compatibilityFlags;
 const {sourceSeal:_unused,...outline}=base.spec;void _unused;base.current.components.limits=digest(outline);base.current.components.runtime=digest(base.current.environment);base.current.components.requestBuilder=sha(readFileSync(fileURLToPath(import.meta.url)));base.seal=sealFreeze(base.current);base.spec.sourceSeal=base.seal.hash;base.approval.specHash=digest(base.spec);return {...base,g,j,raw};
}
try{
 for(const label of ['baseline','candidate']){
  const buildSourceRoot=label==='baseline'?resolve(ROOT,'work/provider-network-publish-20261105'):SOURCE,profile=await startSyntheticWorker({label,buildSourceRoot,workspaceRoot:SOURCE,allowedSentences:[wordSentence,grammarSentence],respond});
  try{
   for(const model of MODELS)for(const domain of ['word','grammar']){
    const seeded=await seed(profile,model,domain),bundle=bundleFor(label,model,domain,profile),context={directory:resolve(out,bundle.spec.runId),allowedRoot:out,spec:bundle.spec};createV2Journal(context,bundle.approval);let callbacks=0,feedback=null;
    const executor=openSyntheticExecutorV2({context,seal:bundle.seal,observeCurrent:()=>bundle.current,readWire:key=>bundle.wires[key],transport:async({key,requestId,raw,role,modelId})=>{
     callbacks++;assert.equal(readV2Journal(context).ledger.slots[key].state,'consumed');
     if(role==='judge'){assert.deepEqual(JSON.parse(JSON.parse(raw).input[0].content).feedback,feedback);return {state:'completed',modelId,payloadRaw:JSON.stringify({...Object.fromEntries(DIMENSIONS.map(k=>[k,'pass'])),criticalErrors:Object.fromEntries(CRITICAL.map(k=>[k,false]))}),usage:{inputTokens:20,outputTokens:20}};}
     activeRaw=raw;const before=profile.providerRecords.length,result=await api(profile,seeded.owner,'/api/'+(domain==='word'?'sentence':'grammar')+'-feedback','POST',{...(domain==='word'?{sessionId:seeded.id,entryId:word.id,sentence:wordSentence}:{lessonId:'auxiliary',sentence:grammarSentence}),expectedModelId:model,requestId,requestStartedAt:Date.now()});assert.equal(result.status,200);assert.equal(profile.providerRecords.length,before+1);assert.equal(result.value.receipt.requestId,requestId);assert.equal(result.value.receipt.persisted,true);
     const recovered=await api(profile,seeded.owner,'/api/feedback-requests/'+requestId);assert.equal(recovered.status,200);assert.deepEqual(recovered.value.feedback,result.value.feedback);feedback=Object.fromEntries(['original','meaningUsage','grammar','correctedSentence','explanation'].map(k=>[k,result.value.feedback[k]]));
     return {state:'completed',modelId,payloadRaw:JSON.stringify(feedback),usage:{inputTokens:100,outputTokens:80}};
    }});
    let first;try{first=await executor.collect();assert.equal(first.status,'synthetic-collection-complete');assert.deepEqual(first.counts,{completed:2});const before=callbacks;assert.equal((await executor.collect()).status,first.status);assert.equal(callbacks,before);}finally{executor.release();}
    const snapshot=await api(profile,seeded.owner,'/api/state');assert.equal(snapshot.status,200);if(domain==='word')assert.equal(snapshot.value.state.sessions[seeded.id].records[word.id].enAnswer,seeded.session.records[word.id].enAnswer);else assert.deepEqual(snapshot.value.state.grammar.auxiliary.answers,seeded.grammar.answers);
    observations.push({label,model,domain,runId:bundle.spec.runId,completedSlots:2,callbacks,providerBodySha256:sha(bundle.raw),sameRecordedWorkerBody:true,receiptRecovered:true,restartAdded:0,firstAnswersPreserved:true});console.log('PASS '+label+'/'+model+'/'+domain+': actual built API/D1 receipt→v2 capture→derived fake judge→close;repeat0');
   }
  }finally{await profile.stop();lifecycle.push({...profile.proof,stopped:true,providerRequests:profile.providerRecords.length,realProviderEgress:0});}
 }
 assert.equal(observations.length,12);assert.equal(attempts,12);await save('executor-worker-results.json',{passed:true,groups:12,completedSlots:24,actualWorkerProviderIntercepts:12,nodeFakeJudges:12,actualProviderCalls:0,actualKeyReads:0,task22Complete:false,physicalIphoneVoiceOver:false,modelQualityMeasured:false,releaseVerdict:'held',observations,lifecycle});
 console.log(JSON.stringify({passed:true,groups:12,completedSlots:24,actualWorkerProviderIntercepts:12,actualProviderCalls:0,exitCode:0}));
}catch(error){await save('executor-worker-failure.json',{passed:false,observations,lifecycle,code:typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'OWNED_TEST_ASSERTION',actualProviderCalls:0});throw error;}
