// Read-only bridge from verified synthetic v2 journals/captures to the fixed
// denominator report and calibration arithmetic. Never certifies model quality.
import {digest,MODELS,slotKey,accountV2} from './ai-quality-v147-budget-v2.mjs';
import {verifyV2Freeze} from './ai-quality-v147-wire-v2.mjs';
import {readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {readCaptureV2} from './ai-quality-v147-capture-v2.mjs';
import {reportEvaluation} from './ai-quality-v147-report.mjs';
import {summarizeCalibration} from './ai-quality-v147-calibration.mjs';
const check=(ok,code)=>{if(!ok)throw new Error(code);};
export function reportSyntheticJournalV2({context,seal,cases,witnesses=[]}){
 const {spec}=context;check(spec.mode==='synthetic','V2JR_SYNTHETIC_ONLY');verifyV2Freeze({spec,seal,current:seal.payload});
 check(digest(cases)===seal.payload.components.corpus,'V2JR_CASES_CHANGED');
 const ledger=readV2Journal(context).ledger,balance=accountV2(spec,ledger),requests=spec.batches.flatMap(b=>b.requests),generations=requests.filter(d=>d.role==='generation');
 const design={schemaVersion:1,planId:spec.planId,runId:spec.runId,protocolHash:digest(spec),evaluationKind:'pilot',dataClass:'synthetic',modelIds:[...MODELS],phases:['baseline','candidate'],
  phaseSeals:{baseline:seal.payload.components.sourceBaseline,candidate:seal.payload.components.sourceCandidate},repetitions:1,cases:structuredClone(cases),
  risk:{confidenceLevel:.95,samplingModel:'unverified',assumptionEvidenceHash:null,criterionStatus:'unapproved',approvalEvidenceHash:null,maximumCriticalRisk:null}};
 check(cases.length===60&&generations.length===360,'V2JR_PILOT_PLAN');
 const records=[];
 for(const d of generations){
  check(design.phases.includes(d.phase)&&MODELS.includes(d.targetModelId)&&d.repetition===1&&cases.some(c=>c.id===d.caseId),'V2JR_PLAN_CELL');
  const key=slotKey(d),row=ledger.slots[key],judges=requests.filter(j=>spec.wirePolicies[slotKey(j)].parentKey===key);check(judges.length===1,'V2JR_JUDGE_PLAN');
  const j=judges[0],jk=slotKey(j),jr=ledger.slots[jk];
  const generationState=!row||['reserved','unused'].includes(row.state)?'not-run':row.state==='consumed'?'unknown':row.state;
  let feedback=null,grade=null,judgeState='not-run';
  if(generationState==='completed')feedback=JSON.parse(readCaptureV2({context,ledger,key}).payloadRaw);
  if(feedback){judgeState=!jr||['reserved','unused'].includes(jr.state)?'not-run':jr.state==='consumed'?'unknown':jr.state;if(judgeState==='completed')grade=JSON.parse(readCaptureV2({context,ledger,key:jk}).payloadRaw);}
  for(const [k,r]of [[key,row],[jk,jr]])if(r&&['failed','unknown'].includes(r.state))readCaptureV2({context,ledger,key:k});
  records.push({designHash:digest(design),phase:d.phase,modelId:d.targetModelId,caseId:d.caseId,repetition:1,sourceHash:design.phaseSeals[d.phase],generationState,
   appState:feedback?'accepted':'not-run',visibleAction:feedback?(feedback.grammar==='uncertain'||feedback.meaningUsage==='uncertain'?'abstention':'answer'):null,
   judgeState,judgeModelId:judgeState==='not-run'?null:j.modelId,rawGrade:grade,evidenceHash:generationState==='not-run'?null:digest({specHash:digest(spec),key,row,binding:ledger.bindings[key],judge:jr??null}),diagnosticHash:null});
 }
 let calibration=null;
 if(witnesses.length){
  check(digest(witnesses)===seal.payload.components.rubric,'V2JR_RUBRIC_CHANGED');const planned=requests.filter(d=>d.role==='calibration');check(planned.length===36,'V2JR_CALIBRATION_PLAN');
  const collected=[];for(const d of planned){const witness=witnesses.find(w=>'witness-'+w.id.toLowerCase()===d.caseId);check(witness,'V2JR_CALIBRATION_WITNESS');const key=slotKey(d),row=ledger.slots[key];if(!row||['reserved','unused'].includes(row.state))continue;let grade=null;if(row.state==='completed')grade=JSON.parse(readCaptureV2({context,ledger,key}).payloadRaw);collected.push({judgeId:d.modelId,witnessId:witness.id,state:grade?'graded':'failed',grade});}
  calibration=summarizeCalibration(witnesses,collected);
 }
 return {design,records,report:reportEvaluation({design,records}),calibration,balance,closed:ledger.closed,actualProviderCalls:0,actualKeyReads:0,
  modelQualityMeasured:false,qualifiedIndependentReview:false,liveEvaluationSupported:false,releaseVerdict:'held'};
}
