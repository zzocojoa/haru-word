// Bounded public exposure evidence. No network, credentials, private answers or
// automatic family-equivalence claims. Hashes bind records;they are not truth.
import {digest} from './ai-quality-v147-budget-v3.mjs';
export const EXPOSURE_V1='ai-quality-v147-public-exposure-v1';
const check=(ok,code)=>{if(!ok)throw Error('EX1_'+code);};
const fields=(x,n)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...n].sort().join('|');
const text=(x,max,min=0)=>typeof x==='string'&&x.isWellFormed()&&x.length>=min&&x.length<=max;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const normalizedExposureSentenceV1=x=>x.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
export function validateExposureInventoryV1(e){
 check(fields(e,['protocol','scope','coverage','entries','provenanceHash','hash'])&&e.protocol===EXPOSURE_V1&&fields(e.scope,['kind','description'])&&['synthetic-fixture','public-development'].includes(e.scope.kind)&&text(e.scope.description,300,1)&&['partial','complete-for-declared-scope'].includes(e.coverage)&&hash(e.provenanceHash)&&hash(e.hash),'INVENTORY');
 const {hash:h,...basis}=e;check(digest(basis)===h,'HASH');check(Buffer.byteLength(JSON.stringify(e))<=65536,'INVENTORY_BYTES');check(Array.isArray(e.entries)&&e.entries.length>0&&e.entries.every(x=>x!==null&&typeof x==='object')&&new Set(e.entries.map(x=>x.id)).size===e.entries.length,'ENTRIES');
 for(const x of e.entries)check(fields(x,['id','domain','targetKey','familyId','familyBrief','input'])&&/^exposure-[a-f0-9]{24}$/.test(x.id)&&/^family-[a-f0-9]{24}$/.test(x.familyId)&&['word','grammar','unknown'].includes(x.domain)&&typeof x.targetKey==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x.targetKey)&&text(x.familyBrief,300,1)&&fields(x.input,['sentence','contextKind','contextNote'])&&text(x.input.sentence,2000,1)&&['sentence','reply','title','command'].includes(x.input.contextKind)&&text(x.input.contextNote,500),'ENTRY_FIELDS');
 return e;
}
export function validateExposureAssignmentV1(a,e){validateExposureInventoryV1(e);check(a.exposureInventoryHash===e.hash,'ASSIGNMENT_BINDING');check(!e.entries.some(x=>x.familyId===a.familyId),'KNOWN_FAMILY');return e;}
export function exposureMatchesV1(v,a,e){validateExposureInventoryV1(e);const sentence=normalizedExposureSentenceV1(v.input.sentence);return e.entries.filter(x=>normalizedExposureSentenceV1(x.input.sentence)===sentence||x.familyId===a.familyId);}
export function validateExposureDraftV1(v,a,e){
 validateExposureAssignmentV1(a,e);check(exposureMatchesV1(v,a,e).length===0,'KNOWN_EXPOSURE');
 if(e.coverage==='partial')check(v.unresolved===true&&v.evidenceLevelClaim==='unresolved'&&v.reasonCodes.includes('family-exposure-uncertain'),'PARTIAL_COVERAGE_UNRESOLVED');
 return v;
}
export const exposureFamilyAliasV1=(salt,familyId)=>'family-'+digest({salt,familyId}).slice(0,24);
export function anonymousExposureInventoryV1(e,salt){
 validateExposureInventoryV1(e);check(hash(salt),'SALT');const basis={protocol:EXPOSURE_V1,scope:structuredClone(e.scope),coverage:e.coverage,entries:e.entries.map(x=>({...structuredClone(x),id:'exposure-'+digest({salt,id:x.id}).slice(0,24),familyId:exposureFamilyAliasV1(salt,x.familyId)})),provenanceHash:digest({inventory:e.hash,provenance:e.provenanceHash})};return validateExposureInventoryV1({...basis,hash:digest(basis)});
}
export function validateExposureReviewV1(v,items,e){
 validateExposureInventoryV1(e);for(const item of items){check(item.assignment.exposureInventoryHash===e.hash,'ANONYMOUS_BINDING');const result=v.items.find(x=>x.itemId===item.itemId);check(result,'REVIEW_ITEM');const known=exposureMatchesV1(item.draft,item.assignment,e).length>0;
  if(known)check(result.grade.exposureAndFamilyCompliance==='fail'&&result.grade.criticalErrors.knownExposureLeak===true,'KNOWN_EXPOSURE_REVIEW');
  else if(e.coverage==='partial')check(result.grade.exposureAndFamilyCompliance==='unavailable','PARTIAL_COVERAGE_REVIEW');
 }return v;
}
