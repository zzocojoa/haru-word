import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationHistory } from '../lib/navigation-history.ts';
import { completesSwipe, swipeDirection } from '../lib/swipe-back.ts';
const tick = () => new Promise(resolve => queueMicrotask(resolve));
function setup() {
  const n = new NavigationHistory(), restored = [], reports = [];
  n.read('app.tab', 'today'); n.read('app.settings', false); n.read('library.lesson', null);
  n.read('library.view', 'words'); n.read('app.session', null);
  n.start({ capture: () => ({ top: 240 }), restore: p => restored.push(p), report: x => reports.push(x) });
  return { n, restored, reports };
}
test('main tab visits never create a Back path', async () => {
  const { n } = setup();
  for (const tab of ['library', 'review', 'log', 'today', 'library']) {
    n.change('app.tab', tab); await tick();
    assert.equal(n.canBack(), false); assert.equal(await n.back(), false);
    assert.equal(n.read('app.tab', ''), tab);
  }
});
test('each tab retains only its own internal path; other live views are not rewound', async () => {
  const { n, restored } = setup();
  n.change('app.tab', 'library'); await tick();
  n.change('library.view', 'grammar'); await tick(); n.change('library.lesson', 'noun'); await tick();
  n.change('app.tab', 'today'); await tick(); n.change('app.session', 'daily'); await tick();
  assert.equal(await n.back(), true); assert.equal(n.read('app.session', ''), null);
  assert.equal(n.canBack(), false); assert.equal(n.read('library.lesson', ''), 'noun');
  n.change('app.tab', 'library'); await tick();
  await n.back(); assert.equal(n.read('library.lesson', ''), null); assert.equal(n.read('library.view', ''), 'grammar');
  await n.back(); assert.equal(n.read('library.view', ''), 'words'); assert.equal(n.canBack(), false);
  assert.equal(n.read('app.tab', ''), 'library'); assert.equal(n.read('app.session', ''), null);
  assert.deepEqual(restored, [{ top: 240 }, { top: 240 }, { top: 240 }]);
});
test('Close buttons and multi-key return to words consume the same entries', async () => {
  const { n } = setup();
  n.change('app.tab', 'library'); await tick();
  n.change('app.settings', true); await tick(); n.change('app.settings', false); await tick();
  assert.equal(n.canBack(), false);
  n.change('library.view', 'grammar'); await tick(); n.change('library.lesson', 'noun'); await tick();
  n.change('library.lesson', null); n.change('library.view', 'words'); await tick();
  assert.equal(n.canBack(), false);
});
test('closing settings then asynchronously opening familiarity retains a Back path', async () => {
  const { n } = setup();
  n.read('app.assessing', false);
  n.change('app.settings', true); await tick(); n.change('app.settings', false); await tick();
  n.change('app.assessing', true); await tick(); await n.back();
  assert.equal(n.read('app.assessing', true), false); assert.equal(n.read('app.settings', true), false);
  assert.equal(n.canBack(), false);
});
test('cross-tab study commands do not resurrect the source dialog on Today', async () => {
  const { n } = setup(); n.read('app.reviewDate', null);
  n.change('app.tab', 'log'); await tick(); n.change('app.reviewDate', '2026-09-24'); await tick();
  n.change('app.reviewDate', null); n.change('app.session', 'repeat'); n.change('app.tab', 'today'); await tick();
  await n.back();
  assert.equal(n.read('app.tab', ''), 'today'); assert.equal(n.read('app.session', ''), null); assert.equal(n.read('app.reviewDate', ''), null);
  n.change('app.tab', 'log'); await tick(); assert.equal(n.canBack(), false);
});
test('failed saves and thrown guards leave the view and its Back path intact', async () => {
  const { n, reports } = setup(); n.change('library.lesson', 'noun'); await tick();
  const remove = n.guard(() => false);
  assert.equal(await n.back(), false); assert.equal(n.read('library.lesson', ''), 'noun');
  remove(); const removeError = n.guard(() => { throw Error('private draft'); });
  assert.equal(await n.back(), false); assert.deepEqual(reports, ['blocked', 'guard_error', 'blocked']);
  removeError(); assert.equal(await n.back(), true);
});
test('rapid gestures and new view actions cannot race a pending leave decision', async () => {
  const { n } = setup(); n.change('library.lesson', 'noun'); await tick();
  let release; n.guard(() => new Promise(resolve => release = resolve));
  const first = n.back(); assert.equal(await n.back(), false);
  n.change('app.tab', 'log'); n.change('library.lesson', 'verb'); release(true); await first;
  assert.equal(n.read('app.tab', ''), 'today'); assert.equal(n.read('library.lesson', ''), null);
});
test('epoch reset invalidates pending responses and paths in every tab', async () => {
  const { n } = setup();
  n.change('library.lesson', 'noun'); await tick();
  let release; n.guard(() => new Promise(resolve => release = resolve));
  const pending = n.back(); n.reset(['app.tab']); release(true);
  assert.equal(await pending, false); assert.equal(n.canBack(), false); assert.equal(n.read('library.lesson', ''), null);
});
test('fresh destructive confirmation does not restore prior consent', async () => {
  const { n } = setup(); n.read('confirm', false);
  n.change('confirm', true); await tick(); n.fresh('confirm', false);
  assert.equal(n.canBack(), false); assert.equal(n.read('confirm', true), false);
});
test('account refresh keeps preserved tools dismissible but discards record history', async () => {
  const { n } = setup();
  n.change('app.tab', 'library'); await tick();
  n.change('library.lesson', 'noun'); await tick();
  n.change('app.settings', true); await tick();
  n.reset(['app.tab', 'app.settings']);
  assert.equal(n.read('library.lesson', ''), null);
  assert.equal(n.canBack(), true); await n.back();
  assert.equal(n.read('app.settings', true), false);
  assert.equal(n.read('app.tab', ''), 'library'); assert.equal(n.canBack(), false);
});
test('a swipe requires horizontal intent and sufficient distance', () => {
  assert.equal(swipeDirection(3, 4), 'pending');
  assert.equal(swipeDirection(-100, 0), 'cancel'); assert.equal(swipeDirection(30, 90), 'cancel');
  assert.equal(completesSwipe(40, 0, 390), false);
  assert.equal(completesSwipe(100, 8, 390), true);
  assert.equal(completesSwipe(150, 120, 390), false);
  assert.equal(completesSwipe(120, 0, 1440), true);
});
