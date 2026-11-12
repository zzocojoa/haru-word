// Run only the icon integration checks against an owned, synthetic local Worker.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const { grammarWorker } = (await import('../tests/qa/worker-profile.cjs')).default;
const { runCase } = (await import('../tests/qa/process.cjs')).default;
const { acquireLock } = (await import('../tests/qa/lock.cjs')).default;
const { waitForWorker, accountHeaders, axePath } = (await import('../tests/qa/runtime.cjs')).default;
const { validateEnvironment, requireDisabledAiStatus } = (await import('../tests/qa/preflight.cjs')).default;
const resolveModule = createRequire(import.meta.url).resolve;

const cases = [
  'ui-plan-contract-qa.cjs',
  'editor-save-qa.cjs',
  'today-status-qa.cjs',
  'daily-topup-qa.cjs',
  'repeat-learning-qa.cjs',
  'haru-icons-qa.cjs',
  'workflow-qa.cjs',
  'study-layout-qa.cjs',
  'haru-session-icons-qa.cjs',
  'haru-content-icons-qa.cjs',
  'haru-record-icons-qa.cjs',
  'haru-system-icons-qa.cjs',
  'backup-workflow-qa.cjs',
];
const engine = process.env.QA_BROWSER || 'chromium';

(async () => {
  if (!['chromium', 'webkit'].includes(engine)) throw Error('Unsupported QA browser engine');
  const out = path.resolve('outputs/haru-icons');
  const logs = path.join(out, 'logs', engine);
  const reportPath = path.join(out, 'suite-' + engine + '.json');
  const report = { passed: false, engine, expected: cases.length, startedAt: new Date().toISOString(), results: [] };
  const controller = new AbortController(), signal = controller.signal;
  const handlers = new Map(['SIGINT', 'SIGTERM'].map(name => [name, () => {
    if (!signal.aborted) controller.abort(Object.assign(Error('Icon QA interrupted by ' + name), {
      signal: name, exitCode: name === 'SIGINT' ? 130 : 143,
    }));
  }]));
  for (const [name, handler] of handlers) process.on(name, handler);
  let worker, releaseLock, outputReady = false;
  const writeReport = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  try {
    fs.mkdirSync('work', { recursive: true });
    releaseLock = acquireLock(path.resolve('work/browser-qa.lock'));
    fs.mkdirSync(logs, { recursive: true });
    outputReady = true;
    fs.accessSync('dist/server/wrangler.json', fs.constants.R_OK);
    fs.accessSync(axePath, fs.constants.R_OK);
    const { default: playwright } = await import(pathToFileURL(resolveModule(process.env.QA_PLAYWRIGHT_PATH || 'playwright')).href);
    if (typeof playwright[engine]?.launch !== 'function') throw Error('Playwright engine is unavailable');
    signal.throwIfAborted();
    worker = await grammarWorker(4, { signal });
    const env = {
      ...process.env,
      QA_BROWSER: engine,
      QA_ENGINE: engine,
      QA_BASE_URL: worker.base,
      QA_WORKER_CONFIG: worker.configPath,
      QA_GRAMMAR_VERSION: '4',
    };
    validateEnvironment(env);
    await requireDisabledAiStatus(worker.base, accountHeaders('icon_qa_preflight'), undefined, signal);
    report.worker = { origin: worker.base, grammarVersion: 4, realAiGeneration: 'disabled' };
    writeReport();
    for (const name of cases) {
      signal.throwIfAborted();
      await waitForWorker(worker.base, 30_000, signal);
      const started = Date.now();
      const result = await runCase([path.join('tests', name)], {
        env, signal, timeoutMs: name.startsWith('haru-') ? 600_000 : 180_000,
        logPath: path.join(logs, name + '.log'),
      });
      report.results.push({ name, ...result, durationMs: Date.now() - started });
      console.log((result.code === 0 && !result.timedOut ? 'PASS ' : 'FAIL ') + name);
      writeReport();
      if (result.interrupted) break;
    }
    report.passed = report.results.length === cases.length
      && report.results.every(result => result.code === 0 && !result.timedOut && !result.interrupted);
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    report.error = error.stack || error.message;
    console.error(error.stack || error.message);
    process.exitCode = signal.aborted ? signal.reason.exitCode : 1;
  } finally {
    const cleanupErrors = [];
    try { await worker?.stop(); }
    catch (error) { cleanupErrors.push('Worker: ' + error.message); }
    try { releaseLock?.(); }
    catch (error) { cleanupErrors.push('Lock: ' + error.message); }
    if (cleanupErrors.length) {
      report.cleanupErrors = cleanupErrors;
      console.error(cleanupErrors.join('\n'));
      report.passed = false;
      process.exitCode = 1;
    }
    if (signal.aborted) {
      report.interrupted = true;
      report.signal = signal.reason.signal;
      report.passed = false;
      process.exitCode = signal.reason.exitCode;
    }
    report.finishedAt = new Date().toISOString();
    try { if (outputReady) writeReport(); }
    finally { for (const [name, handler] of handlers) process.removeListener(name, handler); }
  }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
