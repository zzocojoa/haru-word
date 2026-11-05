// Two synthetic accounts share one browser origin. Authentication is supplied
// only to the owned loopback Worker through its documented QA headers.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const source = path.resolve(__dirname, '..');
process.chdir(source);
const req = createRequire(path.join(source, 'package.json'));
const { build } = req('esbuild');
const { base, accountHeaders, launchBrowser, closeBrowser } = req('./tests/qa/runtime.cjs');
const { emptyState } = req('./tests/fixtures/backup-history.cjs');
const out = path.join(source, 'outputs/comprehensive-remediation-browser/late-owner', process.env.QA_BROWSER || 'chromium');
fs.mkdirSync(out, { recursive: true });
const progress = [];
const step = name => { progress.push({ name, at: new Date().toISOString() }); fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify(progress, null, 2)); console.log('STAGE ' + name); };
(async () => {
  await build({ entryPoints: ['lib/grammar/practice.ts', 'lib/grammar/content-v4.ts'], outdir: path.join(out, 'modules'), bundle: true, platform: 'node', format: 'cjs', outExtension: { '.js': '.cjs' }, logLevel: 'silent' });
  const { newLessonProgress } = require(path.join(out, 'modules', 'practice.cjs'));
  const { PRACTICE_LESSONS_V4 } = require(path.join(out, 'modules', 'content-v4.cjs'));
  const lesson = PRACTICE_LESSONS_V4.noun;
  const answered = q => ({ first: q.answer, latest: q.answer, helped: false, attempts: 1 });
  const seed = { ...newLessonProgress('noun', '2026-11-01T00:00:00.000Z', 4), stage: 5,
    observation: answered(lesson.observation), answers: Object.fromEntries(lesson.questions.map((q, i) => ['q' + (i + 1), answered(q)])), sentence: 'Saved B sentence.' };
  const browser = await launchBrowser({ engine: process.env.QA_BROWSER || 'chromium' });
  const accountA = accountHeaders('late_A'), accountB = accountHeaders('late_B');
  let currentAuth = accountA;
  const context = await browser.newContext({ extraHTTPHeaders: accountA, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [], stateResponses = [];
  let releaseLate;
  const gate = new Promise(resolve => { releaseLate = resolve; });
  let signalHtmlReady;
  const htmlReady = new Promise(resolve => { signalHtmlReady = resolve; });
  await context.route('**/*', route => {
    const r = route.request(), u = new URL(r.url());
    if (u.origin !== base) return route.abort();
    if (u.pathname === '/api/state' && r.method() === 'PUT') return route.fulfill({ status: 503, json: { error: '합성 저장 실패: 새 입력은 기기에만 보관' } });
    if (r.method() === 'POST' && /feedback|automation|ai-eval/.test(u.pathname)) throw Error('No AI requests allowed');
    return route.continue({ headers: { ...r.headers(), ...currentAuth } });
  });
  const late = await context.newPage();
  late.on('pageerror', e => errors.push(e.message));
  late.on('response', r => { if (r.url() === base + '/api/state') stateResponses.push(r.status()); });
  await late.route(base + '/', async route => {
    step('A-document-intercepted');
    const response = await route.fetch();
    step('A-document-fetched-' + response.status());
    assert.equal(response.status(), 200);
    assert.ok((await response.text()).includes(accountA['oai-authenticated-user-id']), 'held SSR belongs to A');
    signalHtmlReady();
    step('A-document-held');
    await gate;
    await route.fulfill({ response });
  });
  // Settle immediately: an intentionally held navigation must never become an
  // unhandled rejection before the controlling scenario awaits it.
  const lateNavigation = late.goto(base, { timeout: 120000 }).then(() => null, error => error);
  try {
    await Promise.race([htmlReady, new Promise((_, reject) => setTimeout(() => reject(Error('Held SSR readiness timeout')), 15000))]);
    // Model the server-side identity change on new requests. Updating browser
    // context headers while its navigation is paused can itself await that route.
    currentAuth = accountB;
    step('synthetic-auth-switched-to-B');
    const initial = await (await context.request.get(base + '/api/state', { headers: { ...accountB, 'X-Study-Grammar': '4' } })).json();
    const restored = await context.request.post(base + '/api/state/restore', { headers: { ...accountB, 'X-Study-Grammar': '4', 'X-Study-Revision': String(initial.revision) },
      data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state: { ...emptyState(), grammar: { noun: seed } } } });
    assert.equal(restored.status(), 200, await restored.text());
    step('B-synthetic-state-seeded');
    const current = await context.newPage();
    current.on('pageerror', e => errors.push(e.message));
    await current.goto(base);
    step('B-document-opened');
    await current.getByText('저장됨', { exact: true }).first().waitFor();
    step('B-state-loaded');
    await current.getByRole('tab', { name: '단어장', exact: true }).click();
    await current.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click();
    await current.locator('.grammar-tile').first().click();
    await current.getByRole('textbox', { name: '내 문장', exact: true }).fill('B unsaved synthetic sentence.');
    const prefixB = 'haru-words:local-input:v1:' + encodeURIComponent(accountB['oai-authenticated-user-id']) + ':';
    await current.waitForFunction(prefix => Object.keys(localStorage).some(key => key.startsWith(prefix) && localStorage.getItem(key).includes('B unsaved synthetic sentence.')), prefixB);
    const before = await current.evaluate(({ prefix, owner }) => ({ rows: Object.keys(localStorage).filter(key => key.startsWith(prefix)).length,
      ownerIsB: localStorage.getItem('haru-words:local-input-owner:v1') === owner }), { prefix: prefixB, owner: accountB['oai-authenticated-user-id'] });
    assert.ok(before.rows > 0); assert.equal(before.ownerIsB, true);
    step('B-unsaved-device-row-written');
    releaseLate();
    const navigationError = await lateNavigation;
    if (navigationError) throw navigationError;
    step('A-document-hydrated');
    await late.waitForFunction(owner => localStorage.getItem('haru-words:local-input-owner:v1') === owner, accountB['oai-authenticated-user-id']);
    await late.waitForFunction(() => document.body.textContent.includes('로그인 상태를 다시 확인') || document.body.textContent.includes('로그인한 뒤 다시'));
    const after = await current.evaluate(({ prefix, owner }) => ({ rows: Object.keys(localStorage).filter(key => key.startsWith(prefix)).length,
      ownerIsA: localStorage.getItem('haru-words:local-input-owner:v1') === owner }), { prefix: prefixB, owner: accountA['oai-authenticated-user-id'] });
    assert.equal(after.rows, before.rows, 'late A must preserve current B device draft');
    assert.equal(after.ownerIsA, false);
    assert.equal(await current.getByRole('textbox', { name: '내 문장', exact: true }).inputValue(), 'B unsaved synthetic sentence.');
    assert.ok(stateResponses.includes(401), 'server owner mismatch was rejected');
    assert.deepEqual(errors, []);
    const result = { confirmed: true, engine: process.env.QA_BROWSER || 'chromium', boundary: 'remediation built app + synthetic D1 + shared-origin browser storage',
      condition: 'A SSR response completes before account change but hydrates after B has written an unsaved device draft', before, after,
      staleOwnerStateRejected401: true, actualProviderCalls: 0, productionWrites: 0, errors };
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    await late.screenshot({ path: path.join(out, 'stale-owner-blocked.png'), fullPage: true });
    console.log(JSON.stringify(result));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'probe-failure.json'), JSON.stringify({ error: error.message, stateResponses, errors, progress, lateText: await late.locator('body').innerText({ timeout: 1000 }).catch(() => '') }, null, 2));
    throw error;
  } finally {
    releaseLate(); await lateNavigation.catch(() => {}); await closeBrowser(browser);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
