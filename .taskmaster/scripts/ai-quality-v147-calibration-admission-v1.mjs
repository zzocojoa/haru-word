// Current calibration-source admission, separate from arithmetic agreement.
// No English grade is changed; no network, credential, budget or release grant.
import {readFileSync,realpathSync,lstatSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
export const CALIBRATION_ADMISSION_V1='ai-quality-v147-calibration-admission-v1';
const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),FILE='.taskmaster/evaluation/ai-quality-v147/calibration-admission-v1.json',read=f=>JSON.parse(readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex'),check=(v,c)=>{if(!v)throw Error('CALQ1_'+c);};
const bindings={'.taskmaster/docs/ai-quality-v147-gold-policy.json':'2ab1f36d1965e175d09db570875c25c8b9c3f72f79f8967123e998589c3e5bc2','.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json':'5aaa5d9bce53ad68f3f4415ecf926277d9f93879d9d1fe814d99cd2a8638cad2','.taskmaster/evaluation/ai-quality-v147/semantic-reference-audit-v1.json':'28647e0041705ab9664686b94e47e0dc71972cdbc496e017c0fc63c099d4dbd3'};
const fingerprint=w=>digest(Object.fromEntries(['group','input','feedback','expectedGrade'].map(k=>[k,w[k]])));
function sourceState(sourceRoot){
 const source=sourceRoot??read(resolve(HERE,'.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.sourceRoot,root=read(resolve(source,'.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot;
 for(const [f,h]of Object.entries(bindings)){const p=resolve(source,f);check(realpathSync(p)===p&&!lstatSync(p).isSymbolicLink()&&sha(p)===h,'SOURCE_BINDING');}
 const evidenceFile=resolve(root,'outputs/ai-quality-v147-implementation-20261106/phase48/all-six-actual-diagnostic-analysis.json');check(sha(evidenceFile)==='285db465e21a3c1a61a8bbfc888002605afc6d04197852008bf9fc9acc122e06','DIAGNOSTIC_BINDING');const evidence=read(evidenceFile);check(evidence.responses===6&&evidence.models===3&&evidence.actualProviderCalls===6&&!evidence.englishQualityQualified,'DIAGNOSTIC_SCOPE');
 return {source,root,evidence,evidenceFile,witnesses:read(resolve(source,'.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json')).witnesses,audit:read(resolve(source,'.taskmaster/evaluation/ai-quality-v147/semantic-reference-audit-v1.json'))};
}
export function buildCalibrationAdmissionRegistryV1(sourceRoot=null){
 const p=sourceState(sourceRoot),entries=p.witnesses.map(w=>{const disputed=p.audit.blockingCases.some(b=>b.witnessId===w.id&&b.goldCaseId===w.goldCaseId);return {sourceWitnessId:w.id,goldCaseId:w.goldCaseId??null,witnessContentHash:fingerprint(w),state:disputed?'held-disputed-reference':'held-unreviewed-reference',qualified:false,reasonCodes:disputed?['G12-usage-scope-not-declared','case-specific-reference-not-established','three-model-diagnostic-is-not-gold-qualification']:['declared-policy-reference-review-not-complete']};});
 check(entries.length===12&&new Set(entries.map(x=>x.witnessContentHash)).size===12&&entries.filter(x=>x.state==='held-disputed-reference').map(x=>x.sourceWitnessId).join('|')==='N04','REGISTRY_SCOPE');
 const basis={protocol:CALIBRATION_ADMISSION_V1,scope:'Current public12calibration sources;not a new grade or English certification',sourceBindings:bindings,evidenceFile:'phase48/all-six-actual-diagnostic-analysis.json',evidenceSha256:'285db465e21a3c1a61a8bbfc888002605afc6d04197852008bf9fc9acc122e06',entries,qualifiedCount:0,referenceGradesChanged:false,oldScoresChanged:false,humanReviewerRequired:false,reviewerPolicy:'AI-only;actual reference qualification still required,agreement alone insufficient',englishTruthCertified:false};return {...basis,hash:digest(basis)};
}
export function loadCalibrationAdmissionRegistryV1(sourceRoot=null){
 const p=sourceState(sourceRoot),file=resolve(p.source,FILE);check(realpathSync(file)===file&&!lstatSync(file).isSymbolicLink(),'REGISTRY_FILE');const registry=read(file),expected=buildCalibrationAdmissionRegistryV1(p.source);check(digest(registry)===digest(expected),'REGISTRY_BINDING');return {sourceRoot:p.source,registry,file,sha256:sha(file)};
}
export function withCalibrationAdmissionV1(inputs,prepared=loadCalibrationAdmissionRegistryV1()){
 check(inputs?.contract&&!inputs.contract.calibrationAdmissionPolicy&&!inputs.calibrationAdmissionRegistry,'ALREADY_BOUND');return {...structuredClone(inputs),calibrationAdmissionRegistry:structuredClone(prepared.registry),contract:{...structuredClone(inputs.contract),calibrationAdmissionPolicy:{protocol:CALIBRATION_ADMISSION_V1,required:true,registryHash:prepared.registry.hash}}};
}
export function inspectCalibrationAdmissionV1({inputs,stage}){
 const policy=inputs.contract.calibrationAdmissionPolicy,index=inputs.calibrationAdmissionRegistry;if(policy===undefined){check(index===undefined,'ORPHAN_REGISTRY');return {required:false,sourceQualified:false,profile:'legacy-synthetic-mechanism-only',blocked:[],humanReviewerRequired:false,englishTruthCertified:false};}
 check(policy&&Object.keys(policy).sort().join('|')==='protocol|registryHash|required'&&policy.protocol===CALIBRATION_ADMISSION_V1&&policy.required===true,'POLICY');const trusted=loadCalibrationAdmissionRegistryV1();check(index&&digest(index)===digest(trusted.registry)&&policy.registryHash===trusted.registry.hash,'INDEX_BINDING');
 if(stage!=='pilot-panel')return {required:false,policyBound:true,sourceQualified:false,profile:'reference-preparation-does-not-use-main-calibration',blocked:[],humanReviewerRequired:false,englishTruthCertified:false};
 check(Array.isArray(inputs.witnesses)&&inputs.witnesses.length===12,'WITNESS_DENOMINATOR');const matched=[],blocked=inputs.witnesses.map(w=>{const row=index.entries.find(x=>x.witnessContentHash===fingerprint(w));check(row&&!matched.includes(row.sourceWitnessId),'WITNESS_SOURCE');matched.push(row.sourceWitnessId);return {witnessId:w.id,sourceWitnessId:row.sourceWitnessId,goldCaseId:row.goldCaseId,state:row.state,qualified:row.qualified,aliased:w.id!==row.sourceWitnessId,reasonCodes:row.reasonCodes};}).filter(x=>!x.qualified);
 return {required:true,sourceQualified:blocked.length===0,profile:'current-source-qualification-required',registryHash:policy.registryHash,denominator:12,blocked,humanReviewerRequired:false,englishTruthCertified:false};
}
export function assertCalibrationAdmissionV1(args){const result=inspectCalibrationAdmissionV1(args);check(!result.required||result.sourceQualified,'REFERENCE_UNQUALIFIED');return result;}
