import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {PROTOCOL, PLAN, MODELS, digest, slotKey, account} from './ai-quality-v147-budget.mjs';
import {createBudgetStore, readBudgetStore, transactBudgetStore} from './ai-quality-v147-budget-store.mjs';
import {dispatchSyntheticOnce, recoverCapturedSynthetic, recoverSyntheticReceipt} from './ai-quality-v147-dispatch.mjs';

const script = fileURLToPath(import.meta.url), h = digest('synthetic local-only dispatch test');
const response = modelId => ({status: 'completed', modelId, usage: {inputTokens: 10, outputTokens: 10}, outputHash: h});
const usageMax = ctx => account(ctx.spec, readBudgetStore(ctx).ledger).upperMicros;
function counter(path) { return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean) : []; }
function sender(file, result) { return async ({requestId}) => { appendFileSync(file, requestId + '\n'); return result; }; }
const childMode = process.argv[2];
if (['--crash-child', '--race-child'].includes(childMode)) {
  const input = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const run = async () => {
    try {
      await dispatchSyntheticOnce({...input, transport: sender(input.counterFile, response(input.body.model)), testFault(stage) {
        if (stage === input.crashStage) process.exit(73);
      }});
      process.stdout.write('settled\n');
    } catch { process.stdout.write('held\n'); }
  };
  if (childMode === '--race-child') { process.stdout.write('ready\n'); process.stdin.once('data', async () => { await run(); process.stdin.destroy(); }); }
  else await run();
} else {
  const root = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(script), '../../work', `dispatch-test-${randomUUID()}`));
  mkdirSync(root, {recursive: true});
  function fixture(role = 'generation') {
    const modelId = role === 'judge' ? MODELS[1] : MODELS[0], body = {model: modelId, max_output_tokens: role === 'generation' ? 4096 : 1000, input: 'SYNTHETIC FIXED BODY'};
    const d = {phase: role === 'calibration' ? 'calibration' : 'candidate', caseId: 'synthetic-case', targetModelId: MODELS[0], modelId, role,
      repetition: 1, inputTokenMax: 1000, outputTokenMax: body.max_output_tokens, inputBoundHash: h, bodyCommitment: digest(body)};
    const spec = {schemaVersion: 1, protocol: PROTOCOL, planId: PLAN, runId: randomUUID(), mode: 'synthetic', sourceSeal: h,
      quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1',
        models: Object.fromEntries(MODELS.map(id => [id, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'case-batch', requests: [d]}]};
    const context = {directory: resolve(root, spec.runId), allowedRoot: root, spec}, approval = {schemaVersion: 1, protocol: PROTOCOL, runId: spec.runId,
      specHash: digest(spec), kind: 'synthetic-test', amountMicros: '1000000', evidenceHash: h};
    createBudgetStore({...context, approval}); transactBudgetStore({...context, operation: {kind: 'reserve', batchId: 'case-batch'}});
    return {context, key: slotKey(d), body, counterFile: resolve(root, `counter-${spec.runId}.log`)};
  }
  function slot(f) { return readBudgetStore(f.context).ledger.slots[f.key]; }
  const send = f => dispatchSyntheticOnce({...f, transport: sender(f.counterFile, response(f.body.model))});
  const captureFile = f => resolve(root, `${f.context.spec.runId}-captures`, slot(f).requestId + '.json');

  test('generation, main judge and calibration each persist consumption before their one synthetic transport', async () => {
    for (const role of ['generation', 'judge', 'calibration']) {
      const f = fixture(role); const initial = usageMax(f.context);
      const r = await dispatchSyntheticOnce({...f, transport: async ({requestId}) => {
        assert.equal(slot(f).state, 'consumed'); assert.equal(slot(f).requestId, requestId); appendFileSync(f.counterFile, requestId + '\n');
        return response(f.body.model);
      }});
      assert.equal(r.status, 'completed'); assert.equal(counter(f.counterFile).length, 1); assert.equal(slot(f).state, 'completed');
      assert.equal(account(f.context.spec, readBudgetStore(f.context).ledger).upperMicros, '20'); assert.ok(BigInt(initial) > 20n);
      assert.equal(recoverCapturedSynthetic(f).status, 'already-settled'); assert.equal(counter(f.counterFile).length, 1);
    }
  });
  test('completed request cannot be sent again or reassigned a new UUID', async () => {
    const f = fixture(); await send(f); const requestId = slot(f).requestId;
    await assert.rejects(send(f), /NO_AUTOMATIC_RESEND/); assert.equal(slot(f).requestId, requestId); assert.equal(counter(f.counterFile).length, 1);
    assert.throws(() => transactBudgetStore({...f.context, operation: {kind: 'reserve', batchId: 'case-batch'}}), /SLOT_ALREADY_RESERVED/);
  });
  test('transport timeout keeps the consumed maximum; caller retry never redispatches', async () => {
    const f = fixture(), before = usageMax(f.context);
    const r = await dispatchSyntheticOnce({...f, transport: async ({requestId}) => { appendFileSync(f.counterFile, requestId + '\n'); throw new Error('SYNTHETIC_PRIVATE_ERROR'); }});
    assert.deepEqual(r, {status: 'held', reason: 'TRANSPORT_UNKNOWN', requestId: slot(f).requestId});
    assert.equal(slot(f).state, 'consumed'); assert.equal(usageMax(f.context), before); await assert.rejects(send(f), /NO_AUTOMATIC_RESEND/);
    assert.equal(counter(f.counterFile).length, 1);
  });
  test('exact same-UUID receipt resolves an unknown request without any transport argument', async () => {
    const f = fixture(); await dispatchSyntheticOnce({...f, transport: async ({requestId}) => { appendFileSync(f.counterFile, requestId + '\n'); throw new Error('timeout'); }});
    const requestId = slot(f).requestId;
    assert.equal(recoverSyntheticReceipt({...f, receipt: {requestId, bodyHash: digest(f.body), result: response(f.body.model)}}).status, 'completed');
    assert.equal(slot(f).requestId, requestId); assert.equal(counter(f.counterFile).length, 1);
  });
  test('wrong request/body/source receipts do not release maximum or change slots', async () => {
    const f = fixture(); await dispatchSyntheticOnce({...f, transport: async () => { throw new Error('timeout'); }});
    const before = digest(readBudgetStore(f.context).ledger);
    for (const receipt of [{requestId: randomUUID(), bodyHash: digest(f.body), result: response(f.body.model)},
      {requestId: slot(f).requestId, bodyHash: h, result: response(f.body.model)}]) assert.throws(() => recoverSyntheticReceipt({...f, receipt}), /RECEIPT_BINDING/);
    assert.equal(digest(readBudgetStore(f.context).ledger), before);
    const foreign = structuredClone(f.context); foreign.spec.sourceSeal = digest('different');
    assert.throws(() => recoverSyntheticReceipt({...f, context: foreign, receipt: {}}), /STORE_CHAIN/);
  });
  test('changed body/model/output cap fails before consumption or transport', async () => {
    const f = fixture();
    for (const body of [{...f.body, input: 'changed'}, {...f.body, model: MODELS[1]}, {...f.body, max_output_tokens: 768}])
      await assert.rejects(dispatchSyntheticOnce({...f, body, transport: sender(f.counterFile, response(f.body.model))}), /WIRE_BINDING/);
    assert.equal(slot(f).state, 'reserved'); assert.equal(counter(f.counterFile).length, 0);
  });
  test('withdrawn approval and live evaluation mode are rejected before any callback', async () => {
    const f = fixture(), a = {schemaVersion: 1, protocol: PROTOCOL, runId: f.context.spec.runId, specHash: digest(f.context.spec), kind: 'unapproved', amountMicros: '0', evidenceHash: null};
    transactBudgetStore({...f.context, operation: {kind: 'approval', approval: a}}); await assert.rejects(send(f), /CONSUMPTION_HELD/);
    const foreign = structuredClone(f.context); foreign.spec.mode = 'evaluation';
    await assert.rejects(dispatchSyntheticOnce({...f, context: foreign, transport: sender(f.counterFile, response(f.body.model))}), /LIVE_EVALUATION_NOT_SUPPORTED/);
    assert.equal(counter(f.counterFile).length, 0); assert.equal(slot(f).state, 'reserved');
  });
  test('failed/mismatched-model responses retain maximum and cannot be retransmitted', async () => {
    for (const value of [{...response(MODELS[0]), status: 'failed'}, response(MODELS[1])]) {
      const f = fixture(), before = usageMax(f.context); assert.equal((await dispatchSyntheticOnce({...f, transport: sender(f.counterFile, value)})).status, 'failed');
      assert.equal(usageMax(f.context), before); await assert.rejects(send(f), /NO_AUTOMATIC_RESEND/); assert.equal(counter(f.counterFile).length, 1);
    }
  });
  test('captured response survives interrupted settlement and recovery is idempotent', async () => {
    const f = fixture(); await assert.rejects(dispatchSyntheticOnce({...f, transport: sender(f.counterFile, response(f.body.model)), testFault(stage) {
      if (stage === 'after-capture-before-settle') throw new Error('injected interruption');
    }}), /injected interruption/);
    assert.equal(slot(f).state, 'consumed'); assert.equal(recoverCapturedSynthetic(f).status, 'completed');
    const final = digest(readBudgetStore(f.context)); assert.equal(recoverCapturedSynthetic(f).status, 'already-settled'); assert.equal(digest(readBudgetStore(f.context)), final);
    assert.equal(counter(f.counterFile).length, 1);
  });
  test('damaged capture cannot settle or cause a resend', async () => {
    const f = fixture(); await assert.rejects(dispatchSyntheticOnce({...f, transport: sender(f.counterFile, response(f.body.model)), testFault(stage) {
      if (stage === 'after-capture-before-settle') throw new Error('stop');
    }}));
    const file = captureFile(f), original = readFileSync(file, 'utf8'); writeFileSync(resolve(root, `capture-before-damage-${f.context.spec.runId}.json`), original);
    const e = JSON.parse(original); e.record.usage.inputTokens = 0; writeFileSync(file, JSON.stringify(e));
    assert.throws(() => recoverCapturedSynthetic(f), /CAPTURE_HASH/); await assert.rejects(send(f), /NO_AUTOMATIC_RESEND/); assert.equal(slot(f).state, 'consumed');
  });
  test('over-bound captured usage holds accounting instead of releasing reservation', async () => {
    const f = fixture(), before = usageMax(f.context); const value = response(f.body.model); value.usage.outputTokens = 4097;
    assert.equal((await dispatchSyntheticOnce({...f, transport: sender(f.counterFile, value)})).status, 'held');
    assert.equal(readBudgetStore(f.context).ledger.hold, 'USAGE_BOUND'); assert.equal(usageMax(f.context), before);
  });
  test('real child termination at four boundaries preserves call counts and same request identity', async () => {
    const records = [];
    for (const crashStage of ['before-consume', 'after-consume-before-transport', 'after-transport-before-capture', 'after-capture-before-settle']) {
      const f = fixture(), beforeId = slot(f).requestId, input = resolve(root, `crash-${f.context.spec.runId}.json`);
      writeFileSync(input, JSON.stringify({...f, crashStage}));
      const p = spawnSync(process.execPath, [script, '--crash-child', input], {windowsHide: true, timeout: 10000, encoding: 'utf8'});
      assert.equal(p.status, 73); assert.equal(p.stderr, ''); assert.equal(slot(f).requestId, beforeId);
      const callsBefore = counter(f.counterFile).length;
      if (crashStage === 'before-consume') { assert.equal(slot(f).state, 'reserved'); assert.equal(callsBefore, 0); await send(f); }
      else {
        assert.equal(slot(f).state, 'consumed'); await assert.rejects(send(f), /NO_AUTOMATIC_RESEND/);
        if (crashStage === 'after-capture-before-settle') assert.equal(recoverCapturedSynthetic(f).status, 'completed');
        else if (crashStage === 'after-transport-before-capture') assert.equal(recoverSyntheticReceipt({...f, receipt: {requestId: beforeId, bodyHash: digest(f.body), result: response(f.body.model)}}).status, 'completed');
      }
      assert.equal(counter(f.counterFile).length, crashStage === 'after-consume-before-transport' ? 0 : 1);
      records.push({crashStage, exitCode: p.status, requestId: beforeId, callsBefore, callsAfter: counter(f.counterFile).length, finalState: slot(f).state});
    }
    writeFileSync(resolve(root, 'process-boundaries.json'), JSON.stringify({realProviderCalls: 0, records}, null, 2));
  });
  test('two real processes sharing one reserved slot invoke at most one synthetic transport', async () => {
    const f = fixture(), input = resolve(root, `race-${f.context.spec.runId}.json`); writeFileSync(input, JSON.stringify(f));
    const children = [0, 1].map(() => {
      const child = spawn(process.execPath, [script, '--race-child', input], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']}); let output = '', errors = '';
      const ready = new Promise((res, rej) => { const timer = setTimeout(() => { child.kill(); rej(new Error('READY_TIMEOUT')); }, 10000);
        child.stdout.on('data', data => { output += data.toString(); if (output.includes('ready')) { clearTimeout(timer); res(); } }); child.on('error', rej); });
      child.stderr.on('data', data => { errors += data.toString(); });
      const done = new Promise((res, rej) => { const timer = setTimeout(() => { child.kill(); rej(new Error('EXIT_TIMEOUT')); }, 15000);
        child.on('error', e => { clearTimeout(timer); rej(e); }); child.on('exit', code => { clearTimeout(timer); if (code === 0) res(); else rej(new Error('CHILD_EXIT')); }); });
      return {child, ready, done, output: () => output, errors: () => errors};
    });
    await Promise.all(children.map(c => c.ready)); children.forEach(c => c.child.stdin.end('go\n')); await Promise.all(children.map(c => c.done));
    assert.equal(children.filter(c => c.output().includes('settled')).length, 1); assert.ok(children.every(c => c.errors() === ''));
    assert.equal(counter(f.counterFile).length, 1); assert.equal(slot(f).state, 'completed');
    writeFileSync(resolve(root, 'dispatch-process-race.json'), JSON.stringify({outputs: children.map(c => c.output()), requestIds: counter(f.counterFile), realProviderCalls: 0}));
  });
}
