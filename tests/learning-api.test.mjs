import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { EMPTY } from '../lib/learning.ts';

mkdirSync('work/learning-api-tests', { recursive: true });
await build({ entryPoints: ['lib/learning-api.ts'], outfile: 'work/learning-api-tests/api.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import('../work/learning-api-tests/api.mjs');
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test('client load/save/restore keep their exact wire contracts and do not mutate state', async () => {
  const calls = [], state = structuredClone(EMPTY), before = structuredClone(state);
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json(init.method ? { revision: 5 } : { revision: 4, state });
  };
  const loaded = await api.loadLearningState();
  assert.equal(loaded.ok, true); assert.equal(loaded.data.revision, 4);
  const delta = { revision: 4, progress: {}, sessions: {} };
  await api.saveLearningState(delta);
  await api.restoreLearningState(state, 4);
  assert.equal(calls[0].init.cache, 'no-store'); assert.equal(calls[0].url, '/api/state');
  assert.equal(calls[1].init.method, 'PUT'); assert.deepEqual(JSON.parse(calls[1].init.body), delta);
  assert.equal(calls[1].init.headers['X-Study-Review-Resume'], '1');
  assert.equal(calls[1].init.headers['X-Study-Server-Clock'], '1');
  assert.equal(calls[2].url, '/api/state/restore'); assert.equal(calls[2].init.headers['X-Study-Revision'], '4');
  const envelope = JSON.parse(calls[2].init.body);
  assert.equal(envelope.format, 'haru-words-v1'); assert.ok(Number.isFinite(Date.parse(envelope.exportedAt)));
  assert.deepEqual(envelope.state, state); assert.deepEqual(state, before);
});

test('HTTP failures remain inspectable and are never automatically retried', async () => {
  for (const status of [401, 409, 426, 429, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: '안내', conflict: status === 409 }, { status }); };
    const result = await api.saveLearningState({ revision: 1, progress: {}, sessions: {} });
    assert.equal(result.ok, false); assert.equal(result.response.status, status);
    assert.equal(result.data.error, '안내'); assert.equal(calls, 1);
  }
});

test('feedback transport sends only study input and forwards caller cancellation', async () => {
  const controller = new AbortController(), reason = new Error('cancelled');
  const input = { sessionId: crypto.randomUUID(), entryId: 'word', sentence: 'My sentence.' };
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(url, '/api/sentence-feedback'); assert.deepEqual(JSON.parse(init.body), input);
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  };
  const pending = api.requestSentenceFeedback(input, controller.signal);
  controller.abort(reason);
  await assert.rejects(pending, e => e === reason); assert.equal(calls, 1);
});
