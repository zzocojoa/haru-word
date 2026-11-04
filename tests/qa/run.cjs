const { readdirSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { runCase } = require('./process.cjs');
const manifest = require('./manifest.cjs');
const { waitForWorker, localBase, accountHeaders } = require('./runtime.cjs');
const { validateEnvironment, requireDisabledAiStatus } = require('./preflight.cjs');
const { grammarWorker } = require('./worker-profile.cjs');
const { acquireLock } = require('./lock.cjs');
const performanceTests = new Set(['history-performance-qa.cjs', 'startup-performance-qa.cjs', 'backup-resource-qa.cjs', 'grammar-input-performance-qa.cjs', 'image-practice-performance-qa.cjs']);
const group = process.argv[2] || 'functional';
if (!['functional', 'performance'].includes(group)) throw new Error('Choose functional or performance.');
const files = readdirSync(path.resolve('tests')).filter(name => name.endsWith('-qa.cjs')).sort();
if (files.length !== manifest.length || files.some(name => !manifest.includes(name))) throw new Error('Register every browser QA script in tests/qa/manifest.cjs.');
const cases = manifest.filter(name => performanceTests.has(name) === (group === 'performance'))
  .flatMap(name => name === 'a1-content-qa.cjs' ? ['A1', 'A2', 'B1', 'B2'].map(level => [name, level]) : name === 'grammar-v4-compat-qa.cjs' ? [[name],[name,'new-v3']] : [[name]]);
if (process.argv.includes('--list')) { console.log(cases.map(args => args.join(' ')).join('\n')); process.exit(0); }
(async () => {
  mkdirSync('work', { recursive: true });
  const lockPath = path.resolve('work/browser-qa.lock');
  const profiles = new Map();
  const releaseLock=acquireLock(lockPath);
  try {
  const base=localBase(); validateEnvironment(); await waitForWorker();
  await requireDisabledAiStatus(base,accountHeaders('qa_preflight'));
  const out = path.resolve('outputs/browser-suite', group + '-' + Date.now()); mkdirSync(out, { recursive: true });
  const results = [];
  // Sequential by design: performance measurements never overlap functional QA.
  for (const args of cases) {
    await waitForWorker();
    let env = {...process.env,QA_ENGINE:process.env.QA_BROWSER||'chromium'};
    const version = args[0] === 'grammar-v4-compat-qa.cjs' ? (args[1] === 'new-v3' ? 3 : 4) : Number(/^grammar-v([234])-qa\.cjs$/.exec(args[0])?.[1]);
    if(version){
      if(!profiles.has(version))profiles.set(version,await grammarWorker(version));
      const profile=profiles.get(version);
      env={...env,QA_BASE_URL:profile.base,QA_WORKER_CONFIG:profile.configPath,QA_GRAMMAR_VERSION:String(version)};
      if(args[0]==='grammar-v4-compat-qa.cjs')env.QA_NEW_GRAMMAR_VERSION=String(version);
      validateEnvironment(env);await waitForWorker(profile.base);
    }
    const name = args.join('-'), started = Date.now();
    const { code, timedOut, interrupted } = await runCase([path.join('tests', args[0]), ...args.slice(1)], {
      logPath: path.join(out, name + '.log'), timeoutMs: group === 'performance' || /^grammar-v[234]-qa\.cjs$/.test(args[0]) ? 600_000 : 180_000,env,
    });
    results.push({ name, code, timedOut, ...(interrupted ? { interrupted: true } : {}), durationMs: Date.now() - started });
    console.log(`${code === 0 && !timedOut ? 'PASS' : 'FAIL'} ${name}`);
    writeFileSync(path.join(out, 'results.json'), JSON.stringify({ group, expected: cases.length, results }, null, 2));
    if (interrupted) break;
  }
  process.exitCode = results.length === cases.length && results.every(r => r.code === 0 && !r.timedOut) ? 0 : 1;
  } finally {
    const cleanup=await Promise.allSettled([...profiles.values()].map(profile=>profile.stop()));
    releaseLock();
    if(cleanup.some(result=>result.status==='rejected'))throw new AggregateError(cleanup.filter(result=>result.status==='rejected').map(result=>result.reason),'Owned QA Worker cleanup failed');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
