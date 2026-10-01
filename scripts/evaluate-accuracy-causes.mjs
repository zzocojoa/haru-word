// New paired cohort only. Preparation/CLI flags do not replace human approval.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { originalComparisonFixture, verifyOriginalComparisonSource } from './evaluate-original-feedback.mjs';
import { blindAttempt, reviewBundle } from './evaluate-english-accuracy.mjs';
const comparison = 'root-cause-v1', previousCalls = 480, maximumCalls = 60, round = 5;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const atomicJson = (path, value) => { writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path); };
const providerStops = new Set(['provider_limit', 'provider_minute_limit', 'provider_daily_limit', 'groq_limit', 'groq_billing', 'provider_precondition', 'provider_key_invalid', 'provider_key_blocked', 'provider_permission', 'groq_key_invalid', 'groq_permission', 'evaluation_key_missing']);
const endpointStops = new Set(['evaluation_disabled', 'evaluation_unauthorized', 'evaluation_invalid_request', 'evaluation_invalid_case']);
export function assertCauseLiveArguments(args, ci) {
  const approved = args.indexOf('--approved-calls');
  if (args.length !== 4 || !args.includes('--live') || !args.includes('--confirmed-free-tier')
      || approved < 0 || args[approved + 1] !== '60' || ci) throw Error('Approved 60-call free pilot required outside CI.');
}
export function validateCauseParents(arrays, plan) {
  if (arrays.length !== 3 || arrays.some((a, i) => a.length !== [240, 120, 120][i] || hash(a) !== plan.parentLedgerHashes[i])
      || hash(arrays.flat()) !== plan.combinedParentHash || plan.previousCalls !== previousCalls || plan.maximumCalls !== maximumCalls) throw Error('Frozen parent history changed.');
}
export function validateCauseComparison(previous, ledger, expected, parseDetail, parseFeedback, cases) {
  if (previous.length !== previousCalls || hash(previous) !== expected.previousHash || ledger.previousHash !== expected.previousHash
      || ledger.comparison !== comparison || ledger.maximumCalls !== maximumCalls || ledger.freeTierConfirmation !== 'human-user'
      || ledger.attempts.length > maximumCalls || expected.schedule.length !== maximumCalls) throw Error('Invalid paired cohort.');
  for (const key of ['fixtureHash', 'fixtureContentHash', 'planHash', 'sourceCommit', 'profiles', 'models', 'schedule']) if (hash(ledger[key]) !== hash(expected[key])) throw Error('Paired profiles changed.');
  if (!/^[a-f0-9]{40}$/.test(expected.sourceCommit) || !['fixtureHash', 'fixtureContentHash', 'planHash', 'previousHash'].every(k => /^[a-f0-9]{64}$/.test(expected[k]))) throw Error('Invalid paired source.');
  const stops = {}; let globalStop, cursor = 0;
  for (const [i, a] of ledger.attempts.entries()) {
    while (cursor < maximumCalls && stops[expected.schedule[cursor].provider]) cursor++;
    const row = expected.schedule[cursor], profile = row && expected.profiles[`${row.caseId}:${row.variant}`];
    if (globalStop || !profile || a.scheduleIndex !== cursor || a.number !== previousCalls + i + 1 || a.round !== round || a.comparison !== comparison
        || ['caseId', 'family', 'variant', 'provider'].some(k => a[k] !== row[k]) || a.domain !== profile.domain || a.expectedModel !== expected.models[a.provider]
        || a.promptHash !== profile.promptHash || a.requestHash !== profile.requestHash || a.fixtureHash !== expected.fixtureHash || a.fixtureContentHash !== expected.fixtureContentHash
        || !['started', 'response', 'failure'].includes(a.status)) throw Error('Invalid paired attempt.');
    if (a.validationDetail !== undefined && (a.status !== 'failure' || !['provider_invalid_response', 'groq_invalid_response'].includes(a.code)
        || !parseDetail?.(a.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }))) throw Error('Invalid paired detail.');
    if (a.status === 'response') {
      const feedback = parseFeedback?.(a.feedback), sample = cases?.find(c => c.id === a.caseId);
      if (!feedback || !sample || feedback.original !== sample.sentence || feedback.model !== a.expectedModel
          || hash(feedback) !== hash(a.feedback)) throw Error('Invalid recovered feedback.');
    } else if (a.feedback !== undefined) throw Error('Unexpected recovered feedback.');
    if (a.status === 'failure' && providerStops.has(a.code)) stops[a.provider] = a.code;
    if (a.status === 'failure' && endpointStops.has(a.code)) globalStop = a.code;
    cursor++;
  }
  if (hash(stops) !== hash(ledger.providerStops) || globalStop !== ledger.endpointStop || (ledger.completed !== undefined && typeof ledger.completed !== 'boolean')) throw Error('Invalid paired stop/completion.');
  const covered = globalStop || expected.schedule.every((s, index) => stops[s.provider] || ledger.attempts.some(a => a.scheduleIndex === index));
  if (ledger.completed && !covered) throw Error('Premature paired completion.');
}
export function causeReviewBundle(attempts, existing) {
  if (!existing) return reviewBundle(attempts, round);
  const records = attempts.filter(a => a.round === round), byNumber = new Map(records.map(a => [a.number, a]));
  if (existing.round !== round || existing.ledgerHash !== hash(records) || existing.blindHash !== hash(existing.blinded)
      || !Array.isArray(existing.blinded) || !Array.isArray(existing.mapping) || existing.blinded.length !== records.length
      || existing.mapping.length !== records.length || new Set(existing.mapping.map(m => m.number)).size !== records.length
      || Object.keys(existing).some(k => !['round', 'ledgerHash', 'blindHash', 'blinded', 'mapping'].includes(k))) throw Error('Invalid recovered blind bundle.');
  existing.mapping.forEach((m, i) => {
    const record = byNumber.get(m.number), label = `B${String(i + 1).padStart(3, '0')}`;
    if (!record || m.label !== label || Object.keys(m).some(k => !['label', 'number'].includes(k))) throw Error('Invalid recovered blind mapping.');
    const expected = blindAttempt(record); expected.label = label; delete expected.number;
    if (hash(existing.blinded[i]) !== hash(expected)) throw Error('Invalid recovered blind row.');
  });
  return existing;
}
const endpoint = '/api/english-accuracy-evaluation';
const init = (config, body, signal) => ({ method: 'POST', redirect: 'error', signal, headers: { 'Content-Type': 'application/json', Origin: config.origin,
  'X-English-Accuracy-Token': config.evaluationToken, ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : `Bearer ${config.siteToken}` } : {}) }, body: JSON.stringify(body) });
