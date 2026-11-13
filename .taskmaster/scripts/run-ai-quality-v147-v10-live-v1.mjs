// One fixed v10 run. Existing grants and source records stay immutable.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { durableEvaluationV3 as save, prepareEvaluationBudgetV3, evaluationBudgetContextV3, openEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { collectGroupedReviewsV4 } from './ai-quality-v147-grouped-review-executor-v4.mjs';
import { parseGroupedProductReviewV2, validateGroupedProductReviewRequestV2 } from './ai-quality-v147-grouped-product-review-v2.mjs';
import { JUDGES, sameGrade } from './ai-quality-v147-calibration.mjs';

export const V10_LIVE_V1 = 'ai-quality-v147-v10-live-v1';
const source = fileURLToPath(new URL('../..', import.meta.url));
const scopeFile = '.taskmaster/docs/ai-quality-v147-v10-live-scope-v1.json';
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const sha = raw => createHash('sha256').update(raw).digest('hex');
const fileSha = f => sha(readFileSync(f));
const check = (ok, code) => { if (!ok) throw Error('V10_' + code); };
const amount = x => { check(typeof x === 'string' && /^(0|[1-9][0-9]*)$/.test(x), 'MONEY'); return BigInt(x); };

export function v10FundingV1(proof, maximum) {
  check(proof.failedCollectorConfirmedStopped && proof.failedCollectorProcessCount === 0 && proof.closedNov8And9RowsUnchanged, 'STOPPED_AND_CLOSED');
  check(proof.formal72DisjointFromPreviouslyClaimed129 && proof.formal72DisjointFromPreviouslyClaimed245
    && proof.completedFormalPhysicalModelCaptures === 72 && proof.formalUnusedEarmark5078796NotReused
    && Array.isArray(proof.formalCountReceiptKeys) && new Set(proof.formalCountReceiptKeys).size === 72, 'FORMAL_SOURCE');
  check(proof.formalCountProvisionMicros === '2520000' && proof.formalModelUpperRetainedMicros === '968388'
    && proof.failedOriginalHeldMicros === '2806936' && proof.failedKnownModelUpperMicros === '139215'
    && proof.failedCountAllowanceRetainedMicros === '630000' && proof.failedUnretainedRequestMaximumMicros === '297867', 'SOURCE_COMPONENTS');
  check(proof.pastUnbilledContingencyRetainedMicros === '1000000' && proof.wordAppUnusedRetainedMicros === '567509'
    && proof.oldUnassigned7816RetainedMicros === '7816' && !proof.prior245Reissued && !proof.original129Reissued && !proof.newGrantCreated, 'PROTECTED');
  const failedHeld = amount(proof.failedKnownModelUpperMicros) + amount(proof.failedCountAllowanceRetainedMicros) + amount(proof.failedUnretainedRequestMaximumMicros);
  const refund = amount(proof.failedOriginalHeldMicros) - failedHeld;
  check(failedHeld === amount(proof.failedReconciledUpperMicros) && refund === amount(proof.failedNeverSentScopeRefundMicros), 'FAILED_RECONCILIATION');
  const first = refund + amount(proof.previousUnassigned129Micros), formal = amount(proof.formalCountProvisionMicros);
  check(first === amount(proof.failedSourceAvailableMicros) && maximum > first && maximum <= first + formal, 'RESERVATION');
  return { maximumMicros: String(maximum), failedReconciledUpperMicros: String(failedHeld), failedRefundMicros: String(refund),
    failedSourceAssignedMicros: String(first), formalSourceAssignedMicros: String(maximum - first),
    formalProvisionUnassignedMicros: String(formal - maximum + first), generalDebitMicros: '0', newGrantCreated: false };
}

export function settleV10FundingV1(funding, used) {
  check(used >= 0n && used <= amount(funding.maximumMicros), 'SETTLEMENT_LIMIT');
  const first = amount(funding.failedSourceAssignedMicros), fromFirst = used < first ? used : first, fromFormal = used - fromFirst;
  const firstUnused = first - fromFirst, formalUnused = amount(funding.formalSourceAssignedMicros) - fromFormal;
  return { ...funding, usedUpperMicros: String(used), failedSourceUsedUpperMicros: String(fromFirst), formalSourceUsedUpperMicros: String(fromFormal),
    failedSourceRestrictedUnusedMicros: String(firstUnused), formalUnusedReturnedToProvisionMicros: String(formalUnused),
    formalCountProvisionRetainedMicros: String(2520000n - fromFormal), conditionalRemainingMicros: String(firstUnused + 567509n),
    automaticReleaseToGeneralLedger: false, invoiceVerified: false, countApiProvenFree: false };
}

