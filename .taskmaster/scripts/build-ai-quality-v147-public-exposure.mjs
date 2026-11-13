// Only the two allowlisted public development catalogs are read. Expected
// labels/corrections/grades,model names andsource paths never enter the inventory.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {EXPOSURE_V1,validateExposureInventoryV1} from './ai-quality-v147-exposure-v1.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),sha=f=>createHash('sha256').update(readFileSync(resolve(SOURCE,f))).digest('hex'),read=f=>JSON.parse(readFileSync(resolve(SOURCE,f),'utf8'));
const goldFile='.taskmaster/docs/ai-quality-v147-gold-policy.json',controlsFile='.taskmaster/evaluation/ai-quality-v147/reference-control-candidates-v1.json',gold=read(goldFile),controls=read(controlsFile);
assert.equal(gold.publicDevelopmentOnly,true);assert.equal(controls.exposure.publicDevelopmentMaterial,true);const entries=[],origins=[];
for(const [source,rows]of [[goldFile,gold.developmentCases.map(c=>({origin:c.id,domain:c.target.startsWith('word ')?'word':'grammar',targetKey:'public-target',sentence:c.input.sentence,contextKind:c.input.contextKind??'sentence',contextNote:c.input.contextNote??''}))],[controlsFile,controls.controls.map(c=>({origin:c.id,domain:'grammar',targetKey:c.lessonId,sentence:c.sentence,contextKind:c.contextKind,contextNote:c.contextNote}))]])for(const c of rows){
 const id='exposure-'+digest({source,origin:c.origin}).slice(0,24),familyId='family-'+digest({source,origin:c.origin,unreviewedFamily:true}).slice(0,24);entries.push({id,domain:c.domain,targetKey:c.targetKey,familyId,familyBrief:'Known public development input. Family relations to other rows remain unaudited;surface rewording is not independent novelty.',input:{sentence:c.sentence,contextKind:c.contextKind,contextNote:c.contextNote}});origins.push({entryId:id,sourceFile:source,recordId:c.origin});
}
const sourceBindings=Object.fromEntries([goldFile,controlsFile].map(f=>[f,sha(f)])),extractionPolicy='Only original public inputs,domain/target keys andneutral unaudited-family description;no answers/labels/corrections/scores/judge identities. Partialallowlist,not complete projectexposure.',basis={protocol:EXPOSURE_V1,scope:{kind:'public-development',description:'Two allowlisted public development catalogs only;other project/development/pilot/confirmation exposures are not yet inventoried.'},coverage:'partial',entries,provenanceHash:digest({sourceBindings,extractionPolicy})},inventory=validateExposureInventoryV1({...basis,hash:digest(basis)});
const result={schemaVersion:1,inventory,sourceBindings,origins,extractionPolicy,sourceRows:entries.length,uniqueNormalizedSentences:new Set(entries.map(x=>x.input.sentence.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim())).size,independentFamilyCountCertified:false,completeProjectExposureInventory:false,actualEnglishQualityMeasured:false,actualProviderCalls:0,actualKeyReads:0,liveDispatchAuthorized:false};
const output=resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/public-exposure-inventory-v1.json');if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(readFileSync(output,'utf8')),result);else writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({rows:entries.length,uniqueSentences:result.uniqueNormalizedSentences,coverage:inventory.coverage,actualProviderCalls:0}));
