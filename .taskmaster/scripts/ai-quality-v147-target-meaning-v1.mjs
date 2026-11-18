// Prospective lexical meaning/POS vs inflection boundary from the actual product.
// Pure request/parser adapter;no transport,budget,credentials or admission path.
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-calibration.mjs';
import {parseV3Json,validateV3Output} from './ai-quality-v147-wire-v3.mjs';
import {loadLabelSemanticsV1,labelSemanticsInstructionsV1,validateLabelSemanticsRequestV1,parseLabelSemanticsPayloadV1,PRODUCT_RUBRIC_HASH_V5,LABEL_SEMANTICS_FORMAT_V1} from './ai-quality-v147-label-semantics-v1.mjs';
export const TARGET_MEANING_V1='ai-quality-v147-target-meaning-v1';
export const TARGET_MEANING_FORMAT_V1='haru_target_meaning_v1';
// Frozen version identity. Reconstructing the policy still verifies the source files.
export const PRODUCT_RUBRIC_HASH_V6='9ad515ecc90ddbf507c72f9e49e49e7102f274d50b7b87aec1eb86ede6884f5a';
const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(import.meta.url),check=(v,c)=>{if(!v)throw Error('TM1_'+c);},sha=s=>createHash('sha256').update(s).digest('hex');
function productInstruction(){const source=JSON.parse(readFileSync(resolve(HERE,'.taskmaster/docs/ai-quality-v147-manifest.json'),'utf8')).baseline.sourceRoot;loadLabelSemanticsV1();return require(resolve(source,'lib/judgment-policy.ts')).TARGET_USAGE_DESCRIPTION;}
export function targetMeaningPolicyV1(){
 const p=structuredClone(loadLabelSemanticsV1()),instruction=productInstruction();
 check(instruction.includes('A recognizable inflection error can leave lexical target use appropriate while grammar needs work.')&&instruction.includes('Derivation that changes the supplied part of speech is not an inflection')&&instruction.includes('For grammar lessons assess CORRECT USE under targetCriterion'),'PRODUCT_BOUNDARY');
 p.version=6;p.supersedesHash=PRODUCT_RUBRIC_HASH_V5;p.targetMeaningProtocol=TARGET_MEANING_V1;p.canonicalTargetUsageInstruction=instruction;p.canonicalTargetUsageInstructionSha256=sha(instruction);
 p.dimensions.meaning.rule='Use the actual requested target type. '+instruction;
 p.dimensions.meaning.boundary+=' For a WORD target, a recognizable inflection defect alone does not make an otherwise supported lexical sense and part-of-speech assessment false. Do not transfer grammar or false explanatory claims into this separate target-use dimension. For a GRAMMAR LESSON target, required case/form/agreement belongs to the requested criterion and can fail target use. A changed part of speech, missing requested sense, derivation or insufficient message is not excused as mere inflection. Judge those conditions on their own evidence.';
 p.independentQualification=false;p.englishTruthCertified=false;p.liveDispatchAuthorized=false;
 check(digest(p)===PRODUCT_RUBRIC_HASH_V6,'POLICY_HASH');return p;
}
export function targetMeaningInstructionsV1(){const before=labelSemanticsInstructionsV1(),old=loadLabelSemanticsV1(),p=targetMeaningPolicyV1(),block=JSON.stringify({dimensions:old.dimensions,critical:old.criticalFlags});check(before.includes(block)&&before.includes(JSON.stringify(old)),'BASE_POLICY');return before.replace(block,JSON.stringify({dimensions:p.dimensions,critical:p.criticalFlags})).replace(JSON.stringify(old),JSON.stringify(p)).replace('TRUSTED ENGLISH PRODUCT LABEL SEMANTICS V1','TRUSTED ENGLISH TARGET MEANING BOUNDARY V1');}
export function targetMeaningBaselineV1(raw){const b=parseV3Json(raw);b.instructions=labelSemanticsInstructionsV1();b.text.format.name=LABEL_SEMANTICS_FORMAT_V1;b.text.format.schema.properties.productRubricHash={type:'string',enum:[PRODUCT_RUBRIC_HASH_V5]};return JSON.stringify(b);}
export function reviseTargetMeaningRequestV1(raw){const b=validateLabelSemanticsRequestV1(raw);b.instructions=targetMeaningInstructionsV1();b.text.format.name=TARGET_MEANING_FORMAT_V1;b.text.format.schema.properties.productRubricHash={type:'string',enum:[PRODUCT_RUBRIC_HASH_V6]};const result=JSON.stringify(b);validateTargetMeaningRequestV1(result);return result;}
export function validateTargetMeaningRequestV1(raw){const b=parseV3Json(raw);check(b.instructions===targetMeaningInstructionsV1()&&b.text?.format?.name===TARGET_MEANING_FORMAT_V1,'REQUEST_POLICY');check(digest(b.text.format.schema.properties.productRubricHash)===digest({type:'string',enum:[PRODUCT_RUBRIC_HASH_V6]}),'RESPONSE_VERSION');validateLabelSemanticsRequestV1(targetMeaningBaselineV1(raw));check(Buffer.byteLength(raw)<=131072,'REQUEST_SIZE');return b;}
export function parseTargetMeaningPayloadV1({requestRaw,payloadRaw}){validateTargetMeaningRequestV1(requestRaw);const v=validateV3Output(requestRaw,payloadRaw);check(v.productRubricHash===PRODUCT_RUBRIC_HASH_V6,'RESPONSE_VERSION');const result=parseLabelSemanticsPayloadV1({requestRaw:targetMeaningBaselineV1(requestRaw),payloadRaw:JSON.stringify({...v,productRubricHash:PRODUCT_RUBRIC_HASH_V5})});return{...result,productRubricHash:PRODUCT_RUBRIC_HASH_V6,targetMeaningPolicyHash:PRODUCT_RUBRIC_HASH_V6,baseLabelSemanticsHash:PRODUCT_RUBRIC_HASH_V5,semanticCorrectnessVerified:false,judgeQualificationVerified:false};}
