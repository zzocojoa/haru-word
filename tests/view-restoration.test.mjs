import test from 'node:test';
import assert from 'node:assert/strict';
import { ViewRestoration } from '../lib/view-restoration.ts';

function setup() {
  let id = 0;
  const callbacks = new Map(), applied = [];
  const restoration = new ViewRestoration({
    request: callback => { callbacks.set(++id, callback); return id; },
    cancel: key => callbacks.delete(key),
  });
  const frame = () => { const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(fn => fn()); };
  return { restoration, applied, frame, callbacks, schedule: kind => restoration.schedule(kind, () => applied.push(kind)) };
}

test('explicit destination wins over history in either registration order', () => {
  for (const order of [['history', 'destination'], ['destination', 'history']]) {
    const s = setup(); order.forEach(s.schedule); s.frame(); assert.deepEqual(s.applied, []); s.frame();
    assert.deepEqual(s.applied, ['destination']); assert.equal(s.callbacks.size, 0);
  }
});
test('history restores saved position instead of a generic view default', () => {
  for (const order of [['view', 'history'], ['history', 'view']]) {
    const s = setup(); order.forEach(s.schedule); s.frame(); s.frame(); assert.deepEqual(s.applied, ['history']);
  }
});
test('latest equal-priority request wins and old owner cleanup cannot cancel it', () => {
  const s = setup(); const cancelOld = s.restoration.schedule('view', () => s.applied.push('old'));
  s.restoration.schedule('view', () => s.applied.push('new')); cancelOld(); s.frame(); s.frame();
  assert.deepEqual(s.applied, ['new']);
});
test('unmount or new navigation cancels either frame', () => {
  for (const afterFirstFrame of [false, true]) {
    const s = setup(), cancel = s.schedule('destination'); if (afterFirstFrame) s.frame();
    cancel(); s.frame(); s.frame(); assert.deepEqual(s.applied, []); assert.equal(s.callbacks.size, 0);
    s.schedule('history'); s.restoration.cancel(); s.frame(); s.frame(); assert.deepEqual(s.applied, []);
  }
});
test('late cancelled callbacks cannot create a frame or overwrite a newer destination', () => {
  const s = setup(); s.schedule('view'); const late = [...s.callbacks.values()][0];
  s.restoration.cancel(); s.schedule('destination'); late(); assert.equal(s.callbacks.size, 1);
  s.frame(); s.frame(); assert.deepEqual(s.applied, ['destination']);
});
test('completed request does not block later lower-priority navigation', () => {
  const s = setup(); s.schedule('destination'); s.frame(); s.frame();
  s.schedule('view'); s.frame(); s.frame(); assert.deepEqual(s.applied, ['destination', 'view']);
});
