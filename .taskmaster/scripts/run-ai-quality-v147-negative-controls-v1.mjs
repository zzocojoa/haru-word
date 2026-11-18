// Child allocation of an existing restricted fund; no new general allocation or API retries.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFixedReviewsV1, FIXED_REVIEW_MAX_MICROS } from './ai-quality-v147-fixed-review-executor-v1.mjs';
import { durableEvaluationV3 as save, prepareEvaluationBudgetV3, evaluationBudgetContextV3, openEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { NEGATIVE_CONTROLS_V1, inspectNegativeControlsV1 } from './ai-quality-v147-bilingual-negative-controls-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = raw => createHash('sha256').update(raw).digest('hex');
const fileSha = file => sha(readFileSync(file));
const check = (ok, code) => { if (!ok) throw Error('BNC1_' + code); };
const scopeFile = '.taskmaster/docs/ai-quality-v147-negative-controls-scope-v1.json';

export function negativeControlFundingV1(parent, maximum = FIXED_REVIEW_MAX_MICROS) {
  check(parent.assignedMicros === '1743239' && parent.restrictedUsedUpperMicros === '744007'
    && parent.restrictedUnusedMicros === '999232' && parent.unassignedProvisionHeldMicros === '2771761', 'PARENT_FUNDS');
  check(BigInt(parent.assignedMicros) === BigInt(parent.restrictedUsedUpperMicros) + BigInt(parent.restrictedUnusedMicros), 'PARENT_SUM');
  const available = BigInt(parent.restrictedUnusedMicros) + BigInt(parent.unassignedProvisionHeldMicros);
  check(maximum >= BigInt(parent.restrictedUnusedMicros) && maximum <= available, 'RESTRICTED_CAP');
  return { sourceRemainderMicros: String(available), assignedMaximumMicros: String(maximum),
    unassignedProvisionHeldMicros: String(available - maximum), generalDebitMicros: '0',
    previousConditionalUnusedConsumedMicros: parent.restrictedUnusedMicros,
    additionalProvisionEarmarkedMicros: String(maximum - BigInt(parent.restrictedUnusedMicros)), newGrantCreated: false };
}

function loadKey(root) {
  const file = resolve(root, '.env.local'), stat = lstatSync(file);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && realpathSync(file) === file, 'KEY_PATH');
  const values = [...readFileSync(file, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
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

export async function executeNegativeControlsV1(scopeHash) {
  check(process.version === 'v24.22.1', 'NODE');
  const scope = read(resolve(source, scopeFile));
  check(scope.protocol === NEGATIVE_CONTROLS_V1 && fileSha(resolve(source, scopeFile)) === scopeHash, 'SCOPE');
  const root = resolve(scope.dashboardRoot), grant = read(resolve(root, scope.authorizationFile));
  check(grant.currentUserApproved && grant.apiKeyReuseAlreadyApproved && grant.additionalTrancheCapMicros === '35000000'
    && grant.scope === '후속 AI 품질 개선 평가; 기존 US5 실행안과 원장 분리' && !grant.oldClosedApprovalsReactivated, 'EXISTING_GRANT');
  check(scope.authorizationBasis === 'existing-additional-budget-authorization' && fileSha(resolve(root, scope.authorizationFile)) === scope.authorizationSha256, 'AUTHORIZATION');
  check(fileSha(resolve(root, scopeFile)) === scopeHash && realpathSync(root) === root, 'ROOT');
  for (const [file, hash] of Object.entries(scope.executionSha256)) {
    check(fileSha(resolve(source, file)) === hash && fileSha(resolve(root, file)) === hash, 'EXECUTION_PIN');
  }
  for (const [file, hash] of Object.entries(scope.evidenceSha256)) check(fileSha(resolve(root, file)) === hash, 'EVIDENCE_PIN');
  const parent = read(resolve(root, scope.parentSettlementFile)), funding = negativeControlFundingV1(parent);
  check(scope.maximumCombinedMicros === funding.assignedMaximumMicros, 'LIMITS');
  const plan = read(resolve(root, scope.planFile));
  check(fileSha(resolve(root, scope.planFile)) === scope.planSha256 && fileSha(resolve(source, scope.planFile)) === scope.planSha256, 'PLAN');
  const prepared = prepareEvaluationBudgetV3(source), context = evaluationBudgetContextV3(prepared, 'evaluation');
  const session = openEvaluationBudgetV3({ prepared, context });
  try {
    check(session.current().availableMicros === '0' && session.current().reservedMicros === '0', 'GENERAL_LEDGER');
    check(fileSha(resolve(root, scope.ledgerFile)) === scope.beforeLedgerSha256, 'LEDGER_PIN');
    const claim = resolve(context.directory, '20261109-provision-129-followup-once.json');
    const runtime = resolve(root, 'outputs', scope.runtimeDirectoryName);
    check(!existsSync(claim) && !existsSync(runtime), 'FUNDING_ONCE');
    save(claim, { protocol: NEGATIVE_CONTROLS_V1, scopeHash, parentSettlementSha256: fileSha(resolve(root, scope.parentSettlementFile)),
      parentClaimSha256: parent.claimSha256, ...funding, automaticReleaseToGeneralLedger: false, originalFiveDollarReopened: false });
    mkdirSync(runtime);
    const terminal = await collectFixedReviewsV1({ plan, directory: runtime, loadKey: () => loadKey(root), transport: send, mode: 'evaluation',
      binding: { planHash: scopeHash, collectorPlanHash: scope.planSha256, fundingProtocol: NEGATIVE_CONTROLS_V1,
        generalLedgerDebitMicros: '0', collectorLegacySplitFieldsUsedForAccounting: false }, onProgress: e => console.log(JSON.stringify(e)) });
    // Entire combined charge belongs to the child restricted fund; legacy collector split fields are not debits.
    save(resolve(runtime, 'restricted-funding-settlement.json'), { protocol: NEGATIVE_CONTROLS_V1, scopeHash,
      claimSha256: fileSha(claim), terminalSha256: fileSha(resolve(runtime, 'terminal.json')), ...funding,
      usedUpperMicros: terminal.combinedUsedUpperMicros, restrictedUnusedMicros: String(FIXED_REVIEW_MAX_MICROS - BigInt(terminal.combinedUsedUpperMicros)),
      countAllowanceRetainedMicros: terminal.combinedCountAllowanceRetainedMicros, automaticReleaseToGeneralLedger: false,
      generalLedgerUnchanged: fileSha(resolve(root, scope.ledgerFile)) === scope.beforeLedgerSha256 });
    if (!terminal.failureCode) save(resolve(runtime, 'negative-control-results.json'), inspectNegativeControlsV1(plan, terminal.records));
    return terminal;
  } finally { session.release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    check(process.argv.length === 4 && process.argv[2] === '--execute-authorized-controls', 'EXPLICIT_MODE');
    const r = await executeNegativeControlsV1(process.argv[3]);
    console.log(JSON.stringify({ status: r.status, failureCode: r.failureCode, actualProviderCalls: r.actualProviderCalls,
      actualCountCalls: r.actualCountCalls, judgments: r.independentJudgments, usedUpperMicros: r.combinedUsedUpperMicros }));
    if (r.failureCode) process.exitCode = 2;
  } catch (e) { console.error(/^(?:BNC1|FRE1|EV3)_[A-Z0-9_]+$/.test(e?.message ?? '') ? e.message : 'BNC1_LOCAL_HELD'); process.exitCode = 1; }
}
