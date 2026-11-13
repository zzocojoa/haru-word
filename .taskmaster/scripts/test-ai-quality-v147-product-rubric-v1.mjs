import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {compileAiPanel,parsePanelPayload,parsePanelPayloadForRequest} from './ai-quality-v147-ai-panel.mjs';
import {productPanelFixtureV1} from './ai-quality-v147-product-rubric-fixture-v1.mjs';
import {loadProductRubricV1,PRODUCT_RUBRIC_HASH_V1,PRODUCT_RUBRIC_FORMAT_V1,attachProductRubricRequestV1,parseProductRubricPayloadV1,validateProductRubricRequestV1} from './ai-quality-v147-product-rubric-v1.mjs';
import {panelFixtureV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {createV3Journal,readV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openSyntheticPanelExecutorV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {startSyntheticHttpV3} from './ai-quality-v147-synthetic-http-v3.mjs';
import {startSyntheticInputCountHttpV1} from './ai-quality-v147-input-count-http-v1.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {inspectSyntheticFamilyPairsV1} from './ai-quality-v147-family-readback-v1.mjs';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';

const HERE=dirname(fileURLToPath(import.meta.url)),SOURCE=resolve(HERE,'../..');
const manifest=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8'));
const ROOT=resolve(manifest.baseline.existingDashboardRoot),OUT=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(OUT,{recursive:false});
const sha=s=>createHash('sha256').update(s).digest('hex'),save=(name,x)=>writeFileSync(resolve(OUT,name+'.json'),JSON.stringify(x,null,2)+'\n');
const arithmetic={familywiseConfidence:.95,boundCount:114,minimumImprovement:0};
function scenario(name,b=productPanelFixtureV1()){
 const root=resolve(OUT,name);mkdirSync(root);const context={allowedRoot:root,directory:resolve(root,'v3-'+b.spec.runId),spec:b.spec};createV3Journal(context,b.approval);writeFileSync(resolve(root,'bundle.json'),JSON.stringify(b));return {root,context,b};
}
const options=c=>({context:c.context,seal:c.b.seal,observeCurrent:()=>c.b.current,readWire:k=>c.b.wires[k],reportInputs:c.b.reportInputs});
async function run(c,open=openSyntheticPanelExecutorV3){
 const n=readdirSync(c.root).length,http=await startSyntheticHttpV3({bundle:c.b,logFile:resolve(c.root,'http-'+n+'.jsonl')}),counter=await startSyntheticInputCountHttpV1({bundle:c.b,logFile:resolve(c.root,'count-'+n+'.jsonl')});let e;
 try{e=open({...options(c),transport:http.send,inputCountTransport:counter.send});const result=await e.collect();e.release();e=null;return {result,http:http.events(),counter:counter.events()};}
 finally{try{e?.abandon();}finally{await http.close();await counter.close();}}
}
function reseal(b){const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;}
function compileFixture(b,contract=b.reportInputs.contract){return {runId:b.spec.runId,observations:b.spec.requests.filter(d=>d.role==='generation').map(d=>{const c=b.reportInputs.cases.find(c=>c.id===d.caseId);return {id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:c.id,familyId:c.familyId,domain:c.domain,stratum:c.stratum,input:c.input,reference:c.reference,feedback:null,parentReceiptHash:digest('synthetic-future-capture')};}),witnesses:b.reportInputs.witnesses,contract,salt:Buffer.alloc(32,7)};}

test('reference7/5flags andproduct5/4flags are distinct scoped contracts; no automatic seven-dimension main obligation',()=>{
 const p=loadProductRubricV1(),r=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-reference-operational-rubric-v1.json'),'utf8'));
 assert.equal(Object.keys(p.dimensions).length,5);assert.equal(Object.keys(p.criticalFlags).length,4);assert.equal(Object.keys(r.dimensions).length,7);assert.equal(Object.keys(r.criticalFlags).length,5);assert.match(p.scope,/product feedback/);assert.match(r.scope,/Reference-record review/);assert.equal(p.independentQualification,false);assert.equal(p.englishTruthCertified,false);
 save('scope-correction',{productDimensions:5,productCriticalFlags:4,referenceDimensions:7,referenceCriticalFlags:5,referenceSevenIsNotProductRequirement:true,priorPhase59SevenDimensionMainAssumptionSuperseded:true,productPolicyHash:PRODUCT_RUBRIC_HASH_V1,englishTruthCertified:false});
});

test('all main/calibration slots useversioned five-dimension schema andtwoorders withprivate labels excluded',()=>{
 const b=productPanelFixtureV1({caseCount:2}),plan=compileAiPanel(compileFixture(b));assert.equal(plan.productOperationalRubricHash,PRODUCT_RUBRIC_HASH_V1);
 assert.equal(plan.slots.length,120);for(const s of plan.slots){const w=validateProductRubricRequestV1(s.raw),data=JSON.parse(w.input[0].content);assert.deepEqual(Object.keys(data),['EVALUATION_DATA']);assert.equal(Object.keys(w.text.format.schema.properties.grade.properties).length,6);assert.equal(Object.keys(w.text.format.schema.properties.grade.properties.criticalErrors.properties).length,4);assert.ok(w.text.format.schema.required.includes('productRubricHash'));for(const k of ['expectedGrade','generatorId','phase','witnessId'])assert.equal(Object.hasOwn(data.EVALUATION_DATA,k),false);assert.equal(w.max_output_tokens,4096);}
 assert.equal(plan.slots.filter(s=>s.kind==='calibration').length,72);assert.equal(plan.slots.filter(s=>s.kind==='review').length,48);assert.deepEqual([...new Set(plan.slots.map(s=>s.layout))].sort(),['feedback-first','input-first']);save('compiled-policy',{slots:120,calibration:72,review:48,rubricHash:PRODUCT_RUBRIC_HASH_V1,requestsByteMaximum:Math.max(...plan.slots.map(s=>Buffer.byteLength(s.raw))),oldExpectedVectorsChanged:false});
});

test('new andlegacy responses cannotcross policy boundaries;hash echoes are not correctness certificates',()=>{
 const b=productPanelFixtureV1(),d=b.spec.requests[0],requestRaw=b.wires[d.key].raw,v=JSON.parse(b.responses[d.key]),old=structuredClone(v);delete old.productRubricHash;
 assert.throws(()=>parsePanelPayload(JSON.stringify(v)));assert.throws(()=>parseProductRubricPayloadV1({requestRaw,payloadRaw:JSON.stringify(old)}));
 const legacy=panelFixtureV3(),wire=legacy.wires[legacy.spec.order[0]].raw;assert.throws(()=>parsePanelPayloadForRequest({requestRaw:wire,payloadRaw:JSON.stringify(v)}));
 const parsed=parseProductRubricPayloadV1({requestRaw,payloadRaw:JSON.stringify(v)});assert.equal(parsed.semanticCorrectnessVerified,false);assert.equal(parsed.judgeQualificationVerified,false);
 for(const productRubricHash of ['0'.repeat(64),'746a388948026d316b6ccb06a2d1502e3f5f534b3d3e133eb05638d0b80c29ea'])assert.throws(()=>parseProductRubricPayloadV1({requestRaw,payloadRaw:JSON.stringify({...v,productRubricHash})}));
 const reference=JSON.parse(wire);reference.text.format.name='reference_review_operational_v1';assert.throws(()=>attachProductRubricRequestV1(JSON.stringify(reference)),/SOURCE_FORMAT/);
});

test('critical dimension implications rejectcontradictions withoutfailing unrelated dimensions or inventing critical flags',()=>{
 const b=productPanelFixtureV1(),key=b.spec.order[0],requestRaw=b.wires[key].raw,v=JSON.parse(b.responses[key]);
 const labelOnly=structuredClone(v);labelOnly.grade.meaning='fail';const p=parseProductRubricPayloadV1({requestRaw,payloadRaw:JSON.stringify(labelOnly)});assert.equal(p.grade.grammar,'pass');assert.ok(Object.values(p.grade.criticalErrors).every(x=>x===false));
 const bad=structuredClone(v);bad.grade.criticalErrors.swapRoles=true;assert.throws(()=>parseProductRubricPayloadV1({requestRaw,payloadRaw:JSON.stringify(bad)}),/CRITICAL_DIMENSION/);bad.grade.correction='fail';assert.equal(parseProductRubricPayloadV1({requestRaw,payloadRaw:JSON.stringify(bad)}).grade.grammar,'pass');
 const duplicate=JSON.stringify(v).replace('"grade":','"gr\\u0061de":{},"grade":');assert.throws(()=>parseProductRubricPayloadV1({requestRaw,payloadRaw:duplicate}),/DUPLICATE_KEY/);
});

test('legacy unopted compiler remainsbyte-identical tothearchived phase59 implementation',async()=>{
 const archive=resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106/phase60/management-before'),priorBindings=JSON.parse(readFileSync(resolve(archive,'.taskmaster/docs/ai-quality-v147-family-pair-preparation-v1.json'),'utf8')).sourceBindings,dependency=resolve(HERE,'ai-quality-v147-calibration.mjs');assert.equal(sha(readFileSync(dependency)),priorBindings['.taskmaster/scripts/ai-quality-v147-calibration.mjs']);
 const original=readFileSync(resolve(archive,'.taskmaster/scripts/ai-quality-v147-ai-panel.mjs'),'utf8'),portable=resolve(OUT,'archived-legacy-compiler.mjs');assert.equal(original.split("from './ai-quality-v147-calibration.mjs'").length,2);writeFileSync(portable,original.replace("from './ai-quality-v147-calibration.mjs'",`from '${pathToFileURL(dependency).href}'`));
 const old=await import(pathToFileURL(portable)),b=panelFixtureV3({caseCount:2}),args=compileFixture(b),prior=old.compileAiPanel(args),current=compileAiPanel(args);assert.deepEqual(current,prior);save('legacy-compiler-equivalence',{byteIdentical:true,slots:current.slots.length,planHash:digest(current),productOperationalRubricPresent:false,archivedModuleSha256:sha(original),unchangedDependencyHashVerified:true,onlyImportPathRebound:true});
});

test('counted physical main132slots preserve policy bytes/calibration/nonselfvotes/report andread-only family replay',{timeout:300000},async()=>{
 const c=scenario('positive',productPanelFixtureV1({caseCount:2})),z=await run(c);assert.equal(z.result.status,'synthetic-collected');assert.equal(z.result.sent,132);assert.equal(z.http.length,132);assert.equal(z.counter.length,132);assert.equal(z.result.report.collectionComplete,true);assert.equal(z.result.report.productOperationalRubric.hash,PRODUCT_RUBRIC_HASH_V1);assert.equal(z.result.report.panel.counts['ai-consensus-pass'],12);assert.equal(z.result.report.calibration.thresholdArithmeticSatisfied,true);assert.equal(z.result.report.calibration.calibrationAcceptanceAllowed,false);
 const raw=readV3Journal(c.context),store=openV3CaptureStore(options(c));for(const d of c.b.spec.requests.filter(d=>['review','calibration'].includes(d.role))){const cap=store.read({ledger:raw.ledger,key:d.key});assert.equal(JSON.parse(cap.requestRaw).text.format.name,PRODUCT_RUBRIC_FORMAT_V1);assert.equal(JSON.parse(cap.payloadRaw).productRubricHash,PRODUCT_RUBRIC_HASH_V1);}
 const family=inspectSyntheticFamilyPairsV1({...options(c),arithmetic});assert.equal(family.plannedFamilyLabels,2);assert.equal(family.qualificationHoldsLifted,false);assert.equal(family.actualEnglishQualityMeasured,false);
 const repeat=await run(c);assert.equal(repeat.result.sent,0);assert.equal(repeat.http.length,0);assert.equal(repeat.counter.length,0);assert.equal(digest(repeat.result.report),digest(z.result.report));save('physical-counted-main',{requests:132,countRequests:132,mainJudgments:48,calibrationJudgments:72,report:z.result.report,family,closedRepeatSends:0,actualProviderCalls:0});
});

test('current required calibration-source qualification blocks beforelease,count andgeneration despitevalidnewpolicy',async()=>{
 const c=scenario('unqualified',productPanelFixtureV1({requireCurrentQualification:true}));let sends=0,counts=0;
 assert.throws(()=>openSyntheticPanelExecutorV3({...options(c),transport:async()=>{sends++;},inputCountTransport:async()=>{counts++;}}),/CALQ1_REFERENCE_UNQUALIFIED/);assert.equal(sends,0);assert.equal(counts,0);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),false);assert.equal(Object.keys(readV3Journal(c.context).ledger.slots).length,0);save('qualification-held',{leaseCreated:false,syntheticCounts:counts,syntheticModels:sends,realAiQualification:false,old12ExpectationsChanged:false});
});

