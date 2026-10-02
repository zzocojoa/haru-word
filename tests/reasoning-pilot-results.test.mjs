import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => JSON.parse(readFileSync(path,'utf8'));
const result=read('data/evaluations/english-accuracy-2026-10-02-reasoning-pilot.json');
const plan=read('data/evaluations/reasoning-pilot-plan.json');
const transition=read('data/evaluations/reasoning-pilot-source-transition.json');
test('actual20 fixed reasoning slots preserve prior806, model and prompt/request identities',()=>{
  assert.equal(result.previousCalls,806);assert.equal(result.actualConsumedSlots,20);assert.equal(result.totalCalls,826);assert.equal(result.notAttempted,0);
  assert.equal(result.rows.length,20);assert.equal(new Set(result.rows.map(r=>`${r.caseId}/${r.provider}/${r.variant}`)).size,20);
  assert.deepEqual(result.models,plan.models);assert.equal(result.planHash,createHash('sha256').update(JSON.stringify(plan)).digest('hex'));
  for(const row of result.rows){assert.ok(plan.caseIds.includes(row.caseId));assert.ok(plan.providers.includes(row.provider));assert.ok(plan.variants.includes(row.variant));assert.match(row.requestHash,/^[a-f0-9]{64}$/);assert.match(row.promptHash,/^[a-f0-9]{64}$/);assert.equal('feedback' in row,false);}
  for(const provider of plan.providers)for(const caseId of plan.caseIds){const rows=result.rows.filter(r=>r.provider===provider&&r.caseId===caseId);assert.equal(rows.length,2);assert.equal(rows[0].promptHash,rows[1].promptHash);assert.notEqual(rows[0].requestHash,rows[1].requestHash);}
});
test('four condition summaries derive from actual rows and distinguish rejection from English errors',()=>{
  for(const provider of plan.providers)for(const variant of plan.variants){
    const rows=result.rows.filter(r=>r.provider===provider&&r.variant===variant),summary=result.conditions[`${provider}/${variant}`];
    assert.equal(summary.attempted,rows.length);assert.equal(summary.validResponses,rows.filter(r=>r.status==='response').length);assert.equal(summary.passes,rows.filter(r=>r.pass).length);
    assert.equal(summary.languageFailures,rows.filter(r=>r.status==='response'&&!r.pass).length);assert.equal(summary.nonLanguageFailures,rows.filter(r=>r.status!=='response').length);
    for(const row of rows){if(row.status!=='response'){assert.equal(row.pass,false);assert.ok(Object.values(row.dimensions).every(v=>v==='unavailable'));assert.equal(row.validationStage,'structure');}else assert.equal(row.pass,Object.values(row.dimensions).every(v=>v==='pass')&&row.criticalErrors.length===0);}
    for(const [key,usage] of Object.entries(summary.usage)){const reported=rows.filter(r=>Number.isInteger(r.usage[key]));assert.equal(usage.reportedRows,reported.length);assert.equal(usage.totalReported,reported.reduce((sum,r)=>sum+r.usage[key],0));}
  }
  assert.equal(result.rows.filter(r=>r.pass).length,6);assert.equal(result.rows.filter(r=>r.status==='response'&&!r.pass).length,3);assert.equal(result.rows.filter(r=>r.status!=='response').length,11);
  assert.equal(result.pairs.filter(p=>p.outcome==='high_better').length,1);assert.equal(result.pairs.filter(p=>p.outcome==='same').length,1);assert.equal(result.pairs.filter(p=>p.outcome==='language_comparison_unavailable').length,8);
});
test('real same-token closure and byte-identical evaluation sources preserve concurrent card publication',()=>{
  assert.equal(result.closure.evaluationKeys,0);assert.equal(result.closure.sameNonEvaluationEnvironment,true);assert.equal(result.closure.sameAccessPolicy,true);assert.equal(result.closure.sameEvaluationSource,true);
  for(const probe of [result.closure.expiredProbe,result.closure.removedProbe]){assert.equal(probe.status,404);assert.equal(probe.code,'evaluation_disabled');assert.equal(probe.providerCalls,0);}
  assert.ok(Date.parse(result.closure.expiredProbe.at)<Date.parse(result.closure.removedProbe.at));assert.ok(Date.parse(result.closure.removedProbe.at)<=Date.parse(result.reviewedAt));
  assert.equal(transition.previous,result.sourceCommit);assert.equal(transition.current,result.closure.liveSourceCommit);assert.equal(transition.versionId,result.closure.versionId);assert.equal(transition.version,104);
  assert.equal(transition.trees.length,8);assert.ok(transition.trees.every(t=>t.previous===t.current&&/^[a-f0-9]{40}$/.test(t.previous)));
  assert.deepEqual(transition.trees.map(t=>t.path),['lib','app/api/english-accuracy-evaluation','tests/fixtures/english-accuracy.json','data/evaluations/reasoning-pilot-plan.json','scripts/evaluate-reasoning-pilot.mjs','package.json','package-lock.json','.openai/hosting.json']);
  assert.equal(result.promotion.enabled,false);assert.equal(result.noRetry,true);assert.equal(result.noFallback,true);assert.equal('feedback' in result.rows[0],false);
});
