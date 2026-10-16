import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({ entryPoints: ['lib/image-practice-position.ts'], outfile: 'work/image-position-tests/controller.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { ImagePracticePositionController: Controller, positionCacheKey, resolvePracticeEntry, practiceNumber } = await import('../work/image-position-tests/controller.mjs');
const ids = ['a'.repeat(16), 'b'.repeat(16), 'c'.repeat(16), 'd'.repeat(16)];
const pos = (n = 0, revision = 0) => ({ entryId: revision ? ids[n] : null, revision, updatedAt: revision ? '2026-10-17T00:00:00.000Z' : null });
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture(owner = 'synthetic-a', storage = new Map()) {
  const calls = [];
  const controller = new Controller(owner, () => ({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }), (method, user, signal, body) => new Promise((resolve, reject) => calls.push({ method, user, signal, body, resolve, reject })));
  return { controller, calls, storage, view: () => controller.getSnapshot() };
}
async function opened(f = fixture(), position = pos()) { f.controller.open(); f.calls[0].resolve(position); await tick(); return f; }

test('no startup work; opening reads only, cache is account scoped, fallback never writes', async () => {
  const f = fixture(); assert.equal(f.calls.length, 0); assert.equal(f.storage.size, 0);
  await opened(f); assert.equal(f.view().available, true); assert.deepEqual(f.calls.map(c => c.method), ['GET']);
  assert.equal(f.view().entryId, null);
  assert.deepEqual(resolvePracticeEntry(ids[1], ids, [ids[0], ids[2]]), { entryId: ids[2], fallback: true });
  assert.deepEqual(resolvePracticeEntry(ids[3], ids, [ids[0], ids[2]]), { entryId: ids[0], fallback: true });
  assert.deepEqual(resolvePracticeEntry('f'.repeat(16), ids, [ids[2]]), { entryId: ids[2], fallback: true });
  assert.deepEqual(resolvePracticeEntry(ids[0], ids, []), { entryId: null, fallback: true });
  for (const bad of ['', '0', '-1', '1.5', '1e2', '+2', '99999999999999999999', '4']) assert.equal(practiceNumber(bad, 3), null);
  assert.equal(practiceNumber(' 3 ', 3), 2);
});
test('rapid moves coalesce to newest; old receipt cannot mark newer position saved; closing subscribers does not stop save', async () => {
  const f = await opened(); const off = f.controller.subscribe(() => {});
  f.controller.move(ids[1]); f.controller.move(ids[2]); f.controller.move(ids[3]); off();
  assert.equal(f.calls.length, 2); assert.equal(f.view().entryId, ids[3]);
  f.calls[1].resolve(pos(1, 1)); await tick();
  assert.equal(f.view().status, 'saving'); assert.equal(f.calls.length, 3);
  assert.deepEqual(f.calls[2].body, { entryId: ids[3], revision: 1 });
  f.calls[2].resolve(pos(3, 2)); await tick(); assert.equal(f.view().status, 'saved');
  assert.equal(JSON.parse(f.storage.get(positionCacheKey('synthetic-a'))).pending, false);
});
test('failed initial GET cannot write; cached draft waits for server and first uncached failure stays unavailable', async () => {
  const f = fixture(); f.controller.open(); f.calls[0].reject(new Error()); await tick();
  f.controller.move(ids[1]); assert.equal(f.calls.length, 1); assert.equal(f.view().available, false);
  f.controller.retry(); assert.equal(f.calls[1].method, 'GET'); f.calls[1].resolve(pos()); await tick();
  f.controller.move(ids[1]); f.calls[2].reject(new Error('network')); await tick();
  const next = fixture('synthetic-a', f.storage); next.controller.open(); next.calls[0].reject(new Error()); await tick();
  assert.equal(next.view().entryId, ids[1]); next.controller.move(ids[2]); assert.equal(next.calls.length, 1);
  next.controller.retry(); next.calls[1].resolve(pos()); await tick();
  assert.deepEqual(next.calls[2].body, { entryId: ids[2], revision: 0 });
  next.calls[2].resolve(pos(2, 1)); await tick();
});
test('lost write response is reconciled before retry and latest draft uses acknowledged revision', async () => {
  const f = await opened(); f.controller.move(ids[1]); f.controller.move(ids[2]);
  f.calls[1].reject(new Error('timeout')); await tick(); assert.equal(f.calls.length, 2);
  f.controller.retry(); assert.equal(f.calls[2].method, 'GET'); f.calls[2].resolve(pos(1, 1)); await tick();
  assert.deepEqual(f.calls[3].body, { entryId: ids[2], revision: 1 }); f.calls[3].resolve(pos(2, 2)); await tick();
  assert.equal(f.view().status, 'saved');
});
test('conflict requires choice; current choice rechecks and another intervening device still conflicts', async () => {
  const f = await opened(); f.controller.move(ids[1]); f.calls[1].reject(new Error()); await tick();
  f.controller.retry(); f.calls[2].resolve(pos(2, 1)); await tick(); assert.equal(f.view().status, 'conflict');
  f.controller.keepCurrent(); assert.equal(f.calls[3].method, 'GET'); f.calls[3].resolve(pos(3, 2)); await tick();
  assert.equal(f.view().status, 'conflict'); assert.equal(f.calls.length, 4);
  f.controller.keepCurrent(); f.calls[4].resolve(pos(3, 2)); await tick();
  assert.deepEqual(f.calls[5].body, { entryId: ids[1], revision: 2 }); f.calls[5].resolve(pos(1, 3)); await tick();
  assert.equal(f.view().status, 'saved');
});
test('remote choice reads latest without write; later navigation during lookup is preserved', async () => {
  const f = await opened(); f.controller.move(ids[1]); f.calls[1].reject(new Error()); await tick();
  f.controller.retry(); f.calls[2].resolve(pos(2, 1)); await tick();
  f.controller.useRemote(); f.controller.move(ids[3]); f.calls[3].resolve(pos(2, 1)); await tick();
  assert.equal(f.view().entryId, ids[3]); assert.equal(f.view().status, 'conflict');
  f.controller.useRemote(); f.calls[4].resolve(pos(2, 1)); await tick();
  assert.equal(f.view().entryId, ids[2]); assert.equal(f.view().pending, false); assert.equal(f.calls.length, 5);
});
test('current conflict choice saves the displayed fallback and preserves later navigation during its recheck', async () => {
  for (const navigateDuringRead of [false, true]) {
    const cache = new Map([[positionCacheKey('synthetic-a'), JSON.stringify({ version: 1, entryId: ids[0], revision: 0, pending: true, sent: null })]]);
    const f = await opened(fixture('synthetic-a', cache), pos(2, 1));
    assert.equal(f.view().status, 'conflict');
    const displayed = resolvePracticeEntry(f.view().entryId, ids, [ids[1], ids[2], ids[3]]).entryId;
    assert.equal(displayed, ids[1]); assert.equal(f.calls.length, 1, 'displaying fallback never writes');
    f.controller.keepCurrent(displayed);
    assert.equal(f.calls[1].method, 'GET', 'explicit choice still rechecks the latest revision');
    if (navigateDuringRead) f.controller.move(ids[3]);
    f.calls[1].resolve(pos(2, 1)); await tick();
    const expected = navigateDuringRead ? ids[3] : displayed;
    assert.deepEqual(f.calls[2].body, { entryId: expected, revision: 1 });
    f.calls[2].resolve({ ...pos(1, 2), entryId: expected }); await tick();
    assert.equal(f.view().entryId, expected); assert.equal(f.view().status, 'saved');
  }
});
test('account disposal aborts queued work and ignores late responses; a new account never sees old cache', async () => {
  const a = await opened(); a.controller.move(ids[1]); a.controller.move(ids[2]); a.controller.stop();
  const b = await opened(fixture('synthetic-b', a.storage));
  a.calls[1].resolve(pos(1, 1)); await tick();
  assert.equal(a.calls[1].signal.aborted, true); assert.equal(a.calls.length, 2);
  assert.equal(b.view().entryId, null); assert.equal(b.calls.length, 1);
  const restored = fixture('synthetic-a', a.storage); restored.controller.open(); restored.calls[0].resolve(pos(1, 1)); await tick();
  assert.deepEqual(restored.calls[1].body, { entryId: ids[2], revision: 1 }); restored.calls[1].resolve(pos(2, 2)); await tick();
});
test('strict lifecycle restart ignores an aborted old request', async () => {
  const f = fixture(); f.controller.open(); f.controller.stop(); f.controller.start(); f.controller.open();
  f.calls[0].resolve(pos(3, 5)); await tick(); assert.equal(f.view().available, false);
  f.calls[1].resolve(pos(1, 1)); await tick(); assert.equal(f.view().entryId, ids[1]);
});
test('malformed or inaccessible browser storage falls back to memory without unverified writes', async () => {
  for (const raw of ['{', '{}', JSON.stringify({ version: 1, entryId: ids[0], revision: -1, pending: true, sent: null })]) {
    const f = await opened(fixture('synthetic-a', new Map([[positionCacheKey('synthetic-a'), raw]])));
    assert.equal(f.view().storageWarning, true); assert.equal(f.view().entryId, null); assert.equal(f.calls.length, 1);
  }
  const c = new Controller('synthetic', () => { throw new Error('blocked'); }, async (method, owner, signal, body) => method === 'GET' ? pos() : { ...pos(1, 1), entryId: body.entryId });
  c.open(); await tick(); c.move(ids[1]); await tick();
  assert.equal(c.getSnapshot().status, 'saved'); assert.equal(c.getSnapshot().storageWarning, true);
});
test('HTTP auth, conflict, invalid response and actual timeout path never trigger a blind second PUT', async () => {
  const original = globalThis.fetch;
  let server = pos(), writes = 0, mode = 'ok';
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers['x-image-practice-owner'], 'synthetic');
    if (init.method === 'GET') return Response.json(server);
    writes++;
    if (writes > 1) return Response.json({}, { status: 503 });
    if (mode === 'auth') return Response.json({}, { status: 401 });
    if (mode === 'conflict' || mode === 'stale') return Response.json({}, { status: 409 });
    if (mode === 'bad') return Response.json({ revision: 2 });
    if (mode === 'timeout') return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }));
    server = { ...pos(1, server.revision + 1), entryId: JSON.parse(init.body).entryId }; return Response.json(server);
  };
  try {
    for (const scenario of ['auth', 'conflict', 'stale', 'bad', 'timeout']) {
      mode = scenario; server = pos(); writes = 0;
      const cache = new Map(), storage = () => ({ getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) });
      const c = new Controller('synthetic', storage); c.open(); await tick();
      const originalTimer = globalThis.setTimeout;
      if (mode === 'timeout') globalThis.setTimeout = fn => originalTimer(fn, 1);
      c.move(ids[1]); globalThis.setTimeout = originalTimer;
      if (mode === 'conflict') server = pos(2, 1);
      await new Promise(resolve => originalTimer(resolve, 15));
      assert.equal(writes, 1, scenario);
      assert.equal(c.getSnapshot().status, scenario === 'auth' ? 'auth' : ['conflict', 'stale'].includes(scenario) ? 'conflict' : 'error');
      c.stop();
      if (mode === 'stale') {
        const reopened = new Controller('synthetic', storage); reopened.open(); await tick();
        assert.equal(reopened.getSnapshot().status, 'conflict'); assert.equal(writes, 1, 'cached conflict still requires a choice after reload'); reopened.stop();
      }
    }
  } finally { globalThis.fetch = original; }
});
