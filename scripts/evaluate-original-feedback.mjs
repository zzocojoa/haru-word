// A separate, explicitly approved 120-call comparison. The original 240-call
// collector and ledger are never extended, reset or overwritten. No CI calls.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { reviewBundle } from './evaluate-english-accuracy.mjs';

const comparison = 'original-first', additionalCalls = 120, previousCalls = 240;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function originalComparisonFixture(text, recordedHash) {
  // Preserve the recorded baseline byte hash, but tolerate Git's CRLF/LF
  // materialization of the identical authored JSON. Do not rewrite the fixture.
  const normalized = text.replace(/\r\n/g, '\n');
  const bytesHash = value => createHash('sha256').update(value).digest('hex');
  const fixtureContentHash = bytesHash(normalized);
  if (!/^[a-f0-9]{64}$/.test(recordedHash) || ![fixtureContentHash, bytesHash(normalized.replace(/\n/g, '\r\n'))].includes(recordedHash)) throw Error('Fixture content changed from the preserved baseline.');
  return { fixtureHash: recordedHash, fixtureContentHash };
}
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
      || ledger.previousHash !== hash(previous) || ledger.fixtureHash !== expected.fixtureHash || ledger.fixtureContentHash !== expected.fixtureContentHash || ledger.sourceCommit !== expected.sourceCommit
      || !/^[a-f0-9]{64}$/.test(expected.fixtureHash) || !/^[a-f0-9]{64}$/.test(expected.fixtureContentHash)
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
        || r.fixtureHash !== expected.fixtureHash || r.fixtureContentHash !== expected.fixtureContentHash || r.domain !== profile.domain || r.expectedModel !== expected.models[r.provider]
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
      fixtureHash: expected.fixtureHash, fixtureContentHash: expected.fixtureContentHash, promptHash: profile.promptHash, requestHash: profile.requestHash, expectedModel: expected.models[provider],
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
  if (process.argv.includes('--live') || !process.argv.includes('--offline')) throw Error('Legacy live evaluation is retired; use --offline for complete frozen ledgers.');
  const rl = createInterface({ input: process.stdin, terminal: false }); let config;
  try { config = JSON.parse(await new Promise((accept, reject) => { rl.once('line', accept); rl.once('close', () => reject(Error('Missing frozen source configuration.'))); })); }
  finally { rl.close(); }
  if (!/^[a-f0-9]{40}$/.test(config.sourceCommit)) throw Error('Invalid frozen source commit.');
  const root = resolve('.sites-runtime/english-accuracy'), directory = resolve(root, comparison);
  const previous = JSON.parse(readFileSync(resolve(root, 'ledger.json'), 'utf8')).attempts;
  const ledger = JSON.parse(readFileSync(resolve(directory, 'ledger.json'), 'utf8'));
  if (ledger?.attempts.length !== additionalCalls) throw Error('Incomplete ledger cannot generate requests offline.');
  validateOriginalComparison(previous, ledger, { fixtureHash: ledger.fixtureHash, fixtureContentHash: ledger.fixtureContentHash, sourceCommit: config.sourceCommit, profiles: ledger.profiles, models: ledger.models });
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx');
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, mode: 'offline', comparison, startedAt: new Date().toISOString() }));
    const reviewPath = resolve(directory, 'review-bundle.json'), existing = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : undefined;
    const review = reviewBundle(ledger.attempts, 3, existing);
    atomicJson(reviewPath, review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ complete: true, offline: true, comparison, additionalAttempts: ledger.attempts.length, totalAttempts: previousCalls + ledger.attempts.length }));
  } finally { closeSync(lock); unlinkSync(lockPath); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Original comparison stopped. Preserve both ledgers; never retry consumed slots.'); process.exitCode = 1; });
