// A separate, explicitly approved 120-call comparison. The original 240-call
// collector and ledger are never extended, reset or overwritten. No CI calls.
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { reviewBundle } from './evaluate-english-accuracy.mjs';

const comparison = 'original-first', additionalCalls = 120, previousCalls = 240;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function atomicJson(path, value) { writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path); }
export function originalComparisonBudget(attempts) {
  if (attempts.length >= additionalCalls) throw Error('Additional comparison budget exhausted.');
}
export function verifyOriginalComparisonSource(sourceCommit, cwd = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw Error('Invalid comparison source.');
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  // Native Sites verification establishes the deployed commit separately.
  // A merge commit with exactly the same tree is valid; local drift is not.
  if (git(['status', '--porcelain']) || git(['rev-parse', `${sourceCommit}^{tree}`]) !== git(['rev-parse', 'HEAD^{tree}'])) throw Error('Local comparison source differs from the verified deployed source.');
}
export function validateOriginalComparison(previous, ledger, expected) {
  if (previous.length !== previousCalls || ledger.comparison !== comparison || ledger.approvedCalls !== additionalCalls
      || ledger.previousHash !== hash(previous) || ledger.fixtureHash !== expected.fixtureHash || ledger.sourceCommit !== expected.sourceCommit
      || !/^[a-f0-9]{40}$/.test(expected.sourceCommit) || ledger.attempts.length > additionalCalls) throw Error('Comparison context changed or invalid.');
  const seen = new Set();
  for (const [i, r] of previous.entries()) {
    const profile = expected.profiles[r.caseId], key = `${r.round}:${r.caseId}:${r.provider}`;
    if (!profile || ![1, 2].includes(r.round) || !['google', 'groq'].includes(r.provider) || r.number !== i + 1 || seen.has(key)
        || r.fixtureHash !== expected.fixtureHash || r.domain !== profile.domain || r.expectedModel !== expected.models[r.provider]) throw Error('Invalid preserved baseline ledger.');
    seen.add(key);
  }
  if (previous.filter(r => r.round === 1).length !== 120 || previous.filter(r => r.round === 2).length !== 120
      || Object.keys(expected.profiles).length !== 60 || hash(ledger.profiles) !== hash(expected.profiles) || hash(ledger.models) !== hash(expected.models)) throw Error('Comparison profiles changed.');
  seen.clear();
  for (const [i, r] of ledger.attempts.entries()) {
    const profile = expected.profiles[r.caseId], key = `${r.caseId}:${r.provider}`;
    if (!profile || !['google', 'groq'].includes(r.provider) || r.number !== previousCalls + i + 1 || r.round !== 3 || r.comparison !== comparison || seen.has(key)
        || r.fixtureHash !== expected.fixtureHash || r.domain !== profile.domain || r.expectedModel !== expected.models[r.provider]
        || r.promptHash !== profile.promptHash || r.requestHash !== profile.requestHash || !['started', 'response', 'failure'].includes(r.status)) throw Error('Comparison attempt changed.');
    seen.add(key);
  }
}
const endpoint = '/api/english-accuracy-evaluation';
const requestInit = (config, body, signal) => ({ method: 'POST', redirect: 'error', signal,
  headers: { 'Content-Type': 'application/json', Origin: config.origin, 'X-English-Accuracy-Token': config.evaluationToken,
    ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : `Bearer ${config.siteToken}` } : {}) }, body: JSON.stringify(body) });
