import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './ai-quality-v147-calibration.mjs';
import { durableEvaluationV3, evaluationBudgetContextV3, openEvaluationBudgetV3,
  prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { quoteRenderedCalibrationV1 } from './ai-quality-v147-rendered-calibration-v1.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocol = 'ai-quality-v147-closed-day-calibration-funding-v1';
const authorization = '.taskmaster/docs/ai-quality-v147-additional-budget-authorization-20261108.json';
const claimName = '20261108-count-provision-rendered-calibration-once.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, code) => { if (!ok) throw new Error('CF1_' + code); };

function canonicalFile(file) {
  const stat = lstatSync(file);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && realpathSync(file) === file, 'FILE_SCOPE');
  return readFileSync(file);
}

function bound(file, hash) {
  const raw = canonicalFile(file);
  check(sha(raw) === hash, 'EVIDENCE');
  return JSON.parse(raw);
}

function checkDirectory(directory) {
  const stat = lstatSync(directory);
  check(stat.isDirectory() && !stat.isSymbolicLink() && realpathSync(directory) === directory, 'DIRECTORY_SCOPE');
}

function loadScope(root) {
  const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
  const proof = bound(resolve(evidence, 'phase105/progress-final.json'), '78afa7bf28edfcb892082cea8fc0d8593faa45fc27301dbd1347f7c42b1aa192');
  const sealed = name => proof.evidenceSha256['outputs/ai-quality-v147-implementation-20261106/phase105/' + name];
  const basis = bound(resolve(evidence, 'phase105/reconciliation-basis.json'), sealed('reconciliation-basis.json'));
  const comparison = bound(resolve(evidence, 'phase105/reported-cost-comparison.json'), sealed('reported-cost-comparison.json'));
  check(sha(canonicalFile(resolve(evidence, 'phase105/reported-costs-20261108-09.csv'))) === basis.csvSha256 &&
    comparison.latestSha256 === basis.csvSha256 && basis.comparisonSha256 === sealed('reported-cost-comparison.json'), 'COST_REPORT');
  const prior = bound(resolve(evidence, 'phase104/progress-final.json'), '061050aa192344df5e485c50137329085765f3fcd2901c6f55b32344037180e2');
  const preparedSha256 = prior.evidenceSha256['outputs/ai-quality-v147-implementation-20261106/phase104/prepared.json'];
  const prepared = bound(resolve(evidence, 'phase104/prepared.json'), preparedSha256);
  const maximum = quoteRenderedCalibrationV1(prepared, basis.beforeAvailableMicros);
  const basisMicros = BigInt(basis.candidateReleaseMicros), earmark = BigInt(maximum.maximumReservationMicros);
  const authHash = '628ceafd54a60bdb0720bab46b5747ed1adc6790765331ed263309af6106b82b';
  const auth = bound(resolve(root, authorization), authHash);
  bound(resolve(source, authorization), authHash);
  check(auth.currentUserApproved && auth.apiKeyReuseAlreadyApproved && auth.additionalTrancheCapMicros === '35000000' &&
    auth.existingTrancheCapMicros === '5000000' && !auth.oldClosedApprovalsReactivated, 'AUTHORIZATION');
  check(basis.dayUtc === '2026-11-08' && basis.eligibleCountReceipts === 245 && basis.runs.length === 6 &&
    !basis.reconciliationApplied && !basis.invoiceVerified && !comparison.countFeeLineItemObserved &&
    comparison.differences.length > 0 && comparison.differences.every(row => row.utcDay === '2026-11-09'), 'BASIS_SCOPE');
  const names = new Set(), countReceipts = new Set();
  for (const row of basis.runs) {
    check(/^ai-quality-v147-[a-z0-9-]+-runtime-20261109$/.test(row.runtime) && !names.has(row.runtime), 'DUPLICATE_OR_RUNTIME');
    names.add(row.runtime);
    const directory = resolve(root, 'outputs', row.runtime);
    const terminal = bound(resolve(directory, 'terminal.json'), row.terminalSha256);
    check(terminal.actualCountApiCalls === row.countReceipts.length &&
      BigInt(row.retainedCountAllowanceMicros) === BigInt(row.countReceipts.length) * 35000n &&
      terminal.countAllowanceRetainedMicros === String(row.retainedCountAllowanceMicros), 'COUNT_PROVISION');
    for (const receipt of row.countReceipts) {
      check(/^count-[0-9]+-response\.json$/.test(receipt.response) && receipt.localReceiptUtc.startsWith(basis.dayUtc + 'T') &&
        !countReceipts.has(row.runtime + '/' + receipt.response), 'COUNT_RECEIPT');
      countReceipts.add(row.runtime + '/' + receipt.response);
      const response = bound(resolve(directory, receipt.response), receipt.responseSha256);
      const request = resolve(directory, receipt.response.replace('-response.json', '-request.json'));
      const intent = bound(resolve(directory, receipt.response.replace('-response.json', '-intent.json')), receipt.intentSha256);
      check(response.object === 'response.input_tokens' && intent.consumedBeforeTransport &&
        intent.requestSha256 === receipt.requestSha256 && sha(canonicalFile(request)) === receipt.requestSha256, 'COUNT_BINDING');
    }
  }
  check(prepared.plan.requests.length === 72 && prepared.hash === prior.planHash &&
    countReceipts.size === 245 && basisMicros === 8575000n && basisMicros === BigInt(countReceipts.size) * 35000n &&
    earmark === 8567184n && basis.fixed72StandardReserveUpperMicros === String(earmark) && earmark <= basisMicros, 'AMOUNTS');
  const plan = { protocol, basisDayUtc: basis.dayUtc, basisSha256: sealed('reconciliation-basis.json'), priorLedgerSha256: basis.currentLedgerSha256,
    authorizationSha256: authHash, capMicros: auth.additionalTrancheCapMicros, studyPlanHash: prepared.hash, preparedSha256,
    standardModelRequests: 72, countRequests: 72, countAllowanceMicros: maximum.countAllowanceMicros,
    earmarkMicros: String(earmark), evidencedProvisionMicros: String(basisMicros), unusedProvisionHeldMicros: String(basisMicros - earmark),
    independentV3AvailableMicros: basis.beforeAvailableMicros, conservativeV3UsedMicros: basis.beforeUsedMicros,
    excludedDayProvisionMicros: basis.unreleasedRecentCountProvisionMicros, previousFiveDollarReopened: false,
    newBudgetAuthorizationCreated: false, mainDispatchAuthorized: false };
  return { plan, hash: digest(plan) };
}

