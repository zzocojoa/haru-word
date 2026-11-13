// Synthetic-only frozen opt-in. Does not change a quote, token cap or approval.
import {referenceFixtureV4} from './ai-quality-v147-reference-fixture-v4.mjs';
import {panelFixtureV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {INPUT_COUNT_V1} from './ai-quality-v147-input-count-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
export function countedFixtureV1({stage='reference-preparation',caseCount=2}={}){
 const b=stage==='reference-preparation'?referenceFixtureV4({caseCount}):panelFixtureV3({stage,caseCount});b.reportInputs.contract.inputCountPolicy={protocol:INPUT_COUNT_V1,kind:'synthetic-only',required:true};
 b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(stage,b.reportInputs);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
