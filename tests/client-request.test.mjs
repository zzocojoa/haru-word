import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJson,RequestTimeoutError} from '../lib/client-request.ts';

const untilAbort=signal=>new Promise((_,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
test('header timeout aborts exactly one request and does not retry',async t=>{
 let calls=0,signal;t.mock.method(globalThis,'fetch',(_url,init)=>{calls++;signal=init.signal;return untilAbort(signal)});
 await assert.rejects(requestJson('/api/state',{},10),RequestTimeoutError);assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('timeout remains active until the JSON body has been read',async t=>{
 let signal;t.mock.method(globalThis,'fetch',async(_url,init)=>{signal=init.signal;return {ok:true,json:()=>untilAbort(signal)}});
 await assert.rejects(requestJson('/api/state',{},10),RequestTimeoutError);assert.equal(signal.aborted,true);
});
test('caller cancellation is distinct from timeout and prevents stale application',async t=>{
 const controller=new AbortController();t.mock.method(globalThis,'fetch',(_url,init)=>untilAbort(init.signal));
 const pending=requestJson('/api/state',{signal:controller.signal},1000);controller.abort();await assert.rejects(pending,e=>e.name==='AbortError'&&!(e instanceof RequestTimeoutError));
});
test('successful response removes timeout and caller cancellation listener',async t=>{
 let signal;const controller=new AbortController();t.mock.method(globalThis,'fetch',async(_url,init)=>{signal=init.signal;return new Response('{"revision":1}')});
 const r=await requestJson('/api/state',{signal:controller.signal},10);assert.deepEqual(r.data,{revision:1});controller.abort();await new Promise(r=>setTimeout(r,20));assert.equal(signal.aborted,false);
});
test('HTTP errors are returned for callers to handle without retrying',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response('{"error":"conflict"}',{status:409}));const r=await requestJson('/api/state',{method:'PUT'},100);assert.equal(r.response.status,409);assert.equal(r.data.error,'conflict');assert.equal(mock.mock.callCount(),1);
});
test('invalid JSON fails without turning into an eventual timeout',async t=>{
 let signal;t.mock.method(globalThis,'fetch',async(_url,init)=>{signal=init.signal;return new Response('not json')});await assert.rejects(requestJson('/api/state',{},10),SyntaxError);await new Promise(r=>setTimeout(r,20));assert.equal(signal.aborted,false);
});
