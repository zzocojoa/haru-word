// New explicit product boundaries. Never reinterpret captured v1 results.
import {readFileSync} from 'node:fs';
import {digest,DIMENSIONS,CRITICAL,validateGrade} from './ai-quality-v147-calibration.mjs';
export const PRODUCT_RUBRIC_V2='ai-quality-v147-product-operational-rubric-v2';
export const EVIDENCE_AXES_V2=['sourceAdequacy','learnerContext','abstentionNeed'];
const check=(v,c)=>{if(!v)throw Error('PF2_'+c);};
export function loadProductRubricV2(){
 const p=JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-product-operational-rubric-v2.json',import.meta.url),'utf8'));
 check(p.protocol===PRODUCT_RUBRIC_V2&&p.version===2&&digest(p)===PRODUCT_RUBRIC_HASH_V2,'POLICY_HASH');
 check(!p.independentQualification&&!p.englishTruthCertified&&!p.liveDispatchAuthorized,'CLAIMS');return p;
}
export function validateProductGradeV2(item,{available=true}={}){
 validateGrade(item.grade);const policy=loadProductRubricV2();
 for(const axis of EVIDENCE_AXES_V2)check(policy.evidenceAxes[axis].values.includes(item[axis]),'EVIDENCE_AXIS');
 check(item.grade.criticalErrors.swapRoles!==true||item.grade.criticalErrors.reverseMeaning===true,'ROLE_REVERSAL');
 for(const flag of CRITICAL)if(item.grade.criticalErrors[flag])check(policy.structuralConsistency[flag].some(d=>item.grade[d]==='fail'),'CRITICAL_DIMENSION');
 if(!available){check(DIMENSIONS.every(d=>item.grade[d]==='unavailable')&&CRITICAL.every(f=>item.grade.criticalErrors[f]===false)&&item.sourceAdequacy==='not_applicable'&&item.learnerContext==='unavailable'&&item.abstentionNeed==='unavailable','UNAVAILABLE');}
 else{check(item.learnerContext!=='unavailable'&&item.abstentionNeed!=='unavailable'&&item.sourceAdequacy!=='not_applicable','VISIBLE_AXES');check(item.learnerContext==='missing'?item.abstentionNeed==='required':item.abstentionNeed==='not_required','CONTEXT_APPLICABILITY');}
 return item;
}
export const productEvidenceAxesSchemaV2=()=>Object.fromEntries(Object.entries(loadProductRubricV2().evidenceAxes).map(([k,v])=>[k,{type:'string',enum:v.values}]));
export const PRODUCT_RUBRIC_HASH_V2='5fc5d484eb55752e55558d4083639820c77c22262f04f0946f0e8832645c80da';
