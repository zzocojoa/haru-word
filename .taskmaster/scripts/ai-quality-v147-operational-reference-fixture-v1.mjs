import {createHash} from 'node:crypto';
import {countedFixtureV1} from './ai-quality-v147-input-count-fixture-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
import {REFERENCE_V4} from './ai-quality-v147-reference-v4.mjs';
import {REFERENCE_RUBRIC_HASH_V1} from './ai-quality-v147-reference-rubric-v1.mjs';
import {OPERATIONAL_REFERENCE_V1,operationalReferencePolicyV1,operationalReferenceTemplateV1} from './ai-quality-v147-operational-reference-v1.mjs';
export function operationalReferenceFixtureV1({caseCount=2,baseBundle=null}={}){
 const b=baseBundle??countedFixtureV1({caseCount});b.reportInputs.contract.referenceOperationalRubric=operationalReferencePolicyV1();
 for(const d of b.spec.requests.filter(x=>x.role==='referenceReview')){
  const p=b.reportInputs.cases.find(c=>c.id===d.caseId).referencePreparation,raw=operationalReferenceTemplateV1({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,control:p.control,nonce:p.reviewNonces[d.modelId],exposureEvidence:p.exposureEvidence??null});
  b.wires[d.key]={templateRaw:raw};d.bodyHash=createHash('sha256').update(raw).digest('hex');b.responses[d.key]=JSON.stringify({...JSON.parse(b.responses[d.key]),rubricHash:REFERENCE_RUBRIC_HASH_V1});
 }
 b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);b.current.components.referenceProtocol=digest({reference:REFERENCE_V4,operationalRubric:operationalReferencePolicyV1()});b.current.components.requestBuilder=digest({protocol:OPERATIONAL_REFERENCE_V1,cap:4096});b.current.components.projection=digest({protocol:OPERATIONAL_REFERENCE_V1,structuralConsistency:true});
 const {sourceSeal,...outline}=b.spec;void sourceSeal;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
