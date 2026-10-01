// Preparation is authorized; this new 120-slot cohort needs separate approval.
// Preserve the frozen 540 calls. Never retry, fall back, reset or run live in CI.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { originalComparisonFixture, verifyOriginalComparisonSource } from './evaluate-original-feedback.mjs';
import { blindAttempt, reviewBundle } from './evaluate-english-accuracy.mjs';
const comparison = 'evidence-v1', previousCalls = 540, maximumCalls = 120, round = 6;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const contentHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const timestamp = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
const atomicJson = (path, v) => { writeFileSync(path + '.tmp', JSON.stringify(v, null, 2) + '\n'); renameSync(path + '.tmp', path); };
const providerStops = new Set(['provider_limit', 'provider_minute_limit', 'provider_daily_limit', 'groq_limit', 'groq_billing', 'provider_precondition', 'provider_key_invalid', 'provider_key_blocked', 'provider_permission', 'groq_key_invalid', 'groq_permission', 'evaluation_key_missing']);
const endpointStops = new Set(['evaluation_disabled', 'evaluation_unauthorized', 'evaluation_invalid_request', 'evaluation_invalid_case']);
const collectorCodes = ['evaluation_internal', 'evaluation_invalid_response', 'evaluation_transport', ...endpointStops, 'evaluation_key_missing'];
const endpoint = '/api/english-accuracy-evaluation';
const init = (config, body, signal) => ({ method: 'POST', redirect: 'error', signal,
  headers: { 'Content-Type': 'application/json', Origin: config.origin, 'X-English-Accuracy-Token': config.evaluationToken,
    ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : `Bearer ${config.siteToken}` } : {}) }, body: JSON.stringify(body) });
