import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const parentCounts = [240, 120, 120, 60, 115, 20, 26, 34, 71];
const root = '.sites-runtime/english-accuracy/', cohort = root + 'relational-evidence-v1/';
const parentPaths = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json',
  'evidence-v1/ledger.json', 'evidence-diagnostics-v1/ledger.json', 'counted-evidence-v1/ledger.json', 'token-evidence-v1/ledger.json', 'annotated-evidence-v1/ledger.json'].map(path => root + path);
const paths = { auth: cohort + 'authorization.json', ledger: cohort + 'ledger.json', review: cohort + 'review-bundle.json',
  lock: root + 'running.lock', counter: root + 'network.json', mode: root + 'mode.json' };

// Every payload is authored synthetic data. Only collector/helper source is copied;
// no actual authorization, historical ledger, report or English fixture is read.
const cases = Array.from({ length: 60 }, (_, i) => ({ id: `synthetic-${String(i + 1).padStart(2, '0')}`,
  domain: i < 40 ? 'word' : 'grammar', sentence: `Synthetic test sentence ${i + 1}.` }));
const profiles = Object.fromEntries(cases.map(c => [c.id, { domain: c.domain,
  promptHash: hash({ synthetic: 'prompt', id: c.id }), requestHash: hash({ synthetic: 'request', id: c.id }) }]));
const models = { google: 'synthetic-google-model', groq: 'synthetic-groq-model' };
const schedule = cases.flatMap(c => ['google', 'groq'].map(provider => ({ caseId: c.id, provider })));
const fixtureText = JSON.stringify({ syntheticOnly: true, cases });
const parents = parentCounts.map((count, cohort) => Array.from({ length: count }, (_, i) => ({ syntheticOnly: true, cohort, number: i + 1 })));

