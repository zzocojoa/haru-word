// Bounded actual-hook replay: the adapter validates the real receipt/provenance
// parser but intentionally supplies an abort-insensitive promise. Owner/store
// layers are separate checks; this mutation isolates grammar invalidation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build}=require('esbuild'),{createServer}=require('node:http');
const {launchBrowser,closeBrowser}=require('./qa/runtime.cjs');
(async()=>{
 const mutant=process.argv.includes('--mutant'),out=path.resolve('work/feedback-generation-'+(mutant?'mutant':'normal'));fs.mkdirSync(out,{recursive:true});
 await build({entryPoints:['tests/feedback-generation-harness.tsx'],outfile:out+'/harness.js',bundle:true,platform:'browser',format:'iife',logLevel:'silent',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'bounded-lifecycle',setup(b){
  b.onResolve({filter:/^\.\.\/(use-feedback-recovery|ai-request-context)$/},args=>({path:args.path,namespace:'lifecycle-adapter'}));
  b.onLoad({filter:/.*/,namespace:'lifecycle-adapter'},args=>({loader:'ts',resolveDir:process.cwd(),contents:args.path.endsWith('ai-request-context')?'export const useAiRequests=()=>({modelId:"gpt-6.1-sol",beginRequest:()=>()=>{}});':`
   import {readFeedbackRecoveryResponse} from './lib/feedback-recovery-response.ts';
   export const useFeedbackRecovery=()=>({hasPending:false,retainedFeedback:undefined,run:async(sentence,expectedModelId,send,_signal,context)=>{
    const requestId=crypto.randomUUID(),result=await send({requestId,requestStartedAt:Date.now()});
    const parsed=readFeedbackRecoveryResponse(result,{requestId,sentence,expectedModelId,expectedContextFingerprint:context.expectedContextFingerprint},false);
    if(!parsed.ok)throw Error('The positive-control response was rejected');return {feedback:parsed.feedback};
   }});`}));
  if(mutant)b.onLoad({filter:/use-grammar-feedback\.ts$/},args=>{
   const original=fs.readFileSync(args.path,'utf8').replaceAll('\r\n','\n'),guard='    generation.current++;\n    request.current?.abort();';
   assert.equal(original.split(guard).length,2,'mutation must target exactly the invalidate generation/abort pair');
   return {loader:'ts',resolveDir:path.dirname(args.path),contents:original.replace(guard,'    // Isolated test mutation: omit navigation invalidation.')};
  });
 }}]});
 const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><div id="root"></div></html>');});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{for(const engine of mutant?['chromium']:['chromium','webkit']){
  browser=await launchBrowser({engine});
  for(const invalidate of [false,true]){
   const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({path:out+'/harness.js'});await page.getByRole('button',{name:'정상 요청'}).click();
   await page.waitForFunction(()=>window.feedbackGenerationQa.sent()===1);
   if(invalidate)await page.evaluate(()=>window.feedbackGenerationQa.invalidate());
   await page.evaluate(()=>window.feedbackGenerationQa.finish());
   await page.waitForFunction(()=>document.querySelector('main')?.dataset.pending==='false');
   // Flush the accepted promise and React update even after invalidate cleared pending.
   await page.evaluate(()=>new Promise(ok=>setTimeout(ok,100)));
   const saved=await page.locator('main').getAttribute('data-saved');console.log(JSON.stringify({engine,mutant,invalidate,saved}));
   assert.equal(saved,invalidate?'0':'1','valid active feedback must apply; invalidated feedback must not apply');await page.close();
  }
  await closeBrowser(browser);browser=null;
 }}finally{if(browser)await closeBrowser(browser);server.closeAllConnections();await new Promise(ok=>server.close(ok));}
})().catch(error=>{console.error(error);process.exitCode=1;});
