// Separate34 cohort. Preparation never creates approval or calls either model.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { originalComparisonFixture, verifyOriginalComparisonSource } from './evaluate-original-feedback.mjs';
import { blindAttempt, reviewBundle } from './evaluate-english-accuracy.mjs';
import { atomicJson } from './diagnose-evidence-feedback.mjs';

export const tokenComparison = 'token-evidence-v1';
const previousCalls = 701, maximumCalls = 34, round = 8;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentHash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
const stamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
const providerStops = new Set(['provider_limit', 'provider_minute_limit', 'provider_daily_limit', 'groq_limit', 'groq_billing', 'provider_precondition', 'provider_key_invalid', 'provider_key_blocked', 'provider_permission', 'groq_key_invalid', 'groq_permission', 'provider_model', 'provider_request', 'groq_model', 'groq_request', 'evaluation_key_missing']);
const endpointStops = new Set(['evaluation_disabled', 'evaluation_unauthorized', 'evaluation_invalid_request', 'evaluation_invalid_case', 'evaluation_invalid_response', 'evaluation_transport', 'evaluation_internal']);
const collectorCodes = [...endpointStops, 'evaluation_key_missing', 'evaluation_internal'];
const endpoint = '/api/english-accuracy-evaluation';
const init = (config, body, signal) => ({ method: 'POST', redirect: 'error', signal,
  headers: { 'Content-Type': 'application/json', Origin: config.origin, 'X-English-Accuracy-Token': config.evaluationToken,
    ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : 'Bearer ' + config.siteToken } : {}) }, body: JSON.stringify(body) });
const closed = (ledger, expected) => !!ledger.endpointStop || expected.schedule.every((s, i) => ledger.providerStops[s.provider] || ledger.attempts.some(a => a.scheduleIndex === i));

