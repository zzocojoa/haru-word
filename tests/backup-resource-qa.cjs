// Dedicated local workerd + D1, never a production account. Native V8 memory,
// not browser process memory or successful requests used as a memory proxy.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('esbuild');
const {history}=require('./fixtures/backup-history.cjs');
const {accountHeaders}=require('./qa/runtime.cjs');
const {isolatedWorker,inspectorSession}=require('./qa/isolated-worker.cjs');
const out='outputs/backup-resource';fs.mkdirSync(out,{recursive:true});
(async()=>{
 await build({entryPoints:['lib/backup-analysis.ts'],outfile:'work/resource-analysis.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
 const {analyzeBackup}=await import('../work/resource-analysis.mjs');
 // Capacity includes the grammar collection even when empty. An old-format
 // 20 MB fixture omitting it exceeds the final-state limit by its envelope bytes.
 const state={...history(1825),grammar:{}},envelope=s=>JSON.stringify({format:'haru-words-v1',exportedAt:'2026-09-24T00:00:00.000Z',state:s});let remaining=20_000_000-Buffer.byteLength(envelope(state));
 for(const row of Object.values(state.progress)){const n=Math.min(1900,Math.floor((remaining-11)/3));if(n<=0)break;row.notes='가'.repeat(n);remaining-=n*3+11;}
 const raw=envelope(state);assert.ok(Buffer.byteLength(raw)>19_999_900);const exact=raw+' '.repeat(20_000_000-Buffer.byteLength(raw)),analyzed=await analyzeBackup(exact);
 const worker=await isolatedWorker('backup-resource');let cdp,active=true,poll;const samples=[],requests=[];let phase='startup';
 try{
  cdp=await inspectorSession(worker.inspector);
  poll=(async()=>{while(active){const heap=await cdp.send('Runtime.getHeapUsage');samples.push({phase,...heap});await new Promise(r=>setTimeout(r,5));}})();
  const headers={...accountHeaders('resource'),'Content-Type':'application/json','Connection':'close','X-Study-Grammar':'4'};
  const call=async(path,method='GET',body)=>{phase=path.split('/').at(-1)==='state'?'load':path.includes('/chunks/')?'upload':path.split('/').at(-1);const started=performance.now();const r=await fetch(worker.base+path,{method,headers,body,signal:AbortSignal.timeout(30000)});const text=await r.text();assert.equal(r.status,200,text.slice(0,150));requests.push({phase,ms:performance.now()-started,bytes:Buffer.byteLength(text)});return JSON.parse(text);};
  const start=await call('/api/state');let job=await call('/api/state/restore/jobs','POST',JSON.stringify({revision:start.revision,manifest:analyzed.manifest}));
  for(let i=0;i<analyzed.parts.length;i++)job=await call('/api/state/restore/jobs/'+job.id+'/chunks/'+i,'PUT',analyzed.parts[i]);
  while(job.status!=='ready')job=await call('/api/state/restore/jobs/'+job.id+'/validate','POST');
  await call('/api/state/restore/jobs/'+job.id+'/commit','POST');
  // Repeat full reads to include retained allocations and garbage collections.
  for(let i=0;i<3;i++)assert.deepEqual((await call('/api/state')).state,state);
  active=false;await poll;
  const used=s=>s.usedSize+(s.embedderHeapUsedSize||0)+(s.backingStorageSize||0),peak=samples.reduce((a,b)=>used(a)>used(b)?a:b);
  const result={passed:used(peak)<128*1024*1024,fileBytes:Buffer.byteLength(exact),sessions:1825,memoryLimitBytes:128*1024*1024,v8Limits:{oldSpaceMb:96,semiSpaceMb:4},sampleCount:samples.length,peak:{...peak,observedBytes:used(peak)},requests,method:'workerd V8 Runtime.getHeapUsage sampled every 5 ms; heap + embedder + backing storage; synchronous intervals may delay samples'};
  fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));assert.ok(samples.length>10);assert.ok(result.passed,JSON.stringify(result.peak));assert.ok(requests.every(r=>r.ms<30000));console.log(JSON.stringify(result));
 }finally{active=false;await poll?.catch(()=>{});cdp?.close();worker.stop();}
})().catch(e=>{console.error(e);process.exitCode=1});