function syntheticCli() {
  // Preserve failed/crashed fixtures for diagnosis; each test owns a unique checkout.
  mkdirSync(resolve(project, 'work'), { recursive: true });
  const sandbox = mkdtempSync(resolve(project, 'work/relational-cli-test-'));
  const put = (path, value) => {
    const target = resolve(sandbox, path); mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const get = path => JSON.parse(readFileSync(resolve(sandbox, path), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const references = Array.from({ length: 8 }, (_, i) => {
    const path = `data/evaluations/synthetic-reference-${i + 1}.json`;
    const text = JSON.stringify({ syntheticOnly: true, reference: i + 1, fixtureHash: contentHash(fixtureText) });
    put(path, text); return { path, hash: contentHash(text) };
  });
  const plan = { schemaVersion: 1, comparison: 'relational-evidence-v1', previousCalls: 806, maximumCalls: 120, maximumTotalCalls: 926,
    caseIds: cases.map(c => c.id), parentCounts, parentLedgerHashes: parents.map(hash), combinedParentHash: hash(parents.flat()),
    fixtureContentHash: contentHash(fixtureText), references };
  put('package.json', '{"type":"module"}'); put('.gitignore', '.sites-runtime/\n');
  put('tests/fixtures/english-accuracy.json', fixtureText); put('data/evaluations/evidence-diagnostic-plan.json', '{"syntheticOnly":true}');
  for (const file of ['scripts/evaluate-relational-evidence.mjs', 'scripts/diagnose-evidence-feedback.mjs',
    'scripts/evaluate-original-feedback.mjs', 'scripts/evaluate-english-accuracy.mjs']) put(file, readFileSync(resolve(project, file), 'utf8'));

  // Stub the evaluation exports, so actual CLI main/build/atomic writes run without
  // importing any model transport. These tests establish lifecycle safety only.
  put('lib/relational-evidence-evaluation.ts', `export const relationalEvidencePlan=${JSON.stringify(plan)},relationalEvidenceCases=${JSON.stringify(cases)},accuracyModels=${JSON.stringify(models)};
const profiles=${JSON.stringify(profiles)};export async function relationalEvidenceHashes(c){return {promptHash:profiles[c.id].promptHash,requestHash:profiles[c.id].requestHash};}export function relationalEvidenceSchedule(){return ${JSON.stringify(schedule)};}
export const FEEDBACK_ISSUES={provider_invalid_response:true,groq_invalid_response:true,provider_precondition:true,groq_limit:true},FEEDBACK_VALIDATION_STAGES=['fields'],FEEDBACK_DIAGNOSTICS=['wire_fields'];
export function parseRelationalEvidenceAccuracyFeedback(v){return v&&typeof v.original==='string'&&typeof v.model==='string'?v:undefined;}
export function parseFeedbackValidationDetail(v){return v&&v.kind==='schema'?v:undefined;}
export function parseTokenEvidenceQuota(v){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['remainingTokens','remainingRequests','resetTokensSeconds','resetRequestsSeconds'].includes(k)))return;for(const[k,n]of Object.entries(v))if(!Number.isInteger(n)||n<(k.startsWith('reset')?1:0)||n>(k.startsWith('reset')?604800:1000000000))return;return v;}`);
  git(['init']); git(['add', '.']);
  git(['-c', 'user.name=Synthetic test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic relational CLI test']);
  const sourceCommit = git(['rev-parse', 'HEAD']);
  parentPaths.forEach((path, i) => put(path, { attempts: parents[i] }));
  const parentTexts = parentPaths.map(path => readFileSync(resolve(sandbox, path), 'utf8'));
  const auth = { schemaVersion: 1, comparison: 'relational-evidence-v1', approvedCalls: 120, previousCalls: 806, cumulativeMaximum: 926,
    sourceCommit, planHash: hash(plan), humanAuthorization: 'additional-120-free-relational-calls', confirmedFreeProviders: ['google', 'groq'],
    approvedAt: new Date(Date.now() - 1000).toISOString(), runInitialized: false };
  put(paths.auth, auth);
  const config = { origin: 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site', evaluationToken: 'f'.repeat(64), sourceCommit };
  const preload = root + 'mock-network.mjs';
  put(preload, [
    "import assert from 'node:assert/strict';import{readFileSync,writeFileSync,existsSync,mkdirSync}from'node:fs';",
    `const paths=${JSON.stringify(paths)},profiles=${JSON.stringify(profiles)},cases=${JSON.stringify(cases)},models=${JSON.stringify(models)};const read=p=>JSON.parse(readFileSync(p,'utf8'));const mode=read(paths.mode),requests=[],delays=[];let prespends=0,time=Date.now();Date.now=()=>time;const timer=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{if(ms>10000){delays.push(ms);time+=ms;return timer(fn,0,...args)}return timer(fn,ms,...args)};`,
    "globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);if(mode==='forbid')throw Error('Unexpected recovery HTTP');assert.equal(_url,'https://wordgrain-oxford-study.hoihou-o.chatgpt.site/api/english-accuracy-evaluation');assert.equal(init.headers['X-English-Accuracy-Token'],'f'.repeat(64));assert.equal(init.headers.Origin,'https://wordgrain-oxford-study.hoihou-o.chatgpt.site');assert.equal(body.comparison,'relational-evidence-v1');assert.equal(read(paths.auth).runInitialized,true);assert.equal(existsSync(paths.lock),true);assert.equal(existsSync(paths.ledger+'.tmp'),false);const ledger=read(paths.ledger);",
    "if(body.caseId==='preflight-invalid-case'){if(mode==='slot-fails')mkdirSync(paths.ledger+'.tmp');return Response.json({code:'evaluation_invalid_case'},{status:400});}",
    "const a=ledger.attempts.at(-1);assert.equal(a.status,'started');assert.equal(a.caseId,body.caseId);assert.equal(a.provider,body.provider);assert.equal(a.number,806+ledger.attempts.length);prespends++;if(mode==='crash-start')process.exit(17);",
    "if(mode==='closed')return Response.json({code:'evaluation_disabled'},{status:404});if(mode==='success-low-quota'){const sample=cases.find(c=>c.id===body.caseId);return Response.json({...body,...profiles[body.caseId],feedback:{original:sample.sentence,model:models[body.provider]},quota:{remainingTokens:0,resetTokensSeconds:63}});}",
    "return Response.json({...body,code:body.provider==='google'?'provider_invalid_response':'groq_invalid_response',quota:{},validationStage:'fields',diagnostic:'wire_fields',rawPrivate:'private-synthetic-marker'},{status:502});};",
    "process.on('exit',()=>writeFileSync(paths.counter,JSON.stringify({requests,prespends,delays})));",
  ].join('\n'));
  const run = (mode = 'normal') => {
    put(paths.mode, JSON.stringify(mode));
    return execFileSync(process.execPath, ['--import', pathToFileURL(resolve(sandbox, preload)).href,
      resolve(sandbox, 'scripts/evaluate-relational-evidence.mjs'), '--live', '--confirmed-free-tier', '--approved-calls', '120'],
    { cwd: sandbox, env: { ...process.env, CI: '' }, input: JSON.stringify(config) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
  };
  const assertParents = () => parentPaths.forEach((path, i) => assert.equal(readFileSync(resolve(sandbox, path), 'utf8'), parentTexts[i]));
  const assertUnlocked = () => assert.equal(existsSync(resolve(sandbox, paths.lock)), false);
  const reject = () => {
    assert.throws(() => run('forbid'), error => error.status === 1 && !/f{64}|private-synthetic-marker/.test(error.stderr));
    assert.equal(get(paths.counter).requests.length, 0); assertUnlocked();
  };
  return { sandbox, put, get, run, auth, plan, assertParents, assertUnlocked, reject };
}

test('actual relational CLI durably spends120 unique slots before POST and preserves all nine parents', () => {
  const cli = syntheticCli(), summary = JSON.parse(cli.run().trim().split(/\r?\n/).at(-1)), ledger = cli.get(paths.ledger), network = cli.get(paths.counter);
  assert.equal(summary.attempts, 120); assert.equal(summary.totalAttempts, 926); assert.equal(summary.complete, true);
  assert.equal(network.requests.length, 121); assert.equal(network.prespends, 120);
  assert.equal(new Set(ledger.attempts.map(a => a.caseId + a.provider)).size, 120);
  assert.deepEqual(ledger.attempts.map(a => a.number), Array.from({ length: 120 }, (_, i) => 807 + i));
  assert.equal(cli.get(paths.auth).runInitialized, true); assert.doesNotMatch(JSON.stringify(ledger), /private-synthetic-marker/);
  cli.assertParents(); cli.assertUnlocked();
});

test('completed relational CLI recovery makes HTTP0 and preserves the ledger and blind bundle', () => {
  const cli = syntheticCli(); cli.run(); const ledger = cli.get(paths.ledger), review = cli.get(paths.review);
  cli.run('forbid'); assert.equal(cli.get(paths.counter).requests.length, 0);
  assert.deepEqual(cli.get(paths.ledger), ledger); assert.deepEqual(cli.get(paths.review), review);
  cli.assertParents(); cli.assertUnlocked();
});

test('actual relational CLI rejects a tampered blind bundle before HTTP', () => {
  const cli = syntheticCli(); cli.run(); const bundle = cli.get(paths.review);
  bundle.blinded[0].provider = 'google'; cli.put(paths.review, bundle); cli.reject(); cli.assertParents();
});

test('actual relational CLI cannot reset a missing ledger after authorization is consumed', () => {
  const cli = syntheticCli(); cli.put(paths.auth, { ...cli.auth, runInitialized: true }); cli.reject();
  assert.equal(existsSync(resolve(cli.sandbox, paths.ledger)), false); assert.equal(cli.get(paths.auth).runInitialized, true); cli.assertParents();
});

test('actual relational CLI rejects old34 approval before initialization or HTTP', () => {
  const cli = syntheticCli(); cli.put(paths.auth, { ...cli.auth, approvedCalls: 34 }); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); assert.equal(existsSync(resolve(cli.sandbox, paths.ledger)), false); cli.assertParents();
});

test('actual relational CLI rejects the predecessor120 approval rather than reusing its stopped slots', () => {
  const cli = syntheticCli(); cli.put(paths.auth, { ...cli.auth, comparison: 'annotated-evidence-v1', previousCalls: 735,
    cumulativeMaximum: 855, humanAuthorization: 'additional-120-free-annotated-calls' }); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); assert.equal(existsSync(resolve(cli.sandbox, paths.ledger)), false);
  cli.assertParents();
});

test('actual relational CLI rejects drift in its ninth frozen parent before HTTP', () => {
  const cli = syntheticCli(), parent = cli.get(parentPaths[8]); parent.attempts[0].number = 999;
  cli.put(parentPaths[8], parent); cli.reject(); assert.deepEqual(cli.get(parentPaths[8]), parent); assert.equal(cli.get(paths.auth).runInitialized, false);
});

test('actual relational CLI rejects frozen reference drift before HTTP', () => {
  const cli = syntheticCli(); cli.put(cli.plan.references[0].path, '{"syntheticOnly":"changed"}'); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); cli.assertParents();
});

test('actual relational CLI rejects frozen fixture drift before HTTP', () => {
  const cli = syntheticCli(); cli.put('tests/fixtures/english-accuracy.json', fixtureText + ' '); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); cli.assertParents();
});

test('actual relational CLI rejects uncommitted source drift before HTTP', () => {
  const cli = syntheticCli(); cli.put('source-drift.txt', 'synthetic source drift'); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); cli.assertParents();
});

test('actual relational CLI preserves another run exclusive lock without HTTP', () => {
  const cli = syntheticCli(); cli.put(paths.lock, { owner: 'synthetic-other-run' });
  assert.throws(() => cli.run('forbid'), error => error.status === 1);
  assert.deepEqual(cli.get(paths.lock), { owner: 'synthetic-other-run' }); assert.equal(cli.get(paths.counter).requests.length, 0);
  assert.equal(cli.get(paths.auth).runInitialized, false); cli.assertParents();
});

test('actual relational CLI zero-slot save failure leaves approval unconsumed with HTTP0', () => {
  const cli = syntheticCli(); mkdirSync(resolve(cli.sandbox, paths.ledger + '.tmp')); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); assert.equal(existsSync(resolve(cli.sandbox, paths.ledger)), false); cli.assertParents();
});

