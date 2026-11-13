// Full60 synthetic preparation scale, never a real corpus or English score.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {referenceFixtureV4} from './ai-quality-v147-reference-fixture-v4.mjs';
import {createV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openSyntheticPanelExecutorV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {startSyntheticHttpV3} from './ai-quality-v147-synthetic-http-v3.mjs';
import {referenceHandoffV3} from './ai-quality-v147-panel-report-v3.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {compileAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {digest} from './ai-quality-v147-budget-v3.mjs';
const root=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(root,{recursive:false});const b=referenceFixtureV4({caseCount:60}),context={allowedRoot:root,directory:resolve(root,'v3-'+b.spec.runId),spec:b.spec};createV3Journal(context,b.approval);writeFileSync(resolve(root,'bundle.json'),JSON.stringify(b));
const options={context,seal:b.seal,observeCurrent:()=>b.current,readWire:key=>b.wires[key],reportInputs:b.reportInputs};let http=null,e=null;
try{
 http=await startSyntheticHttpV3({bundle:b,logFile:resolve(root,'http.jsonl')});e=openSyntheticPanelExecutorV3({...options,transport:http.send});const result=await e.collect(),state=e.inspect();assert.equal(result.status,'synthetic-collected');assert.equal(result.sent,180);assert.equal(result.report.references.denominator,60);assert.equal(result.report.references.held,false);e.release();e=null;
 const refs=referenceHandoffV3({spec:b.spec,seal:b.seal,ledger:state.ledger,store:openV3CaptureStore(options),inputs:b.reportInputs});assert.equal(refs.length,60);assert.equal(new Set(refs.map(r=>r.input.sentence)).size,60);assert.ok(refs.every(r=>r.provenance.raw.length===3&&r.provenance.controlResults.length===2&&r.provenance.controlResults.every(x=>x.controlMatches)));
 const contract=JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-decision-contract-v4.json',import.meta.url),'utf8')),observations=[];
 for(const phase of ['baseline','candidate'])for(const generatorId of ['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'])for(const r of refs)observations.push({id:phase+'/'+generatorId+'/'+r.caseId,generatorId,phase,caseId:r.caseId,familyId:r.familyId,domain:r.domain,stratum:r.stratum,input:r.input,reference:{level:r.level,criterion:r.criterion,sources:r.sources},feedback:null,parentReceiptHash:digest(r.provenance)});
 const panel=compileAiPanel({runId:b.spec.runId,observations,witnesses:b.witnesses,contract});assert.equal(panel.slots.filter(s=>s.kind==='review').length,1440);assert.equal(panel.slots.filter(s=>s.kind==='calibration').length,72);assert.equal(new Set(http.events().map(x=>x.requestId)).size,180);const cleanup=await http.close();http=null;
 const record={passed:true,syntheticOnly:true,referenceSlots:180,authoredSyntheticCases:60,nonselfReviews:120,controlGrades:120,collection:result,state,refs,mainObservationsCompiled:360,mainReviewTemplatesCompiled:1440,mainCalibrationBodiesCompiled:72,mainRequestsDispatched:0,cleanup,actualProviderCalls:0,actualKeyReads:0,actualEnglishQualityMeasured:false,actualIndependentFamiliesEstablished:false,actualReferenceControlsQualified:false,actualInputTokenBoundsMeasured:false,spendingApproved:false};writeFileSync(resolve(root,'reference-full-results.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({passed:true,referenceSlots:180,authoredSyntheticCases:60,mainReviewTemplatesCompiled:1440,actualProviderCalls:0,actualEnglishQualityMeasured:false}));
}finally{try{e?.abandon();}catch{/* Preserve uncertain journal. */}if(http)await http.close();}
