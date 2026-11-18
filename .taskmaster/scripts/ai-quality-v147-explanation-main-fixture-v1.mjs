// Controlled synthetic mechanism fixtures, never a new English gold or registry.
import {createHash} from 'node:crypto';
import {assessmentFixtureV1} from './ai-quality-v147-assessment-context-fixture-v1.mjs';
import {compileAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {explanationMainPolicyV1,explanationMainComponentV1} from './ai-quality-v147-explanation-main-v1.mjs';
import {PRODUCT_RUBRIC_HASH_V4} from './ai-quality-v147-explanation-scope-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function resealExplanationMainFixtureV1(b){
 const i=b.reportInputs;b.current.components.corpus=digest(i.cases);b.current.components.rubric=digest(i.contract);b.current.components.aiPanelPolicy=explanationMainComponentV1();b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,i);const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
export function explanationMainFixtureV1({caseCount=2}={}){
 const b=assessmentFixtureV1({caseCount}),i=b.reportInputs;i.contract.explanationScope=explanationMainPolicyV1();
 const observations=b.spec.requests.filter(d=>d.role==='generation').map(d=>{const c=i.cases.find(c=>c.id===d.caseId);return{id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:c.id,familyId:c.familyId,domain:c.domain,stratum:c.stratum,input:c.input,requestInput:c.requestInput,reference:c.reference,feedback:null,parentReceiptHash:digest('synthetic-future-capture')};});
 const plan=compileAiPanel({runId:b.spec.runId,observations,witnesses:i.witnesses,contract:i.contract});
 for(const d of b.spec.requests){
  if(!['review','calibration'].includes(d.role))continue;
  const slot=plan.slots.find(s=>d.role==='review'?s.kind==='review'&&s.privateBinding.sourceId===d.parentKey&&s.judgeId===d.modelId&&s.layout===d.layout:s.kind==='calibration'&&s.privateBinding.witnessId===d.caseId&&s.judgeId===d.modelId&&s.layout===d.layout);if(!slot)throw Error('XMF1_SLOT');
  b.wires[d.key]=d.bodyKind==='static'?{raw:slot.raw}:{templateRaw:slot.raw};d.bodyHash=sha(slot.raw);d.outputTokenMax=1024;
  const value=JSON.parse(b.responses[d.key]);value.productRubricHash=PRODUCT_RUBRIC_HASH_V4;b.responses[d.key]=JSON.stringify(value);
 }
 b.syntheticMechanismOnly=true;b.sourceQualified=false;b.expectedGradesAreReusedFixtureValues=true;
 return resealExplanationMainFixtureV1(b);
}
