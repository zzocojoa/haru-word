import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationHistory } from '../lib/navigation-history.ts';

const tick = () => new Promise(resolve => queueMicrotask(resolve));
function setup() {
  const navigation = new NavigationHistory(), stack = [{ framework: 'preserved' }], moves = [], restored = [];
  let cursor = 0;
  navigation.read('tab', 'today'); navigation.read('dialog', false); navigation.read('lesson', null);
  navigation.start({ state: () => stack[cursor], replace: value => stack[cursor] = value,
    push: value => { stack.splice(++cursor); stack.push(value); }, go: delta => moves.push(delta),
    capture: () => ({ top: cursor * 100 }), restore: value => restored.push(value),
  }, 'test-session');
  const pop = async index => { cursor = index; await navigation.pop(stack[cursor]); };
  return { navigation, stack, moves, restored, pop };
}

test('groups one navigation action, stores opaque markers only and preserves framework state', async () => {
  const { navigation: n, stack } = setup();
  n.change('tab', 'library'); n.change('lesson', 'noun'); await tick();
  assert.equal(stack.length, 2);
  assert.deepEqual(stack[1], { framework: 'preserved', haruNavigation: { scope: 'test-session', index: 1 } });
  n.change('lesson', 'noun'); await tick(); assert.equal(stack.length, 2);
});
test('native Back/Forward restores screens, while a Close button consumes its entry', async () => {
  const { navigation: n, stack, moves, pop } = setup();
  n.change('tab', 'library'); await tick(); n.change('dialog', true); await tick();
  await pop(1); assert.equal(n.read('dialog', false), false);
  await pop(2); assert.equal(n.read('dialog', false), true);
  n.change('dialog', false); await tick(); assert.deepEqual(moves, [-1]); await pop(1);
  await pop(0); assert.equal(n.read('tab', ''), 'today'); assert.equal(stack.length, 3);
});
test('choosing a previously visited tab creates a new visit rather than consuming earlier history', async () => {
  const { navigation: n, stack, moves, pop } = setup();
  n.change('tab', 'library'); await tick(); n.change('tab', 'review'); await tick();
  n.change('tab', 'library'); await tick();
  assert.equal(stack.length, 4); assert.deepEqual(moves, []);
  await pop(2); assert.equal(n.read('tab', ''), 'review');
});
test('an asynchronous lesson opening is not lost while its settings Close traverses history', async () => {
  const { navigation: n, pop } = setup();
  n.change('dialog', true); await tick(); n.change('dialog', false); await tick();
  n.change('lesson', 'noun'); assert.equal(n.read('lesson', null), null);
  await pop(0); await tick(); assert.equal(n.read('lesson', null), 'noun');
});
test('failed save restores the history cursor and leaves current input owner mounted', async () => {
  const { navigation: n, moves, pop } = setup();
  n.change('tab', 'library'); await tick(); n.change('lesson', 'noun'); await tick();
  let allowed = false;
  n.guard(changed => !changed.has('lesson') || allowed);
  await pop(1); assert.equal(n.read('lesson', null), 'noun'); assert.deepEqual(moves, [1]);
  await pop(2); allowed = true; await pop(1); assert.equal(n.read('lesson', null), null);
});
test('rapid Back coalesces and reruns guards for the complete target; other actions cannot race a save', async () => {
  const { navigation: n, pop } = setup();
  n.change('tab', 'library'); await tick(); n.change('lesson', 'noun'); await tick();
  let release; const changes = [];
  n.guard(async changed => { changes.push([...changed]); if (changes.length === 1) await new Promise(resolve => release = resolve); return true; });
  const first = pop(1); await pop(0); n.change('dialog', true); release(); await first;
  assert.equal(n.read('tab', ''), 'today'); assert.equal(n.read('dialog', false), false);
  assert.deepEqual(changes, [['lesson'], ['tab', 'lesson']]);
});
test('a thrown guard fails closed and a new visit after Back discards the old Forward branch', async () => {
  const { navigation: n, stack, moves, pop } = setup();
  n.change('tab', 'library'); await tick(); n.change('lesson', 'noun'); await tick();
  const remove = n.guard(() => { throw new Error('offline'); });
  await pop(1); assert.deepEqual(moves, [1]); await pop(2); remove();
  await pop(1); n.change('lesson', 'verb'); await tick();
  assert.equal(stack.length, 3); assert.equal(n.read('lesson', null), 'verb');
});
test('fresh destructive confirmations are reset on remount; foreign history is never trapped', async () => {
  const { navigation: n, moves } = setup();
  n.read('confirm', false); n.change('confirm', true); await tick();
  assert.equal(n.fresh('confirm', false), false); assert.equal(n.read('confirm', true), false);
  await n.pop(null); await n.pop({ haruNavigation: { scope: 'old-session', index: 1 } });
  assert.deepEqual(moves, []);
});
test('account reload invalidates record views in both Back and Forward history', async () => {
  const { navigation: n, pop } = setup();
  n.change('tab', 'library'); await tick(); n.change('lesson', 'noun'); await tick();
  n.reset(['tab']); assert.equal(n.read('lesson', null), null);
  await pop(1); await pop(2); assert.equal(n.read('lesson', null), null);
  assert.equal(n.read('tab', ''), 'library');
});
