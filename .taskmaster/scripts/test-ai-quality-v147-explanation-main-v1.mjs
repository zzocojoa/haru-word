import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {explanationMainFixtureV1} from './ai-quality-v147-explanation-main-fixture-v1.mjs';
import {explanationMainEnabledV1,explanationMainPolicyV1,verifyExplanationMainV1,assertExplanationMainParentV1,inspectExplanationMainAdmissionV1} from './ai-quality-v147-explanation-main-v1.mjs';
import {PRODUCT_RUBRIC_HASH_V4,validateExplanationScopeRequestV1,parseExplanationScopePayloadV1} from './ai-quality-v147-explanation-scope-v1.mjs';
import {ASSESSMENT_CONTEXT_HASH_V1} from './ai-quality-v147-assessment-context-v1.mjs';
import {compileAiPanel,validateAiPanel,parsePanelPayloadForRequest,summarizeAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {compileV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {createV3Journal,openV3Journal,readV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {buildPanelReportV3} from './ai-quality-v147-panel-report-v3.mjs';
import {openSyntheticPanelExecutorV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {openSyntheticInputCountStoreV1,inspectSyntheticInputCountsV1} from './ai-quality-v147-input-count-store-v1.mjs';
import {startSyntheticHttpV3} from './ai-quality-v147-synthetic-http-v3.mjs';
import {startSyntheticInputCountHttpV1} from './ai-quality-v147-input-count-http-v1.mjs';
import {digest} from './ai-quality-v147-calibration.mjs';

const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),ROOT=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot;
const OUT=resolve(process.env.QA_OUTPUT_DIR),EVIDENCE=resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106'),parts=OUT.slice(EVIDENCE.length+1).split(/[\\/]/);
assert.ok(OUT.startsWith(EVIDENCE+'\\')&&parts.length===2&&/^phase[0-9]+$/.test(parts[0])&&!existsSync(resolve(EVIDENCE,parts[0],'progress-final.json')),'Explicit output must be inside an unfrozen evidence phase');mkdirSync(OUT,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(OUT,name+'.json'),JSON.stringify(value,null,2)+'\n'),sha=x=>createHash('sha256').update(x).digest('hex');
const BASE=explanationMainFixtureV1(),BANK=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/explanation-development-v1.json'),'utf8'));
function fixtureArgs(b){return{runId:b.spec.runId,observations:b.spec.requests.filter(d=>d.role==='generation').map(d=>{const c=b.reportInputs.cases.find(c=>c.id===d.caseId);return{id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:c.id,familyId:c.familyId,domain:c.domain,stratum:c.stratum,input:c.input,requestInput:c.requestInput,reference:c.reference,feedback:JSON.parse(b.responses[d.key]),parentReceiptHash:digest('synthetic-future-capture')};}),witnesses:b.reportInputs.witnesses,contract:b.reportInputs.contract,salt:Buffer.alloc(32,7)};}
const controls=['EP01','EP05','EP07','EP08'].map(id=>BANK.rows.find(row=>row.id===id));
const args=fixtureArgs(BASE);args.observations=controls.map((row,n)=>({id:row.id,generatorId:['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'][n%3],phase:'candidate',caseId:row.id,familyId:'mechanism/'+row.id,domain:row.assessmentDomain,stratum:'normal',input:row.input,requestInput:row.requestInput,reference:{level:'source-supported',criterion:'Synthetic transport control; scores are not independently qualified.',sources:[{url:'https://developers.openai.com/api/docs/guides/evaluation-best-practices',checkedAt:'2026-11-08T00:00:00Z',contentSha256:digest('mechanism-only'),excerpt:'Synthetic mechanism only; no English claim.'}]},feedback:row.feedback,parentReceiptHash:digest('fixture/'+row.id)}));
const PLAN=compileAiPanel(args);
function recordsFor(plan=PLAN){return plan.slots.map(slot=>{const w=slot.kind==='calibration'?BASE.reportInputs.witnesses.find(w=>w.id===slot.privateBinding.witnessId):controls.find(row=>row.id===slot.privateBinding.sourceId),payload={grade:structuredClone(w.expectedGrade),reasonCodes:['confirmed'],productRubricHash:PRODUCT_RUBRIC_HASH_V4,assessmentContextHash:ASSESSMENT_CONTEXT_HASH_V1,...w.expectedEvidenceAxes};return{key:slot.key,requestId:slot.requestId,judgeId:slot.judgeId,layout:slot.layout,evidenceHash:slot.evidenceHash,bodySha256:slot.bodySha256,state:'graded',payloadRaw:JSON.stringify(payload)};});}
function scenario(name,b=structuredClone(BASE)){const root=resolve(OUT,name);mkdirSync(root);const context={allowedRoot:root,directory:resolve(root,'v3-'+b.spec.runId),spec:b.spec};createV3Journal(context,b.approval);return{root,context,b};}
const options=c=>({context:c.context,seal:c.b.seal,observeCurrent:()=>c.b.current,readWire:key=>c.b.wires[key],reportInputs:c.b.reportInputs});

// This controlled fixture ingestion uses the existing journal/count/capture
// primitives directly. It is test code, not an executor or admission bypass.
async function ingest(c,{stopAfterFirst=false}={}){
 const http=await startSyntheticHttpV3({bundle:c.b,logFile:resolve(c.root,'http.jsonl')}),counter=await startSyntheticInputCountHttpV1({bundle:c.b,logFile:resolve(c.root,'count.jsonl')}),wire=compileV3Wire({seal:c.b.seal,spec:c.b.spec}),store=openV3CaptureStore({context:c.context,seal:c.b.seal,observeCurrent:()=>c.b.current}),session=openV3Journal(c.context),counts=openSyntheticInputCountStoreV1({context:c.context,session,observeCurrent:()=>c.b.current});
 try{
  for(const key of c.b.spec.order){
   const d=c.b.spec.requests.find(d=>d.key===key),groupId=d.role==='calibration'?'calibration/'+d.caseId:[d.phase,d.generatorId,d.caseId,d.repetition].join('/');
   if(!session.current().ledger.slots[key])session.append({kind:'reserve',groupId});
   const ledger=session.current().ledger,parent=d.parentKey?store.read({ledger,key:d.parentKey}):null,prepared=wire.prepare({current:c.b.current,ledger,key,wire:c.b.wires[key],parentCapture:parent});
   if(['review','calibration'].includes(d.role))assertExplanationMainParentV1({requestRaw:prepared.raw,parentRequestRaw:parent?.requestRaw??null,role:d.role});
   await counts.ensure({descriptor:d,generationWire:prepared,transport:counter.send});counts.verify({descriptor:d,generationWire:prepared});session.append([...(prepared.bindOperation?[prepared.bindOperation]:[]),{kind:'consume',key}]);
   const response=await http.send({key,requestId:wire.requestId(key),requestRaw:prepared.raw});store.capture({ledger:session.current().ledger,key,requestRaw:prepared.raw,...response});const settled=store.settle({session,key});if(stopAfterFirst||settled.result.state!=='completed')break;
  }
  session.append({kind:'close'});const state=session.current(),report=buildPanelReportV3({spec:c.b.spec,seal:c.b.seal,ledger:state.ledger,store,inputs:c.b.reportInputs});
  return{report,state,models:http.events().length,counts:counter.events().length,inputCounts:inspectSyntheticInputCountsV1(c.context)};
 }finally{try{session.close();}finally{await http.close();await counter.close();}}
}

test('V4 main compiler forwards both original contexts, keeps four nonself reviews and all three judges',()=>{
 assert.equal(PLAN.slots.length,88);assert.equal(validateAiPanel(PLAN),true);assert.equal(PLAN.explanationScopeHash,PRODUCT_RUBRIC_HASH_V4);
 const domains=new Set();for(const slot of PLAN.slots){const body=validateExplanationScopeRequestV1(slot.raw),data=JSON.parse(body.input[0].content).EVALUATION_DATA;domains.add(data.input.assignmentContext.domain);assert.equal(body.max_output_tokens,1024);assert.equal(data.input.assignmentContext.requestInputHash,digest(data.input.assignmentContext.requestInput));for(const k of ['expectedGrade','generatorId','phase','witnessId'])assert.equal(Object.hasOwn(data,k),false);assert.equal(Object.keys(body.text.format.schema.properties.grade.properties).length,6);assert.equal(Object.keys(body.text.format.schema.properties.grade.properties.criticalErrors.properties).length,4);}
 for(const row of PLAN.rows){assert.equal(row.slots.length,4);assert.ok(PLAN.slots.filter(s=>row.slots.includes(s.key)).every(s=>s.judgeId!==row.generatorId));}
 assert.deepEqual([...new Set(PLAN.slots.map(s=>s.judgeId))].sort(),['gpt-6-astra','gpt-6.1-sol','gpt-6.1-terra']);save('compiled',{slots:88,calibration:72,reviews:16,englishPolicyHash:PRODUCT_RUBRIC_HASH_V4,domains:[...domains],actualProviderCalls:0});
});
test('mandatory V4 qualification cannot be disabled or relabelled by a caller',()=>{
 assert.equal(explanationMainEnabledV1({}),false);for(const change of [p=>p.sourceQualificationRequired=false,p=>p.outputTokenMax=4096,p=>p.kind='evaluation',p=>p.englishPolicyHash='0'.repeat(64)]){const c=structuredClone(BASE.reportInputs.contract);change(c.explanationScope);assert.throws(()=>explanationMainEnabledV1(c),/XM1_CONTRACT/);}
 const admission=inspectExplanationMainAdmissionV1({inputs:BASE.reportInputs,stage:'pilot-panel'});assert.equal(admission.required,true);assert.equal(admission.sourceQualified,false);assert.equal(admission.qualifiedWitnesses,0);save('admission',admission);
});
test('unqualified real executor stops before lease, input counting and model transport',()=>{
 const c=scenario('admission-held');let attempts=0;assert.throws(()=>openSyntheticPanelExecutorV3({...options(c),transport:async()=>{attempts++;},inputCountTransport:async()=>{attempts++;}}),/XM1_SOURCE_QUALIFICATION_REQUIRED/);assert.equal(attempts,0);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),false);save('prelease-held',{attempts,leaseCreated:false,qualificationBypass:false});
});
test('orphan V4 seal and a substituted old component are both rejected',()=>{
 const b=structuredClone(BASE);delete b.reportInputs.contract.explanationScope;assert.throws(()=>verifyExplanationMainV1({spec:b.spec,seal:b.seal,inputs:b.reportInputs}),/XM1_ORPHAN_POLICY/);b.reportInputs.contract.explanationScope=explanationMainPolicyV1();b.seal.payload.components.aiPanelPolicy='0'.repeat(64);assert.throws(()=>verifyExplanationMainV1({spec:b.spec,seal:b.seal,inputs:b.reportInputs}),/XM1_CAPTURE_POLICY/);
});
test('actual parent binding rejects a new target even if the sentence is unchanged',()=>{
 const slot=PLAN.slots.find(s=>s.kind==='review'),body=JSON.parse(slot.raw),input=JSON.parse(body.input[0].content).EVALUATION_DATA.input,parent={input:[{content:JSON.stringify(input.assignmentContext.requestInput)}]};assert.doesNotThrow(()=>assertExplanationMainParentV1({requestRaw:slot.raw,parentRequestRaw:JSON.stringify(parent),role:'review'}));const wrong=structuredClone(input.assignmentContext.requestInput);wrong.meaning='different target';parent.input[0].content=JSON.stringify(wrong);assert.throws(()=>assertExplanationMainParentV1({requestRaw:slot.raw,parentRequestRaw:JSON.stringify(parent),role:'review'}),/XM1_ACTUAL_PARENT_INPUT/);assert.throws(()=>assertExplanationMainParentV1({requestRaw:slot.raw,role:'review'}),/XM1_PARENT_REQUIRED/);
});
test('old policy echoes, duplicate keys and cap drift do not parse as V4',()=>{
 const record=recordsFor()[0],slot=PLAN.slots[0],value=JSON.parse(record.payloadRaw);assert.equal(parsePanelPayloadForRequest({requestRaw:slot.raw,payloadRaw:record.payloadRaw}).explanationScopeHash,PRODUCT_RUBRIC_HASH_V4);
 for(const mutate of [v=>delete v.assessmentContextHash,v=>v.productRubricHash='0'.repeat(64)]){const v=structuredClone(value);mutate(v);assert.throws(()=>parseExplanationScopePayloadV1({requestRaw:slot.raw,payloadRaw:JSON.stringify(v)}));}
 assert.throws(()=>parseExplanationScopePayloadV1({requestRaw:slot.raw,payloadRaw:record.payloadRaw.replace('{','{"grade":null,')}));const body=JSON.parse(slot.raw);body.max_output_tokens=4096;assert.throws(()=>validateExplanationScopeRequestV1(JSON.stringify(body)),/OUTPUT_CAP/);
});
test('true explanation does not clear a bad repair; false explanation alone also fails',()=>{
 const report=summarizeAiPanel(PLAN,recordsFor());for(const id of ['EP01','EP08'])assert.equal(report.rows.find(r=>r.rowId===id).state,'ai-consensus-fail');const trueBad=report.rows.find(r=>r.rowId==='EP01');assert.ok(trueBad.rawReviews.every(r=>r.grade.explanation==='pass'&&r.grade.correction==='fail'));const falseOnly=report.rows.find(r=>r.rowId==='EP08');assert.ok(falseOnly.rawReviews.every(r=>r.grade.explanation==='fail'&&r.grade.grammar==='pass'));assert.equal(report.englishAccuracyCertified,false);assert.equal(report.releaseVerdict,'held');save('explanation-repair-separate',report);
});
test('meaning reversal remains critical and unanimous good fixture still has no English certification',()=>{
 const report=summarizeAiPanel(PLAN,recordsFor());assert.equal(report.rows.find(r=>r.rowId==='EP05').state,'held-critical');assert.equal(report.rows.find(r=>r.rowId==='EP07').state,'ai-consensus-pass');assert.equal(report.explanationScope.sourceQualified,false);assert.equal(report.realDispatchAuthorized,false);
});
test('source insufficiency and context-axis dissent cannot be hidden by an English pass',()=>{
 const records=recordsFor(),slot=PLAN.slots.find(s=>s.kind==='review'&&s.privateBinding.sourceId==='EP07'),record=records.find(r=>r.key===slot.key),original=record.payloadRaw;let value=JSON.parse(original);value.sourceAdequacy='insufficient';record.payloadRaw=JSON.stringify(value);assert.equal(summarizeAiPanel(PLAN,records).rows.find(r=>r.rowId==='EP07').state,'held-reference');value=JSON.parse(original);value.learnerContext='missing';value.abstentionNeed='required';record.payloadRaw=JSON.stringify(value);assert.equal(summarizeAiPanel(PLAN,records).rows.find(r=>r.rowId==='EP07').state,'held-disagreement');
});
test('132-slot controlled fixture ingestion binds V4 capture/count/report; executor admission remains held',{timeout:900000},async()=>{
 const c=scenario('physical-fixture'),z=await ingest(c);assert.equal(z.models,132);assert.equal(z.counts,132);assert.equal(z.inputCounts.receipts,132);assert.equal(z.report.collectionComplete,true);assert.equal(z.report.explanationScope.syntheticMainIntegrated,true);assert.equal(z.report.calibration.sourceQualification.sourceQualified,false);assert.equal(z.report.calibration.calibrationAcceptanceAllowed,false);assert.equal(z.report.panel.counts['ai-consensus-pass'],12);assert.equal(z.report.provenance.length,120);assert.ok(z.report.panel.rows.every(row=>row.rawReviews.every(v=>v.explanationScope.hash===PRODUCT_RUBRIC_HASH_V4)));assert.equal(z.report.actualProviderCalls,0);assert.equal(z.report.releaseVerdict,'held');assert.throws(()=>openSyntheticPanelExecutorV3({...options(c),transport:async()=>{throw Error('unexpected');},inputCountTransport:async()=>{throw Error('unexpected');}}),/XM1_SOURCE_QUALIFICATION_REQUIRED/);save('fixture-ingestion',{models:z.models,counts:z.counts,inputCountReceipts:z.inputCounts.receipts,report:z.report,controlledTestIngestion:true,executorAdmissionSucceeded:false,fixtureGradesAreNotNewEnglishGold:true,actualProviderCalls:0,actualKeyReads:0});
});
test('invalid V4 capture retains raw response and known usage at unknown upper cost',{timeout:300000},async()=>{
 const b=structuredClone(BASE),first=b.spec.order[0],v=JSON.parse(b.responses[first]);delete v.assessmentContextHash;b.responses[first]=JSON.stringify(v);const c=scenario('bad-echo-fixture',b),z=await ingest(c,{stopAfterFirst:true});assert.equal(z.models,1);assert.equal(z.counts,1);const state=readV3Journal(c.context),row=state.ledger.slots[first];assert.equal(row.state,'unknown');assert.deepEqual(row.result.usage,{inputTokens:20,outputTokens:20});assert.ok(BigInt(state.account.upperMicros)>0n);const store=openV3CaptureStore({context:c.context,seal:b.seal,observeCurrent:()=>b.current}),capture=store.read({ledger:state.ledger,key:first});assert.equal(capture.result.state,'unknown');assert.ok(capture.responseRaw.includes('usage'));save('unknown-capture',{models:1,counts:1,usage:row.result.usage,rawResponseSha256:sha(capture.responseRaw),upperMicros:state.account.upperMicros,retryPerformed:false});
});
test('legacy and V2 context compiler bytes equal the frozen prechange compiler',{timeout:300000},async()=>{
 const archive=resolve(EVIDENCE,'phase73/management-before/.taskmaster/scripts/ai-quality-v147-ai-panel.mjs'),proof=JSON.parse(readFileSync(resolve(EVIDENCE,'phase72/progress-final.json'),'utf8'));assert.equal(sha(readFileSync(archive)),proof.managementFileSha256['.taskmaster/scripts/ai-quality-v147-ai-panel.mjs']);const portable=resolve(OUT,'prior-ai-panel.mjs'),source=readFileSync(archive,'utf8').replaceAll(/from '\.\/([^']+)'/g,(_,name)=>"from '"+pathToFileURL(resolve(SOURCE,'.taskmaster/scripts',name)).href+"'");writeFileSync(portable,source);const old=await import(pathToFileURL(portable)),{assessmentFixtureV1}=await import('./ai-quality-v147-assessment-context-fixture-v1.mjs'),base=assessmentFixtureV1(),a=fixtureArgs(base);for(const kind of ['context','legacy']){if(kind==='legacy')delete a.contract.assessmentContext;const before=old.compileAiPanel(a),after=compileAiPanel(a);assert.equal(digest(after),digest(before));save('legacy-'+kind,{slots:after.slots.length,byteIdentical:true,planSeal:after.seal});}
});
test('all37 paid diagnostic pins and all549 original runtime files are unchanged',()=>{
 const execution=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-explanation-pair-execution-v1.json'),'utf8'));for(const [file,hash]of Object.entries(execution.sourceBindings))assert.equal(sha(readFileSync(resolve(SOURCE,file))),hash,file);for(const [file,hash]of Object.entries(execution.runtimeFiles))assert.equal(sha(readFileSync(resolve(execution.runtimeRoot,file))),hash,file);assert.equal(Object.keys(execution.sourceBindings).length,37);assert.equal(Object.keys(execution.runtimeFiles).length,549);save('paid-preserved',{sourceFiles:37,runtimeFiles:549,unchanged:true,oldResultsRescored:false});
});
