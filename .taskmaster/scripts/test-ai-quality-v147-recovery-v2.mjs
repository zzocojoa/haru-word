import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {PROTOCOL_V2, MODELS, digest, slotKey, accountV2} from './ai-quality-v147-budget-v2.mjs';
import {PLAN} from './ai-quality-v147-budget.mjs';
import {createV2Journal, readV2Journal, openV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {captureResultV2, inspectCaptureV2, readCaptureV2, settleCaptureV2} from './ai-quality-v147-capture-v2.mjs';
import {inspectV2Recovery, recoverV2Journal} from './ai-quality-v147-recovery-v2.mjs';
const script = fileURLToPath(import.meta.url), h = digest('synthetic recovery fixture,not real budget or approval'), sha = x => createHash('sha256').update(x).digest('hex');
const rawPayload = JSON.stringify({original: 'Keep warm.', meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: 'Keep warm.', explanation: '합성 복구 검사'}), usage = {inputTokens: 10, outputTokens: 10};
function fixture() {
  const d = {phase: 'candidate', caseId: 'case-one', targetModelId: MODELS[0], modelId: MODELS[0], role: 'generation', repetition: 1, inputTokenMax: 2000, outputTokenMax: 4096, inputBoundHash: h, bodyCommitment: h}, key = slotKey(d);
  const spec = {schemaVersion: 1, protocol: PROTOCOL_V2, planId: PLAN, runId: randomUUID(), mode: 'synthetic', sourceSeal: h, quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1', models: Object.fromEntries(MODELS.map(m => [m, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'generation-one', requests: [d]}], wirePolicies: {[key]: {kind: 'static', bodySha256: h, templateHash: null, parentKey: null, maximumBytes: 65536}}};
  const approval = {schemaVersion: 1, protocol: PROTOCOL_V2, runId: spec.runId, specHash: digest(spec), kind: 'synthetic-test', amountMicros: '1000000', evidenceHash: h}; return {spec, approval, key};
}
function bound(f, ledger) {return {sourceSeal: f.spec.sourceSeal, requestId: ledger.slots[f.key].requestId, bodySha256: h, bodyDigest: h, bytes: 100, parentKey: null, parentRequestId: null, parentOutputHash: null, parentReceiptHash: null, templateHash: null};}
function child(args) {
  const cp = spawn(process.execPath, [script, ...args], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']}); let stdout = '', stderr = '';
  cp.stdout.on('data', x => {stdout += x.toString();}); cp.stderr.on('data', x => {stderr += x.toString();});
  const done = new Promise((res, rej) => {const timer = setTimeout(() => {if (cp.exitCode === null) cp.kill(); rej(new Error('V2R_CHILD_TIMEOUT'));}, 30000); cp.on('error', e => {clearTimeout(timer); rej(e);}); cp.on('exit', code => {clearTimeout(timer); res(code);});});
  return {cp, done, output: () => stdout, errors: () => stderr};
}
async function text(cp, match) {
  return new Promise((res, rej) => {const timer = setTimeout(() => rej(new Error('V2R_SIGNAL_TIMEOUT')), 10000); const on = () => {if (match(cp.output())) {clearTimeout(timer); cp.cp.stdout.off('data', on); res();}}; cp.cp.stdout.on('data', on); on();});
}

if (process.argv[2] === '--writer-child') {
  const [directory, allowedRoot, specFile, action, stage] = process.argv.slice(3), spec = JSON.parse(readFileSync(specFile, 'utf8')), context = {directory, allowedRoot, spec}, session = openV2Journal(context), key = slotKey(spec.batches[0].requests[0]);
  const fault = point => {if (point === stage) process.exit(78);};
  if (action === 'consume') session.append({kind: 'consume', key}, fault);
  else {const capture = captureResultV2({context, ledger: session.current().ledger, key, state: 'completed', usage, payloadRaw: rawPayload, testFault: action === 'capture' ? fault : undefined}); if (action === 'settle') session.append({kind: 'settle', key, state: 'completed', usage, result: capture.result}, fault);}
  session.close(); process.exit(0);
} else if (process.argv[2] === '--recover-child') {
  const [directory, allowedRoot, specFile, stage] = process.argv.slice(3), spec = JSON.parse(readFileSync(specFile, 'utf8')), context = {directory, allowedRoot, spec}, plan = inspectV2Recovery(context);
  await recoverV2Journal({context, expectedInspectionHash: plan.inspectionHash, testFault: point => {if (point === stage) process.exit(79);}}); process.exit(0);
} else if (process.argv[2] === '--race-child') {
  const [directory, allowedRoot, specFile, expected] = process.argv.slice(3), spec = JSON.parse(readFileSync(specFile, 'utf8')), context = {directory, allowedRoot, spec}; process.stdout.write('ready\n');
  process.stdin.once('data', async () => {try {const result = await recoverV2Journal({context, expectedInspectionHash: expected}); process.stdout.write(result.status + '\n');} catch {process.stdout.write('held\n');} finally {process.stdin.destroy();}});
} else {
  const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(script), '../../work', 'recovery-v2-' + randomUUID())); mkdirSync(out, {recursive: true});
  const observations = {actualProviderCalls: 0, actualKeyReads: 0, actualPaidApprovalUsd: 0, task22Complete: false, writerExits: [], recoveryExits: [], captures: [], recoveries: [], processRace: null};
  function store(consumed = false) {
    const f = fixture(), context = {directory: resolve(out, f.spec.runId), allowedRoot: out, spec: f.spec}; createV2Journal(context, f.approval); const session = openV2Journal(context);
    session.append({kind: 'reserve', batchId: 'generation-one'}); session.append({kind: 'bind', key: f.key, binding: bound(f, session.current().ledger)});
    if (consumed) session.append({kind: 'consume', key: f.key}); session.close();
    const specFile = resolve(out, 'spec-' + f.spec.runId + '.json'); writeFileSync(specFile, JSON.stringify(f.spec)); const sends = resolve(out, f.spec.runId + '-fake-sends.txt'); writeFileSync(sends, consumed ? 'sent\n' : '');
    return {...f, context, specFile, sends};
  }
  const hashes = directory => Object.fromEntries(readdirSync(directory).sort().map(name => [name, sha(readFileSync(resolve(directory, name)))]));
  async function crash(f, action = 'consume', stage = 'head:before-rename') {
    const cp = child(['--writer-child', f.context.directory, out, f.specFile, action, stage]); assert.equal(await cp.done, 78); assert.equal(cp.errors(), ''); observations.writerExits.push({runId: f.spec.runId, action, stage, exitCode: 78});
  }
  async function recover(f) {const plan = inspectV2Recovery(f.context), result = await recoverV2Journal({context: f.context, expectedInspectionHash: plan.inspectionHash}); if (result.evidenceDirectory) observations.recoveries.push({runId: f.spec.runId, directory: result.evidenceDirectory, noDispatch: result.noDispatchPerformed}); return result;}

  test('captured visible payload is immutable and bound to consumed UUID/body/source;settlement is idempotent without dispatch', () => {
    const f = store(true), session = openV2Journal(f.context), ledger = session.current().ledger;
    const capture = captureResultV2({context: f.context, ledger, key: f.key, state: 'completed', usage, payloadRaw: rawPayload}); assert.equal(capture.receiptAuthenticated, false); assert.equal(capture.payloadRaw, rawPayload);
    assert.throws(() => captureResultV2({context: f.context, ledger, key: f.key, state: 'completed', usage, payloadRaw: rawPayload}));
    const before = readFileSync(f.sends); assert.equal(settleCaptureV2({context: f.context, session, key: f.key}).status, 'completed'); assert.equal(settleCaptureV2({context: f.context, session, key: f.key}).status, 'already-settled'); assert.deepEqual(readFileSync(f.sends), before); session.close();
    observations.captures.push({runId: f.spec.runId, files: capture.files, exactResultHash: capture.evidenceHash, sent: 1});
  });

  test('foreign/extra visible fields,changed payload/usage and incomplete receipts cannot manufacture a valid settlement', () => {
    const f = store(true), session = openV2Journal(f.context), ledger = session.current().ledger;
    assert.throws(() => captureResultV2({context: f.context, ledger, key: f.key, state: 'completed', usage, payloadRaw: JSON.stringify({...JSON.parse(rawPayload), secret: 'SYNTHETIC_PRIVATE'})}), /V2C_VISIBLE_FIELDS/);
    const capture = captureResultV2({context: f.context, ledger, key: f.key, state: 'completed', usage, payloadRaw: rawPayload}), file = resolve(capture.directory, ledger.slots[f.key].requestId + '.payload.txt'); writeFileSync(file, rawPayload + ' ');
    assert.throws(() => settleCaptureV2({context: f.context, session, key: f.key}), /V2C_BINDING/); assert.equal(session.current().ledger.slots[f.key].state, 'consumed'); session.close();
    const other = store(true), active = openV2Journal(other.context), current = active.current().ledger, saved = captureResultV2({context: other.context, ledger: current, key: other.key, state: 'completed', usage, payloadRaw: rawPayload});
    const preparedFile = resolve(saved.directory, saved.result.requestId + '.prepared.json'), changed = JSON.parse(readFileSync(preparedFile, 'utf8')); changed.result.usage = {inputTokens: 1, outputTokens: 1}; writeFileSync(preparedFile, JSON.stringify(changed) + '\n');
    assert.throws(() => settleCaptureV2({context: other.context, session: active, key: other.key}), /V2C_RECEIPT_CHANGED/); active.close();
  });

  test('a live writer lease cannot be recovered or replaced', () => {
    const f = store(), session = openV2Journal(f.context), before = hashes(f.context.directory); assert.throws(() => inspectV2Recovery(f.context), /V2R_OWNER_LIVE/); assert.deepEqual(hashes(f.context.directory), before); session.close();
  });

  test('complete prepared consume and already-committed pending recover to same UUID with zero added fake sends', async () => {
    for (const stage of ['head:before-fsync', 'head:before-rename', 'head:after-rename', 'pending:after-unlink']) {
      const f = store(); await crash(f, 'consume', stage); const before = readFileSync(f.sends); assert.equal((await recover(f)).noDispatchPerformed, true);
      const session = openV2Journal(f.context), row = session.current().ledger.slots[f.key]; assert.equal(row.state, 'consumed'); assert.throws(() => session.append({kind: 'consume', key: f.key})); session.close(); assert.deepEqual(readFileSync(f.sends), before);
    }
  });

  test('incomplete append remains held with exact bytes preserved,no reset or provider retry', async () => {
    const f = store(); await crash(f, 'consume', 'pending:after-fsync'); const before = hashes(f.context.directory); assert.throws(() => inspectV2Recovery(f.context), /V2J_INCOMPLETE_APPEND/); assert.deepEqual(hashes(f.context.directory), before); assert.equal(readFileSync(f.sends).length, 0);
  });

  test('prepared settlement requires the exact captured payload/result/usage and completes with no additional send', async () => {
    const f = store(true); await crash(f, 'settle'); const count = readFileSync(f.sends); await recover(f);
    const ledger = readV2Journal(f.context).ledger, capture = readCaptureV2({context: f.context, ledger, key: f.key}); assert.equal(ledger.slots[f.key].state, 'completed'); assert.equal(ledger.slots[f.key].evidenceHash, capture.evidenceHash); assert.deepEqual(readFileSync(f.sends), count);
  });

  test('capture interruption is completed from the same prepared payload only;missing payload stays consumed at maximum', async () => {
    for (const stage of ['capture-prepared:after-fsync', 'capture-payload:before-fsync', 'capture-payload:after-fsync', 'capture-receipt:before-fsync']) {
      const f = store(true); await crash(f, 'capture', stage); await recover(f); const session = openV2Journal(f.context), before = readFileSync(f.sends);
      if (stage.startsWith('capture-prepared')) {assert.throws(() => settleCaptureV2({context: f.context, session, key: f.key})); assert.equal(session.current().ledger.slots[f.key].state, 'consumed'); assert.ok(BigInt(accountV2(f.spec, session.current().ledger).upperMicros) > 0n);}
      else assert.equal(settleCaptureV2({context: f.context, session, key: f.key}).status, 'completed');
      session.close(); assert.deepEqual(readFileSync(f.sends), before);
    }
  });

  test('changed inspection or capture evidence holds before any recovery mutation', async () => {
    const f = store(true); await crash(f, 'settle'); const plan = inspectV2Recovery(f.context), before = hashes(f.context.directory);
    await assert.rejects(recoverV2Journal({context: f.context, expectedInspectionHash: h}), /V2R_INSPECTION_CHANGED/); assert.deepEqual(hashes(f.context.directory), before);
    const ledger = readFileSync(resolve(f.context.directory, 'PENDING.json'), 'utf8'), pending = JSON.parse(ledger), result = pending.record.operation.result;
    const capture = inspectCaptureV2({context: f.context, ledger: (await import('./ai-quality-v147-journal-v2.mjs')).replayV2Prefix(f.context, pending.from, readFileSync(resolve(f.context.directory, 'CHAIN.jsonl'))).ledger, key: f.key, expectedResult: result});
    writeFileSync(resolve(capture.directory, result.requestId + '.payload.txt'), rawPayload + ' '); assert.throws(() => inspectV2Recovery(f.context), /V2C_BINDING/); assert.equal(plan.pending.operationKind, 'settle');
  });

  test('recovery itself may exit at3 boundaries and resumes through its bound audit/owned-lock chain without sends', async () => {
    for (const stage of ['recovery:after-lock-acquire', 'recovery:after-head-rename', 'recovery:after-pending-archive']) {
      const f = store(); await crash(f); const cp = child(['--recover-child', f.context.directory, out, f.specFile, stage]); assert.equal(await cp.done, 79); assert.equal(cp.errors(), '');
      observations.recoveryExits.push({runId: f.spec.runId, stage, exitCode: 79}); await recover(f); assert.equal(readV2Journal(f.context).ledger.slots[f.key].state, 'consumed'); assert.equal(readFileSync(f.sends).length, 0);
    }
  });

  test('two actual recoverers serialize;one recovers and the stale inspection holds without stealing a new live lease', async () => {
    const f = store(); await crash(f); const plan = inspectV2Recovery(f.context), pair = [0, 1].map(() => child(['--race-child', f.context.directory, out, f.specFile, plan.inspectionHash]));
    await Promise.all(pair.map(cp => text(cp, t => t.includes('ready')))); pair.forEach(cp => cp.cp.stdin.end('recover\n'));
    for (const cp of pair) {assert.equal(await cp.done, 0); assert.equal(cp.errors(), '');}
    const recovered = pair.filter(cp => /\nrecovered\n/.test(cp.output())).length; assert.equal(recovered, 1); assert.equal(pair.filter(cp => /\nheld\n/.test(cp.output())).length, 1);
    assert.equal(readV2Journal(f.context).ledger.slots[f.key].state, 'consumed'); observations.processRace = {recovered: 1, staleHeld: 1, sends: 0};
  });

  test('actual Windows HEAD deny-delete handle causes EPERM;release and explicit recovery preserve the same consumed UUID', async () => {
    const f = store(); await crash(f); const helper = resolve(out, 'hold-head-' + f.spec.runId + '.ps1');
    writeFileSync(helper, "param([string]$AiqTargetPath)\n$ErrorActionPreference='Stop'\n$AiqHeldStream=[IO.File]::Open($AiqTargetPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)\ntry{[Console]::WriteLine('ready');[Console]::Out.Flush();[Console]::In.ReadLine()|Out-Null}finally{$AiqHeldStream.Dispose()}\n");
    const holder = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', helper, resolve(f.context.directory, 'HEAD.json')], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']}); let output = '', errors = '';
    holder.stdout.on('data', x => {output += x.toString();}); holder.stderr.on('data', x => {errors += x.toString();});
    const done = new Promise((res, rej) => {const timeout = setTimeout(() => {if (holder.exitCode === null) holder.kill(); rej(new Error('V2R_HOLDER_TIMEOUT'));}, 20000); holder.on('error', e => {clearTimeout(timeout); rej(e);}); holder.on('exit', code => {clearTimeout(timeout); res(code);});});
    await text({cp: holder, output: () => output}, t => t.includes('ready'));
    let code; try {const plan = inspectV2Recovery(f.context); await assert.rejects(recoverV2Journal({context: f.context, expectedInspectionHash: plan.inspectionHash}), error => {code = error.code; return code === 'EPERM';});}
    finally {holder.stdin.end('release\n'); assert.equal(await done, 0); assert.equal(errors, '');}
    await recover(f); assert.equal(readV2Journal(f.context).ledger.slots[f.key].state, 'consumed'); assert.equal(readFileSync(f.sends).length, 0); observations.actualWindowsRenameError = code;
  });

  test('isolated removal of capture validation accepts a changed payload that the real recovery rejects;original source remains byte-exact', async () => {
    const f = store(true); await crash(f, 'settle'); const pending = JSON.parse(readFileSync(resolve(f.context.directory, 'PENDING.json'), 'utf8')), result = pending.record.operation.result;
    const payloadFile = resolve(out, f.spec.runId + '-v2-captures', result.requestId + '.payload.txt'); writeFileSync(payloadFile, rawPayload + ' '); assert.throws(() => inspectV2Recovery(f.context), /V2C_BINDING/);
    const originalFile = resolve(dirname(script), 'ai-quality-v147-recovery-v2.mjs'), original = readFileSync(originalFile, 'utf8'), marker = 'capture = captureSummary(inspectCaptureV2({context, ledger: before.ledger, key: op.key, expectedResult: op.result}), op.key);';
    assert.equal(original.split(marker).length, 2); const mutant = original.replace(marker, 'capture = null;').replace(/from '\.\/([^']+)'/g, (_, file) => "from '" + pathToFileURL(resolve(dirname(script), file)).href + "'");
    const mutantFile = resolve(out, 'recovery-without-capture-control.mjs'); writeFileSync(mutantFile, mutant, {flag: 'wx'}); const control = await import(pathToFileURL(mutantFile));
    const plan = control.inspectV2Recovery(f.context), repaired = await control.recoverV2Journal({context: f.context, expectedInspectionHash: plan.inspectionHash}); assert.equal(repaired.status, 'recovered'); assert.equal(readV2Journal(f.context).ledger.slots[f.key].state, 'completed'); assert.equal(readFileSync(originalFile, 'utf8'), original);
    observations.removedGuardControl = {originalRejected: true, isolatedGuardRemovedAccepted: true, originalSourceUnchanged: true, originalSha256: sha(original), mutantSha256: sha(mutant), actualProviderCalls: 0};
  });

  test.after(() => {writeFileSync(resolve(out, 'recovery-v2-observations.json'), JSON.stringify({...observations, capturedPayloadRecoveryImplemented: true, explicitJournalRecoveryImplemented: true, fullExecutorIntegrated: false, actualReceiptAuthenticated: false, physicalPowerLossVerified: false}, null, 2) + '\n');});
}
