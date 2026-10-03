const { readdirSync, mkdirSync, writeFileSync, openSync, closeSync, unlinkSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { runCase } = require('./process.cjs');
const manifest = require('./manifest.cjs');
const { waitForWorker, localBase } = require('./runtime.cjs');
const performanceTests = new Set(['history-performance-qa.cjs', 'startup-performance-qa.cjs', 'backup-resource-qa.cjs', 'grammar-input-performance-qa.cjs']);
const group = process.argv[2] || 'functional';
if (!['functional', 'performance'].includes(group)) throw new Error('Choose functional or performance.');
const files = readdirSync(path.resolve('tests')).filter(name => name.endsWith('-qa.cjs')).sort();
if (files.length !== manifest.length || files.some(name => !manifest.includes(name))) throw new Error('Register every browser QA script in tests/qa/manifest.cjs.');
const cases = manifest.filter(name => performanceTests.has(name) === (group === 'performance'))
  .flatMap(name => name === 'a1-content-qa.cjs' ? ['A1', 'A2', 'B1', 'B2'].map(level => [name, level]) : [[name]]);
if (process.argv.includes('--list')) { console.log(cases.map(args => args.join(' ')).join('\n')); process.exit(0); }
(async () => {
  mkdirSync('work', { recursive: true });
  const lockPath = path.resolve('work/browser-qa.lock');
  try {
    const owner = Number(readFileSync(lockPath, 'utf8'));
    if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('Invalid QA lock; inspect work/browser-qa.lock.');
    try { process.kill(owner, 0); throw new Error('Another browser suite is running; performance must run alone.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    unlinkSync(lockPath);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const lock = openSync(lockPath, 'wx'); writeFileSync(lock, String(process.pid)); closeSync(lock);
  try {
  localBase(); await waitForWorker();
  const out = path.resolve('outputs/browser-suite', group + '-' + Date.now()); mkdirSync(out, { recursive: true });
  const results = [];
  // Sequential by design: performance measurements never overlap functional QA.
  for (const args of cases) {
    await waitForWorker();
    const name = args.join('-'), started = Date.now();
    const { code, timedOut, interrupted } = await runCase([path.join('tests', args[0]), ...args.slice(1)], {
      logPath: path.join(out, name + '.log'), timeoutMs: group === 'performance' || /^grammar-v[234]-qa\.cjs$/.test(args[0]) ? 600_000 : 180_000,
    });
    results.push({ name, code, timedOut, ...(interrupted ? { interrupted: true } : {}), durationMs: Date.now() - started });
    console.log(`${code === 0 && !timedOut ? 'PASS' : 'FAIL'} ${name}`);
    writeFileSync(path.join(out, 'results.json'), JSON.stringify({ group, expected: cases.length, results }, null, 2));
    if (interrupted) break;
  }
  process.exitCode = results.length === cases.length && results.every(r => r.code === 0 && !r.timedOut) ? 0 : 1;
  } finally { unlinkSync(lockPath); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