test('one new-policy dissent staysheld,rawvotes stayseparate andfamily pair becomesunavailable',{timeout:240000},async()=>{
 const b=productPanelFixtureV1(),d=b.spec.requests.find(d=>d.role==='review'),v=JSON.parse(b.responses[d.key]);v.grade.grammar='fail';v.reasonCodes=['grammar'];b.responses[d.key]=JSON.stringify(v);const c=scenario('dissent',b),z=await run(c);assert.equal(z.result.report.panel.counts['held-disagreement'],1);assert.equal(z.result.report.panel.majorityVoteApplied,false);assert.equal(z.result.report.releaseVerdict,'held');const r=inspectSyntheticFamilyPairsV1({...options(c),arithmetic});assert.equal(r.units.filter(u=>u.category==='unavailable').length,1);save('dissent-held',{report:z.result.report,family:r});
});

test('missing rubric echo iscaptured/settled withknownusage thenheld;closed repeatdoesnotresend',{timeout:180000},async()=>{
 const b=productPanelFixtureV1(),key=b.spec.order[0],v=JSON.parse(b.responses[key]);delete v.productRubricHash;b.responses[key]=JSON.stringify(v);const c=scenario('old-response',b),z=await run(c);assert.equal(z.result.status,'held');assert.equal(z.http.length,1);assert.equal(z.counter.length,1);const state=readV3Journal(c.context);assert.equal(state.ledger.closed,true);assert.equal(state.ledger.slots[key].state,'unknown');assert.ok(BigInt(state.account.upperMicros)>0n);const cap=openV3CaptureStore(options(c)).read({ledger:state.ledger,key});assert.ok(cap.responseRaw.includes('output_text'));assert.equal(cap.result.usage.inputTokens,20);const repeat=await run(c);assert.equal(repeat.http.length,0);assert.equal(repeat.counter.length,0);save('echo-held',{countRequests:1,modelRequests:1,state:'unknown',knownUsage:cap.result.usage,upperMicros:state.account.upperMicros,rawPreserved:true,closedRepeatSends:0});
});

