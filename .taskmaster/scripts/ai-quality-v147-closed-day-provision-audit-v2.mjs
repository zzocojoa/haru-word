// Read-only reconciliation proposal. Never issues credit or changes a ledger.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { digest } from './ai-quality-v147-calibration.mjs';

export const CLOSED_DAY_PROVISION_AUDIT_V2 = 'ai-quality-v147-closed-day-provision-audit-v2';
const day = '2026-11-09';
const check = (ok, code) => { if (!ok) throw Error('CPA2_' + code); };
const sha = raw => createHash('sha256').update(raw).digest('hex');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const fileSha = p => sha(readFileSync(p));
const money = value => { check(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), 'MONEY'); return BigInt(value); };

export function auditClosedDayProvisionsV2(input) {
  const { ledger, runs, priorClaimedReceiptKeys, billing, protectedAmounts } = input;
  check(ledger.protocol === 'ai-quality-v147-evaluation-budget-v3' && ledger.capMicros === '35000000' && ledger.reservedMicros === '0', 'LEDGER');
  check(ledger.oldLedgersClosed && !ledger.newGrantCreated && !ledger.originalFiveDollarReopened, 'OLD_BUDGETS');
  check(ledger.allocations.length === runs.length && new Set(runs.map(r => r.runId)).size === runs.length, 'RUN_DENOMINATOR');
  check(money(ledger.baseUsedUpperMicros) + ledger.allocations.reduce((n, a) => n + money(a.usedUpperMicros), 0n) === money(ledger.usedUpperMicros), 'LEDGER_ARITHMETIC');
  check(money(ledger.usedUpperMicros) + money(ledger.availableMicros) === 35000000n, 'CAP_ARITHMETIC');
  check(billing.closedNov8And9UnchangedSincePriorExport === true && billing.countFeeLineItemObserved === false && billing.ledgerAdjusted === false, 'BILLING');
  check(billing.reportedUtcDaysUsd[day] === '3.099275450000000000000000000', 'CLOSED_DAY_REPORT');
  const prior = new Set(priorClaimedReceiptKeys);
  check(prior.size === priorClaimedReceiptKeys.length && prior.size === 245, 'PRIOR_CLAIM_DENOMINATOR');
  check(protectedAmounts.pastUnbilledContingencyMicros === '1000000' && protectedAmounts.formalCalibrationCountProvisionMicros === '2520000'
    && protectedAmounts.oldUnassignedHeldMicros === '7816', 'PROTECTED_AMOUNTS');
  const allKeys = new Set(), selected = [], excluded = [];
  let release = 0n;
  for (const run of runs) {
    const allocation = ledger.allocations.find(a => a.runId === run.runId);
    check(allocation && allocation.state === 'settled' && allocation.reservedMicros === '0' && allocation.usedUpperMicros === run.generalUsedUpperMicros, 'ALLOCATION');
    check(run.receipts.length > 0 && run.receipts.length === run.actualCountCalls, 'RECEIPT_DENOMINATOR');
    const local = new Set(run.receipts.map(r => r.localReceiptUtc.slice(0, 10)));
    const model = new Set(run.receipts.map(r => r.pairedModelCreatedUtc.slice(0, 10)));
    check(local.size === 1 && model.size === 1 && [...local][0] === [...model][0], 'DATE_AMBIGUITY');
    for (const receipt of run.receipts) { check(!allKeys.has(receipt.key), 'DUPLICATE_RECEIPT'); allKeys.add(receipt.key); }
    const previouslyUsed = run.receipts.some(r => prior.has(r.key));
    if ([...local][0] !== day || previouslyUsed) {
      excluded.push({ runId: run.runId, receiptCount: run.receipts.length, reason: previouslyUsed ? 'already-reassigned' : 'other-utc-day' });
      continue;
    }
    check(run.combinedFunding === false, 'RESTRICTED_FUND');
    const amount = BigInt(run.receipts.length) * 35000n;
    check(money(run.generalCountProvisionMicros) === amount && money(run.generalUsedUpperMicros) >= amount, 'PROVISION_COMPONENT');
    selected.push({ runId: run.runId, receiptCount: run.receipts.length, provisionMicros: String(amount), receiptKeys: run.receipts.map(r => r.key) });
    release += amount;
  }
  check(selected.length === 10 && selected.reduce((n, r) => n + r.receiptCount, 0) === 129 && release === 4515000n, 'FIXED_COHORT');
  const todayCounts = runs.filter(r => r.receipts.every(c => c.localReceiptUtc.startsWith('2026-11-12T'))).reduce((n, r) => n + r.receipts.length, 0);
  check(todayCounts === 68, 'CURRENT_DAY_COHORT');
  return { protocol: CLOSED_DAY_PROVISION_AUDIT_V2, dayUtc: day, selected, excluded,
    selectedRuns: selected.length, selectedReceipts: 129, candidateProvisionAdjustmentMicros: String(release),
    beforeUsedUpperMicros: ledger.usedUpperMicros, beforeAvailableMicros: ledger.availableMicros,
    candidateUsedUpperMicros: String(money(ledger.usedUpperMicros) - release),
    candidateAvailableMicros: String(money(ledger.availableMicros) + release),
    restrictedUnusedMicrosRetained: '567509', candidateConditionalRemainingMicros: String(money(ledger.availableMicros) + release + 567509n),
    pastUnbilledContingencyMicrosRetained: '1000000', currentDayCountProvisionMicrosRetained: '2380000',
    originalFormalCalibrationCountProvisionMicrosRetained: '2520000', oldUnassignedHeldMicrosRetained: '7816',
    originalFiveDollarReopened: false, oldAllocationsChanged: false, newGrantCreated: false,
    candidateIsActualCashBalance: false, adjustmentApplied: false, countApiProvenFree: false,
    feeRiskDecisionRequired: true, invoiceVerified: false, mainDispatchAuthorized: false,
    actualProviderCalls: 0, actualCountCalls: 0, actualKeyReads: 0 };
}

