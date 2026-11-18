// Synthetic fixture only. Legacy-without-global mode is a controlled contrast,
// never a full-exposure or English-quality qualification configuration.
import {readFileSync} from 'node:fs';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
import {globalExposureFixtureV1} from './ai-quality-v147-global-exposure-fixture-v1.mjs';
import {referenceFixtureV4} from './ai-quality-v147-reference-fixture-v4.mjs';
import {referenceReviewBindingV4,materializeReferenceReviewV4} from './ai-quality-v147-reference-v4.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {INPUT_COUNT_V1} from './ai-quality-v147-input-count-v1.mjs';
import {withProgramExclusionPolicyV1} from './ai-quality-v147-program-exclusion-v1.mjs';
export function programExclusionFixtureV1({knownProgram=false,legacyWithoutGlobal=false}={}){
 const b=legacyWithoutGlobal?referenceFixtureV4({caseCount:1}):globalExposureFixtureV1({caseCount:1});b.reportInputs.contract.inputCountPolicy={protocol:INPUT_COUNT_V1,kind:'synthetic-only',required:true};
 if(knownProgram){
  const catalogue=JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/program-template-expansions-v1.json',import.meta.url),'utf8')),sentence=catalogue.result.generated.find(g=>g.role.startsWith('parser-original')).sentence;
  const author=b.spec.requests.find(d=>d.role==='referenceDraft'),record=JSON.parse(b.responses[author.key]);record.input.sentence=sentence;b.responses[author.key]=JSON.stringify(record);
  for(const d of b.spec.requests.filter(d=>d.role==='referenceReview')){const template=JSON.parse(b.wires[d.key].templateRaw),recipe=JSON.parse(template.input[0].content),binding=referenceReviewBindingV4(recipe.REFERENCE_DATA.context),items=materializeReferenceReviewV4(recipe,record).REFERENCE_REVIEW_ITEMS.items,old=JSON.parse(b.responses[d.key]);b.responses[d.key]=JSON.stringify({items:items.map(item=>({...old.items.find(x=>x.itemId===(item.itemId===binding.controlItemId?binding.controlItemId:binding.draftItemId)),itemId:item.itemId}))});}
 }
 b.reportInputs=withProgramExclusionPolicyV1(b.reportInputs);b.current.components.corpus=digest(b.reportInputs.cases);b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
