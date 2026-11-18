import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { CRITICAL, DIMENSIONS } from './ai-quality-v147-calibration.mjs';
import { compileBilingualProductReviewV1, parseBilingualProductReviewV1 } from './ai-quality-v147-bilingual-product-review-v1.mjs';
import { compileBilingualProductReviewV2, parseBilingualProductReviewV2, loadBilingualProductRubricV2, BILINGUAL_PRODUCT_RUBRIC_HASH_V2 } from './ai-quality-v147-bilingual-product-review-v2.mjs';
import { compileGroupedProductReviewV2, parseGroupedProductReviewV2, GROUPED_PRODUCT_POLICY_HASH_V2 } from './ai-quality-v147-grouped-product-review-v2.mjs';
import { collectGroupedReviewsV4 } from './ai-quality-v147-grouped-review-executor-v4.mjs';

const bank=JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/explanation-main-witness-candidate-v1.json',import.meta.url),'utf8'));
const oldBank=JSON.stringify(bank), pass={...Object.fromEntries(DIMENSIONS.map(k=>[k,'pass'])),criticalErrors:Object.fromEntries(CRITICAL.map(k=>[k,false]))};
const reference={level:'unresolved',criterion:'Synthetic protocol fixture; no English truth or source qualification is claimed.',sources:[]};
const pick=id=>structuredClone(bank.rows.find(r=>r.id===id));
const rows=[pick('MC01'),pick('MC04'),pick('MC02'),pick('MC10'),pick('MC05')];
rows.push({id:'needless-refusal',assessmentDomain:'word',requestInput:{word:'music',pos:'n.',meaning:'음악',expression:'music',sentence:'Music',contextKind:'sentence',contextRole:'intended_korean',contextNote:'나는 음악을 좋아해요.'},
  feedback:{original:'Music',meaningUsage:'appropriate',grammar:'needs_work',correctedSentence:'',explanation:'어떤 뜻인지 더 알려 주세요.'},expectedGrade:{...pass,correction:'fail',abstention:'fail'},expectedEvidenceAxes:{sourceAdequacy:'sufficient',learnerContext:'sufficient',abstentionNeed:'not_required'}});
rows.push({id:'intent-over',assessmentDomain:'word',requestInput:{word:'over',pos:'prep.',meaning:'위쪽에',expression:'over',sentence:'The kite drifted under the bridge.',contextKind:'sentence',contextRole:'intended_korean',contextNote:'연은 다리 위쪽을 떠다녔어.'},
  feedback:{original:'The kite drifted under the bridge.',meaningUsage:'needs_work',grammar:'natural',correctedSentence:'The kite drifted over the bridge.',explanation:'한국어 의도에 맞게 under를 over로 바꿨어요.'},expectedGrade:pass,expectedEvidenceAxes:{sourceAdequacy:'sufficient',learnerContext:'sufficient',abstentionNeed:'not_required'}});
const observations=rows.map(r=>({id:r.id,domain:r.assessmentDomain,reference,feedback:r.feedback,parentRequestRaw:JSON.stringify({model:'gpt-6.1-sol',input:[{role:'user',content:JSON.stringify(r.requestInput)}]})}));
const individual=compileBilingualProductReviewV2({observations,salt:Buffer.alloc(32,180)}),grouped=compileGroupedProductReviewV2(individual);
const slot=id=>individual.slots.find(s=>s.privateBinding.sourceId===id);
function payload(s){
  const r=rows.find(r=>r.id===s.privateBinding.sourceId),f=r.feedback,changed=f&&!!f.correctedSentence&&f.correctedSentence!==f.original;
  return{grade:structuredClone(r.expectedGrade),...r.expectedEvidenceAxes,repairContext:f===null?'unavailable':changed?r.expectedEvidenceAxes.learnerContext:'not_applicable',
    assignmentForm:f===null?'unavailable':changed?'not_specified':'not_applicable',productRubricHash:BILINGUAL_PRODUCT_RUBRIC_HASH_V2,reasonCodes:[f===null?'unavailable':'confirmed']};
}

