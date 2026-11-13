import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { durableEvaluationV3 as save, prepareEvaluationBudgetV3, evaluationBudgetContextV3, openEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { collectGroupedReviewsV2 } from './ai-quality-v147-grouped-review-executor-v2.mjs';
import { validateGroupedProductReviewRequestV1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { CALIBRATION_REMAINDER_V1, inspectCalibrationRemainderV1 } from './ai-quality-v147-calibration-remainder-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const sha = raw => createHash('sha256').update(raw).digest('hex');
const fileSha = f => sha(readFileSync(f));
const check = (ok, code) => { if (!ok) throw Error('CRM1_' + code); };
const scopeFile = '.taskmaster/docs/ai-quality-v147-calibration-remainder-scope-v1.json';

export function calibrationRemainderFundingV1(parent, maximum) {
  check(parent.protocol === 'ai-quality-v147-bilingual-negative-controls-v1' && parent.assignedMaximumMicros === '1899480'
    && parent.usedUpperMicros === '924902' && parent.restrictedUnusedMicros === '974578'
    && parent.unassignedProvisionHeldMicros === '1871513' && parent.generalLedgerUnchanged === true, 'PARENT_FUNDS');
  check(BigInt(parent.usedUpperMicros) + BigInt(parent.restrictedUnusedMicros) === BigInt(parent.assignedMaximumMicros), 'PARENT_SUM');
  const available = BigInt(parent.restrictedUnusedMicros) + BigInt(parent.unassignedProvisionHeldMicros);
  check(maximum >= BigInt(parent.restrictedUnusedMicros) && maximum <= available, 'CAP');
  return { sourceRemainderMicros: String(available), assignedMaximumMicros: String(maximum),
    previousConditionalUnusedConsumedMicros: parent.restrictedUnusedMicros,
    additionalProvisionEarmarkedMicros: String(maximum - BigInt(parent.restrictedUnusedMicros)),
    unassignedProvisionHeldMicros: String(available - maximum), generalDebitMicros: '0', newGrantCreated: false };
}

function loadKey(root) {
  const f = resolve(root, '.env.local'), s = lstatSync(f);
  check(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && realpathSync(f) === f, 'KEY_PATH');
  const values = [...readFileSync(f, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
  check(values.length === 1, 'KEY'); return values[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
}

async function send({ kind, body, key }) {
  const r = await fetch('https://api.openai.com/v1/responses' + (kind === 'count' ? '/input_tokens' : ''), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000), body,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' } });
  const chunks = []; let bytes = 0;
  for await (const chunk of r.body ?? []) { bytes += chunk.length; check(bytes <= 262144, 'RESPONSE_BYTES'); chunks.push(Buffer.from(chunk)); }
  return { status: r.status, type: r.headers.get('content-type') ?? '', raw: Buffer.concat(chunks).toString('utf8') };
}

export async function executeCalibrationRemainderV1(scopeHash) {
  check(process.version === 'v24.22.1', 'NODE');
  const scope = read(resolve(source, scopeFile));
  check(scope.protocol === CALIBRATION_REMAINDER_V1 && fileSha(resolve(source, scopeFile)) === scopeHash, 'SCOPE');
  const root = resolve(scope.dashboardRoot), grant = read(resolve(root, scope.authorizationFile));
  check(grant.currentUserApproved && grant.apiKeyReuseAlreadyApproved && grant.additionalTrancheCapMicros === '35000000'
    && grant.scope === '후속 AI 품질 개선 평가; 기존 US5 실행안과 원장 분리' && !grant.oldClosedApprovalsReactivated, 'EXISTING_GRANT');
  check(scope.authorizationBasis === 'existing-additional-budget-authorization' && fileSha(resolve(root, scope.authorizationFile)) === scope.authorizationSha256, 'AUTHORIZATION');
  check(realpathSync(root) === root && fileSha(resolve(root, scopeFile)) === scopeHash, 'ROOT');
  for (const [f, h] of Object.entries(scope.executionSha256)) check(fileSha(resolve(root, f)) === h && fileSha(resolve(source, f)) === h, 'CODE_PIN');
  for (const [f, h] of Object.entries(scope.evidenceSha256)) check(fileSha(resolve(root, f)) === h, 'EVIDENCE_PIN');
  const parent = read(resolve(root, scope.parentSettlementFile)), funding = calibrationRemainderFundingV1(parent, BigInt(scope.limits.maximumMicros));
  const plan = read(resolve(root, scope.planFile));
  check(fileSha(resolve(root, scope.planFile)) === scope.planSha256 && fileSha(resolve(source, scope.planFile)) === scope.planSha256, 'PLAN');
  check(plan.requests.length === 18 && plan.logicalSlots === 48 && scope.limits.requests === 18
    && scope.limits.judgments === 48 && scope.limits.maximumInputTokens === 7500, 'LIMITS');
  plan.requests.forEach(validateGroupedProductReviewRequestV1);
  const negativeVotes = read(resolve(root, scope.previousVotesFile)).votes;
  const prepared = prepareEvaluationBudgetV3(source), context = evaluationBudgetContextV3(prepared, 'evaluation');
  const session = openEvaluationBudgetV3({ prepared, context });
  try {
    const view = session.current(); check(view.availableMicros === '0' && view.reservedMicros === '0', 'GENERAL_LEDGER');
    check(fileSha(resolve(root, scope.ledgerFile)) === scope.beforeLedgerSha256, 'LEDGER_PIN');
    const claim = resolve(context.directory, '20261109-provision-129-calibration-remainder-once.json');
    const runtime = resolve(root, 'outputs', scope.runtimeDirectoryName);
    check(!existsSync(claim) && !existsSync(runtime), 'FUNDING_ONCE');
    save(claim, { protocol: CALIBRATION_REMAINDER_V1, scopeHash, parentSettlementSha256: fileSha(resolve(root, scope.parentSettlementFile)),
      parentClaimSha256: parent.claimSha256, ...funding, originalFiveDollarReopened: false, automaticReleaseToGeneralLedger: false });
    mkdirSync(runtime);
    const terminal = await collectGroupedReviewsV2({ plan, directory: runtime, loadKey: () => loadKey(root), transport: send, mode: 'evaluation', limits: scope.limits,
      binding: { planHash: scopeHash, collectorPlanHash: scope.planSha256, fundingProtocol: CALIBRATION_REMAINDER_V1, generalLedgerDebitMicros: '0' },
      onProgress: e => console.log(JSON.stringify(e)) });
    save(resolve(runtime, 'restricted-funding-settlement.json'), { protocol: CALIBRATION_REMAINDER_V1, scopeHash, claimSha256: fileSha(claim),
      terminalSha256: fileSha(resolve(runtime, 'terminal.json')), ...funding, usedUpperMicros: terminal.combinedUsedUpperMicros,
      restrictedUnusedMicros: String(BigInt(scope.limits.maximumMicros) - BigInt(terminal.combinedUsedUpperMicros)),
      countAllowanceRetainedMicros: terminal.combinedCountAllowanceRetainedMicros, automaticReleaseToGeneralLedger: false,
      generalLedgerUnchanged: fileSha(resolve(root, scope.ledgerFile)) === scope.beforeLedgerSha256 });
    if (!terminal.failureCode) save(resolve(runtime, 'calibration-results.json'), inspectCalibrationRemainderV1(plan, terminal.records, negativeVotes));
    return terminal;
  } finally { session.release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    check(process.argv.length === 4 && process.argv[2] === '--execute-authorized-remainder', 'EXPLICIT_MODE');
    const r = await executeCalibrationRemainderV1(process.argv[3]);
    console.log(JSON.stringify({ status: r.status, failureCode: r.failureCode, actualProviderCalls: r.actualProviderCalls,
      actualCountCalls: r.actualCountCalls, judgments: r.logicalJudgments, usedUpperMicros: r.combinedUsedUpperMicros }));
    if (r.failureCode) process.exitCode = 2;
  } catch (e) { console.error(/^(?:CRM1|GRV2|EV3)_[A-Z0-9_]+$/.test(e?.message ?? '') ? e.message : 'CRM1_LOCAL_HELD'); process.exitCode = 1; }
}
