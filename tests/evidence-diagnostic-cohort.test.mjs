import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, renameSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { atomicJson, diagnosticPlan, diagnosticSchedule, assertDiagnosticLiveArguments, validateDiagnosticAuthorization, validateDiagnosticParents,
  diagnosticExpected, validateDiagnosticLedger, restoreDiagnosticLedger, collectDiagnosticEvidence } from '../scripts/diagnose-evidence-feedback.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const contentHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
mkdirSync(resolve('work'), { recursive: true }); const directory = mkdtempSync(resolve('work/diagnostic-cohort-tests-')), modulePath = resolve(directory, 'helper.mjs');
await build({ entryPoints: ['lib/evidence-feedback-evaluation.ts'], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const helper = await import(pathToFileURL(modulePath).href), profiles = {};
for (const id of diagnosticPlan.caseIds) profiles[id] = await helper.evidenceAccuracyHashes(helper.accuracyCases.find(c => c.id === id));
const expected = diagnosticExpected(helper, profiles, 'a'.repeat(40));
const helpers = { cases: helper.accuracyCases, parseFeedback: helper.parseEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail,
  safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
const fresh = () => ({ ...structuredClone(expected), providerStops: {}, attempts: [] });
const context = ledger => ({ ledger, expected, helpers, config: { origin: 'https://study.test', evaluationToken: 'mock' } });
const auth = () => ({ schemaVersion: 1, cohort: diagnosticPlan.cohort, approvedCalls: 20, previousCalls: 655, maximumTotalCalls: 675,
  sourceCommit: expected.sourceCommit, siteSourceCommit: diagnosticPlan.siteSourceCommit, planHash: hash(diagnosticPlan), humanAuthorization: 'additional-20-free-diagnostic-calls',
  confirmedFreeProviders: ['google', 'groq'], approvedAt: new Date(Date.now() - 1000).toISOString() });
const failure = row => ({ ...row, comparison: 'evidence-v1', code: row.provider === 'google' ? 'provider_invalid_response' : 'groq_invalid_response', providerStatus: 200,
  validationStage: 'structure', diagnostic: 'evidence_contract', validationDetail: { kind: 'evidence_structure', reason: 'span_leftover' } });

test('Windows atomic replacement retries are bounded, retain the old ledger and never retry HTTP', async () => {
  const path = resolve(directory, 'atomic-ledger.json'), before = { preserved: true }, after = { replacement: true };
  writeFileSync(path, JSON.stringify(before)); let writes = 0, renames = 0; const pauses = [];
  atomicJson(path, after, { platform: 'win32', pause: ms => pauses.push(ms), write: (...args) => { writes++; writeFileSync(...args); }, rename: (...args) => {
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), before); renames++;
    if (renames < 3) throw Object.assign(Error('Synthetic replacement contention'), { code: renames === 1 ? 'EPERM' : 'EACCES' });
    renameSync(...args);
  } });
  assert.equal(writes, 1); assert.equal(renames, 3); assert.deepEqual(pauses, [25, 25]);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), after); assert.equal(existsSync(path + '.tmp'), false);
  for (const [platform, code, count] of [['win32', 'EPERM', 5], ['win32', 'EACCES', 5], ['win32', 'EIO', 1], ['linux', 'EPERM', 1]]) {
    writeFileSync(path, JSON.stringify(before)); let calls = 0; const waits = [];
    assert.throws(() => atomicJson(path, after, { platform, pause: ms => waits.push(ms), rename: () => { calls++; throw Object.assign(Error('Synthetic replacement failure'), { code }); } }));
    assert.equal(calls, count); assert.deepEqual(waits, Array(count - 1).fill(25));
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), before); assert.deepEqual(JSON.parse(readFileSync(path + '.tmp', 'utf8')), after);
  }
  const ledger = fresh(), persisted = fresh(); writeFileSync(path, JSON.stringify(persisted));
  await assert.rejects(collectDiagnosticEvidence(context(ledger), { save: value => atomicJson(path, value, { platform: 'win32', pause: () => {},
    rename: () => { throw Object.assign(Error('Synthetic permanent failure'), { code: 'EPERM' }); } }), fetcher: () => assert.fail('no HTTP after storage failure') }));
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), persisted);
  assert.throws(() => atomicJson(path, after, { write: () => { throw Error('Synthetic write failure'); }, rename: () => assert.fail('no rename'), pause: () => assert.fail('no wait') }));
});

