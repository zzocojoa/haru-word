import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, utimesSync, linkSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {PROTOCOL_V2, MODELS, digest, slotKey, accountV2} from './ai-quality-v147-budget-v2.mjs';
import {PLAN} from './ai-quality-v147-budget.mjs';
import {observeProcess} from './ai-quality-v147-process.mjs';
import {createV2Journal, readV2Journal, readV2JournalHistory, openV2Journal, inspectV2Pending} from './ai-quality-v147-journal-v2.mjs';

const script = fileURLToPath(import.meta.url), h = digest('synthetic v2 journal,not actual price or user approval');
const sha = x => createHash('sha256').update(x).digest('hex');
function fixture() {
  const gen = {phase: 'candidate', caseId: 'case-one', targetModelId: MODELS[0], modelId: MODELS[0], role: 'generation', repetition: 1, inputTokenMax: 2000, outputTokenMax: 4096, inputBoundHash: h, bodyCommitment: h}, judge = {...gen, modelId: MODELS[1], role: 'judge', outputTokenMax: 1000};
  const g = slotKey(gen), j = slotKey(judge), spec = {schemaVersion: 1, protocol: PROTOCOL_V2, planId: PLAN, runId: randomUUID(), mode: 'synthetic', sourceSeal: h,
    quote: {kind: 'synthetic-test', evidenceHash: h, regionalNumerator: '1', regionalDenominator: '1', inputFactorNumerator: '1', inputFactorDenominator: '1', models: Object.fromEntries(MODELS.map(m => [m, {inputMicrosPerMillion: '1000000', outputMicrosPerMillion: '1000000'}]))}, batches: [{id: 'pair-one', requests: [gen, judge]}],
    wirePolicies: {[g]: {kind: 'static', bodySha256: h, templateHash: null, parentKey: null, maximumBytes: 65536}, [j]: {kind: 'derived', bodySha256: null, templateHash: h, parentKey: g, maximumBytes: 65536}}};
  const approval = {schemaVersion: 1, protocol: PROTOCOL_V2, runId: spec.runId, specHash: digest(spec), kind: 'synthetic-test', amountMicros: '1000000', evidenceHash: h}; return {spec, approval, g, j};
}
function binding(f, ledger, key) {
  const p = f.spec.wirePolicies[key], parent = ledger.slots[p.parentKey], result = ledger.results[p.parentKey];
  return {sourceSeal: f.spec.sourceSeal, requestId: ledger.slots[key].requestId, bodySha256: h, bodyDigest: h, bytes: 100, parentKey: p.parentKey,
    parentRequestId: parent?.requestId ?? null, parentOutputHash: result?.outputHash ?? null, parentReceiptHash: parent?.evidenceHash ?? null, templateHash: p.templateHash};
}
const reserve = {kind: 'reserve', batchId: 'pair-one'};
function settlement(f, ledger, key) {
  const b = ledger.bindings[key], usage = {inputTokens: 10, outputTokens: 10}, modelId = key === f.g ? MODELS[0] : MODELS[1];
  return {kind: 'settle', key, state: 'completed', usage, result: {sourceSeal: f.spec.sourceSeal, requestId: ledger.slots[key].requestId, modelId, bodySha256: b.bodySha256, bodyDigest: b.bodyDigest, outputHash: h, state: 'completed', usage}};
}
function child(args) {
  const cp = spawn(process.execPath, [script, ...args], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']}); let output = '', errors = '';
  cp.stdout.on('data', b => {output += b.toString();}); cp.stderr.on('data', b => {errors += b.toString();});
  const done = new Promise((res, rej) => {const timer = setTimeout(() => {if (cp.exitCode === null) cp.kill(); rej(new Error('V2J_CHILD_TIMEOUT'));}, 20000); cp.on('error', e => {clearTimeout(timer); rej(e);}); cp.on('exit', code => {clearTimeout(timer); res(code);});});
  return {cp, done, output: () => output, errors: () => errors};
}

if (process.argv[2] === '--journal-child') {
  const [directory, allowedRoot, specPath, stage] = process.argv.slice(3), spec = JSON.parse(readFileSync(specPath, 'utf8')), session = openV2Journal({directory, allowedRoot, spec});
  session.append(reserve, point => {if (point === stage) process.exit(76);}); session.close(); process.exit(0);
} else if (process.argv[2] === '--lease-race-child') {
  const [directory, allowedRoot, specPath] = process.argv.slice(3), spec = JSON.parse(readFileSync(specPath, 'utf8')); process.stdout.write('ready\n');
  process.stdin.once('data', () => {
    try {const session = openV2Journal({directory, allowedRoot, spec}); process.stdout.write('opened\n'); process.stdin.once('data', () => {session.close(); process.stdout.write('closed\n'); process.stdin.destroy();});}
    catch {process.stdout.write('refused\n'); process.stdin.destroy();}
  });
} else {
  const out = resolve(process.env.QA_OUTPUT_DIR ?? resolve(dirname(script), '../../work', 'journal-v2-' + randomUUID())); mkdirSync(out, {recursive: true});
  const evidence = {actualProviderCalls: 0, actualKeyReads: 0, actualPaidApprovalUsd: 0, task22Complete: false, fullExecutorIntegrated: false, processExits: [], leaseRace: null};
  function store() {const f = fixture(), context = {directory: resolve(out, f.spec.runId), allowedRoot: out, spec: f.spec}; createV2Journal(context, f.approval); return {...f, context};}
  const hashes = directory => Object.fromEntries(readdirSync(directory).sort().map(f => [f, sha(readFileSync(resolve(directory, f)))]));

  test('new v2 journal is exclusive,scoped and cannot reinterpret existing v1 or foreign protocols', () => {
    const f = store(), before = hashes(f.context.directory); assert.equal(readV2Journal(f.context).head.index, 0);
    assert.throws(() => createV2Journal(f.context, f.approval)); assert.deepEqual(hashes(f.context.directory), before);
    assert.throws(() => createV2Journal({...f.context, directory: resolve(out, 'wrong')}, f.approval), /V2J_RUN_SCOPE/);
    assert.throws(() => openV2Journal({...f.context, spec: {...f.spec, protocol: 'ai-quality-v147-pilot-v1'}}), /V2_SPEC_IDENTITY/);
    assert.throws(() => openV2Journal({...f.context, spec: {...f.spec, mode: 'evaluation', quote: {...f.spec.quote, kind: 'verified-price'}}}), /V2J_SYNTHETIC_ONLY/);
  });

  test('reserve,bind,consume,captured parent,derived judge and close persist/replay to the exact v2 state', () => {
    const f = store(), session = openV2Journal(f.context); let state = session.append(reserve);
    for (const key of [f.g, f.j]) {
      state = session.append({kind: 'bind', key, binding: binding(f, state.ledger, key)}); state = session.append({kind: 'consume', key}); state = session.append(settlement(f, state.ledger, key));
    }
    const prior = state; state = session.append({kind: 'close'}); assert.equal(state.ledger.closed, true); assert.equal(session.audit().head.index, 8);
    const detached = session.current(); detached.ledger.closed = false; assert.equal(session.current().ledger.closed, true); assert.equal(session.close().status, 'closed');
    const replay = readV2Journal(f.context); assert.deepEqual(replay.ledger, state.ledger); assert.equal(replay.head.index, 8); assert.equal(replay.ledger.results[f.g].outputHash, h);
    assert.equal(accountV2(f.spec, replay.ledger).upperMicros, accountV2(f.spec, prior.ledger).upperMicros);
    const reopened = openV2Journal(f.context); assert.throws(() => reopened.append(reserve)); assert.throws(() => reopened.append({kind: 'consume', key: f.g})); reopened.close();
    evidence.completedPair = {head: replay.head, closed: true, usedSlots: accountV2(f.spec, replay.ledger).consumedSlots, rawLogContainsSpecOnce: readFileSync(resolve(f.context.directory, 'CHAIN.jsonl'), 'utf8').split('"wirePolicies"').length === 2};
  });

  test('pure transition rejection leaves log/HEAD unchanged and does not poison a healthy session', () => {
    const f = store(), session = openV2Journal(f.context), before = hashes(f.context.directory);
    assert.throws(() => session.append({kind: 'consume', key: f.g}), /V2_BIND_BEFORE_CONSUME/); assert.deepEqual(hashes(f.context.directory), before);
    assert.equal(session.append(reserve).head.index, 1); session.close();
  });

  test('post-rename HEAD corruption fails readback before append can report a durable commit', () => {
    const f = store(), first = readFileSync(resolve(f.context.directory, 'HEAD.json')), session = openV2Journal(f.context);
    assert.throws(() => session.append(reserve, stage => {if (stage === 'head:after-rename') writeFileSync(resolve(f.context.directory, 'HEAD.json'), first);}), /V2J_COMMIT_READBACK/);
    assert.throws(() => session.current(), /V2J_SESSION_HELD/); session.abandon(); assert.throws(() => readV2Journal(f.context), /V2J_PREPARED_OR_FOREIGN/);
  });

  test('an existing legacy-shaped HEAD is rejected before any lease file is created', () => {
    const f = fixture(), directory = resolve(out, f.spec.runId); mkdirSync(directory); writeFileSync(resolve(directory, 'HEAD.json'), JSON.stringify({index: 0, hash: h}));
    const before = hashes(directory); assert.throws(() => openV2Journal({directory, allowedRoot: out, spec: f.spec}), /V2J_HEAD/); assert.deepEqual(hashes(directory), before);
  });

  test('every committed byte is checked even if file length and mtime are restored', () => {
    const f = store(), session = openV2Journal(f.context); session.append(reserve);
    const file = resolve(f.context.directory, 'CHAIN.jsonl'), stat = statSync(file), bytes = readFileSync(file), at = bytes.indexOf(Buffer.from('pair-one')); assert.ok(at > 0); bytes[at] = 120; writeFileSync(file, bytes); utimesSync(file, stat.atime, stat.mtime);
    assert.throws(() => session.current(), /V2J_LOG_CHANGED/); assert.throws(() => session.append({kind: 'close'}), /V2J_LOG_CHANGED/); session.abandon(); assert.throws(() => readV2Journal(f.context), /V2J_PREFIX_HASH/);
  });

  test('HEAD rewind,foreign files and changed context fail before a new operation is written', () => {
    for (const reason of ['rewind', 'foreign', 'context']) {
      const f = store(), initial = readFileSync(resolve(f.context.directory, 'HEAD.json')), session = openV2Journal(f.context); session.append(reserve);
      if (reason === 'rewind') writeFileSync(resolve(f.context.directory, 'HEAD.json'), initial);
      if (reason === 'foreign') writeFileSync(resolve(f.context.directory, 'foreign.json'), '{}');
      if (reason === 'context') f.context.spec = {...f.spec, sourceSeal: digest('other-source')};
      const before = readFileSync(resolve(f.context.directory, 'CHAIN.jsonl')); assert.throws(() => session.append({kind: 'close'})); assert.deepEqual(readFileSync(resolve(f.context.directory, 'CHAIN.jsonl')), before); session.abandon();
    }
  });

  test('active same-process lease and linked log are never silently adopted', () => {
    const f = store(), session = openV2Journal(f.context); assert.throws(() => openV2Journal(f.context)); session.close();
    const target = resolve(out, 'preserved-log-link-' + randomUUID()); linkSync(resolve(f.context.directory, 'CHAIN.jsonl'), target); assert.throws(() => openV2Journal(f.context), /V2J_NONREGULAR_FILE/); assert.ok(readFileSync(target).length > 0);
  });

  test('actual child exits at10 write boundaries preserve bytes and never auto-steal a dead lease or reset incomplete writes', async () => {
    const stages = ['pending:before-fsync', 'pending:after-fsync', 'log:before-fsync', 'log:after-fsync', 'head:before-fsync', 'head:after-fsync', 'head:before-rename', 'head:after-rename', 'pending:before-unlink', 'pending:after-unlink'];
    for (const stage of stages) {
      const f = store(), specPath = resolve(out, 'spec-' + f.spec.runId + '.json'); writeFileSync(specPath, JSON.stringify(f.spec));
      const cp = child(['--journal-child', f.context.directory, out, specPath, stage]); assert.equal(await cp.done, 76, stage); assert.equal(cp.errors(), ''); assert.equal(observeProcess(cp.cp.pid).status, 'absent');
      const before = hashes(f.context.directory); assert.throws(() => openV2Journal(f.context)); assert.deepEqual(hashes(f.context.directory), before);
      const history = readV2JournalHistory(f.context); let inspection = 'held-incomplete';
      try {inspection = inspectV2Pending(f.context); assert.equal(inspection.recoveryImplemented, false);} catch (error) {assert.ok(['V2J_INCOMPLETE_APPEND', 'V2J_INCOMPLETE_HEAD', 'ENOENT'].includes(error.code ?? error.message), error.message);}
      const committed = ['head:after-rename', 'pending:before-unlink', 'pending:after-unlink'].includes(stage); assert.equal(history.head.index, committed ? 1 : 0);
      evidence.processExits.push({stage, exitCode: 76, ownerConfirmedAbsent: true, headIndex: history.head.index, uncommittedBytes: history.uncommittedBytes, inspection, rawFiles: before, preservedAfterRefusedOpen: true});
    }
  });

  test('two actual processes racing to open the same run yield exactly one owner', async () => {
    const f = store(), specPath = resolve(out, 'spec-' + f.spec.runId + '.json'); writeFileSync(specPath, JSON.stringify(f.spec)); const pair = [0, 1].map(() => child(['--lease-race-child', f.context.directory, out, specPath]));
    const awaitText = (cp, predicate) => new Promise((res, rej) => {const timeout = setTimeout(() => rej(new Error('V2J_RACE_SIGNAL_TIMEOUT')), 10000); const event = () => {if (predicate(cp.output())) {clearTimeout(timeout); cp.cp.stdout.off('data', event); res();}}; cp.cp.stdout.on('data', event); event();});
    await Promise.all(pair.map(cp => awaitText(cp, t => t.includes('ready')))); pair.forEach(cp => cp.cp.stdin.write('open\n'));
    await Promise.all(pair.map(cp => awaitText(cp, t => /opened|refused/.test(t)))); const winners = pair.filter(cp => cp.output().includes('opened')); assert.equal(winners.length, 1); winners[0].cp.stdin.end('close\n');
    for (const cp of pair) {assert.equal(await cp.done, 0); assert.equal(cp.errors(), '');}
    assert.equal(readV2Journal(f.context).head.index, 0); evidence.leaseRace = {owners: 1, refused: 1, allExit0: true, journalUnchanged: true};
  });

  test('zero approval remains zero and prevents whole-pair reservation on the actual disk path', () => {
    const f = fixture(); f.approval = {...f.approval, kind: 'unapproved', amountMicros: '0', evidenceHash: null}; const context = {directory: resolve(out, f.spec.runId), allowedRoot: out, spec: f.spec}; createV2Journal(context, f.approval);
    const session = openV2Journal(context), before = session.current(); assert.throws(() => session.append(reserve), /INSUFFICIENT_WHOLE_BATCH/); assert.deepEqual(session.current(), before); session.close();
  });

  test('ledger/source/operation tampering fails full replay even if an attacker recomputes the outer raw-log checksum', () => {
    const f = store(), session = openV2Journal(f.context); session.append(reserve); session.close();
    const logFile = resolve(f.context.directory, 'CHAIN.jsonl'), rows = readFileSync(logFile, 'utf8').trimEnd().split('\n').map(JSON.parse); rows[1].operation = {kind: 'close'};
    const bytes = Buffer.from(rows.map(x => JSON.stringify(x)).join('\n') + '\n'); writeFileSync(logFile, bytes);
    const headFile = resolve(f.context.directory, 'HEAD.json'), head = JSON.parse(readFileSync(headFile, 'utf8')); Object.assign(head, {recordHash: digest(rows[1]), logBytes: bytes.length, logSha256: sha(bytes)}); writeFileSync(headFile, JSON.stringify(head));
    assert.throws(() => readV2Journal(f.context), /V2J_STATE_REPLAY/);
  });

  test.after(() => {writeFileSync(resolve(out, 'journal-v2-observations.json'), JSON.stringify({...evidence, durableJournalImplemented: true, pendingInspectionOnly: true, pendingRecoveryImplemented: false, liveEvaluationSupported: false, physicalPowerLossVerified: false}, null, 2) + '\n');});
}