test('requiredpolicy prepareguard prevents downgradedrequest beforecount/consume;one-guard mutant sends once butcannotqualify',{timeout:240000},async()=>{
 const file=resolve(HERE,'ai-quality-v147-panel-executor-v3.mjs'),source=readFileSync(file,'utf8'),needle="if(productOperational&&['review','calibration'].includes(d.role))validateProductRubricRequestV1(prepared.raw);";assert.equal(source.split(needle).length,2);const mutant=resolve(OUT,'controlled-product-guard-mutant.mjs');writeFileSync(mutant,source.replace(needle,'').replaceAll(/from '\.\/([^']+)'/g,(_,name)=>`from '${pathToFileURL(resolve(HERE,name)).href}'`));const m=await import(pathToFileURL(mutant)),rows=[];
 for(const [kind,open]of [['real',openSyntheticPanelExecutorV3],['mutant',m.openSyntheticPanelExecutorV3]]){const b=productPanelFixtureV1(),key=b.spec.order[0],d=b.spec.requests[0],wire=JSON.parse(b.wires[key].raw);wire.text.format.name='haru_ai_panel_grade';delete wire.text.format.schema.properties.productRubricHash;wire.text.format.schema.required=wire.text.format.schema.required.filter(x=>x!=='productRubricHash');b.wires[key].raw=JSON.stringify(wire);d.bodyHash=sha(b.wires[key].raw);reseal(b);const c=scenario('downgrade-'+kind,b),z=await run(c,open),state=readV3Journal(c.context);assert.equal(z.counter.length,kind==='real'?0:1);assert.equal(z.http.length,kind==='real'?0:1);assert.equal(z.result.status,'held');rows.push({kind,countRequests:z.counter.length,modelRequests:z.http.length,slots:state.ledger.slots,upperMicros:state.account.upperMicros});}
 save('guard-contrast',{onlyPrepareGuardRemoved:true,outcomes:rows,actualProviderCalls:0});
});

