import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sentenceFeedbackSchema} from '../lib/sentence-feedback.ts';
import {blindAttempt} from '../scripts/evaluate-english-accuracy.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),report=read('data/evaluations/english-accuracy-2026-10-01-chunked-free.json');
const cases=read('tests/fixtures/english-accuracy.json').cases,baseline=read('data/evaluations/english-accuracy-2026-09-30.json'),last=read('data/evaluations/english-accuracy-2026-10-01-original-first.json');
const dims=['meaning','grammar','correction','structure'],count=(rows,fn)=>rows.filter(fn).length,hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('free pilot preserves parents and accounts separately for attempted versus stopped planned cases',()=>{
 assert.equal(report.fixtureHash,last.fixtureHash);assert.equal(report.fixtureContentHash,last.fixtureContentHash);assert.deepEqual(report.parentLedgerHashes,{first240:last.previousLedgerHash,originalFirst120:last.ledgerHash});
 assert.equal(report.comparison,'chunked-free-v1');assert.equal(report.sourceCommit,'718870e21b453c484387814f879ed7685bfd3048');assert.equal(report.freeTierConfirmation,'human-user');assert.equal(report.billingConsoleInspected,false);
 assert.equal(report.previousCalls,360);assert.equal(report.maxCalls,480);assert.equal(report.approvedCalls,120);assert.equal(report.totalCalls,360+report.calls);assert.ok(report.calls<=120);assert.equal(report.retries,0);assert.equal(report.fallback,false);
 assert.equal(report.rows.length,120);assert.equal(new Set(report.rows.map(r=>r.provider+':'+r.caseId)).size,120);assert.equal(count(report.rows,r=>r.status!=='not_attempted'),report.calls);
 for(const provider of ['google','groq'])assert.deepEqual(report.rows.filter(r=>r.provider===provider).map(r=>r.caseId).sort(),cases.map(c=>c.id).sort());
 for(const h of [report.ledgerHash,report.blindHash,report.previousLedgerHash,...Object.values(report.promptHashes),...Object.values(report.requestHashes)])assert.match(h,/^[a-f0-9]{64}$/);
 const blinded=report.rows.filter(r=>r.label).sort((a,b)=>a.label.localeCompare(b.label)).map(r=>{const b=blindAttempt(r);b.label=r.label;delete b.number;return b;});assert.equal(hash(blinded),report.blindHash);
});
test('valid authored feedback alone receives language judgments; unavailable rows never count as passing',()=>{
 const allowed=new Set(['label','caseId','provider','model','status','httpStatus','providerStatus','code','stopCode','validationStage','diagnostic','dimensions','overall','criticalErrors','reason','designatedCritical','feedback']);
 for(const r of report.rows){
  assert.ok(Object.keys(r).every(k=>allowed.has(k)));const c=cases.find(c=>c.id===r.caseId);assert.ok(c&&r.reason.trim());assert.equal(r.designatedCritical,Object.values(c.expected.critical).some(Boolean));assert.equal(r.model,report.summaries[r.provider].model);
  assert.ok(r.criticalErrors.every(k=>['approveBadGrammar','reverseMeaning','swapRoles'].includes(k)&&c.expected.critical[k]));if(r.criticalErrors.length)assert.equal(r.overall,'fail');
  if(r.status==='response'){
   assert.equal(r.httpStatus,200);assert.ok(sentenceFeedbackSchema.safeParse(r.feedback).success);assert.equal(r.feedback.original,c.sentence);assert.equal(r.feedback.model,r.model);assert.ok(dims.every(d=>['pass','fail'].includes(r.dimensions[d])));assert.equal(r.overall,dims.some(d=>r.dimensions[d]==='fail')?'fail':'pass');
   for(const [field,d] of [['meaningUsage','meaning'],['grammar','grammar']])if(!c.expected[field].includes(r.feedback[field]))assert.equal(r.dimensions[d],'fail');
   if(c.expected.critical.approveBadGrammar&&r.feedback.grammar==='natural')assert.ok(r.criticalErrors.includes('approveBadGrammar'));
  }else{
   assert.ok(['failure','started','not_attempted'].includes(r.status));assert.equal(r.feedback,undefined);assert.equal(r.overall,'unavailable');assert.ok(dims.every(d=>r.dimensions[d]==='unavailable'));assert.equal(r.criticalErrors.length,0);
   if(r.status==='not_attempted'){assert.equal(r.label,undefined);assert.equal(r.code,'provider_stopped');assert.equal(r.stopCode,report.providerStops[r.provider]);}
   if(r.diagnostic)assert.ok(['free_tier_region','wire_fields','chunk_count'].includes(r.diagnostic));
   if(r.validationStage)assert.ok(['content_type','content_limit','json_syntax','fields','structure','judgment','model','envelope'].includes(r.validationStage));
  }
 }
});
test('dimension, critical and publication totals recompute from full60 denominators',()=>{
 for(const provider of ['google','groq']){
  const rows=report.rows.filter(r=>r.provider===provider),s=report.summaries[provider];
  assert.equal(s.planned,60);assert.equal(s.attempts,count(rows,r=>r.status!=='not_attempted'));assert.equal(s.notAttempted,count(rows,r=>r.status==='not_attempted'));assert.equal(s.validResponses,count(rows,r=>r.status==='response'));assert.equal(s.requestOrOutputFailures,count(rows,r=>['failure','started'].includes(r.status)));assert.equal(s.unavailable,60-s.validResponses);
  assert.equal(s.overallPass,count(rows,r=>r.overall==='pass'));assert.equal(s.languageFail,count(rows,r=>r.overall==='fail'));assert.equal(s.overallPass+s.languageFail+s.unavailable,60);assert.equal(s.baselinePass,baseline.summaries[provider].overallPass);
  for(const d of dims)for(const v of ['pass','fail','unavailable'])assert.equal(s.dimensions[d][v],count(rows,r=>r.dimensions[d]===v));
  assert.equal(s.critical.designated,32);assert.equal(s.critical.available,count(rows,r=>r.designatedCritical&&r.status==='response'));assert.equal(s.critical.unavailable,32-s.critical.available);assert.equal(s.critical.failedCases,count(rows,r=>r.criticalErrors.length));for(const k of Object.keys(s.critical.errors))assert.equal(s.critical.errors[k],count(rows,r=>r.criticalErrors.includes(k)));
  assert.deepEqual(s.checks,{atLeast54:s.overallPass>=54,noDesignatedCriticalErrors:s.critical.failedCases===0,allDesignatedCriticalAssessable:s.critical.unavailable===0,noDecreaseFromBaseline:s.overallPass>=s.baselinePass});assert.equal(s.gatePassed,Object.values(s.checks).every(Boolean));
 }
 assert.equal(report.publication.gatePassed,Object.values(report.summaries).every(s=>s.gatePassed));assert.ok(!report.publication.promptPublished||report.publication.gatePassed);
});
test('temporary evaluation is closed without changing plans, persisted schema or existing v3 support',()=>{
 assert.equal(report.temporaryEndpoint.keysRemoved,true);assert.equal(report.temporaryEndpoint.expiredProbe.status,404);assert.equal(report.temporaryEndpoint.finalProbe.status,404);assert.equal(report.temporaryEndpoint.finalProbe.code,'evaluation_disabled');assert.equal(report.temporaryEndpoint.providerCallsForCleanup,0);
 assert.equal(report.validationPolicy,'chunk-count-v1+original-judgment-v1');assert.equal(report.review.providerAndModelHiddenUntilAdjudication,true);assert.ok(report.review.checkedReferences.length);
});
