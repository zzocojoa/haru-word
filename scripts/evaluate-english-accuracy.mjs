// Explicit opt-in only; never run in CI. Secrets arrive on stdin, not argv/files.
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export function evaluationBudget(records, round) {
  if (![1, 2].includes(round) || records.length >= 240) throw Error('Evaluation budget exhausted or invalid round.');
  const previous = records.filter(r => r.round === 1).length;
  if (round === 2 && previous !== 120) throw Error('Complete the 120-call baseline before one revised round.');
  if (records.filter(r => r.round === round).length >= 120) throw Error('This round already contains 120 attempts.');
}
export function evaluationNeedsCalls(records, round) {
  if (records.filter(r => r.round === round).length === 120) return false;
  evaluationBudget(records, round);
  return true;
}
function atomicJson(path, value) { writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path); }
export function evaluationProfiles(records, round, fixtureHash, profiles) {
  for (const r of records) {
    if (r.fixtureHash !== fixtureHash) throw Error('Fixture changed between attempts.');
    if (r.expectedModel !== profiles[r.domain].models[r.provider]) throw Error('Model changed between attempts.');
    if (r.round === round && r.promptHash !== profiles[r.domain].promptHash) throw Error('Prompt changed within the round.');
  }
  if (round === 2 && !records.some(r => r.round === 1 && r.promptHash !== profiles[r.domain].promptHash)) throw Error('Round 2 requires an actual prompt revision.');
}
export function blindAttempt(r) {
  const feedback = r.feedback ? { ...r.feedback } : undefined;
  if (feedback) { delete feedback.model; delete feedback.createdAt; }
  return { label: '', caseId: r.caseId, status: r.status, ...(r.status !== 'response' ? { code: 'transport_or_provider_failure' } : {}), feedback, number: r.number };
}
export function reviewBundle(attempts, round, existing) {
  const records = attempts.filter(r => r.round === round);
  const ledgerHash = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  if (existing?.ledgerHash === ledgerHash) return existing;
  const blinded = records.map(blindAttempt);
  for (let i = blinded.length - 1; i > 0; i--) { const j = randomInt(i + 1); [blinded[i], blinded[j]] = [blinded[j], blinded[i]]; }
  const mapping = blinded.map((r, i) => ({ label: `B${String(i + 1).padStart(3, '0')}`, number: r.number }));
  blinded.forEach((r, i) => { r.label = mapping[i].label; delete r.number; });
  return { round, ledgerHash, blindHash: createHash('sha256').update(JSON.stringify(blinded)).digest('hex'), blinded, mapping };
}
async function main() {
  const round = Number(process.argv[process.argv.indexOf('--round') + 1]);
  if (!process.argv.includes('--live') || ![1, 2].includes(round)) throw Error('Use --live --round 1 (or one revised round 2).');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  const rl = createInterface({ input: process.stdin, terminal: false });
  const config = JSON.parse(await new Promise((accept, reject) => { rl.once('line', accept); rl.once('close', () => reject(Error('Missing stdin configuration.'))); }));
  rl.close();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  const origin = new URL(config.origin);
  if (origin.origin !== 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site' || !/^[a-f0-9]{64}$/.test(config.evaluationToken)) throw Error('Invalid evaluation origin or token.');
  const directory = resolve('.sites-runtime/english-accuracy'); mkdirSync(directory, { recursive: true });
  const ledgerPath = resolve(directory, 'ledger.json'), lockPath = resolve(directory, 'running.lock');
  const lock = openSync(lockPath, 'wx');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const stop = new AbortController(), interrupt = () => stop.abort(Error('Evaluation interrupted.'));
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { attempts: [] };
    if (evaluationNeedsCalls(ledger.attempts, round)) {
      await build({ entryPoints: ['lib/english-accuracy.ts'], outfile: resolve(directory, 'requests.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
      const { accuracyCases, accuracyRequest, accuracyPromptHash, accuracyModels } = await import('./../.sites-runtime/english-accuracy/requests.mjs');
      const fixtureHash = createHash('sha256').update(readFileSync('tests/fixtures/english-accuracy.json')).digest('hex');
      const profiles = {};
      for (const domain of ['word', 'grammar']) profiles[domain] = { promptHash: await accuracyPromptHash(accuracyRequest(accuracyCases.find(c => c.domain === domain), round).instruction), models: accuracyModels };
      evaluationProfiles(ledger.attempts, round, fixtureHash, profiles);
      for (const sample of accuracyCases) for (const provider of ['google', 'groq']) {
        stop.signal.throwIfAborted();
        if (ledger.attempts.some(r => r.round === round && r.caseId === sample.id && r.provider === provider)) continue;
        evaluationBudget(ledger.attempts, round);
        const promptHash = await accuracyPromptHash(accuracyRequest(sample, round).instruction);
        const attempt = { number: ledger.attempts.length + 1, round, domain: sample.domain, caseId: sample.id, provider, fixtureHash, promptHash, expectedModel: accuracyModels[provider], startedAt: new Date().toISOString(), status: 'started' };
        // Persist BEFORE HTTP. A crash/failed request consumes its slot; never retry.
        ledger.attempts.push(attempt); atomicJson(ledgerPath, ledger);
        try {
          const response = await fetch(origin.origin + '/api/english-accuracy-evaluation', { method: 'POST', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(45_000), stop.signal]),
            headers: { 'Content-Type': 'application/json', Origin: origin.origin, 'X-English-Accuracy-Token': config.evaluationToken,
              ...(config.siteToken ? { 'OAI-Sites-Authorization': config.siteToken.startsWith('Bearer ') ? config.siteToken : `Bearer ${config.siteToken}` } : {}) },
            body: JSON.stringify({ caseId: sample.id, provider, round }) });
          const result = await response.json();
          attempt.httpStatus = response.status;
          if (response.ok && result.promptHash === promptHash && result.caseId === sample.id && result.provider === provider && result.feedback?.original === sample.sentence && result.feedback.model === attempt.expectedModel) {
            attempt.status = 'response'; attempt.feedback = result.feedback; attempt.durationMs = result.durationMs;
          } else { attempt.status = 'failure'; attempt.code = /^[a-z_]{1,60}$/.test(result.code ?? '') ? result.code : 'evaluation_invalid_response'; attempt.providerStatus = result.providerStatus;
            if (['envelope','model','content_type','content_limit','json_syntax','fields','structure'].includes(result.validationStage)) attempt.validationStage = result.validationStage; }
        } catch { attempt.status = 'failure'; attempt.code = 'evaluation_transport'; }
        attempt.finishedAt = new Date().toISOString(); atomicJson(ledgerPath, ledger);
        if (ledger.attempts.length % 10 === 0) console.log(JSON.stringify({ attempts: ledger.attempts.length, responses: ledger.attempts.filter(r => r.status === 'response').length }));
        // Conservative spacing for this one-off comparison, never an app limit.
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    // One atomic authoritative bundle keeps the blind/mapping pair together.
    // A complete-round resume reuses its order and only regenerates the view.
    const bundlePath = resolve(directory, `review-bundle-round-${round}.json`);
    const existing = existsSync(bundlePath) ? JSON.parse(readFileSync(bundlePath, 'utf8')) : undefined;
    const bundle = reviewBundle(ledger.attempts, round, existing);
    atomicJson(bundlePath, bundle);
    atomicJson(resolve(directory, `blind-round-${round}.json`), bundle.blinded);
    console.log(JSON.stringify({ complete: true, totalAttempts: ledger.attempts.length, round }));
  } finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); closeSync(lock); unlinkSync(lockPath); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Evaluation stopped. Inspect the safe ledger; do not retry consumed slots.'); process.exitCode = 1; });
