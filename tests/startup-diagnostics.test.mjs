import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { startupDiagnostics } = createRequire(import.meta.url)('./qa/startup-diagnostics.cjs');
const base = 'http://127.0.0.1:8787';
function fixture() {
  const context = new EventEmitter();
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'haru-startup-')), 'case.json');
  const diagnostic = startupDiagnostics(context, { base, file, engine: 'webkit', mode: 'javascript-pending' });
  return { context, file, diagnostic, read: () => JSON.parse(readFileSync(file, 'utf8')) };
}
function request(url) {
  return { url: () => url, headers: () => { throw Error('must not read credentials'); },
    postData: () => { throw Error('must not read learner data'); } };
}

test('failed startup retains the case, released-but-unfinished chunk and completed state request', () => {
  const { context, diagnostic, read } = fixture();
  assert.equal(read().passed, null);
  const chunk = request(base + '/_next/static/chunks/app.js'), state = request(base + '/api/state');
  context.emit('request', chunk); diagnostic.held(chunk); diagnostic.phase('release'); diagnostic.continued(chunk);
  context.emit('request', state); context.emit('response', { request: () => state, status: () => 200 });
  context.emit('requestfinished', state); diagnostic.phase('saved-status'); diagnostic.finish(false, 1);
  const result = read();
  assert.equal(result.passed, false); assert.equal(result.phase, 'saved-status');
  assert.equal(result.pageErrorCount, 1);
  assert.equal(result.engine, 'webkit'); assert.equal(result.mode, 'javascript-pending');
  assert.deepEqual(result.events.filter(e => e.path?.endsWith('app.js')).map(e => e.event), ['request', 'held', 'continued']);
  assert.deepEqual(result.events.filter(e => e.path === '/api/state').map(e => e.event), ['request', 'response', 'finished']);
  assert.equal(new Set(result.events.filter(e => e.path?.endsWith('app.js')).map(e => e.id)).size, 1);
  assert.notEqual(result.events.find(e => e.path === '/api/state').id, result.events[0].id);
  for (const name of ['request', 'response', 'requestfinished', 'requestfailed']) assert.equal(context.listenerCount(name), 0);
});

test('startup diagnostics discard queries, credentials, external URLs and unrelated learner paths', () => {
  const { context, diagnostic, file, read } = fixture();
  for (const url of [base + '/api/state?answer=PRIVATE', base + '/_next/static/chunks/app.js?token=PRIVATE',
    base + '/api/learner/PRIVATE', 'https://PRIVATE.example/api/state']) context.emit('request', request(url));
  diagnostic.finish(false);
  assert.equal(read().events.length, 2);
  assert.ok(!readFileSync(file, 'utf8').includes('PRIVATE'));
});

test('startup diagnostics bound a noisy failure and preserve failed records across later successful cases', () => {
  const first = fixture();
  for (let i = 0; i < 300; i++) first.context.emit('request', request(base + '/api/state'));
  first.diagnostic.finish(false);
  const before = readFileSync(first.file, 'utf8');
  assert.equal(first.read().events.length, 256); assert.equal(first.read().dropped, 44);
  const second = fixture(); second.diagnostic.finish(true);
  assert.notEqual(first.file, second.file); assert.equal(second.read().passed, true);
  assert.equal(readFileSync(first.file, 'utf8'), before);
});
