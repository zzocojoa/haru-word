// Full selected public corpus stays local. Bounded target evidence is partial;
// exact matches do not certify structural independence or English correctness.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {EXPOSURE_V1,normalizedExposureSentenceV1,validateExposureInventoryV1} from './ai-quality-v147-exposure-v1.mjs';
export const GLOBAL_EXPOSURE_V1='ai-quality-v147-global-exposure-v1';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),check=(ok,c)=>{if(!ok)throw Error('GEX1_'+c);};
const fields=(v,n)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...n].sort().join('|');
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),key=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(v),text=(v,max)=>typeof v==='string'&&v.isWellFormed()&&v.length>0&&v.length<=max;
const sha=v=>createHash('sha256').update(v).digest('hex'),targetKey=t=>t.domain+'/'+t.targetKey;
export function validateGlobalExposureCorpusV1(c){
 check(fields(c,['protocol','scope','coverage','sourceHashes','sourceRecordCount','records','hash'])&&c.protocol===GLOBAL_EXPOSURE_V1&&c.coverage==='partial'&&text(c.scope,500)&&fields(c.sourceHashes,['boundedInventory','curriculumCatalogue'])&&Object.values(c.sourceHashes).every(hash)&&hash(c.hash),'CORPUS');
 const {hash:h,...basis}=c;check(digest(basis)===h,'HASH');check(Number.isSafeInteger(c.sourceRecordCount)&&c.sourceRecordCount>0&&Array.isArray(c.records)&&c.records.length>0&&c.records.every(r=>r!==null&&typeof r==='object')&&new Set(c.records.map(r=>r.id)).size===c.records.length,'RECORDS');
 for(const r of c.records){check(fields(r,['id','normalizedSha256','targets','familyIds','sourceRecordIds','input'])&&hash(r.normalizedSha256)&&r.id==='exposure-'+r.normalizedSha256.slice(0,24)&&fields(r.input,['sentence','contextKind','contextNote'])&&text(r.input.sentence,2000)&&['sentence','reply','title','command'].includes(r.input.contextKind)&&typeof r.input.contextNote==='string'&&r.input.contextNote.isWellFormed()&&r.input.contextNote.length<=500&&sha(normalizedExposureSentenceV1(r.input.sentence))===r.normalizedSha256,'RECORD');
  check(Array.isArray(r.targets)&&r.targets.length>0&&r.targets.every(t=>fields(t,['domain','targetKey'])&&['word','grammar','unknown'].includes(t.domain)&&key(t.targetKey))&&new Set(r.targets.map(targetKey)).size===r.targets.length,'TARGETS');
  check(Array.isArray(r.familyIds)&&r.familyIds.length>0&&r.familyIds.every(key)&&new Set(r.familyIds).size===r.familyIds.length&&Array.isArray(r.sourceRecordIds)&&r.sourceRecordIds.length>0&&r.sourceRecordIds.every(textId=>text(textId,160))&&new Set(r.sourceRecordIds).size===r.sourceRecordIds.length,'ORIGINS');
 }
 check(new Set(c.records.map(r=>r.normalizedSha256)).size===c.records.length&&c.records.reduce((n,r)=>n+r.sourceRecordIds.length,0)===c.sourceRecordCount,'SOURCE_COUNTS');return c;
}
export function buildGlobalExposureCorpusV1(bounded,curriculum){
 validateExposureInventoryV1(bounded.inventory);const {hash:ch,...cb}=curriculum;check(ch===digest(cb)&&curriculum.kind==='authored-curriculum-exposure-audit-v1'&&curriculum.completeForSelectedFields===true&&curriculum.completeProjectExposure===false,'CURRICULUM_BINDING');
 const map=new Map();function add(sourceId,input,target,familyId){const normalizedSha256=sha(normalizedExposureSentenceV1(input.sentence));let r=map.get(normalizedSha256);if(!r){r={id:'exposure-'+normalizedSha256.slice(0,24),normalizedSha256,targets:[],familyIds:[],sourceRecordIds:[],input:structuredClone(input)};map.set(normalizedSha256,r);}if(!r.targets.some(t=>targetKey(t)===targetKey(target)))r.targets.push(target);if(!r.familyIds.includes(familyId))r.familyIds.push(familyId);r.sourceRecordIds.push(sourceId);}
 for(const e of bounded.inventory.entries)add('bounded/'+e.id,e.input,{domain:e.domain,targetKey:e.targetKey},e.familyId);
 for(const e of curriculum.records)add('curriculum/'+e.id,{sentence:e.input.sentence,contextKind:'sentence',contextNote:''},{domain:'grammar',targetKey:e.origin.lessonId},'family-'+digest({unauditedCurriculum:e.id}).slice(0,24));
 const records=[...map.values()].sort((a,b)=>a.id.localeCompare(b.id));for(const r of records){r.targets.sort((a,b)=>targetKey(a).localeCompare(targetKey(b)));r.familyIds.sort();r.sourceRecordIds.sort();}
 const basis={protocol:GLOBAL_EXPOSURE_V1,scope:'All selected original fields fromsixdevelopment collections andselected curriculum sentence fields/allframes ineditions1-4. InlinebilingualEnglish,choicefragments,testprograms,otherarchives andstructuralfamilies remain unaudited.',coverage:'partial',sourceHashes:{boundedInventory:digest(bounded),curriculumCatalogue:ch},sourceRecordCount:bounded.inventory.entries.length+curriculum.records.length,records};return validateGlobalExposureCorpusV1({...basis,hash:digest(basis)});
}
function projectionTargets(assignment,controlAssignment){check([assignment,controlAssignment].every(a=>a&&['word','grammar'].includes(a.domain)&&key(a.targetKey)),'PROJECTION_TARGETS');return [...new Map([assignment,controlAssignment].map(a=>[targetKey(a),{domain:a.domain,targetKey:a.targetKey}])).values()].sort((a,b)=>targetKey(a).localeCompare(targetKey(b)));}
export function projectGlobalExposureV1(corpus,assignment,controlAssignment){
 validateGlobalExposureCorpusV1(corpus);const targets=projectionTargets(assignment,controlAssignment),matches=t=>t.domain==='unknown'||t.targetKey==='public-target'||targets.some(w=>targetKey(w)===targetKey(t));
 const records=corpus.records.filter(r=>r.targets.some(matches));check(records.length>0,'EMPTY_PROJECTION');const entries=records.map(r=>{const selected=r.targets.find(t=>targets.some(w=>targetKey(w)===targetKey(t)))??r.targets.find(matches);return {id:r.id,domain:selected.domain,targetKey:selected.targetKey,familyId:r.familyIds[0],familyBrief:'Public family relations unaudited;exact identity checked across the full selected local corpus.',input:structuredClone(r.input)};});
 const basis={protocol:EXPOSURE_V1,scope:{kind:'public-development',description:'Partial target+coarse projection;'+corpus.records.length+' exact surfaces checked locally. Other target structures are absent;no global freshness or Englishtruth certification.'},coverage:'partial',entries,provenanceHash:digest({protocol:GLOBAL_EXPOSURE_V1,corpusHash:corpus.hash,rule:'target-plus-coarse-v1',targets,visibleIds:records.map(r=>r.id)})};return validateExposureInventoryV1({...basis,hash:digest(basis)});
}
export function globalExposureMatchesV1(corpus,input,familyId){validateGlobalExposureCorpusV1(corpus);check(input&&text(input.sentence,2000)&&key(familyId),'MATCH_INPUT');const sentenceHash=sha(normalizedExposureSentenceV1(input.sentence));return corpus.records.filter(r=>r.normalizedSha256===sentenceHash||r.familyIds.includes(familyId));}
export function validateGlobalExposurePolicyV1(inputs){
 const p=inputs.contract.exposurePolicy,c=inputs.globalExposureCorpus;check(fields(p,['protocol','required','corpusHash','byCaseHash'])&&p.protocol===GLOBAL_EXPOSURE_V1&&p.required===true&&hash(p.corpusHash)&&fields(p.byCaseHash,inputs.cases.map(x=>x.id)),'POLICY');validateGlobalExposureCorpusV1(c);check(c.hash===p.corpusHash,'POLICY_CORPUS');
 for(const row of inputs.cases){const prep=row.referencePreparation;check(prep?.exposureEvidence&&p.byCaseHash[row.id]===prep.exposureEvidence.hash,'POLICY_CASE');const expected=projectGlobalExposureV1(c,prep.assignment,prep.control.assignment);check(digest(expected)===digest(prep.exposureEvidence),'PROJECTION_BINDING');check(prep.assignment.exposureInventoryHash===expected.hash&&prep.control.assignment.exposureInventoryHash===expected.hash,'ASSIGNMENT_BINDING');check(!c.records.some(r=>r.familyIds.includes(prep.assignment.familyId)||r.familyIds.includes(prep.control.assignment.familyId)),'KNOWN_ASSIGNMENT_FAMILY');}
 return c;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const read=f=>JSON.parse(readFileSync(resolve(SOURCE,f),'utf8')),value=buildGlobalExposureCorpusV1(read('.taskmaster/evaluation/ai-quality-v147/public-exposure-inventory-v2.json'),read('.taskmaster/evaluation/ai-quality-v147/curriculum-exposure-audit-v1.json')),file=resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/global-exposure-corpus-v1.json');
 if(process.argv.includes('--check'))check(digest(read('.taskmaster/evaluation/ai-quality-v147/global-exposure-corpus-v1.json'))===digest(value),'FILE_CHANGED');else if(!process.argv.includes('--preview'))writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({sourceRecords:value.sourceRecordCount,uniqueSurfaces:value.records.length,localCorpusBytes:Buffer.byteLength(JSON.stringify(value)),coverage:value.coverage,actualProviderCalls:0}));
}
