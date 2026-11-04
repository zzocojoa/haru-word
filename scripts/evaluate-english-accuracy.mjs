// Explicit opt-in only; never run in CI. Secrets arrive on stdin, not argv/files.
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
  if (process.argv.includes('--live') || !process.argv.includes('--offline')) throw Error('Legacy live evaluation is retired; use --offline for complete frozen ledgers.');
  const round = Number(process.argv[process.argv.indexOf('--round') + 1]);
  if (![1, 2].includes(round)) throw Error('Choose frozen round 1 or 2.');
  const directory = resolve('.sites-runtime/english-accuracy'), ledgerPath = resolve(directory, 'ledger.json');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  if (evaluationNeedsCalls(ledger.attempts, round)) throw Error('Incomplete ledger cannot generate requests offline.');
  const lockPath = resolve(directory, 'running.lock'), lock = openSync(lockPath, 'wx');
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, mode: 'offline', startedAt: new Date().toISOString() }));
    const bundlePath = resolve(directory, 'review-bundle-round-'+round+'.json');
    const existing = existsSync(bundlePath) ? JSON.parse(readFileSync(bundlePath, 'utf8')) : undefined;
    const bundle = reviewBundle(ledger.attempts, round, existing);
    atomicJson(bundlePath, bundle); atomicJson(resolve(directory, 'blind-round-'+round+'.json'), bundle.blinded);
    console.log(JSON.stringify({ complete: true, offline: true, totalAttempts: ledger.attempts.length, round }));
  } finally { closeSync(lock); unlinkSync(lockPath); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Evaluation stopped. Inspect the safe ledger; do not retry consumed slots.'); process.exitCode = 1; });