test('actual relational CLI authorization marker save failure preserves zero slots with HTTP0', () => {
  const cli = syntheticCli(); mkdirSync(resolve(cli.sandbox, paths.auth + '.tmp')); cli.reject();
  assert.equal(cli.get(paths.auth).runInitialized, false); assert.equal(cli.get(paths.ledger).attempts.length, 0); cli.assertParents();
});

test('actual relational CLI first-slot save failure allows only preflight and provider POST0', () => {
  const cli = syntheticCli(); assert.throws(() => cli.run('slot-fails'), error => error.status === 1);
  assert.equal(cli.get(paths.counter).requests.length, 1); assert.equal(cli.get(paths.counter).requests[0].caseId, 'preflight-invalid-case');
  assert.equal(cli.get(paths.counter).prespends, 0); assert.equal(cli.get(paths.auth).runInitialized, true);
  assert.equal(cli.get(paths.ledger).attempts.length, 0); cli.assertParents(); cli.assertUnlocked();
});

test('actual relational CLI terminal closure recovery makes HTTP0 and preserves its consumed slot', () => {
  const cli = syntheticCli(); cli.run('closed'); const ledger = cli.get(paths.ledger);
  assert.equal(ledger.endpointStop, 'evaluation_disabled'); assert.equal(ledger.attempts.length, 1); assert.equal(ledger.completed, true);
  cli.run('forbid'); assert.equal(cli.get(paths.counter).requests.length, 0); assert.deepEqual(cli.get(paths.ledger), ledger);
  cli.assertParents(); cli.assertUnlocked();
});