export async function originalComparisonPreflight(config, fetcher = fetch, signal) {
  const response = await fetcher(config.origin + endpoint, requestInit(config, { caseId: 'preflight-invalid-case', provider: 'google', comparison }, signal));
  const body = await response.json();
  if (response.status !== 400 || body.code !== 'evaluation_invalid_case') throw Error('Original comparison endpoint is not ready.');
}
export async function collectOriginalComparison(context, options) {
  const { previous, ledger, cases, config, expected, safeCodes, validationStages, parseFeedback } = context;
  const { save, fetcher = fetch, signal, progress = () => {}, pause = () => new Promise(resolve => setTimeout(resolve, 3000)) } = options;
  validateOriginalComparison(previous, ledger, expected);
  for (const sample of cases) for (const provider of ['google', 'groq']) {
    signal?.throwIfAborted();
    // Started/crashed attempts consume their slot, just like failures.
    if (ledger.attempts.some(r => r.caseId === sample.id && r.provider === provider)) continue;
    originalComparisonBudget(ledger.attempts);
    const profile = expected.profiles[sample.id];
    const attempt = { number: previousCalls + ledger.attempts.length + 1, round: 3, comparison, caseId: sample.id, domain: sample.domain, provider,
      fixtureHash: expected.fixtureHash, promptHash: profile.promptHash, requestHash: profile.requestHash, expectedModel: expected.models[provider],
      startedAt: new Date().toISOString(), status: 'started' };
    ledger.attempts.push(attempt); save(ledger); // Persist before any HTTP.
    try {
      const deadline = AbortSignal.timeout(45_000), requestSignal = signal ? AbortSignal.any([deadline, signal]) : deadline;
      const response = await fetcher(config.origin + endpoint, requestInit(config, { caseId: sample.id, provider, comparison }, requestSignal));
      attempt.httpStatus = response.status;
      const result = await response.json().catch(() => undefined);
      const feedback = response.ok ? parseFeedback(result?.feedback) : undefined;
      if (response.ok && result?.comparison === comparison && result.caseId === sample.id && result.provider === provider
          && result.promptHash === profile.promptHash && result.requestHash === profile.requestHash
          && feedback?.original === sample.sentence && feedback.model === attempt.expectedModel) {
        attempt.status = 'response'; attempt.feedback = feedback;
        if (Number.isFinite(result.durationMs) && result.durationMs >= 0) attempt.durationMs = result.durationMs;
      } else {
        attempt.status = 'failure'; attempt.code = safeCodes.includes(result?.code) ? result.code : 'evaluation_invalid_response';
        if (Number.isInteger(result?.providerStatus) && result.providerStatus >= 100 && result.providerStatus <= 599) attempt.providerStatus = result.providerStatus;
        if (validationStages.includes(result?.validationStage)) attempt.validationStage = result.validationStage;
      }
    } catch { attempt.status = 'failure'; attempt.code = 'evaluation_transport'; }
    attempt.finishedAt = new Date().toISOString(); save(ledger);
    if (ledger.attempts.length % 10 === 0) progress({ attempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length, responses: ledger.attempts.filter(r => r.status === 'response').length });
    await pause();
  }
}
async function main() {
  const approved = process.argv[process.argv.indexOf('--approved-additional-calls') + 1];
  if (!process.argv.includes('--live') || !process.argv.includes('--approved-additional-calls') || approved !== '120' || process.env.CI) throw Error('Explicit approved additional 120 calls required outside CI.');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  if (process.stdin.isTTY) console.log('Ready for original comparison JSON on stdin (input is hidden).');
  const rl = createInterface({ input: process.stdin, terminal: false });
  let config;
  try { config = JSON.parse(await new Promise((accept, reject) => { rl.once('line', accept); rl.once('close', () => reject(Error('Missing stdin configuration.'))); })); }
  finally { rl.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  const origin = new URL(config.origin);
  if (origin.origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site' || !/^[a-f0-9]{64}$/.test(config.evaluationToken) || !/^[a-f0-9]{40}$/.test(config.sourceCommit)) throw Error('Invalid comparison configuration.');
  config.origin = origin.origin;
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, comparison);
  mkdirSync(directory, { recursive: true });
  // Share the original collector lock; never overlap collectors.
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx');
  const stop = new AbortController(), interrupt = () => stop.abort(Error('Evaluation interrupted.'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, comparison, startedAt: new Date().toISOString() }));
    const previous = JSON.parse(readFileSync(resolve(root, 'ledger.json'), 'utf8')).attempts;
    const ledgerPath = resolve(directory, 'ledger.json');
    let ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : undefined;
    if (ledger?.attempts.length === additionalCalls) {
      validateOriginalComparison(previous, ledger, { fixtureHash: ledger.fixtureHash, sourceCommit: config.sourceCommit, profiles: ledger.profiles, models: ledger.models });
    } else {
      verifyOriginalComparisonSource(config.sourceCommit);
      const bundlePath = resolve(directory, 'requests.mjs');
      await build({ entryPoints: ['lib/original-feedback-evaluation.ts'], outfile: bundlePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
      const helper = await import(pathToFileURL(bundlePath).href);
      const fixtureHash = createHash('sha256').update(readFileSync('tests/fixtures/english-accuracy.json')).digest('hex'), profiles = {};
      for (const sample of helper.accuracyCases) profiles[sample.id] = { domain: sample.domain, ...await helper.originalAccuracyHashes(sample) };
      const expected = { fixtureHash, sourceCommit: config.sourceCommit, profiles, models: helper.accuracyModels };
      ledger ??= { comparison, approvedCalls: additionalCalls, previousHash: hash(previous), ...expected, attempts: [] };
      validateOriginalComparison(previous, ledger, expected);
      await originalComparisonPreflight(config, fetch, AbortSignal.any([AbortSignal.timeout(15_000), stop.signal]));
      const safeCodes = [...Object.keys(helper.FEEDBACK_ISSUES), 'evaluation_disabled', 'evaluation_unauthorized', 'evaluation_invalid_request', 'evaluation_invalid_case', 'evaluation_key_missing', 'evaluation_internal'];
      await collectOriginalComparison({ previous, ledger, cases: helper.accuracyCases, config, expected, safeCodes, validationStages: helper.FEEDBACK_VALIDATION_STAGES, parseFeedback: helper.parseOriginalAccuracyFeedback },
        { save: value => atomicJson(ledgerPath, value), signal: stop.signal, progress: value => console.log(JSON.stringify(value)) });
    }
    const reviewPath = resolve(directory, 'review-bundle.json'), existing = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : undefined;
    const review = reviewBundle(ledger.attempts, 3, existing);
    atomicJson(reviewPath, review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ complete: true, comparison, additionalAttempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length }));
  } finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); closeSync(lock); unlinkSync(lockPath); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Original comparison stopped. Preserve both ledgers; never retry consumed slots.'); process.exitCode = 1; });
