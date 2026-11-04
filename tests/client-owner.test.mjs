import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {registerClientOwner,clientOwnerRequest,OWNER_INVALIDATED_EVENT,LOCAL_RESTORE_APPLIED_EVENT,captureLocalRestoreNotice} from '../lib/client-owner.ts';
import {requestJson} from '../lib/client-request.ts';

test('owner binding is limited to API requests, retains caller headers and handles anonymous pages',()=>{
  const init={headers:{'Content-Type':'application/json'}};
  assert.equal(clientOwnerRequest('/api/state',init).init,init);
  let clear=registerClientOwner('owner-a');
  const bound=clientOwnerRequest('/api/state',init).init;
  assert.equal(bound.headers.get('X-Study-Owner'),'owner-a');
  assert.equal(bound.headers.get('Content-Type'),'application/json');
  assert.equal(clientOwnerRequest('https://api.openai.com/v1/responses',init).init,init);
  clear();clear=registerClientOwner(null);
  assert.equal(clientOwnerRequest('/api/state',{}).init.headers.get('X-Study-Owner'),'');clear();
});

test('late unauthorized response from a replaced owner cannot invalidate the new page',async t=>{
  const win=new EventTarget();globalThis.window=win;t.after(()=>{delete globalThis.window;});
  let invalidations=0;win.addEventListener(OWNER_INVALIDATED_EVENT,()=>invalidations++);
  const old=registerClientOwner('owner-a');let finish;
  t.mock.method(globalThis,'fetch',async()=>new Promise(r=>{finish=r;}));
  const pending=requestJson('/api/state',{},1000);
  const current=registerClientOwner('owner-b');old();
  finish(Response.json({error:'login_required'},{status:401}));await pending;
  assert.equal(invalidations,0);
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    assert.equal(init.headers.get('X-Study-Owner'),'owner-b');
    return Response.json({error:'login_required'},{status:401});
  });
  await requestJson('/api/state',{},1000);assert.equal(invalidations,1);current();
});

test('restore cleanup is captured for one mounted owner and cannot clear a replacement account',t=>{
 const win=new EventTarget();globalThis.window=win;t.after(()=>{delete globalThis.window;});let calls=0;
 win.addEventListener(LOCAL_RESTORE_APPLIED_EVENT,()=>calls++);
 captureLocalRestoreNotice()();assert.equal(calls,0);
 const old=registerClientOwner('owner-a'),notify=captureLocalRestoreNotice();notify();assert.equal(calls,1);
 const next=registerClientOwner('owner-b');old();notify();assert.equal(calls,1);
 captureLocalRestoreNotice()();assert.equal(calls,2);next();
});

mkdirSync('work/client-owner-tests',{recursive:true});
await build({entryPoints:['app/chatgpt-auth.ts','app/api/state/route.ts','app/api/sentence-feedback/route.ts','app/api/grammar-feedback/route.ts'],outdir:'work/client-owner-tests',outbase:'app',bundle:true,format:'esm',platform:'node',logLevel:'silent',outExtension:{'.js':'.mjs'},plugins:[{name:'owner-boundaries',setup(b){
  b.onResolve({filter:/^(next\/headers|next\/navigation|cloudflare:workers|@\/db\/store)$/},a=>({path:a.path,namespace:'owner-test'}));
  b.onLoad({filter:/.*/,namespace:'owner-test'},a=>({loader:'js',contents:a.path==='next/headers'?'export const headers=async()=>globalThis.ownerTestHeaders':a.path==='next/navigation'?'export const redirect=()=>{throw Error("redirect")}':a.path==='cloudflare:workers'?'export const env={}':'export const database=()=>{globalThis.ownerTestDbCalls++;throw Error("unexpected database")}' }));
}}]});
const auth=await import('../work/client-owner-tests/chatgpt-auth.mjs');
test('server owner check uses verified ID and email and retains headerless legacy clients',async()=>{
  for(const [expected,allowed] of [[undefined,true],['owner-b',true],['owner-a',false],['',false]]){
    const h=new Headers({'oai-authenticated-user-id':'owner-b','oai-authenticated-user-email':'b@sites.test'});
    if(expected!==undefined)h.set('x-study-owner',expected);globalThis.ownerTestHeaders=h;
    assert.equal(!!await auth.getChatGPTUser(),allowed);
  }
  globalThis.ownerTestHeaders=new Headers({'oai-authenticated-user-id':'owner-b','x-study-owner':'owner-b'});
  assert.equal(await auth.getChatGPTUser(),null);
  delete globalThis.ownerTestHeaders;
});

test('stale owner is rejected before owned state or paid provider access on real route auth',async t=>{
  globalThis.ownerTestHeaders=new Headers({'oai-authenticated-user-id':'owner-b','oai-authenticated-user-email':'b@sites.test','x-study-owner':'owner-a'});
  globalThis.ownerTestDbCalls=0;
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected provider');});
  for(const path of ['state','sentence-feedback','grammar-feedback']){
    const route=await import(`../work/client-owner-tests/api/${path}/route.mjs`);
    const result=await (path==='state'?route.PUT:route.POST)(new Request('https://study.example/api/'+path,{method:path==='state'?'PUT':'POST'}));
    assert.equal(result.status,401,path);
  }
  assert.equal(globalThis.ownerTestDbCalls,0);assert.equal(fetch.mock.callCount(),0);
  delete globalThis.ownerTestHeaders;delete globalThis.ownerTestDbCalls;
});
