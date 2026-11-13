// Six allowlisted static development collections. Only original input fields
// enter the bounded inventory;labels/answers/scores stay out of model evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {EXPOSURE_V1,validateExposureInventoryV1,normalizedExposureSentenceV1} from './ai-quality-v147-exposure-v1.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const targetDomain=x=>typeof x==='string'&&x.startsWith('word ')?'word':typeof x==='string'&&x.startsWith('grammar ')?'grammar':'unknown';
export const PUBLIC_EXPOSURE_SOURCES_V2=Object.freeze([
 '.taskmaster/docs/ai-quality-v147-gold-policy.json',
 '.taskmaster/evaluation/ai-quality-v147/reference-control-candidates-v1.json',
 'tests/fixtures/judgment-decision-matrix.json',
 '.taskmaster/docs/judgment-v5-calibration-cases.json',
 '.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json',
 'tests/fixtures/english-accuracy.json'
]);
export function buildPublicExposureInventoryV2(sourceRoot=SOURCE){
 const bindings={},docs=new Map(PUBLIC_EXPOSURE_SOURCES_V2.map(f=>{const raw=readFileSync(resolve(sourceRoot,f));bindings[f]=createHash('sha256').update(raw).digest('hex');return [f,JSON.parse(raw.toString('utf8'))];})),entries=[],origins=[],counts={};
 function add(source,recordId,input,domain,targetKey,field,kind='declared-public-input'){
  assert.equal(typeof input.sentence,'string');assert.ok(input.sentence.length>0&&input.sentence.length<=2000&&input.sentence.isWellFormed());assert.ok(['word','grammar','unknown'].includes(domain));assert.match(targetKey,/^[A-Za-z0-9_.-]{1,100}$/);assert.ok(input.contextKind===undefined||['sentence','reply','title','command'].includes(input.contextKind));assert.ok(input.contextNote===undefined||typeof input.contextNote==='string');
  const id='exposure-'+digest({source,origin:recordId}).slice(0,24),familyId='family-'+digest({source,origin:recordId,unreviewedFamily:true}).slice(0,24);
  entries.push({id,domain,targetKey,familyId,familyBrief:'Public family relation unaudited.',input:{sentence:input.sentence,contextKind:input.contextKind??'sentence',contextNote:input.contextNote??''}});
  origins.push({entryId:id,sourceFile:source,recordId,inputField:field,materialKind:kind,domainUnavailable:domain==='unknown',contextKindDefaulted:input.contextKind===undefined,contextNoteDefaulted:input.contextNote===undefined,targetCoarsened:targetKey==='public-target'});counts[source]=(counts[source]??0)+1;
 }
 let source=PUBLIC_EXPOSURE_SOURCES_V2[0],d=docs.get(source);assert.equal(d.publicDevelopmentOnly,true);assert.ok(Array.isArray(d.developmentCases));for(const c of d.developmentCases){assert.equal(typeof c.target,'string');add(source,c.id,c.input,targetDomain(c.target),'public-target','input.sentence');}
 source=PUBLIC_EXPOSURE_SOURCES_V2[1];d=docs.get(source);assert.equal(d.exposure.publicDevelopmentMaterial,true);for(const c of d.controls)add(source,c.id,{sentence:c.sentence,contextKind:c.contextKind,contextNote:c.contextNote},'grammar',c.lessonId,'sentence');
 source=PUBLIC_EXPOSURE_SOURCES_V2[2];d=docs.get(source);assert.match(d.scope,/public synthetic development/);assert.ok(Array.isArray(d.rows));for(const [ri,row]of d.rows.entries())for(const [ci,c]of row.cases.entries())add(source,row.lessonId+'-'+ci,{sentence:c.sentence,contextKind:c.contextKind,contextNote:c.contextNote},'grammar',row.lessonId,`rows[${ri}].cases[${ci}].sentence`);
 source=PUBLIC_EXPOSURE_SOURCES_V2[3];d=docs.get(source);assert.equal(d.publicDevelopmentOnly,true);assert.equal(d.freshHoldout,false);for(const c of d.cases){assert.ok(['wire','visible','rejected-wire'].includes(c.mode));const visible=c.mode==='visible';add(source,c.id,{sentence:visible?c.feedback.original:c.original,contextKind:c.contextKind,contextNote:c.contextNote},targetDomain(c.target),'public-target',visible?'feedback.original':'original',visible?'hypothetical-visible-fault-original-not-product-reproduction':c.mode==='rejected-wire'?'rejected-wire-input-not-successful-feedback':'declared-public-input');}
 source=PUBLIC_EXPOSURE_SOURCES_V2[4];d=docs.get(source);assert.equal(d.publicDevelopmentOnly,true);assert.equal(d.freshHoldout,false);for(const c of d.witnesses){assert.equal(typeof c.input.target,'string');add(source,c.id,c.input,targetDomain(c.input.target),'public-target','input.sentence',c.materialKind);}
 source=PUBLIC_EXPOSURE_SOURCES_V2[5];d=docs.get(source);assert.match(d.purpose,/Synthetic pilot/);for(const c of d.cases)add(source,c.id,{sentence:c.sentence,contextKind:c.contextKind,contextNote:c.contextNote},c.domain,c.domain==='grammar'?c.lessonId:c.word,'sentence');
 assert.equal(new Set(entries.map(x=>x.id)).size,entries.length);
 const extractionPolicy='Original selected input fields only;no corrections/expected labels/grades/rationales/model identities. Visible-fault rows use feedback.original only andretain their weaker provenance outside the model inventory. Absent context defaults andunknown target domains areexplicit;unknown isnot treated asword orgrammar. Family relations unaudited;four additional static JSON collections added. Other source groups remainoutside this partial inventory.';
 const basis={protocol:EXPOSURE_V1,scope:{kind:'public-development',description:'Six allowlisted static development collections only. Dynamic test inputs,curriculum andother archived evaluations remain unaudited.'},coverage:'partial',entries,provenanceHash:digest({sourceBindings:bindings,extractionPolicy})},inventory=validateExposureInventoryV1({...basis,hash:digest(basis)});
 return {schemaVersion:1,registryVersion:2,inventory,sourceBindings:bindings,sourceCounts:counts,origins,extractionPolicy,
  sourceRows:entries.length,uniqueNormalizedSentences:new Set(entries.map(x=>normalizedExposureSentenceV1(x.input.sentence))).size,
  inventoryBytes:Buffer.byteLength(JSON.stringify(inventory)),unknownDomainRows:entries.filter(e=>e.domain==='unknown').length,independentFamilyCountCertified:false,
  completeProjectExposureInventory:false,allSelectedOriginalInputRowsExtracted:true,
  remainingSourceGroups:['Original inputs embedded/generated in test programs','Curriculum examples,stems/questions andversioned lesson content','Other archived synthetic evaluations andfixture generators','Structural-family equivalence,source context/target detail audit'],
  actualEnglishQualityMeasured:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,liveDispatchAuthorized:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=buildPublicExposureInventoryV2(),file=resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/public-exposure-inventory-v2.json');
 if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),result);else if(!process.argv.includes('--preview'))writeFileSync(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({rows:result.sourceRows,uniqueSentences:result.uniqueNormalizedSentences,inventoryBytes:result.inventoryBytes,sourceCollections:PUBLIC_EXPOSURE_SOURCES_V2.length,coverage:result.inventory.coverage,actualProviderCalls:0}));
}