test('actual relational CLI retains crashed started slot807 and posts only the remaining119', () => {
  const cli = syntheticCli(); assert.throws(() => cli.run('crash-start'), error => error.status === 17);
  const started = cli.get(paths.ledger).attempts[0]; assert.equal(started.status, 'started'); assert.equal(started.number, 807);
  // Preserve the intentionally orphaned test lock before simulating operator recovery.
  const preservedLock = resolve(cli.sandbox, root + 'preserved-crash-lock.json');
  renameSync(resolve(cli.sandbox, paths.lock), preservedLock); cli.run();
  const network = cli.get(paths.counter), ledger = cli.get(paths.ledger);
  assert.equal(network.prespends, 119); assert.equal(network.requests.length, 120); assert.equal(network.requests[1].provider, 'groq');
  assert.equal(ledger.attempts.length, 120); assert.equal(ledger.completed, true); assert.deepEqual(ledger.attempts[0], started);
  assert.equal(existsSync(preservedLock), true); cli.assertParents(); cli.assertUnlocked();
});

test('actual relational CLI successful low-token responses persist quota and wait60 seconds in30 second slices', () => {
  const cli = syntheticCli(); cli.run('success-low-quota'); const ledger = cli.get(paths.ledger), delays = cli.get(paths.counter).delays;
  assert.equal(ledger.attempts.length, 120); assert.equal(ledger.completed, true);
  for (const attempt of ledger.attempts) {
    assert.equal(attempt.status, 'response'); assert.equal(attempt.waitAfterMs, 60000);
    assert.deepEqual(attempt.quota, { remainingTokens: 0, resetTokensSeconds: 63 });
  }
  assert.deepEqual(delays, Array(238).fill(30000)); cli.assertParents(); cli.assertUnlocked();
});
