// Two-case application bridge fixture. These are transport/state witnesses,
// not the approved60-case evaluation corpus orEnglish correctness evidence.
import {createHash} from 'node:crypto';
import {panelFixtureV3,responseEnvelopeV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {compileAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const check=(v,code)=>{if(!v)throw Error('WP3_'+code);};
export const WORKER_CASES_V3=Object.freeze([
 Object.freeze({id:'fixture-case-1',domain:'word',stratum:'normal',familyId:'synthetic-help-command',input:Object.freeze({sentence:'Give help.',target:'help noun'})}),
 Object.freeze({id:'fixture-case-2',domain:'grammar',stratum:'needsCorrection',familyId:'synthetic-be-agreement',input:Object.freeze({sentence:'They is studying.',target:'auxiliary: be agreement andpresent progressive'})})
]);
export function workerPanelFixtureV3({stage='pilot-panel',recorded,projectGeneration,bindings,workerRuntime,references=null}){
 check(typeof projectGeneration==='function'&&bindings&&recorded&&workerRuntime,'INPUT');
 const rawFor=d=>{const c=WORKER_CASES_V3.find(c=>c.id===d.caseId),p=recorded.find(p=>p.profile===d.phase),raw=p?.requests.find(r=>{const b=JSON.parse(r.body);return b.model===d.modelId&&JSON.parse(b.input[0].content).sentence===c.input.sentence;})?.body;check(raw,'RECORDED_BODY');return raw;};
 const b=panelFixtureV3({stage,caseCount:2,...(stage==='pilot-panel'?{generationBody:rawFor}:{})}),cases=WORKER_CASES_V3.map(c=>{const ref=references?.find(r=>r.caseId===c.id);if(stage==='pilot-panel')check(ref?.provenance?.ledgerClosed===true&&ref.level==='ai-consensus','REFERENCE_HANDOFF');return {...structuredClone(c),reference:{level:ref?.level??'unresolved',criterion:ref?.criterion??'Wholly synthetic reference-authoring fixture;no English truth certified.',sources:[]},referenceProvenance:ref?.provenance??null};});
 b.reportInputs.cases=cases;b.cases=cases;b.workerResponses={};
 if(stage==='reference-preparation')for(const d of b.spec.requests.filter(d=>d.role==='referenceDraft')){const c=cases.find(c=>c.id===d.caseId),body=JSON.parse(b.wires[d.key].raw);body.input[0].content=JSON.stringify({input:c.input});b.wires[d.key]={raw:JSON.stringify(body)};d.bodyHash=sha(b.wires[d.key].raw);b.responses[d.key]=JSON.stringify({sentence:c.input.sentence,target:c.input.target,criterion:'Wholly synthetic transport/state criterion for '+c.domain+'. AI consensus isnot English truth.'});}
 else{
  const plan=compileAiPanel({runId:b.spec.runId,observations:b.spec.requests.filter(d=>d.role==='generation').map(d=>{const c=cases.find(c=>c.id===d.caseId);return {id:d.key,generatorId:d.generatorId,phase:d.phase,caseId:d.caseId,familyId:c.familyId,domain:c.domain,stratum:c.stratum,parentReceiptHash:digest('synthetic-future-capture'),input:c.input,reference:c.reference,feedback:null};}),witnesses:b.witnesses,contract:b.reportInputs.contract});
  for(const d of b.spec.requests){
   if(d.role==='review'){const raw=plan.slots.find(s=>s.kind==='review'&&s.privateBinding.sourceId===d.parentKey&&s.judgeId===d.modelId&&s.layout===d.layout).raw;b.wires[d.key]={templateRaw:raw};d.bodyHash=sha(raw);}
   if(d.role==='generation'){
    const c=cases.find(c=>c.id===d.caseId),word=c.domain==='word',payloadRaw=JSON.stringify({meaningUsage:word?'appropriate':'needs_work',grammar:word?'natural':'needs_work',correctedSentence:word?c.input.sentence:'They are studying.',targetReason:'합성 목표 의견',grammarReason:'합성 문법 의견',correctionReason:word?'':'합성 수 일치 보완',contextNeeded:'none'}),responseRaw=responseEnvelopeV3(b,d.key,{payloadRaw,usage:{input_tokens:100,output_tokens:80,output_tokens_details:{reasoning_tokens:10}}});
    b.workerResponses[d.key]=responseRaw;
    // The leaf fake endpoint's recipe oracle uses projected visible feedback;
    // generation itself goes only through the actual built application.
    b.responses[d.key]=projectGeneration({key:d.key,phase:d.phase,role:d.role,caseId:d.caseId,modelId:d.modelId,requestRaw:b.wires[d.key].raw,responseRaw});
   }
  }
 }
 b.current.environment.compatibilityDate=workerRuntime.compatibilityDate;b.current.environment.compatibilityFlags=structuredClone(workerRuntime.compatibilityFlags);
 Object.assign(b.current.components,bindings,{runtime:digest(b.current.environment),corpus:digest(cases),collectionPolicy:collectionPolicyV3(stage,b.reportInputs)});const {sourceSeal:_unused,...outline}=b.spec;void _unused;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));b.actualFinalEvaluationFrozen=false;b.actualModelQualityMeasured=false;return b;
}