test('visible necessary withholding is gradeable; unavailable cannot replace the observed correction decision',()=>{
  const s=slot('MC01'),p=payload(s),before=JSON.stringify(p);
  assert.equal(parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}).grade.correction,'pass');
  p.grade.correction='unavailable';const rejected=JSON.stringify(p);
  assert.throws(()=>parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:rejected}),/BPR2_WITHHOLDING_IS_OBSERVABLE/);
  assert.equal(JSON.stringify(p),rejected);assert.notEqual(rejected,before);
});
test('empty text never auto-passes: needless refusal can fail and unresolved withholding can stay uncertain',()=>{
  const s=slot('needless-refusal'),p=payload(s);
  assert.equal(parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}).grade.correction,'fail');
  p.grade.correction='uncertain';assert.equal(parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}).grade.correction,'uncertain');
});
test('absence of feedback still requires five unavailable grades and never counts as responsible abstention',()=>{
  const s=slot('MC04'),p=payload(s);
  assert.deepEqual(parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}).grade,p.grade);
  p.grade.correction='pass';assert.throws(()=>parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}),/PF2_UNAVAILABLE/);
});
test('unsafe repair, bad grammar approval and explicit Korean meaning repair keep their prior boundaries',()=>{
  for(const id of ['MC02','MC10','MC05','intent-over']){
    const s=slot(id),p=payload(s);assert.deepEqual(parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}).grade,p.grade);
  }
  const s=slot('MC02'),p=payload(s);p.grade.correction='pass';assert.throws(()=>parseBilingualProductReviewV2({requestRaw:s.requestRaw,payloadRaw:JSON.stringify(p)}),/BPR2_MISSING_REPAIR_CONTEXT/);
});
test('v9 wires and scores remain valid only under v9; old replies cannot become v10 evidence',()=>{
  const old=compileBilingualProductReviewV1({observations:[observations[0]],salt:Buffer.alloc(32,180)}).slots[0];
  const oldHash=JSON.parse(old.requestRaw).text.format.schema.properties.productRubricHash.enum[0];const p=payload(slot('MC01'));p.productRubricHash=oldHash;p.grade.correction='unavailable';
  assert.equal(parseBilingualProductReviewV1({requestRaw:old.requestRaw,payloadRaw:JSON.stringify(p)}).grade.correction,'unavailable');
  assert.throws(()=>parseBilingualProductReviewV2({requestRaw:old.requestRaw,payloadRaw:JSON.stringify(p)}));
  assert.throws(()=>parseBilingualProductReviewV2({requestRaw:slot('MC01').requestRaw,payloadRaw:JSON.stringify(p)}));
  assert.equal(JSON.stringify(bank),oldBank);assert.equal(loadBilingualProductRubricV2().version,10);
});
test('grouped schema retains every item, five dimensions, critical flags, context and full output allowance',()=>{
  assert.equal(individual.slots.length,28);assert.equal(grouped.logicalSlots,28);assert.equal(grouped.availableSlots,24);assert.equal(grouped.unavailableSlots.length,4);
  for(const r of grouped.requests){
    assert.equal(r.outputTokenMax,r.itemCount*1024);assert.equal(r.requestRaw.includes('expectedGrade'),false);
    const p={groupProtocolHash:GROUPED_PRODUCT_POLICY_HASH_V2,items:r.privateMembers.map(m=>({itemId:m.itemId,...payload(m.individual)}))};
    assert.equal(parseGroupedProductReviewV2(r,JSON.stringify(p)).length,r.itemCount);
    p.items[0].productRubricHash='0'.repeat(64);assert.throws(()=>parseGroupedProductReviewV2(r,JSON.stringify(p)));
  }
});
test('v4 end-to-end mocks preserve four absent slots beside24 grades without key, network or actual AI claims',async()=>{
  const directory=mkdtempSync(resolve(process.env.QA_OUTPUT_DIR,'withholding-'));let index=0;const events=[];
  const result=await collectGroupedReviewsV4({plan:grouped,directory,limits:{requests:grouped.requests.length,judgments:24,maximumInputTokens:10000,maximumMicros:'35000000'},loadKey:()=> 'synthetic-withholding-key',transport:async({kind,body})=>{
    events.push(kind);if(kind==='count')return{status:200,type:'application/json',raw:'{"object":"response.input_tokens","input_tokens":6000}'};
    const b=JSON.parse(body),r=grouped.requests[index++];
    const p={groupProtocolHash:GROUPED_PRODUCT_POLICY_HASH_V2,items:r.privateMembers.map(m=>({itemId:m.itemId,...payload(m.individual)}))};
    return{status:200,type:'application/json',raw:JSON.stringify({id:'resp_synthetic_withholding_'+index,model:b.model,status:'completed',service_tier:'default',usage:{input_tokens:6000,output_tokens:700,total_tokens:6700},output:[{type:'reasoning',encrypted_content:'opaque_sk-'+ 'A'.repeat(40)},{type:'message',content:[{type:'output_text',text:JSON.stringify(p)}]}]})};
  }});
  assert.equal(result.failureCode,null);assert.equal(result.logicalJudgments,24);assert.equal(result.fullLogicalSlots,28);assert.equal(result.unavailableSlots.length,4);
  assert.equal(result.actualProviderCalls,0);assert.equal(result.actualCountCalls,0);assert.equal(result.actualKeyReads,0);
  assert.deepEqual(events,[...Array(grouped.requests.length).fill('count'),...Array(grouped.requests.length).fill('model')]);assert.equal(result.mainDispatchAuthorized,false);
});
test('visible or tampered observations cannot hide inside the unavailable denominator before credentials are loaded',async()=>{
  for(const kind of ['visible','hash']){
    const p=structuredClone(grouped);if(kind==='visible')p.unavailableSlots[0]=slot('MC01');else p.unavailableSlots[0].requestSha256='0'.repeat(64);
    const directory=mkdtempSync(resolve(process.env.QA_OUTPUT_DIR,'bad-absence-'));let keys=0;
    await assert.rejects(()=>collectGroupedReviewsV4({plan:p,directory,limits:{requests:p.requests.length,judgments:24,maximumInputTokens:10000,maximumMicros:'35000000'},loadKey:()=>{keys++;return 'synthetic-key';},transport:()=>{throw Error('must not run');}}),kind==='visible'?/GRV4_UNAVAILABLE_FEEDBACK/:/GRV4_UNAVAILABLE_BINDING/);
    assert.equal(keys,0);assert.equal(readdirSync(directory).length,0);
  }
});
