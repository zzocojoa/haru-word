import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadCalibrationAdmissionRegistryV1,inspectCalibrationAdmissionV1,assertCalibrationAdmissionV1,withCalibrationAdmissionV1} from './ai-quality-v147-calibration-admission-v1.mjs';
import {calibrationAdmissionFixtureV1,withCalibrationAdmissionFixtureV1} from './ai-quality-v147-calibration-admission-fixture-v1.mjs';
import {panelFixtureV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {createV3Journal,readV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {openSyntheticPanelExecutorV3,inspectSyntheticPanelV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {calibrationGateV3} from './ai-quality-v147-panel-report-v3.mjs';
import {startSyntheticHttpV3} from './ai-quality-v147-synthetic-http-v3.mjs';
import {digest} from './ai-quality-v147-budget-v3.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),SOURCE=resolve(HERE,'../..'),ROOT=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.existingDashboardRoot,OUT=resolve(process.env.QA_OUTPUT_DIR),sha=x=>createHash('sha256').update(x).digest('hex'),rows=[];
mkdirSync(OUT,{recursive:false});
const save=(n,v)=>writeFileSync(resolve(OUT,n+'.json'),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),pass=name=>rows.push({name,passed:true});
function scenario(name,b=calibrationAdmissionFixtureV1()){
 const root=resolve(OUT,name);mkdirSync(root);const context={allowedRoot:root,directory:resolve(root,'v3-'+b.spec.runId),spec:b.spec};createV3Journal(context,b.approval);return {root,b,context};
}
const options=c=>({context:c.context,seal:c.b.seal,observeCurrent:()=>c.b.current,readWire:key=>c.b.wires[key],reportInputs:c.b.reportInputs});
async function adapted(file,sourceFile,replacements={}){
 const raw=readFileSync(sourceFile,'utf8'),code=raw.replace(/from '\.\/([^']+)'/g,(_,name)=>"from '"+pathToFileURL(replacements[name]??resolve(HERE,name)).href+"'");writeFileSync(file,code);return {module:await import(pathToFileURL(file).href),sourceSha256:sha(raw),adapterSha256:sha(code),onlyImportPathsAdapted:true};
}
test('trusted source registry keeps all12original grades and binds actual6diagnostics without qualifying English truth',()=>{
 const v=loadCalibrationAdmissionRegistryV1(),registry=v.registry;assert.equal(registry.entries.length,12);assert.equal(registry.qualifiedCount,0);assert.deepEqual(registry.entries.filter(x=>x.state==='held-disputed-reference').map(x=>[x.sourceWitnessId,x.goldCaseId]),[['N04','G12']]);assert.equal(registry.entries.filter(x=>x.goldCaseId===null).length,4);assert.equal(registry.referenceGradesChanged,false);assert.equal(registry.humanReviewerRequired,false);assert.equal(registry.englishTruthCertified,false);save('registry',registry);pass('source registry12 unqualified');
});
test('witness aliases are matched by content: witness12 still maps to disputedN04/G12',()=>{
 const b=calibrationAdmissionFixtureV1(),v=inspectCalibrationAdmissionV1({inputs:b.reportInputs,stage:'pilot-panel'});assert.equal(v.blocked.length,12);assert.deepEqual(v.blocked.find(x=>x.sourceWitnessId==='N04'),{witnessId:'witness-12',sourceWitnessId:'N04',goldCaseId:'G12',state:'held-disputed-reference',qualified:false,aliased:true,reasonCodes:['G12-usage-scope-not-declared','case-specific-reference-not-established','three-model-diagnostic-is-not-gold-qualification']});save('aliased-witness-binding',v);pass('content based alias binding');
});
test('current required profile halts before lease,capture,count or modeltransport and leaves journal unused',()=>{
 const c=scenario('current-preflight'),before=digest(readV3Journal(c.context));let calls=0;assert.throws(()=>openSyntheticPanelExecutorV3({...options(c),transport:async()=>{calls++;}}),/CALQ1_REFERENCE_UNQUALIFIED/);assert.equal(calls,0);assert.equal(digest(readV3Journal(c.context)),before);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),false);assert.equal(readdirSync(c.root).some(x=>x.endsWith('-captures')),false);save('preflight-hold',{calls,leaseCreated:false,captureCreated:false,journalUnchanged:true,actualProviderCalls:0,actualCountApiCalls:0});pass('before lease and transport hold');
});
test('missing,index-mutated,rehashed qualified or downgraded policies cannot gain admission',()=>{
 const b=calibrationAdmissionFixtureV1(),variants=[];
 for(const kind of ['missing-index','orphan-index','qualified-forgery','downgraded-policy','missing-hash']){
  const inputs=structuredClone(b.reportInputs);
  if(kind==='missing-index')delete inputs.calibrationAdmissionRegistry;
  if(kind==='orphan-index')delete inputs.contract.calibrationAdmissionPolicy;
  if(kind==='qualified-forgery'){inputs.calibrationAdmissionRegistry.entries[11].qualified=true;const {hash:_old,...basis}=inputs.calibrationAdmissionRegistry;void _old;inputs.calibrationAdmissionRegistry.hash=digest(basis);inputs.contract.calibrationAdmissionPolicy.registryHash=inputs.calibrationAdmissionRegistry.hash;}
  if(kind==='downgraded-policy')inputs.contract.calibrationAdmissionPolicy.required=false;
  if(kind==='missing-hash')delete inputs.contract.calibrationAdmissionPolicy.registryHash;
  assert.throws(()=>assertCalibrationAdmissionV1({inputs,stage:'pilot-panel'}),/CALQ1_(INDEX_BINDING|ORPHAN_REGISTRY|POLICY)/);variants.push({kind,held:true});
 }
 save('policy-tamper-held',variants);pass('policy and forged registry held');
});
test('unknown,duplicated,missing and grade-edited witnesses fail rather than changing denominator or gold',()=>{
 const b=calibrationAdmissionFixtureV1(),variants=[];
 for(const kind of ['unknown-input','duplicate','missing','edited-grade']){
  const inputs=structuredClone(b.reportInputs);if(kind==='unknown-input')inputs.witnesses[11].input.sentence+=' changed';if(kind==='duplicate')inputs.witnesses[11]=structuredClone(inputs.witnesses[0]);if(kind==='missing')inputs.witnesses.pop();if(kind==='edited-grade')inputs.witnesses[11].expectedGrade.grammar='fail';assert.throws(()=>assertCalibrationAdmissionV1({inputs,stage:'pilot-panel'}),/CALQ1_WITNESS_(SOURCE|DENOMINATOR)/);variants.push({kind,held:true});
 }
 save('witness-mutations-held',variants);pass('fixed source and denominator');
});
test('an empty current report explicitly separates arithmetic failure and reference qualification',()=>{
 const c=scenario('empty-report'),v=inspectSyntheticPanelV3(options(c)).report;assert.equal(v.releaseVerdict,'held');assert.equal(v.calibration.thresholdArithmeticSatisfied,false);assert.equal(v.calibration.calibrationAcceptanceAllowed,false);assert.equal(v.calibration.sourceQualification.blocked.length,12);save('empty-current-report',v);pass('report distinguishes source qualification');
});
test('frozen previous core sends72syntheticcalibrations and1generation;current core blocks same requiredprofile at0',{timeout:180000},async()=>{
 const oldRoot=resolve(ROOT,'outputs/ai-quality-v147-implementation-20261106/phase49/management-before/.taskmaster/scripts'),report=await adapted(resolve(OUT,'old-report-adapter.mjs'),resolve(oldRoot,'ai-quality-v147-panel-report-v3.mjs')),executor=await adapted(resolve(OUT,'old-executor-adapter.mjs'),resolve(oldRoot,'ai-quality-v147-panel-executor-v3.mjs'),{'ai-quality-v147-panel-report-v3.mjs':resolve(OUT,'old-report-adapter.mjs')}),c=scenario('frozen-core'),http=await startSyntheticHttpV3({bundle:c.b,logFile:resolve(c.root,'http.jsonl')});let e;
 try{
  e=executor.module.openSyntheticPanelExecutorV3({...options(c),transport:http.send});for(const d of c.b.spec.requests.filter(x=>x.role==='calibration'))await e.dispatch(d.key);const gen=c.b.spec.requests.find(x=>x.role==='generation');await e.dispatch(gen.key);e.release();e=null;
  const gate=calibrationGateV3({spec:c.b.spec,ledger:readV3Journal(c.context).ledger,store:openV3CaptureStore({context:c.context,seal:c.b.seal,observeCurrent:()=>c.b.current}),inputs:c.b.reportInputs});assert.equal(gate.thresholdArithmeticSatisfied,true);assert.equal(gate.files.length,360);assert.equal(gate.calibrationAcceptanceAllowed,false);assert.equal(gate.sourceQualification.blocked.length,12);
  const after=scenario('same-profile-current',structuredClone(c.b));let currentSends=0;assert.throws(()=>openSyntheticPanelExecutorV3({...options(after),transport:async()=>{currentSends++;}}),/CALQ1_REFERENCE_UNQUALIFIED/);assert.equal(currentSends,0);assert.equal(http.events().filter(x=>x.accepted).length,73);save('old-versus-current',{archivedExecutorSha256:executor.sourceSha256,archivedReportSha256:report.sourceSha256,onlyImportPathsAdapted:true,oldAcceptedLoopbackRequests:73,currentDispatches:currentSends,gate,syntheticOnly:true,actualProviderCalls:0,englishQualityQualified:false});
 }finally{try{e?.abandon();}catch{}save('old-http-cleanup',await http.close());}
 pass('causal old73 current0 contrast');
});
test('legacy transport fixtures remain mechanism-only and cannot receive calibration acceptance',()=>{
 const c=scenario('legacy-only',panelFixtureV3()),v=inspectSyntheticPanelV3(options(c)).report;assert.equal(v.calibration.sourceQualification.profile,'legacy-synthetic-mechanism-only');assert.equal(v.calibration.sourceQualification.sourceQualified,false);assert.equal(v.calibration.calibrationAcceptanceAllowed,false);assert.equal(v.releaseVerdict,'held');save('legacy-scope',v.calibration);pass('legacy remains uncertified');
});
test('reference preparation can collect3synthetic slots without consuming unqualified main calibration',{timeout:180000},async()=>{
 const c=scenario('reference-preparation',calibrationAdmissionFixtureV1({stage:'reference-preparation'})),http=await startSyntheticHttpV3({bundle:c.b,logFile:resolve(c.root,'http.jsonl')});let e;
 try{e=openSyntheticPanelExecutorV3({...options(c),transport:http.send});const v=await e.collect();e.release();e=null;assert.equal(v.status,'synthetic-collected');assert.equal(http.events().filter(x=>x.accepted).length,3);assert.equal(v.report.calibration.sourceQualification.required,false);assert.equal(v.report.calibration.calibrationAcceptanceAllowed,false);save('reference-preparation',v);}finally{try{e?.abandon();}catch{}save('reference-http-cleanup',await http.close());}pass('reference preparation unaffected');
});
test('physical source-copy tampering fails before lease while active sources remain unchanged',async()=>{
 const loaded=loadCalibrationAdmissionRegistryV1(),copy=resolve(OUT,'source-copy');mkdirSync(copy);const files=[...Object.keys(loaded.registry.sourceBindings),'.taskmaster/evaluation/ai-quality-v147/calibration-admission-v1.json'];for(const f of files){const p=resolve(copy,f);mkdirSync(dirname(p),{recursive:true});copyFileSync(resolve(SOURCE,f),p);}const manifest=resolve(copy,'.taskmaster/docs/ai-quality-v147-manifest.json');writeFileSync(manifest,JSON.stringify({baseline:{sourceRoot:copy,existingDashboardRoot:ROOT}}));const target=resolve(copy,files[0]);writeFileSync(target,readFileSync(target,'utf8')+'\n');const moduleFile=resolve(copy,'.taskmaster/scripts/ai-quality-v147-calibration-admission-v1.mjs');mkdirSync(dirname(moduleFile),{recursive:true});await adapted(moduleFile,resolve(HERE,'ai-quality-v147-calibration-admission-v1.mjs'));const executor=await adapted(resolve(OUT,'copied-source-executor.mjs'),resolve(HERE,'ai-quality-v147-panel-executor-v3.mjs'),{'ai-quality-v147-calibration-admission-v1.mjs':moduleFile}),c=scenario('changed-copy-preflight');assert.throws(()=>executor.module.openSyntheticPanelExecutorV3({...options(c),transport:async()=>{}}),/CALQ1_SOURCE_BINDING/);assert.equal(existsSync(resolve(c.context.directory,'LOCK.json')),false);assert.equal(sha(readFileSync(resolve(SOURCE,files[0]))),loaded.registry.sourceBindings[files[0]]);save('physical-copy-held',{activeSourcesChanged:false,leaseCreated:false,actualProviderCalls:0});pass('physical source binding');
});
test('admission binds local contract and existing16seal components while preserving exact model wire bytes',()=>{
 const legacy=panelFixtureV3(),inputs=withCalibrationAdmissionV1(legacy.reportInputs);assert.deepEqual(inputs.witnesses,legacy.reportInputs.witnesses);assert.deepEqual(inputs.cases,legacy.reportInputs.cases);const b=withCalibrationAdmissionFixtureV1(legacy);assert.deepEqual(b.wires,legacy.wires);assert.equal(Object.keys(b.seal.payload.components).length,16);assert.equal(b.spec.requests.length,102);assert.ok(Object.values(b.wires).every(w=>!(w.raw??w.templateRaw).includes('calibrationAdmissionRegistry')&&!(w.raw??w.templateRaw).includes('held-disputed-reference')));const originals=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json'),'utf8')).witnesses;assert.deepEqual(inputs.witnesses.map(w=>w.expectedGrade),originals.map(w=>w.expectedGrade));save('wire-and-grade-preservation',{sealComponents:16,plannedRequests:102,witnesses:12,originalExpectedGradesUnchanged:true,registryForwardedToModels:false,actualProviderCalls:0});pass('wire and original grade preservation');
});
test.after(()=>save('calibration-admission-results',{passed:rows.length===11,groups:rows.length,rows,nodeVersion:process.version,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,humanReviewerRequired:false,englishQualityQualified:false,releaseVerdict:'held'}));
