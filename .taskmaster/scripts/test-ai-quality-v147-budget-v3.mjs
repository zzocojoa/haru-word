import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileBudgetV3,validateSpecV3,v3SlotKey,MODELS_V3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3BudgetFixture,v3SyntheticApproval,v3SyntheticBinding,v3SyntheticResult} from './ai-quality-v147-budget-v3-fixture.mjs';
const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),clone=structuredClone;
const setup=(stage='reference-preparation',amount)=>{const spec=v3BudgetFixture({stage}),kernel=compileBudgetV3(spec),approval=v3SyntheticApproval(kernel,amount);return {spec,kernel,approval,ledger:kernel.newLedger(approval)};};
const observations={actualProviderCalls:0,actualKeyReads:0,newPaidApprovalUsd:0,realDispatchSupported:false,durableStoreImplemented:false,actualWireEqualityVerified:false,actualTokenBoundVerified:false,modelQualityMeasured:false,calibrationGradeGateImplemented:false};
function apply(context,operation){context.ledger=context.kernel.transition(context.ledger,operation);context.trace?.push(clone(operation));return context.ledger;}
function reserveAll(c){for(const groupId of c.kernel.groupIds)apply(c,{kind:'reserve',groupId});}
function settle(c,key,options){apply(c,{kind:'bind',key,binding:v3SyntheticBinding(c.kernel,c.ledger,key)});apply(c,{kind:'consume',key});apply(c,{kind:'settle',key,result:v3SyntheticResult(c.kernel,c.ledger,key,options)});}
function calibration(c){for(const groupId of c.kernel.groupIds.filter(g=>g.startsWith('calibration/')))apply(c,{kind:'reserve',groupId});for(const d of c.kernel.spec.requests.filter(d=>d.role==='calibration'))settle(c,d.key);}
function rekey(spec){for(const d of spec.requests)d.key=v3SlotKey(d);spec.order=spec.requests.map(d=>d.key);}
test('reference180 and main1872 are separate stages;combined2052 is a draft count only',()=>{
 const a=v3BudgetFixture({stage:'reference-preparation',caseCount:60}),b=v3BudgetFixture({caseCount:60});assert.deepEqual(validateSpecV3(a),{referenceDraft:60,referenceReview:120,generation:0,review:0,calibration:0});assert.deepEqual(validateSpecV3(b),{referenceDraft:0,referenceReview:0,generation:360,review:1440,calibration:72});assert.equal(a.requests.length+b.requests.length,2052);observations.stageRoles={referencePreparation:180,pilotPanel:1872,combinedDraft:2052,approvalCap:false};
});
test('old protocol/spec/approval and cross-stage approvals cannot initialize v3',()=>{
 const a=setup(),b=compileBudgetV3(v3BudgetFixture());assert.throws(()=>b.newLedger(a.approval),/P3_APPROVAL_BINDING/);const old=clone(a.spec);old.protocol='ai-quality-v147-pilot-v2';assert.throws(()=>compileBudgetV3(old),/P3_SPEC_IDENTITY/);const c=compileBudgetV3(a.spec),approval=clone(a.approval);approval.protocol='ai-quality-v147-pilot-v1';assert.throws(()=>c.newLedger(approval),/P3_APPROVAL_BINDING/);
});
test('unapproved0 refuses whole-group reservation before any harness dispatch',()=>{
 const spec=v3BudgetFixture({stage:'reference-preparation'});spec.mode='evaluation';spec.quote.kind='verified-price';const k=compileBudgetV3(spec),approval={...v3SyntheticApproval(k,'0'),kind:'unapproved',evidenceHash:null},ledger=k.newLedger(approval);let hypotheticalKeyReads=0;
 assert.throws(()=>{k.transition(ledger,{kind:'reserve',groupId:k.groupIds[0]});hypotheticalKeyReads++;},/P3_DISPATCH_HELD/);assert.equal(hypotheticalKeyReads,0);assert.equal(k.account(ledger).realDispatchAuthorized,false);assert.equal(k.approvalEvidenceAuthenticated,false);
});
test('reservation is atomic for draft+2reviews or generation+4reviews',()=>{
 for(const stage of ['reference-preparation','pilot-panel']){const spec=v3BudgetFixture({stage}),k=compileBudgetV3(spec),g=k.groupIds.find(g=>!g.startsWith('calibration/')),keys=spec.requests.filter(d=>(stage==='reference-preparation'?d.caseId==='fixture-case-1':d.phase==='baseline'&&d.generatorId===MODELS_V3[0]));const cost=keys.reduce((n,d)=>n+BigInt(k.maximumCost(d.key)),0n),approval=v3SyntheticApproval(k,(cost-1n).toString()),l=k.newLedger(approval);assert.throws(()=>k.transition(l,{kind:'reserve',groupId:g}),/P3_WHOLE_GROUP_BUDGET/);assert.equal(k.current(),l);assert.equal(k.account(l).slots,0);}
 const c=setup();apply(c,{kind:'reserve',groupId:c.kernel.groupIds[0]});assert.equal(c.kernel.account(c.ledger).slots,3);assert.throws(()=>apply(c,{kind:'reserve',groupId:c.kernel.groupIds[0]}),/P3_DUPLICATE_RESERVATION/);
});
test('all declared cases need one draft;duplicating another author cannot replace a missing case',()=>{
 const s=v3BudgetFixture({stage:'reference-preparation',caseCount:2}),parent=s.requests[3];parent.caseId='fixture-case-1';parent.generatorId=MODELS_V3[0];parent.modelId=MODELS_V3[0];parent.key=v3SlotKey(parent);for(const [i,m]of [MODELS_V3[1],MODELS_V3[2]].entries()){const d=s.requests[4+i];d.caseId=parent.caseId;d.generatorId=parent.generatorId;d.modelId=m;d.parentKey=parent.key;}rekey(s);assert.throws(()=>validateSpecV3(s),/P3_DRAFT_COVERAGE/);
});
test('self-judge,wrong layout,parent or incomplete role coverage fails spec validation',()=>{
 for(const change of [s=>{s.requests.find(d=>d.role==='review').modelId=MODELS_V3[0];rekey(s);},s=>{s.requests.find(d=>d.role==='review').layout='single';rekey(s);},s=>{s.requests.find(d=>d.role==='review').parentKey='other';},s=>{s.requests.pop();s.order.pop();}]){const s=v3BudgetFixture();change(s);assert.throws(()=>validateSpecV3(s),/^Error: P3_/);}
});
test('generation cannot consume until all72 calibration captures complete',()=>{
 const c=setup('pilot-panel'),d=c.spec.requests.find(d=>d.role==='generation'),g=c.kernel.groupIds.find(g=>g.startsWith('baseline/'));apply(c,{kind:'reserve',groupId:g});apply(c,{kind:'bind',key:d.key,binding:v3SyntheticBinding(c.kernel,c.ledger,d.key)});assert.throws(()=>apply(c,{kind:'consume',key:d.key}),/P3_CALIBRATION_INCOMPLETE/);calibration(c);apply(c,{kind:'consume',key:d.key});assert.equal(c.ledger.slots[d.key].state,'consumed');assert.equal(c.kernel.calibrationGradeGateImplemented,false);
});
test('derived review binding needs the exact completed parent receipt and template',()=>{
 const c=setup();reserveAll(c);const [parent,child]=c.spec.requests;const dummy={bodySha256:digest('body'),recipeHash:child.bodyHash,parentKey:child.parentKey,parentRequestId:c.kernel.requestId(parent.key),parentReceiptHash:digest('wrong'),parentOutputHash:digest('wrong')};assert.throws(()=>apply(c,{kind:'bind',key:child.key,binding:dummy}),/P3_DERIVED_PARENT/);settle(c,parent.key);
 const good=v3SyntheticBinding(c.kernel,c.ledger,child.key);for(const field of ['recipeHash','parentRequestId','parentReceiptHash','parentOutputHash'])assert.throws(()=>apply(c,{kind:'bind',key:child.key,binding:{...good,[field]:digest('other')}}),/P3_DERIVED_PARENT/);apply(c,{kind:'bind',key:child.key,binding:good});assert.throws(()=>apply(c,{kind:'bind',key:child.key,binding:{...good,bodySha256:digest('new body')}}),/P3_REBIND/);
});
test('static body substitution and unbound consumption are refused',()=>{
 const c=setup();reserveAll(c);const d=c.spec.requests[0];assert.throws(()=>apply(c,{kind:'consume',key:d.key}),/P3_UNSENT_BOUND_SLOT/);const b=v3SyntheticBinding(c.kernel,c.ledger,d.key);b.bodySha256=digest('other');assert.throws(()=>apply(c,{kind:'bind',key:d.key,binding:b}),/P3_STATIC_BODY/);
});
test('request IDs change with any frozen source/quote change and do not cross stages',()=>{
 const s=v3BudgetFixture({stage:'reference-preparation'}),a=compileBudgetV3(s);for(const change of [v=>{v.sourceSeal=digest('other source');},v=>{v.quote.models[MODELS_V3[0]].inputMicrosPerMillion='2000000';},v=>{v.requests[0].bodyHash=digest('other body');}]){const v=clone(s);change(v);const b=compileBudgetV3(v);assert.notEqual(a.requestId(s.requests[0].key),b.requestId(s.requests[0].key));const approval=v3SyntheticApproval(a);assert.throws(()=>b.newLedger(approval),/P3_APPROVAL_BINDING/);}
});
test('compiled source and immutable states resist caller mutation and stale head forks',()=>{
 const c=setup(),h=c.kernel.specHash;c.spec.sourceSeal=digest('changed caller input');assert.equal(c.kernel.specHash,h);assert.ok(Object.isFrozen(c.kernel.spec.requests[0]));const old=c.ledger;reserveAll(c);assert.throws(()=>c.kernel.transition(old,{kind:'close'}),/P3_STALE_HEAD/);assert.throws(()=>c.kernel.transition(clone(c.ledger),{kind:'close'}),/P3_STATE_REPLAY_REQUIRED/);assert.throws(()=>c.kernel.newLedger(c.approval),/P3_ALREADY_INITIALIZED/);assert.equal(c.kernel.audit(c.ledger).slots,3);
});
test('consumed cannot be sent again and settled result cannot be replaced',()=>{
 const c=setup();reserveAll(c);const d=c.spec.requests[0];settle(c,d.key);assert.throws(()=>apply(c,{kind:'consume',key:d.key}),/P3_UNSENT_BOUND_SLOT/);assert.throws(()=>apply(c,{kind:'settle',key:d.key,result:v3SyntheticResult(c.kernel,c.ledger,d.key)}),/P3_RESULT_BINDING/);
});
test('failed/unknown or missing usage retains maximum reservation,even ifreported zero',()=>{
 for(const state of ['failed','unknown','completed']){const c=setup();reserveAll(c);const d=c.spec.requests[0],before=BigInt(c.kernel.account(c.ledger).upperMicros);settle(c,d.key,{state,usage:state==='completed'?null:{inputTokens:0,outputTokens:0}});assert.equal(BigInt(c.kernel.account(c.ledger).upperMicros),before);assert.equal(c.kernel.account(c.ledger).knownUsageSlots,0);}
});
test('usage overflow holds and retains the greater observed cost,not only old reservation',()=>{
 const c=setup();reserveAll(c);const d=c.spec.requests[0],before=BigInt(c.kernel.account(c.ledger).upperMicros),maximum=BigInt(c.kernel.maximumCost(d.key)),usage={inputTokens:100000,outputTokens:100000};settle(c,d.key,{usage});const a=c.kernel.audit(c.ledger);assert.equal(a.hold,'USAGE_BOUND');assert.equal(BigInt(a.upperMicros),before-maximum+BigInt(c.kernel.cost(d.key,usage)));assert.throws(()=>apply(c,{kind:'consume',key:c.spec.requests[1].key}),/P3_DISPATCH_HELD/);observations.overflowCostNotUnderstated=true;
});
test('approval reduction holds;raising it later does not silently resume',()=>{
 const c=setup();reserveAll(c);apply(c,{kind:'approval',approval:{...c.approval,amountMicros:'0'}});assert.equal(c.kernel.account(c.ledger).hold,'AUTHORIZATION_REDUCED');apply(c,{kind:'approval',approval:c.approval});assert.equal(c.kernel.account(c.ledger).hold,'AUTHORIZATION_REDUCED');assert.throws(()=>apply(c,{kind:'bind',key:c.spec.requests[0].key,binding:v3SyntheticBinding(c.kernel,c.ledger,c.spec.requests[0].key)}),/P3_DISPATCH_HELD/);
});
test('close releases only unsent slots;consumed capture may settle without reopening',()=>{
 const c=setup();reserveAll(c);const d=c.spec.requests[0];apply(c,{kind:'bind',key:d.key,binding:v3SyntheticBinding(c.kernel,c.ledger,d.key)});apply(c,{kind:'consume',key:d.key});apply(c,{kind:'close'});assert.equal(c.kernel.audit(c.ledger).upperMicros,c.kernel.maximumCost(d.key));assert.throws(()=>apply(c,{kind:'reserve',groupId:c.kernel.groupIds[0]}),/P3_DISPATCH_HELD/);assert.throws(()=>apply(c,{kind:'approval',approval:c.approval}),/P3_APPROVAL_CLOSED/);apply(c,{kind:'settle',key:d.key,result:v3SyntheticResult(c.kernel,c.ledger,d.key)});assert.equal(c.ledger.closed,true);assert.equal(c.kernel.audit(c.ledger).upperMicros,'40');assert.equal(c.kernel.audit(c.ledger).consumedSlots,1);
});
test('result identity/capture binding and invalid money/price fields are rejected',()=>{
 const c=setup();reserveAll(c);const d=c.spec.requests[0];apply(c,{kind:'bind',key:d.key,binding:v3SyntheticBinding(c.kernel,c.ledger,d.key)});apply(c,{kind:'consume',key:d.key});const result=v3SyntheticResult(c.kernel,c.ledger,d.key);for(const k of ['specHash','requestId','modelId','bodySha256'])assert.throws(()=>apply(c,{kind:'settle',key:d.key,result:{...result,[k]:'wrong'}}),/P3_RESULT_BINDING/);assert.throws(()=>apply(c,{kind:'settle',key:d.key,result:{...result,captureHash:null}}),/P3_COMPLETION_CAPTURE/);
 for(const change of [s=>{s.quote.regionalNumerator='0';},s=>{s.quote.inputFactorNumerator='0.5';},s=>{s.quote.models[MODELS_V3[0]].outputMicrosPerMillion='-1';},s=>{s.requests[0].inputTokenMax=Number.POSITIVE_INFINITY;}]){const s=v3BudgetFixture();change(s);assert.throws(()=>compileBudgetV3(s),/^Error: P3_/);}
});
test('integer microUSD ceilings agree with120 independent Python Fraction references',()=>{
 const vectors=JSON.parse(readFileSync(resolve(SOURCE,'.taskmaster/evaluation/ai-quality-v147/v3-cost-reference-vectors.json'),'utf8')).vectors;assert.equal(vectors.length,120);
 for(const v of vectors){const s=v3BudgetFixture({stage:'reference-preparation'}),d=s.requests[0],q=s.quote;for(const k of ['regionalNumerator','regionalDenominator','inputFactorNumerator','inputFactorDenominator'])q[k]=v[k];q.models[d.modelId]={inputMicrosPerMillion:v.inputMicrosPerMillion,outputMicrosPerMillion:v.outputMicrosPerMillion};const c=compileBudgetV3(s);assert.equal(c.cost(d.key,{inputTokens:v.inputTokens,outputTokens:v.outputTokens}),v.expectedMicros,'reference '+v.id);}
 observations.independentFractionReferences=120;
});
test('full staged2052 synthetic transitions,replay,audit and close remain separate',()=>{
 const results=[];for(const stage of ['reference-preparation','pilot-panel']){
  const started=performance.now(),spec=v3BudgetFixture({stage,caseCount:60}),kernel=compileBudgetV3(spec),approval=v3SyntheticApproval(kernel),c={kernel,ledger:kernel.newLedger(approval),trace:[]};reserveAll(c);for(const key of spec.order)settle(c,key);apply(c,{kind:'close'});const account=kernel.audit(c.ledger);assert.equal(account.slots,spec.requests.length);assert.equal(account.consumedSlots,spec.requests.length);assert.equal(account.knownUsageSlots,spec.requests.length);assert.equal(account.closed,true);assert.equal(account.upperMicros,String(spec.requests.length*40));assert.equal(account.realDispatchAuthorized,false);
  const other=compileBudgetV3(spec);let replay=other.newLedger(approval);for(const operation of c.trace)replay=other.transition(replay,operation);assert.equal(digest(replay),digest(c.ledger));assert.deepEqual(other.audit(replay),account);assert.notEqual(other.current(),c.ledger);
  results.push({stage,slots:account.slots,counts:account.counts,closed:account.closed,knownUsageSlots:account.knownUsageSlots,operationCount:c.trace.length,finalLedgerHash:digest(c.ledger),syntheticUpperMicros:account.upperMicros,elapsedMs:Math.round(performance.now()-started)});
 }
 assert.equal(results.reduce((n,x)=>n+x.slots,0),2052);observations.fullStages=results;
});
test.after(()=>{if(process.env.QA_OUTPUT_DIR){mkdirSync(process.env.QA_OUTPUT_DIR,{recursive:true});writeFileSync(resolve(process.env.QA_OUTPUT_DIR,'budget-v3-observations.json'),JSON.stringify(observations,null,2)+'\n');}});
