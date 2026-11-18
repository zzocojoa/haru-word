import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindCurrentMc12EvidenceV1 } from './ai-quality-v147-current-calibration-evidence-v1.mjs';

const source = fileURLToPath(new URL('../../', import.meta.url));
const root = JSON.parse(readFileSync(resolve(source, '.taskmaster/docs/ai-quality-v147-manifest.json'))).baseline.existingDashboardRoot;
const read = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const scope = read('outputs/ai-quality-v147-implementation-20261106/phase153/mc12-diagnostic-scope.json');
const ready = read('.taskmaster/docs/ai-quality-v147-mc12-collector-ready-v1.json');
const runtime = 'outputs/ai-quality-v147-current-mc12-runtime-20261109';
const terminal = read(runtime + '/terminal.json');
const prepared = read('outputs/ai-quality-v147-implementation-20261106/phase104/prepared.json');
function sample(index = 0) {
  const request = scope.requests[index];
  const original = prepared.plan.requests.find(row => row.key === request.key);
  const slot = { ...original, ...request };
  const archive = Object.fromEntries(['count', 'model'].flatMap(kind => [
    [kind === 'model' ? 'requestRaw' : 'countRequestRaw', readFileSync(resolve(root, runtime, `${kind}-${index}-request.json`), 'utf8')],
    [kind + 'Raw', readFileSync(resolve(root, runtime, `${kind}-${index}-response.json`), 'utf8')],
    [kind + 'Capture', read(`${runtime}/${kind}-${index}-capture.json`)],
  ]));
  const currentFeedback = JSON.parse(JSON.parse(slot.requestRaw).input[0].content).EVALUATION_DATA.feedback;
  return { slot, currentFeedback, diagnostic: { terminal: structuredClone(terminal), archive }, index, scopeSha256: ready.scopeSha256 };
}
test('all six archived current MC12 seats bind exact actual responses and counts', () => {
  const bound = scope.requests.map((_, i) => bindCurrentMc12EvidenceV1(sample(i)));
  assert.equal(new Set(bound.map(row => [row.caseId, row.model, row.layout].join('/'))).size, 6);
  for (const row of bound) {
    assert.equal(row.status, 'current-diagnostic-evidence');
    assert.equal(row.vote.grammar, undefined);
    assert.equal(row.vote.grade.grammar, 'pass');
    assert.equal(row.dispatchEligible, false);
    assert.equal(row.fullCalibrationQualified, false);
  }
});
test('changed current explanation requires a fresh count and review without carrying a vote', () => {
  const value = sample();
  value.currentFeedback.explanation += ' synthetic changed claim';
  const row = bindCurrentMc12EvidenceV1(value);
  assert.equal(row.status, 'needs-new-count-and-review');
  assert.ok(!Object.hasOwn(row, 'vote') && !Object.hasOwn(row, 'inputTokens'));
});
test('wrong model, order, request seat or diagnostic index is rejected', () => {
  for (const mutate of [v => v.slot.model = 'gpt-6-astra', v => v.slot.layout = 'feedback-first',
    v => v.slot.requestSha256 = '0'.repeat(64), v => v.index = 1, v => v.index = -1]) {
    const value = sample(); mutate(value);
    assert.throws(() => bindCurrentMc12EvidenceV1(value), assert.AssertionError);
  }
});
test('incomplete, held or differently scoped diagnostic is rejected', () => {
  for (const mutate of [v => v.scopeSha256 = '0'.repeat(64), v => v.diagnostic.terminal.failureCode = 'MC12_TEST',
    v => v.diagnostic.terminal.status = 'held', v => v.diagnostic.terminal.actualProviderCalls = 5,
    v => v.diagnostic.terminal.lineage = 'baseline']) {
    const value = sample(); mutate(value);
    assert.throws(() => bindCurrentMc12EvidenceV1(value), assert.AssertionError);
  }
});
test('captured raw request, response or capture changes are rejected', () => {
  for (const key of ['requestRaw', 'countRequestRaw', 'modelRaw', 'countRaw']) {
    const value = sample(); value.diagnostic.archive[key] += ' ';
    assert.throws(() => bindCurrentMc12EvidenceV1(value), assert.AssertionError);
  }
  const value = sample(); value.diagnostic.archive.modelCapture.index++;
  assert.throws(() => bindCurrentMc12EvidenceV1(value), assert.AssertionError);
});
test('stored usage, receipt or vote cannot override the original response', () => {
  for (const mutate of [v => v.diagnostic.terminal.records[0].inputTokens++, v => v.diagnostic.terminal.receipts[0].inputTokens++,
    v => v.diagnostic.terminal.records[0].inspection.vote.grade.grammar = 'fail',
    v => v.diagnostic.terminal.records[0].inspection = null]) {
    const value = sample(); mutate(value);
    assert.throws(() => bindCurrentMc12EvidenceV1(value), assert.AssertionError);
  }
});
test('MC12 evidence does not qualify another case or grant a live dispatch', () => {
  const value = sample(); value.slot.privateBinding.witnessId = 'MC11';
  assert.throws(() => bindCurrentMc12EvidenceV1(value), assert.AssertionError);
  const live = sample(); live.diagnostic.terminal.mainDispatchAuthorized = true;
  assert.throws(() => bindCurrentMc12EvidenceV1(live), assert.AssertionError);
});
