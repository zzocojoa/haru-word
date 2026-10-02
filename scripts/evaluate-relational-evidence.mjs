// Separate120 cohort. Preparation never creates approval or calls either model.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { originalComparisonFixture, verifyOriginalComparisonSource } from './evaluate-original-feedback.mjs';
import { blindAttempt, reviewBundle } from './evaluate-english-accuracy.mjs';
import { atomicJson } from './diagnose-evidence-feedback.mjs';

export const relationalComparison = 'relational-evidence-v1';
const previousCalls = 806, maximumCalls = 120, round = 10;
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

export function assertRelationalLiveArguments(args, ci) {
  const index = args.indexOf('--approved-calls');
  if (ci || args.length !== 4 || !args.includes('--live') || !args.includes('--confirmed-free-tier') || index < 0 || args[index + 1] !== '120') throw Error('Separate approved120 free relational evaluation required outside CI.');
}
export function validateRelationalConfiguration(config) {
  if (!config || Object.keys(config).some(k => !['origin', 'evaluationToken', 'siteToken', 'sourceCommit'].includes(k))
    || config.origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site' || !/^[a-f0-9]{64}$/.test(config.evaluationToken)
    || !/^[a-f0-9]{40}$/.test(config.sourceCommit) || config.siteToken !== undefined && (typeof config.siteToken !== 'string' || config.siteToken.length > 8192)) throw Error('Invalid relational configuration.');
}
export function validateRelationalAuthorization(a, sourceCommit, planHash) {
  const keys = ['schemaVersion', 'comparison', 'approvedCalls', 'previousCalls', 'cumulativeMaximum', 'sourceCommit', 'planHash', 'humanAuthorization', 'confirmedFreeProviders', 'approvedAt', 'runInitialized'];
  if (!a || Object.keys(a).some(k => !keys.includes(k)) || a.schemaVersion !== 1 || a.comparison !== relationalComparison || a.approvedCalls !== maximumCalls || a.previousCalls !== previousCalls
    || a.cumulativeMaximum !== 926 || !/^[a-f0-9]{40}$/.test(sourceCommit) || a.sourceCommit !== sourceCommit || a.planHash !== planHash || !/^[a-f0-9]{64}$/.test(planHash)
    || a.humanAuthorization !== 'additional-120-free-relational-calls' || hash(a.confirmedFreeProviders) !== hash(['google', 'groq']) || !stamp(a.approvedAt) || Date.parse(a.approvedAt) > Date.now()
    || a.runInitialized !== undefined && typeof a.runInitialized !== 'boolean') throw Error('Missing or changed human relational authorization.');
}
export function validateRelationalParents(arrays, plan) {
  if (!Array.isArray(arrays) || arrays.length !== 9 || hash(plan.parentCounts) !== hash([240, 120, 120, 60, 115, 20, 26, 34, 71])
    || arrays.some((a, i) => !Array.isArray(a) || a.length !== plan.parentCounts[i] || hash(a) !== plan.parentLedgerHashes[i]) || hash(arrays.flat()) !== plan.combinedParentHash
    || plan.previousCalls !== previousCalls || plan.maximumCalls !== maximumCalls || plan.maximumTotalCalls !== 926) throw Error('Frozen806 history changed.');
}
export function restoreRelationalLedger(authorization, ledger, expected, helpers) {
  if (!ledger && authorization.runInitialized) throw Error('Consumed relational ledger missing; refusing reset.');
  const restored = ledger ?? { comparison: relationalComparison, maximumCalls, freeTierConfirmation: 'human-user', ...expected, providerStops: {}, attempts: [] };
  validateRelationalLedger(restored, expected, helpers);
  return restored;
}
export function validateRelationalLedger(ledger, expected, helpers) {
  const { cases, parseFeedback, parseValidationDetail, parseQuota, safeCodes, validationStages, diagnostics } = helpers;
  if (typeof parseFeedback !== 'function' || typeof parseValidationDetail !== 'function' || typeof parseQuota !== 'function' || !Array.isArray(safeCodes) || !Array.isArray(validationStages) || !Array.isArray(diagnostics)
    || !Array.isArray(cases) || cases.length !== 60 || new Set(cases.map(c => c.id)).size !== 60 || hash(expected.schedule) !== hash(cases.flatMap(c => ['google', 'groq'].map(provider => ({ caseId: c.id, provider }))))
    || Object.keys(expected.profiles).length !== 60 || !ledger || ledger.comparison !== relationalComparison || ledger.maximumCalls !== maximumCalls || ledger.freeTierConfirmation !== 'human-user'
    || !Array.isArray(ledger.attempts) || ledger.attempts.length > maximumCalls || !ledger.providerStops || Array.isArray(ledger.providerStops)) throw Error('Invalid relational cohort.');
  const keys = ['fixtureHash', 'fixtureContentHash', 'previousHash', 'planHash', 'referenceHashes', 'sourceCommit', 'profiles', 'models', 'schedule'];
  if (Object.keys(ledger).some(k => ![...keys, 'comparison', 'maximumCalls', 'freeTierConfirmation', 'providerStops', 'endpointStop', 'attempts', 'completed'].includes(k))) throw Error('Unexpected relational metadata.');
  for (const k of keys) if (hash(ledger[k]) !== hash(expected[k])) throw Error('Relational profiles changed.');
  if (!/^[a-f0-9]{40}$/.test(expected.sourceCommit) || !['fixtureHash', 'fixtureContentHash', 'previousHash', 'planHash'].every(k => /^[a-f0-9]{64}$/.test(expected[k]))) throw Error('Invalid relational source.');
  const stops = {}, allowedCodes = [...safeCodes, ...collectorCodes]; let globalStop, cursor = 0;
  const attemptKeys = ['number', 'round', 'comparison', 'scheduleIndex', 'caseId', 'provider', 'domain', 'fixtureHash', 'fixtureContentHash', 'expectedModel', 'promptHash', 'requestHash',
    'status', 'startedAt', 'finishedAt', 'httpStatus', 'feedback', 'waitAfterMs', 'code', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail', 'quota', 'retryAfterSeconds'];
  for (const [i, a] of ledger.attempts.entries()) {
    while (cursor < maximumCalls && stops[expected.schedule[cursor].provider]) cursor++;
    const row = expected.schedule[cursor], profile = row && expected.profiles[row.caseId], sample = cases.find(c => c.id === row?.caseId);
    if (globalStop || !profile || !sample || Object.keys(a).some(k => !attemptKeys.includes(k)) || a.scheduleIndex !== cursor || a.number !== previousCalls + i + 1 || a.round !== round || a.comparison !== relationalComparison
      || a.caseId !== row.caseId || a.provider !== row.provider || a.domain !== profile.domain || a.expectedModel !== expected.models[a.provider] || a.promptHash !== profile.promptHash || a.requestHash !== profile.requestHash
      || a.fixtureHash !== expected.fixtureHash || a.fixtureContentHash !== expected.fixtureContentHash || !['started', 'response', 'failure'].includes(a.status) || !stamp(a.startedAt)
      || a.status !== 'started' && !stamp(a.finishedAt)) throw Error('Invalid relational attempt.');
    for (const k of ['httpStatus', 'providerStatus']) if (a[k] !== undefined && (!Number.isInteger(a[k]) || a[k] < 100 || a[k] > 599)) throw Error('Invalid relational HTTP metadata.');
    if (a.validationStage !== undefined && !validationStages.includes(a.validationStage) || a.diagnostic !== undefined && !diagnostics.includes(a.diagnostic)) throw Error('Invalid relational validation metadata.');
    if (a.validationDetail !== undefined && (a.status !== 'failure' || !['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
      || !parseValidationDetail(a.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }))) throw Error('Invalid safe relational detail.');
    if (a.quota !== undefined && (a.status === 'started' || !parseQuota(a.quota))) throw Error('Invalid safe relational quota.');
    if (a.retryAfterSeconds !== undefined && (a.status !== 'failure' || !Number.isInteger(a.retryAfterSeconds) || a.retryAfterSeconds < 1 || a.retryAfterSeconds > 604800)) throw Error('Invalid safe relational retry delay.');
    if (a.waitAfterMs !== undefined && (a.status !== 'response' || a.waitAfterMs !== 60000)) throw Error('Invalid relational pacing.');
    if (a.status === 'response') {
      const feedback = parseFeedback(a.feedback);
      if (!feedback || feedback.original !== sample.sentence || feedback.model !== a.expectedModel || hash(feedback) !== hash(a.feedback) || !Number.isInteger(a.httpStatus) || a.httpStatus < 200 || a.httpStatus > 299
        || ['code', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail', 'retryAfterSeconds'].some(k => a[k] !== undefined)) throw Error('Invalid recovered relational feedback.');
    } else if (a.feedback !== undefined || (a.status === 'failure' ? !allowedCodes.includes(a.code) || a.httpStatus >= 200 && a.httpStatus < 300 && a.code !== 'evaluation_invalid_response'
      : ['code', 'finishedAt', 'httpStatus', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail', 'quota', 'retryAfterSeconds'].some(k => a[k] !== undefined))) throw Error('Invalid relational attempt status.');
    if (providerStops.has(a.code)) stops[a.provider] = a.code;
    if (endpointStops.has(a.code)) globalStop = a.code;
    cursor++;
  }
  if (hash(stops) !== hash(ledger.providerStops) || globalStop !== ledger.endpointStop || ledger.completed !== undefined && typeof ledger.completed !== 'boolean'
    || ledger.completed && !closed(ledger, expected)) throw Error('Invalid relational closure.');
}
export function relationalReviewBundle(attempts, existing) {
  if (!existing) return reviewBundle(attempts, round);
  const records = attempts.filter(a => a.round === round), byNumber = new Map(records.map(a => [a.number, a]));
  if (!existing || existing.round !== round || existing.ledgerHash !== hash(records) || existing.blindHash !== hash(existing.blinded)
    || !Array.isArray(existing.blinded) || !Array.isArray(existing.mapping) || existing.blinded.length !== records.length || existing.mapping.length !== records.length
    || new Set(existing.mapping.map(m => m.number)).size !== records.length || Object.keys(existing).some(k => !['round', 'ledgerHash', 'blindHash', 'blinded', 'mapping'].includes(k))) throw Error('Invalid recovered relational blind bundle.');
  existing.mapping.forEach((m, i) => {
    const record = byNumber.get(m.number), label = `B${String(i + 1).padStart(3, '0')}`;
    if (!record || m.label !== label || Object.keys(m).some(k => !['label', 'number'].includes(k))) throw Error('Invalid recovered relational mapping.');
    const expected = blindAttempt(record); expected.label = label; delete expected.number;
    if (hash(existing.blinded[i]) !== hash(expected)) throw Error('Invalid recovered relational blind row.');
  });
  return existing;
}
export async function collectRelationalEvidence(context, { fetcher = fetch, save = () => {}, pause = ms => new Promise(ok => setTimeout(ok, ms)), now = Date.now, signal, progress = () => {} } = {}) {
  const { ledger, expected, config, helpers } = context;
  validateRelationalLedger(ledger, expected, helpers);
  if (ledger.completed) return;
  for (const [scheduleIndex, row] of expected.schedule.entries()) {
    signal?.throwIfAborted();
    if (ledger.endpointStop || ledger.providerStops[row.provider] || ledger.attempts.some(a => a.scheduleIndex === scheduleIndex)) continue;
    if (ledger.attempts.length >= maximumCalls) throw Error('Relational budget exhausted.');
    const sample = helpers.cases.find(c => c.id === row.caseId), profile = expected.profiles[row.caseId];
    const last = ledger.attempts.at(-1), interval = last?.waitAfterMs ?? 30000;
    let delay = last ? Math.max(0, interval - Math.max(0, now() - Date.parse(last.finishedAt ?? last.startedAt))) : 0;
    while (delay > 0) { signal?.throwIfAborted(); const slice = Math.min(delay, 30000); await pause(slice); delay -= slice; }
    signal?.throwIfAborted();
    const a = { number: previousCalls + ledger.attempts.length + 1, round, comparison: relationalComparison, scheduleIndex, ...row, domain: profile.domain,
      fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, expectedModel: expected.models[row.provider], promptHash: profile.promptHash, requestHash: profile.requestHash,
      status: 'started', startedAt: new Date(now()).toISOString() };
    ledger.attempts.push(a); save(ledger); // No HTTP before this durable slot.
    try {
      const response = await fetcher(config.origin + endpoint, init(config, { ...row, comparison: relationalComparison }, signal ? AbortSignal.any([AbortSignal.timeout(45000), signal]) : AbortSignal.timeout(45000)));
      a.httpStatus = response.status; let result;
      try { result = await response.json(); } catch { result = {}; }
      const feedback = response.ok ? helpers.parseFeedback(result?.feedback) : undefined;
      const quota = result?.quota === undefined ? undefined : helpers.parseQuota(result.quota);
      if (quota) a.quota = quota;
      const safeQuota = result?.quota === undefined || quota !== undefined;
      if (response.ok && safeQuota && result?.comparison === relationalComparison && result.caseId === row.caseId && result.provider === row.provider && result.promptHash === profile.promptHash
        && result.requestHash === profile.requestHash && feedback?.original === sample.sentence && feedback.model === a.expectedModel) {
        a.status = 'response'; a.feedback = feedback;
        if (Number.isInteger(result.quota?.remainingTokens) && result.quota.remainingTokens >= 0 && result.quota.remainingTokens < 6000) a.waitAfterMs = 60000;
      } else {
        a.status = 'failure'; a.code = response.status === 429 ? row.provider === 'groq' ? 'groq_limit'
          : ['provider_minute_limit', 'provider_daily_limit'].includes(result?.code) ? result.code : 'provider_limit'
          : response.status === 402 || result?.providerStatus === 402 ? row.provider === 'groq' ? 'groq_billing' : 'provider_precondition'
            : [...helpers.safeCodes, ...collectorCodes].includes(result?.code) ? result.code : 'evaluation_invalid_response';
        const wrongIdentity = ['caseId', 'provider', 'comparison'].some(k => result?.[k] !== undefined && result[k] !== (k === 'comparison' ? relationalComparison : row[k]));
        if (response.ok || wrongIdentity || !safeQuota || ['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
          && (result?.caseId !== row.caseId || result.provider !== row.provider || result.comparison !== relationalComparison)) a.code = 'evaluation_invalid_response';
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
    a.finishedAt = new Date(now()).toISOString(); save(ledger); validateRelationalLedger(ledger, expected, helpers);
    progress({ attempts: ledger.attempts.length, responses: ledger.attempts.filter(a => a.status === 'response').length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop });
    if (closed(ledger, expected)) break;
  }
  ledger.completed = closed(ledger, expected); save(ledger);
}

async function main() {
  assertRelationalLiveArguments(process.argv.slice(2), process.env.CI);
  if (process.stdin.isTTY) { process.stdin.setRawMode(true); console.log('Ready for separately approved relational evaluation JSON on hidden stdin.'); }
  const rl = createInterface({ input: process.stdin, terminal: false }); let config;
  try { config = JSON.parse(await new Promise((ok, no) => { rl.once('line', line => line.length <= 16384 ? ok(line) : no(Error('Configuration size'))); rl.once('close', () => no(Error('Missing input'))); })); }
  finally { rl.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  validateRelationalConfiguration(config);
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, relationalComparison), authorizationPath = resolve(directory, 'authorization.json');
  // A human creates this file only after additional120 approval, never on preparation.
  const authorization = JSON.parse(readFileSync(authorizationPath, 'utf8'));
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx'), stop = new AbortController(), interrupt = () => stop.abort(Error('Interrupted'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, comparison: relationalComparison, startedAt: new Date().toISOString() }));
    mkdirSync(directory, { recursive: true }); const runDirectory = mkdtempSync(resolve(directory, 'run-')), modulePath = resolve(runDirectory, 'requests.mjs');
    await build({ entryPoints: [fileURLToPath(new URL('../lib/relational-evidence-evaluation.ts', import.meta.url))], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
    const helper = await import(pathToFileURL(modulePath).href), plan = helper.relationalEvidencePlan;
    validateRelationalAuthorization(authorization, config.sourceCommit, hash(plan));
    const parentPaths = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json', 'evidence-v1/ledger.json', 'evidence-diagnostics-v1/ledger.json', 'counted-evidence-v1/ledger.json', 'token-evidence-v1/ledger.json', 'annotated-evidence-v1/ledger.json'];
    const parents = parentPaths.map(p => JSON.parse(readFileSync(resolve(root, p), 'utf8')).attempts); validateRelationalParents(parents, plan);
    const references = plan.references.map(r => ({ ...r, text: readFileSync(r.path, 'utf8') }));
    if (references.some(r => contentHash(r.text) !== r.hash)) throw Error('Frozen reports changed.');
    const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'); if (contentHash(fixtureText) !== plan.fixtureContentHash) throw Error('Frozen fixture changed.');
    const profiles = {}; for (const sample of helper.relationalEvidenceCases) profiles[sample.id] = { domain: sample.domain, ...await helper.relationalEvidenceHashes(sample) };
    const expected = { ...originalComparisonFixture(fixtureText, JSON.parse(references[0].text).fixtureHash), previousHash: hash(parents.flat()), planHash: hash(plan), referenceHashes: plan.references,
      sourceCommit: config.sourceCommit, profiles, models: helper.accuracyModels, schedule: helper.relationalEvidenceSchedule() };
    const helpers = { cases: helper.relationalEvidenceCases, parseFeedback: helper.parseRelationalEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail,
      parseQuota: helper.parseTokenEvidenceQuota, safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS };
    const ledgerPath = resolve(directory, 'ledger.json');
    const ledger = restoreRelationalLedger(authorization, existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : undefined, expected, helpers);
    const reviewPath = resolve(directory, 'review-bundle.json'), existing = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : undefined;
    if (existing) { relationalReviewBundle(ledger.attempts, existing); if (!closed(ledger, expected)) throw Error('Blind bundle precedes closure.'); }
    if (!ledger.completed && !closed(ledger, expected)) {
      verifyOriginalComparisonSource(config.sourceCommit);
      // Save zero slots before consuming the authorization marker. Never reset it.
      atomicJson(ledgerPath, ledger); authorization.runInitialized = true; atomicJson(authorizationPath, authorization);
      const response = await fetch(config.origin + endpoint, init(config, { caseId: 'preflight-invalid-case', provider: 'google', comparison: relationalComparison }, AbortSignal.any([AbortSignal.timeout(15000), stop.signal])));
      if (response.status !== 400 || (await response.json()).code !== 'evaluation_invalid_case') throw Error('Relational endpoint not ready.');
    }
    await collectRelationalEvidence({ ledger, expected, config, helpers }, { save: v => atomicJson(ledgerPath, v), signal: stop.signal, progress: v => console.log(JSON.stringify(v)) });
    validateRelationalLedger(ledger, expected, helpers);
    const review = relationalReviewBundle(ledger.attempts, existing); atomicJson(reviewPath, review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ complete: ledger.completed, comparison: relationalComparison, attempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length,
      notAttempted: maximumCalls - ledger.attempts.length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop }));
  } finally { closeSync(lock); unlinkSync(lockPath); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Relational evaluation stopped; consumed slots and frozen history preserved.'); process.exitCode = 1; });