export function inspectV10ReviewsV1(plan, records) {
  const votes = [];
  for (const record of records) {
    const r = plan.requests.find(r => r.key === record.key); check(r?.requestSha256 === record.requestSha256, 'REVIEW_BINDING');
    for (const p of parseGroupedProductReviewV2(r, record.payloadRaw)) {
      const w = plan.witnesses.find(w => w.id === p.sourceId), f = w.feedback, changed = f && !!f.correctedSentence && f.correctedSentence !== f.original;
      const expectedAxes = { ...w.expectedEvidenceAxes, repairContext: f === null ? 'unavailable' : changed ? w.expectedEvidenceAxes.learnerContext : 'not_applicable',
        assignmentForm: f === null ? 'unavailable' : changed ? 'not_specified' : 'not_applicable' };
      const a = p.assessment;
      votes.push({ id: w.id, model: p.model, layout: p.layout, ...a, expectedGrade: w.expectedGrade, expectedAxes,
        gradeMatch: sameGrade(a.grade, w.expectedGrade), axesMatch: Object.entries(expectedAxes).every(([k,v]) => a[k] === v),
        missedCriticalFlags: Object.keys(w.expectedGrade.criticalErrors).filter(k => w.expectedGrade.criticalErrors[k] && !a.grade.criticalErrors[k]),
        extraCriticalFlags: Object.keys(w.expectedGrade.criticalErrors).filter(k => !w.expectedGrade.criticalErrors[k] && a.grade.criticalErrors[k]) });
    }
  }
  check(new Set(votes.map(v => v.id + '|' + v.model + '|' + v.layout)).size === votes.length, 'DUPLICATE_VOTE');
  const byModel = JUDGES.map(model => { const rows = votes.filter(v => v.model === model); return { model, available: rows.length,
    matches: rows.filter(v => v.gradeMatch).length, axesMatches: rows.filter(v => v.axesMatch).length,
    criticalMisses: rows.filter(v => v.missedCriticalFlags.length).length, extraCriticalVotes: rows.filter(v => v.extraCriticalFlags.length).length }; });
  return { protocol: V10_LIVE_V1, denominator: 72, available: votes.length, matches: votes.filter(v => v.gradeMatch).length,
    axesMatches: votes.filter(v => v.axesMatch).length, byModel, votes,
    observedCriterionSatisfied: byModel.every(r => r.available === 24 && r.matches >= 22 && r.axesMatches === 24 && r.criticalMisses === 0 && r.extraCriticalVotes === 0),
    sourceQualified: false, formalCalibrationQualification: false, mainDispatchAuthorized: false, englishTruthCertified: false, publicDevelopmentOnly: true };
}

export function claimV10SourcesV1(directory, claim) {
  const names = ['20261112-failed-remainder-reconciliation-once.json', '20261109-formal72-count-reassignment-once.json', 'v10-calibration-once.json'];
  check(names.every(n => !existsSync(resolve(directory,n))), 'SOURCES_ONCE');
  for (const name of names) save(resolve(directory,name), { ...claim, claimRole: name });
}