export async function collectCauseComparison(context, options) {
  const { previous, ledger, expected, cases, config, safeCodes, validationStages, diagnostics, parseFeedback, parseValidationDetail } = context;
  const { save, fetcher = fetch, signal, progress = () => {}, pause = ms => new Promise(r => setTimeout(r, ms)) } = options;
  validateCauseComparison(previous, ledger, expected, parseValidationDetail, parseFeedback, cases);
  if (ledger.completed) return;
  for (const [scheduleIndex, row] of expected.schedule.entries()) {
    signal?.throwIfAborted();
    if (ledger.endpointStop || ledger.providerStops[row.provider] || ledger.attempts.some(a => a.scheduleIndex === scheduleIndex)) continue;
    if (ledger.attempts.length >= maximumCalls) throw Error('Paired budget exhausted.');
    const sample = cases.find(c => c.id === row.caseId), profile = expected.profiles[`${row.caseId}:${row.variant}`];
    const a = { number: previousCalls + ledger.attempts.length + 1, round, comparison, scheduleIndex, ...row, domain: profile.domain,
      fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, expectedModel: expected.models[row.provider],
      promptHash: profile.promptHash, requestHash: profile.requestHash, status: 'started', startedAt: new Date().toISOString() };
    ledger.attempts.push(a); save(ledger); let delay = 3000;
    try {
      const response = await fetcher(config.origin + endpoint, init(config, { caseId: row.caseId, provider: row.provider, variant: row.variant, comparison }, signal ? AbortSignal.any([AbortSignal.timeout(30000), signal]) : AbortSignal.timeout(30000)));
      a.httpStatus = response.status; let result, feedback;
      try { result = await response.json(); feedback = response.ok ? parseFeedback(result?.feedback) : undefined; } catch { result = {}; }
      if (response.ok && result?.comparison === comparison && result.variant === row.variant && result.caseId === row.caseId && result.provider === row.provider
          && result.promptHash === profile.promptHash && result.requestHash === profile.requestHash && feedback?.original === sample.sentence && feedback.model === a.expectedModel) {
        a.status = 'response'; a.feedback = feedback;
        const q = result.quota;
        if (Number.isInteger(q?.remainingTokens) && q.remainingTokens >= 0 && q.remainingTokens < 1e9) {
          a.quota = { remainingTokens: q.remainingTokens }; if (q.remainingTokens < 6000) delay = 60000;
          if (Number.isInteger(q.resetTokensSeconds) && q.resetTokensSeconds > 0 && q.resetTokensSeconds <= 86400) { a.quota.resetTokensSeconds = q.resetTokensSeconds; if (q.remainingTokens < 6000) delay = Math.min(60000, q.resetTokensSeconds * 1000); }
        }
      } else {
        a.status = 'failure'; a.code = response.status === 429 ? row.provider === 'groq' ? 'groq_limit' : 'provider_limit'
          : response.status === 402 || result?.providerStatus === 402 ? row.provider === 'groq' ? 'groq_billing' : 'provider_precondition'
            : safeCodes.includes(result?.code) ? result.code : 'evaluation_invalid_response';
        if (Number.isInteger(result?.providerStatus) && result.providerStatus >= 100 && result.providerStatus <= 599) a.providerStatus = result.providerStatus;
        if (validationStages.includes(result?.validationStage)) a.validationStage = result.validationStage;
        if (diagnostics.includes(result?.diagnostic)) a.diagnostic = result.diagnostic;
        const detail = ['provider_invalid_response', 'groq_invalid_response'].includes(a.code) ? parseValidationDetail?.(result?.validationDetail, { stage: a.validationStage, diagnostic: a.diagnostic }) : undefined;
        if (detail) a.validationDetail = detail;
        if (providerStops.has(a.code)) ledger.providerStops[row.provider] = a.code;
        if (endpointStops.has(a.code)) ledger.endpointStop = a.code;
      }
    } catch { a.status = 'failure'; a.code = 'evaluation_transport'; }
    a.finishedAt = new Date().toISOString(); save(ledger); progress({ attempts: ledger.attempts.length, responses: ledger.attempts.filter(a => a.status === 'response').length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop });
    while (delay > 0) { signal?.throwIfAborted(); const slice = Math.min(delay, 30000); await pause(slice); delay -= slice; }
  }
  ledger.completed = !!ledger.endpointStop || expected.schedule.every((s, index) => ledger.providerStops[s.provider] || ledger.attempts.some(a => a.scheduleIndex === index)); save(ledger);
}
async function main() {
  const args = process.argv.slice(2);
  assertCauseLiveArguments(args, process.env.CI);
  if (process.stdin.isTTY) { process.stdin.setRawMode(true); console.log('Ready for cause comparison JSON on stdin (input is hidden).'); }
  const rl = createInterface({ input: process.stdin, terminal: false }); let config;
  try { config = JSON.parse(await new Promise((ok, no) => { rl.once('line', ok); rl.once('close', () => no(Error('Missing configuration.'))); })); }
  finally { rl.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  if (new URL(config.origin).origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site' || !/^[a-f0-9]{64}$/.test(config.evaluationToken) || !/^[a-f0-9]{40}$/.test(config.sourceCommit)) throw Error('Invalid pilot configuration.');
  config.origin = new URL(config.origin).origin;
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, comparison); mkdirSync(directory, { recursive: true });
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx'), stop = new AbortController(), interrupt = () => stop.abort(Error('Interrupted'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, comparison, startedAt: new Date().toISOString() }));
    // Compile trusted current source into a fresh module, including recovery.
    // Never overwrite any historical cohort's request module or ledger.
    const runDirectory = mkdtempSync(resolve(directory, 'run-')), modulePath = resolve(runDirectory, 'requests.mjs');
    await build({ entryPoints: [fileURLToPath(new URL('../lib/accuracy-cause-evaluation.ts', import.meta.url))], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
    const helper = await import(pathToFileURL(modulePath).href), plan = helper.rootCausePlan;
    const parents = ['ledger.json', 'original-first/ledger.json', 'chunked-free-v1/ledger.json'].map(p => JSON.parse(readFileSync(resolve(root, p), 'utf8')).attempts);
    validateCauseParents(parents, plan); const previous = parents.flat();
    const reportText = readFileSync(plan.sourceArtifact, 'utf8'), report = JSON.parse(reportText), fixtureText = readFileSync('tests/fixtures/english-accuracy.json', 'utf8');
    if (contentHash(reportText) !== plan.sourceArtifactContentHash || contentHash(fixtureText) !== plan.fixtureContentHash) throw Error('Frozen cause references changed.');
    const schedule = helper.causeSchedule(), profiles = {};
    for (const row of schedule) { const key = `${row.caseId}:${row.variant}`, sample = helper.accuracyCases.find(c => c.id === row.caseId); profiles[key] ??= { domain: sample.domain, ...await helper.causeAccuracyHashes(sample, row.variant) }; }
    const expected = { ...originalComparisonFixture(fixtureText, report.fixtureHash), previousHash: hash(previous), planHash: hash(plan), sourceCommit: config.sourceCommit, profiles, models: helper.accuracyModels, schedule };
    const ledgerPath = resolve(directory, 'ledger.json'); let ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : undefined;
    ledger ??= { comparison, maximumCalls, freeTierConfirmation: 'human-user', ...expected, providerStops: {}, attempts: [] };
    validateCauseComparison(previous, ledger, expected, helper.parseFeedbackValidationDetail, helper.parseOriginalAccuracyFeedback, helper.accuracyCases);
    const path = resolve(directory, 'review-bundle.json'), existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
    if (existing) {
      causeReviewBundle(ledger.attempts, existing);
      if (!ledger.endpointStop && expected.schedule.some((s, index) => !ledger.providerStops[s.provider] && !ledger.attempts.some(a => a.scheduleIndex === index))) throw Error('Blind bundle precedes collection closure.');
    }
    if (!ledger.completed) {
      verifyOriginalComparisonSource(config.sourceCommit);
      const preflight = await fetch(config.origin + endpoint, init(config, { caseId: 'preflight-invalid-case', provider: 'google', comparison, variant: 'control' }, AbortSignal.timeout(15000)));
      if (preflight.status !== 400 || (await preflight.json()).code !== 'evaluation_invalid_case') throw Error('Cause endpoint not ready.');
      await collectCauseComparison({ previous, ledger, expected, cases: helper.accuracyCases, config,
        safeCodes: [...Object.keys(helper.FEEDBACK_ISSUES), ...endpointStops, 'evaluation_key_missing', 'evaluation_internal'], validationStages: helper.FEEDBACK_VALIDATION_STAGES,
        diagnostics: helper.FEEDBACK_DIAGNOSTICS, parseFeedback: helper.parseOriginalAccuracyFeedback, parseValidationDetail: helper.parseFeedbackValidationDetail },
      { save: v => atomicJson(ledgerPath, v), signal: stop.signal, progress: v => console.log(JSON.stringify(v)) });
    }
    const review = causeReviewBundle(ledger.attempts, existing); atomicJson(path, review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ complete: true, comparison, attempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length, providerStops: ledger.providerStops, endpointStop: ledger.endpointStop }));
  } finally { closeSync(lock); unlinkSync(lockPath); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Cause pilot stopped; consumed slots and frozen history preserved.'); process.exitCode = 1; });
