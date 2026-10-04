import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyCardStudio, isCardStudioOwner } from '../lib/server/card-studio.ts';
const origin = 'https://study.example.test';
const config = { card_studio_enabled: 'true', card_studio_owner_id: 'owner', card_studio_bridge_secret: 'test-server-credential-not-for-browser-00000', card_studio_origin: 'https://cards.example.test' };
const user = { userId: 'owner' };
test('automation routes preserve owner and origin gates and map to the private API', async () => {
  const calls=[];const transport=async(url,init)=>{calls.push({url,init});return Response.json({});};
  for(const [path,method] of [['/automation','GET'],['/automation/runs','GET'],['/automation','PUT'],['/automation/start','POST'],['/automation/pause','POST']]){
    const req=()=>request(path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{"version":1}'})});
    assert.equal((await proxyCardStudio(req(),config,{userId:'other'},transport)).status,403);
    assert.equal((await proxyCardStudio(req(),config,user,transport)).status,200);
    assert.equal(calls.at(-1).url,config.card_studio_origin+'/api'+path);
  }
  const before=calls.length;
  for(const [path,method] of [['/automation/tick','POST'],['/automation/start','GET'],['/api/automation','GET']])
    assert.equal((await proxyCardStudio(request(path,{method}),config,user,transport)).status,404);
  assert.equal((await proxyCardStudio(request('/automation/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),config,user,transport)).status,403);
  assert.equal((await proxyCardStudio(request('/automation',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:'x'.repeat(4097)}),config,user,transport)).status,413);
  assert.equal(calls.length,before);
});
function request(path = '/api/state', init = {}) { return new Request(origin + '/api/card-studio' + path, init); }
test('anonymous users and other ChatGPT accounts never reach the private card server', async () => {
  let calls = 0;
  const transport = async () => { calls++; return Response.json({}); };
  assert.equal((await proxyCardStudio(request(), config, null, transport)).status, 401);
  assert.equal((await proxyCardStudio(request(), config, { userId: 'other' }, transport)).status, 403);
  assert.equal((await proxyCardStudio(request(), { ...config, card_studio_enabled: 'false' }, user, transport)).status, 503);
  assert.equal(calls, 0);
  assert.equal(isCardStudioOwner({ ...config, card_studio_owner_id: '' }, user), false);
});
test('proxy replaces all caller identity, bearer and cookie headers and strips response secrets', async () => {
  let observed;
  const response = await proxyCardStudio(request('/api/state', { headers: { Cookie: 'fake-session', Authorization: 'fake-token', 'X-Studio-User': 'intruder' } }), config, user,
    async (url, init) => { observed = { url, init }; return Response.json({ cards: [] }, { headers: { 'Set-Cookie': 'upstream-secret', 'Access-Control-Allow-Origin': '*' } }); });
  assert.equal(observed.url, 'https://cards.example.test/api/state');
  assert.equal(observed.init.headers.get('Authorization'), `Bearer ${config.card_studio_bridge_secret}`);
  assert.equal(observed.init.headers.get('X-Studio-User'), 'owner');
  assert.equal(observed.init.headers.get('Cookie'), null);
  assert.equal(observed.init.headers.get('Origin'), config.card_studio_origin);
  assert.equal(observed.init.redirect, 'manual');
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('mutations require the exact browser origin and expected content type', async () => {
  let calls = 0;
  const transport = async () => { calls++; return Response.json({}); };
  for (const headers of [{}, { Origin: 'https://evil.test' }, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await proxyCardStudio(request('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' }), config, user, transport)).status, 403);
  }
  assert.equal((await proxyCardStudio(request('/api/cards', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{}' }), config, user, transport)).status, 415);
  assert.equal(calls, 0);
});
test('route whitelist blocks auth, logout, arbitrary proxy targets and encoded separators', async () => {
  let calls = 0;
  for (const path of ['/auth/start', '/api/logout', '/api/unknown', '/api/cards%2fanything/image', '//evil.test/api/state']) {
    assert.equal((await proxyCardStudio(request(path), config, user, async () => { calls++; return Response.json({}); })).status, 404);
  }
  assert.equal(calls, 0);
});
test('PNG bytes and revision survive proxying without an extra browser login', async () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const result = await proxyCardStudio(request('/api/cards/00000000-0000-4000-8000-000000000001/image', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/png', 'X-Card-Revision': '3' }, body: png }), config, user,
    async (_url, init) => { assert.deepEqual(init.body, png); assert.equal(init.headers.get('X-Card-Revision'), '3'); return Response.json({ id: 'asset' }, { status: 201 }); });
  assert.equal(result.status, 201);
});
test('chunked oversized requests are cancelled before contacting upstream', async () => {
  let cancelled = false, calls = 0;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(600_000)); }, cancel() { cancelled = true; } });
  const result = await proxyCardStudio(request('/api/cards', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body, duplex: 'half' }), config, user,
    async () => { calls++; return Response.json({}); });
  assert.equal(result.status, 413); assert.equal(cancelled, true); assert.equal(calls, 0);
});
test('connection loss does not retry an uncertain write or expose transport details', async () => {
  let calls = 0;
  const result = await proxyCardStudio(request('/api/cards', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }), config, user,
    async () => { calls++; throw new Error('private upstream diagnostic'); });
  assert.equal(calls, 1); assert.equal(result.status, 502);
  assert.equal((await result.text()).includes('private upstream diagnostic'), false);
});
test('conflicts retain their status and recovery message', async () => {
  const result = await proxyCardStudio(request('/api/state'), config, user, async () => Response.json({ error: 'VERSION', message: '새로고침하세요.' }, { status: 409 }));
  assert.equal(result.status, 409); assert.equal((await result.json()).error, 'VERSION');
});
test('upstream redirects are rejected without forwarding a credential to another host', async () => {
  let calls = 0;
  const result = await proxyCardStudio(request(), config, user, async (_url, init) => {
    calls++; assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://another-host.test' } });
  });
  assert.equal(result.status, 502); assert.equal(calls, 1); assert.equal(result.headers.get('Location'), null);
});
test('insecure origins are accepted only for both sides of a loopback-only local test', async () => {
  let calls = 0; const transport = async () => { calls++; return Response.json({}); };
  assert.equal((await proxyCardStudio(request(), { ...config, card_studio_origin: 'http://127.0.0.1:8788' }, user, transport)).status, 503);
  assert.equal(calls, 0);
});
