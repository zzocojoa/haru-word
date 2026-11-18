// Synthetic fixture package for the full staged executor. Never an actual corpus
// or approval/price quote. Existing v3 fixture code and old histories stay intact.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {v3WireFixture} from './ai-quality-v147-wire-v3-fixture.mjs';
import {compileAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function panelFixtureV3({stage='pilot-panel',caseCount=1,references=null,generationBody=null}={}){
 const b=v3WireFixture({stage,caseCount,generationBody}),cases=b.cases.map((c,i)=>{
  const reference=references?.find(r=>r.caseId===c.id),offset=i%30,domain=i<Math.ceil(caseCount/2)?'word':'grammar',stratum=offset<10?'normal':offset<22?'needsCorrection':'insufficientContext';
  return {id:c.id,familyId:'synthetic-family-'+(i+1),domain,stratum,input:c.input,reference:{level:reference?.level??'ai-consensus',criterion:reference?.criterion??'Wholly synthetic transport/reference fixture. No English truth certified.',sources:[]},referenceProvenance:reference?.provenance??null};
 });
 const inputs={cases,witnesses:b.witnesses,contract:JSON.parse(readFileSync(fileURLToPath(new URL('../docs/ai-quality-v147-decision-contract-v4.json',import.meta.url)),'utf8'))};
 return finishFixture(b,inputs);
}
function finishFixture(b,inputs){
 if(b.spec.profile.stage==='pilot-panel'){
  const plan=compileAiPanel({runId:b.spec.runId,observations:b.spec.requests.filter(d=>d.role==='generation').map(d=>{const c=inputs.cases.find(c=>c.id===d.caseId);return {id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:d.caseId,familyId:c.familyId,domain:c.domain,stratum:c.stratum,parentReceiptHash:digest('synthetic-future-capture'),input:c.input,reference:c.reference,feedback:null};}),witnesses:inputs.witnesses,contract:inputs.contract});
  for(const d of b.spec.requests){let raw;if(d.role==='review')raw=plan.slots.find(s=>s.kind==='review'&&s.privateBinding.sourceId===d.parentKey&&s.judgeId===d.modelId&&s.layout===d.layout).raw;else if(d.role==='calibration')raw=plan.slots.find(s=>s.kind==='calibration'&&s.privateBinding.witnessId===d.caseId&&s.judgeId===d.modelId&&s.layout===d.layout).raw;else continue;b.wires[d.key]=d.bodyKind==='static'?{raw}:{templateRaw:raw};d.bodyHash=sha(raw);}
 }
 b.reportInputs=inputs;b.current.components.corpus=digest(inputs.cases);b.current.components.rubric=digest(inputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,inputs);const {sourceSeal:_unused,...outline}=b.spec;void _unused;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
export function responseEnvelopeV3(bundle,key,{usage={input_tokens:20,output_tokens:20},payloadRaw=bundle.responses[key]}={}){const d=bundle.spec.requests.find(d=>d.key===key);return JSON.stringify({status:'completed',model:d.modelId,usage,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:payloadRaw}]}]});}
