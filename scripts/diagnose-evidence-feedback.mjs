// Separate 20-slot diagnostic cohort. Never reset/reuse the stopped 115-call run.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, openSync, closeSync, unlinkSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { verifyOriginalComparisonSource } from './evaluate-original-feedback.mjs';

export const diagnosticPlan = JSON.parse(readFileSync(fileURLToPath(new URL('../data/evaluations/evidence-diagnostic-plan.json', import.meta.url)), 'utf8'));
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const contentHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const stamp = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
export function atomicJson(path, value, { write = writeFileSync, rename = renameSync, platform = process.platform,
  pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } = {}) {
  write(path + '.tmp', JSON.stringify(value, null, 2) + '\n');
  for (let attempt = 0; ; attempt++) {
    try { rename(path + '.tmp', path); return; }
    catch (error) {
      // Retry only Windows file replacement; never repeat an HTTP request or remove the old ledger.
      if (platform !== 'win32' || !['EPERM', 'EACCES'].includes(error?.code) || attempt >= 4) throw error;
      pause(25);
    }
  }
}
const providerStops = new Set(['provider_limit', 'provider_minute_limit', 'provider_daily_limit', 'groq_limit', 'groq_billing', 'provider_precondition', 'provider_key_invalid', 'provider_key_blocked', 'provider_permission', 'groq_key_invalid', 'groq_permission', 'evaluation_key_missing']);
const endpointStops = new Set(['evaluation_disabled', 'evaluation_unauthorized', 'evaluation_invalid_request', 'evaluation_invalid_case', 'evaluation_invalid_response', 'evaluation_transport']);
const ownCodes = [...endpointStops, 'evaluation_key_missing', 'evaluation_internal'];
const endpoint = '/api/english-accuracy-evaluation';
export const diagnosticSchedule = plan => plan.caseIds.flatMap(caseId => ['google', 'groq'].map(provider => ({ caseId, provider })));
export function assertDiagnosticLiveArguments(args, ci) {
  if (ci || args.length !== 4 || !args.includes('--live') || !args.includes('--confirmed-free-tier') || args.indexOf('--approved-calls') < 0 || args[args.indexOf('--approved-calls') + 1] !== '20') throw Error('Separate approved20 free diagnostic calls required outside CI.');
}
export function validateDiagnosticAuthorization(a, sourceCommit, planHash) {
  const keys = ['schemaVersion', 'cohort', 'approvedCalls', 'previousCalls', 'maximumTotalCalls', 'sourceCommit', 'siteSourceCommit', 'planHash', 'humanAuthorization', 'confirmedFreeProviders', 'approvedAt', 'runInitialized'];
  if (!a || Object.keys(a).some(k => !keys.includes(k)) || a.schemaVersion !== 1 || a.cohort !== diagnosticPlan.cohort || a.approvedCalls !== 20 || a.previousCalls !== 655 || a.maximumTotalCalls !== 675
    || !/^[a-f0-9]{40}$/.test(sourceCommit) || a.sourceCommit !== sourceCommit || a.siteSourceCommit !== diagnosticPlan.siteSourceCommit || a.planHash !== planHash
    || a.humanAuthorization !== 'additional-20-free-diagnostic-calls' || hash(a.confirmedFreeProviders) !== hash(['google', 'groq']) || !stamp(a.approvedAt) || Date.parse(a.approvedAt) > Date.now()
    || a.runInitialized !== undefined && typeof a.runInitialized !== 'boolean') throw Error('Missing or changed human diagnostic authorization.');
}
export function validateDiagnosticParents(arrays, plan = diagnosticPlan) {
  if (arrays.length !== 5 || arrays.some((a, i) => !Array.isArray(a) || a.length !== plan.parentCounts[i] || hash(a) !== plan.parentLedgerHashes[i])
    || arrays.flat().length !== 655 || hash(arrays.flat()) !== plan.combinedParentHash) throw Error('Frozen655 history changed.');
}
export function diagnosticExpected(helper, profiles, sourceCommit) {
  return { cohort: diagnosticPlan.cohort, comparison: diagnosticPlan.comparison, previousCalls: 655, maximumCalls: 20, previousHash: diagnosticPlan.combinedParentHash,
    planHash: hash(diagnosticPlan), sourceCommit, siteSourceCommit: diagnosticPlan.siteSourceCommit, fixtureContentHash: diagnosticPlan.fixtureContentHash,
    profiles, models: helper.accuracyModels, schedule: diagnosticSchedule(diagnosticPlan) };
}
const closed = (ledger, expected) => !!ledger.endpointStop || expected.schedule.every((s, i) => ledger.providerStops[s.provider] || ledger.attempts.some(a => a.scheduleIndex === i));
export function restoreDiagnosticLedger(authorization, ledger, expected, helpers) {
  if (!ledger && authorization.runInitialized) throw Error('Consumed diagnostic ledger missing; refusing reset.');
  const restored = ledger ?? { ...expected, providerStops: {}, attempts: [] };
  validateDiagnosticLedger(restored, expected, helpers);
  return restored;
}
export function validateDiagnosticLedger(ledger, expected, helpers) {
  if (!ledger || Object.keys(ledger).some(k => ![...Object.keys(expected), 'providerStops', 'endpointStop', 'attempts', 'completed'].includes(k))
    || !Array.isArray(ledger.attempts) || ledger.attempts.length > 20 || !ledger.providerStops || Array.isArray(ledger.providerStops)
    || Object.keys(expected.profiles).length !== 10 || expected.schedule.length !== 20 || hash(expected.schedule) !== hash(diagnosticSchedule(diagnosticPlan))
    || !/^[a-f0-9]{40}$/.test(expected.sourceCommit)) throw Error('Invalid diagnostic cohort.');
  for (const k of Object.keys(expected)) if (hash(ledger[k]) !== hash(expected[k])) throw Error('Diagnostic profiles changed.');
  const stops = {}; let globalStop, cursor = 0;
  const keys = ['number', 'scheduleIndex', 'caseId', 'provider', 'status', 'startedAt', 'finishedAt', 'httpStatus', 'providerStatus', 'code', 'validationStage', 'diagnostic', 'validationDetail', 'waitAfterMs'];
  for (const [i, a] of ledger.attempts.entries()) {
    while (cursor < 20 && stops[expected.schedule[cursor].provider]) cursor++;
    const row = expected.schedule[cursor];
    if (globalStop || !row || Object.keys(a).some(k => !keys.includes(k)) || a.number !== 656 + i || a.scheduleIndex !== cursor || a.caseId !== row.caseId || a.provider !== row.provider
      || !['started', 'valid_response', 'failure'].includes(a.status) || !stamp(a.startedAt) || a.status !== 'started' && !stamp(a.finishedAt)) throw Error('Invalid diagnostic attempt.');
    for (const k of ['httpStatus', 'providerStatus']) if (a[k] !== undefined && (!Number.isInteger(a[k]) || a[k] < 100 || a[k] > 599)) throw Error('Invalid diagnostic HTTP status.');
    if (a.validationStage !== undefined && !helpers.validationStages.includes(a.validationStage) || a.diagnostic !== undefined && !helpers.diagnostics.includes(a.diagnostic)) throw Error('Invalid diagnostic metadata.');
    if (a.validationDetail !== undefined && (a.status !== 'failure' || !['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
      || !helpers.parseValidationDetail(a.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }))) throw Error('Invalid safe diagnostic detail.');
    if (a.status === 'valid_response' && (!Number.isInteger(a.httpStatus) || a.httpStatus < 200 || a.httpStatus > 299
      || ['providerStatus', 'code', 'validationStage', 'diagnostic', 'validationDetail'].some(k => a[k] !== undefined))) throw Error('Invalid valid-response metadata.');
    if (a.status === 'started' && ['finishedAt', 'httpStatus', 'providerStatus', 'code', 'validationStage', 'diagnostic', 'validationDetail'].some(k => a[k] !== undefined)) throw Error('Invalid started metadata.');
    if (a.waitAfterMs !== undefined && (a.status !== 'valid_response' || a.waitAfterMs !== 60000)) throw Error('Invalid diagnostic pacing.');
    if (a.status === 'failure' && ![...helpers.safeCodes, ...ownCodes].includes(a.code)) throw Error('Invalid diagnostic error.');
    if (providerStops.has(a.code)) stops[a.provider] = a.code;
    if (endpointStops.has(a.code)) globalStop = a.code;
    cursor++;
  }
  if (hash(stops) !== hash(ledger.providerStops) || globalStop !== ledger.endpointStop || ledger.completed !== undefined && typeof ledger.completed !== 'boolean'
    || ledger.completed && !closed(ledger, expected)) throw Error('Invalid diagnostic closure.');
}
export async function collectDiagnosticEvidence(context, { fetcher = fetch, save = () => {}, pause = ms => new Promise(ok => setTimeout(ok, ms)), now = Date.now, signal, progress = () => {} } = {}) {
  const { ledger, expected, helpers, config } = context;
  validateDiagnosticLedger(ledger, expected, helpers);
  if (ledger.completed) return;
  for (const [scheduleIndex, row] of expected.schedule.entries()) {
    signal?.throwIfAborted();
    if (ledger.endpointStop || ledger.providerStops[row.provider] || ledger.attempts.some(a => a.scheduleIndex === scheduleIndex)) continue;
    if (ledger.attempts.length >= 20) throw Error('Diagnostic budget exhausted.');
    const sample = helpers.cases.find(c => c.id === row.caseId), profile = expected.profiles[row.caseId];
    if (!sample || !profile) throw Error('Invalid fixed diagnostic case.');
    // Pacing also survives restarts; started slots remain spent, never retried.
    const last = ledger.attempts.at(-1), interval = last?.waitAfterMs ?? 30000;
    let delay = last ? Math.max(0, interval - Math.max(0, now() - Date.parse(last.finishedAt ?? last.startedAt))) : 0;
    while (delay > 0) { signal?.throwIfAborted(); const slice = Math.min(delay, 30000); await pause(slice); delay -= slice; }
    signal?.throwIfAborted();
    const a = { number: 656 + ledger.attempts.length, scheduleIndex, ...row, status: 'started', startedAt: new Date(now()).toISOString() };
    ledger.attempts.push(a); save(ledger);
    try {
      const response = await fetcher(config.origin + endpoint, { method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([AbortSignal.timeout(45000), signal]) : AbortSignal.timeout(45000),
        headers: { Origin: config.origin, 'Content-Type': 'application/json', 'X-English-Accuracy-Token': config.evaluationToken,
          ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : 'Bearer ' + config.siteToken } : {}) }, body: JSON.stringify({ ...row, comparison: expected.comparison }) });
      a.httpStatus = response.status; let result;
      try { result = await response.json(); } catch { result = {}; }
      const feedback = response.ok ? helpers.parseFeedback(result?.feedback) : undefined;
      if (response.ok && result?.comparison === expected.comparison && result.caseId === row.caseId && result.provider === row.provider
        && result.promptHash === profile.promptHash && result.requestHash === profile.requestHash && feedback?.original === sample.sentence && feedback.model === expected.models[row.provider]) {
        a.status = 'valid_response'; // Discard text and judgments; no English score.
        if (Number.isInteger(result.quota?.remainingTokens) && result.quota.remainingTokens >= 0 && result.quota.remainingTokens < 6000) a.waitAfterMs = 60000;
      } else {
        a.status = 'failure'; a.code = response.status === 429 ? row.provider === 'groq' ? 'groq_limit' : 'provider_limit'
          : response.status === 402 || result?.providerStatus === 402 ? row.provider === 'groq' ? 'groq_billing' : 'provider_precondition'
            : [...helpers.safeCodes, ...ownCodes].includes(result?.code) ? result.code : 'evaluation_invalid_response';
        const wrongIdentity = ['caseId', 'provider', 'comparison'].some(k => result?.[k] !== undefined && result[k] !== (k === 'comparison' ? expected.comparison : row[k]));
        if (wrongIdentity || ['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
          && (result?.caseId !== row.caseId || result.provider !== row.provider || result.comparison !== expected.comparison)) a.code = 'evaluation_invalid_response';
        if (Number.isInteger(result?.providerStatus) && result.providerStatus >= 100 && result.providerStatus <= 599) a.providerStatus = result.providerStatus;
        if (helpers.validationStages.includes(result?.validationStage)) a.validationStage = result.validationStage;
        if (helpers.diagnostics.includes(result?.diagnostic)) a.diagnostic = result.diagnostic;
        const detail = ['provider_invalid_response', 'groq_invalid_response'].includes(a.code) ? helpers.parseValidationDetail(result?.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }) : undefined;
        if (detail) a.validationDetail = detail;
        if (providerStops.has(a.code)) ledger.providerStops[row.provider] = a.code;
        if (endpointStops.has(a.code)) ledger.endpointStop = a.code;
      }
    } catch { a.status = 'failure'; a.code = 'evaluation_transport'; ledger.endpointStop = a.code; }
    a.finishedAt = new Date(now()).toISOString(); save(ledger); validateDiagnosticLedger(ledger, expected, helpers);
    progress({ consumedSlots: ledger.attempts.length, validResponses: ledger.attempts.filter(a => a.status === 'valid_response').length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop });
    if (closed(ledger, expected)) break;
  }
  ledger.completed = closed(ledger, expected); save(ledger);
}
async function main() {
  assertDiagnosticLiveArguments(process.argv.slice(2), process.env.CI);
  if (process.stdin.isTTY) { process.stdin.setRawMode(true); console.log('Ready for approved20 diagnostic JSON on hidden stdin.'); }
  const rl = createInterface({ input: process.stdin, terminal: false }); let config;
  try { config = JSON.parse(await new Promise((ok, no) => { rl.once('line', line => line.length <= 16384 ? ok(line) : no(Error('Invalid configuration size'))); rl.once('close', () => no(Error('Missing configuration'))); })); }
  finally { rl.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  if (Object.keys(config).some(k => !['origin', 'evaluationToken', 'siteToken', 'sourceCommit'].includes(k)) || config.origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site'
    || !/^[a-f0-9]{64}$/.test(config.evaluationToken) || !/^[a-f0-9]{40}$/.test(config.sourceCommit) || config.siteToken !== undefined && (typeof config.siteToken !== 'string' || config.siteToken.length > 8192)) throw Error('Invalid diagnostic configuration.');
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, diagnosticPlan.cohort), authPath = resolve(directory, 'authorization.json');
  const authorization = JSON.parse(readFileSync(authPath, 'utf8')); // Created only after new human approval.
  validateDiagnosticAuthorization(authorization, config.sourceCommit, hash(diagnosticPlan));
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx'), stop = new AbortController(), interrupt = () => stop.abort(Error('Interrupted'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, cohort: diagnosticPlan.cohort, startedAt: new Date().toISOString() })); mkdirSync(directory, { recursive: true });
    const parents = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json', 'evidence-v1/ledger.json'].map(p => JSON.parse(readFileSync(resolve(root, p), 'utf8')));
    validateDiagnosticParents(parents.map(p => p.attempts)); if (!parents.at(-1).completed) throw Error('Prior cohort is not terminal.');
    const fixture = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'), reportText = readFileSync(diagnosticPlan.reference.path, 'utf8');
    if (contentHash(fixture) !== diagnosticPlan.fixtureContentHash || contentHash(reportText) !== diagnosticPlan.reference.hash) throw Error('Frozen diagnostic references changed.');
    const runDirectory = mkdtempSync(resolve(directory, 'run-')), modulePath = resolve(runDirectory, 'helper.mjs');
    await build({ entryPoints: ['lib/evidence-feedback-evaluation.ts'], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
    const helper = await import(pathToFileURL(modulePath).href), profiles = {}, report = JSON.parse(reportText);
    for (const id of diagnosticPlan.caseIds) {
      const sample = helper.accuracyCases.find(c => c.id === id); if (!sample) throw Error('Diagnostic case changed.');
      const profile = await helper.evidenceAccuracyHashes(sample), previous = report.profiles[id];
      if (profile.promptHash !== previous.promptHash || profile.requestHash !== previous.requestHash) throw Error('Diagnostic request changed.');
      profiles[id] = profile;
    }
    const expected = diagnosticExpected(helper, profiles, config.sourceCommit), helpers = { cases: helper.accuracyCases, parseFeedback: helper.parseEvidenceAccuracyFeedback,
      parseValidationDetail: helper.parseFeedbackValidationDetail, safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
    const ledgerPath = resolve(directory, 'ledger.json'), ledger = restoreDiagnosticLedger(authorization, existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : undefined, expected, helpers);
    if (!ledger.completed && !closed(ledger, expected)) {
      verifyOriginalComparisonSource(config.sourceCommit);
      execFileSync('git', ['diff', '--quiet', diagnosticPlan.siteSourceCommit, config.sourceCommit, '--', 'app', 'lib', 'tests/fixtures/english-accuracy.json', 'data/evaluations/evidence-feedback-plan.json', 'package.json', 'package-lock.json', '.openai/hosting.json', 'vite.config.ts'], { stdio: 'pipe' });
      atomicJson(ledgerPath, ledger); authorization.runInitialized = true; atomicJson(authPath, authorization);
      // Invalid fixed ID returns before provider fetch; outside the20 provider slots.
      const preflight = await fetch(config.origin + endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Origin: config.origin, 'Content-Type': 'application/json', 'X-English-Accuracy-Token': config.evaluationToken,
        ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : 'Bearer ' + config.siteToken } : {}) }, body: JSON.stringify({ caseId: 'preflight-invalid-case', provider: 'google', comparison: expected.comparison }) });
      if (preflight.status !== 400 || (await preflight.json()).code !== 'evaluation_invalid_case') throw Error('Diagnostic endpoint is not ready.');
    }
    await collectDiagnosticEvidence({ ledger, expected, helpers, config }, { save: v => atomicJson(ledgerPath, v), signal: stop.signal, progress: v => console.log(JSON.stringify(v)) });
    validateDiagnosticLedger(ledger, expected, helpers);
    console.log(JSON.stringify({ complete: ledger.completed, cohort: expected.cohort, consumedSlots: ledger.attempts.length, maximumCalls: 20, cumulativeConsumedSlots: 655 + ledger.attempts.length,
      notAttempted: expected.schedule.length - ledger.attempts.length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop, englishScore: null }));
  } finally { closeSync(lock); unlinkSync(lockPath); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Diagnostic run stopped; consumed slots and frozen history preserved.'); process.exitCode = 1; });
