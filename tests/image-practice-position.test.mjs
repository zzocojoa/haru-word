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
test('all short navigation and receipt schedules save the latest card with one request at a time', async () => {
  // Include repeated cards and A -> B -> A while earlier saves are unresolved.
  for (let sequence = 0; sequence < 81; sequence++) for (let timing = 0; timing < 8; timing++) {
    const f = await opened(); let nextReceipt = 1, remote = pos();
    const settle = async () => {
      while (nextReceipt < f.calls.length) {
        assert.equal(f.calls.length - nextReceipt, 1, 'only one write may be in flight');
        const call = f.calls[nextReceipt++];
        assert.equal(call.method, 'PUT'); assert.equal(call.body.revision, remote.revision);
        remote = { entryId: call.body.entryId, revision: remote.revision + 1, updatedAt: '2026-10-17T00:00:00.000Z' };
        call.resolve(remote); await tick();
        if (f.view().status === 'saved') assert.equal(f.view().entryId, remote.entryId);
      }
    };
    let last;
    for (let step = 0; step < 4; step++) {
      last = ids[Math.floor(sequence / 3 ** step) % 3]; f.controller.move(last);
      assert.equal(f.view().entryId, last, 'navigation never waits for a receipt');
      assert.equal(f.calls.length - nextReceipt, 1);
      if (timing & (1 << step)) await settle();
    }
    await settle();
    assert.equal(remote.entryId, last); assert.equal(f.view().status, 'saved');
    const cache = JSON.parse(f.storage.get(positionCacheKey('synthetic-a')));
    assert.equal(cache.entryId, last); assert.equal(cache.pending, false);
  }
});
test('lost response with a later draft requires a choice before using the observed revision', async () => {
  const f = await opened(); f.controller.move(ids[1]); f.controller.move(ids[2]);
  f.calls[1].reject(new Error('timeout')); await tick(); assert.equal(f.calls.length, 2);
  f.controller.retry(); assert.equal(f.calls[2].method, 'GET'); f.calls[2].resolve(pos(1, 1)); await tick();
  assert.equal(f.view().status, 'conflict'); assert.equal(f.calls.length, 3);
  f.controller.keepCurrent(); f.calls[3].resolve(pos(1, 1)); await tick();
  assert.deepEqual(f.calls[4].body, { entryId: ids[2], revision: 1 }); f.calls[4].resolve(pos(2, 2)); await tick();
  assert.equal(f.view().status, 'saved');
});
test('retry and reopen cannot attribute another tab or device same-card save to a failed write', async () => {
  for (const shared of [false, true]) for (const action of ['retry', 'open']) {
    const storage = new Map(), a = await opened(fixture('synthetic-a', storage), pos(0, 1));
    const b = await opened(fixture('synthetic-a', shared ? storage : new Map()), pos(0, 1));
    a.controller.move(ids[1]); a.controller.move(ids[2]);
    b.controller.move(ids[1]); b.calls[1].resolve(pos(1, 2)); await tick();
    a.calls[1].reject(new Error('not delivered')); await tick();
    const before = storage.get(positionCacheKey('synthetic-a'));
    a.controller[action](); a.calls[2].resolve(pos(1, 2)); await tick();
    assert.equal(a.calls.length, 3, 'GET only before an explicit choice');
    assert.equal(a.view().status, 'conflict'); assert.equal(a.view().entryId, ids[2]);
    if (shared) assert.equal(storage.get(positionCacheKey('synthetic-a')), before);
    a.controller.useRemote(); a.calls[3].resolve(pos(1, 2)); await tick();
    assert.equal(a.view().entryId, ids[1]); assert.equal(a.view().pending, false);
    assert.equal(a.calls.length, 4); a.controller.stop(); b.controller.stop();
  }
});
test('lost receipt already at the final target recovers with GET only', async () => {
  const f = await opened(); f.controller.move(ids[1]);
  f.calls[1].reject(new Error('lost response')); await tick();
  f.controller.retry(); f.calls[2].resolve(pos(1, 1)); await tick();
  assert.equal(f.calls.length, 3); assert.equal(f.view().status, 'saved');
  assert.equal(f.view().pending, false); assert.equal(f.view().entryId, ids[1]);
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
  assert.equal(restored.view().status, 'conflict'); assert.equal(restored.calls.length, 1);
  restored.controller.keepCurrent(); restored.calls[1].resolve(pos(1, 1)); await tick();
  assert.deepEqual(restored.calls[2].body, { entryId: ids[2], revision: 1 }); restored.calls[2].resolve(pos(2, 2)); await tick();
});
test('explicit remote choice replaces an earlier other-tab draft and reload never replays it', async () => {
  const storage = new Map(), a = await opened(fixture('synthetic-a', storage), pos(0, 1));
  const b = await opened(fixture('synthetic-a', storage), pos(0, 1));
  a.controller.move(ids[1]); a.calls[1].reject(new Error('offline')); await tick();
  b.controller.open(); b.calls[1].resolve(pos(3, 2)); await tick();
  b.controller.move(ids[2]); b.calls[2].reject(new Error('offline')); await tick();
  a.controller.retry(); a.calls[2].resolve(pos(3, 2)); await tick();
  a.controller.useRemote(); a.calls[3].resolve(pos(3, 2)); await tick();
  assert.equal(a.view().status, 'saved');
  const cache = JSON.parse(storage.get(positionCacheKey('synthetic-a')));
  assert.equal(cache.entryId, ids[3]); assert.equal(cache.pending, false);
  a.controller.stop(); b.controller.stop();
  const reopened = await opened(fixture('synthetic-a', storage), pos(3, 2));
  assert.equal(reopened.calls.length, 1, 'confirmed remote choice cannot leave an auto-replayed draft');
  assert.equal(reopened.view().entryId, ids[3]); reopened.controller.stop();
});
test('remote choice preserves other-tab navigation after its GET starts and failure preserves the earlier draft', async () => {
  for (const outcome of ['later-move', 'failed-get', 'stopped']) {
    const storage = new Map(), a = await opened(fixture('synthetic-a', storage), pos(0, 1));
    const b = await opened(fixture('synthetic-a', storage), pos(0, 1));
    a.controller.move(ids[1]); a.calls[1].reject(new Error('offline')); await tick();
    a.controller.retry(); a.calls[2].resolve(pos(3, 2)); await tick();
    b.controller.move(ids[2]); b.calls[1].reject(new Error('offline')); await tick();
    a.controller.useRemote();
    if (outcome === 'later-move') b.controller.move(ids[0]);
    const draft = storage.get(positionCacheKey('synthetic-a'));
    if (outcome === 'stopped') a.controller.stop();
    if (outcome === 'failed-get') a.calls[3].reject(new Error('offline'));
    else a.calls[3].resolve(pos(3, 2));
    await tick(); assert.equal(storage.get(positionCacheKey('synthetic-a')), draft, outcome);
    assert.equal(a.calls.length, 4); a.controller.stop(); b.controller.stop();
  }
});
test('another tab reading or completing older work cannot erase the latest unsaved recovery cursor', async () => {
  for (const action of ['read', 'receipt', 'failure']) {
    const storage = new Map(), oldTab = await opened(fixture('synthetic-a', storage));
    const activeTab = await opened(fixture('synthetic-a', storage));
    if (action !== 'read') oldTab.controller.move(ids[1]);
    activeTab.controller.move(ids[2]); activeTab.calls[1].reject(new Error('offline')); await tick();
    const pending = storage.get(positionCacheKey('synthetic-a'));
    if (action === 'read') { oldTab.controller.open(); oldTab.calls[1].resolve(pos()); }
    else if (action === 'receipt') oldTab.calls[1].resolve(pos(1, 1));
    else oldTab.calls[1].reject(new Error('late failure'));
    await tick();
    assert.equal(storage.get(positionCacheKey('synthetic-a')), pending, `${action} must preserve the other tab's pending recovery`);
    activeTab.controller.stop(); oldTab.controller.stop();
    const reopened = fixture('synthetic-a', storage); reopened.controller.open();
    assert.equal(reopened.view().entryId, ids[2]);
    reopened.calls[0].resolve(action === 'receipt' ? pos(1, 1) : pos()); await tick();
    if (action === 'receipt') assert.equal(reopened.view().status, 'conflict');
    else { assert.deepEqual(reopened.calls[1].body, { entryId: ids[2], revision: 0 }); reopened.calls[1].resolve(pos(2, 1)); await tick(); }
    reopened.controller.stop();
  }
});
test('remote choice preserves later other-tab C-to-B-to-C navigation across reload', async () => {
  const storage = new Map();
  const a = await opened(fixture('synthetic-a', storage), pos(0, 1));
  const b = await opened(fixture('synthetic-a', storage), pos(0, 1));
  let reloaded;
  try {
    a.controller.move(ids[1]); a.calls[1].reject(new Error('offline')); await tick();
    a.controller.retry(); a.calls[2].resolve(pos(3, 2)); await tick();
    assert.equal(a.view().status, 'conflict');
    b.controller.move(ids[2]); b.calls[1].reject(new Error('offline')); await tick();
    a.controller.useRemote();
    b.controller.move(ids[1]); b.controller.move(ids[2]);
    assert.equal(b.calls.length, 2, 'failed writer never blindly retries during navigation');
    const draft = storage.get(positionCacheKey('synthetic-a'));
    a.calls[3].resolve(pos(3, 2)); await tick();
    assert.equal(a.view().entryId, ids[3]); assert.equal(a.view().status, 'saved');
    assert.equal(storage.get(positionCacheKey('synthetic-a')), draft, 'later C draft survives the earlier remote choice');
    const cached = JSON.parse(draft);
    assert.equal(cached.entryId, ids[2]); assert.equal(cached.pending, true);
    a.controller.stop(); b.controller.stop();
    reloaded = await opened(fixture('synthetic-a', storage), pos(3, 2));
    assert.equal(reloaded.view().entryId, ids[2]); assert.equal(reloaded.view().status, 'conflict');
    assert.deepEqual(reloaded.calls.map(call => call.method), ['GET']);
  } finally { a.controller.stop(); b.controller.stop(); reloaded?.controller.stop(); }
});
test('version1 cache with or without navigation identity survives reads and save receipts', async () => {
  for (const navigationId of [undefined, 'a8a7b674-7539-46a5-99b6-0691196b348c']) {
    const key = positionCacheKey('synthetic-a');
    const storage = new Map([[key, JSON.stringify({ version: 1, entryId: ids[0], revision: 1, pending: false, sent: null, needsChoice: false, navigationId })]]);
    const f = await opened(fixture('synthetic-a', storage), pos(0, 1));
    try {
      assert.equal(f.view().storageWarning, false); assert.equal(f.view().entryId, ids[0]);
      assert.equal(JSON.parse(storage.get(key)).navigationId, navigationId);
      f.controller.move(ids[2]);
      const selected = JSON.parse(storage.get(key));
      assert.equal(typeof selected.navigationId, 'string');
      assert.notEqual(selected.navigationId, navigationId);
      f.calls[1].resolve(pos(2, 2)); await tick();
      const saved = JSON.parse(storage.get(key));
      assert.equal(saved.navigationId, selected.navigationId); assert.equal(saved.pending, false);
    } finally { f.controller.stop(); }
  }
});
test('new explicit navigation may replace a previous tab draft and its own receipt clears the cache', async () => {
  const storage = new Map(), a = await opened(fixture('synthetic-a', storage)), b = await opened(fixture('synthetic-a', storage));
  a.controller.move(ids[1]); a.calls[1].reject(new Error('offline')); await tick();
  b.controller.open(); b.calls[1].resolve(pos()); await tick();
  b.controller.move(ids[3]);
  assert.equal(JSON.parse(storage.get(positionCacheKey('synthetic-a'))).entryId, ids[3]);
  b.calls[2].resolve(pos(3, 1)); await tick();
  assert.equal(JSON.parse(storage.get(positionCacheKey('synthetic-a'))).pending, false);
});
test('late failure cannot resurrect an older draft over another tab saved choice and replay it after reload', async () => {
  const storage = new Map(), a = await opened(fixture('synthetic-a', storage), pos(0, 1));
  const b = await opened(fixture('synthetic-a', storage), pos(0, 1));
  a.controller.move(ids[1]); a.controller.move(ids[2]);
  b.controller.move(ids[1]); b.calls[1].resolve(pos(1, 2)); await tick();
  const saved = storage.get(positionCacheKey('synthetic-a'));
  assert.equal(JSON.parse(saved).pending, false);
  a.calls[1].reject(new Error('late network failure before server')); await tick();
  assert.equal(storage.get(positionCacheKey('synthetic-a')), saved, 'newer saved choice must not become an old draft');
  a.controller.stop(); b.controller.stop();
  const reopened = fixture('synthetic-a', storage); reopened.controller.open();
  reopened.calls[0].resolve(pos(1, 2)); await tick();
  assert.equal(reopened.calls.length, 1, 'another tab save is not a receipt for the old failed write');
  assert.equal(reopened.view().entryId, ids[1]); assert.equal(reopened.view().status, 'saved');
  reopened.controller.stop();
});
test('strict lifecycle restart ignores an aborted old request', async () => {
  const f = fixture(); f.controller.open(); f.controller.stop(); f.controller.start(); f.controller.open();
  f.calls[0].resolve(pos(3, 5)); await tick(); assert.equal(f.view().available, false);
  f.calls[1].resolve(pos(1, 1)); await tick(); assert.equal(f.view().entryId, ids[1]);
});
test('malformed or inaccessible browser storage falls back to memory without unverified writes', async () => {
  for (const raw of ['{', '{}', JSON.stringify({ version: 1, entryId: ids[0], revision: -1, pending: true, sent: null }),
    ...[7, 'invalid'].map(navigationId => JSON.stringify({ version: 1, entryId: ids[0], revision: 1, pending: true, sent: null, navigationId }))]) {
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
