import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {PLAN, PROTOCOL, MODELS, digest, slotKey, transition, account} from './ai-quality-v147-budget.mjs';
import {createBudgetStore, transactBudgetStore, readBudgetStore, readBudgetHistoryForRecovery, newStoreOwner, validatePreparedSnapshot, commitFilename} from './ai-quality-v147-budget-store.mjs';
import {dispatchSyntheticOnce, recoverCapturedSynthetic} from './ai-quality-v147-dispatch.mjs';
import {inspectBudgetRecovery, recoverBudgetStore} from './ai-quality-v147-recovery.mjs';
import {observeProcess} from './ai-quality-v147-process.mjs';

const script = fileURLToPath(import.meta.url), h = digest('synthetic recovery fixture'), json = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const result = () => ({status: 'completed', modelId: MODELS[0], usage: {inputTokens: 10, outputTokens: 10}, outputHash: h});
const mode = process.argv[2];
if (['--transaction-crash', '--recovery-crash', '--recovery-race'].includes(mode)) {
  const input = json(process.argv[3]);
  const run = async () => {
    try {
      if (mode === '--transaction-crash') transactBudgetStore({...input.context, operation: input.operation, testFault(stage) { if (stage === input.stage) process.exit(74); }});
      else await recoverBudgetStore({...input, testFault(stage) { if (stage === input.stage) process.exit(75); }});
      process.stdout.write('recovered\n');
    } catch { process.stdout.write('held\n'); }
  };
  if (mode === '--recovery-race') { process.stdout.write('ready\n'); process.stdin.once('data', async () => { await run(); process.stdin.destroy(); }); }
  else await run();
} else {
  assert.equal(process.platform, 'win32', 'This is the actual Windows recovery integration suite.');
  const root = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(script), '../../work', `recovery-test-${randomUUID()}`)); mkdirSync(root, {recursive: true});
  const matrix = [], negatives = [];
  function fixture() {
    const body = {model: MODELS[0], max_output_tokens: 4096, input: 'SYNTHETIC RECOVERY BODY'};
    const requests = ['case-one', 'case-two'].map(caseId => ({phase: 'candidate', caseId, targetModelId: MODELS[0], modelId: MODELS[0], role: 'generation', repetition: 1,
      inputTokenMax: 1000, outputTokenMax: 4096, inputBoundHash: h, bodyCommitment: digest(body)}));
    const spec = {schemaVersion: 1, protocol: PROTOCOL, planId: PLAN, runId: randomUUID(), mode: 'synthetic', sourceSeal: h,
      quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1',
        models: Object.fromEntries(MODELS.map(id => [id, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'pair', requests}]};
    const context = {directory: resolve(root, spec.runId), allowedRoot: root, spec}, approval = {schemaVersion: 1, protocol: PROTOCOL, runId: spec.runId, specHash: digest(spec), kind: 'synthetic-test', amountMicros: '1000000', evidenceHash: h};
    createBudgetStore({...context, approval}); transactBudgetStore({...context, operation: {kind: 'reserve', batchId: 'pair'}});
    return {context, body, first: slotKey(requests[0]), key: slotKey(requests[1]), counter: resolve(root, `calls-${spec.runId}.log`)};
  }
  const send = (f, key = f.first, testFault) => dispatchSyntheticOnce({context: f.context, key, body: f.body, transport: async ({requestId}) => { appendFileSync(f.counter, requestId + '\n'); return result(); }, testFault});
  const calls = f => existsSync(f.counter) ? readFileSync(f.counter, 'utf8').trim().split('\n').filter(Boolean).length : 0;
  const state = f => readBudgetHistoryForRecovery(f.context);
  const files = f => Object.fromEntries(readdirSync(f.context.directory).sort().map(n => [n, sha(resolve(f.context.directory, n))]));
  const captureFile = f => resolve(root, `${f.context.spec.runId}-captures`, state(f).ledger.slots[f.key].requestId + '.json');
  async function recover(f, testFault) { const p = inspectBudgetRecovery(f.context); return recoverBudgetStore({context: f.context, expectedInspectionHash: p.inspectionHash, testFault}); }
  function crash(f, operation, stage) {
    const input = resolve(root, `transaction-${f.context.spec.runId}-${randomUUID()}.json`); save(input, {context: f.context, operation, stage});
    const p = spawnSync(process.execPath, [script, '--transaction-crash', input], {windowsHide: true, timeout: 20000, encoding: 'utf8'});
    assert.equal(p.status, 74); assert.equal(p.stderr, ''); return input;
  }
  async function preparedSettlement() {
    const f = fixture(); await send(f);
    await assert.rejects(send(f, f.key, stage => { if (stage === 'after-capture-before-settle') throw new Error('synthetic interruption'); }));
    const capture = json(captureFile(f)).record, operation = {kind: 'settle', key: f.key, state: capture.state, usage: capture.usage, evidenceHash: digest(capture)};
    crash(f, operation, 'head:before-rename'); return {f, operation};
  }
  function preserve(f, names) {
    const p = resolve(root, `before-negative-${f.context.spec.runId}-${randomUUID()}`); mkdirSync(p);
    for (const name of names) writeFileSync(resolve(p, name), readFileSync(resolve(f.context.directory, name))); return p;
  }

  test('actual process identity binds PID, creation time, command/executable hashes without raw command', () => {
    const owner = newStoreOwner(fixture().context), seen = observeProcess(process.pid);
    assert.equal(seen.status, 'present'); assert.deepEqual(owner.identity, seen.identity);
    assert.deepEqual(Object.keys(owner.identity).sort(), ['commandHash', 'createdAt', 'executableHash', 'pid', 'platform']);
    assert.equal(owner.pid, process.pid); assert.equal(owner.schemaVersion, 2);
  });
  test('process exits at nine write boundaries preserve prior completed rows and block ambiguous preparations', async () => {
    const stages = ['lock:after-acquire', 'snapshot:before-fsync', 'snapshot:after-fsync', 'head:before-fsync', 'head:after-fsync', 'commit:before-fsync', 'commit:after-fsync', 'head:before-rename', 'head:after-rename'];
    for (const stage of stages) {
      const f = fixture(); await send(f); const before = state(f), first = structuredClone(before.ledger.slots[f.first]);
      const input = crash(f, {kind: 'consume', key: f.key}, stage), originalHead = sha(resolve(f.context.directory, 'HEAD.json'));
      const mayRecover = ['lock:after-acquire', 'commit:before-fsync', 'commit:after-fsync', 'head:before-rename', 'head:after-rename'].includes(stage);
      if (mayRecover) {
        const plan = inspectBudgetRecovery(f.context), r = await recover(f); assert.equal(r.status, 'recovered');
        const after = readBudgetStore(f.context); assert.deepEqual(after.ledger.slots[f.first], first);
        assert.equal(after.ledger.slots[f.key].state, stage === 'lock:after-acquire' ? 'reserved' : 'consumed');
        assert.equal(account(f.context.spec, after.ledger).upperMicros, account(f.context.spec, before.ledger).upperMicros);
        assert.equal(calls(f), 1); assert.ok(existsSync(resolve(r.evidenceDirectory, 'previous-owned-lock.json')));
        if (stage !== 'lock:after-acquire') await assert.rejects(send(f, f.key), /NO_AUTOMATIC_RESEND/);
        matrix.push({stage, childExit: 74, recovered: true, action: plan.action, calls: calls(f), originalHeadHash: originalHead, evidence: r.evidenceDirectory});
      } else {
        const priorFiles = files(f); assert.throws(() => inspectBudgetRecovery(f.context), /RECOVERY_INCOMPLETE/); assert.deepEqual(files(f), priorFiles);
        assert.deepEqual(state(f).ledger.slots[f.first], first); assert.equal(calls(f), 1); await assert.rejects(send(f, f.key), /STORE_PREPARED_OR_FOREIGN_FILES/);
        matrix.push({stage, childExit: 74, recovered: false, reason: 'incomplete preparation held', calls: calls(f), originalHeadHash: originalHead, input});
      }
    }
    save(resolve(root, 'write-process-boundaries.json'), {matrix, realProviderCalls: 0, hardwarePowerLossProven: false});
  });
  test('complete saved settlement recovers identical request, usage, result hash and earlier completed rows', async () => {
    const {f} = await preparedSettlement(), before = state(f), capture = json(captureFile(f)).record, requestId = before.ledger.slots[f.key].requestId;
    const r = await recover(f), after = readBudgetStore(f.context);
    assert.deepEqual(after.ledger.slots[f.first], before.ledger.slots[f.first]); assert.equal(after.ledger.slots[f.key].requestId, requestId);
    assert.deepEqual(after.ledger.slots[f.key].usage, capture.usage); assert.equal(after.ledger.slots[f.key].evidenceHash, digest(capture));
    assert.equal(calls(f), 2); assert.equal(recoverCapturedSynthetic({context: f.context, key: f.key, body: f.body}).status, 'already-settled');
    assert.equal(calls(f), 2); assert.equal(json(resolve(r.evidenceDirectory, 'result.json')).noDispatchPerformed, true);
  });
  test('real Windows deny-delete file handle produces rename error, old head survives and verified recovery works', async () => {
    const f = fixture(); await send(f); const head = resolve(f.context.directory, 'HEAD.json'), original = sha(head);
    const literal = head.replaceAll("'", "''");
    const ps = `$ErrorActionPreference='Stop';$s=[IO.File]::Open('${literal}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);try{[Console]::Out.WriteLine('opened');[Console]::Out.Flush();[void][Console]::In.ReadLine()}finally{$s.Dispose()}`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
    const done = new Promise((res, rej) => { child.on('error', rej); child.on('exit', res); }); let output = '', stderr = '', errorCode;
    child.stderr.on('data', b => { stderr += b.toString(); });
    try {
      await new Promise((res, rej) => { const timer = setTimeout(() => { child.kill(); rej(new Error('FILE_HOLDER_TIMEOUT')); }, 10000);
        child.stdout.on('data', b => { output += b.toString(); if (output.includes('opened')) { clearTimeout(timer); res(); } }); child.on('error', rej); });
      try { transactBudgetStore({...f.context, operation: {kind: 'consume', key: f.key}}); } catch (e) { errorCode = e.code; }
      assert.ok(['EPERM', 'EACCES', 'EBUSY'].includes(errorCode)); assert.equal(sha(head), original);
    } finally { child.stdin.end('release\n'); assert.equal(await done, 0); assert.equal(stderr, ''); }
    const r = await recover(f); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'consumed'); assert.equal(calls(f), 1);
    save(resolve(root, 'actual-windows-rename-error.json'), {errorCode, oldHeadUnchanged: true, recovered: r.status, evidenceDirectory: r.evidenceDirectory, realProviderCalls: 0});
  });
  test('live owner, fake reused PID/command, foreign namespace and old legacy locks stay untouched', () => {
    for (const kind of ['live', 'wrong-start', 'wrong-command', 'wrong-run', 'wrong-directory', 'legacy']) {
      const f = fixture(), owner = structuredClone(newStoreOwner(f.context));
      if (kind === 'wrong-start') owner.identity.createdAt = 'different-start';
      if (kind === 'wrong-command') owner.identity.commandHash = h;
      if (kind === 'wrong-run') owner.runId = randomUUID();
      if (kind === 'wrong-directory') owner.directoryHash = h;
      save(resolve(f.context.directory, 'LOCK.json'), kind === 'legacy' ? {pid: process.pid, protocol: 'additional-7usd-remediation-v4'} : owner);
      const before = files(f); assert.throws(() => inspectBudgetRecovery(f.context), /RECOVERY_OWNER_LIVE|RECOVERY_PID_OR_COMMAND_MISMATCH|STORE_OWNER_BINDING/); assert.deepEqual(files(f), before);
      negatives.push({kind, held: true, noFilesChanged: true});
    }
  });
  test('wrong execution source, truncated JSON and extra unrecognized file never change original head', async () => {
    for (const kind of ['source', 'snapshot-json', 'commit-json', 'pending-json', 'extra']) {
      const {f} = await preparedSettlement(), prefix = state(f), number = String(prefix.head.index + 1).padStart(6, '0') + '.json';
      const snap = json(resolve(f.context.directory, number)), commit = commitFilename(snap), pending = `HEAD-${snap.transactionNonce}.tmp`;
      preserve(f, [number, commit, pending]);
      if (kind === 'source') f.context.spec.sourceSeal = h === f.context.spec.sourceSeal ? digest('new source') : h;
      if (kind === 'snapshot-json') writeFileSync(resolve(f.context.directory, number), '{');
      if (kind === 'commit-json') writeFileSync(resolve(f.context.directory, commit), '{');
      if (kind === 'pending-json') writeFileSync(resolve(f.context.directory, pending), '{');
      if (kind === 'extra') writeFileSync(resolve(f.context.directory, 'unknown.tmp'), 'synthetic');
      const before = files(f); assert.throws(() => inspectBudgetRecovery(f.context)); assert.deepEqual(files(f), before); assert.equal(calls(f), 2);
      negatives.push({kind, held: true, noFilesChanged: true});
    }
  });
  test('guard-removal control: a replay-valid snapshot alone cannot authorize recovery without completed commit metadata', async () => {
    const f = fixture(); await send(f); crash(f, {kind: 'consume', key: f.key}, 'snapshot:after-fsync');
    const prefix = state(f), file = String(prefix.head.index + 1).padStart(6, '0') + '.json', candidate = json(resolve(f.context.directory, file));
    assert.doesNotThrow(() => validatePreparedSnapshot(f.context, prefix, candidate)); const before = files(f);
    assert.throws(() => inspectBudgetRecovery(f.context), /RECOVERY_INCOMPLETE/); assert.deepEqual(files(f), before);
    negatives.push({kind: 'missing commit guard removed', unsafeReplayWouldAccept: true, protectedRecoveryRejects: true});
  });
  test('guard-removal control: replay-consistent altered usage is rejected against the immutable captured result', async () => {
    const {f} = await preparedSettlement(), prefix = state(f), file = String(prefix.head.index + 1).padStart(6, '0') + '.json', p = resolve(f.context.directory, file);
    const candidate = json(p), commitFile = commitFilename(candidate), pendingFile = `HEAD-${candidate.transactionNonce}.tmp`;
    preserve(f, [file, commitFile, pendingFile]); candidate.operation.usage = {inputTokens: 0, outputTokens: 0}; candidate.ledger = transition(f.context.spec, prefix.ledger, candidate.operation);
    const nextHead = {index: candidate.index, hash: digest(candidate)}, commit = json(resolve(f.context.directory, commitFile)); commit.to = nextHead;
    save(p, candidate); save(resolve(f.context.directory, commitFile), commit); save(resolve(f.context.directory, pendingFile), nextHead);
    assert.doesNotThrow(() => validatePreparedSnapshot(f.context, prefix, candidate)); const before = files(f);
    assert.throws(() => inspectBudgetRecovery(f.context), /RECOVERY_CAPTURE_USAGE_MISMATCH/); assert.deepEqual(files(f), before); assert.equal(calls(f), 2);
    negatives.push({kind: 'captured usage guard removed', unsafeReplayWouldAccept: true, protectedRecoveryRejects: true});
  });
  test('a previously completed slot cannot be changed through an otherwise prepared settlement', async () => {
    const {f} = await preparedSettlement(), prefix = state(f), file = String(prefix.head.index + 1).padStart(6, '0') + '.json';
    preserve(f, [file]); const candidate = json(resolve(f.context.directory, file)); candidate.ledger.slots[f.first].usage = {inputTokens: 1, outputTokens: 1};
    save(resolve(f.context.directory, file), candidate); const before = files(f); assert.throws(() => inspectBudgetRecovery(f.context), /PREPARED_TRANSITION/); assert.deepEqual(files(f), before);
    assert.deepEqual(state(f).ledger.slots[f.first], prefix.ledger.slots[f.first]);
  });
  test('changed inspection fingerprint stops recovery before lock moves or journal writes', async () => {
    const {f} = await preparedSettlement(), plan = inspectBudgetRecovery(f.context), before = files(f);
    await assert.rejects(recoverBudgetStore({context: f.context, expectedInspectionHash: digest('wrong inspection')}), /RECOVERY_INSPECTION_CHANGED/);
    assert.deepEqual(files(f), before); assert.equal(inspectBudgetRecovery(f.context).inspectionHash, plan.inspectionHash);
  });
  test('a caught recovery failure before rename keeps the full prepared write and can be retried from a new inspection', async () => {
    const {f} = await preparedSettlement(), head = sha(resolve(f.context.directory, 'HEAD.json'));
    await assert.rejects(recover(f, stage => { if (stage === 'recovery:before-head-rename') throw new Error('synthetic recovery interruption'); }), /synthetic recovery interruption/);
    assert.equal(sha(resolve(f.context.directory, 'HEAD.json')), head); const r = await recover(f);
    assert.equal(r.status, 'recovered'); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'completed'); assert.equal(calls(f), 2);
  });
  test('recovery process termination at three boundaries releases its helper and resumes without resending', async () => {
    const recovered = [];
    for (const stage of ['recovery:after-lock-acquire', 'recovery:before-head-rename', 'recovery:after-head-rename']) {
      const {f} = await preparedSettlement(), plan = inspectBudgetRecovery(f.context), prior = structuredClone(state(f).ledger.slots[f.first]);
      const input = resolve(root, `recovery-crash-${f.context.spec.runId}.json`); save(input, {context: f.context, expectedInspectionHash: plan.inspectionHash, stage});
      const child = spawnSync(process.execPath, [script, '--recovery-crash', input], {windowsHide: true, timeout: 20000, encoding: 'utf8'});
      assert.equal(child.status, 75); assert.equal(child.stderr, '');
      const audit = readdirSync(root).find(n => n.startsWith(`${f.context.spec.runId}-recovery-`)), helperPid = json(resolve(root, audit, 'inspection.json')).mutexHelperPid;
      const deadline = Date.now() + 15000;
      while (true) {
        const observed = observeProcess(helperPid); assert.notEqual(observed.status, 'unknown');
        if (observed.status === 'absent') break;
        assert.ok(Date.now() < deadline, 'Confirmed live mutex helper must exit on caller stdin EOF.');
        await new Promise(res => setTimeout(res, 100));
      }
      const resumed = await recover(f), after = readBudgetStore(f.context);
      assert.deepEqual(after.ledger.slots[f.first], prior); assert.equal(after.ledger.slots[f.key].state, 'completed'); assert.equal(calls(f), 2);
      await assert.rejects(send(f, f.key), /NO_AUTOMATIC_RESEND/);
      recovered.push({stage, childExit: 75, helperPid, helperAbsentVerified: true, resumed: resumed.status, syntheticCalls: calls(f)});
    }
    save(resolve(root, 'recovery-process-boundaries.json'), {cases: recovered, actualProviderCalls: 0});
  });
  test('mutex helper death before lock archival preserves the stale lock and allows a freshly audited recovery', async () => {
    const {f} = await preparedSettlement(), head = sha(resolve(f.context.directory, 'HEAD.json')), lock = sha(resolve(f.context.directory, 'LOCK.json'));
    let helperPid;
    await assert.rejects(recover(f, async (stage, detail) => {
      if (stage !== 'recovery:before-lock-archive') return;
      helperPid = detail.mutexHelperPid; assert.equal(observeProcess(helperPid).status, 'present'); process.kill(helperPid);
      const deadline = Date.now() + 15000;
      while (true) {
        const observed = observeProcess(helperPid); assert.notEqual(observed.status, 'unknown'); if (observed.status === 'absent') break;
        assert.ok(Date.now() < deadline); await new Promise(res => setTimeout(res, 100));
      }
    }), /MUTEX_HELPER_GONE|MUTEX_RELEASE_FAILED/);
    assert.ok(helperPid); assert.equal(sha(resolve(f.context.directory, 'HEAD.json')), head); assert.equal(sha(resolve(f.context.directory, 'LOCK.json')), lock);
    assert.equal(calls(f), 2); const r = await recover(f); assert.equal(r.status, 'recovered'); assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'completed');
    assert.equal(calls(f), 2); save(resolve(root, 'mutex-helper-death.json'), {helperPid, deathVerified: true, oldHeadAndLockPreserved: true, recovered: true, actualProviderCalls: 0});
  });
  test('two real recovery processes cannot reclaim the same stale lock twice', async () => {
    const f = fixture(); crash(f, {kind: 'consume', key: f.key}, 'lock:after-acquire');
    const plan = inspectBudgetRecovery(f.context), input = resolve(root, `recovery-race-${f.context.spec.runId}.json`); save(input, {context: f.context, expectedInspectionHash: plan.inspectionHash});
    const children = [0, 1].map(() => {
      const child = spawn(process.execPath, [script, '--recovery-race', input], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']}); let output = '', stderr = '';
      const ready = new Promise((res, rej) => { const timer = setTimeout(() => { child.kill(); rej(new Error('READY_TIMEOUT')); }, 15000);
        child.stdout.on('data', b => { output += b.toString(); if (output.includes('ready')) { clearTimeout(timer); res(); } }); child.on('error', rej); });
      child.stderr.on('data', b => { stderr += b.toString(); });
      const done = new Promise((res, rej) => { const timer = setTimeout(() => { child.kill(); rej(new Error('EXIT_TIMEOUT')); }, 30000);
        child.on('error', e => { clearTimeout(timer); rej(e); }); child.on('exit', code => { clearTimeout(timer); if (code === 0) res(); else rej(new Error('CHILD_EXIT')); }); });
      return {child, ready, done, output: () => output, stderr: () => stderr};
    });
    await Promise.all(children.map(c => c.ready)); children.forEach(c => c.child.stdin.end('recover\n')); await Promise.all(children.map(c => c.done));
    assert.equal(children.filter(c => c.output().includes('recovered')).length, 1); assert.ok(children.every(c => c.stderr() === ''));
    assert.equal(readBudgetStore(f.context).ledger.slots[f.key].state, 'reserved'); assert.equal(calls(f), 0);
    const archives = readdirSync(root).filter(n => n.startsWith(`${f.context.spec.runId}-recovery-`) && existsSync(resolve(root, n, 'previous-owned-lock.json'))); assert.equal(archives.length, 1);
    save(resolve(root, 'recovery-process-race.json'), {outputs: children.map(c => c.output()), archivedLocks: archives.length, realProviderCalls: 0});
  });
  test.after(() => { save(resolve(root, 'negative-controls.json'), {cases: negatives, actualGuardRemovalMutations: false, realProviderCalls: 0}); });
}