export function prepareClosedDayProvisionAuditV2(root) {
  root = resolve(root);
  const source = resolve(read(resolve(root, '.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.sourceRoot);
  const ledgerFile = '.taskmaster/docs/ai-quality-v147-evaluation-budget-ledger-v3.json';
  const billingFile = '.taskmaster/docs/ai-quality-v147-current-cost-readback-v2.json';
  const priorFile = 'outputs/ai-quality-v147-implementation-20261106/phase105/reconciliation-basis.json';
  const priorClaim = '.taskmaster/docs/ai-quality-v147-closed-day-calibration-earmark-v1.json';
  const bindings = {};
  const bound = file => { const p = resolve(root, file); bindings[relative(root, p).split(sep).join('/')] = fileSha(p); return read(p); };
  const ledger = bound(ledgerFile), billing = bound(billingFile), old = bound(priorFile), earmark = bound(priorClaim);
  check(fileSha(resolve(source, ledgerFile)) === fileSha(resolve(root, ledgerFile)), 'LEDGER_MIRROR');
  check(fileSha(resolve(root, billing.csvFile)) === billing.csvSha256, 'CSV'); bound(billingFile);
  bindings[billing.csvFile] = billing.csvSha256;
  check(old.dayUtc === '2026-11-08' && old.eligibleCountReceipts === 245 && earmark.earmarkMicros === '8567184', 'PRIOR_ASSIGNMENT');
  const oldPreparation = bound('.taskmaster/docs/ai-quality-v147-closed-day-cost-preparation-v1.json');
  check(fileSha(resolve(root, priorFile)) === oldPreparation.basisSha256, 'PRIOR_BASIS');
  check(sha(readFileSync(resolve(root, earmark.claimFile))) === earmark.claimSha256, 'PRIOR_CLAIM');
  bindings[earmark.claimFile] = earmark.claimSha256;
  const priorClaimedReceiptKeys = old.runs.flatMap(r => r.countReceipts.map(c => r.runtime + '/' + c.response));
  const runs = ledger.allocations.map(allocation => {
    const directory = resolve(allocation.runtimeRoot), rel = relative(resolve(root, 'outputs'), directory);
    check(!rel.startsWith('..') && !rel.includes(sep), 'RUNTIME_SCOPE');
    const terminalFile = relative(root, resolve(directory, 'terminal.json')).split(sep).join('/');
    const terminal = bound(terminalFile);
    const final = bound('outputs/ai-quality-v147-evaluation-budget-v3-20261109/allocation-final-' + allocation.runId + '.json');
    check(final.runtimeTerminalSha256 === fileSha(resolve(root, terminalFile)) && final.intentSha256 === allocation.intentSha256
      && final.usedUpperMicros === allocation.usedUpperMicros && final.held === false, 'SETTLEMENT_BINDING');
    const receipts = readdirSync(directory).filter(n => /^count-\d+-response\.json$/.test(n)).map(name => {
      const index = /^count-(\d+)-/.exec(name)[1];
      const response = bound(resolve(directory, name));
      const requestFile = resolve(directory, `count-${index}-request.json`), intent = bound(resolve(directory, `count-${index}-intent.json`));
      bindings[relative(root, requestFile).split(sep).join('/')] = fileSha(requestFile);
      const capture = bound(resolve(directory, `count-${index}-capture.json`)), model = bound(resolve(directory, `model-${index}-response.json`));
      check(response.object === 'response.input_tokens' && Number.isSafeInteger(response.input_tokens) && response.input_tokens > 0, 'COUNT_RESPONSE');
      check(intent.consumedBeforeTransport && (intent.requestSha256 ?? intent.sha256) === fileSha(requestFile), 'COUNT_INTENT');
      check(capture.status === 200 && (capture.persisted || capture.rawPersisted) && capture.responseSha256 === fileSha(resolve(directory, name)), 'COUNT_CAPTURE');
      return { key: rel + '/' + name, localReceiptUtc: statSync(resolve(directory, name)).mtime.toISOString(),
        pairedModelCreatedUtc: new Date(model.created_at * 1000).toISOString(), responseSha256: fileSha(resolve(directory, name)) };
    });
    return { runId: allocation.runId, generalUsedUpperMicros: allocation.usedUpperMicros,
      generalCountProvisionMicros: terminal.countAllowanceRetainedMicros,
      actualCountCalls: terminal.actualCountApiCalls ?? terminal.actualCountCalls ?? terminal.clientCountAttempts,
      combinedFunding: terminal.combinedUsedUpperMicros !== undefined, receipts };
  });
  const v3Basis = bound('.taskmaster/docs/ai-quality-v147-budget-v3-reconciliation-basis-v1.json');
  const calibration = bound('.taskmaster/docs/ai-quality-v147-rendered-calibration-execution-v1.json');
  const protectedAmounts = { pastUnbilledContingencyMicros: v3Basis.retainedPastUnbilledContingencyMicros,
    formalCalibrationCountProvisionMicros: calibration.countAllowanceRetainedMicros,
    oldUnassignedHeldMicros: earmark.unassignedHeldMicros };
  const input = { ledger, billing, runs, priorClaimedReceiptKeys, protectedAmounts }, result = auditClosedDayProvisionsV2(input);
  return { input, result, sourceBindings: bindings, inputHash: digest(input),
    currentLedgerSha256: fileSha(resolve(root, ledgerFile)), sourceRoot: source };
}
