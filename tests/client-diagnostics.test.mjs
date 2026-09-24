import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';
mkdirSync('work/diagnostic-tests', { recursive: true });
await build({ entryPoints: ['lib/client-diagnostics.ts', 'lib/client-request.ts'], outdir: 'work/diagnostic-tests', bundle: true, splitting: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const diagnostics = await import('../work/diagnostic-tests/client-diagnostics.mjs');
const { requestJson, RequestTimeoutError } = await import('../work/diagnostic-tests/client-request.mjs');
const events = () => JSON.parse(diagnostics.exportClientDiagnostics()).events;
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test('request diagnostics contain only allowed operation, timing and HTTP result, never input or errors', async () => {
  const sensitive = 'PRIVATE_SENTENCE_ACCOUNT_API_KEY';
  globalThis.fetch = async () => Response.json({ error: sensitive }, { status: 503 });
  await requestJson('/api/state', { method: 'PUT', body: JSON.stringify({ sentence: sensitive, token: sensitive }) }, 1000);
  const last = events().slice(-2);
  assert.deepEqual(last.map(e => e.outcome), ['started', 'http_error']);
  assert.equal(last[0].request, last[1].request);
  assert.equal(last[1].status, 503);
  assert.equal(last[1].operation, 'save');
  assert.ok(last[1].durationMs >= 0);
  globalThis.fetch = async () => { throw new Error(sensitive); };
  await assert.rejects(requestJson('/api/study-clock', {}, 1000));
  assert.equal(events().at(-1).outcome, 'network_error');
  diagnostics.recordAvailability('lesson', { answerPresent: true, hinted: false, answer: sensitive, account: sensitive }, sensitive);
  const state = events().at(-1);
  assert.deepEqual(state.gates, { answerPresent: true, hinted: false });
  assert.equal(state.stage, undefined);
  assert.ok(!diagnostics.exportClientDiagnostics().includes(sensitive));
});

test('unknown URLs are omitted and repeated availability snapshots do not grow the journal', () => {
  const count = events().length;
  diagnostics.beginRequestDiagnostic('https://private.example/secret?key=PRIVATE')('network_error');
  assert.equal(events().length, count);
  diagnostics.recordAvailability('app', { saving: true, clockReady: false });
  const after = events().length;
  diagnostics.recordAvailability('app', { saving: true, clockReady: false });
  assert.equal(events().length, after);
  assert.ok(!diagnostics.exportClientDiagnostics().includes('private.example'));
});

test('timeout and cancellation release the request and record one distinct terminal outcome', async () => {
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  await assert.rejects(requestJson('/api/state', {}, 5), RequestTimeoutError);
  assert.equal(events().at(-1).outcome, 'timeout');
  const controller = new AbortController();
  const request = requestJson('/api/study-clock', { signal: controller.signal }, 1000);
  controller.abort(); await assert.rejects(request);
  assert.equal(events().at(-1).outcome, 'cancelled');
  const finish = diagnostics.beginRequestDiagnostic('/api/state');
  finish('success', 200); const count = events().length; finish('http_error', 503);
  assert.equal(events().length, count);
});

test('the in-memory journal stays bounded after many requests', () => {
  for (let i = 0; i < 150; i++) diagnostics.beginRequestDiagnostic('/api/state')('success', 200);
  assert.equal(events().length, diagnostics.DIAGNOSTIC_EVENT_LIMIT);
  const exportData = JSON.parse(diagnostics.exportClientDiagnostics());
  assert.equal(exportData.format, 'haru-diagnostics-v1');
  assert.ok(Number.isFinite(Date.parse(exportData.exportedAt)));
});
test('navigation diagnostics contain only the failure category and timestamp', () => {
  diagnostics.recordNavigationDiagnostic('guard_error');
  const event = events().at(-1);
  assert.deepEqual(Object.keys(event).sort(), ['at', 'outcome', 'type']);
  assert.equal(event.type, 'navigation'); assert.equal(event.outcome, 'guard_error');
});
