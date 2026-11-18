import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compileBlindReferenceGroupsV1, inspectBlindReferenceGroupsV1 } from './ai-quality-v147-blind-reference-groups-v1.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const root = read(resolve(source, '.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot;
const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
const draft = read(resolve(evidence, 'phase137/pilot-60-replacement-draft.json'));
const inputs = {
  cases: draft.cases,
  generation: read(resolve(evidence, 'phase137/pilot-60-replacement-capture.json')),
  slots: read(resolve(evidence, 'phase146/source-backed-reference-draft.json')).slots.filter(row => row.allocationSlot > 1),
  completedCaseIds: draft.cases.filter(row => row.allocationSlot === 1).map(row => row.id),
};
const sha = raw => createHash('sha256').update(raw).digest('hex');
const plan = compileBlindReferenceGroupsV1(inputs);
const compile = change => compileBlindReferenceGroupsV1({ ...inputs, ...change });
function records() {
  return plan.requests.map(request => ({ model: request.model, requestRaw: request.requestRaw,
    payloadRaw: JSON.stringify({ items: JSON.parse(JSON.parse(request.requestRaw).input[0].content).items.map(item => ({
      itemId: item.itemId, meaningUsage: 'appropriate', grammar: 'natural', contextNeeded: 'none', edits: [],
      sourceCoverage: 'sufficient', sourcesUsed: [item.sources[0].id], rationale: 'Synthetic packing check only.',
    })) }) }));
}
function editAnswer(rows, batch, item, change) {
  const payload = JSON.parse(rows[batch].payloadRaw);
  Object.assign(payload.items[item], change);
  rows[batch] = { ...rows[batch], payloadRaw: JSON.stringify(payload) };
  return rows;
}
function changeSlot(index, mutate) {
  const slots = [...inputs.slots], slot = slots[index], body = JSON.parse(slot.requestRaw);
  mutate(body);
  const requestRaw = JSON.stringify(body);
  const countRequestRaw = JSON.stringify(Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(k => [k, body[k]])));
  slots[index] = { ...slot, requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw) };
  return slots;
}

test('all 54 current cases keep exactly two separate model seats, complete assignments and source facts', () => {
  assert.deepEqual(plan, compile({}));
  assert.equal(plan.requests.length, 3);
  assert.deepEqual(plan.requests.map(row => row.privateBindings.length), [36, 36, 36]);
  const seats = new Set();
  for (const request of plan.requests) {
    assert.equal(request.dispatchEligible, false);
    const content = JSON.parse(JSON.parse(request.requestRaw).input[0].content);
    for (const binding of request.privateBindings) {
      const slot = inputs.slots.find(row => row.caseId === binding.caseId && row.reviewer === binding.reviewer);
      const item = content.items.find(row => row.itemId === binding.itemId);
      const { itemId, ...actual } = item;
      assert.match(itemId, /^item-[a-f0-9]{24}$/);
      assert.deepEqual(actual, JSON.parse(JSON.parse(slot.requestRaw).input[0].content));
      assert.equal(binding.individualRequestSha256, slot.requestSha256);
      seats.add(binding.caseId + '/' + binding.reviewer);
    }
  }
  assert.equal(seats.size, 108);
  assert.equal(plan.scopeApproved, false);
  assert.equal(plan.referencesQualified, 0);
  assert.equal(plan.groupedEquivalenceEstablished, false);
});

test('completed source followup, obsolete replacement IDs, duplicate seats and a missing slot are rejected', () => {
  const slots = [...inputs.slots];
  slots[0] = { ...slots[0], caseId: inputs.completedCaseIds[0] };
  assert.throws(() => compile({ slots }), /Unplanned or completed/);
  slots[0] = { ...inputs.slots[0], caseId: 'fresh-grammar-needsCorrection-04' };
  assert.throws(() => compile({ slots }), /Unplanned or completed/);
  slots[0] = inputs.slots[1];
  assert.throws(() => compile({ slots }), /Duplicate or invalid reviewer/);
  assert.throws(() => compile({ slots: inputs.slots.slice(1) }));
});