function context(syntheticDirectory) {
  const root = resolve(source, '../..');
  const { plan, hash } = loadScope(root);
  const v3 = prepareEvaluationBudgetV3(source);
  const live = evaluationBudgetContextV3(v3, 'evaluation');
  if (syntheticDirectory === null) return { root, plan, hash, v3, live, mode: 'evaluation', file: resolve(live.directory, claimName) };
  const directory = resolve(syntheticDirectory);
  const allowed = resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase106');
  const rel = relative(allowed, directory);
  check(!rel.startsWith('..') && rel.split(sep).length === 1 && /^test-[a-f0-9-]+$/.test(rel), 'SYNTHETIC_SCOPE');
  checkDirectory(directory);
  return { root, plan, hash, v3, live, mode: 'synthetic', file: resolve(directory, claimName) };
}

function expected(ctx) {
  return { protocol, mode: ctx.mode, status: 'earmarked', scopeHash: ctx.hash, plan: ctx.plan,
    providerDispatchAuthorized: false, newGrantCreated: false, actualProviderCalls: 0, actualCountApiCalls: 0, actualKeyReads: 0 };
}

export function readClosedDayCalibrationFundingV1({ syntheticDirectory = null } = {}) {
  const ctx = context(syntheticDirectory);
  const raw = canonicalFile(ctx.file);
  const funding = JSON.parse(raw);
  check(digest(funding) === digest(expected(ctx)), 'FUNDING_BINDING');
  return { funding, file: ctx.file, sha256: sha(raw) };
}

export function issueClosedDayCalibrationFundingV1({ syntheticDirectory = null } = {}) {
  const ctx = context(syntheticDirectory);
  const write = () => {
    checkDirectory(dirname(ctx.file));
    const funding = expected(ctx);
    durableEvaluationV3(ctx.file, funding);
    const raw = canonicalFile(ctx.file);
    check(digest(JSON.parse(raw)) === digest(funding), 'FUNDING_READBACK');
    return { funding, file: ctx.file, sha256: sha(raw) };
  };
  if (ctx.mode === 'synthetic') return write();
  const session = openEvaluationBudgetV3({ prepared: ctx.v3, context: ctx.live });
  try {
    const before = session.current();
    check(before.reservedMicros === '0' && before.usedUpperMicros === ctx.plan.conservativeV3UsedMicros &&
      before.availableMicros === ctx.plan.independentV3AvailableMicros &&
      ctx.live.ledgerFiles.every(file => sha(canonicalFile(file)) === ctx.plan.priorLedgerSha256), 'LEDGER_CHANGED');
    const result = write();
    check(ctx.live.ledgerFiles.every(file => sha(canonicalFile(file)) === ctx.plan.priorLedgerSha256), 'LEDGER_CHANGED');
    return result;
  } finally { session.release(); }
}
