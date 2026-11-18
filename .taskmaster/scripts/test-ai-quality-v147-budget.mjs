import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {PROTOCOL, PLAN, MODELS, ROLE_LIMITS, digest, slotKey, validateSpec, costUpperMicros, newLedger, account, transition} from './ai-quality-v147-budget.mjs';
import {createBudgetStore, readBudgetStore, transactBudgetStore} from './ai-quality-v147-budget-store.mjs';

const h = digest('synthetic fixture; not prices, approval, or live evaluation');
const clone = structuredClone;
const descriptor = (caseId = 'case-one', modelId = MODELS[0], role = 'generation', phase = 'candidate') => ({phase, caseId,
  targetModelId: modelId, modelId: role === 'judge' ? MODELS[(MODELS.indexOf(modelId) + 1) % 3] : modelId, role, repetition: 1,
  inputTokenMax: 1000, outputTokenMax: role === 'generation' ? 4096 : 1000, inputBoundHash: h, bodyCommitment: h});
function fixture(requests = [descriptor()]) {
  const spec = {schemaVersion: 1, protocol: PROTOCOL, planId: PLAN, runId: randomUUID(), mode: 'synthetic', sourceSeal: h,
    quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '11', regionalDenominator: '10', inputFactorNumerator: '3', inputFactorDenominator: '2',
      models: Object.fromEntries(MODELS.map(id => [id, {inputMicrosPerMillion: '2000000', outputMicrosPerMillion: '10000000'}]))},
    batches: [{id: 'batch-one', requests}]};
  return spec;
}
function approval(spec, amountMicros = '0') {
  return {schemaVersion: 1, protocol: PROTOCOL, runId: spec.runId, specHash: digest(spec), kind: amountMicros === '0' ? 'unapproved' : 'synthetic-test',
    amountMicros, evidenceHash: amountMicros === '0' ? null : h};
}
const total = s => s.batches.flatMap(b => b.requests).reduce((sum, d) => sum + BigInt(costUpperMicros(s, d)), 0n).toString();
const reserve = (s, l, batchId = 'batch-one') => transition(s, l, {kind: 'reserve', batchId});
const consume = (s, l, key) => transition(s, l, {kind: 'consume', key});
const settle = (s, l, key, state, usage = null) => transition(s, l, {kind: 'settle', key, state, usage, evidenceHash: h});
const script = fileURLToPath(import.meta.url);

