// Static component comparison only. No learner data or AI calls.
const { build } = require('esbuild');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, base } = require('./qa/runtime.cjs');
const baseline = 'a306859fa20a3b5b21aa7fc55389471d90aa02ef';
(async () => {
  fs.mkdirSync('outputs/copy-density', { recursive: true });
  for (const version of ['before', 'after']) await build({ entryPoints: ['tests/copy-density-harness.tsx'], outfile: `work/copy-${version}.cjs`, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', logLevel: 'silent',
    plugins: version === 'before' ? [{ name: 'baseline', setup(b) { b.onLoad({ filter: /[\\/]app[\\/].*\.tsx$/ }, args => {
      const file = path.relative(process.cwd(), args.path).replaceAll('\\', '/');
      return { contents: execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }), loader: 'tsx' };
    }); } }] : [] });
  const browser = await launchBrowser();
  try {
    const p = await browser.newPage();
    await p.goto(base, { waitUntil: 'networkidle' });
    const results = [];
    for (const width of [320, 390, 640, 1440]) for (const scale of [1, 2]) for (const surface of ['word-ai', 'grammar-ai', 'familiarity']) {
      await p.setViewportSize({ width, height: 900 });
      const heights = {};
      for (const version of ['before', 'after']) {
        const html = require(`../work/copy-${version}.cjs`).render(surface);
        heights[version] = await p.evaluate(({ html, scale }) => {
          document.documentElement.style.fontSize = `${16 * scale}px`;
          document.body.innerHTML = '<main style="width:100%;max-width:640px;padding:20px;box-sizing:border-box"><section class="learning-panel" id="fixture">' + html + '</section></main>';
          const el = document.querySelector('#fixture');
          return { height: el.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        }, { html, scale });
        if (version === 'after') {
          assert.equal(heights[version].overflow, false, `${surface} ${width} ${scale}: overflow`);
          if (surface.includes('ai')) {
            const visible = await p.locator('.ai-use-notice').innerText();
            for (const text of ['Google', 'Groq', '전송', '개인정보', '서비스 개선']) assert.ok(visible.includes(text));
          }
          if (width === 390 && scale === 1) await p.screenshot({ path: `outputs/copy-density/${surface}.png`, fullPage: true });
        }
      }
      results.push({ surface, width, scale, ...heights });
    }
    fs.writeFileSync('outputs/copy-density/results.json', JSON.stringify(results, null, 2));
    const regressions = results.filter(r => r.after.height > r.before.height + 1);
    console.log(JSON.stringify({ measurements: results.length, regressions }));
    assert.equal(regressions.length, 0, 'Guidance must not become taller.');
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
