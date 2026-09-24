import test from 'node:test';
import assert from 'node:assert/strict';
import {stateResponse} from '../lib/server/state-response.ts';
const snapshot=()=>({revision:7,settings:JSON.stringify({level:'A1',dailyGoal:10}),progress:[{entry_id:'word"한글',document:JSON.stringify({notes:'보관할 문장 😀',draft:{answer:'hel'}})}],sessions:[{session_id:'id',document:JSON.stringify({sentence:'I travel.',en:'independent',ko:'help'})}]});
test('state stream preserves every raw document and the snapshot revision without parsing copies',async()=>{
 const input=snapshot(),expected={revision:7,state:{settings:JSON.parse(input.settings),progress:Object.fromEntries(input.progress.map(r=>[r.entry_id,JSON.parse(r.document)])),sessions:Object.fromEntries(input.sessions.map(r=>[r.session_id,JSON.parse(r.document)]))}};
 let bytes=0,failures=0;const response=stateResponse(input,n=>bytes=n,()=>failures++),text=await response.text();assert.deepEqual(JSON.parse(text),expected);assert.equal(bytes,Buffer.byteLength(text));assert.equal(failures,0);assert.equal(input.progress.length,0);assert.equal(input.sessions.length,0);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('cancelling a partial state stream releases rows and never claims a completed load',async()=>{
 const input=snapshot();input.progress[0].document=JSON.stringify({notes:'가'.repeat(40000)});let done=0,failed=0;const reader=stateResponse(input,()=>done++,()=>failed++).body.getReader();await reader.read();await reader.cancel();assert.equal(done,0);assert.equal(failed,1);assert.equal(input.progress.length,0);assert.equal(input.sessions.length,0);
});
test('empty state produces a valid complete JSON response',async()=>{assert.deepEqual(await stateResponse({revision:0,settings:'{}',progress:[],sessions:[]},()=>{},()=>{}).json(),{revision:0,state:{settings:{},progress:{},sessions:{}}});});