test('a rehashed wrong sentence, target or source cannot enter a peer pair', () => {
  for (const mutation of [data => { data.assignment.sentence = 'Changed sentence.'; },
    data => { data.assignment.meaning = 'Changed target meaning.'; }]) {
    const slots = changeSlot(0, body => { const data = JSON.parse(body.input[0].content); mutation(data); body.input[0].content = JSON.stringify(data); });
    assert.throws(() => compile({ slots }), /Reference assignment differs/);
  }
  const slots = changeSlot(0, body => { const data = JSON.parse(body.input[0].content); data.sources[0].fact = 'Changed source fact.'; body.input[0].content = JSON.stringify(data); });
  assert.throws(() => compile({ slots }), /Peer assignments or sources differ/);
});

test('synthetic answers unpack to the fixed denominator without qualifying any reference', () => {
  const result = inspectBlindReferenceGroupsV1(inputs, records());
  assert.deepEqual([result.denominator, result.availableVotes, result.unavailableVotes, result.agreementCases], [108, 108, 0, 54]);
  assert.equal(result.referencesQualified, 0);
  assert.equal(result.referenceRoleQualified, false);
  assert.equal(result.mainDispatchAuthorized, false);
  assert.ok(result.cases.every(row => row.status === 'agreement-needs-admission' && !row.referenceQualified));
});

test('a missing, truncated, duplicate-ID or missing-item batch leaves all 36 seats unavailable', () => {
  for (const mode of ['missing', 'truncated', 'duplicate', 'omitted']) {
    const rows = records(), payload = JSON.parse(rows[0].payloadRaw);
    if (mode === 'missing') rows[0].payloadRaw = null;
    if (mode === 'truncated') rows[0].payloadRaw = '{"items":[';
    if (mode === 'duplicate') { payload.items[0] = payload.items[1]; rows[0].payloadRaw = JSON.stringify(payload); }
    if (mode === 'omitted') { payload.items.pop(); rows[0].payloadRaw = JSON.stringify(payload); }
    const result = inspectBlindReferenceGroupsV1(inputs, rows);
    assert.deepEqual([result.denominator, result.availableVotes, result.unavailableVotes, result.agreementCases], [108, 72, 36, 18]);
    assert.deepEqual(result.batchFailures, [{ model: plan.requests[0].model, heldSlots: 36 }]);
  }
});

test('an invented source or edit is held for its item and never rescued by another item', () => {
  for (const change of [{ sourcesUsed: ['source-from-another-item'] },
    { grammar: 'needs_work', edits: [{ before: 'text absent from this original', after: 'invented event' }] }]) {
    const result = inspectBlindReferenceGroupsV1(inputs, editAnswer(records(), 0, 0, change));
    assert.deepEqual([result.denominator, result.availableVotes, result.unavailableVotes, result.agreementCases], [108, 107, 1, 53]);
    assert.equal(result.cases.find(row => row.caseId === plan.requests[0].privateBindings[0].caseId).status, 'held-missing');
  }
});

test('source insufficiency and reviewer disagreement remain held instead of being voted away', () => {
  for (const [change, expected] of [[{ sourceCoverage: 'insufficient' }, 'held-source'],
    [{ meaningUsage: 'needs_work' }, 'held-disagreement']]) {
    const result = inspectBlindReferenceGroupsV1(inputs, editAnswer(records(), 0, 0, change));
    assert.equal(result.availableVotes, 108);
    assert.equal(result.agreementCases, 53);
    assert.equal(result.cases.find(row => row.caseId === plan.requests[0].privateBindings[0].caseId).status, expected);
  }
});

test('an individual response cannot be relabelled as a group and changed grouped requests cannot be replayed', () => {
  const rows = records();
  rows[0].payloadRaw = JSON.stringify(JSON.parse(rows[0].payloadRaw).items[0]);
  assert.equal(inspectBlindReferenceGroupsV1(inputs, rows).unavailableVotes, 36);
  const changed = records();
  changed[0].requestRaw += ' ';
  assert.throws(() => inspectBlindReferenceGroupsV1(inputs, changed), /Grouped request changed/);
  const duplicated = records();
  duplicated[0] = duplicated[1];
  assert.throws(() => inspectBlindReferenceGroupsV1(inputs, duplicated), /Duplicate model/);
});
