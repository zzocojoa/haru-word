// Qualification adapter only: read closed synthetic v2 captures, then send new
// panel requests to an owned loopback oracle. No paid/durable v3 execution claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {compileAiPanel,validateAiPanel,summarizeAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {readCaptureV2} from './ai-quality-v147-capture-v2.mjs';
import {slotKey} from './ai-quality-v147-budget-v2.mjs';
import {DIMENSIONS,CRITICAL,digest} from './ai-quality-v147-calibration.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),ROOT=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot;
const OUT=resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106'),oldRoot=resolve(OUT,'phase18/full756-cli3'),out=resolve(process.env.QA_OUTPUT_DIR);
mkdirSync(out,{recursive:false});
const sha=x=>createHash('sha256').update(x).digest('hex'),json=p=>JSON.parse(readFileSync(p,'utf8'));
function save(name,value){const file=resolve(out,name),fd=openSync(file,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
const frozen=json(resolve(OUT,'phase18/transport-raw-preservation.json')).rawFileSha256,bundleFile=resolve(oldRoot,'bundle.json');
assert.equal(sha(readFileSync(bundleFile)),frozen['full756-cli3/bundle.json']);const bundle=json(bundleFile);assert.equal(bundle.syntheticOnly,true);assert.equal(bundle.spec.mode,'synthetic');
const context={directory:resolve(oldRoot,bundle.spec.runId),allowedRoot:oldRoot,spec:bundle.spec};
// A completed qualification already replayed the entire v2 journal. Reuse it
// only after exact-byte verification of every parent capture/HEAD/CHAIN file;
// no mtime cache and no production recovery shortcut are introduced.
const reuse=process.env.QA_REUSE_VERIFIED_CLOSED_PARENT==='1',parentProof=reuse?json(resolve(OUT,'phase19/ai-panel-http-node24-first/http-observations.json')):null;
let read;const provedCaptures=new Map();
if(reuse){
 assert.equal(parentProof.passed,true);assert.equal(parentProof.oldSourceRunId,bundle.spec.runId);assert.equal(parentProof.oldSourceRunClosed,true);assert.equal(parentProof.sourceAllSynthetic,true);assert.equal(parentProof.oldSourceFilesReadOnly,1083);
 for(const [file,h]of Object.entries(parentProof.oldSourceFilesSha256)){assert.ok(file.startsWith(oldRoot+'\\'));assert.equal(sha(readFileSync(file)),h);if(file.endsWith('.prepared.json'))provedCaptures.set(json(file).key,file);}
 assert.equal(provedCaptures.size,360);
}else{read=readV2Journal(context);assert.equal(read.ledger.closed,true);}
function captureFor(key){
 if(!reuse)return readCaptureV2({context,ledger:read.ledger,key});
 const prepared=provedCaptures.get(key);assert.ok(prepared);const e=json(prepared),payload=prepared.replace(/\.prepared\.json$/,'.payload.txt'),receipt=prepared.replace(/\.prepared\.json$/,'.receipt.json');assert.equal(sha(readFileSync(prepared)),sha(readFileSync(receipt)));assert.equal(e.payloadHash,sha(readFileSync(payload)));
 return {result:e.result,evidenceHash:digest(e.result),payloadRaw:readFileSync(payload,'utf8'),receiptAuthenticated:false,directory:dirname(prepared),files:Object.fromEntries([prepared,payload,receipt].map(file=>[file.slice(dirname(file).length+1),sha(readFileSync(file))]))};
}
const oldFiles=new Map(),remember=file=>{oldFiles.set(file,sha(readFileSync(file)));};remember(bundleFile);remember(resolve(context.directory,'HEAD.json'));remember(resolve(context.directory,'CHAIN.jsonl'));
const rows=[];for(const d of bundle.spec.batches.flatMap(b=>b.requests).filter(d=>d.role==='generation')){
 const key=slotKey(d),capture=captureFor(key),c=bundle.cases.find(c=>c.id===d.caseId),input=JSON.parse(JSON.parse(bundle.wires[key].raw).input[0].content);
 assert.equal(capture.result.state,'completed');assert.equal(capture.result.modelId,d.modelId);assert.ok(c);assert.equal(capture.receiptAuthenticated,false);
 for(const [name,h]of Object.entries(capture.files)){const file=resolve(capture.directory,name);assert.equal(sha(readFileSync(file)),h);remember(file);}
 rows.push({id:key,generatorId:d.modelId,phase:d.phase,caseId:d.caseId,familyId:c.familyId,domain:c.domain,stratum:c.stratum,parentReceiptHash:capture.evidenceHash,input,feedback:JSON.parse(capture.payloadRaw),reference:{level:'ai-consensus',criterion:'Wholly synthetic transport fixture;no actual English ground truth or quality measurement.',sources:[]}});
}
assert.equal(rows.length,360);const witnesses=json(resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json')).witnesses,contract=json(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-decision-contract-v4.json'));
const plan=compileAiPanel({runId:randomUUID(),observations:rows,witnesses,contract});assert.equal(validateAiPanel(plan),true);assert.equal(plan.slots.length,1512);
if(reuse){const first=json(resolve(OUT,'phase19/ai-panel-http-node24-first/plan-private-synthetic.json'));assert.deepEqual(plan.rows.map(r=>[r.id,r.evidenceHash,r.parentReceiptHash]),first.rows.map(r=>[r.id,r.evidenceHash,r.parentReceiptHash]));assert.deepEqual(plan.slots.map(s=>s.bodySha256),first.slots.map(s=>s.bodySha256));}
save('plan-private-synthetic.json',plan);const slots=new Map(plan.slots.map(s=>[s.requestId,s])),seen=new Set(),events=[],records=[];let listening=false,port,server;
const positive=()=>({...Object.fromEntries(DIMENSIONS.map(k=>[k,'pass'])),criticalErrors:Object.fromEntries(CRITICAL.map(k=>[k,false]))});
const dissent=plan.slots.find(s=>s.kind==='review').requestId;
function event(slot,status){events.push({requestId:slot?.requestId??null,bodySha256:slot?.bodySha256??null,status});}
try{
 server=createServer(async(req,res)=>{
  let slot;try{
   assert.equal(req.method,'POST');assert.equal(req.url,'/panel');assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.connection,'close');slot=slots.get(req.headers['x-panel-request']);assert.ok(slot);assert.ok(!seen.has(slot.requestId));
   const chunks=[];let bytes=0;for await(const b of req){bytes+=b.length;assert.ok(bytes<=131072);chunks.push(b);}const raw=Buffer.concat(chunks).toString('utf8');assert.equal(raw,slot.raw);assert.equal(sha(raw),slot.bodySha256);seen.add(slot.requestId);
   const g=slot.kind==='calibration'?plan.calibrationReferences.find(w=>w.witnessId===slot.privateBinding.witnessId).expectedGrade:positive(),grade=structuredClone(g);if(slot.requestId===dissent)grade.explanation='fail';
   event(slot,200);res.writeHead(200,{'content-type':'application/json',connection:'close'});res.end(JSON.stringify({grade,reasonCodes:['confirmed']}));
  }catch{event(slot,409);res.writeHead(409,{'content-type':'application/json',connection:'close'});res.end('{"held":true}');}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});listening=true;port=server.address().port;const endpoint='http://127.0.0.1:'+port+'/panel';
 const send=(slot,raw=slot.raw)=>fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-panel-request':slot.requestId,connection:'close'},body:raw,signal:AbortSignal.timeout(10000)});
 // A wrong body is refused before the id is consumed;correct first body can run.
 const first=plan.slots[0],bad=await send(first,first.raw+' ');assert.equal(bad.status,409);await bad.body.cancel();
 for(const slot of plan.slots){
  const response=await send(slot);assert.equal(response.status,200);const payloadRaw=await response.text();records.push({key:slot.key,requestId:slot.requestId,judgeId:slot.judgeId,layout:slot.layout,evidenceHash:slot.evidenceHash,bodySha256:slot.bodySha256,state:'graded',payloadRaw});
 }
 const duplicate=await send(first);assert.equal(duplicate.status,409);await duplicate.body.cancel();assert.equal(seen.size,1512);
 const report=summarizeAiPanel(plan,records);assert.equal(report.denominator,360);assert.equal(report.calibration.thresholdArithmeticSatisfied,true);assert.equal(report.counts['held-disagreement'],1);assert.equal(report.counts['ai-consensus-pass'],359);assert.equal(report.rows.reduce((n,r)=>n+r.rawReviews.length,0),1440);assert.equal(report.releaseVerdict,'held');
 save('records-synthetic.json',records);save('report-synthetic.json',report);
 await new Promise(yes=>{server.close(yes);server.closeAllConnections();});listening=false;assert.equal(server.listening,false);await assert.rejects(fetch(endpoint,{signal:AbortSignal.timeout(1000)}));
 for(const [file,h]of oldFiles)assert.equal(sha(readFileSync(file)),h,file);
 save('http-observations.json',{passed:true,requestsAccepted:1512,reviewRequests:1440,calibrationRequests:72,negativeBodyRejected:1,duplicateRejected:1,dissentHeld:1,denominator:360,oldSourceFilesReadOnly:oldFiles.size,oldSourceRunClosed:true,oldSourceRunId:bundle.spec.runId,oldSourceFilesSha256:Object.fromEntries(oldFiles),parentReceiptHashes:Object.fromEntries(rows.map(r=>[r.id,r.parentReceiptHash])),parentVerificationMode:reuse?'exact-byte-reuse-of-proven-v2-captures':'full-v2-journal-replay',newPlanRunId:plan.runId,newPlanSeal:plan.seal,events,ownedLoopbackStopped:true,ownedPortClosed:true,actualProviderCalls:0,actualKeyReads:0,realDispatchAuthorized:false,realEnglishQualityMeasured:false,sourceAllSynthetic:true,durablePanelRuntimeImplemented:false,paidApprovalOrBudgetIntegrationImplemented:false,scope:'Actual new panel HTTP request/response accounting using read-only prior fake generation captures. Not a real AI call,paid runtime,AI calibration,English quality or actual bias resistance test.'});
 console.log(JSON.stringify({passed:true,accepted:1512,dissentHeld:1,oldFilesPreserved:oldFiles.size,stopped:true,actualProviderCalls:0,exitCode:0}));
}finally{if(listening)await new Promise(yes=>{server.close(yes);server.closeAllConnections();});}