async function loadKey(root) {
  const f = resolve(root,'.env.local'), s = lstatSync(f);
  check(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && realpathSync(f) === f, 'KEY_PATH');
  const entries = [...readFileSync(f,'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
  check(entries.length === 1, 'KEY'); return entries[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
}
async function send({kind,body,key}) {
  const r = await fetch('https://api.openai.com/v1/responses' + (kind === 'count' ? '/input_tokens' : ''), {
    method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),body,
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'} });
  const chunks=[];let bytes=0;
  for await(const chunk of r.body??[]){bytes+=chunk.length;check(bytes<=262144,'RESPONSE_BYTES');chunks.push(Buffer.from(chunk));}
  return {status:r.status,type:r.headers.get('content-type')??'',raw:Buffer.concat(chunks).toString('utf8')};
}

export async function executeV10LiveV1(scopeHash, keyLoader = loadKey) {
  check(process.version === 'v24.22.1','NODE');
  const scope=read(resolve(source,scopeFile));check(scope.protocol===V10_LIVE_V1 && fileSha(resolve(source,scopeFile))===scopeHash,'SCOPE');
  const root=resolve(scope.dashboardRoot),grant=read(resolve(root,scope.authorizationFile));
  check(realpathSync(root)===root && fileSha(resolve(root,scopeFile))===scopeHash,'ROOT');
  check(grant.currentUserApproved && grant.apiKeyReuseAlreadyApproved && grant.additionalTrancheCapMicros==='35000000'
    && grant.scope==='후속 AI 품질 개선 평가; 기존 US5 실행안과 원장 분리' && !grant.oldClosedApprovalsReactivated,'EXISTING_GRANT');
  check(fileSha(resolve(root,scope.authorizationFile))===scope.authorizationSha256 && scope.authorizationBasis==='existing-additional-budget-authorization','AUTHORIZATION');
  for(const[f,h]of Object.entries(scope.executionSha256))check(fileSha(resolve(root,f))===h && fileSha(resolve(source,f))===h,'CODE_PIN');
  const proof=read(resolve(root,scope.fundingProofFile));check(fileSha(resolve(root,scope.fundingProofFile))===scope.fundingProofSha256,'FUNDING_PIN');
  for(const[f,h]of Object.entries(proof.evidenceSha256))check(fileSha(resolve(root,f))===h,'EVIDENCE_PIN');
  const funding=v10FundingV1(proof,amount(scope.limits.maximumMicros)),plan=read(resolve(root,scope.planFile));
  check(fileSha(resolve(root,scope.planFile))===scope.planSha256 && fileSha(resolve(source,scope.planFile))===scope.planSha256,'PLAN');
  check(plan.requests.length===18 && plan.logicalSlots===72 && scope.limits.requests===18 && scope.limits.judgments===72 && scope.limits.maximumInputTokens===10000,'LIMITS');
  plan.requests.forEach(validateGroupedProductReviewRequestV2);
  const prepared=prepareEvaluationBudgetV3(source),context=evaluationBudgetContextV3(prepared,'evaluation'),session=openEvaluationBudgetV3({prepared,context});
  try {
    const view=session.current();check(view.availableMicros==='0' && view.reservedMicros==='0' && fileSha(resolve(root,scope.ledgerFile))===scope.beforeLedgerSha256,'LEDGER');
    const runtime=resolve(root,'outputs',scope.runtimeDirectoryName);check(!existsSync(runtime),'RUNTIME_ONCE');
    claimV10SourcesV1(context.directory,{protocol:V10_LIVE_V1,scopeHash,fundingProofSha256:scope.fundingProofSha256,...funding,originalFiveDollarReopened:false,prior245Reissued:false,original129Reissued:false});
    mkdirSync(runtime);
    const t=await collectGroupedReviewsV4({plan,directory:runtime,limits:scope.limits,mode:'evaluation',loadKey:()=>keyLoader(root),transport:send,
      binding:{planHash:scopeHash,collectorPlanHash:scope.planSha256,fundingProtocol:V10_LIVE_V1,generalLedgerDebitMicros:'0'},onProgress:e=>console.log(JSON.stringify(e))});
    save(resolve(runtime,'funding-settlement.json'),{protocol:V10_LIVE_V1,scopeHash,terminalSha256:fileSha(resolve(runtime,'terminal.json')),
      fundingProofSha256:scope.fundingProofSha256,...settleV10FundingV1(funding,amount(t.combinedUsedUpperMicros)),
      generalLedgerUnchanged:fileSha(resolve(root,scope.ledgerFile))===scope.beforeLedgerSha256});
    save(resolve(runtime,'v10-review-results.json'),inspectV10ReviewsV1(plan,t.records));return t;
  }finally{session.release();}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    check(process.argv.length===4 && process.argv[2]==='--execute-authorized-v10','EXPLICIT_MODE');
    const t=await executeV10LiveV1(process.argv[3]);
    console.log(JSON.stringify({status:t.status,failureCode:t.failureCode,actualProviderCalls:t.actualProviderCalls,actualCountCalls:t.actualCountCalls,judgments:t.logicalJudgments,usedUpperMicros:t.combinedUsedUpperMicros}));
    if(t.failureCode)process.exitCode=2;
  }catch(e){console.error(/^(?:V10|GRV4|EV3)_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'V10_LOCAL_HELD');process.exitCode=1;}
}
