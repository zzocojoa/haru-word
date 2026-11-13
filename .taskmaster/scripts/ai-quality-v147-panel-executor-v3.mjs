// Synthetic-only orchestration. No credential discovery, provider URL, retry or
// legacy-ledger IO. A consumed request is recovered from files or held,never sent.
import {readFileSync,lstatSync,fstatSync,openSync,closeSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {compileV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {openV3Journal,readV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {openV3SettlementProof} from './ai-quality-v147-settlement-proof-v3.mjs';
import {inspectV3Recovery} from './ai-quality-v147-recovery-v3.mjs';
import {verifyReportInputsV3,calibrationGateV3,buildPanelReportV3} from './ai-quality-v147-panel-report-v3.mjs';
import {REFERENCE_V4,buildReferenceReportV4,referenceDraftRequestV4,referenceReviewTemplateV4,materializeReferenceReviewV4,validateReferenceExposurePolicyV4} from './ai-quality-v147-reference-v4.mjs';
import {INPUT_COUNT_V1} from './ai-quality-v147-input-count-v1.mjs';
import {openSyntheticInputCountStoreV1,inspectSyntheticInputCountsV1} from './ai-quality-v147-input-count-store-v1.mjs';
import {openProgramExclusionGuardV1,applyProgramExclusionReportV1} from './ai-quality-v147-program-exclusion-v1.mjs';
import {openProgramLiteralGuardV1,applyProgramLiteralReportV1} from './ai-quality-v147-program-literal-exclusion-v1.mjs';
import {assertCalibrationAdmissionV1} from './ai-quality-v147-calibration-admission-v1.mjs';
import {verifyOperationalReferencePolicyV1,compileOperationalReferenceWireV1,operationalReferenceTemplateV1,materializeOperationalReferenceWireV1,buildOperationalReferenceReportV1} from './ai-quality-v147-operational-reference-v1.mjs';
import {verifyProductRubricPolicyV1,validateProductRubricRequestV1} from './ai-quality-v147-product-rubric-v1.mjs';
import {verifyAssessmentContextV1,validateAssessmentContextRequestV1,assertAssessmentParentV1,capturedProductInputV1} from './ai-quality-v147-assessment-context-v1.mjs';
import {verifyExplanationMainV1,assertExplanationMainAdmissionV1,assertExplanationMainParentV1} from './ai-quality-v147-explanation-main-v1.mjs';
import {validateExplanationScopeRequestV1} from './ai-quality-v147-explanation-scope-v1.mjs';
export const EXECUTOR_V3='ai-quality-v147-synthetic-panel-executor-v3';
const check=(ok,code)=>{if(!ok)throw Error('PX3_'+code);};
const sha=x=>createHash('sha256').update(x).digest('hex');
const terminal=r=>r&&['completed','failed','unknown'].includes(r.state);
export const panelFailureCodeV3=e=>/^(?:PX3|PR3|W3|C3|S3|R3|J3|P3|PANEL|REF4|IC1|ICJ1|EX1|GEX1|PEX1|PLX1|CALQ1|OR1|RR1|PF1|PF2|AC1|XM1)_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'PX3_IO_OR_TRANSPORT';
const group=d=>d.role==='calibration'?'calibration/'+d.caseId:d.phase==='reference'?'reference/'+d.caseId:[d.phase,d.generatorId,d.caseId,d.repetition].join('/');
function recheckFile(root,f){
 const file=resolve(f.directory,f.name);check(dirname(file)===f.directory&&dirname(f.directory)===root&&realpathSync(f.directory)===f.directory&&!lstatSync(f.directory).isSymbolicLink(),'CALIBRATION_SCOPE');const before=lstatSync(file);check(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=1048576,'CALIBRATION_FILE');const fd=openSync(file,'r');try{const a=fstatSync(fd),b=readFileSync(fd),z=fstatSync(fd),last=lstatSync(file);check(a.ino===before.ino&&a.dev===before.dev&&a.nlink===1&&b.length===a.size&&z.size===a.size&&z.mtimeMs===a.mtimeMs&&last.ino===a.ino&&last.dev===a.dev&&sha(b)===f.sha256,'CALIBRATION_CHANGED');}finally{closeSync(fd);}
}
export function openSyntheticPanelExecutorV3({context:sourceContext,seal:sourceSeal,observeCurrent,readWire,reportInputs,transport,inputCountTransport=null,projectGeneration=null,testFault=null}){
 check(typeof observeCurrent==='function'&&typeof readWire==='function'&&typeof transport==='function','CALLBACKS');const context=structuredClone(sourceContext),seal=structuredClone(sourceSeal),inputs=structuredClone(reportInputs),operational=verifyOperationalReferencePolicyV1({spec:context.spec,seal,inputs}),wire=(operational?compileOperationalReferenceWireV1:compileV3Wire)({seal,spec:context.spec}),spec=wire.spec;check(spec.mode==='synthetic','SYNTHETIC_ONLY');verifyReportInputsV3({spec,seal,inputs});
 const contextHash=digest(context),sealHash=digest(seal),inputsHash=digest(inputs);
 const countPolicy=inputs.contract.inputCountPolicy,countRequired=countPolicy!==undefined;
 const productOperational=verifyProductRubricPolicyV1({spec,seal,inputs}),explanationScope=verifyExplanationMainV1({spec,seal,inputs}),assessmentContext=explanationScope||verifyAssessmentContextV1({spec,seal,inputs});
 check(countRequired?countPolicy&&Object.keys(countPolicy).sort().join('|')==='kind|protocol|required'&&countPolicy.protocol===INPUT_COUNT_V1&&countPolicy.kind==='synthetic-only'&&countPolicy.required===true&&typeof inputCountTransport==='function':inputCountTransport===null,'INPUT_COUNT_POLICY');
 validateReferenceExposurePolicyV4(inputs);
 assertExplanationMainAdmissionV1({inputs,stage:spec.profile.stage});assertCalibrationAdmissionV1({inputs,stage:spec.profile.stage});
 const programGuard=openProgramExclusionGuardV1(inputs),literalGuard=openProgramLiteralGuardV1(inputs);
 function current(){check(digest(sourceContext)===contextHash&&digest(sourceSeal)===sealHash&&digest(reportInputs)===inputsHash,'INPUT_CHANGED');const c=structuredClone(observeCurrent());wire.verify(c);check(c.environment.nodeVersion===process.version&&c.environment.platform===process.platform&&c.environment.arch===process.arch,'ACTUAL_RUNTIME');return c;}
 current();const store=openV3CaptureStore({context,seal,observeCurrent,projectGeneration}),proof=openV3SettlementProof({context,seal,observeCurrent,projectGeneration});check(inspectV3Recovery(context,{settlementProof:proof}).basis.action==='none','EXPLICIT_RECOVERY_REQUIRED');const session=openV3Journal(context);let busy=false,released=false,gateCache=null,countStore=null,clientAttempts=0;
 const point=async stage=>{await testFault?.(stage);};
 const live=()=>{check(!released,'RELEASED');current();return session.current();};
 const inputCounts=()=>countStore??=openSyntheticInputCountStoreV1({context,session,observeCurrent:current});
 function gradeGate(){const {ledger}=live();if(spec.profile.stage!=='pilot-panel')return;assertExplanationMainAdmissionV1({inputs,stage:spec.profile.stage});assertCalibrationAdmissionV1({inputs,stage:spec.profile.stage});const receipts=spec.requests.filter(d=>d.role==='calibration').map(d=>[d.key,ledger.slots[d.key]?.receiptHash]);if(gateCache){check(digest(receipts)===gateCache.receiptsHash,'CALIBRATION_RECEIPT_CHANGED');for(const f of gateCache.files)recheckFile(context.allowedRoot,f);}else{const gate=calibrationGateV3({spec,ledger,store,inputs});check(gate.thresholdArithmeticSatisfied&&gate.files.length===360&&(!gate.sourceQualification.required||gate.calibrationAcceptanceAllowed),'CALIBRATION_GRADE_GATE');gateCache={receiptsHash:digest(receipts),files:gate.files};}}
 function parent(d,ledger){return d.parentKey?store.read({ledger,key:d.parentKey}):null;}
 function referenceGate(){if(inputs.contract.protocol===REFERENCE_V4){const r=applyProgramLiteralReportV1({report:applyProgramExclusionReportV1({report:(operational?buildOperationalReferenceReportV1({spec,seal,ledger:live().ledger,store,inputs}):buildReferenceReportV4({spec,ledger:live().ledger,store,inputs})),inputs}),inputs});check(!r.gateViolated,'REFERENCE_GRADE_GATE');}}
 function prepare(d,ledger){
  programGuard?.assertCurrent();literalGuard?.assertCurrent();
  const capturedParent=parent(d,live().ledger),prepared=wire.prepare({current:current(),ledger,key:d.key,wire:structuredClone(readWire(d.key)),parentCapture:capturedParent});
  if(productOperational&&['review','calibration'].includes(d.role))validateProductRubricRequestV1(prepared.raw);
  if(assessmentContext){if(['review','calibration'].includes(d.role)){(explanationScope?validateExplanationScopeRequestV1:validateAssessmentContextRequestV1)(prepared.raw);(explanationScope?assertExplanationMainParentV1:assertAssessmentParentV1)({requestRaw:prepared.raw,parentRequestRaw:capturedParent?.requestRaw??null,role:d.role});}else if(d.role==='generation'){const expected=inputs.cases.find(c=>c.id===d.caseId)?.requestInput;check(expected&&digest(capturedProductInputV1(prepared.raw))===digest(expected),'ACTUAL_GENERATION_INPUT');}}
  if(programGuard&&d.role==='referenceReview'&&capturedParent)programGuard.assertDraftNotKnown(JSON.parse(capturedParent.payloadRaw));
  if(literalGuard&&d.role==='referenceReview'&&capturedParent)literalGuard.assertDraftNotKnown(JSON.parse(capturedParent.payloadRaw));
  if(inputs.contract.protocol===REFERENCE_V4){const p=inputs.cases.find(c=>c.id===d.caseId)?.referencePreparation;check(p,'REFERENCE_ASSIGNMENT');let expected;
   if(d.role==='referenceDraft')expected=referenceDraftRequestV4({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,exposureEvidence:p.exposureEvidence??null});else{check(d.role==='referenceReview'&&capturedParent,'REFERENCE_PARENT');const templateRaw=(operational?operationalReferenceTemplateV1:referenceReviewTemplateV4)({modelId:d.modelId,assignment:p.assignment,sourcePack:p.sourcePack,control:p.control,nonce:p.reviewNonces[d.modelId],exposureEvidence:p.exposureEvidence??null});if(operational)expected=materializeOperationalReferenceWireV1(templateRaw,JSON.parse(capturedParent.payloadRaw));else{const template=JSON.parse(templateRaw);template.input[0].content=JSON.stringify(materializeReferenceReviewV4(JSON.parse(template.input[0].content),JSON.parse(capturedParent.payloadRaw)));expected=JSON.stringify(template);}}
   check(prepared.raw===expected,'REFERENCE_REQUEST_BINDING');
  }return prepared;
 }
 async function dispatchOne(key){
  let {ledger}=live();const d=spec.requests.find(d=>d.key===key);check(d,'REQUEST_KEY');let row=ledger.slots[key];
  if(terminal(row)){const captured=store.read({ledger,key});if(programGuard&&d.role==='referenceDraft'&&row.state==='completed'){programGuard.assertCurrent();programGuard.assertDraftNotKnown(JSON.parse(captured.payloadRaw));}if(literalGuard&&d.role==='referenceDraft'&&row.state==='completed'){literalGuard.assertCurrent();literalGuard.assertDraftNotKnown(JSON.parse(captured.payloadRaw));}return {status:'already-settled',state:row.state,noDispatchPerformed:true};}
  if(row?.state==='consumed'){const settled=store.settle({session,key});if(programGuard&&d.role==='referenceDraft'&&settled.result.state==='completed'){programGuard.assertCurrent();programGuard.assertDraftNotKnown(JSON.parse(store.read({ledger:live().ledger,key}).payloadRaw));}if(literalGuard&&d.role==='referenceDraft'&&settled.result.state==='completed'){literalGuard.assertCurrent();literalGuard.assertDraftNotKnown(JSON.parse(store.read({ledger:live().ledger,key}).payloadRaw));}return {status:'recovered-from-capture',state:settled.result.state,noDispatchPerformed:true};}
  check(!ledger.closed&&!ledger.hold,'DISPATCH_HELD');referenceGate();if(d.role==='generation')gradeGate();
  if(!row){session.append({kind:'reserve',groupId:group(d)});ledger=live().ledger;row=ledger.slots[key];}
  check(row.state==='reserved','UNSENT_SLOT');const prepared=prepare(d,ledger);
  if(countRequired){await point('before-input-count');await inputCounts().ensure({descriptor:d,generationWire:prepared,transport:inputCountTransport,testFault:stage=>testFault?.('input-count:'+stage)});await point('after-input-count');}
  await point('before-consume');const verified=prepare(d,ledger);check(verified.raw===prepared.raw&&digest(verified.binding)===digest(prepared.binding),'PREPARE_CHANGED');if(countRequired)inputCounts().verify({descriptor:d,generationWire:verified});
  session.append([...(prepared.bindOperation?[prepared.bindOperation]:[]),{kind:'consume',key}]);await point('after-consume');await point('before-transport');
  // Guard is deliberately after the durable consumption and async boundary.
  // Freeze/recipe/physical-parent/calibration changes cannot cross this boundary.
   const finalWire=prepare(d,ledger);check(finalWire.raw===prepared.raw&&digest(finalWire.binding)===digest(prepared.binding),'PRETRANSPORT_CHANGED');referenceGate();if(d.role==='generation')gradeGate();if(countRequired)inputCounts().verify({descriptor:d,generationWire:finalWire});check(live().ledger.slots[key].state==='consumed','CONSUMPTION_CHANGED');
  clientAttempts++;const response=await transport({key,requestId:wire.requestId(key),requestRaw:finalWire.raw,role:d.role,modelId:d.modelId});await point('after-transport');current();await point('before-capture');
  check(response&&Object.keys(response).sort().join('|')==='contentType|responseRaw|status','TRANSPORT_RESULT');const cap=store.capture({ledger:live().ledger,key,requestRaw:finalWire.raw,status:response.status,contentType:response.contentType,responseRaw:response.responseRaw},stage=>testFault?.('capture:'+stage));await point('after-capture');await point('before-settle');const result=store.settle({session,key});await point('after-settle');
  if(programGuard&&d.role==='referenceDraft'&&result.result.state==='completed'){programGuard.assertCurrent();programGuard.assertDraftNotKnown(JSON.parse(store.read({ledger:live().ledger,key}).payloadRaw));}if(literalGuard&&d.role==='referenceDraft'&&result.result.state==='completed'){literalGuard.assertCurrent();literalGuard.assertDraftNotKnown(JSON.parse(store.read({ledger:live().ledger,key}).payloadRaw));}
  return {status:'sent-once',state:result.result.state,requestId:cap.result.requestId,noDispatchPerformed:false};
 }
 async function exclusive(fn){check(!busy&&!released,'BUSY_OR_RELEASED');busy=true;try{return await fn();}finally{busy=false;}}
 function report(){const {ledger}=live(),result=buildPanelReportV3({spec,seal,ledger,store,inputs});if(countRequired)result.inputCounts=inspectSyntheticInputCountsV1(context);return result;}
 return Object.freeze({
  protocol:EXECUTOR_V3,actualProviderCalls:0,actualKeyReads:0,liveDispatchSupported:false,
  dispatch:key=>exclusive(()=>dispatchOne(key)),
  collect:()=>exclusive(async()=>{const firstAttempt=clientAttempts;let failure=null,sent=0,recovered=0;try{for(const key of spec.order){const r=await dispatchOne(key);if(r.status==='sent-once')sent++;if(r.status==='recovered-from-capture')recovered++;check(r.state==='completed','NONCOMPLETED_CAPTURE');check(!live().ledger.hold,'LEDGER_HOLD');}if(spec.profile.stage==='pilot-panel')gradeGate();}catch(e){failure=panelFailureCodeV3(e);}
   // Only unsent reservations are released. Consumed/unknown costs remain.
   try{if(!live().ledger.closed){await point('before-close');session.append({kind:'close'});await point('after-close');}}catch(e){failure??=panelFailureCodeV3(e);}
   let derived=null;try{derived=report();if(derived.references?.gateViolated)failure??='PX3_REFERENCE_GRADE_GATE';}catch(e){failure??=panelFailureCodeV3(e);}return {status:failure?'held':'synthetic-collected',failureCode:failure,sent:(programGuard||literalGuard)?clientAttempts-firstAttempt:sent,...((programGuard||literalGuard)?{clientDispatches:clientAttempts-firstAttempt}:{}),recovered,report:derived,actualProviderCalls:0,actualKeyReads:0,releaseVerdict:'held'};
  }),
  inspect(){return {...live(),noDispatchPerformed:true};},report,
  release(){check(!busy&&!released,'BUSY_OR_RELEASED');try{return session.close();}finally{released=true;}},
  abandon(){check(!busy&&!released,'BUSY_OR_RELEASED');try{return session.abandon();}finally{released=true;}}
 });
}
export function inspectSyntheticPanelV3({context,seal,observeCurrent,reportInputs,projectGeneration=null}){const store=openV3CaptureStore({context,seal,observeCurrent,projectGeneration}),proof=openV3SettlementProof({context,seal,observeCurrent,projectGeneration});check(inspectV3Recovery(context,{settlementProof:proof}).basis.action==='none','EXPLICIT_RECOVERY_REQUIRED');const state=readV3Journal(context),report=buildPanelReportV3({spec:context.spec,seal,ledger:state.ledger,store,inputs:reportInputs});if(reportInputs.contract.inputCountPolicy)report.inputCounts=inspectSyntheticInputCountsV1(context);return {...state,report,noDispatchPerformed:true};}