export function assertEvidenceLiveArguments(args, ci) {
  const index = args.indexOf('--approved-calls');
  if (args.length !== 4 || !args.includes('--live') || !args.includes('--confirmed-free-tier') || index < 0 || args[index + 1] !== '120' || ci) throw Error('Separate approved 120-call free evaluation required outside CI.');
}
export function validateEvidenceAuthorization(a, sourceCommit, planHash) {
  const keys = ['schemaVersion', 'comparison', 'approvedCalls', 'previousCalls', 'cumulativeMaximum', 'sourceCommit', 'planHash', 'humanAuthorization', 'confirmedFreeProviders', 'approvedAt', 'runInitialized'];
  if (!a || Object.keys(a).some(k => !keys.includes(k)) || a.schemaVersion !== 1 || a.comparison !== comparison || a.approvedCalls !== maximumCalls || a.previousCalls !== previousCalls
      || a.cumulativeMaximum !== 660 || a.sourceCommit !== sourceCommit || a.planHash !== planHash || a.humanAuthorization !== 'additional-120-free-calls'
      || hash(a.confirmedFreeProviders) !== hash(['google', 'groq']) || !timestamp(a.approvedAt)
      || Date.parse(a.approvedAt) > Date.now() || (a.runInitialized !== undefined && typeof a.runInitialized !== 'boolean')) throw Error('Missing or changed human authorization.');
}
export function validateEvidenceParents(arrays, plan) {
  if (arrays.length !== 4 || arrays.some((a, i) => a.length !== [240, 120, 120, 60][i] || hash(a) !== plan.parentLedgerHashes[i])
      || hash(arrays.flat()) !== plan.combinedParentHash || plan.previousCalls !== previousCalls || plan.maximumCalls !== maximumCalls) throw Error('Frozen 540-call history changed.');
}
export function validateEvidenceComparison(previous, ledger, expected, helpers) {
  const { cases, parseFeedback, parseValidationDetail, safeCodes, validationStages, diagnostics } = helpers;
  if (typeof parseFeedback !== 'function' || typeof parseValidationDetail !== 'function' || !Array.isArray(safeCodes) || !Array.isArray(validationStages) || !Array.isArray(diagnostics)
      || cases.length !== 60 || new Set(cases.map(c => c.id)).size !== 60 || hash(expected.schedule) !== hash(cases.flatMap(c => ['google', 'groq'].map(provider => ({ caseId: c.id, provider }))))
      || Object.keys(expected.profiles).length !== 60 || previous.length !== previousCalls || hash(previous) !== expected.previousHash || ledger.previousHash !== expected.previousHash
      || ledger.comparison !== comparison || ledger.maximumCalls !== maximumCalls || ledger.freeTierConfirmation !== 'human-user' || ledger.attempts.length > maximumCalls) throw Error('Invalid evidence cohort.');
  const keys = ['fixtureHash', 'fixtureContentHash', 'previousHash', 'planHash', 'referenceHashes', 'sourceCommit', 'profiles', 'models', 'schedule'];
  if (Object.keys(ledger).some(k => ![...keys, 'comparison', 'maximumCalls', 'freeTierConfirmation', 'providerStops', 'endpointStop', 'attempts', 'completed'].includes(k))) throw Error('Unexpected cohort metadata.');
  for (const k of keys) if (hash(ledger[k]) !== hash(expected[k])) throw Error('Evidence profiles changed.');
  if (!/^[a-f0-9]{40}$/.test(expected.sourceCommit) || !['fixtureHash', 'fixtureContentHash', 'previousHash', 'planHash'].every(k => /^[a-f0-9]{64}$/.test(expected[k]))) throw Error('Invalid evidence source.');
  const stops = {}, allowedCodes = [...safeCodes, ...collectorCodes]; let globalStop, cursor = 0;
  const attemptKeys = ['number', 'round', 'comparison', 'scheduleIndex', 'caseId', 'provider', 'domain', 'fixtureHash', 'fixtureContentHash', 'expectedModel', 'promptHash', 'requestHash',
    'status', 'startedAt', 'finishedAt', 'httpStatus', 'feedback', 'quota', 'code', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail'];
  for (const [i, a] of ledger.attempts.entries()) {
    while (cursor < maximumCalls && stops[expected.schedule[cursor].provider]) cursor++;
    const row = expected.schedule[cursor], profile = row && expected.profiles[row.caseId], sample = cases.find(c => c.id === row?.caseId);
    if (globalStop || !profile || !sample || Object.keys(a).some(k => !attemptKeys.includes(k)) || a.scheduleIndex !== cursor || a.number !== previousCalls + i + 1 || a.round !== round || a.comparison !== comparison
        || a.caseId !== row.caseId || a.provider !== row.provider || a.domain !== profile.domain || a.expectedModel !== expected.models[a.provider]
        || a.promptHash !== profile.promptHash || a.requestHash !== profile.requestHash || a.fixtureHash !== expected.fixtureHash || a.fixtureContentHash !== expected.fixtureContentHash
        || !['started', 'response', 'failure'].includes(a.status) || !timestamp(a.startedAt)) throw Error('Invalid evidence attempt.');
    if (a.status !== 'started' && !timestamp(a.finishedAt)) throw Error('Invalid attempt completion.');
    if (a.httpStatus !== undefined && (!Number.isInteger(a.httpStatus) || a.httpStatus < 100 || a.httpStatus > 599)) throw Error('Invalid HTTP metadata.');
    if (a.providerStatus !== undefined && (!Number.isInteger(a.providerStatus) || a.providerStatus < 100 || a.providerStatus > 599)) throw Error('Invalid provider metadata.');
    if (a.validationStage !== undefined && !validationStages.includes(a.validationStage) || a.diagnostic !== undefined && !diagnostics.includes(a.diagnostic)) throw Error('Invalid validation metadata.');
    if (a.validationDetail !== undefined && (a.status !== 'failure' || !['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
        || !parseValidationDetail(a.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }))) throw Error('Invalid safe validation detail.');
    if (a.status === 'response') {
      const feedback = parseFeedback(a.feedback);
      if (!feedback || feedback.original !== sample.sentence || feedback.model !== a.expectedModel || hash(feedback) !== hash(a.feedback)
          || !Number.isInteger(a.httpStatus) || a.httpStatus < 200 || a.httpStatus > 299 || ['code', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail'].some(k => a[k] !== undefined)) throw Error('Invalid recovered feedback.');
      if (a.quota !== undefined && (Object.keys(a.quota).some(k => !['remainingTokens', 'resetTokensSeconds'].includes(k)) || !Number.isInteger(a.quota.remainingTokens) || a.quota.remainingTokens < 0 || a.quota.remainingTokens >= 1e9
          || a.quota.resetTokensSeconds !== undefined && (!Number.isInteger(a.quota.resetTokensSeconds) || a.quota.resetTokensSeconds < 1 || a.quota.resetTokensSeconds > 86400))) throw Error('Invalid safe quota.');
    } else if (a.feedback !== undefined || a.quota !== undefined || (a.status === 'failure' ? !allowedCodes.includes(a.code) : ['code', 'finishedAt', 'httpStatus', 'providerStatus', 'validationStage', 'diagnostic', 'validationDetail'].some(k => a[k] !== undefined))) throw Error('Invalid attempt status.');
    if (a.status === 'failure' && providerStops.has(a.code)) stops[a.provider] = a.code;
    if (a.status === 'failure' && endpointStops.has(a.code)) globalStop = a.code;
    cursor++;
  }
  if (hash(stops) !== hash(ledger.providerStops) || globalStop !== ledger.endpointStop || ledger.completed !== undefined && typeof ledger.completed !== 'boolean') throw Error('Invalid stop metadata.');
  if (ledger.completed && !closed(ledger, expected)) throw Error('Premature collection completion.');
}
const closed = (ledger, expected) => !!ledger.endpointStop || expected.schedule.every((s, i) => ledger.providerStops[s.provider] || ledger.attempts.some(a => a.scheduleIndex === i));
export function evidenceReviewBundle(attempts, existing) {
  if (!existing) return reviewBundle(attempts, round);
  const records = attempts.filter(a => a.round === round), byNumber = new Map(records.map(a => [a.number, a]));
  if (existing.round !== round || existing.ledgerHash !== hash(records) || existing.blindHash !== hash(existing.blinded)
      || !Array.isArray(existing.blinded) || !Array.isArray(existing.mapping) || existing.blinded.length !== records.length || existing.mapping.length !== records.length
      || new Set(existing.mapping.map(m => m.number)).size !== records.length || Object.keys(existing).some(k => !['round', 'ledgerHash', 'blindHash', 'blinded', 'mapping'].includes(k))) throw Error('Invalid recovered blind bundle.');
  existing.mapping.forEach((m, i) => {
    const record = byNumber.get(m.number), label = `B${String(i + 1).padStart(3, '0')}`;
    if (!record || m.label !== label || Object.keys(m).some(k => !['label', 'number'].includes(k))) throw Error('Invalid recovered mapping.');
    const expected = blindAttempt(record); expected.label = label; delete expected.number;
    if (hash(existing.blinded[i]) !== hash(expected)) throw Error('Invalid recovered blind row.');
  });
  return existing;
}
export async function collectEvidenceComparison(context, options) {
  const { previous, ledger, expected, config, helpers } = context, { save, fetcher = fetch, signal, progress = () => {}, pause = ms => new Promise(r => setTimeout(r, ms)) } = options;
  validateEvidenceComparison(previous, ledger, expected, helpers);
  if (ledger.completed) return;
  for (const [scheduleIndex, row] of expected.schedule.entries()) {
    signal?.throwIfAborted();
    if (ledger.endpointStop || ledger.providerStops[row.provider] || ledger.attempts.some(a => a.scheduleIndex === scheduleIndex)) continue;
    if (ledger.attempts.length >= maximumCalls) throw Error('Evidence budget exhausted.');
    const sample = helpers.cases.find(c => c.id === row.caseId), profile = expected.profiles[row.caseId];
    const a = { number: previousCalls + ledger.attempts.length + 1, round, comparison, scheduleIndex, ...row, domain: profile.domain,
      fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, expectedModel: expected.models[row.provider],
      promptHash: profile.promptHash, requestHash: profile.requestHash, status: 'started', startedAt: new Date().toISOString() };
    ledger.attempts.push(a); save(ledger); let delay = 3000;
    try {
      const response = await fetcher(config.origin + endpoint, init(config, { ...row, comparison }, signal ? AbortSignal.any([AbortSignal.timeout(30000), signal]) : AbortSignal.timeout(30000)));
      a.httpStatus = response.status; let result, feedback;
      try { result = await response.json(); feedback = response.ok ? helpers.parseFeedback(result?.feedback) : undefined; } catch { result = {}; }
      if (response.ok && result?.comparison === comparison && result.caseId === row.caseId && result.provider === row.provider && result.promptHash === profile.promptHash
          && result.requestHash === profile.requestHash && feedback?.original === sample.sentence && feedback.model === a.expectedModel) {
        a.status = 'response'; a.feedback = feedback;
        const q = result.quota;
        if (Number.isInteger(q?.remainingTokens) && q.remainingTokens >= 0 && q.remainingTokens < 1e9) {
          a.quota = { remainingTokens: q.remainingTokens }; if (q.remainingTokens < 6000) delay = 60000;
          if (Number.isInteger(q.resetTokensSeconds) && q.resetTokensSeconds > 0 && q.resetTokensSeconds <= 86400) { a.quota.resetTokensSeconds = q.resetTokensSeconds; if (q.remainingTokens < 6000) delay = Math.min(60000, q.resetTokensSeconds * 1000); }
        }
      } else {
        a.status = 'failure'; a.code = response.status === 429 ? row.provider === 'groq' ? 'groq_limit' : 'provider_limit'
          : response.status === 402 || result?.providerStatus === 402 ? row.provider === 'groq' ? 'groq_billing' : 'provider_precondition'
            : [...helpers.safeCodes, ...collectorCodes].includes(result?.code) ? result.code : 'evaluation_invalid_response';
        if (Number.isInteger(result?.providerStatus) && result.providerStatus >= 100 && result.providerStatus <= 599) a.providerStatus = result.providerStatus;
        if (helpers.validationStages.includes(result?.validationStage)) a.validationStage = result.validationStage;
        if (helpers.diagnostics.includes(result?.diagnostic)) a.diagnostic = result.diagnostic;
        const detail = ['provider_invalid_response', 'groq_invalid_response'].includes(a.code) ? helpers.parseValidationDetail(result?.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }) : undefined;
        if (detail) a.validationDetail = detail;
        if (providerStops.has(a.code)) ledger.providerStops[row.provider] = a.code;
        if (endpointStops.has(a.code)) ledger.endpointStop = a.code;
      }
    } catch { a.status = 'failure'; a.code = 'evaluation_transport'; }
    a.finishedAt = new Date().toISOString(); save(ledger);
    progress({ attempts: ledger.attempts.length, responses: ledger.attempts.filter(a => a.status === 'response').length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop });
    while (delay > 0) { signal?.throwIfAborted(); const slice = Math.min(delay, 30000); await pause(slice); delay -= slice; }
  }
  ledger.completed = closed(ledger, expected); save(ledger);
}
async function main() {
  assertEvidenceLiveArguments(process.argv.slice(2), process.env.CI);
  if (process.stdin.isTTY) { process.stdin.setRawMode(true); console.log('Ready for approved evidence evaluation JSON on stdin (input is hidden).'); }
  const rl = createInterface({ input: process.stdin, terminal: false }); let config;
  try { config = JSON.parse(await new Promise((ok, no) => { rl.once('line', ok); rl.once('close', () => no(Error('Missing configuration.'))); })); }
  finally { rl.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  if (new URL(config.origin).origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site' || !/^[a-f0-9]{64}$/.test(config.evaluationToken) || !/^[a-f0-9]{40}$/.test(config.sourceCommit)) throw Error('Invalid evidence configuration.');
  config.origin = new URL(config.origin).origin;
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, comparison), authorizationPath = resolve(directory, 'authorization.json');
  // This file is created only after a new human approval, never by preparation.
  const authorization = JSON.parse(readFileSync(authorizationPath, 'utf8'));
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx'), stop = new AbortController(), interrupt = () => stop.abort(Error('Interrupted'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, comparison, startedAt: new Date().toISOString() }));
    mkdirSync(directory, { recursive: true }); const runDirectory = mkdtempSync(resolve(directory, 'run-')), modulePath = resolve(runDirectory, 'requests.mjs');
    await build({ entryPoints: [fileURLToPath(new URL('../lib/evidence-feedback-evaluation.ts', import.meta.url))], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
    const helper = await import(pathToFileURL(modulePath).href), plan = helper.evidencePlan;
    validateEvidenceAuthorization(authorization, config.sourceCommit, hash(plan));
    const parents = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json', 'root-cause-v1/ledger.json'].map(p => JSON.parse(readFileSync(resolve(root, p), 'utf8')).attempts);
    validateEvidenceParents(parents, plan); const previous = parents.flat();
    const references = plan.references.map(r => ({ ...r, text: readFileSync(r.path, 'utf8') }));
    if (references.some(r => contentHash(r.text) !== r.hash)) throw Error('Frozen reports changed.');
    const fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8'); if (contentHash(fixtureText) !== plan.fixtureContentHash) throw Error('Frozen fixture changed.');
    const schedule = helper.evidenceSchedule(), profiles = {};
    for (const sample of helper.accuracyCases) profiles[sample.id] = { domain: sample.domain, ...await helper.evidenceAccuracyHashes(sample) };
    const expected = { ...originalComparisonFixture(fixtureText, JSON.parse(references[0].text).fixtureHash), previousHash: hash(previous), planHash: hash(plan), referenceHashes: plan.references,
      sourceCommit: config.sourceCommit, profiles, models: helper.accuracyModels, schedule };
    const helpers = { cases: helper.accuracyCases, safeCodes: Object.keys(helper.FEEDBACK_ISSUES), validationStages: helper.FEEDBACK_VALIDATION_STAGES, diagnostics: helper.FEEDBACK_DIAGNOSTICS,
      parseFeedback: helper.parseEvidenceAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail };
    const ledgerPath = resolve(directory, 'ledger.json'); let ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : undefined;
    if (!ledger && authorization.runInitialized) throw Error('Consumed ledger is missing; refusing a reset.');
    ledger ??= { comparison, maximumCalls, freeTierConfirmation: 'human-user', ...expected, providerStops: {}, attempts: [] };
    validateEvidenceComparison(previous, ledger, expected, helpers);
    const reviewPath = resolve(directory, 'review-bundle.json'), existing = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : undefined;
    if (existing) { evidenceReviewBundle(ledger.attempts, existing); if (!closed(ledger, expected)) throw Error('Blind bundle precedes closure.'); }
    if (!ledger.completed && !closed(ledger, expected)) {
      verifyOriginalComparisonSource(config.sourceCommit);
      // Preserve a zero-slot ledger before consuming this authorization marker.
      atomicJson(ledgerPath, ledger); authorization.runInitialized = true; atomicJson(authorizationPath, authorization);
      const response = await fetch(config.origin + endpoint, init(config, { caseId: 'preflight-invalid-case', provider: 'google', comparison }, AbortSignal.timeout(15000)));
      if (response.status !== 400 || (await response.json()).code !== 'evaluation_invalid_case') throw Error('Evidence endpoint not ready.');
    }
    await collectEvidenceComparison({ previous, ledger, expected, config, helpers }, { save: v => atomicJson(ledgerPath, v), signal: stop.signal, progress: v => console.log(JSON.stringify(v)) });
    validateEvidenceComparison(previous, ledger, expected, helpers);
    const review = evidenceReviewBundle(ledger.attempts, existing); atomicJson(reviewPath, review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ complete: true, comparison, attempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop }));
  } finally { closeSync(lock); unlinkSync(lockPath); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Evidence evaluation stopped; consumed slots and frozen history preserved.'); process.exitCode = 1; });
