const path = require('node:path');
const { randomUUID } = require('node:crypto');

function localBase(value = process.env.QA_BASE_URL || 'http://127.0.0.1:8787') {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('QA_BASE_URL must be a loopback origin. Hosted learner data must never be used by QA.');
  }
  return url.origin;
}
function playwright() {
  try { return require(process.env.QA_PLAYWRIGHT_PATH || 'playwright'); }
  catch { throw new Error('Playwright is unavailable. Set QA_PLAYWRIGHT_PATH to the installed Playwright module directory.'); }
}
function account(prefix = 'qa') { return `${prefix}_${randomUUID()}`; }
function accountHeaders(prefix) {
  return { 'oai-authenticated-user-id': account(prefix), 'oai-authenticated-user-email': 'qa@example.test' };
}
async function waitForWorker(base = localBase(), timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const response = await fetch(base + '/api/study-clock', { signal: AbortSignal.timeout(2000), redirect: 'error' });
      await response.arrayBuffer();
      if ([200, 401].includes(response.status)) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local built Worker is not ready. Build and start the site before running browser QA.');
}
module.exports = {
  localBase, base: localBase(), account, accountHeaders, waitForWorker,
  axePath: path.resolve(process.env.AXE_CORE_PATH || 'work/axe/package/axe.min.js'),
  get chromium() { return playwright().chromium; },
};
