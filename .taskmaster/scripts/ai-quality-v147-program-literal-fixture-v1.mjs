// Synthetic-only; the no-global positive is an explicitly controlled contrast.
import {readFileSync} from 'node:fs';
import {programExclusionFixtureV1} from './ai-quality-v147-program-exclusion-fixture-v1.mjs';
import {withProgramLiteralPolicyV1} from './ai-quality-v147-program-literal-exclusion-v1.mjs';
import {operationalReferenceFixtureV1} from './ai-quality-v147-operational-reference-fixture-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
export function programLiteralFixtureV1({knownField=null,legacyWithoutGlobal=false,operational=true}={}){
 const b=programExclusionFixtureV1({legacyWithoutGlobal});
 if(knownField){
  const audit=JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/program-literal-exposure-audit-v1.json',import.meta.url),'utf8')).result,old=new Set(b.reportInputs.programExposureIndex.entries.map(x=>x.normalizedSha256)),candidate=audit.surfaces.find(x=>!x.alreadyInSelected426Corpus&&!old.has(x.normalizedSha256)&&x.value==='I need under a week.');if(!candidate)throw Error('PLF1_PROBE');
  const author=b.spec.requests.find(x=>x.role==='referenceDraft'),draft=JSON.parse(b.responses[author.key]);
  if(knownField==='input')draft.input.sentence=candidate.value;else if(knownField==='context')draft.input.contextNote=candidate.value;else if(knownField==='correction'){draft.expectedOriginal.grammar='needs_work';draft.acceptedCorrectionExamples=[candidate.value];}else throw Error('PLF1_FIELD');
  b.responses[author.key]=JSON.stringify(draft);
 }
 b.reportInputs=withProgramLiteralPolicyV1(b.reportInputs);b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);const {sourceSeal,...outline}=b.spec;void sourceSeal;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return operational?operationalReferenceFixtureV1({baseBundle:b}):b;
}
