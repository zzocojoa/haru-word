import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['lib/groq-http-diagnostics.ts'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
const h=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const unknown={body:'unreadable',code:'unknown',type:'unknown',parameter:'unknown'};
test('error classification retains only literal codes/types/parameters; message and generation never escape',async()=>{
 const r=Response.json({error:{code:'json_validate_failed',type:'invalid_request_error',param:'response_format',message:'private-marker',failed_generation:'private-marker',key:'private-marker'}},{status:400});
 const value=await h.captureGroqHttpDiagnostic(r);
 assert.deepEqual(value,{body:'parsed',code:'json_validate_failed',type:'invalid_request_error',parameter:'response_format'});
 assert.doesNotMatch(JSON.stringify(value),/private-marker|message|generation|key/);
 assert.equal((await r.json()).error.message,'private-marker'); // clone preserves transport ownership
});
test('unknown/hostile fields and non-object errors collapse to constants',async()=>{
 for(const error of [{code:'private-marker',type:'private-marker',param:'private-marker'},['private-marker'],'private-marker',null]){
  const value=await h.captureGroqHttpDiagnostic(Response.json({error},{status:400}));
  assert.deepEqual(value,{...unknown,body:'parsed'});assert.doesNotMatch(JSON.stringify(value),/private-marker/);
 }
});
test('oversized/malformed/empty error bodies are bounded and never logged or thrown',async()=>{
 assert.deepEqual(await h.captureGroqHttpDiagnostic(new Response('x'.repeat(20_000),{status:400})),{...unknown,body:'oversized'});
 assert.deepEqual(await h.captureGroqHttpDiagnostic(new Response('{private-marker',{status:400})),unknown);
 assert.deepEqual(await h.captureGroqHttpDiagnostic(new Response(null,{status:400})),unknown);
});
test('the UTF-8 body limit accepts exactly 16KiB and rejects the next byte',async()=>{
 const base=JSON.stringify({error:{code:'json_validate_failed'},message:''});
 for(const bytes of [16_384,16_385]){
  const raw=JSON.stringify({error:{code:'json_validate_failed'},message:'가'.repeat(5_000)+'x'.repeat(bytes-Buffer.byteLength(base)-15_000)});
  assert.equal(Buffer.byteLength(raw),bytes);
  const value=await h.captureGroqHttpDiagnostic(new Response(raw,{status:400}));
  assert.deepEqual(value,bytes===16_384?{...unknown,body:'parsed',code:'json_validate_failed'}:{...unknown,body:'oversized'});
 }
});
test('abort cancels a stalled diagnostic stream and preserves a safe failure',async()=>{
 const stop=new AbortController();let cancelled=false;
 const r=new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:400});
 const result=h.captureGroqHttpDiagnostic(r,stop.signal);stop.abort();
 assert.deepEqual(await result,unknown);void r.body.cancel();await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);
});
test('successful responses are never read for HTTP diagnostics',async()=>{
 const r=Response.json({private:'private-marker'});assert.deepEqual(await h.captureGroqHttpDiagnostic(r),unknown);assert.deepEqual(await r.json(),{private:'private-marker'});
});
test('serialized evidence rejects unknown values/keys and misleading nonparsed codes',()=>{
 assert.deepEqual(h.parseGroqHttpDiagnostic(unknown),unknown);
 for(const value of [{...unknown,raw:'private-marker'},{...unknown,code:'private-marker'},{...unknown,body:{}},{...unknown,type:123},{...unknown,parameter:'private-marker'},{...unknown,code:'json_validate_failed'}])assert.equal(h.parseGroqHttpDiagnostic(value),undefined);
});
