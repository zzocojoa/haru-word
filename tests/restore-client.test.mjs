import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/restore-client.ts'],outfile:'work/restore-client-tests.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const api=await import('../work/restore-client-tests.mjs');
const id='123e4567-e89b-42d3-a456-426614174000';
const job={id,baseRevision:0,fileHash:'a'.repeat(64),status:'uploading',received:[],validated:0,total:2,expiresAt:Date.now()+86400000,revision:null};
test('restore responses reject contradictory states and wrong operation identity',async t=>{
 for(const value of [{...job,status:'ready'},{...job,status:'committed',revision:1},{...job,received:[0,0]},{...job,revision:1},{...job,validated:1}])assert.equal(api.restoreJobSchema.safeParse(value).success,false);
 t.mock.method(globalThis,'fetch',async()=>Response.json({...job,id:crypto.randomUUID()}));
 await assert.rejects(api.restoreStatus(id),{name:'InvalidResponseError'});
 t.mock.method(globalThis,'fetch',async()=>Response.json(job));
 await assert.rejects(api.startRestore(1,{fileHash:job.fileHash,parts:[{},{}]}),{name:'InvalidResponseError'});
 await assert.rejects(api.startRestore(0,{fileHash:'b'.repeat(64),parts:[{},{}]}),{name:'InvalidResponseError'});
 assert.deepEqual(await api.restoreStatus(id),job);
});
test('lost commit response verifies a matching durable receipt without a second commit',async t=>{
 const receipt={...job,status:'committed',validated:2,revision:1};const calls=[];
 t.mock.method(globalThis,'fetch',async(url,init)=>{calls.push(init.method);if(init.method==='POST')throw new TypeError('offline');return Response.json(receipt)});
 assert.deepEqual(await api.commitRestore(id),receipt);assert.deepEqual(calls,['POST','GET']);
});
test('mismatched receipt cannot turn an uncertain commit into success',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({...job,id:crypto.randomUUID(),status:'committed',validated:2,revision:1}));
 await assert.rejects(api.commitRestore(id),{name:'InvalidResponseError'});
});
await build({entryPoints:['lib/server/restore-http.ts'],outfile:'work/restore-http-tests.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent',plugins:[{name:'isolated-server',setup(b){
 b.onResolve({filter:/cloudflare:workers|chatgpt-auth|db\/store$/},args=>({path:args.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='cloudflare:workers'?'export const env={get large_backup_restore_enabled(){return globalThis.restoreTestEnabled||"false"}};':args.path.includes('chatgpt-auth')?'export const getChatGPTUser=async()=>({userId:"test"});':'export const database=()=>{if(globalThis.restoreTestDb)return globalThis.restoreTestDb;throw Error("database must not be touched")};',loader:'js'}));
}}]});
const {restoreEndpoint,readBoundedJsonText}=await import('../work/restore-http-tests.mjs');
test('disabled rollout gate blocks every new mutating operation before database access',async()=>{
 for(const method of ['POST','PUT']){
  const response=await restoreEndpoint(new Request('https://example.com/api/state/restore/jobs',{method,headers:{'Content-Type':'application/json'},body:'{}'}),'test',()=>{throw Error('action must not run')});assert.equal(response.status,503);
 }
});
test('streaming request limit counts UTF-8 bytes and rejects malformed UTF-8',async()=>{
 const request=()=>new Request('https://example.com',{method:'POST',body:'가'});
 assert.equal(await readBoundedJsonText(request(),{bytes:3}),'가');await assert.rejects(readBoundedJsonText(request(),{bytes:2}),e=>e.status===413);
 await assert.rejects(readBoundedJsonText(new Request('https://example.com',{method:'POST',body:new Uint8Array([0xff])}),{bytes:10}),e=>e.status===400);
});

test('revision conflict is typed; malformed proxy replies remain a safe invalid response',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'최신 기록 확인',code:'revision_conflict',conflict:true},{status:409}));
 await assert.rejects(api.startRestore(0,{fileHash:'a'.repeat(64),parts:[]}),e=>e instanceof api.RestoreRequestError&&e.code==='revision_conflict'&&e.status===409);
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>proxy failure</html>',{status:502}));
 await assert.rejects(api.restoreStatus(id),{name:'InvalidResponseError'});
});
test('restore diagnostics contain measured bytes, timing and safe error codes only',async t=>{
 globalThis.restoreTestEnabled='true';globalThis.restoreTestDb={prepare:()=>({bind:()=>({run:async()=>{}})})};t.after(()=>{delete globalThis.restoreTestEnabled;delete globalThis.restoreTestDb;});
 const logs=[];t.mock.method(console,'info',s=>logs.push(JSON.parse(s)));t.mock.method(console,'warn',s=>logs.push(JSON.parse(s)));
 const request=()=>new Request('https://example.com/api/state/restore/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:'가'});
 const response=await restoreEndpoint(request(),'upload',async(_db,_user,metrics)=>{await readBoundedJsonText(request(),{bytes:10},metrics);return {ok:true}});assert.equal(response.status,200);assert.equal(logs[0].bytes,3);
 await restoreEndpoint(request(),'commit',async()=>{throw Error('PRIVATE learning sentence and key')});
 assert.deepEqual(Object.keys(logs[1]).sort(),['event','operation','outcome','status','code','bytes','durationMs'].sort());assert.equal(logs[1].code,'internal_error');assert.doesNotMatch(JSON.stringify(logs),/PRIVATE|hash|key|sentence/);
});