test('fixed20 diagnostic plan matches prior evidence and all requests while keeping the old120 plan frozen', async () => {
  const reference = JSON.parse(readFileSync(diagnosticPlan.reference.path, 'utf8')), before = structuredClone(reference);
  assert.equal(contentHash(readFileSync(diagnosticPlan.reference.path, 'utf8')), diagnosticPlan.reference.hash);
  assert.equal(contentHash(readFileSync('tests/fixtures/english-accuracy.json', 'utf8')), diagnosticPlan.fixtureContentHash);
  assert.equal(diagnosticPlan.previousCalls, 655); assert.equal(diagnosticPlan.maximumCalls, 20); assert.equal(diagnosticPlan.maximumTotalCalls, 675);
  assert.equal(new Set(diagnosticPlan.caseIds).size, 10); assert.equal(diagnosticSchedule(diagnosticPlan).length, 20);
  const samples = diagnosticPlan.caseIds.map(id => helper.accuracyCases.find(c => c.id === id));
  for (const category of ['natural', 'needs_work', 'uncertain']) assert.equal(samples.filter(c => c.category === category).length, diagnosticPlan.selection[category]);
  const rows = reference.rows.filter(r => diagnosticPlan.caseIds.includes(r.caseId));
  assert.equal(rows.filter(r => r.validationStage === 'structure').length, 11); assert.equal(rows.filter(r => r.validationStage === 'judgment').length, 5);
  assert.equal(rows.filter(r => r.status === 'response').length, 3); assert.equal(rows.filter(r => r.status === 'not_attempted').length, 1);
  for (const id of diagnosticPlan.caseIds) for (const k of ['promptHash', 'requestHash']) assert.equal(profiles[id][k], reference.profiles[id][k]);
  assert.deepEqual(reference, before); assert.equal(helper.evidencePlan.maximumCalls, 120); assert.equal(helper.evidencePlan.previousCalls, 540);
});

