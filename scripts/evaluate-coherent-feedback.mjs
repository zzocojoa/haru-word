// One bounded, separately authorized cohort. Hidden stdin is the only token
// input. A consumed/started run cannot be resumed or silently reset.
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { reviewBundle } from './evaluate-english-accuracy.mjs';
export const comparison = 'coherent-feedback-v1';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentHash = path => createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const atomicJson = (path, value) => { writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path); };
const origin = 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site';
export function validateCoherentConfig(config, authorization, source, planHash) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
      || Object.keys(config).some(key => !['origin', 'token', 'sourceCommit', 'siteToken'].includes(key))
      || config.origin !== origin || !/^[a-f0-9]{64}$/.test(config.token ?? '') || !/^[a-f0-9]{40}$/.test(source ?? '') || config.sourceCommit !== source
      || (config.siteToken !== undefined && (typeof config.siteToken !== 'string' || !config.siteToken || config.siteToken.length > 8192 || /[\r\n]/.test(config.siteToken)))) throw Error('Invalid hidden configuration');
  if (authorization?.comparison !== comparison || authorization.approvedCalls !== 120 || authorization.previousCalls !== 826 || authorization.maximumTotalCalls !== 946
      || authorization.sourceCommit !== source || authorization.planHash !== planHash || authorization.freeTierConfirmation !== 'human-user-existing-accounts'
      || authorization.humanAuthorization !== 'additional-120-free-coherent-calls' || authorization.runInitialized !== false
      || !Number.isFinite(Date.parse(authorization.approvedAt)) || Date.parse(authorization.approvedAt) > Date.now()) throw Error('Invalid or consumed pilot authorization');
}
function requestInit(config, body, signal) {
  return { method: 'POST', redirect: 'error', signal, headers: { 'Content-Type': 'application/json', Origin: config.origin,
    'X-English-Accuracy-Token': config.token, ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : `Bearer ${config.siteToken}` } : {}) }, body: JSON.stringify(body) };
}
export async function collectCoherent({ ledger, schedule, profiles, helper, config }, { save, fetcher = fetch, wait = ms => new Promise(r => setTimeout(r, ms)), progress = () => {}, signal } = {}) {
  if (ledger.attempts.length || ledger.completed || schedule.length !== 120) throw Error('Pilot cannot resume or reset');
  const expectedSchedule = helper.coherentFeedbackSchedule();
  if (hash(schedule) !== hash(expectedSchedule)) throw Error('Pilot schedule changed');
  // Validate the whole cohort before its first durable slot or HTTP. A missing
  // late profile must not silently burn the earlier slots of a fresh approval.
  if (new Set(schedule.map(row => `${row.caseId}/${row.provider}`)).size !== 120
      || Object.keys(profiles).length !== 120 || typeof save !== 'function') throw Error('Invalid coherent profiles');
  for (const row of schedule) {
    const profile = profiles[`${row.caseId}/${row.provider}`];
    if (!profile || Object.keys(profile).sort().join(',') !== 'promptHash,requestHash'
        || !/^[a-f0-9]{64}$/.test(profile.requestHash) || !/^[a-f0-9]{64}$/.test(profile.promptHash)
        || !helper.coherentFeedbackCases.some(sample => sample.id === row.caseId)) throw Error('Invalid coherent profile');
  }
  const stopped = new Set();
  try {
  for (const row of schedule) {
    signal?.throwIfAborted();
    if (stopped.has(row.provider)) continue;
    const attempt = { ...row, number: ledger.attempts.length + 1, round: 12, status: 'started', startedAt: new Date().toISOString(), ...profiles[`${row.caseId}/${row.provider}`] };
    ledger.attempts.push(attempt); save(ledger); // Durable consumption precedes HTTP.
    try {
      const response = await fetcher(config.origin + '/api/english-accuracy-evaluation', requestInit(config, { ...row, comparison }, AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])])));
      const value = await response.json();
      if (value.caseId !== row.caseId || value.provider !== row.provider || value.comparison !== comparison
          || value.requestHash !== attempt.requestHash || !Number.isInteger(value.durationMs) || value.durationMs < 0 || value.durationMs > 60000) throw Error('Invalid evaluation envelope');
      attempt.httpStatus = response.status; attempt.durationMs = value.durationMs;
      const quota = helper.parseTokenEvidenceQuota(value.quota);
      if (quota) attempt.quota = quota;
      // Only declared numeric evidence is retained. No upstream text/headers.
      attempt.usage = {};
      for (const key of ['inputTokens', 'outputTokens', 'reasoningTokens', 'totalTokens']) if (Number.isInteger(value.usage?.[key]) && value.usage[key] >= 0 && value.usage[key] <= 1_000_000_000) attempt.usage[key] = value.usage[key];
      if (['STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER', 'stop', 'length', 'content_filter'].includes(value.finish)) attempt.finish = value.finish;
      if (response.ok) {
        const feedback = helper.sentenceFeedbackSchema.parse(value.feedback);
        if (feedback.model !== helper.accuracyModels[row.provider] || feedback.original !== helper.coherentFeedbackCases.find(c => c.id === row.caseId).sentence || value.promptHash !== attempt.promptHash) throw Error('Invalid feedback identity');
        attempt.status = 'response'; attempt.feedback = feedback;
      } else {
        if (!Object.hasOwn(helper.FEEDBACK_ISSUES, value.code)) throw Error('Invalid safe failure');
        attempt.status = 'failure'; attempt.code = value.code;
        if (Number.isInteger(value.providerStatus) && value.providerStatus >= 400 && value.providerStatus <= 599) attempt.providerStatus = value.providerStatus;
        if (helper.FEEDBACK_VALIDATION_STAGES.includes(value.validationStage)) attempt.validationStage = value.validationStage;
        if (helper.FEEDBACK_DIAGNOSTICS.includes(value.diagnostic)) attempt.diagnostic = value.diagnostic;
        const detail = helper.parseFeedbackValidationDetail(value.validationDetail, {stage:value.validationStage, diagnostic:value.diagnostic});
        if (detail) attempt.validationDetail = detail;
        if (['provider_network', 'groq_network'].includes(value.code)) ledger.endpointStop = 'upstream_network_uncertain';
        if ([400,401,403,404,429].includes(value.providerStatus) || response.status === 429 || /key|permission|billing|precondition|limit|model/.test(value.code)) stopped.add(row.provider);
      }
    } catch {
      attempt.status = 'failure'; attempt.code = 'collector_transport_or_protocol';
      // The HTTP might have been consumed. Never retry it; stop the whole run.
      ledger.endpointStop = 'collector_transport_or_protocol';
    }
    attempt.finishedAt = new Date().toISOString(); save(ledger);
    progress({ attempts: ledger.attempts.length, maximum: 120, status: attempt.status, providerStops: [...stopped] });
    if (ledger.endpointStop) break;
    // Conservative pacing avoids avoidable free TPM bursts.
    if (row === schedule.at(-1)) continue;
    for (let remaining = 90000; remaining > 0; remaining -= 30000) { signal?.throwIfAborted(); await wait(Math.min(30000, remaining)); }
  }
  } catch (error) {
    if (!signal?.aborted) throw error;
    ledger.endpointStop = 'interrupted';
  } finally {
    if (signal?.aborted && !ledger.endpointStop) ledger.endpointStop = 'interrupted';
    ledger.providerStops = [...stopped]; ledger.completed = true; ledger.finishedAt = new Date().toISOString(); save(ledger);
  }
}
async function main() {
  if (process.env.CI || process.argv.length !== 2) throw Error('Live pilot forbidden in CI or with arguments');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  console.log('Ready for coherent evaluation JSON on hidden stdin.');
  const lines = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const iterator = lines[Symbol.asyncIterator](); let line;
  try { line = await iterator.next(); } finally { lines.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); }
  if (line.done) throw Error('Missing hidden configuration');
  const config = JSON.parse(line.value), directory = resolve('work/english-accuracy/coherent-feedback-v1');
  const planPath = 'data/evaluations/coherent-feedback-plan.json', plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) throw Error('Dirty source');
  const authorizationPath = resolve(directory, 'authorization.json'), authorization = JSON.parse(readFileSync(authorizationPath, 'utf8'));
  validateCoherentConfig(config, authorization, source, hash(plan));
  if (contentHash('tests/fixtures/english-accuracy.json') !== plan.fixtureContentHash || contentHash(plan.priorReport) !== plan.priorReportContentHash
      || JSON.parse(readFileSync(plan.priorReport, 'utf8')).totalCalls !== 826) throw Error('Frozen prior evidence changed');
  const root = resolve('.sites-runtime/english-accuracy'); mkdirSync(root, { recursive: true }); mkdirSync(directory, { recursive: true });
  const lockPath = resolve(root, 'running.lock'), lock = openSync(lockPath, 'wx');
  const stop = new AbortController(), interrupt = () => stop.abort(Error('Interrupted'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    const modulePath = resolve(directory, 'requests.mjs');
    await build({ entryPoints: ['lib/coherent-feedback-evaluation.ts'], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
    const helper = await import(pathToFileURL(modulePath).href), schedule = helper.coherentFeedbackSchedule(), profiles = {};
    for (const row of schedule) profiles[`${row.caseId}/${row.provider}`] = await helper.coherentFeedbackProfile(helper.coherentFeedbackCases.find(c => c.id === row.caseId), row.provider);
    const ledger = { comparison, sourceCommit: source, planHash: hash(plan), previousCalls: 826, maximumCalls: 120, models: helper.accuracyModels, schedule, profiles, attempts: [], completed: false };
    const ledgerPath = resolve(directory, 'ledger.json'); writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', { flag: 'wx' });
    authorization.runInitialized = true; atomicJson(authorizationPath, authorization);
    try {
      const preflight = await fetch(config.origin + '/api/english-accuracy-evaluation', requestInit(config, { comparison, provider: 'google', caseId: 'preflight-invalid-case' }, AbortSignal.any([AbortSignal.timeout(15000), stop.signal])));
      if (preflight.status !== 400 || (await preflight.json()).code !== 'evaluation_invalid_case') throw Error('Pilot endpoint not ready');
      await collectCoherent({ ledger, schedule, profiles, helper, config }, { save: v => atomicJson(ledgerPath, v), signal: stop.signal, progress: value => console.log(JSON.stringify(value)) });
    } catch {
      ledger.endpointStop ??= stop.signal.aborted ? 'interrupted' : 'preflight_or_collection_failed';
      ledger.completed = true; ledger.finishedAt = new Date().toISOString(); atomicJson(ledgerPath, ledger);
    }
    const review = reviewBundle(ledger.attempts, 12); atomicJson(resolve(directory, 'review-bundle.json'), review); atomicJson(resolve(directory, 'blind.json'), review.blinded);
    console.log(JSON.stringify({ completed: ledger.completed, attempts: ledger.attempts.length, totalCalls: 826 + ledger.attempts.length, notAttempted: 120 - ledger.attempts.length, providerStops: ledger.providerStops }));
  } finally { closeSync(lock); unlinkSync(lockPath); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Coherent evaluation stopped; consumed slots preserved.'); process.exitCode = 1; });

