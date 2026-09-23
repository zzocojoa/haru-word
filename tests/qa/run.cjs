const { readdirSync, mkdirSync, createWriteStream, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { waitForWorker, localBase } = require('./runtime.cjs');
const performanceTests = new Set(['history-performance-qa.cjs', 'startup-performance-qa.cjs']);
const group = process.argv[2] || 'functional';
if (!['functional', 'performance'].includes(group)) throw new Error('Choose functional or performance.');
const files = readdirSync(path.resolve('tests')).filter(name => name.endsWith('-qa.cjs')).sort();
const cases = files.filter(name => performanceTests.has(name) === (group === 'performance'))
  .flatMap(name => name === 'a1-content-qa.cjs' ? ['A1', 'A2', 'B1', 'B2'].map(level => [name, level]) : [[name]]);
if (process.argv.includes('--list')) { console.log(cases.map(args => args.join(' ')).join('\n')); process.exit(0); }
(async () => {
  localBase(); await waitForWorker();
  const out = path.resolve('outputs/browser-suite', group + '-' + Date.now()); mkdirSync(out, { recursive: true });
  const results = [];
  // Sequential by design: performance measurements never overlap functional QA.
  for (const args of cases) {
    await waitForWorker();
    const name = args.join('-'), started = Date.now();
    const log = createWriteStream(path.join(out, name + '.log'));
    const child = spawn(process.execPath, [path.join('tests', args[0]), ...args.slice(1)], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, group === 'performance' ? 600_000 : 180_000);
    const code = await new Promise(resolve => {
      child.once('error', error => { log.write(error.message); resolve(1); });
      child.once('close', code => resolve(code ?? 1));
    });
    clearTimeout(timer); await new Promise(resolve => log.end(resolve));
    results.push({ name, code, timedOut, durationMs: Date.now() - started });
    console.log(`${code === 0 && !timedOut ? 'PASS' : 'FAIL'} ${name}`);
    writeFileSync(path.join(out, 'results.json'), JSON.stringify({ group, expected: cases.length, results }, null, 2));
  }
  process.exitCode = results.length === cases.length && results.every(r => r.code === 0 && !r.timedOut) ? 0 : 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