test('new human approval, strict20 CLI flags and no-reset marker are required before any HTTP', () => {
  const flags = ['--live', '--confirmed-free-tier', '--approved-calls', '20']; assertDiagnosticLiveArguments(flags);
  for (const ci of ['true', 'false', '1']) assert.throws(() => assertDiagnosticLiveArguments(flags, ci));
  for (const args of [[], flags.slice(1), [...flags, '--retry'], [...flags.slice(0, 3), '120']]) assert.throws(() => assertDiagnosticLiveArguments(args));
  validateDiagnosticAuthorization(auth(), expected.sourceCommit, expected.planHash);
  for (const patch of [{ approvedCalls: 120 }, { previousCalls: 540 }, { maximumTotalCalls: 660 }, { humanAuthorization: 'additional-120-free-calls' },
    { confirmedFreeProviders: ['google'] }, { sourceCommit: 'b'.repeat(40) }, { planHash: 'b'.repeat(64) }, { approvedAt: new Date(Date.now() + 60000).toISOString() }, { SECRET: 'PRIVATE' }]) {
    assert.throws(() => validateDiagnosticAuthorization({ ...auth(), ...patch }, expected.sourceCommit, expected.planHash));
  }
  assert.throws(() => restoreDiagnosticLedger({ runInitialized: true }, undefined, expected, helpers), /refusing reset/);
  assert.equal(restoreDiagnosticLedger({ runInitialized: false }, undefined, expected, helpers).attempts.length, 0);
  // The real CLI rejects missing authorization or CI before any mocked HTTP.
  const preload = resolve(directory, 'no-http.mjs'), touched = resolve(directory, 'http-touched');
  writeFileSync(preload, `import {writeFileSync} from 'node:fs'; globalThis.fetch=async()=>{writeFileSync(${JSON.stringify(touched)},'unexpected');throw Error('no HTTP')};`);
  const input = JSON.stringify({ origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit: 'b'.repeat(40) }) + '\n';
  for (const ci of ['', 'true']) assert.throws(() => execFileSync(process.execPath, ['--import', preload, 'scripts/diagnose-evidence-feedback.mjs', ...flags],
    { input, env: { ...process.env, CI: ci }, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), e => e.status === 1 && !/f{64}/.test(e.stderr));
  assert.equal(existsSync(touched), false);
});

test('five655 parent histories are immutable and terminal startup does not accept changes', () => {
  const arrays = [240, 120, 120, 60, 115].map((n, cohort) => Array.from({ length: n }, (_, i) => ({ cohort, number: i + 1, status: 'failure' })));
  const plan = { ...diagnosticPlan, parentLedgerHashes: arrays.map(hash), combinedParentHash: hash(arrays.flat()) };
  validateDiagnosticParents(arrays, plan);
  const before = structuredClone(arrays); arrays[4][0].number++;
  assert.throws(() => validateDiagnosticParents(arrays, plan)); arrays[4][0].number--;
  assert.deepEqual(arrays, before); assert.throws(() => validateDiagnosticParents(arrays.slice(0, 4), plan));
});

test('all20 attempts are prespent, safe reasons persist, feedback text is discarded and terminal reload is HTTP0', async () => {
  const ledger = fresh(); let calls = 0, saves = 0;
  await collectDiagnosticEvidence(context(ledger), { save: () => saves++, pause: async () => {}, fetcher: async (_url, init) => {
    const body = JSON.parse(init.body), a = ledger.attempts.at(-1); assert.equal(a.status, 'started'); assert.equal(a.number, 656 + calls++); assert.ok(saves >= calls);
    const result = failure(body);
    if (calls === 1) result.validationDetail.PRIVATE = 'SECRET';
    if (calls === 2) { result.validationStage = 'judgment'; result.validationDetail = { kind: 'evidence_judgment', reason: 'edit_reconstruction' }; }
    return Response.json(result, { status: 502 });
  } });
  assert.equal(calls, 20); assert.equal(ledger.attempts.length, 20); assert.equal(ledger.completed, true);
  assert.equal(ledger.attempts[0].validationDetail, undefined); assert.equal(ledger.attempts[1].validationDetail.reason, 'edit_reconstruction');
  assert.doesNotMatch(JSON.stringify(ledger), /SECRET|PRIVATE|"feedback"|"sentence"|"grammar"|"meaningUsage"/);
  validateDiagnosticLedger(ledger, expected, helpers);
  await collectDiagnosticEvidence(context(ledger), { fetcher: async () => { throw Error('no HTTP'); }, save: () => { throw Error('no save'); } });
  ledger.completed = false;
  await collectDiagnosticEvidence(context(ledger), { fetcher: async () => { throw Error('no HTTP'); } });
  assert.equal(ledger.completed, true);
});

test('started slots are never retried and modified indexes/details/private fields fail before fetch', async () => {
  const ledger = fresh(), row = expected.schedule[0]; ledger.attempts = [{ number: 656, scheduleIndex: 0, ...row, status: 'started', startedAt: new Date().toISOString() }];
  let calls = 0;
  await collectDiagnosticEvidence(context(ledger), { pause: async () => {}, fetcher: async (_url, init) => {
    calls++; assert.notDeepEqual(JSON.parse(init.body), { ...row, comparison: 'evidence-v1' }); return Response.json(failure(JSON.parse(init.body)), { status: 502 });
  } });
  assert.equal(calls, 19); assert.equal(ledger.attempts[0].status, 'started');
  for (const change of [v => v.attempts[1].scheduleIndex = 0, v => v.attempts[1].number = 700, v => v.attempts[1].validationDetail.partIndex = 21,
    v => v.attempts[1].SECRET = 'PRIVATE', v => v.providerStops.groq = 'groq_limit', v => v.completed = 'true']) {
    const invalid = structuredClone(ledger); change(invalid);
    await assert.rejects(collectDiagnosticEvidence(context(invalid), { fetcher: async () => { throw Error('no HTTP'); } }));
  }
});

test('limit, billing, permission and closed/protocol failures stop without fallback or automatic retries', async () => {
  for (const mode of ['outer429', 'wrapped402', 'permission', 'closed', 'wrong-case', 'transport']) {
    const ledger = fresh(); let calls = 0;
    await collectDiagnosticEvidence(context(ledger), { pause: async () => {}, fetcher: async (_url, init) => {
      calls++; const row = JSON.parse(init.body);
      if (mode === 'closed') return Response.json({ code: 'evaluation_disabled' }, { status: 404 });
      if (mode === 'transport') throw Error('PRIVATE');
      if (mode === 'wrong-case') return Response.json({ ...failure(row), caseId: 'WRONG' }, { status: 502 });
      if (row.provider === 'groq') return mode === 'outer429' ? new Response('PRIVATE', { status: 429 })
        : Response.json({ code: mode === 'permission' ? 'groq_permission' : 'groq_unavailable', providerStatus: mode === 'permission' ? 403 : 402 }, { status: 503 });
      return Response.json(failure(row), { status: 502 });
    } });
    assert.equal(calls, ['closed', 'wrong-case', 'transport'].includes(mode) ? 1 : 11);
    assert.equal(ledger.completed, true); assert.doesNotMatch(JSON.stringify(ledger), /PRIVATE|WRONG/);
    if (calls === 11) assert.ok(ledger.providerStops.groq);
  }
});

test('valid synthetic responses retain no language judgments and mismatched request hashes stop the diagnostic', async () => {
  const fixtureReport = JSON.parse(readFileSync(diagnosticPlan.reference.path, 'utf8'));
  const sample = helper.accuracyCases.find(c => c.id === 'word-07'), valid = fixtureReport.rows.find(r => r.caseId === sample.id && r.provider === 'groq').feedback;
  assert.ok(valid); let calls = 0; const ledger = fresh();
  await collectDiagnosticEvidence(context(ledger), { pause: async () => {}, fetcher: async (_url, init) => {
    calls++; const row = JSON.parse(init.body); if (row.caseId !== sample.id || row.provider !== 'groq') return Response.json(failure(row), { status: 502 });
    return Response.json({ ...row, feedback: valid, ...profiles[sample.id], quota: { remainingTokens: 10 } });
  } });
  assert.equal(calls, 20); assert.equal(ledger.attempts.filter(a => a.status === 'valid_response').length, 1);
  assert.equal(ledger.attempts.find(a => a.status === 'valid_response').waitAfterMs, 60000);
  assert.ok(ledger.attempts.every(a => a.feedback === undefined && a.overall === undefined && a.dimensions === undefined));
  assert.doesNotMatch(JSON.stringify(ledger), new RegExp(valid.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const bad = fresh();
  await collectDiagnosticEvidence(context(bad), { pause: async () => {}, fetcher: async () => Response.json({ ...expected.schedule[0], comparison: 'evidence-v1', feedback: valid, ...profiles[sample.id] }) });
  assert.equal(bad.attempts.length, 1); assert.equal(bad.endpointStop, 'evaluation_invalid_response');
});

test('resumed diagnostic pacing waits from persisted timestamps and low-token intervals without retrying spent slots', async () => {
  const initialTime = Date.parse('2026-10-01T10:00:00.000Z');
  for (const [status, elapsed, interval, expectedPauses] of [['started', 10000, 30000, [20000]], ['failure', 10000, 30000, [20000]],
    ['valid_response', 10000, 60000, [30000, 20000]], ['failure', 31000, 30000, []]]) {
    const ledger = fresh(), previousAt = new Date(initialTime - elapsed).toISOString();
    ledger.attempts = [{ number: 656, scheduleIndex: 0, ...expected.schedule[0], status, startedAt: previousAt,
      ...(status === 'started' ? {} : { finishedAt: previousAt, httpStatus: status === 'valid_response' ? 200 : 502 }),
      ...(status === 'failure' ? { code: 'provider_invalid_response' } : {}), ...(interval === 60000 ? { waitAfterMs: 60000 } : {}) }];
    let clock = initialTime, calls = 0; const pauses = [];
    await collectDiagnosticEvidence(context(ledger), { now: () => clock, pause: async ms => { pauses.push(ms); clock += ms; }, fetcher: async (_url, init) => {
      calls++; assert.deepEqual(JSON.parse(init.body), { ...expected.schedule[1], comparison: 'evidence-v1' });
      assert.ok(clock - Date.parse(previousAt) >= interval);
      return Response.json({ code: 'evaluation_disabled' }, { status: 404 });
    } });
    assert.equal(calls, 1); assert.deepEqual(pauses, expectedPauses); assert.equal(ledger.attempts[0].status, status);
    const changed = structuredClone(ledger); changed.attempts[0].waitAfterMs = 60001;
    await assert.rejects(collectDiagnosticEvidence(context(changed), { fetcher: () => assert.fail('no HTTP') }));
  }
  const ledger = fresh(), stop = new AbortController();
  ledger.attempts = [{ number: 656, scheduleIndex: 0, ...expected.schedule[0], status: 'started', startedAt: new Date(initialTime).toISOString() }];
  await assert.rejects(collectDiagnosticEvidence(context(ledger), { signal: stop.signal, now: () => initialTime,
    pause: async () => stop.abort(Error('synthetic pacing interruption')), fetcher: () => assert.fail('no HTTP before pacing finishes') }), /synthetic pacing interruption/);
  assert.equal(ledger.attempts.length, 1);
});

function syntheticDiagnosticCli() {
  const sandbox = mkdtempSync(resolve('work/diagnostic-cli-'));
  const put = (name, value) => { const path = resolve(sandbox, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  const get = name => JSON.parse(readFileSync(resolve(sandbox, name), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = message => { git(['add', '.']); git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', message]); return git(['rev-parse', 'HEAD']); };
  const root = '.sites-runtime/english-accuracy/', cohort = root + diagnosticPlan.cohort + '/';
  const paths = { auth: cohort + 'authorization.json', ledger: cohort + 'ledger.json', lock: root + 'running.lock', mode: root + 'mode.json', counter: root + 'network.json' };
  const arrays = diagnosticPlan.parentCounts.map((n, cohort) => Array.from({ length: n }, (_, i) => ({ cohort, number: i + 1, status: 'failure' })));
  const parentPaths = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json', 'evidence-v1/ledger.json'].map(p => root + p);
  const fixtureText = JSON.stringify({ synthetic: true }), referenceText = JSON.stringify({ profiles });
  const plan = { ...structuredClone(diagnosticPlan), parentLedgerHashes: arrays.map(hash), combinedParentHash: hash(arrays.flat()),
    fixtureContentHash: contentHash(fixtureText), reference: { path: diagnosticPlan.reference.path, hash: contentHash(referenceText) } };
  put('package.json', '{"type":"module"}'); put('.gitignore', '.sites-runtime/\n');
  put('tests/fixtures/english-accuracy.json', fixtureText); put(plan.reference.path, referenceText);
  for (const file of ['scripts/diagnose-evidence-feedback.mjs', 'scripts/evaluate-original-feedback.mjs', 'scripts/evaluate-english-accuracy.mjs', 'lib/feedback-validation-detail.ts']) put(file, readFileSync(file, 'utf8'));
  const helperPath = 'lib/evidence-feedback-evaluation.ts', helperText = [
    "export {parseFeedbackValidationDetail} from './feedback-validation-detail';",
    'export const accuracyCases=' + JSON.stringify(helper.accuracyCases) + ', accuracyModels=' + JSON.stringify(helper.accuracyModels) + ';',
    'const profiles=' + JSON.stringify(profiles) + '; export async function evidenceAccuracyHashes(sample){return profiles[sample.id];}',
    'export const FEEDBACK_ISSUES=' + JSON.stringify(Object.fromEntries(helpers.safeCodes.map(code => [code, []]))) + ';',
    'export const FEEDBACK_VALIDATION_STAGES=' + JSON.stringify(helpers.validationStages) + ', FEEDBACK_DIAGNOSTICS=' + JSON.stringify(helpers.diagnostics) + ';',
    'export function parseEvidenceAccuracyFeedback(){throw Error("No valid response in synthetic CLI fixture");}',
  ].join('\n');
  put(helperPath, helperText); put('data/evaluations/evidence-diagnostic-plan.json', plan);
  git(['init']); plan.siteSourceCommit = commit('Synthetic deployed runtime');
  put('data/evaluations/evidence-diagnostic-plan.json', plan);
  const sourceCommit = commit('Synthetic diagnostic plan');
  parentPaths.forEach((path, i) => put(path, { attempts: arrays[i], ...(i === 4 ? { completed: true, providerStops: { groq: 'groq_limit' } } : {}) }));
  const parentTexts = parentPaths.map(path => readFileSync(resolve(sandbox, path), 'utf8'));
  const authorization = { ...auth(), sourceCommit, siteSourceCommit: plan.siteSourceCommit, planHash: hash(plan), runInitialized: false };
  const config = { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit };
  const initialLedger = { ...structuredClone(expected), previousHash: plan.combinedParentHash, fixtureContentHash: plan.fixtureContentHash,
    planHash: hash(plan), sourceCommit, siteSourceCommit: plan.siteSourceCommit, providerStops: {}, attempts: [] };
  const preload = root + 'mock-network.mjs';
  put(preload, [
    "import assert from 'node:assert/strict'; import fs,{readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';",
    'const paths=' + JSON.stringify(paths) + '; const mode=JSON.parse(readFileSync(paths.mode,"utf8"));',
    'const requests=[],renameFailures=[];let atomicChecks=0;const read=path=>JSON.parse(readFileSync(path,"utf8"));',
    'const rename=fs.renameSync;fs.renameSync=(...args)=>{try{return rename(...args)}catch(error){renameFailures.push({code:/^E[A-Z0-9_]{1,30}$/.test(error.code)?error.code:"unknown",syscall:error.syscall==="rename"?"rename":"unknown"});throw error}};syncBuiltinESMExports();',
    'let clock=Date.now();Date.now=()=>clock;const timer=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{if(ms>10000){clock+=ms;return timer(fn,0,...args)}return timer(fn,ms,...args)};',
    'globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);if(mode==="forbid")throw Error("No recovery HTTP");',
    'assert.equal(read(paths.auth).runInitialized,true);assert.equal(existsSync(paths.lock),true);',
    'assert.equal(existsSync(paths.auth+".tmp"),false);assert.equal(existsSync(paths.ledger+".tmp"),false);',
    'const ledger=read(paths.ledger);if(body.caseId==="preflight-invalid-case"){assert.equal(ledger.attempts.length,0);atomicChecks++;',
    'if(mode==="slot-write-fails")mkdirSync(paths.ledger+".tmp");return Response.json({code:"evaluation_invalid_case"},{status:400});}',
    'const a=ledger.attempts.at(-1);assert.equal(a.status,"started");assert.equal(a.caseId,body.caseId);assert.equal(a.provider,body.provider);',
    'assert.equal(a.number,655+ledger.attempts.length);atomicChecks++;return Response.json({...body,code:body.provider==="google"?"provider_invalid_response":"groq_invalid_response",',
    'providerStatus:200,validationStage:"structure",diagnostic:"evidence_contract",validationDetail:{kind:"evidence_structure",reason:"span_leftover"},feedback:{original:"PRIVATE"},message:"PRIVATE"},{status:502});};',
    'process.on("exit",()=>writeFileSync(paths.counter,JSON.stringify({requests,atomicChecks,renameFailures,actualProviderCalls:0})));',
  ].join('\n'));
  const run = (mode = 'normal') => {
    put(paths.mode, JSON.stringify(mode));
    try {
      return execFileSync(process.execPath, ['--import', pathToFileURL(resolve(sandbox, preload)).href, resolve(sandbox, 'scripts/diagnose-evidence-feedback.mjs'), '--live', '--confirmed-free-tier', '--approved-calls', '20'],
        { cwd: sandbox, env: { ...process.env, CI: '' }, input: JSON.stringify(config) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      error.message += '\nSafe rename diagnostics: ' + JSON.stringify(get(paths.counter).renameFailures);
      throw error;
    }
  };
  const assertParents = () => parentPaths.forEach((path, i) => assert.equal(readFileSync(resolve(sandbox, path), 'utf8'), parentTexts[i]));
  const assertUnlocked = () => assert.equal(existsSync(resolve(sandbox, paths.lock)), false);
  const rejectWithoutHttp = () => { assert.throws(() => run('forbid'), e => e.status === 1 && !/f{64}/.test(e.stderr)); assert.equal(get(paths.counter).requests.length, 0); assertUnlocked(); assertParents(); };
  const reset = () => { put(paths.auth, authorization); put(paths.ledger, initialLedger); };
  return { sandbox, put, get, paths, plan, authorization, config, initialLedger, parentPaths, parentTexts, helperPath, helperText, commit,
    run, reset, assertParents, assertUnlocked, rejectWithoutHttp };
}

test('actual diagnostic CLI prespends atomic slots, preserves parents and recovers completed or terminal runs with HTTP0', () => {
  const cli = syntheticDiagnosticCli(); cli.put(cli.paths.auth, cli.authorization);
  const output = cli.run(), summary = JSON.parse(output.trim().split(/\r?\n/).at(-1)), saved = cli.get(cli.paths.ledger), network = cli.get(cli.paths.counter);
  assert.equal(summary.complete, true); assert.equal(summary.consumedSlots, 20); assert.equal(summary.cumulativeConsumedSlots, 675);
  assert.equal(summary.englishScore, null); assert.equal(network.requests.length, 21); assert.equal(network.atomicChecks, 21); assert.equal(network.actualProviderCalls, 0);
  assert.deepEqual(network.requests.slice(1), diagnosticSchedule(cli.plan).map(row => ({ ...row, comparison: cli.plan.comparison })));
  assert.equal(cli.get(cli.paths.auth).runInitialized, true); assert.equal(saved.completed, true);
  assert.doesNotMatch(JSON.stringify(saved) + output, /PRIVATE|f{64}|"feedback"|"grammar"|"meaningUsage"/); cli.assertParents(); cli.assertUnlocked();
  for (const completed of [true, false]) {
    cli.put(cli.paths.ledger, { ...saved, completed });
    const result = JSON.parse(cli.run('forbid').trim().split(/\r?\n/).at(-1));
    assert.equal(result.complete, true); assert.equal(result.consumedSlots, 20); assert.equal(cli.get(cli.paths.counter).requests.length, 0);
    assert.deepEqual(cli.get(cli.paths.ledger), saved); cli.assertParents(); cli.assertUnlocked();
  }
  const first = saved.attempts[0], stopped = { ...saved, completed: false, endpointStop: 'evaluation_disabled',
    attempts: [{ number: first.number, scheduleIndex: first.scheduleIndex, caseId: first.caseId, provider: first.provider,
      status: 'failure', startedAt: first.startedAt, finishedAt: first.finishedAt, httpStatus: 404, code: 'evaluation_disabled' }] };
  cli.put(cli.paths.ledger, stopped);
  const closedResult = JSON.parse(cli.run('forbid').trim().split(/\r?\n/).at(-1));
  assert.equal(closedResult.complete, true); assert.equal(closedResult.consumedSlots, 1); assert.equal(closedResult.notAttempted, 19);
  assert.equal(cli.get(cli.paths.counter).requests.length, 0); assert.deepEqual(cli.get(cli.paths.ledger), { ...stopped, completed: true });
  cli.assertParents(); cli.assertUnlocked();
  const ledgerPath = resolve(cli.sandbox, cli.paths.ledger);
  renameSync(ledgerPath, ledgerPath + '.saved');
  try { cli.rejectWithoutHttp(); assert.equal(existsSync(ledgerPath), false); assert.equal(cli.get(cli.paths.auth).runInitialized, true); }
  finally { renameSync(ledgerPath + '.saved', ledgerPath); }
});

test('actual diagnostic CLI rejects parent, reference and source drift, atomic write failures and an existing global lock', () => {
  const cli = syntheticDiagnosticCli(); cli.reset();
  const parent = cli.get(cli.parentPaths[4]); parent.attempts[0].status = 'changed'; cli.put(cli.parentPaths[4], parent);
  assert.throws(() => cli.run('forbid'), e => e.status === 1); assert.equal(cli.get(cli.paths.counter).requests.length, 0); cli.assertUnlocked();
  cli.put(cli.parentPaths[4], cli.parentTexts[4]); cli.assertParents();
  for (const path of [cli.plan.reference.path, 'tests/fixtures/english-accuracy.json', cli.helperPath]) {
    const text = readFileSync(resolve(cli.sandbox, path), 'utf8');
    cli.put(path, text + (path.endsWith('.ts') ? '\n// Uncommitted source drift\n' : '\nchanged'));
    try { cli.rejectWithoutHttp(); assert.equal(cli.get(cli.paths.auth).runInitialized, false); }
    finally { cli.put(path, text); }
  }
  for (const path of [cli.paths.ledger, cli.paths.auth]) {
    cli.reset(); mkdirSync(resolve(cli.sandbox, path + '.tmp'));
    try { cli.rejectWithoutHttp(); assert.equal(cli.get(cli.paths.auth).runInitialized, false); assert.deepEqual(cli.get(cli.paths.ledger), cli.initialLedger); }
    finally { rmdirSync(resolve(cli.sandbox, path + '.tmp')); }
  }
  cli.reset();
  assert.throws(() => cli.run('slot-write-fails'), e => e.status === 1);
  const network = cli.get(cli.paths.counter);
  assert.deepEqual(network.requests.map(row => row.caseId), ['preflight-invalid-case']); assert.equal(network.actualProviderCalls, 0);
  assert.equal(cli.get(cli.paths.auth).runInitialized, true); assert.equal(cli.get(cli.paths.ledger).attempts.length, 0); cli.assertUnlocked(); cli.assertParents();
  rmdirSync(resolve(cli.sandbox, cli.paths.ledger + '.tmp'));
  cli.put(cli.paths.lock, { owner: 'another synthetic run' });
  try { assert.throws(() => cli.run('forbid'), e => e.status === 1); assert.equal(cli.get(cli.paths.counter).requests.length, 0); assert.deepEqual(cli.get(cli.paths.lock), { owner: 'another synthetic run' }); }
  finally { unlinkSync(resolve(cli.sandbox, cli.paths.lock)); }
  cli.put(cli.helperPath, cli.helperText + '\n// Committed runtime drift\n');
  const changedSource = cli.commit('Synthetic incompatible runtime');
  cli.config.sourceCommit = changedSource;
  cli.put(cli.paths.auth, { ...cli.authorization, sourceCommit: changedSource });
  cli.put(cli.paths.ledger, { ...cli.initialLedger, sourceCommit: changedSource });
  cli.rejectWithoutHttp(); assert.equal(cli.get(cli.paths.auth).runInitialized, false);
});
