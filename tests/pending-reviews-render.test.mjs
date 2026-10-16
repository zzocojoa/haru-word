import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMPTY, emptyRecord } from '../lib/learning.ts';

// Observe the expensive boundary while rendering the actual component and rules.
const actualDisplay = resolve('lib/learning-display.ts').replaceAll('\\', '/');
await build({ entryPoints: ['app/pending-reviews.tsx'], outfile: 'work/pending-reviews-render/component.mjs',
  bundle: true, format: 'esm', platform: 'node', external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'],
  logLevel: 'silent', plugins: [{ name: 'observe-label-work', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/learning-display$/ }, () => ({ path: 'labels', namespace: 'observe-label-work' }));
    builder.onLoad({ filter: /.*/, namespace: 'observe-label-work' }, () => ({ loader: 'js', resolveDir: process.cwd(), contents: `
      export { pendingReviewCounts } from ${JSON.stringify(actualDisplay)};
      import { reviewSessionLabels as actualLabels } from ${JSON.stringify(actualDisplay)};
      export function reviewSessionLabels(sessions) {
        globalThis.pendingLabelCalls++;
        return actualLabels(sessions);
      }
    ` }));
  } }] });
const { PendingReviews } = await import('../work/pending-reviews-render/component.mjs');
const makeSession = (id, createdAt, finished = false) => ({ id, kind: 'monthly', period: '2026-09', date: '2026-09-25',
  createdAt, ids: ['word'], records: { word: { ...emptyRecord('뜻'), ...(finished ? { ko: 'independent' } : {}) } }, warmupIds: [], stage: finished ? 'done' : 'ko', index: 0,
  retry: [], retryMode: false, elapsed: 0, paused: true, finished });
function render(state, excludeSessionIds) {
  globalThis.pendingLabelCalls = 0;
  const before = structuredClone(state);
  const html = renderToStaticMarkup(createElement(PendingReviews, { state, excludeSessionIds, busy: false,
    onResume: () => assert.fail('Rendering must not resume or save a session') }));
  assert.deepEqual(state, before);
  return { html, labelCalls: globalThis.pendingLabelCalls };
}

test('completed history without pending reviews renders nothing and skips label work', () => {
  const state = { ...structuredClone(EMPTY), sessions: {
    completed: makeSession('completed', '2026-09-23T01:00:00Z', true),
  } };
  assert.deepEqual(render(state), { html: '', labelCalls: 0 });
});

test('excluding every pending review skips label work too', () => {
  const state = { ...structuredClone(EMPTY), sessions: {
    hidden: makeSession('hidden', '2026-09-24T16:00:00Z'),
  } };
  assert.deepEqual(render(state, ['hidden']), { html: '', labelCalls: 0 });
});

test('visible reviews retain completed and excluded ordinals, latest label and Korean start day', () => {
  const state = { ...structuredClone(EMPTY), sessions: {
    latest: makeSession('latest', '2026-09-25T01:00:00Z'),
    completed: makeSession('completed', '2026-09-23T01:00:00Z', true),
    visible: makeSession('visible', '2026-09-24T16:00:00Z'),
  } };
  const filtered = render(state, ['latest']);
  assert.equal(filtered.labelCalls, 1);
  assert.match(filtered.html, /2회차 · 2026-09-25 시작/);
  assert.doesNotMatch(filtered.html, /최신 회차/);
  const all = render(state);
  assert.equal(all.labelCalls, 1);
  assert.match(all.html, /3회차 · 2026-09-25 시작 · 최신 회차/);
  assert.match(all.html, /2회차 · 2026-09-25 시작/);
});