export function assertTokenLiveArguments(args, ci) {
  const index = args.indexOf('--approved-calls');
  if (ci || args.length !== 4 || !args.includes('--live') || !args.includes('--confirmed-free-tier') || index < 0 || args[index + 1] !== '34') throw Error('Separate approved34 free token evaluation required outside CI.');
}
export function validateTokenConfiguration(config) {
  if (!config || Object.keys(config).some(k => !['origin', 'evaluationToken', 'siteToken', 'sourceCommit'].includes(k))
    || config.origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site' || !/^[a-f0-9]{64}$/.test(config.evaluationToken)
    || !/^[a-f0-9]{40}$/.test(config.sourceCommit) || config.siteToken !== undefined && (typeof config.siteToken !== 'string' || config.siteToken.length > 8192)) throw Error('Invalid token configuration.');
}
export function validateTokenAuthorization(a, sourceCommit, planHash) {
  const keys = ['schemaVersion', 'comparison', 'approvedCalls', 'previousCalls', 'cumulativeMaximum', 'sourceCommit', 'planHash', 'humanAuthorization', 'confirmedFreeProviders', 'approvedAt', 'runInitialized'];
  if (!a || Object.keys(a).some(k => !keys.includes(k)) || a.schemaVersion !== 1 || a.comparison !== tokenComparison || a.approvedCalls !== maximumCalls || a.previousCalls !== previousCalls
    || a.cumulativeMaximum !== 735 || !/^[a-f0-9]{40}$/.test(sourceCommit) || a.sourceCommit !== sourceCommit || a.planHash !== planHash || !/^[a-f0-9]{64}$/.test(planHash)
    || a.humanAuthorization !== 'additional-34-free-token-calls' || hash(a.confirmedFreeProviders) !== hash(['google', 'groq']) || !stamp(a.approvedAt) || Date.parse(a.approvedAt) > Date.now()
    || a.runInitialized !== undefined && typeof a.runInitialized !== 'boolean') throw Error('Missing or changed human token authorization.');
}
export function validateTokenParents(arrays, plan) {
  if (!Array.isArray(arrays) || arrays.length !== 7 || hash(plan.parentCounts) !== hash([240, 120, 120, 60, 115, 20, 26])
    || arrays.some((a, i) => !Array.isArray(a) || a.length !== plan.parentCounts[i] || hash(a) !== plan.parentLedgerHashes[i]) || hash(arrays.flat()) !== plan.combinedParentHash
    || plan.previousCalls !== previousCalls || plan.maximumCalls !== maximumCalls || plan.maximumTotalCalls !== 735) throw Error('Frozen701 history changed.');
}
export function restoreTokenLedger(authorization, ledger, expected, helpers) {
  if (!ledger && authorization.runInitialized) throw Error('Consumed token ledger missing; refusing reset.');
  const restored = ledger ?? { comparison: tokenComparison, maximumCalls, freeTierConfirmation: 'human-user', ...expected, providerStops: {}, attempts: [] };
  validateTokenLedger(restored, expected, helpers);
  return restored;
}
export function validateTokenLedger(ledger, expected, helpers) {
  const { cases, parseFeedback, parseValidationDetail, parseQuota, safeCodes, validationStages, diagnostics } = helpers;
  if (typeof parseFeedback !== 'function' || typeof parseValidationDetail !== 'function' || typeof parseQuota !== 'function' || !Array.isArray(safeCodes) || !Array.isArray(validationStages) || !Array.isArray(diagnostics)
    || !Array.isArray(cases) || cases.length !== 17 || new Set(cases.map(c => c.id)).size !== 17 || hash(expected.schedule) !== hash(cases.flatMap(c => ['google', 'groq'].map(provider => ({ caseId: c.id, provider }))))
    || Object.keys(expected.profiles).length !== 17 || !ledger || ledger.comparison !== tokenComparison || ledger.maximumCalls !== maximumCalls || ledger.freeTierConfirmation !== 'human-user'
    || !Array.isArray(ledger.attempts) || ledger.attempts.length > maximumCalls || !ledger.providerStops || Array.isArray(ledger.providerStops)) throw Error('Invalid token cohort.');
  const keys = ['fixtureHash', 'fixtureContentHash', 'previousHash', 'planHash', 'referenceHashes', 'sourceCommit', 'profiles', 'models', 'schedule'];
  if (Object.keys(ledger).some(k => ![...keys, 'comparison', 'maximumCalls', 'freeTierConfirmation', 'providerStops', 'endpointStop', 'attempts', 'completed'].includes(k))) throw Error('Unexpected token metadata.');
  for (const k of keys) if (hash(ledger[k]) !== hash(expected[k])) throw Error('Token profiles changed.');
  if (!/^[a-f0-9]{40}$/.test(expected.sourceCommit) || !['fixtureHash', 'fixtureContentHash', 'previousHash', 'planHash'].every(k => /^[a-f0-9]{64}$/.test(expected[k]))) throw Error('Invalid token source.');
  const stops = {}, allowedCodes = [...safeCodes, ...collectorCodes]; let globalStop, cursor = 0;
  const attemptKeys = ['number', 'round', 'comparison', 'scheduleIndex', 'caseId', 'provider', 'domain', 'fixtureHash', 'fixtureContentHash', 'expectedModel', 'promptHash', 'requestHash',
    'status', 'startedAt', 'finishedAt', 'httpStatus', 'feedback', 'waitAfterMs', 'code', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail', 'quota', 'retryAfterSeconds'];
  for (const [i, a] of ledger.attempts.entries()) {
    while (cursor < maximumCalls && stops[expected.schedule[cursor].provider]) cursor++;
    const row = expected.schedule[cursor], profile = row && expected.profiles[row.caseId], sample = cases.find(c => c.id === row?.caseId);
    if (globalStop || !profile || !sample || Object.keys(a).some(k => !attemptKeys.includes(k)) || a.scheduleIndex !== cursor || a.number !== previousCalls + i + 1 || a.round !== round || a.comparison !== tokenComparison
      || a.caseId !== row.caseId || a.provider !== row.provider || a.domain !== profile.domain || a.expectedModel !== expected.models[a.provider] || a.promptHash !== profile.promptHash || a.requestHash !== profile.requestHash
      || a.fixtureHash !== expected.fixtureHash || a.fixtureContentHash !== expected.fixtureContentHash || !['started', 'response', 'failure'].includes(a.status) || !stamp(a.startedAt)
      || a.status !== 'started' && !stamp(a.finishedAt)) throw Error('Invalid token attempt.');
    for (const k of ['httpStatus', 'providerStatus']) if (a[k] !== undefined && (!Number.isInteger(a[k]) || a[k] < 100 || a[k] > 599)) throw Error('Invalid token HTTP metadata.');
    if (a.validationStage !== undefined && !validationStages.includes(a.validationStage) || a.diagnostic !== undefined && !diagnostics.includes(a.diagnostic)) throw Error('Invalid token validation metadata.');
    if (a.validationDetail !== undefined && (a.status !== 'failure' || !['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
      || !parseValidationDetail(a.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }))) throw Error('Invalid safe token detail.');
    if (a.quota !== undefined && (a.status === 'started' || !parseQuota(a.quota))) throw Error('Invalid safe token quota.');
    if (a.retryAfterSeconds !== undefined && (a.status !== 'failure' || !Number.isInteger(a.retryAfterSeconds) || a.retryAfterSeconds < 1 || a.retryAfterSeconds > 604800)) throw Error('Invalid safe token retry delay.');
    if (a.waitAfterMs !== undefined && (a.status !== 'response' || a.waitAfterMs !== 60000)) throw Error('Invalid token pacing.');
    if (a.status === 'response') {
      const feedback = parseFeedback(a.feedback);
      if (!feedback || feedback.original !== sample.sentence || feedback.model !== a.expectedModel || hash(feedback) !== hash(a.feedback) || !Number.isInteger(a.httpStatus) || a.httpStatus < 200 || a.httpStatus > 299
        || ['code', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail', 'retryAfterSeconds'].some(k => a[k] !== undefined)) throw Error('Invalid recovered token feedback.');
    } else if (a.feedback !== undefined || (a.status === 'failure' ? !allowedCodes.includes(a.code) || a.httpStatus >= 200 && a.httpStatus < 300 && a.code !== 'evaluation_invalid_response'
      : ['code', 'finishedAt', 'httpStatus', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail', 'quota', 'retryAfterSeconds'].some(k => a[k] !== undefined))) throw Error('Invalid token attempt status.');
    if (providerStops.has(a.code)) stops[a.provider] = a.code;
    if (endpointStops.has(a.code)) globalStop = a.code;
    cursor++;
  }
  if (hash(stops) !== hash(ledger.providerStops) || globalStop !== ledger.endpointStop || ledger.completed !== undefined && typeof ledger.completed !== 'boolean'
    || ledger.completed && !closed(ledger, expected)) throw Error('Invalid token closure.');
}
export function tokenReviewBundle(attempts, existing) {
  if (!existing) return reviewBundle(attempts, round);
  const records = attempts.filter(a => a.round === round), byNumber = new Map(records.map(a => [a.number, a]));
  if (!existing || existing.round !== round || existing.ledgerHash !== hash(records) || existing.blindHash !== hash(existing.blinded)
    || !Array.isArray(existing.blinded) || !Array.isArray(existing.mapping) || existing.blinded.length !== records.length || existing.mapping.length !== records.length
    || new Set(existing.mapping.map(m => m.number)).size !== records.length || Object.keys(existing).some(k => !['round', 'ledgerHash', 'blindHash', 'blinded', 'mapping'].includes(k))) throw Error('Invalid recovered token blind bundle.');
  existing.mapping.forEach((m, i) => {
    const record = byNumber.get(m.number), label = `B${String(i + 1).padStart(3, '0')}`;
    if (!record || m.label !== label || Object.keys(m).some(k => !['label', 'number'].includes(k))) throw Error('Invalid recovered token mapping.');
    const expected = blindAttempt(record); expected.label = label; delete expected.number;
    if (hash(existing.blinded[i]) !== hash(expected)) throw Error('Invalid recovered token blind row.');
  });
  return existing;
}
export async function collectTokenEvidence(context, { fetcher = fetch, save = () => {}, pause = ms => new Promise(ok => setTimeout(ok, ms)), now = Date.now, signal, progress = () => {} } = {}) {
  const { ledger, expected, config, helpers } = context;
  validateTokenLedger(ledger, expected, helpers);
  if (ledger.completed) return;
  for (const [scheduleIndex, row] of expected.schedule.entries()) {
    signal?.throwIfAborted();
    if (ledger.endpointStop || ledger.providerStops[row.provider] || ledger.attempts.some(a => a.scheduleIndex === scheduleIndex)) continue;
    if (ledger.attempts.length >= maximumCalls) throw Error('Token budget exhausted.');
    const sample = helpers.cases.find(c => c.id === row.caseId), profile = expected.profiles[row.caseId];
    const last = ledger.attempts.at(-1), interval = last?.waitAfterMs ?? 30000;
    let delay = last ? Math.max(0, interval - Math.max(0, now() - Date.parse(last.finishedAt ?? last.startedAt))) : 0;
    while (delay > 0) { signal?.throwIfAborted(); const slice = Math.min(delay, 30000); await pause(slice); delay -= slice; }
    signal?.throwIfAborted();
    const a = { number: previousCalls + ledger.attempts.length + 1, round, comparison: tokenComparison, scheduleIndex, ...row, domain: profile.domain,
      fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, expectedModel: expected.models[row.provider], promptHash: profile.promptHash, requestHash: profile.requestHash,
      status: 'started', startedAt: new Date(now()).toISOString() };
    ledger.attempts.push(a); save(ledger); // No HTTP before this durable slot.
    try {
      const response = await fetcher(config.origin + endpoint, init(config, { ...row, comparison: tokenComparison }, signal ? AbortSignal.any([AbortSignal.timeout(45000), signal]) : AbortSignal.timeout(45000)));
      a.httpStatus = response.status; let result;
      try { result = await response.json(); } catch { result = {}; }
      const feedback = response.ok ? helpers.parseFeedback(result?.feedback) : undefined;
      const quota = result?.quota === undefined ? undefined : helpers.parseQuota(result.quota);
      if (quota) a.quota = quota;
      const safeQuota = result?.quota === undefined || quota !== undefined;
      if (response.ok && safeQuota && result?.comparison === tokenComparison && result.caseId === row.caseId && result.provider === row.provider && result.promptHash === profile.promptHash
        && result.requestHash === profile.requestHash && feedback?.original === sample.sentence && feedback.model === a.expectedModel) {
        a.status = 'response'; a.feedback = feedback;
        if (Number.isInteger(result.quota?.remainingTokens) && result.quota.remainingTokens >= 0 && result.quota.remainingTokens < 6000) a.waitAfterMs = 60000;
      } else {
        a.status = 'failure'; a.code = response.status === 429 ? row.provider === 'groq' ? 'groq_limit'
          : ['provider_minute_limit', 'provider_daily_limit'].includes(result?.code) ? result.code : 'provider_limit'
          : response.status === 402 || result?.providerStatus === 402 ? row.provider === 'groq' ? 'groq_billing' : 'provider_precondition'
            : [...helpers.safeCodes, ...collectorCodes].includes(result?.code) ? result.code : 'evaluation_invalid_response';
        const wrongIdentity = ['caseId', 'provider', 'comparison'].some(k => result?.[k] !== undefined && result[k] !== (k === 'comparison' ? tokenComparison : row[k]));
        if (response.ok || wrongIdentity || !safeQuota || ['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
          && (result?.caseId !== row.caseId || result.provider !== row.provider || result.comparison !== tokenComparison)) a.code = 'evaluation_invalid_response';
        if (Number.isInteger(result?.retryAfterSeconds) && result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 604800) a.retryAfterSeconds = result.retryAfterSeconds;
        if (Number.isInteger(result?.providerStatus) && result.providerStatus >= 100 && result.providerStatus <= 599) a.providerStatus = result.providerStatus;
        if (helpers.validationStages.includes(result?.validationStage)) a.validationStage = result.validationStage;
        if (helpers.diagnostics.includes(result?.diagnostic)) a.diagnostic = result.diagnostic;
        const detail = ['provider_invalid_response', 'groq_invalid_response'].includes(a.code) ? helpers.parseValidationDetail(result?.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }) : undefined;
        if (detail) a.validationDetail = detail;
        if (providerStops.has(a.code)) ledger.providerStops[row.provider] = a.code;
        if (endpointStops.has(a.code)) ledger.endpointStop = a.code;
      }
    } catch { a.status = 'failure'; a.code = 'evaluation_transport'; ledger.endpointStop = a.code; }
    a.finishedAt = new Date(now()).toISOString(); save(ledger); validateTokenLedger(ledger, expected, helpers);
    progress({ attempts: ledger.attempts.length, responses: ledger.attempts.filter(a => a.status === 'response').length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop });
    if (closed(ledger, expected)) break;
  }
  ledger.completed = closed(ledger, expected); save(ledger);
}

async function main() {
  assertTokenLiveArguments(process.argv.slice(2), process.env.CI);
  if (process.stdin.isTTY) { process.stdin.setRawMode(true); console.log('Ready for separately approved token evaluation JSON on hidden stdin.'); }
  const rl = createInterface({ input: process.stdin, terminal: false }); let config;
  try { config = JSON.parse(await new Promise((ok, no) => { rl.once('line', line => line.length <= 16384 ? ok(line) : no(Error('Configuration size'))); rl.once('close', () => no(Error('Missing input'))); })); }
  finally { rl.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  validateTokenConfiguration(config);
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, tokenComparison), authorizationPath = resolve(directory, 'authorization.json');
  // A human creates this file only after additional34 approval, never on preparation.
  const authorization = JSON.parse(readFileSync(authorizationPath, 'utf8'));
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx'), stop = new AbortController(), interrupt = () => stop.abort(Error('Interrupted'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, comparison: tokenComparison, startedAt: new Date().toISOString() }));
    mkdirSync(directory, { recursive: true }); const runDirectory = mkdtempSync(resolve(directory, 'run-')), modulePath = resolve(runDirectory, 'requests.mjs');
    await build({ entryPoints: [fileURLToPath(new URL('../lib/token-evidence-evaluation.ts', import.meta.url))], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
    const helper = await import(pathToFileURL(modulePath).href), plan = helper.tokenEvidencePlan;
    validateTokenAuthorization(authorization, config.sourceCommit, hash(plan));
    const parentPaths = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json', 'evidence-v1/ledger.json', 'evidence-diagnostics-v1/ledger.json', 'counted-evidence-v1/ledger.json'];
    const parents = parentPaths.map(p => JSON.parse(readFileSync(resolve(root, p), 'utf8')).attempts); validateTokenParents(parents, plan);
    const references = plan.references.map(r => ({ ...r, text: readFileSync(r.path, 'utf8') }));
    if (references.some(r => contentHash(r.text) !== r.hash)) throw Error('Frozen reports changed.');
    const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'); if (contentHash(fixtureText) !== plan.fixtureContentHash) throw Error('Frozen fixture changed.');
    const profiles = {}; for (const sample of helper.tokenEvidenceCases) profiles[sample.id] = { domain: sample.domain, ...await helper.tokenEvidenceHashes(sample) };
    const expected = { ...originalComparisonFixture(fixtureText, JSON.parse(references[0].text).fixtureHash), previousHash: hash(parents.flat()), planHash: hash(plan), referenceHashes: plan.references,
      sourceCommit: config.sourceCommit, profiles, models: helper.accuracyModels, schedule: helper.tokenEvidenceSchedule() };
    const helpers = { cases: helper.tokenEvidenceCases, parseFeedback: helper.parseTokenEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail,
      parseQuota: helper.parseTokenEvidenceQuota, safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
    const ledgerPath = resolve(directory, 'ledger.json');
    const ledger = restoreTokenLedger(authorization, existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : undefined, expected, helpers);
    const reviewPath = resolve(directory, 'review-bundle.json'), existing = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : undefined;
    if (existing) { tokenReviewBundle(ledger.attempts, existing); if (!closed(ledger, expected)) throw Error('Blind bundle precedes closure.'); }
    if (!ledger.completed && !closed(ledger, expected)) {
      verifyOriginalComparisonSource(config.sourceCommit);
      // Save zero slots before consuming the authorization marker. Never reset it.
      atomicJson(ledgerPath, ledger); authorization.runInitialized = true; atomicJson(authorizationPath, authorization);
      const response = await fetch(config.origin + endpoint, init(config, { caseId: 'preflight-invalid-case', provider: 'google', comparison: tokenComparison }, AbortSignal.any([AbortSignal.timeout(15000), stop.signal])));
      if (response.status !== 400 || (await response.json()).code !== 'evaluation_invalid_case') throw Error('Token endpoint not ready.');
    }
    await collectTokenEvidence({ ledger, expected, config, helpers }, { save: v => atomicJson(ledgerPath, v), signal: stop.signal, progress: v => console.log(JSON.stringify(v)) });
    validateTokenLedger(ledger, expected, helpers);
    const review = tokenReviewBundle(ledger.attempts, existing); atomicJson(reviewPath, review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ complete: ledger.completed, comparison: tokenComparison, attempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length,
      notAttempted: maximumCalls - ledger.attempts.length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop }));
  } finally { closeSync(lock); unlinkSync(lockPath); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Token evaluation stopped; consumed slots and frozen history preserved.'); process.exitCode = 1; });
