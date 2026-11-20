import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { build } from 'esbuild';

const runtime = { env: {}, headers: new Headers() };
globalThis.familiarityCleanupStatusRuntime = runtime;
const { outputFiles, metafile } = await build({
  entryPoints: ['app/api/state/familiarity-cleanup/status/route.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  metafile: true,
  logLevel: 'silent',
  plugins: [{
    name: 'synthetic-worker-auth',
    setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers|next\/(headers|navigation))$/ },
        args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        loader: 'js',
        contents: {
          'cloudflare:workers': 'export const env = globalThis.familiarityCleanupStatusRuntime.env;',
          'next/headers': 'export const headers = async () => globalThis.familiarityCleanupStatusRuntime.headers;',
          'next/navigation': 'export const redirect = () => { throw new Error("Unexpected redirect"); };',
        }[args.path],
      }));
    },
  }],
});
const route = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].contents).toString('base64'));
const url = 'https://study.example/api/state/familiarity-cleanup/status';
const key = 'FAMILIARITY_CLEANUP_TEST_USER_ID';
const designated = 'synthetic-current-site-account';
const ordinary = 'synthetic-other-current-site-account';
const signedIn = id => ({
  'oai-authenticated-user-id': id,
  'oai-authenticated-user-email': 'synthetic@example.test',
});

function get(headers = signedIn(designated), query = '') {
  const request = new Request(url + query, { headers });
  runtime.headers = request.headers;
  return route.GET(request);
}

async function assertStatus(response, bindingPresent, matchesCurrentLogin) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), { bindingPresent, matchesCurrentLogin });
}

beforeEach(() => { delete runtime.env[key]; });
after(() => { delete globalThis.familiarityCleanupStatusRuntime; });

test('returns only the presence and equality booleans for a matching site login', async () => {
  runtime.env[key] = designated;
  await assertStatus(await get(), true, true);
});

test('distinguishes a missing runtime binding from a delivered empty string', async () => {
  await assertStatus(await get(), false, false);
  runtime.env[key] = '';
  await assertStatus(await get(), true, false);
});

test('uses the authenticated login exclusively, even with an account query parameter', async () => {
  runtime.env[key] = designated;
  await assertStatus(await get(signedIn(ordinary), '?userId=' + designated), true, false);
  runtime.env[key] = 'synthetic-other-site-account';
  await assertStatus(await get(), true, false);
});

test('rejects anonymous and stale owner requests before revealing either boolean', async () => {
  runtime.env[key] = designated;
  for (const headers of [{}, { ...signedIn(designated), 'X-Study-Owner': ordinary }]) {
    const response = await get(headers);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(await response.json()), ['error']);
  }
});

test('rejects cross-origin diagnostics after sign-in', async () => {
  runtime.env[key] = designated;
  for (const extra of [{ Origin: 'https://other.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const response = await get({ ...signedIn(designated), ...extra });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(await response.json()), ['error']);
  }
  await assertStatus(await get({ ...signedIn(designated), Origin: 'https://study.example' }), true, true);
});

test('exports a dynamic read route with no learning database dependency', () => {
  assert.equal(route.dynamic, 'force-dynamic');
  assert.equal(route.POST, undefined);
  assert.equal(route.PUT, undefined);
  assert.equal(route.DELETE, undefined);
  assert.ok(Object.keys(metafile.inputs).every(path => !/(^|\/)db\//.test(path)));
});
