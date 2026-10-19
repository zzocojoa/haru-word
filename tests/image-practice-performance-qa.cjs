// Compare two local built Workers with identical synthetic snapshots and probes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { base, localBase, accountHeaders, launchBrowser, closeBrowser, waitForWorker } = require('./qa/runtime.cjs');
const { history } = require('./fixtures/backup-history.cjs');
const baseline = localBase(process.env.QA_BASELINE_URL), out = process.env.QA_PERF_OUTPUT || 'outputs/image-practice-performance';
assert.notEqual(baseline, base, 'Provide separate baseline and candidate loopback Workers');
const headers = { 'X-Study-Grammar': '4', 'X-Study-Feedback-Structure': '1', 'X-Study-Sense-Keys': '1' };
const imageRows = JSON.parse(fs.readFileSync('data/word-image-ui.json')).entries;
const networks = { normal: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, slow: { offline: false, latency: 150, downloadThroughput: 500000, uploadThroughput: 125000 } };
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const report = { method: { repetitions: 3, histories: [0, 365, 1825], viewport: '390x844', cpuSlowdown: 4, networks,
  ready: 'navigationStart to saved screen plus two animation frames', cache: 'new context each sample; Worker warm',
  images: 'same reviewed local WebP fixture, current and one next image; external fonts blocked', actualIphoneChecked: false }, samples: [], errors: [] };
(async () => {
  fs.mkdirSync(out, { recursive: true }); await waitForWorker(base); await waitForWorker(baseline);
  const browser = await launchBrowser({ engine: 'chromium' });
  const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  try {
    for (const count of [0, 365, 1825]) {
      const state = { ...history(count, 3), grammar: {} }, identity = accountHeaders('image_perf');
      const setup = await browser.newContext({ extraHTTPHeaders: identity });
      const before = {};
      for (const [variant, origin] of [['baseline', baseline], ['after', base]]) {
        const initial = await (await setup.request.get(origin + '/api/state', { headers })).json();
        const response = await setup.request.post(origin + '/api/state/restore', { headers: { ...headers, 'X-Study-Revision': String(initial.revision) }, data: { format: 'haru-words-v1', exportedAt: new Date().toISOString(), state } });
        assert.equal(response.status(), 200); before[variant] = await (await setup.request.get(origin + '/api/state', { headers })).json();
      }
      assert.deepEqual(before.baseline, before.after);
      for (const network of ['normal', 'slow']) for (let sample = 0; sample < 3; sample++) {
        const order = sample % 2 ? [['after', base], ['baseline', baseline]] : [['baseline', baseline], ['after', base]];
        for (const [variant, origin] of order) {
          const context = await browser.newContext({ extraHTTPHeaders: identity, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
          const requests = [], images = [], forbidden = [];
          try {
            await context.route('**/*', route => {
              const r = route.request(), url = new URL(r.url());
              if (url.origin !== origin) return route.abort();
              if (!['GET', 'HEAD'].includes(r.method())) { forbidden.push('write'); return route.abort(); }
              requests.push(url.pathname);
              if (url.pathname.startsWith('/word-images/v1/')) {
                images.push(url.pathname); return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(path.join(process.env.QA_WORD_IMAGE_ASSET_ROOT || 'public/word-images-pilot', path.basename(url.pathname))) });
              }
              return route.continue();
            });
            const page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', e => report.errors.push({ variant, name: e.name }));
            const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); await cdp.send('Network.emulateNetworkConditions', networks[network]);
            await page.addInitScript(() => {
              window.imagePerf = { ready: null };
              const observer = new MutationObserver(() => {
                if (!window.imagePerf.pending && document.querySelector('.topbar .save-state')?.textContent.includes('저장됨')) {
                  window.imagePerf.pending = true; requestAnimationFrame(() => requestAnimationFrame(() => { window.imagePerf.ready = performance.now(); observer.disconnect(); }));
                }
              }); observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
            });
            await page.goto(origin, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.imagePerf.ready !== null);
            const startup = await page.evaluate(() => ({ readyMs: window.imagePerf.ready, resources: performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin)).map(r => ({ path: new URL(r.name).pathname, bytes: r.encodedBodySize, duration: r.duration })) }));
            assert.equal(images.length, 0); assert.equal(requests.includes('/api/image-practice/position'), false);
            const dist = variant === 'baseline' ? process.env.QA_BASELINE_DIST : 'dist';
            assert.ok(dist, 'Provide QA_BASELINE_DIST');
            for (const resource of startup.resources.filter(r => r.path.endsWith('.js'))) {
              const source = fs.readFileSync(path.join(dist, 'client', resource.path));
              assert.equal(source.includes(Buffer.from(imageRows.at(-1)[1])), false, 'image index is not loaded on home');
            }
            await page.getByRole('button', { name: '이미지 연습', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.image-practice-picture')?.naturalWidth > 0);
            const flip = page.getByRole('dialog').getByRole('button', { name: variant === 'baseline' ? /뜻 보기$/ : /단어·뜻 보기$/ });
            await flip.waitFor();
            assert.equal(await flip.isEnabled(), true, 'loaded image card is ready to flip');
            await page.waitForTimeout(100);
            assert.deepEqual([...new Set(images)], imageRows.slice(0, 2).map(row => `/word-images/v1/${row[1]}.webp`));
            assert.deepEqual(forbidden, []);
            report.samples.push({ count, network, sample, variant, readyMs: Math.round(startup.readyMs), initialJsRequests: startup.resources.filter(r => r.path.endsWith('.js')).length,
              initialBytes: startup.resources.reduce((sum, r) => sum + r.bytes, 0), homePositionRequests: 0, homeImageRequests: 0, practiceImageRequests: images.length,
              practicePositionRequests: requests.filter(p => p === '/api/image-practice/position').length }); save();
          } finally { await context.close(); }
        }
      }
      for (const [variant, origin] of [['baseline', baseline], ['after', base]]) {
        const after = await (await setup.request.get(origin + '/api/state', { headers })).json(); assert.equal(sha(after), sha(before[variant]));
      }
      await setup.close(); console.log(JSON.stringify({ count, samplesComplete: report.samples.length }));
    }
    assert.deepEqual(report.errors, []); report.passed = true; report.unchangedStateAndRevision = true; save();
  } finally { await closeBrowser(browser); }
})().catch(error => { fs.mkdirSync(out, { recursive: true }); report.failure = error.message; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); process.exitCode = 1; });
