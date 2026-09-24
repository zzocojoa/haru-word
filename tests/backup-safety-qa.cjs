// Real local Worker, generated records only. Never use a hosted learner account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { launchBrowser, closeBrowser, accountHeaders, base, waitForWorker, axePath } = require('./qa/runtime.cjs');
const { emptyState, history, oversizedState } = require('./fixtures/backup-history.cjs');
const out = 'outputs/backup-safety'; fs.mkdirSync(out, { recursive: true });
const envelope = state => JSON.stringify({ format: 'haru-words-v1', exportedAt: '2026-09-24T00:00:00.000Z', state });

(async () => {
  await waitForWorker();
  await build({ entryPoints: ['lib/backup.ts'], outfile: 'work/backup-safety-parser.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  await build({ stdin: { contents: `import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import BackupDialog from './app/backup-dialog';
    import {EMPTY} from './lib/learning';
    function Harness(){const [state,setState]=useState(structuredClone(EMPTY));
      window.changeBackupState=()=>setState(s=>({...s,settings:{...s.settings,dailyGoal:4}}));
      window.restoreCalls=0;
      return <BackupDialog date="2026-09-24" now={()=>Date.parse('2026-09-24T00:00:00Z')} state={state}
        busy={false} restoring={false} error="" conflict={false} onClose={()=>{}}
        onRestore={async()=>{window.restoreCalls++;return true}} onReload={async()=>true} onComplete={()=>{}}/>}
    createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`, loader: 'tsx', resolveDir: process.cwd() },
    plugins:[{name:'worker-boundary',setup(b){b.onResolve({filter:/backup-worker-client$/},()=>({path:'worker',namespace:'harness'}));b.onLoad({filter:/.*/,namespace:'harness'},()=>({contents:"import {analyzeBackup,analyzeExport} from './lib/backup-analysis'; export const inspectBackupFile=async(file,max)=>analyzeBackup(await file.text(),max); export const inspectBackupExport=analyzeExport;",resolveDir:process.cwd(),loader:'ts'}));}}], outfile: 'work/backup-safety-harness.js', bundle: true, format: 'iife', platform: 'browser', logLevel: 'silent', define: { 'process.env.NODE_ENV': '"development"' } });
  const { parseBackup, MAX_BACKUP_BYTES } = await import('../work/backup-safety-parser.mjs');
  const browser = await launchBrowser(), checks = [], errors = []; let posts = 0;
  try {
    // A same-tab state replacement must invalidate an already approved copy,
    // including while the final confirmation is open.
    const harnessContext = await browser.newContext(); const harness = await harnessContext.newPage(); await require('./qa/restore-compat.cjs').legacyRestore(harnessContext); await harnessContext.route('**/api/state/restore/jobs',r=>r.fulfill({json:{job:null}}));
    harness.on('pageerror', error => errors.push(error.message));
    await harness.route(base+'/backup-harness',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><title>안전 백업 검사</title></head><body><div id="root"></div></body></html>'})); await harness.goto(base+'/backup-harness');
    await harness.addScriptTag({ path: 'work/backup-safety-harness.js' });
    await harness.waitForFunction(()=>document.querySelector('input[type=file]')&&!document.querySelector('input[type=file]').disabled); await harness.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(envelope(emptyState())) });
    const downloaded = harness.waitForEvent('download'); await harness.getByRole('button', { name: '현재 기록 먼저 백업받기' }).click(); await downloaded;
    await harness.getByRole('checkbox').check(); await harness.getByRole('button', { name: '이 백업으로 복원', exact: true }).click();
    await harness.evaluate(() => window.changeBackupState());
    assert.equal(await harness.getByRole('button', { name: '기록 교체 · 복원', exact: true }).isDisabled(), true);
    await harness.getByRole('button', { name: '취소', exact: true }).click();
    await harness.getByRole('alert').filter({ hasText: '현재 기록이 바뀌었어요.' }).waitFor();
    assert.equal(await harness.getByRole('checkbox').isDisabled(), true);
    assert.equal(await harness.getByRole('button', { name: '이 백업으로 복원', exact: true }).isDisabled(), true);
    assert.equal(await harness.evaluate(() => window.restoreCalls), 0); await harnessContext.close();
    checks.push('changing the current snapshot invalidates an approved safety copy even inside final confirmation');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: accountHeaders('backup_safety') });
    const get = async () => { const r = await context.request.get(base + '/api/state'); assert.equal(r.status(), 200); return r.json(); };
    const original = history(); let snapshot = await get();
    const seeded = await context.request.post(base + '/api/state/restore', { headers: { 'content-type': 'application/json', 'x-study-revision': String(snapshot.revision) }, data: envelope(original) });
    assert.equal(seeded.status(), 200, await seeded.text());
    await require('./qa/restore-compat.cjs').legacyRestore(context); const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method()==='POST' && request.url().endsWith('/api/state/restore')) posts++; });
    const saved = () => page.getByText('서버에 저장됨', { exact: true }).waitFor();
    const menu = async name => { await page.getByRole('button', { name: '기록 관리', exact: true }).click(); await page.getByRole('menuitem', { name, exact: true }).click(); };
    const file = async raw => { await page.waitForFunction(()=>document.querySelector('input[type=file]')&&!document.querySelector('input[type=file]').disabled); await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) }); await page.getByRole('table', { name: '현재 기록과 복원할 기록' }).waitFor(); };
    const safety = () => page.getByRole('button', { name: '현재 기록 먼저 백업받기', exact: true });
    const replace = () => page.getByRole('button', { name: '이 백업으로 복원', exact: true });
    const download = async action => { const event = page.waitForEvent('download'); await action(); return fs.readFileSync(await (await event).path(), 'utf8'); };
    const confirm = async () => { await replace().click(); await page.getByRole('button', { name: '기록 교체 · 복원', exact: true }).click(); await page.getByRole('heading', { name: '백업을 복원했어요.', exact: true }).waitFor(); await saved(); await page.getByRole('button', { name: '학습 기록 확인하기', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };
    await page.goto(base); await saved(); await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    const whole = await download(async () => { await menu('전체 백업'); await page.getByRole('button',{name:/^(백업 파일 다운로드|원본 보관용 다운로드)$/}).click(); });
    assert.ok(Buffer.byteLength(whole) < MAX_BACKUP_BYTES); assert.deepEqual(parseBackup(whole).state, original);
    await menu('백업 가져오기'); await file(envelope(emptyState()));

    // Download failure must never be counted as a saved safety copy.
    await page.evaluate(() => { const original = URL.createObjectURL; URL.createObjectURL = (...args) => { URL.createObjectURL = original; throw new Error('다운로드를 시작하지 못했어요.'); }; });
    await safety().click(); await page.getByRole('alert').filter({ hasText: '안전 백업을 준비하지 못해' }).waitFor();
    assert.equal(await page.getByRole('checkbox').isDisabled(), true); assert.equal(await replace().isDisabled(), true); assert.equal(posts, 0);
    const safetyRaw = await download(() => safety().click()); assert.deepEqual(parseBackup(safetyRaw).state, original);
    assert.equal(Buffer.byteLength(safetyRaw), Buffer.byteLength(whole)); await page.getByRole('checkbox').check();
    assert.equal(await replace().isEnabled(), true);
    // Choosing another target requires a new safety copy and acknowledgment.
    await file(envelope({ ...emptyState(), settings: { ...emptyState().settings, dailyGoal: 3 } }));
    assert.equal(await page.getByRole('checkbox').isChecked(), false); assert.equal(await page.getByRole('checkbox').isDisabled(), true); assert.equal(await replace().isDisabled(), true);
    const recovery = await download(() => safety().click()); await page.getByRole('checkbox').check(); await confirm();
    assert.equal(Object.keys((await get()).state.sessions).length, 0);
    await menu('백업 가져오기'); await file(recovery); await download(() => safety().click()); await page.getByRole('checkbox').check(); await confirm();
    assert.deepEqual((await get()).state, original);
    await page.reload(); await saved(); assert.deepEqual((await get()).state, original);
    checks.push('730 sessions: whole and safety exports are compact and restorable; replace then recover and reload preserves all records');
    checks.push('failed download blocks replacement; retry succeeds; changing the selected file resets proof and acknowledgment');

    // Valid normal saves can accumulate beyond the restore limit. Do not relax it.
    const big = oversizedState(), progress = Object.entries(big.progress); snapshot = await get();
    for (let i = 0; i < progress.length; i += 100) {
      const r = await context.request.put(base + '/api/state', { data: { revision: snapshot.revision, progress: Object.fromEntries(progress.slice(i, i + 100)), sessions: {} } });
      assert.equal(r.status(), 200, await r.text()); snapshot.revision = (await r.json()).revision;
    }
    const protectedSnapshot = await get(); assert.ok(Buffer.byteLength(envelope(protectedSnapshot.state)) > MAX_BACKUP_BYTES);
    await page.reload(); await saved(); await page.getByRole('tab', { name: '학습 기록', exact: true }).click();
    const archive = await download(async () => { await menu('전체 백업'); await page.getByRole('button',{name:/^(백업 파일 다운로드|원본 보관용 다운로드)$/}).click(); }); assert.deepEqual(JSON.parse(archive).state, protectedSnapshot.state);
    await menu('백업 가져오기'); await file(envelope(emptyState()));
    const beforePosts = posts; let downloads = 0; page.on('download', () => downloads++);
    await safety().click(); await page.getByRole('alert').filter({ hasText: '안전 백업을 준비하지 못해' }).waitFor();
    assert.match(await page.getByRole('alert').innerText(), /8 MB/);
    assert.equal(await page.getByRole('checkbox').isDisabled(), true); assert.equal(await replace().isDisabled(), true);
    assert.equal(downloads, 0); assert.equal(posts, beforePosts); assert.deepEqual(await get(), protectedSnapshot);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('.dialog-scroll').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))})));fs.writeFileSync(out+'/accessibility.json',JSON.stringify(violations,null,2));
    assert.deepEqual(violations, []); await page.getByRole('alert').scrollIntoViewIfNeeded(); await page.screenshot({ path: out + '/blocked-mobile.png' });
    checks.push('valid accumulated records exceeding 8 MB block safety approval and replacement, keep server state unchanged, and remain exportable as an archive');
    checks.push('blocked-state mobile/desktop layout and automated accessibility pass');
    assert.deepEqual(errors, []);
    const result = { passed: true, checks, compactHistoryBytes: Buffer.byteLength(whole), oversizedBytes: Buffer.byteLength(archive), restoreRequests: posts, errors };
    fs.writeFileSync(out + '/result.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