// The child never imports a provider client. Stdin releases both competing processes together.
if (process.argv[2] === '--reservation-child') {
  const [directory, allowedRoot, specPath, batchId] = process.argv.slice(3);
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  process.stdout.write('ready\n'); process.stdin.once('data', () => {
    try { transactBudgetStore({directory, allowedRoot, spec, operation: {kind: 'reserve', batchId}}); process.stdout.write('reserved\n'); }
    catch { process.stdout.write('held\n'); }
    process.stdin.destroy();
  });
} else {
  const evidenceRoot = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(script), '../../work', `budget-test-${randomUUID()}`));
  mkdirSync(evidenceRoot, {recursive: true});
  function store(spec = fixture(), amount = total(spec)) {
    const directory = resolve(evidenceRoot, spec.runId), ctx = {directory, allowedRoot: evidenceRoot, spec};
    createBudgetStore({...ctx, approval: approval(spec, amount)}); return ctx;
  }
  async function race(ctx, batchIds) {
    const specPath = resolve(evidenceRoot, `child-spec-${ctx.spec.runId}.json`); writeFileSync(specPath, JSON.stringify(ctx.spec));
    const children = batchIds.map(batchId => {
      const child = spawn(process.execPath, [script, '--reservation-child', ctx.directory, ctx.allowedRoot, specPath, batchId], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
      let output = '', errors = '';
      const ready = new Promise((res, rej) => {
        const timer = setTimeout(() => { child.kill(); rej(new Error('CHILD_READY_TIMEOUT')); }, 10000);
        child.stdout.on('data', bytes => { output += bytes.toString(); if (output.includes('ready')) { clearTimeout(timer); res(); } });
        child.on('error', rej);
      });
      child.stderr.on('data', bytes => { errors += bytes.toString(); });
      const done = new Promise((res, rej) => {
        const timer = setTimeout(() => { child.kill(); rej(new Error('CHILD_EXIT_TIMEOUT')); }, 15000);
        child.on('error', error => { clearTimeout(timer); rej(error); });
        child.on('exit', code => { clearTimeout(timer); if (code === 0) res(); else rej(new Error('CHILD_EXIT')); });
      });
      return {child, ready, done, output: () => output, errors: () => errors};
    });
    await Promise.all(children.map(c => c.ready)); children.forEach(c => c.child.stdin.end('reserve\n'));
    await Promise.all(children.map(c => c.done));
    assert.equal(children.filter(c => c.output().includes('reserved')).length, 1); assert.ok(children.every(c => c.errors() === ''));
    const result = readBudgetStore(ctx);
    writeFileSync(resolve(evidenceRoot, `concurrency-${ctx.spec.runId}.json`), JSON.stringify({batchIds, outputs: children.map(c => c.output()), head: result.head, realProviderCalls: 0}));
    return result;
  }

  test('exact integer micro-USD, rational factors and per-request ceil', () => {
    const s = fixture(), d = s.batches[0].requests[0];
    assert.equal(costUpperMicros(s, d), '48356');
    assert.equal(costUpperMicros(s, d, {inputTokens: 1, outputTokens: 0}), '4');
    s.quote.models[MODELS[0]] = {inputMicrosPerMillion: '1', outputMicrosPerMillion: '1'};
    assert.equal(costUpperMicros(s, d, {inputTokens: 1, outputTokens: 1}), '1');
    s.quote.models[MODELS[0]].inputMicrosPerMillion = '100000000000000000000000000000000000';
    assert.equal(costUpperMicros(s, d, {inputTokens: 1, outputTokens: 0}), '165000000000000000000000000000');
  });
  test('noninteger prices, discount factors, unsafe tokens and changed generation cap fail closed', () => {
    for (const mutate of [s => { s.quote.models[MODELS[0]].inputMicrosPerMillion = 2; }, s => { s.quote.regionalNumerator = '9'; },
      s => { s.batches[0].requests[0].inputTokenMax = 1.1; }, s => { s.batches[0].requests[0].outputTokenMax = 768; },
      s => { s.batches[0].requests[0].outputTokenMax = 4097; }]) {
      const s = fixture(); mutate(s); assert.throws(() => validateSpec(s));
    }
  });
  test('current unapproved zero reserves no requests and leaves the original untouched', () => {
    const s = fixture(), l = newLedger(s, approval(s)), before = digest(l);
    assert.throws(() => reserve(s, l), /INSUFFICIENT_WHOLE_BATCH/); assert.equal(digest(l), before);
    assert.equal(account(s, l).slots, 0); assert.equal(account(s, l).realDispatchAuthorized, false);
  });
  test('exact threshold succeeds; one micro short rejects the whole two-request batch', () => {
    const s = fixture([descriptor(), descriptor('case-two')]), cap = total(s);
    const l = newLedger(s, approval(s, (BigInt(cap) - 1n).toString()));
    assert.throws(() => reserve(s, l), /INSUFFICIENT_WHOLE_BATCH/); assert.deepEqual(l.slots, {});
    assert.equal(account(s, reserve(s, newLedger(s, approval(s, cap)))).remainingMicros, '0');
  });
  test('all 756 pilot requests include generation360, main judge360 and calibration36', () => {
    const requests = [];
    for (const phase of ['baseline', 'candidate']) for (let i = 0; i < 60; i++) for (const model of MODELS)
      for (const role of ['generation', 'judge']) requests.push(descriptor(`case-${i}`, model, role, phase));
    for (let i = 0; i < 12; i++) for (const model of MODELS) requests.push(descriptor(`witness-${i}`, model, 'calibration', 'calibration'));
    const s = fixture(requests); assert.deepEqual(validateSpec(s), ROLE_LIMITS);
    const a = account(s, reserve(s, newLedger(s, approval(s, total(s)))));
    assert.equal(a.slots, 756); assert.deepEqual(a.counts, ROLE_LIMITS);
    for (const role of Object.keys(ROLE_LIMITS)) {
      const extra = clone(s), d = clone(requests.find(d => d.role === role)); d.caseId = 'extra-case'; extra.batches[0].requests.push(d);
      assert.throws(() => validateSpec(extra));
    }
  });
  test('semantic slot identity cannot be duplicated across batches or by changing payer/UUID', () => {
    const s = fixture(); s.batches.push({id: 'second-batch', requests: clone(s.batches[0].requests)});
    assert.throws(() => validateSpec(s), /DUPLICATE_SLOT/);
    const t = fixture(), l = reserve(t, newLedger(t, approval(t, total(t))));
    assert.throws(() => reserve(t, l), /SLOT_ALREADY_RESERVED/);
    l.slots[slotKey(t.batches[0].requests[0])].requestId = randomUUID(); assert.throws(() => account(t, l), /SLOT_BINDING/);
  });
  test('self judging, unknown models and wrong calibration phase are rejected', () => {
    for (const mutate of [d => { d.role = 'judge'; }, d => { d.modelId = 'gpt-unknown'; }, d => { d.role = 'calibration'; }]) {
      const s = fixture(); mutate(s.batches[0].requests[0]); assert.throws(() => validateSpec(s));
    }
  });
  test('old protocol, other run/spec and leftover balance approval fields cannot transfer', () => {
    for (const mutate of [a => { a.protocol = 'additional-7usd-remediation-v4'; }, a => { a.runId = randomUUID(); },
      a => { a.specHash = digest('other source'); }, a => { a.remainingMicros = '7000000'; }, a => { a.kind = 'user-approval'; }]) {
      const s = fixture(), a = approval(s, total(s)); mutate(a); assert.throws(() => newLedger(s, a));
    }
  });
  test('synthetic price/approval cannot authorize evaluation mode; no live dispatch capability is exposed', () => {
    const s = fixture(); s.mode = 'evaluation'; assert.throws(() => newLedger(s, approval(s, total(s))), /QUOTE_BINDING/);
    s.quote.kind = 'verified-price'; assert.throws(() => newLedger(s, approval(s, total(s))), /APPROVAL_PROVENANCE/);
    const a = approval(s); assert.equal(account(s, newLedger(s, a)).realDispatchAuthorized, false);
  });
  test('completed known bounded usage settles lower and terminal records cannot be changed', () => {
    const s = fixture(), key = slotKey(s.batches[0].requests[0]);
    const l = consume(s, reserve(s, newLedger(s, approval(s, total(s)))), key);
    const done = settle(s, l, key, 'completed', {inputTokens: 100, outputTokens: 10});
    assert.equal(account(s, done).upperMicros, '440'); assert.equal(account(s, done).knownUsageSlots, 1);
    assert.throws(() => settle(s, done, key, 'completed', {inputTokens: 0, outputTokens: 0}), /SLOT_NOT_CONSUMED/);
    assert.throws(() => consume(s, done, key), /SLOT_NOT_UNSENT/);
  });
  test('failed, missing usage, and unknown result all retain maximum reservation', () => {
    for (const [state, usage] of [['failed', {inputTokens: 1, outputTokens: 1}], ['unknown', null], ['completed', null]]) {
      const s = fixture(), key = slotKey(s.batches[0].requests[0]);
      const l = consume(s, reserve(s, newLedger(s, approval(s, total(s)))), key);
      assert.equal(account(s, settle(s, l, key, state, usage)).upperMicros, total(s));
    }
  });
  test('over-bound input/output retain result evidence, hold all new consumption and retain maximum', () => {
    for (const usage of [{inputTokens: 1001, outputTokens: 1}, {inputTokens: 1, outputTokens: 4097}]) {
      const s = fixture([descriptor(), descriptor('case-two')]), key = slotKey(s.batches[0].requests[0]);
      const l = consume(s, reserve(s, newLedger(s, approval(s, total(s)))), key), held = settle(s, l, key, 'completed', usage);
      assert.equal(held.hold, 'USAGE_BOUND'); assert.equal(held.slots[key].evidenceHash, h); assert.equal(account(s, held).upperMicros, total(s));
      assert.throws(() => consume(s, held, slotKey(s.batches[0].requests[1])), /CONSUMPTION_HELD/);
    }
  });
  test('approval reduction/withdrawal stops new consumption without resetting used reservations', () => {
    const s = fixture(), key = slotKey(s.batches[0].requests[0]), l = reserve(s, newLedger(s, approval(s, total(s))));
    const held = transition(s, l, {kind: 'approval', approval: approval(s)});
    assert.equal(held.hold, 'AUTHORIZATION_REDUCED'); assert.equal(account(s, held).upperMicros, total(s));
    assert.equal(account(s, held).overBudget, true); assert.throws(() => consume(s, held, key), /CONSUMPTION_HELD/);
  });
  test('close releases only unsent reservations; consumed or unknown requests keep their maximum', () => {
    const s = fixture([descriptor(), descriptor('case-two')]), key = slotKey(s.batches[0].requests[0]);
    const l = consume(s, reserve(s, newLedger(s, approval(s, total(s)))), key);
    const closed = transition(s, l, {kind: 'close'});
    assert.equal(closed.slots[key].state, 'consumed'); assert.equal(Object.values(closed.slots)[1].state, 'unused');
    assert.equal(account(s, closed).upperMicros, costUpperMicros(s, s.batches[0].requests[0]));
    assert.throws(() => reserve(s, closed), /RESERVATION_HELD/);
  });
  test('durable reservation reopens with the same cost/UUID; consumption creates a separate verified snapshot', () => {
    const ctx = store(), key = slotKey(ctx.spec.batches[0].requests[0]);
    const r = transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-one'}});
    assert.equal(r.head.index, 1); assert.deepEqual(readBudgetStore(ctx), r);
    assert.equal(account(ctx.spec, r.ledger).upperMicros, total(ctx.spec));
    const consumed = transactBudgetStore({...ctx, operation: {kind: 'consume', key}});
    assert.equal(consumed.head.index, 2); assert.equal(consumed.ledger.slots[key].requestId, r.ledger.slots[key].requestId);
    assert.equal(readdirSync(ctx.directory).filter(f => /^\d{6}\.json$/.test(f)).length, 3);
  });
  test('persisted whole-batch rejection has no partial journal or head change', () => {
    const s = fixture([descriptor(), descriptor('case-two')]), ctx = store(s, (BigInt(total(s)) - 1n).toString());
    const before = readFileSync(resolve(ctx.directory, 'HEAD.json'));
    assert.throws(() => transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-one'}}), /INSUFFICIENT_WHOLE_BATCH/);
    assert.deepEqual(readFileSync(resolve(ctx.directory, 'HEAD.json')), before);
    assert.deepEqual(readdirSync(ctx.directory).sort(), ['000000.json', 'HEAD.json']);
  });
  test('two real processes cannot reserve the same batch twice', async () => {
    const ctx = store(), result = await race(ctx, ['batch-one', 'batch-one']);
    assert.equal(result.head.index, 1); assert.equal(account(ctx.spec, result.ledger).slots, 1);
  });
  test('two processes competing for different batches cannot jointly exceed a one-batch budget', async () => {
    const s = fixture(); s.batches.push({id: 'batch-two', requests: [descriptor('case-two')]});
    const ctx = store(s, costUpperMicros(s, s.batches[0].requests[0])), result = await race(ctx, ['batch-one', 'batch-two']);
    assert.equal(result.head.index, 1); assert.equal(account(s, result.ledger).slots, 1); assert.equal(account(s, result.ledger).remainingMicros, '0');
  });
  test('different batches cannot spend a balance already reserved by another writer', () => {
    const s = fixture(); s.batches.push({id: 'batch-two', requests: [descriptor('case-two')]});
    const ctx = store(s, costUpperMicros(s, s.batches[0].requests[0]));
    transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-one'}});
    assert.throws(() => transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-two'}}), /INSUFFICIENT_WHOLE_BATCH/);
    assert.equal(readBudgetStore(ctx).head.index, 1);
  });
  test('injected Windows EPERM preserves old HEAD and prepared evidence, then blocks every retry', () => {
    const ctx = store(), before = readFileSync(resolve(ctx.directory, 'HEAD.json'));
    assert.throws(() => transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-one'}, testFault(stage) {
      if (stage === 'head:before-rename') { const e = new Error('injected rename refusal'); e.code = 'EPERM'; throw e; }
    }}), {code: 'EPERM'});
    assert.deepEqual(readFileSync(resolve(ctx.directory, 'HEAD.json')), before);
    assert.ok(readdirSync(ctx.directory).some(f => f.endsWith('.tmp'))); assert.ok(readdirSync(ctx.directory).includes('000001.json'));
    assert.throws(() => readBudgetStore(ctx), /STORE_PREPARED_OR_FOREIGN_FILES/);
    assert.throws(() => transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-one'}}), /STORE_PREPARED_OR_FOREIGN_FILES/);
  });
  test('foreign lock is never reclaimed and new-store initialization never resets an existing run', () => {
    const ctx = store(), lock = resolve(ctx.directory, 'LOCK.json'), body = JSON.stringify({nonce: 'foreign', pid: 999999});
    writeFileSync(lock, body); assert.throws(() => transactBudgetStore({...ctx, operation: {kind: 'reserve', batchId: 'batch-one'}}), {code: 'EEXIST'});
    assert.equal(readFileSync(lock, 'utf8'), body);
    assert.throws(() => createBudgetStore({...ctx, approval: approval(ctx.spec)}), {code: 'EEXIST'});
  });
  test('tampered journal and changed source/spec fingerprint cannot be opened', () => {
    const ctx = store(), changed = clone(ctx.spec); changed.sourceSeal = digest('changed');
    assert.throws(() => readBudgetStore({...ctx, spec: changed}), /STORE_CHAIN/);
    const file = resolve(ctx.directory, '000000.json'), old = readFileSync(file, 'utf8');
    writeFileSync(resolve(evidenceRoot, `before-tamper-${ctx.spec.runId}.json`), old);
    const snap = JSON.parse(old); snap.ledger.closed = true; writeFileSync(file, JSON.stringify(snap));
    assert.throws(() => readBudgetStore(ctx), /STORE_TRANSITION/);
  });
  test('error messages omit arbitrary case text and raw usage values', () => {
    const secret = 'SYNTHETIC_PRIVATE_TEXT'; const s = fixture(); s.batches[0].requests[0].caseId = secret;
    assert.throws(() => validateSpec(s), error => !error.message.includes(secret) && error.message === 'REQUEST_IDENTITY');
    const t = fixture(), key = slotKey(t.batches[0].requests[0]);
    const l = consume(t, reserve(t, newLedger(t, approval(t, total(t)))), key);
    assert.throws(() => settle(t, l, key, 'completed', {inputTokens: secret, outputTokens: 1}), error => error.message === 'USAGE_SCHEMA');
  });
}
