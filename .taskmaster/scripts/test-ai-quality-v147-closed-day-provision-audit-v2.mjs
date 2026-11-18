import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditClosedDayProvisionsV2, prepareClosedDayProvisionAuditV2 } from './ai-quality-v147-closed-day-provision-audit-v2.mjs';

const root = JSON.parse(readFileSync(new URL('../docs/ai-quality-v147-manifest.json', import.meta.url), 'utf8')).baseline.existingDashboardRoot;
const prepared = prepareClosedDayProvisionAuditV2(root), input = prepared.input;
const selected = i => i.runs.find(r => r.receipts[0].localReceiptUtc.startsWith('2026-11-09T'));

test('only129 distinct closed-day receipts yield4.515 proposal; prior245 and current68 remain excluded', () => {
  const r = prepared.result;
  assert.equal(r.selectedRuns, 10); assert.equal(r.selectedReceipts, 129);
  assert.equal(r.candidateProvisionAdjustmentMicros, '4515000');
  assert.equal(r.candidateAvailableMicros, '4671241'); assert.equal(r.candidateConditionalRemainingMicros, '5238750');
  assert.equal(r.candidateUsedUpperMicros, '30328759');
  const old = new Set(input.priorClaimedReceiptKeys);
  assert.ok(r.selected.every(run => run.receiptKeys.every(k => !old.has(k))));
  assert.equal(r.excluded.filter(x => x.reason === 'already-reassigned').reduce((n, x) => n + x.receiptCount, 0), 84);
  assert.equal(r.excluded.filter(x => x.reason === 'other-utc-day').reduce((n, x) => n + x.receiptCount, 0), 68);
  assert.equal(r.adjustmentApplied, false); assert.equal(r.mainDispatchAuthorized, false); assert.equal(r.newGrantCreated, false);
});

test('a previously reassigned receipt cannot be released twice even with a valid current budget', () => {
  const i = structuredClone(input); i.priorClaimedReceiptKeys[0] = selected(i).receipts[0].key;
  assert.throws(() => auditClosedDayProvisionsV2(i), /FIXED_COHORT/);
});

test('duplicate count receipts and model/count date ambiguity cannot create financial credit', () => {
  let i = structuredClone(input); const run = selected(i); run.receipts[1].key = run.receipts[0].key;
  assert.throws(() => auditClosedDayProvisionsV2(i), /DUPLICATE_RECEIPT/);
  i = structuredClone(input); selected(i).receipts[0].localReceiptUtc = '2026-11-12T01:00:00Z';
  assert.throws(() => auditClosedDayProvisionsV2(i), /DATE_AMBIGUITY/);
});

test('a missing provision component, wrong allocation or active reservation holds the proposal', () => {
  let i = structuredClone(input); selected(i).generalCountProvisionMicros = '0';
  assert.throws(() => auditClosedDayProvisionsV2(i), /PROVISION_COMPONENT/);
  i = structuredClone(input); selected(i).generalUsedUpperMicros = '1';
  assert.throws(() => auditClosedDayProvisionsV2(i), /ALLOCATION/);
  i = structuredClone(input); i.ledger.reservedMicros = '1'; assert.throws(() => auditClosedDayProvisionsV2(i), /LEDGER/);
});

test('observed calculation fees or changed closed-day report cannot be treated as absent charges', () => {
  let i = structuredClone(input); i.billing.countFeeLineItemObserved = true;
  assert.throws(() => auditClosedDayProvisionsV2(i), /BILLING/);
  i = structuredClone(input); i.billing.closedNov8And9UnchangedSincePriorExport = false;
  assert.throws(() => auditClosedDayProvisionsV2(i), /BILLING/);
  i = structuredClone(input); i.billing.reportedUtcDaysUsd['2026-11-09'] = '9';
  assert.throws(() => auditClosedDayProvisionsV2(i), /CLOSED_DAY_REPORT/);
});

test('unknown fees, past1USD, formal2.52,current2.38 and unassigned0.007816 remain explicit and unspent', () => {
  const r = prepared.result;
  assert.equal(r.pastUnbilledContingencyMicrosRetained, '1000000');
  assert.equal(r.originalFormalCalibrationCountProvisionMicrosRetained, '2520000');
  assert.equal(r.currentDayCountProvisionMicrosRetained, '2380000'); assert.equal(r.oldUnassignedHeldMicrosRetained, '7816');
  assert.equal(r.countApiProvenFree, false); assert.equal(r.invoiceVerified, false); assert.equal(r.feeRiskDecisionRequired, true);
  const i = structuredClone(input); i.protectedAmounts.pastUnbilledContingencyMicros = '0';
  assert.throws(() => auditClosedDayProvisionsV2(i), /PROTECTED_AMOUNTS/);
});

test('the old5USD book and all allocation arithmetic must remain intact; pure audit makes zero calls', () => {
  let i = structuredClone(input); i.ledger.originalFiveDollarReopened = true;
  assert.throws(() => auditClosedDayProvisionsV2(i), /OLD_BUDGETS/);
  i = structuredClone(input); i.ledger.availableMicros = '5000000';
  assert.throws(() => auditClosedDayProvisionsV2(i), /CAP_ARITHMETIC/);
  assert.deepEqual([prepared.result.actualProviderCalls, prepared.result.actualCountCalls, prepared.result.actualKeyReads], [0, 0, 0]);
});
