// Local built Worker and synthetic identities. No hosted learner records.
const {chromium}=require('./qa/runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const base=require('./qa/runtime.cjs').base,out='outputs/startup-performance';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch(),samples=[],errors=[];try{
 for(let i=0;i<3;i++){
  const c=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'oai-authenticated-user-id':require('./qa/runtime.cjs').account('startup_')+'_'+i,'oai-authenticated-user-email':'startup@example.test'}});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__startup={longTasks:[],lcp:0};new PerformanceObserver(l=>window.__startup.longTasks.push(...l.getEntries().map(e=>Math.round(e.duration)))).observe({type:'longtask',buffered:true});new PerformanceObserver(l=>{window.__startup.lcp=l.getEntries().at(-1)?.startTime||0}).observe({type:'largest-contentful-paint',buffered:true});});
  const cdp=await c.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const start=performance.now();await p.goto(base);await p.getByText('서버에 저장됨',{exact:true}).waitFor();const ready=Math.round(performance.now()-start);
  const settings=p.getByRole('button',{name:'학습 설정',exact:true});await settings.click();await p.getByRole('dialog').waitFor();
  samples.push({readyMs:ready,...await p.evaluate(()=>({lcpMs:Math.round(window.__startup.lcp),longTasksMs:window.__startup.longTasks,resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/_next/static/')).map(e=>({path:new URL(e.name).pathname,encodedBytes:e.encodedBodySize,decodedBytes:e.decodedBodySize,durationMs:Math.round(e.duration)}))}))});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await c.close();
 }
 const dir='dist/client/_next/static/chunks/';const chunks=fs.readdirSync(dir).filter(f=>f.endsWith('.js')).map(name=>{const b=fs.readFileSync(dir+name);return{name,bytes:b.length,gzipBytes:zlib.gzipSync(b).length}}).sort((a,b)=>b.bytes-a.bytes);
 assert.deepEqual(errors,[]);const report={passed:true,environment:'Local built Worker, three cold Chromium contexts, 390px, CPU 4x slowdown, unthrottled loopback. Gzip is computed, not measured hosted transfer. Not actual iPhone or field Web Vitals.',samples,chunks,browserErrors:errors};fs.writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,samples:samples.map(({resources,...s})=>s),largestChunk:chunks[0],browserErrors:errors}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