test('isolated policy byte change is rejected;the original frozen policy stays unchanged',async()=>{
 const file=resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-product-operational-rubric-v1.json'),before=sha(readFileSync(file)),base=resolve(OUT,'policy-copy'),scripts=resolve(base,'scripts'),docs=resolve(base,'docs');mkdirSync(scripts,{recursive:true});mkdirSync(docs);const code=readFileSync(resolve(HERE,'ai-quality-v147-product-rubric-v1.mjs'),'utf8').replaceAll(/from '\.\/([^']+)'/g,(_,name)=>`from '${pathToFileURL(resolve(HERE,name)).href}'`);writeFileSync(resolve(scripts,'policy.mjs'),code);copyFileSync(file,resolve(docs,'ai-quality-v147-product-operational-rubric-v1.json'));const v=JSON.parse(readFileSync(resolve(docs,'ai-quality-v147-product-operational-rubric-v1.json'),'utf8'));v.scope+=' changed';writeFileSync(resolve(docs,'ai-quality-v147-product-operational-rubric-v1.json'),JSON.stringify(v));const m=await import(pathToFileURL(resolve(scripts,'policy.mjs')));assert.throws(()=>m.loadProductRubricV1(),/POLICY_BINDING/);assert.equal(sha(readFileSync(file)),before);save('policy-byte-hold',{isolatedTamperRejected:true,sourcePolicyUnchanged:true});
});

function child(args){return new Promise((done,reject)=>{const p=spawn(process.execPath,[resolve(HERE,'ai-quality-v147-panel-cli-v3.mjs'),...args],{stdio:['ignore','pipe','pipe'],windowsHide:true});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',(code,signal)=>done({pid:p.pid,code,signal,stdout,stderr}));});}
test('realCLI interruption keeps newpolicy rawbytes/financialevidence;explicit recovery neverduplicates count/model UUID',{timeout:600000},async()=>{
 const rows=[];for(const fault of ['after-capture','after-transport']){const c=scenario('cli-'+fault),first=await child([resolve(c.root,'bundle.json'),c.root,'result-first.json','--no-recover',fault]);assert.equal(first.code,91);const second=await child([resolve(c.root,'bundle.json'),c.root,'result-recovered.json','--recover']);assert.equal(second.code,fault==='after-capture'?0:2);const result=JSON.parse(readFileSync(resolve(c.root,'result-recovered.json'),'utf8'));const read=name=>readFileSync(resolve(c.root,name),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);const events=[...read('result-first.json.http.jsonl'),...read('result-recovered.json.http.jsonl')],counts=[...read('result-first.json.count.jsonl'),...read('result-recovered.json.count.jsonl')];assert.equal(new Set(events.map(x=>x.requestId)).size,events.length);assert.ok(counts.every(x=>typeof x.counterRequestId==='string'));assert.equal(new Set(counts.map(x=>x.counterRequestId)).size,counts.length);assert.equal(events.length,fault==='after-capture'?102:1);assert.equal(counts.length,fault==='after-capture'?102:1);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),false);rows.push({fault,first,second,modelRequests:events.length,countRequests:counts.length,status:result.status,report:result.report});}save('cli-recovery',{rows,actualProviderCalls:0,actualKeyReads:0});
});
