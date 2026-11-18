// New owned synthetic profile. No prior actual expectations or ledgers are edited.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {countedFixtureV1} from './ai-quality-v147-input-count-fixture-v1.mjs';
import {compileAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {assessmentContextPolicyV1,assessmentContextComponentV1,ASSESSMENT_CONTEXT_HASH_V1} from './ai-quality-v147-assessment-context-v1.mjs';
import {PRODUCT_RUBRIC_HASH_V2} from './ai-quality-v147-product-rubric-v2.mjs';
import {withCalibrationAdmissionV1} from './ai-quality-v147-calibration-admission-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function fixtureRequestInputV1(input,domain){
 return domain==='word'?{word:'help',pos:'n.',meaning:'도움',expression:'help',sentence:input.sentence,...(input.contextKind&&input.contextKind!=='sentence'?{contextKind:input.contextKind}:{}),...(input.contextNote?{contextNote:input.contextNote}:{})}:{sentence:input.sentence,target:input.target,role:'synthetic grammar target',pattern:'be + verb-ing',task:'Write the intended message.',check:'Synthetic self-check.',stem:'synthetic stem',targetCriterion:input.target,...(input.contextKind&&input.contextKind!=='sentence'?{contextKind:input.contextKind}:{}),...(input.contextNote?{contextNote:input.contextNote}:{})};
}
export function resealAssessmentFixtureV1(b){
 const i=b.reportInputs;b.current.components.corpus=digest(i.cases);b.current.components.rubric=digest(i.contract);b.current.components.aiPanelPolicy=assessmentContextComponentV1();b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,i);const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
export function assessmentFixtureV1({caseCount=2,requireCurrentQualification=false,base=null}={}){
 const b=base??countedFixtureV1({stage:'pilot-panel',caseCount}),i=b.reportInputs,oldWitnessIds=i.witnesses.map(w=>w.id);i.contract.assessmentContext=assessmentContextPolicyV1();delete i.contract.productOperationalRubric;
 // V3 development bank's12 primary candidates retain4/4/4 groups. The two
 // extra boundary controls and disputed N04 are not silently admitted here.
 const bank=JSON.parse(readFileSync(new URL('../evaluation/ai-quality-v147/product-calibration-candidate-v3.json',import.meta.url),'utf8'));
 i.witnesses=bank.rows.filter(w=>w.purpose==='candidate-qualification'&&!['B01','B02'].includes(w.id)).map(w=>{const domain=['F01','F02','F04','N01','N03'].includes(w.id)?'word':'grammar',requestInput=fixtureRequestInputV1(w.input,domain);if(domain==='word'){const def={F01:['go','v.','가다'],F02:['own','v.','소유하다'],F04:['music','n.','음악'],N01:['book','v.','예약하다'],N03:['help','n.','도움']}[w.id];[requestInput.word,requestInput.pos,requestInput.meaning]=def;requestInput.expression=def[0];}return {...structuredClone(w),assessmentDomain:domain,requestInput};});b.witnesses=i.witnesses;
 const idMap=new Map(oldWitnessIds.map((id,n)=>[id,i.witnesses[n].id])),rename=k=>{if(idMap.has(k))return idMap.get(k);let value=k;for(const [a,z]of idMap)value=value.replace('/'+a+'/','/'+z+'/');return value;};b.spec.profile.witnessIds=b.spec.profile.witnessIds.map(rename);b.spec.order=b.spec.order.map(rename);b.current.order=b.current.order.map(rename);b.wires=Object.fromEntries(Object.entries(b.wires).map(([k,v])=>[rename(k),v]));b.responses=Object.fromEntries(Object.entries(b.responses).map(([k,v])=>[rename(k),v]));
 for(const d of b.spec.requests){d.key=rename(d.key);if(d.role==='calibration')d.caseId=rename(d.caseId);}
 for(const c of i.cases){
  const d=b.spec.requests.find(d=>d.role==='generation'&&d.caseId===c.id),raw=b.wires[d.key].raw,body=JSON.parse(raw),oldInput=JSON.parse(body.input[0].content);
  const alreadyProduct=typeof oldInput.word==='string'||typeof oldInput.targetCriterion==='string';c.requestInput=alreadyProduct?oldInput:fixtureRequestInputV1(c.input,c.domain);
  if(!alreadyProduct)for(const g of b.spec.requests.filter(x=>x.role==='generation'&&x.caseId===c.id)){const feedback=JSON.parse(b.responses[g.key]);if(feedback.grammar==='natural')feedback.correctedSentence=c.input.sentence;b.responses[g.key]=JSON.stringify(feedback);const v=JSON.parse(b.wires[g.key].raw);v.input[0].content=JSON.stringify(c.requestInput);b.wires[g.key]={raw:JSON.stringify(v)};g.bodyHash=sha(b.wires[g.key].raw);}
 }
 const args={runId:b.spec.runId,observations:b.spec.requests.filter(d=>d.role==='generation').map(d=>{const c=i.cases.find(c=>c.id===d.caseId);return{id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:c.id,familyId:c.familyId,domain:c.domain,stratum:c.stratum,input:c.input,requestInput:c.requestInput,reference:c.reference,feedback:null,parentReceiptHash:digest('synthetic-future-capture')};}),witnesses:i.witnesses,contract:i.contract},plan=compileAiPanel(args);
 for(const d of b.spec.requests){
  if(!['review','calibration'].includes(d.role))continue;const slot=plan.slots.find(s=>d.role==='review'?s.kind==='review'&&s.privateBinding.sourceId===d.parentKey&&s.judgeId===d.modelId&&s.layout===d.layout:s.kind==='calibration'&&s.privateBinding.witnessId===d.caseId&&s.judgeId===d.modelId&&s.layout===d.layout);if(!slot)throw Error('ACF1_SLOT');
  b.wires[d.key]=d.bodyKind==='static'?{raw:slot.raw}:{templateRaw:slot.raw};d.bodyHash=sha(slot.raw);const w=i.witnesses.find(w=>w.id===d.caseId),v=JSON.parse(b.responses[d.key]);if(w)v.grade=structuredClone(w.expectedGrade);Object.assign(v,{productRubricHash:PRODUCT_RUBRIC_HASH_V2,assessmentContextHash:ASSESSMENT_CONTEXT_HASH_V1,...(w?w.expectedEvidenceAxes:{sourceAdequacy:'sufficient',learnerContext:'sufficient',abstentionNeed:'not_required'})});b.responses[d.key]=JSON.stringify(v);
 }
 if(requireCurrentQualification)b.reportInputs=withCalibrationAdmissionV1(i);return resealAssessmentFixtureV1(b);
}
